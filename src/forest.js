import * as THREE from 'three';

const SEED = 20261026;
const GROUND_SIZE = 150;
const TREE_COUNT = 44;
const ROCK_COUNT = 26;
const BUSH_COUNT = 34;
const GRASS_COUNT = 520;
const SPORE_COUNT = 90;

/** Small deterministic PRNG so the forest is identical after every reload. */
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Smooth rolling terrain. The area around the origin stays completely flat so
 * the characters always have solid ground under their feet.
 */
function terrainHeight(x, z) {
  const radius = Math.hypot(x, z);
  const blend = THREE.MathUtils.smoothstep(radius, 5.2, 22);
  const height =
    Math.sin(x * 0.17 + 1.3) * 0.55 +
    Math.cos(z * 0.13 - 0.7) * 0.65 +
    Math.sin((x + z) * 0.31) * 0.22 +
    Math.sin(x * 0.045 - z * 0.06) * 0.9;
  return height * blend;
}

/** Keeps the initial camera corridor free of trees. */
function blocksCameraCorridor({ x, z }) {
  return z > 2 && z < 17 && Math.abs(x) < 7;
}

function scatter(random, count, { minRadius, maxRadius, minDistance = 2.6, reject }) {
  const points = [];
  let attempts = 0;
  const maxAttempts = count * 60;

  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = minRadius + random() * (maxRadius - minRadius);
    const point = {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    };

    if (reject && reject(point)) continue;
    if (
      points.some(
        (other) =>
          (other.x - point.x) ** 2 + (other.z - point.z) ** 2 <
          minDistance ** 2,
      )
    ) {
      continue;
    }

    points.push(point);
  }

  return points;
}

function createMaterials() {
  return {
    bark: new THREE.MeshStandardMaterial({
      color: 0x5b4632,
      roughness: 0.95,
      flatShading: true,
    }),
    barkDark: new THREE.MeshStandardMaterial({
      color: 0x473527,
      roughness: 1,
      flatShading: true,
    }),
    leafDark: new THREE.MeshStandardMaterial({
      color: 0x2f5a33,
      roughness: 0.9,
      flatShading: true,
    }),
    leaf: new THREE.MeshStandardMaterial({
      color: 0x3f6f3a,
      roughness: 0.9,
      flatShading: true,
    }),
    leafLight: new THREE.MeshStandardMaterial({
      color: 0x5a8144,
      roughness: 0.9,
      flatShading: true,
    }),
    rock: new THREE.MeshStandardMaterial({
      color: 0x7a7f74,
      roughness: 1,
      flatShading: true,
    }),
    rockMoss: new THREE.MeshStandardMaterial({
      color: 0x66735a,
      roughness: 1,
      flatShading: true,
    }),
    bush: new THREE.MeshStandardMaterial({
      color: 0x3b6536,
      roughness: 1,
      flatShading: true,
    }),
    grass: new THREE.MeshStandardMaterial({
      color: 0x4c7138,
      roughness: 1,
      flatShading: true,
    }),
    dirt: new THREE.MeshStandardMaterial({
      color: 0x6b5940,
      roughness: 1,
      transparent: true,
      opacity: 0.85,
    }),
    dirtEdge: new THREE.MeshStandardMaterial({
      color: 0x435335,
      roughness: 1,
      transparent: true,
      opacity: 0.65,
    }),
  };
}

function createGround(random, materials) {
  const geometry = new THREE.PlaneGeometry(
    GROUND_SIZE,
    GROUND_SIZE,
    150,
    150,
  );
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const palette = [
    new THREE.Color(0x3d6335),
    new THREE.Color(0x486f3b),
    new THREE.Color(0x31532d),
    new THREE.Color(0x557a40),
  ];
  const tint = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, terrainHeight(x, z));

    const noise =
      Math.sin(x * 0.7 + z * 0.43) * 0.5 +
      Math.sin(z * 0.31 - x * 0.19) * 0.5;
    const index = Math.min(
      palette.length - 1,
      Math.max(0, Math.floor((noise * 0.5 + 0.5) * palette.length)),
    );
    tint.copy(palette[index]).multiplyScalar(0.85 + random() * 0.25);
    tint.toArray(colors, i * 3);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    }),
  );
  mesh.name = 'ground';
  mesh.receiveShadow = true;

  // Dirt clearing under the characters, with a softer outer transition ring.
  const edge = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), materials.dirtEdge);
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.008;
  edge.receiveShadow = true;

  const clearing = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 64),
    materials.dirt,
  );
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.y = 0.014;
  clearing.receiveShadow = true;

  return { ground: mesh, decorations: [edge, clearing] };
}

const TRUNK_GEOMETRY = new THREE.CylinderGeometry(0.16, 0.24, 1, 6);
TRUNK_GEOMETRY.translate(0, 0.5, 0);

const CONE_GEOMETRY = new THREE.ConeGeometry(1, 1, 7);
CONE_GEOMETRY.translate(0, 0.5, 0);

const BLOB_GEOMETRY = new THREE.IcosahedronGeometry(1, 0);

function addShadowFlags(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createConifer(random, materials) {
  const tree = new THREE.Group();
  const scale = 0.85 + random() * 0.85;
  const trunkHeight = (1.25 + random() * 0.5) * scale;

  const trunk = new THREE.Mesh(TRUNK_GEOMETRY, materials.bark);
  trunk.scale.set(scale * 0.9, trunkHeight, scale * 0.9);
  tree.add(trunk);

  const foliage = new THREE.Group();
  foliage.position.y = trunkHeight * 0.72;

  const layers = [
    { radius: 1.35, height: 2.2, y: 0, material: materials.leafDark },
    { radius: 1.02, height: 1.85, y: 0.8, material: materials.leaf },
    { radius: 0.68, height: 1.5, y: 1.55, material: materials.leafLight },
  ];

  for (const layer of layers) {
    const cone = new THREE.Mesh(CONE_GEOMETRY, layer.material);
    cone.scale.set(
      layer.radius * scale,
      layer.height * scale,
      layer.radius * scale,
    );
    cone.position.y = layer.y * scale;
    cone.rotation.y = random() * Math.PI;
    foliage.add(cone);
  }

  tree.add(foliage);
  addShadowFlags(tree);

  return {
    object: tree,
    sway: foliage,
    phase: random() * Math.PI * 2,
    speed: 0.55 + random() * 0.45,
    amplitude: 0.018 + random() * 0.02,
  };
}

function createBroadleaf(random, materials) {
  const tree = new THREE.Group();
  const scale = 0.8 + random() * 0.75;
  const trunkHeight = (2.1 + random() * 0.8) * scale;

  const trunk = new THREE.Mesh(TRUNK_GEOMETRY, materials.barkDark);
  trunk.scale.set(scale, trunkHeight, scale);
  tree.add(trunk);

  const foliage = new THREE.Group();
  foliage.position.y = trunkHeight;

  const clusters = [
    { x: 0, y: 0.95, z: 0, size: 1.5, material: materials.leaf },
    { x: 0.95, y: 0.55, z: 0.35, size: 1.05, material: materials.leafLight },
    { x: -0.9, y: 0.6, z: -0.2, size: 1.0, material: materials.leafDark },
    { x: 0.1, y: 1.7, z: -0.35, size: 0.95, material: materials.leafDark },
  ];

  for (const cluster of clusters) {
    const blob = new THREE.Mesh(BLOB_GEOMETRY, cluster.material);
    const size = cluster.size * scale;
    blob.scale.set(size, size * 0.88, size);
    blob.position.set(cluster.x * scale, cluster.y * scale, cluster.z * scale);
    blob.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    foliage.add(blob);
  }

  tree.add(foliage);
  addShadowFlags(tree);

  return {
    object: tree,
    sway: foliage,
    phase: random() * Math.PI * 2,
    speed: 0.45 + random() * 0.4,
    amplitude: 0.012 + random() * 0.018,
  };
}

function createRocks(random, materials) {
  const rocks = [];
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const points = scatter(random, ROCK_COUNT, {
    minRadius: 5.2,
    maxRadius: 34,
    minDistance: 2.4,
  });

  for (const point of points) {
    const rock = new THREE.Mesh(
      geometry,
      random() > 0.7 ? materials.rockMoss : materials.rock,
    );
    const size = 0.25 + random() * 0.75;
    rock.scale.set(size * (0.8 + random() * 0.5), size, size * (0.8 + random() * 0.5));
    rock.position.set(
      point.x,
      terrainHeight(point.x, point.z) + size * 0.25,
      point.z,
    );
    rock.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rocks.push(rock);
  }

  return rocks;
}

function createBushes(random, materials) {
  const bushes = [];
  const points = scatter(random, BUSH_COUNT, {
    minRadius: 4.8,
    maxRadius: 30,
    minDistance: 1.8,
  });

  for (const point of points) {
    const bush = new THREE.Mesh(BLOB_GEOMETRY, materials.bush);
    const size = 0.3 + random() * 0.45;
    bush.scale.set(size * 1.3, size * 0.9, size * 1.2);
    bush.position.set(
      point.x,
      terrainHeight(point.x, point.z) + size * 0.55,
      point.z,
    );
    bush.rotation.y = random() * Math.PI;
    bush.castShadow = true;
    bush.receiveShadow = true;
    bushes.push(bush);
  }

  return bushes;
}

function createGrass(random, materials) {
  const geometry = new THREE.ConeGeometry(0.055, 0.5, 3);
  geometry.translate(0, 0.25, 0);

  const mesh = new THREE.InstancedMesh(geometry, materials.grass, GRASS_COUNT);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < GRASS_COUNT; i += 1) {
    const angle = random() * Math.PI * 2;
    // Keep the dirt clearing under the characters free of tall grass.
    const radius = 5.2 + random() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 0.5 + random() * 0.6;

    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(
      (random() - 0.5) * 0.22,
      random() * Math.PI,
      (random() - 0.5) * 0.22,
    );
    dummy.scale.set(0.7 + random() * 0.9, height, 0.7 + random() * 0.9);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    color.setHSL(0.26 + random() * 0.05, 0.3 + random() * 0.15, 0.22 + random() * 0.12);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return mesh;
}

/** Soft round sprite so nearby spores glow instead of showing hard squares. */
function createSporeTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.75)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSpores(random) {
  const positions = new Float32Array(SPORE_COUNT * 3);
  const bases = [];

  for (let i = 0; i < SPORE_COUNT; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.5 + random() * 13;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0.4 + random() * 2.6;

    bases.push({
      x,
      y,
      z,
      phase: random() * Math.PI * 2,
      speed: 0.25 + random() * 0.5,
      radius: 0.15 + random() * 0.4,
    });

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xdaf3a4,
      map: createSporeTexture(),
      size: 0.05,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  points.frustumCulled = false;

  return { points, bases, positions, geometry };
}

/**
 * Builds the whole procedural forest, including terrain, vegetation and the
 * wind animation state.
 */
export function createForest(scene) {
  const random = mulberry32(SEED);
  const materials = createMaterials();
  const group = new THREE.Group();
  group.name = 'forest';

  const { ground, decorations } = createGround(random, materials);
  group.add(ground, ...decorations);

  const trees = [];
  const treePoints = scatter(random, TREE_COUNT, {
    minRadius: 5.4,
    maxRadius: 44,
    minDistance: 3.1,
    reject: blocksCameraCorridor,
  });

  treePoints.forEach((point, index) => {
    const tree =
      index % 5 < 3
        ? createConifer(random, materials)
        : createBroadleaf(random, materials);
    tree.object.position.set(
      point.x,
      terrainHeight(point.x, point.z) - 0.05,
      point.z,
    );
    tree.object.rotation.y = random() * Math.PI * 2;
    group.add(tree.object);
    trees.push(tree);
  });

  for (const rock of createRocks(random, materials)) group.add(rock);
  for (const bush of createBushes(random, materials)) group.add(bush);

  group.add(createGrass(random, materials));

  const spores = createSpores(random);
  group.add(spores.points);

  scene.add(group);

  function update(_dt, elapsed) {
    for (const tree of trees) {
      tree.sway.rotation.z =
        Math.sin(elapsed * tree.speed + tree.phase) * tree.amplitude;
      tree.sway.rotation.x =
        Math.cos(elapsed * tree.speed * 0.77 + tree.phase) *
        tree.amplitude *
        0.7;
    }

    const position = spores.positions;
    for (let i = 0; i < spores.bases.length; i += 1) {
      const base = spores.bases[i];
      const drift = elapsed * base.speed * 0.35 + base.phase;
      position[i * 3] = base.x + Math.sin(drift) * base.radius;
      position[i * 3 + 1] =
        base.y + Math.sin(elapsed * base.speed + base.phase) * 0.25;
      position[i * 3 + 2] = base.z + Math.cos(drift * 0.8) * base.radius;
    }
    spores.geometry.attributes.position.needsUpdate = true;
  }

  return { group, trees, update };
}
