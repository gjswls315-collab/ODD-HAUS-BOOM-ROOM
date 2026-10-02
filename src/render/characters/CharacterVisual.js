import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTER_VISUALS } from '../../config/characterVisualConfig.js';
import { buildPlaceholder } from './placeholders.js';
import { group, mesh, torus } from '../kit.js';
import { mergeChildrenDeep } from '../propFactory.js';

// ─────────────────────────────────────────────────────────────
// CharacterVisual — PlayerRoot 의 VisualModel 레이어.
// 캐릭터별 GLB 를 먼저 시도하고, 없으면 3D Placeholder 사용.
// 게임 판정은 PlayerController(공통)가 하고, 여기서는 애니메이션 personality 만 다르다.
// ─────────────────────────────────────────────────────────────

const glbCache = new Map(); // id → gltf | null
const loader = new GLTFLoader();

async function glbExists(url) {
  if (typeof location !== 'undefined' && location.protocol === 'file:') return false; // 단일 HTML 을 파일로 열면 GLB 확인 생략
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (!r.ok) return false;
    const type = r.headers.get('content-type') || '';
    return !type.includes('text/html');
  } catch {
    return false;
  }
}

// 앱 시작 시 한 번: 존재하는 GLB 만 로드
export async function preloadCharacterModels(ids) {
  await Promise.all(
    ids.map(async (id) => {
      if (glbCache.has(id)) return;
      const cfg = CHARACTER_VISUALS[id];
      if (!cfg || !(await glbExists(cfg.glb))) {
        glbCache.set(id, null);
        return;
      }
      try {
        const gltf = await loader.loadAsync(cfg.glb);
        glbCache.set(id, gltf);
      } catch (e) {
        console.warn(`[BOOM ROOM] GLB load failed for ${id}, using 3D placeholder`, e);
        glbCache.set(id, null);
      }
    }),
  );
  return Object.fromEntries(ids.map((id) => [id, !!glbCache.get(id)]));
}

export function hasGlb(id) {
  return !!glbCache.get(id);
}

function findClip(clips, names) {
  return clips.find((c) => names.some((n) => c.name.toLowerCase().includes(n))) || null;
}

function buildFromGlb(id, gltf) {
  const cfg = CHARACTER_VISUALS[id];
  const model = skeletonClone(gltf.scene);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // 높이 맞추기 + 발 원점
  const bb = new THREE.Box3().setFromObject(model);
  const size = bb.getSize(new THREE.Vector3());
  const s = cfg.height / Math.max(0.001, size.y);
  model.scale.setScalar(s);
  const bb2 = new THREE.Box3().setFromObject(model);
  const c = bb2.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -bb2.min.y, -c.z);
  const root = group();
  const body = group([model]);
  root.add(body);
  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations || [];
  const actions = {
    idle: findClip(clips, ['idle']),
    move: findClip(clips, ['walk', 'run']),
    place: findClip(clips, ['place', 'bomb', 'throw']),
    trapped: findClip(clips, ['trap', 'stun', 'hurt']),
    victory: findClip(clips, ['victory', 'win', 'dance', 'cheer']),
  };
  for (const k of Object.keys(actions)) if (actions[k]) actions[k] = mixer.clipAction(actions[k]);
  return { root, body, mixer, actions, glb: true };
}

export class CharacterVisual {
  constructor(characterId) {
    this.id = characterId;
    this.cfg = CHARACTER_VISUALS[characterId];
    const gltf = glbCache.get(characterId);
    this.rig = gltf ? buildFromGlb(characterId, gltf) : buildPlaceholder(characterId);
    if (!gltf) mergeChildrenDeep(this.rig.root);
    this.object = this.rig.root;
    this.t = 0;
    this.phase = 0;
    this.prevState = null;
    this.stateTime = 0;
    this.currentAction = null;
    this.base = {
      bodyY: this.rig.body.position.y,
    };
    this._buildPulse();
  }

  // 공통 "music pulse ring" — Beat Bomb 설치 시 몸 / 손 주위로 퍼지는 음파 링 (모든 캐릭터 동일)
  _buildPulse() {
    const make = (r, t) => mesh(torus(r, t, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), { cast: false });
    this.pulseRing = make(0.36, 0.018);
    this.pulseRing.rotation.x = Math.PI / 2;
    this.pulseRing.position.y = 0.42;
    this.pulseRing2 = make(0.36, 0.01);
    this.pulseRing2.rotation.x = Math.PI / 2;
    this.pulseRing2.position.y = 0.2;
    this.rig.root.add(this.pulseRing, this.pulseRing2);
    this.handRings = [];
    for (const a of [this.rig.armL, this.rig.armR]) {
      const hand = a ? a.children.filter((c) => !c.isMesh).pop() || a.children[a.children.length - 1] : null;
      if (!hand) continue;
      const hr = make(0.08, 0.012);
      hand.add(hr);
      this.handRings.push(hr);
    }
    this.pulseT = 9;
  }

  _updatePulse(dt) {
    this.pulseT += dt;
    const k = Math.min(1, this.pulseT / 0.55);
    const on = this.pulseT < 0.55;
    const a = on ? (1 - k) * 0.95 : 0;
    this.pulseRing.visible = on;
    this.pulseRing2.visible = on;
    if (!on) {
      for (const h of this.handRings) h.visible = false;
      return;
    }
    this.pulseRing.scale.setScalar(0.6 + k * 1.3);
    this.pulseRing.material.opacity = a;
    this.pulseRing.material.color.set(k < 0.5 ? '#ffb347' : '#6fc8ff');
    const k2 = Math.max(0, Math.min(1, (this.pulseT - 0.12) / 0.43));
    this.pulseRing2.scale.setScalar(0.5 + k2 * 1.6);
    this.pulseRing2.material.opacity = (1 - k2) * 0.7;
    this.pulseRing2.material.color.set('#9a7bff');
    for (const h of this.handRings) {
      h.visible = true;
      h.scale.setScalar(1 + Math.sin(k * Math.PI * 3) * 0.6 + k);
      h.material.opacity = a;
      h.rotation.y += dt * 8;
    }
  }

  _play(name) {
    const a = this.rig.actions?.[name] || this.rig.actions?.idle;
    if (!a || a === this.currentAction) return;
    a.reset().fadeIn(0.15).play();
    if (this.currentAction) this.currentAction.fadeOut(0.15);
    this.currentAction = a;
  }

  // state: PLAYER_STATE, speed: 이동속도(칸/초)
  update(dt, state, stateTime, { speed = 3, moving = false } = {}) {
    this.t += dt;
    const r = this.rig;
    const W = this.cfg.walk;
    const body = r.body;

    if (state !== this.prevState) {
      if (state === 'PLACE_BOMB') this.pulseT = 0;
      this.prevState = state;
    }
    this._updatePulse(dt);

    if (r.glb) {
      r.mixer.update(dt);
      const map = { MOVE: 'move', DASH: 'move', PLACE_BOMB: 'place', USE_ITEM: 'place', TRAPPED: 'trapped', VICTORY: 'victory' };
      this._play(map[state] || 'idle');
    }

    // 리셋 (매 프레임 절차적 포즈)
    body.position.set(0, this.base.bodyY, 0);
    body.rotation.set(0, 0, 0);
    body.scale.set(1, 1, 1);
    if (r.legL) {
      r.legL.rotation.set(0, 0, 0);
      r.legR.rotation.set(0, 0, 0);
    }
    if (r.armL) {
      r.armL.rotation.set(0, 0, -0.35);
      r.armR.rotation.set(0, 0, 0.35);
      if (r.quadruped) {
        r.armL.rotation.set(0, 0, 0);
        r.armR.rotation.set(0, 0, 0);
      }
    }
    if (r.head) r.head.rotation.set(0, 0, 0);
    if (r.hat) r.hat.position.y = 0.2;
    if (r.crown) r.crown.rotation.set(0, 0, 0);
    if (r.tail) r.tail.rotation.set(0, Math.sin(this.t * 6) * 0.3, 0);
    if (r.cape) r.cape.rotation.set(0, 0, 0);
    if (r.spinPart) r.spinPart.rotation.set(Math.PI / 2, 0, 0);

    const legSwing = (amp, ph) => {
      if (!r.legL) return;
      r.legL.rotation.x = Math.sin(ph) * amp;
      r.legR.rotation.x = -Math.sin(ph) * amp;
      if (r.quadruped) {
        r.armL.rotation.x = -Math.sin(ph) * amp;
        r.armR.rotation.x = Math.sin(ph) * amp;
      } else if (r.armL) {
        r.armL.rotation.x = -Math.sin(ph) * amp * 0.8;
        r.armR.rotation.x = Math.sin(ph) * amp * 0.8;
      }
    };

    switch (state) {
      case 'MOVE':
      case 'DASH': {
        const dash = state === 'DASH';
        this.phase += dt * W.freq * (0.55 + speed * 0.12) * (dash ? 1.6 : 1);
        legSwing(dash ? 0.3 : 0.7, this.phase);
        body.position.y += Math.abs(Math.sin(this.phase)) * W.bob;
        body.rotation.x = dash ? 0.35 : W.lean;
        body.rotation.z = Math.sin(this.phase) * W.sway * 0.5;
        if (dash) body.scale.set(0.9, 0.92, 1.18);
        if (r.cape) r.cape.rotation.x = -0.35 - Math.abs(Math.sin(this.phase)) * 0.15;
        break;
      }
      case 'PLACE_BOMB':
        this._placeAnim(stateTime);
        break;
      case 'USE_ITEM': {
        const k = Math.sin(Math.min(1, stateTime / 0.24) * Math.PI);
        if (r.armL) {
          r.armL.rotation.x = -2.2 * k;
          r.armR.rotation.x = -2.2 * k;
        }
        body.position.y += k * 0.06;
        break;
      }
      case 'TRAPPED': {
        body.position.y += 0.22 + Math.sin(this.t * 2.2) * 0.04;
        body.rotation.z = Math.sin(this.t * 3) * 0.2;
        body.rotation.y = Math.sin(this.t * 1.3) * 0.6;
        if (r.armL) {
          r.armL.rotation.z = -1.6 + Math.sin(this.t * 9) * 0.4;
          r.armR.rotation.z = 1.6 - Math.sin(this.t * 9 + 1) * 0.4;
        }
        if (r.legL) {
          r.legL.rotation.x = Math.sin(this.t * 8) * 0.5;
          r.legR.rotation.x = -Math.sin(this.t * 8) * 0.5;
        }
        break;
      }
      case 'RESCUED': {
        const k = Math.min(1, stateTime / 0.6);
        body.position.y += Math.sin(k * Math.PI) * 0.35;
        body.rotation.y = k * Math.PI * 2;
        break;
      }
      case 'VICTORY':
        this._victoryAnim(stateTime);
        break;
      default: {
        // IDLE — 캐릭터 성격은 자세/리듬으로 (Picker 앞으로 기울기 · Rex 낮고 느림 · Buddy 통통)
        const I = this.cfg.idle || { lean: 0, bob: 0.01, freq: 2.4, sway: W.sway };
        const ph = this.t * I.freq;
        const sq = I.squash ?? 1;
        body.rotation.x = I.lean;
        body.position.y += I.bounce ? Math.abs(Math.sin(ph)) * I.bob : (Math.sin(ph) * 0.5 + 0.5) * I.bob;
        body.scale.set(1 + (1 - sq) * 0.6, sq * (1 + Math.sin(ph) * 0.025), 1 + (1 - sq) * 0.6);
        body.rotation.z = Math.sin(this.t * 1.2) * I.sway * 0.25;
        if (r.armL && !r.quadruped) {
          r.armL.rotation.z = -0.35 - Math.sin(ph) * 0.05;
          r.armR.rotation.z = 0.35 + Math.sin(ph) * 0.05;
        }
        if (r.head && I.look) r.head.rotation.y = Math.sin(this.t * 0.7) * 0.35;
        if (r.cape) r.cape.rotation.x = -0.08 - Math.sin(this.t * 1.6) * 0.06;
      }
    }
    // Rex 처럼 무게중심이 낮은 캐릭터는 걸을 때도 낮게
    if ((state === 'MOVE' || state === 'DASH') && this.cfg.idle?.squash) body.scale.y *= this.cfg.idle.squash;
  }

  // Beat Bomb 설치 — 판정은 동일, 모션만 캐릭터별
  _placeAnim(st) {
    const r = this.rig;
    const body = r.body;
    const dur = 0.26;
    const k = Math.min(1, st / dur);
    const s = Math.sin(k * Math.PI);
    switch (this.cfg.placeStyle) {
      case 'calm': // 차분하게 LP 장치를 내려놓음
        body.rotation.x = 0.45 * s;
        if (r.armL) {
          r.armL.rotation.x = -1.0 * s;
          r.armR.rotation.x = -1.0 * s;
        }
        break;
      case 'flick': // 빠르게 툭 던지듯
        body.rotation.y = -0.9 * s;
        if (r.armR) r.armR.rotation.x = -2.4 * s;
        body.position.y += 0.05 * s;
        break;
      case 'heavy': // 묵직하게
        body.scale.set(1 + 0.12 * s, 1 - 0.16 * s, 1 + 0.12 * s);
        if (r.armL) {
          r.armL.rotation.x = -0.8 * s;
          r.armR.rotation.x = -0.8 * s;
        }
        break;
      case 'cautious': // 주변을 확인하며
        if (r.head) r.head.rotation.y = Math.sin(k * Math.PI * 2) * 0.6;
        body.rotation.x = 0.35 * Math.max(0, Math.sin((k - 0.3) * Math.PI));
        if (r.armR) r.armR.rotation.x = -1.2 * s;
        break;
      case 'royal': // 무겁게 내려놓음
        body.scale.set(1 + 0.18 * s, 1 - 0.22 * s, 1 + 0.18 * s);
        if (r.crown) r.crown.rotation.z = Math.sin(k * Math.PI * 3) * 0.2;
        if (r.armR) r.armR.rotation.x = -1.5 * s;
        break;
      case 'paw': // 앞발로 툭
        body.position.z += 0.08 * s;
        body.rotation.x = 0.2 * s;
        if (r.armR) r.armR.rotation.x = -1.4 * s;
        break;
      case 'kick': // 장난스럽게 차듯
        if (r.legR) r.legR.rotation.x = -1.3 * s;
        body.rotation.x = -0.15 * s;
        if (r.armL) r.armL.rotation.z = -1.0 * s - 0.35;
        break;
      default:
        body.rotation.x = 0.3 * s;
    }
  }

  _victoryAnim(st) {
    const r = this.rig;
    const body = r.body;
    const t = st;
    switch (this.cfg.victory) {
      case 'spin': // VIN: 레코드처럼 회전
        body.rotation.y = t * 9;
        body.position.y += Math.abs(Math.sin(t * 4)) * 0.12;
        if (r.armL) {
          r.armL.rotation.z = -2.4;
          r.armR.rotation.z = 2.4;
        }
        break;
      case 'jump':
        body.position.y += Math.abs(Math.sin(t * 6)) * 0.35;
        if (r.armL) {
          r.armL.rotation.z = -2.6;
          r.armR.rotation.z = 2.6;
        }
        break;
      case 'flex':
        if (r.armL) {
          r.armL.rotation.z = -2.2 + Math.sin(t * 8) * 0.4;
          r.armR.rotation.z = 2.2 - Math.sin(t * 8) * 0.4;
        }
        body.scale.y = 1 + Math.abs(Math.sin(t * 8)) * 0.06;
        break;
      case 'tipHat':
        body.rotation.x = Math.max(0, Math.sin(t * 2.5)) * 0.5;
        if (r.armR) r.armR.rotation.z = 2.8;
        if (r.hat) r.hat.position.y = 0.2 + Math.max(0, Math.sin(t * 2.5)) * 0.12;
        break;
      case 'royal':
        if (r.armR) r.armR.rotation.z = 2.7;
        if (r.cape) r.cape.rotation.x = -0.3 - Math.sin(t * 5) * 0.15;
        body.position.y += Math.abs(Math.sin(t * 3)) * 0.08;
        break;
      case 'wag':
        if (r.tail) r.tail.rotation.y = Math.sin(t * 20) * 0.7;
        body.position.y += Math.abs(Math.sin(t * 7)) * 0.18;
        break;
      case 'guitar':
        if (r.armR) r.armR.rotation.x = -0.6 + Math.sin(t * 16) * 0.5;
        if (r.armL) r.armL.rotation.z = -1.2;
        body.rotation.z = Math.sin(t * 4) * 0.15;
        body.position.y += Math.abs(Math.sin(t * 8)) * 0.06;
        break;
      default:
        body.position.y += Math.abs(Math.sin(t * 5)) * 0.2;
    }
  }

  dispose() {
    this.object.removeFromParent();
  }
}
