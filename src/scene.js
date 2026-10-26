import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOV = 48;
const PANEL_WIDTH = 372;
const PANEL_MARGIN = 24;

// On desktop the control panel occupies the right edge; the camera is shifted
// so the group is centered in the free area to its left.
const DESKTOP_DISTANCE = 8.5;
const TARGET_Y = 1.0;

/**
 * Picks a camera framing that keeps the three characters in view. On portrait
 * and narrow layouts the camera backs up until the whole group fits the
 * horizontal field of view; on desktop it is offset to clear the side panel.
 */
function computeHome(width, height) {
  const aspect = width / Math.max(height, 1);
  const halfVerticalFov = THREE.MathUtils.degToRad(FOV) / 2;

  if (aspect >= 1.2) {
    // Offset needed so the group lands in the middle of the area left of the
    // panel, whatever the viewport height.
    const freeCenterOffset = (PANEL_WIDTH + PANEL_MARGIN) / 2;
    const worldHeight = 2 * DESKTOP_DISTANCE * Math.tan(halfVerticalFov);
    const x = (freeCenterOffset * worldHeight) / Math.max(height, 1);
    return {
      position: new THREE.Vector3(x, 3.05, DESKTOP_DISTANCE),
      target: new THREE.Vector3(x, TARGET_Y, 0),
    };
  }

  const horizontalFov =
    2 * Math.atan(Math.tan(halfVerticalFov) * Math.max(aspect, 0.2));
  const halfGroupWidth = 3.85;
  const distance = THREE.MathUtils.clamp(
    halfGroupWidth / Math.tan(horizontalFov / 2),
    8.5,
    24,
  );
  const pitch = THREE.MathUtils.degToRad(14);

  return {
    position: new THREE.Vector3(
      0,
      TARGET_Y + distance * Math.sin(pitch),
      distance * Math.cos(pitch),
    ),
    target: new THREE.Vector3(0, TARGET_Y, 0),
  };
}
const FOG_COLOR = 0xbdd3b2;

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Sets up renderer, camera, lights, sky, fog and orbit controls.
 */
export function createStage(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 24, 72);

  const camera = new THREE.PerspectiveCamera(
    FOV,
    container.clientWidth / container.clientHeight,
    0.1,
    400,
  );
  let home = computeHome(container.clientWidth, container.clientHeight);
  camera.position.copy(home.position);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.className = 'labels-layer';
  labelRenderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 26;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = 1.52;
  controls.update();

  // Sky dome with a soft vertical gradient. It is unaffected by fog and
  // tone mapping, which keeps the horizon clean.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(260, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x5489b5) },
        horizonColor: { value: new THREE.Color(0xd7e5c8) },
        bottomColor: { value: new THREE.Color(0x9fb58e) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPosition;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 color = mix(horizonColor, topColor, smoothstep(0.0, 0.55, h));
          color = mix(bottomColor, color, smoothstep(-0.35, 0.0, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  sky.name = 'sky';
  sky.frustumCulled = false;
  scene.add(sky);

  // Image based lighting gives the armored character believable reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();

  const hemisphere = new THREE.HemisphereLight(0xa9d3ea, 0x2c3d23, 1.55);
  scene.add(hemisphere);

  const ambient = new THREE.AmbientLight(0x7f9a76, 0.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.9);
  sun.position.set(9, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 48;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0x9cc4d8, 0.6);
  fill.position.set(-8, 6, -7);
  scene.add(fill);

  let userMoved = false;
  controls.addEventListener('start', () => {
    userMoved = true;
  });

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);

    const nextHome = computeHome(width, height);
    const changed = nextHome.position.distanceTo(home.position) > 0.75;
    home = nextHome;
    // Reframe only when the layout really changed (e.g. the mobile sheet was
    // collapsed) and the visitor has not set a custom view.
    if (changed && !userMoved) resetCamera();
  };

  window.addEventListener('resize', resize);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let cameraTween = null;

  function resetCamera() {
    userMoved = false;
    controls.enabled = false;
    cameraTween = {
      fromPosition: camera.position.clone(),
      toPosition: home.position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: home.target.clone(),
      time: 0,
      duration: 0.85,
    };
  }

  function update(dt) {
    if (cameraTween) {
      cameraTween.time = Math.min(
        cameraTween.duration,
        cameraTween.time + dt,
      );
      const t = easeInOutCubic(cameraTween.time / cameraTween.duration);
      camera.position.lerpVectors(
        cameraTween.fromPosition,
        cameraTween.toPosition,
        t,
      );
      controls.target.lerpVectors(
        cameraTween.fromTarget,
        cameraTween.toTarget,
        t,
      );

      if (cameraTween.time >= cameraTween.duration) {
        cameraTween = null;
        controls.enabled = true;
      }
    }

    controls.update();
    sky.position.copy(camera.position);
  }

  function render() {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  return {
    scene,
    camera,
    renderer,
    labelRenderer,
    controls,
    sun,
    update,
    render,
    resize,
    resetCamera,
  };
}
