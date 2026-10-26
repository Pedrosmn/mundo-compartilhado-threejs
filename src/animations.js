import * as THREE from 'three';

const FADE_TIME = 0.3;

/**
 * French names (or prefixes) used by the different exporters are normalized
 * to a stable id. The original clip name is kept for the tooltip.
 */
const LABELS = {
  idle: 'Parado',
  idle_tired: 'Parado (cansado)',
  idle_pistol: 'Parado com pistola',
  idle_shield: 'Parado com escudo',
  idle_heavy_weapon: 'Parado com arma pesada',
  idle_two_weapon: 'Parado com duas armas',
  walk: 'Andar',
  walk_in_place: 'Andar (no lugar)',
  walk_back: 'Andar de ré',
  walk_side: 'Andar de lado',
  run: 'Correr',
  run_root: 'Correr',
  run_shield: 'Correr com escudo',
  run_heavy_weapon_in_place: 'Correr com arma pesada (no lugar)',
  walk_shieldblock_root: 'Andar com escudo',
  t_pose: 'T-pose',
  a_pose: 'A-pose',
  jump_in_place: 'Pular (no lugar)',
  shield_block: 'Bloquear com escudo',
  two_weapon_block: 'Bloquear com duas armas',
  gun_idle: 'Parado com arma',
  gun_shot: 'Disparar',
  gun_pointing: 'Mirar',
  gun_firing: 'Disparar',
  gun_reload: 'Recarregar',
  dead: 'Morrer',
  dead2: 'Morrer (2)',
  landing: 'Aterrissar',
  landing_crash: 'Queda na aterrissagem',
  jump_start: 'Início do pulo',
  jump_landing: 'Aterrissagem do pulo',
  jump_ascending: 'Subindo',
  jump_descending: 'Descendo',
  jump_air_loop: 'No ar',
};

const LOOP_EXCLUSIONS =
  /crash|landing|dead|death|hurt|attacked|tornado|attack|shot|firing|reload|pick|climb|jump|turn/;
const LOOP_TOKENS = /(^|_)(idle|walk|run|block|pose|air|falling|hover|loop)(_|$)/;

function normalizeName(raw) {
  const base = raw.includes('|') ? raw.slice(raw.lastIndexOf('|') + 1) : raw;
  return base.replace(/^anim[_-]/i, '').trim();
}

function toId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toLabel(id) {
  if (LABELS[id]) return LABELS[id];
  return id
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function isLooping(id) {
  if (LOOP_EXCLUSIONS.test(id)) return false;
  return LOOP_TOKENS.test(id);
}

/**
 * Finds the skeleton root and all the nodes above it (armature, model root,
 * etc.). Root motion in these files is baked on the hip/root bone, so these
 * are the nodes whose translation must be neutralized.
 */
function collectMotionNodes(root) {
  let rootBone = null;
  root.traverse((object) => {
    if (
      !rootBone &&
      object.isBone &&
      !(object.parent && object.parent.isBone)
    ) {
      rootBone = object;
    }
  });

  if (!rootBone) return [];

  const nodes = [];
  let node = rootBone;
  while (node && node !== root) {
    nodes.push(node);
    node = node.parent;
  }
  return nodes;
}

const _quaternion = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/**
 * Returns which local translation components are horizontal in world space.
 * Local bone axes rarely match world axes, so the parent's world rotation is
 * used to decide which component is vertical and must be preserved.
 */
function horizontalComponents(node) {
  if (!node.parent) return [true, false, true];

  node.parent.getWorldQuaternion(_quaternion);
  const horizontal = [false, false, false];

  for (let axis = 0; axis < 3; axis += 1) {
    _axis.set(0, 0, 0);
    _axis.setComponent(axis, 1);
    _axis.applyQuaternion(_quaternion);
    horizontal[axis] = Math.abs(_axis.y) < 0.6;
  }

  return horizontal;
}

/**
 * Removes horizontal travel from root/hip position tracks while keeping the
 * vertical bounce and every rotation/scale track. This turns clips such as
 * `*_root` or walk cycles with baked displacement into in-place animations.
 */
function removeRootMotion(animations, root, sourceHeight) {
  const nodes = collectMotionNodes(root);
  if (nodes.length === 0) return 0;

  const nodesByName = new Map();
  for (const node of nodes) {
    if (node.name) nodesByName.set(node.name, node);
  }

  const threshold = Math.max(0.18, sourceHeight * 0.12);
  let modifications = 0;

  for (const clip of animations) {
    const discarded = new Set();

    for (const track of clip.tracks) {
      if (!track.name.endsWith('.position')) continue;

      const nodeName = track.name.slice(0, -'.position'.length);
      const node = nodesByName.get(nodeName);
      if (!node) continue;

      // Some exporters (notably the Male Adventurer file) bake zeroed
      // translation tracks on the armature node, which would overwrite its
      // bind offset and sink the character into the ground. The armature is
      // only ever a container here, so its position track is discarded.
      if (!node.isBone) {
        discarded.add(track);
        modifications += 1;
        continue;
      }

      const horizontal = horizontalComponents(node);
      const stride = 3;
      const keyCount = track.values.length / stride;
      if (keyCount < 2) continue;

      for (let axis = 0; axis < 3; axis += 1) {
        if (!horizontal[axis]) continue;

        let min = Infinity;
        let max = -Infinity;
        for (let key = 0; key < keyCount; key += 1) {
          const value = track.values[key * stride + axis];
          if (value < min) min = value;
          if (value > max) max = value;
        }

        if (max - min <= threshold) continue;

        const first = track.values[axis];
        for (let key = 0; key < keyCount; key += 1) {
          track.values[key * stride + axis] = first;
        }
        modifications += 1;
      }
    }

    if (discarded.size > 0) {
      clip.tracks = clip.tracks.filter((track) => !discarded.has(track));
    }
  }

  return modifications;
}

function uniqueId(base, used) {
  let id = base || 'animation';
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function pickPreset(clips, kind) {
  const ids = new Set(clips.map((clip) => clip.id));
  const preferences = {
    idle: ['idle'],
    walk: ['walk', 'walk_in_place'],
    run: ['run', 'run_in_place', 'run_heavy_weapon_in_place', 'run_root'],
  }[kind];

  for (const id of preferences) {
    if (ids.has(id)) return id;
  }

  const candidates = clips.filter((clip) => clip.id.split('_').includes(kind));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aInPlace = Number(a.id.includes('in_place'));
    const bInPlace = Number(b.id.includes('in_place'));
    return bInPlace - aInPlace || a.id.length - b.id.length;
  });

  return candidates[0].id;
}

/**
 * Owns the AnimationMixer of one character and exposes a small playback API.
 */
export class AnimationController {
  constructor(animations, root, { sourceHeight = 1.75 } = {}) {
    this.mixer = new THREE.AnimationMixer(root);
    this.entries = new Map();
    this.clips = [];
    this.current = null;
    this.currentId = null;
    this.paused = false;
    this._fading = new Map();

    const modifications = removeRootMotion(animations, root, sourceHeight);
    if (modifications > 0 && import.meta.env.DEV) {
      console.info(
        `[anim] ${modifications} componente(s) de root motion neutralizados em ${animations.length} clipes`,
      );
    }

    const used = new Set();
    for (const animation of animations) {
      const normalized = normalizeName(animation.name);
      const id = uniqueId(toId(normalized), used);
      const entry = {
        id,
        label: toLabel(id),
        originalName: animation.name,
        duration: animation.duration,
        loop: isLooping(id),
      };

      const action = this.mixer.clipAction(animation);
      action.setLoop(
        entry.loop ? THREE.LoopRepeat : THREE.LoopOnce,
        entry.loop ? Infinity : 1,
      );
      action.clampWhenFinished = !entry.loop;

      entry.action = action;
      this.entries.set(id, entry);
      this.clips.push({
        id: entry.id,
        label: entry.label,
        originalName: entry.originalName,
        duration: entry.duration,
        loop: entry.loop,
      });
    }

    this.presets = {
      idle: pickPreset(this.clips, 'idle'),
      walk: pickPreset(this.clips, 'walk'),
      run: pickPreset(this.clips, 'run'),
    };
  }

  play(id, { fade = FADE_TIME, restart = false } = {}) {
    const entry = this.entries.get(id);
    if (!entry) return false;

    if (entry === this.current) {
      if (entry.loop && !restart) return true;
      entry.action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      return true;
    }

    const previous = this.current?.action;
    this._fading.delete(entry.action);
    entry.action
      .reset()
      .setEffectiveWeight(1)
      .setEffectiveTimeScale(1)
      .play();

    if (previous && fade > 0) {
      entry.action.fadeIn(fade);
      previous.fadeOut(fade);
      this._fading.set(previous, fade);
    } else if (previous) {
      previous.stop();
    }

    this.current = entry;
    this.currentId = id;
    return true;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  update(dt) {
    if (this.paused) return;

    this.mixer.update(dt);

    if (this._fading.size > 0) {
      for (const [action, remaining] of this._fading) {
        const left = remaining - dt;
        if (left <= 0) {
          action.stop();
          this._fading.delete(action);
        } else {
          this._fading.set(action, left);
        }
      }
    }
  }
}
