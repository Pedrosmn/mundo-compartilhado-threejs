import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TARGET_HEIGHT } from './config.js';
import { AnimationController } from './animations.js';

const RING_GEOMETRY = new THREE.RingGeometry(0.58, 0.72, 56);

function createLabel(member) {
  const element = document.createElement('div');
  element.className = 'member-label';
  element.style.setProperty('--member-color', member.color);

  const name = document.createElement('span');
  name.className = 'member-label__name';
  name.textContent = member.displayName;

  element.append(name);

  const label = new CSS2DObject(element);
  label.center.set(0.5, 1.05);
  label.position.set(0, TARGET_HEIGHT + 0.42, 0);

  return { label, element };
}

function createSelectionRing(member) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(member.color),
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const ring = new THREE.Mesh(RING_GEOMETRY, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  ring.visible = false;
  ring.userData.ignoreRaycast = true;
  ring.raycast = () => {};

  return ring;
}

/**
 * Some Sketchfab exports (notably Blake) have skinned geometry authored far
 * outside the skeleton's scale. Three.js still renders the bind pose, but any
 * animation stretches the mesh. Detect that mismatch, rescale the geometry to
 * the skeleton and rebuild the inverse bind matrices from the rest pose.
 */
function repairSkinnedScale(root) {
  root.updateMatrixWorld(true);

  const meshes = [];
  root.traverse((object) => {
    if (object.isSkinnedMesh) meshes.push(object);
  });
  if (meshes.length === 0) return false;

  const body = meshes.reduce((largest, mesh) =>
    mesh.geometry.attributes.position.count >
    largest.geometry.attributes.position.count
      ? mesh
      : largest,
  );
  if (!body.skeleton) return false;

  const boneBox = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const bone of body.skeleton.bones) {
    boneBox.expandByPoint(bone.getWorldPosition(point));
  }
  const boneHeight = boneBox.max.y - boneBox.min.y;

  body.computeBoundingBox();
  const meshBox = body.boundingBox.clone().applyMatrix4(body.matrixWorld);
  const meshHeight = meshBox.max.y - meshBox.min.y;

  if (!(boneHeight > 0)) return false;
  if (meshHeight < boneHeight * 1.8) return false;

  const worldScale = body.getWorldScale(new THREE.Vector3()).y;
  body.geometry.computeBoundingBox();
  const localBox = body.geometry.boundingBox;
  const localHeight = localBox.max.y - localBox.min.y;
  if (!(localHeight > 0) || !(worldScale > 0)) return false;

  const factor = boneHeight / worldScale / localHeight;
  const geometries = new Set();

  for (const mesh of meshes) {
    if (!geometries.has(mesh.geometry)) {
      geometries.add(mesh.geometry);
      mesh.geometry.scale(factor, factor, factor);
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
    }
    mesh.boundingBox = null;
    mesh.boundingSphere = null;
  }

  const skeletons = new Set(meshes.map((mesh) => mesh.skeleton));
  for (const skeleton of skeletons) skeleton.calculateInverses();
  root.updateMatrixWorld(true);
  for (const skeleton of skeletons) skeleton.update();

  // These face parts were authored in a different bind space and end up
  // detached after the repair. The body texture already covers the face, so
  // they are dropped instead of floating around the character.
  for (const mesh of meshes) {
    const name = mesh.geometry.name || mesh.name;
    if (/^(inner_mouth|teeth|eyes|tongue)/i.test(name)) {
      mesh.removeFromParent();
    }
  }

  return true;
}

const _partBox = new THREE.Box3();

/**
 * Bounding box used for normalization. Raw geometry bounds are not reliable
 * here: some exports (notably Blake) author accessory geometry in a detached
 * space, so a global union can report a 4.6 m tall character. The largest
 * skinned mesh is always the body and gives a trustworthy height and floor.
 */
function computeVisibleBounds(root) {
  root.updateMatrixWorld(true);

  let body = null;
  root.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    const count = object.geometry.attributes.position?.count ?? 0;
    if (!body || count > body.geometry.attributes.position.count) body = object;
  });

  if (body) {
    body.computeBoundingBox();
    return _partBox.copy(body.boundingBox).applyMatrix4(body.matrixWorld).clone();
  }

  // Static fallback: union of every mesh in the hierarchy.
  const bounds = new THREE.Box3();
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    bounds.union(
      _partBox.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld),
    );
  });

  return bounds;
}

/**
 * Scales the model to TARGET_HEIGHT, centers it horizontally and puts the
 * feet exactly on y = 0.
 */
function prepareModel(root) {
  const repaired = repairSkinnedScale(root);
  if (repaired && import.meta.env.DEV) {
    console.info('[characters] skinned mesh rescaled to match its skeleton');
  }

  root.updateMatrixWorld(true);

  const box = computeVisibleBounds(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const sourceHeight = Math.max(size.y, 0.001);

  root.scale.setScalar(TARGET_HEIGHT / sourceHeight);
  root.updateMatrixWorld(true);

  box.copy(computeVisibleBounds(root));
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);

  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });

  return { root, sourceHeight };
}

function createPlaceholderModel() {
  const group = new THREE.Group();
  group.name = 'placeholder';

  const material = new THREE.MeshStandardMaterial({
    color: 0x82907c,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
  });

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 6, 14),
    material,
  );
  body.position.y = 0.64;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 18, 14),
    material,
  );
  head.position.y = 1.55;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 0.08, 24),
    new THREE.MeshStandardMaterial({
      color: 0x5c6b58,
      roughness: 1,
      transparent: true,
      opacity: 0.65,
    }),
  );
  base.position.y = 0.04;

  group.add(body, head, base);
  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Builds a character entry: scaled GLTF (or placeholder), label, selection
 * ring and animation controller.
 */
export function createCharacter(member, gltf) {
  const group = new THREE.Group();
  group.name = `character-${member.id}`;
  group.userData.memberId = member.id;
  group.position.set(...member.position);
  group.rotation.y = member.rotationY;

  let model;
  let controller = null;
  let sourceHeight = TARGET_HEIGHT;

  if (gltf) {
    const prepared = prepareModel(gltf.scene);
    model = prepared.root;
    sourceHeight = prepared.sourceHeight;
    group.add(model);
    controller = new AnimationController(gltf.animations, model, {
      sourceHeight,
    });
  } else {
    model = createPlaceholderModel();
    group.add(model);
  }

  const { label, element } = createLabel(member);
  group.add(label);

  const ring = createSelectionRing(member);
  group.add(ring);

  let selected = false;

  const character = {
    member,
    group,
    model,
    label,
    ring,
    controller,
    clips: controller?.clips ?? [],
    presets: controller?.presets ?? { idle: null, walk: null, run: null },
    placeholder: !gltf,
    get selected() {
      return selected;
    },
    play(clipId, options) {
      return controller?.play(clipId, options) ?? false;
    },
    setSelected(value) {
      selected = value;
      ring.visible = value;
      element.classList.toggle('is-selected', value);
    },
    update(dt, elapsed) {
      controller?.update(dt);

      if (selected) {
        ring.visible = true;
        ring.material.opacity = 0.5 + Math.sin(elapsed * 3.1) * 0.16;
        ring.scale.setScalar(1 + Math.sin(elapsed * 3.1) * 0.03);
      } else {
        ring.visible = false;
      }

      if (!gltf) {
        model.position.y = Math.sin(elapsed * 1.4) * 0.02;
      }
    },
  };

  return character;
}
