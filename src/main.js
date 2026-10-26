import * as THREE from 'three';
import { MEMBERS } from './config.js';
import { createStage } from './scene.js';
import { createForest } from './forest.js';
import { createModelLoader } from './loader.js';
import { createCharacter } from './characters.js';
import { createUI } from './ui.js';

const container = document.getElementById('canvas-container');
const stage = createStage(container);
const forest = createForest(stage.scene);

const characters = new Map();
let selectedId = MEMBERS[0].id;
let paused = false;

const ui = createUI({
  members: MEMBERS,
  onSelect: (id) => selectCharacter(id),
  onAnimationChange: (memberId, clipId) => playAnimation(memberId, clipId),
  onTogglePlay: (value) => setPaused(value),
  onResetCamera: () => stage.resetCamera(),
});

ui.setSelected(selectedId, { scroll: false });
ui.setSummary({});

function selectCharacter(id) {
  selectedId = id;
  for (const character of characters.values()) {
    character.setSelected(character.member.id === id);
  }
  ui.setSelected(id);
}

function playAnimation(memberId, clipId) {
  const character = characters.get(memberId);
  if (!character?.controller) return;
  if (!character.play(clipId)) return;
  ui.setClip(memberId, clipId);
}

function setPaused(value) {
  paused = value;
  for (const character of characters.values()) {
    character.controller?.setPaused(paused);
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const loader = createModelLoader();
const progress = new Map(MEMBERS.map((member) => [member.id, 0]));
let readyCount = 0;
let totalClips = 0;

function updateLoading(status = 'Carregando modelos…') {
  const sum = MEMBERS.reduce(
    (total, member) => total + (progress.get(member.id) ?? 0),
    0,
  );
  ui.setLoading(sum / MEMBERS.length, status);
}

updateLoading('Carregando modelos…');

const jobs = MEMBERS.map((member) => {
  ui.setMemberState(member.id, 'loading');

  return loader
    .load(member, (fraction) => {
      progress.set(
        member.id,
        Math.max(progress.get(member.id) ?? 0, Math.min(1, fraction)),
      );
      updateLoading();
    })
    .then((gltf) => {
      progress.set(member.id, 1);
      readyCount += 1;

      const character = createCharacter(member, gltf);
      stage.scene.add(character.group);
      characters.set(member.id, character);
      totalClips += character.clips.length;

      ui.setClips(member.id, character.clips, character.presets);
      ui.setMemberState(member.id, 'ready');
      ui.setSummary({ totalClips, ready: readyCount });

      const initialClip = character.presets.idle ?? character.clips[0]?.id;
      if (initialClip) {
        character.play(initialClip);
        ui.setClip(member.id, initialClip);
      }

      if (member.id === selectedId) character.setSelected(true);

      updateLoading(`${readyCount} de ${MEMBERS.length} modelos prontos`);
    })
    .catch((error) => {
      console.error(error);
      progress.set(member.id, 1);
      readyCount += 1;

      const character = createCharacter(member, null);
      stage.scene.add(character.group);
      characters.set(member.id, character);

      ui.setClips(member.id, [], {});
      ui.setMemberState(
        member.id,
        'error',
        'Modelo ausente ou falha de rede. Um placeholder foi posicionado na cena.',
      );
      ui.setSummary({ totalClips, ready: readyCount });

      if (member.id === selectedId) character.setSelected(true);

      updateLoading(`${readyCount} de ${MEMBERS.length} modelos processados`);
    });
});

Promise.allSettled(jobs).then(() => {
  loader.dispose();
  ui.setLoading(1, 'Floresta pronta');
  selectCharacter(selectedId);
  setTimeout(() => ui.hideLoading(), 450);
});

// ---------------------------------------------------------------------------
// Selection via raycasting
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
const canvas = stage.renderer.domElement;

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  pointerDown = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerDown) return;

  const distance = Math.hypot(
    event.clientX - pointerDown.x,
    event.clientY - pointerDown.y,
  );
  pointerDown = null;

  if (distance > 6) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, stage.camera);

  const groups = [...characters.values()].map((character) => character.group);
  const hits = raycaster.intersectObjects(groups, true);

  for (const hit of hits) {
    let object = hit.object;
    while (object && !object.userData.memberId) object = object.parent;
    if (object?.userData.memberId) {
      selectCharacter(object.userData.memberId);
      break;
    }
  }
});

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

const clock = new THREE.Timer();
clock.connect(document);
let elapsed = 0;

stage.renderer.setAnimationLoop(() => {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  stage.update(dt);
  forest.update(dt, elapsed);

  for (const character of characters.values()) {
    character.update(dt, elapsed);
  }

  stage.render();
});

// Keep the pause state in sync when the UI toggles before the first model.
setPaused(false);

if (import.meta.env.DEV) {
  window.__mundo = { THREE, stage, forest, characters, MEMBERS };
}
