import * as THREE from 'three';
import { ITEM_TYPES } from '../config/itemConfig.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { CharacterVisual } from './characters/CharacterVisual.js';
import { buildMrOdd } from './characters/placeholders.js';
import { rbox, cyl, sphere, torus, plane, circle, ring, mat, basic, mesh, group, damp, easeOutBack, clamp01 } from './kit.js';
import { grooveTexture, noteTexture, glowTexture, ringTexture, eqTexture, itemIconTexture, labelTexture, arrowTexture, hazardTexture, waveformTexture, glyphTexture, grooveRingTexture } from './textures.js';

const DIR_ANGLE = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
// 납작한 캐릭터(LP·피크·열쇠)는 옆면만 보이지 않도록 좌우 회전을 줄여 얼굴이 카메라 쪽으로 보이게
const SIDE_YAW = { vin: 0.85, picker: 0.95, locke: 1.05 };

// ── 경기 시작 위치 화살표 (match start player position indicator) ─────────
//   머리 위에 떠서 통통 튀는 굵고 둥근 아래 화살표. 검은 외곽선 + 하이라이트 + 은은한 빛 + 바닥 그림자.
//   카운트다운 동안 + 시작 직후 잠깐만 보이고 사라진다 (상시 UI 아님).
let arrowGeo = null;
let arrowOutlineGeo = null;
function startArrowShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.15, 0.55);
  s.quadraticCurveTo(-0.15, 0.68, -0.04, 0.68);
  s.lineTo(0.04, 0.68);
  s.quadraticCurveTo(0.15, 0.68, 0.15, 0.55);
  s.lineTo(0.15, 0.25);
  s.lineTo(0.29, 0.25);
  s.quadraticCurveTo(0.41, 0.25, 0.33, 0.14);
  s.lineTo(0.07, -0.17);
  s.quadraticCurveTo(0, -0.25, -0.07, -0.17);
  s.lineTo(-0.33, 0.14);
  s.quadraticCurveTo(-0.41, 0.25, -0.29, 0.25);
  s.lineTo(-0.15, 0.25);
  s.closePath();
  return s;
}

function buildStartArrow(color) {
  if (!arrowGeo) {
    const shape = startArrowShape();
    arrowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 4, curveSegments: 10 });
    arrowGeo.translate(0, 0, -0.05);
    arrowOutlineGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.12, bevelSegments: 3, curveSegments: 10 });
    arrowOutlineGeo.translate(0, 0, -0.12);
  }
  const c = new THREE.Color(color);
  const light = c.r + c.g + c.b > 2.4; // 흰색 화살표는 외곽선을 진하게
  const mats = [];
  const track = (m) => {
    m.transparent = true;
    mats.push({ m, base: m.opacity });
    return m;
  };
  const g = group([], { name: 'StartArrow' });
  const holder = group([], { p: [0, 1.95, 0] });
  const tilt = group([], { r: [-0.87, 0, 0], s: 1.2 }); // 카메라(50° 하향) 쪽을 향하도록
  // 조명 / 톤매핑 영향 없이 선명한 색 (앞면 = 플레이어 색, 옆면 = 조금 어둡게 → 통통한 입체감)
  const face = track(new THREE.MeshBasicMaterial({ color: c, opacity: 1, toneMapped: false }));
  const side = track(new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(light ? 0.62 : 0.58), opacity: 1, toneMapped: false }));
  tilt.add(mesh(arrowOutlineGeo, track(new THREE.MeshBasicMaterial({ color: '#0d0b10', opacity: 1, toneMapped: false })), { cast: false }));
  tilt.add(mesh(arrowGeo, [face, side], { cast: false }));
  // 아래쪽 그림자 띠 (앞면 아래 절반을 살짝 어둡게)
  tilt.add(mesh(rbox(0.5, 0.12, 0.01, 0.04), track(basic(c.clone().multiplyScalar(0.7), { opacity: 0.55, toneMapped: false })), { p: [0, 0.02, 0.106], cast: false }));
  // 반짝이는 하이라이트 (통통한 젤리 느낌)
  tilt.add(mesh(rbox(0.07, 0.3, 0.02, 0.03), track(basic('#ffffff', { opacity: 0.85, toneMapped: false })), { p: [-0.07, 0.47, 0.11], cast: false }));
  tilt.add(mesh(sphere(0.035, 10, 8), track(basic('#ffffff', { opacity: 0.9, toneMapped: false })), { p: [0.06, 0.6, 0.11], cast: false }));
  // 양옆 반짝 선
  for (const sx of [-1, 1]) {
    tilt.add(mesh(rbox(0.05, 0.16, 0.02, 0.02), track(basic(light ? '#2a2a30' : color, { opacity: 0.9, toneMapped: false })), { p: [sx * 0.46, 0.5, 0], r: [0, 0, -sx * 0.6], cast: false, name: 'spark' }));
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(1.5, 1.5, 1);
  glow.position.set(0, 0.25, -0.1);
  mats.push({ m: glow.material, base: 0.55 });
  tilt.add(glow);
  holder.add(tilt);
  g.add(holder);
  // 바닥 그림자 (화살표가 높이 뜰수록 작고 옅게)
  const shadow = mesh(circle(0.34, 24), track(basic('#000000', { opacity: 0.32 })), { r: [-Math.PI / 2, 0, 0], p: [0, 0.02, 0], cast: false });
  g.add(shadow);
  g.renderOrder = 8;
  return { group: g, holder, tilt, shadow, mats, sparks: tilt.children.filter((o) => o.name === 'spark') };
}

// ─────────────────────────────────────────────────────────────
// PlayerView — PlayerRoot
// ├── VisualModel (CharacterVisual: GLB 또는 3D Placeholder)
// ├── Collision      → 논리 그리드(공통)라서 메쉬 없음
// ├── BombOrigin     → 발밑
// ├── ItemOrigin     → 머리 위
// └── PlayerIndicator (바닥 링 + 1P 라벨)
// ─────────────────────────────────────────────────────────────
export class PlayerView {
  constructor(parent, player, toWorld) {
    this.toWorld = toWorld;
    this.playerId = player.id;
    this.root = group([], { name: `PlayerRoot-${player.id}` });
    this.visual = new CharacterVisual(player.characterId);
    this.visualHolder = group([this.visual.object], { name: 'VisualModel' });
    this.visualScale = 1.22; // 가독성을 위한 비주얼 스케일 (판정과 무관)
    this.root.add(this.visualHolder);
    this.bombOrigin = group([], { name: 'BombOrigin' });
    this.itemOrigin = group([], { name: 'ItemOrigin', p: [0, 1.25, 0] });
    this.root.add(this.bombOrigin, this.itemOrigin);

    const color = new THREE.Color(player.color);
    // PlayerIndicator
    this.indicator = group([], { name: 'PlayerIndicator' });
    this.ringMesh = mesh(ring(0.34, 0.42, 40), basic(color, { opacity: 0.9, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.015, 0], cast: false });
    this.dashArc = mesh(ring(0.43, 0.47, 40), basic('#ffffff', { opacity: 0.5, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.016, 0], cast: false });
    this.arrow = mesh(new THREE.CircleGeometry(0.09, 3), basic(color, { opacity: 0.95, toneMapped: false }), { r: [-Math.PI / 2, 0, -Math.PI / 2], p: [0, 0.017, 0.52], cast: false });
    this.arrowPivot = group([this.arrow]);
    this.indicator.add(this.ringMesh, this.dashArc, this.arrowPivot);
    this.root.add(this.indicator);
    const label = player.isBot ? `CPU` : `${player.slot + 1}P`;
    this.label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture(label, { color: player.color, font: 'bold 80px "Arial Black", sans-serif', w: 256, h: 128, glow: 'rgba(0,0,0,1)' }), depthTest: false, transparent: true, toneMapped: false }),
    );
    this.label.scale.set(0.62, 0.31, 1);
    this.label.position.set(0, 1.35, 0);
    this.label.renderOrder = 9;
    this.root.add(this.label);

    // 경기 시작 위치 화살표
    this.startArrow = buildStartArrow(player.color);
    this.root.add(this.startArrow.group);

    // Sound Capsule (Vinyl Bubble)
    this.capsule = group([], { name: 'SoundCapsule' });
    const bubbleMat = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color('#b46bff'), 0.5), transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.3, emissive: '#6a3aff', emissiveIntensity: 0.35, depthWrite: false });
    this.capsule.add(mesh(sphere(0.58, 32, 24), bubbleMat, { p: [0, 0.65, 0], cast: false }));
    for (let i = 0; i < 3; i++) this.capsule.add(mesh(torus(0.5 - i * 0.1, 0.008, 6, 48), basic('#e8dcff', { opacity: 0.55, additive: true }), { p: [0, 0.65, 0], r: [Math.PI / 2 + i * 0.5, i * 0.7, 0], cast: false }));
    this.capsule.add(mesh(sphere(0.12, 12, 10), basic('#ffffff', { opacity: 0.5, additive: true }), { p: [-0.22, 0.95, 0.35], cast: false }));
    this.timerArc = mesh(ring(0.5, 0.58, 48, 0, Math.PI * 2), basic(color, { opacity: 0.9, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.02, 0], cast: false });
    this.capsule.add(this.timerArc);
    this.capsule.visible = false;
    this.root.add(this.capsule);

    // Shield / 무적 버블
    this.shield = mesh(sphere(0.6, 24, 16), basic('#7f9bff', { opacity: 0.18, additive: true }), { p: [0, 0.55, 0], cast: false });
    this.shield.visible = false;
    this.root.add(this.shield);

    this.facingAngle = 0;
    this.lastArcFrac = -1;
    this.popT = -1;
    this.pos = new THREE.Vector3();
    this.initialized = false;
    parent.add(this.root);
  }

  _updateStartArrow(alpha, t, scale = 1) {
    const a = this.startArrow;
    a.group.visible = alpha > 0.001;
    if (!a.group.visible) return;
    const bounce = Math.abs(Math.sin(t * 4.6));
    a.holder.position.y = 1.75 + 0.2 * scale + bounce * 0.24 * scale;
    // 바닥에 닿을 때 살짝 납작
    const squash = 1 - Math.max(0, 0.25 - bounce) * 0.5;
    a.holder.scale.set(1 / squash, squash, 1);
    for (const sp of a.sparks) sp.scale.setScalar(0.6 + bounce * 0.6);
    a.shadow.scale.setScalar(1.05 - bounce * 0.3);
    const pop = easeOutBack(clamp01(this.arrowAge / 0.35));
    a.tilt.scale.setScalar(1.2 * scale * Math.max(0.01, pop));
    for (const { m, base } of a.mats) m.opacity = base * alpha * (m === a.shadow.material ? 1 - bounce * 0.4 : 1);
  }

  update(dt, p, t, { arrowAlpha = 0, arrowScale = 1 } = {}) {
    this.arrowAge = (this.arrowAge || 0) + dt;
    this._updateStartArrow(p.isEliminated ? 0 : arrowAlpha, t, arrowScale);
    const w = this.toWorld(p.x, p.y);
    if (!this.initialized) {
      this.pos.set(w.x, 0, w.z);
      this.initialized = true;
    }
    const dist = Math.hypot(w.x - this.pos.x, w.z - this.pos.z);
    if (dist > 0.6) {
      this.pos.x = damp(this.pos.x, w.x, 14, dt);
      this.pos.z = damp(this.pos.z, w.z, 14, dt);
    } else {
      this.pos.set(w.x, 0, w.z);
    }
    this.root.position.copy(this.pos);

    // 방향
    const target = DIR_ANGLE[p.facing] ?? 0;
    const side = SIDE_YAW[p.characterId] ?? 1.25;
    const yaw = p.facing === 'left' ? -side : p.facing === 'right' ? side : target;
    let diff = yaw - this.facingAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facingAngle += diff * (1 - Math.exp(-18 * dt));
    this.visualHolder.rotation.y = this.facingAngle;
    this.arrowPivot.rotation.y = target;

    const state = p.state;
    if (state === 'ELIMINATED') {
      if (this.popT < 0) this.popT = 0;
      this.popT += dt;
      const k = clamp01(this.popT / 0.7);
      this.visualHolder.position.y = k * 1.6;
      this.visualHolder.rotation.y += dt * 18;
      this.visualHolder.scale.setScalar(Math.max(0.001, (1 - k) * this.visualScale));
      this.capsule.visible = false;
      this.indicator.visible = false;
      this.label.visible = k < 0.3;
      this.shield.visible = false;
      if (k >= 1) this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.indicator.visible = state !== 'VICTORY';
    this.label.visible = true;
    this.visualHolder.position.y = 0;
    this.visualHolder.scale.setScalar(this.visualScale);

    this.visual.update(dt, state, p.stateTime, { speed: p.moveSpeed, moving: p.moving });

    const trapped = state === 'TRAPPED';
    this.capsule.visible = trapped;
    if (trapped && p.trap) {
      const frac = 1 - p.trap.time / p.trap.maxTime;
      this.capsule.children[0].scale.setScalar(1 + Math.sin(t * 6) * 0.03);
      this.capsule.rotation.y += dt * 0.8;
      if (Math.abs(frac - this.lastArcFrac) > 0.01) {
        this.timerArc.geometry = new THREE.RingGeometry(0.5, 0.58, 48, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, frac));
        this.lastArcFrac = frac;
      }
      this.timerArc.material.color.set(frac < 0.3 ? '#ff4040' : this.ringMesh.material.color);
    }
    const dashReady = p.dash.cooldown <= 0;
    this.dashArc.material.opacity = dashReady ? 0.55 : 0.08;
    this.shield.visible = (p.heldItem?.type === 'shield' || p.invulnerable > 0) && !trapped;
    this.shield.material.opacity = p.invulnerable > 0 ? 0.25 + Math.sin(t * 20) * 0.1 : 0.12;
    if (p.modifiers.speedOverrideTime > 0) this.ringMesh.material.opacity = 0.6 + Math.sin(t * 20) * 0.4;
    else this.ringMesh.material.opacity = 0.9;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── Beat Bomb ─────────────────────────────────────────────
// ── Beat Bomb — 작은 검은 LP 퍽 + 가운데 빛나는 음표 ─────────────
//   Beat 1 : 작은 주황 펄스      Beat 2 : 홈을 따라 도는 파란 빛      Beat 3 : 중앙이 밝아짐 → DROP
const AMBER = new THREE.Color('#ffb347');
const BLUE = new THREE.Color('#4fb8ff');
const HOT = new THREE.Color('#fff4d0');
export class BombView {
  constructor(parent, bomb, color) {
    this.root = group();
    this.body = group();
    const groove = mat('#ffffff', { map: grooveTexture('#16161c', 256), rough: 0.28, metal: 0.25 });
    const vinyl = mat('#0e0e13', { rough: 0.35, metal: 0.4 });
    // 납작한 LP 퍽 (윗면 = 레코드 홈)
    this.body.add(mesh(cyl(0.34, 0.36, 0.13, 40), [vinyl, groove, vinyl], { p: [0, 0.075, 0] }));
    this.body.add(mesh(cyl(0.37, 0.37, 0.025, 40), mat('#1d1d24', { rough: 0.5 }), { p: [0, 0.012, 0] }));
    // 가운데 라벨 = 빛나는 음표 + 빛나는 중앙 링 (VIN 의 LP 몸과 구별)
    this.label = mesh(circle(0.125, 28), basic('#ffffff', { map: noteTexture('#ffb347'), toneMapped: false, depthWrite: true }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.143, 0], cast: false });
    this.body.add(this.label);
    this.centerRing = mesh(torus(0.14, 0.014, 8, 36), basic('#ffb347', { additive: true, opacity: 0.9, toneMapped: false }), { r: [Math.PI / 2, 0, 0], p: [0, 0.145, 0], cast: false });
    this.body.add(this.centerRing);
    // Beat 2: 홈을 따라 안쪽으로 감겨 들어가는 파란 빛
    this.grooveLight = mesh(torus(1, 0.012, 6, 48), basic('#4fb8ff', { additive: true, opacity: 0, toneMapped: false }), { r: [Math.PI / 2, 0, 0], p: [0, 0.146, 0], cast: false });
    this.body.add(this.grooveLight);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb347', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(0.9, 0.9, 1);
    glow.position.set(0, 0.3, 0);
    this.glow = glow;
    this.body.add(glow);
    this.root.add(this.body);
    // Beat 1: 바닥으로 퍼지는 작은 펄스 링
    this.pulse = mesh(ring(0.36, 0.41, 40), basic('#ffb347', { additive: true, opacity: 0, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.015, 0], cast: false });
    this.root.add(this.pulse);
    this.floorRing = mesh(ring(0.42, 0.47, 40), basic(color, { opacity: 0.8, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.012, 0], cast: false });
    this.root.add(this.floorRing);
    this.fuseArc = mesh(ring(0.47, 0.51, 40), basic('#ffd166', { opacity: 0.75, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.013, 0], cast: false });
    this.root.add(this.fuseArc);
    this.lastFrac = -1;
    this.lastBeat = -1;
    this.pulseT = 1;
    this.t = 0;
    this.spawn = 0;
    this.col = new THREE.Color();
    parent.add(this.root);
  }

  update(dt, bomb, pos) {
    this.t += dt;
    this.spawn = Math.min(1, this.spawn + dt * 6);
    this.root.position.set(pos.x, pos.y, pos.z);
    const frac = Math.max(0, bomb.fuse / bomb.fuseTotal);
    const progress = 1 - frac;
    const stage = progress < 1 / 3 ? 1 : progress < 2 / 3 ? 2 : 3;
    const local = (progress * 3) % 1;
    const drop = bomb.state === 'DROP';
    const s = easeOutBack(this.spawn);

    // 박자: 단계마다 빨라진다
    const bps = stage === 1 ? 2 : stage === 2 ? 3 : 5;
    const beatIdx = Math.floor(this.t * bps);
    const beat = Math.pow(Math.max(0, Math.cos((this.t * bps - beatIdx) * Math.PI * 0.5)), 8);
    if (beatIdx !== this.lastBeat) {
      this.lastBeat = beatIdx;
      this.pulseT = 0;
    }
    this.pulseT += dt;

    // Beat 1 — 주황 펄스 / Beat 2·3 — 파란 펄스(약하게)
    const pk = clamp01(this.pulseT / 0.5);
    this.pulse.scale.setScalar(1 + pk * (stage === 1 ? 0.9 : 0.5));
    this.pulse.material.opacity = (1 - pk) * (stage === 1 ? 0.85 : 0.35);
    this.pulse.material.color.copy(stage === 1 ? AMBER : BLUE);

    // Beat 2 — 홈을 따라 바깥 → 안쪽으로 감기는 파란 빛
    if (stage >= 2) {
      const r = stage === 2 ? 0.33 - local * 0.17 : 0.16;
      this.grooveLight.scale.setScalar(r);
      this.grooveLight.material.opacity = stage === 2 ? 0.95 : 0.4 + beat * 0.4;
    } else this.grooveLight.material.opacity = 0;

    // Beat 3 — 중앙 음표가 점점 밝아진다
    const heat = stage === 3 ? local : 0;
    this.col.copy(AMBER).lerp(HOT, heat);
    this.centerRing.material.color.copy(stage === 2 ? this.col.copy(AMBER).lerp(BLUE, 0.35) : this.col);
    this.centerRing.material.opacity = 0.65 + beat * 0.35 + heat * 0.3;
    this.label.material.color.setScalar(1 + heat * 1.6 + beat * 0.25);
    this.glow.material.color.copy(stage === 3 ? HOT : stage === 2 ? BLUE : AMBER);

    if (drop) {
      const k = 1 - bomb.fuse / GAME_CONFIG.bomb.dropTime;
      this.body.scale.set(s * (1 + k * 0.3), s * (1 - k * 0.35), s * (1 + k * 0.3));
      this.glow.material.opacity = 0.7 + k;
      this.glow.scale.setScalar(0.9 + k * 1.2);
    } else {
      this.body.scale.setScalar(s * (1 + beat * (stage === 3 ? 0.1 : 0.05)));
      this.glow.material.opacity = 0.25 + beat * 0.35 + heat * 0.5;
      this.glow.scale.setScalar(0.8 + heat * 0.6);
    }
    this.body.position.y = stage === 3 ? beat * 0.05 : 0;
    this.body.rotation.y += dt * (1.5 + progress * 9);

    if (Math.abs(frac - this.lastFrac) > 0.02) {
      this.fuseArc.geometry = new THREE.RingGeometry(0.47, 0.51, 40, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, frac));
      this.lastFrac = frac;
    }
    this.fuseArc.material.color.set(frac < 0.3 ? '#ff4d4d' : '#ffd166');
    this.floorRing.visible = pos.y < 0.05;
    this.fuseArc.visible = pos.y < 0.05;
    this.pulse.visible = pos.y < 0.05;
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of [this.label, this.centerRing, this.grooveLight, this.pulse, this.floorRing, this.fuseArc]) m.material.dispose();
    this.glow.material.dispose();
  }
}

// ── Sound Wave (폭발) — 불꽃이 아니라 바닥을 따라 퍼지는 파란/보라 음파 ─────────
//   칸마다 레코드 홈 동심원 · 팔을 따라 얇은 waveform/EQ 라인 · 떠오르는 ♪♫ · 끝에서 튀는 EQ 바
const WAVE_A = new THREE.Color('#54c7ff');
const WAVE_B = new THREE.Color('#b46bff');
const DIR_V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export class WaveView {
  constructor(parent, explosion, toWorld, { pulse = false } = {}) {
    this.root = group();
    this.t = 0;
    this.life = GAME_CONFIG.wave.lingerTime + 0.6;
    this.tiles = [];
    this.strips = [];
    this.notes = [];
    this.bars = [];
    const grooveTex = grooveRingTexture();
    const cells = explosion.cells || [];
    const c0 = toWorld(explosion.x, explosion.y);
    const tint = (d) => (pulse ? new THREE.Color('#ffd166') : WAVE_A.clone().lerp(WAVE_B, Math.min(1, d / 5)));
    for (const c of cells) {
      const w = toWorld(c.x, c.y);
      const d = Math.abs(c.x - explosion.x) + Math.abs(c.y - explosion.y);
      const tile = mesh(plane(1.0, 1.0), basic(tint(d), { map: grooveTex, additive: true, opacity: 0, toneMapped: false }), { r: [-Math.PI / 2, 0, (c.x * 7 + c.y * 3) % 6], p: [w.x, 0.025, w.z], cast: false });
      this.root.add(tile);
      this.tiles.push({ tile, delay: d * 0.03 });
      // 떠오르는 음표 (2칸마다)
      if (d > 0 && d % 2 === 1) {
        const glyph = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(d % 4 === 1 ? '♫' : '♪', '#ffffff'), color: tint(d), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        glyph.scale.set(0.42, 0.42, 1);
        glyph.position.set(w.x + ((c.x * 13) % 3) * 0.08 - 0.08, 0.35, w.z);
        this.root.add(glyph);
        this.notes.push({ s: glyph, delay: d * 0.03 + 0.05, x: glyph.position.x });
      }
    }
    // 팔마다 바닥에 깔리는 waveform / EQ 라인
    const arms = explosion.arms || {};
    const wf = waveformTexture();
    for (const dir of Object.keys(DIR_V)) {
      const n = arms[dir] || 0;
      if (n <= 0) continue;
      const [vx, vz] = DIR_V[dir];
      const len = n + 0.15;
      const tex = wf.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, len / 2.5), 1);
      const strip = mesh(plane(len, 0.42), basic(tint(n), { map: tex, additive: true, opacity: 0, toneMapped: false }), { cast: false });
      strip.rotation.set(-Math.PI / 2, 0, vx !== 0 ? 0 : Math.PI / 2);
      strip.position.set(c0.x + (vx * len) / 2, 0.035, c0.z + (vz * len) / 2);
      this.root.add(strip);
      this.strips.push({ strip, tex, dir: vx + vz > 0 ? 1 : -1 });
      // 팔 끝에서 튀는 작은 EQ 바
      const tip = { x: c0.x + vx * n, z: c0.z + vz * n };
      for (let i = 0; i < 3; i++) {
        const bar = mesh(rbox(0.07, 0.5, 0.07, 0.02), basic(tint(n + 1), { additive: true, opacity: 0, toneMapped: false }), { cast: false });
        const off = (i - 1) * 0.16;
        bar.position.set(tip.x + (vz !== 0 ? off : 0), 0.25, tip.z + (vx !== 0 ? off : 0));
        this.root.add(bar);
        this.bars.push({ bar, delay: n * 0.03, ph: i * 1.7 + n });
      }
    }
    // 중심: 바닥으로 퍼지는 레코드 홈 링 (구체 불꽃 대신)
    if (!pulse) {
      this.core = mesh(plane(1, 1), basic('#e8f6ff', { map: grooveTex, additive: true, opacity: 0.95, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [c0.x, 0.04, c0.z], cast: false });
      this.root.add(this.core);
      this.coreNote = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture('♫', '#9fdcff'), color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.coreNote.scale.set(0.7, 0.7, 1);
      this.coreNote.position.set(c0.x, 0.5, c0.z);
      this.root.add(this.coreNote);
    }
    parent.add(this.root);
  }

  update(dt) {
    this.t += dt;
    const L = GAME_CONFIG.wave.lingerTime;
    const env = (lt) => clamp01(lt / 0.06) * (1 - clamp01((lt - L) / 0.35));
    for (const tl of this.tiles) {
      const lt = this.t - tl.delay;
      if (lt < 0) continue;
      tl.tile.material.opacity = env(lt) * 0.9;
      tl.tile.scale.setScalar(0.65 + clamp01(lt / 0.25) * 0.4);
      tl.tile.rotation.z += dt * 1.5;
    }
    for (const st of this.strips) {
      st.strip.material.opacity = env(this.t) * 0.95;
      st.tex.offset.x -= dt * 2.2 * st.dir;
    }
    for (const n of this.notes) {
      const lt = this.t - n.delay;
      if (lt < 0) continue;
      n.s.material.opacity = clamp01(lt / 0.1) * (1 - clamp01((lt - 0.35) / 0.45));
      n.s.position.y = 0.35 + lt * 1.1;
      n.s.position.x = n.x + Math.sin(lt * 9) * 0.06;
    }
    for (const b of this.bars) {
      const lt = this.t - b.delay;
      if (lt < 0) continue;
      b.bar.material.opacity = env(lt) * 0.8;
      const h = 0.25 + Math.abs(Math.sin(lt * 16 + b.ph)) * 0.9;
      b.bar.scale.set(1, h, 1);
      b.bar.position.y = 0.25 * h;
    }
    if (this.core) {
      const k = clamp01(this.t / 0.4);
      this.core.scale.setScalar(0.6 + k * 2.2);
      this.core.material.opacity = 0.95 * (1 - k);
      this.coreNote.material.opacity = 0.95 * (1 - clamp01(this.t / 0.6));
      this.coreNote.position.y = 0.5 + this.t * 1.2;
    }
    return this.t < this.life;
  }

  dispose() {
    this.root.removeFromParent();
    for (const tl of this.tiles) tl.tile.material.dispose();
    for (const st of this.strips) {
      st.strip.material.dispose();
      st.tex.dispose();
    }
    for (const n of this.notes) n.s.material.dispose();
    for (const b of this.bars) b.bar.material.dispose();
    if (this.core) {
      this.core.material.dispose();
      this.coreNote.material.dispose();
    }
  }
}

// ── 아이템 ───────────────────────────────────────────────
export class ItemView {
  constructor(parent, item) {
    const def = ITEM_TYPES[item.type];
    this.root = group();
    const tex = itemIconTexture(item.type, def.color);
    const face = basic('#ffffff', { map: tex, opacity: 1, depthWrite: true, toneMapped: false });
    face.transparent = false;
    const edge = mat(def.color, { rough: 0.3, metal: 0.4, emissive: def.color, ei: 0.5 });
    this.token = mesh(cyl(0.34, 0.34, 0.08, 32), [edge, face, face], { r: [Math.PI / 2 - 0.55, 0, 0], p: [0, 0.5, 0] });
    this.root.add(this.token);
    const glow = mesh(circle(0.42, 32), basic(def.color, { map: glowTexture(), additive: true, opacity: 0.8, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.02, 0], cast: false });
    this.root.add(glow);
    this.t = Math.random() * 3;
    this.spawn = 0;
    this.pos = null;
    parent.add(this.root);
  }

  update(dt, item, toWorld) {
    this.t += dt;
    this.spawn = Math.min(1, this.spawn + dt * 4);
    const w = toWorld(item.x, item.y);
    if (!this.pos) this.pos = new THREE.Vector3(w.x, 0, w.z);
    this.pos.x = damp(this.pos.x, w.x, 12, dt);
    this.pos.z = damp(this.pos.z, w.z, 12, dt);
    this.root.position.copy(this.pos);
    this.token.position.y = 0.45 + Math.sin(this.t * 3) * 0.07 + (1 - this.spawn) * 0.6;
    this.token.rotation.z = Math.sin(this.t * 2.2) * 0.5;
    this.root.scale.setScalar(easeOutBack(this.spawn));
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── 경고 표시 (House Event / 해저드 / 바람 / 턴테이블) ──────────
const TELE_COLORS = { house: '#ff7136', drop: '#ff7136', lane: '#ffd166', pulse: '#ffd166', ring: '#b46bff', danger: '#ff4d4d' };
export class TelegraphView {
  constructor(parent, toWorld, W, H) {
    this.root = group();
    this.toWorld = toWorld;
    this.W = W;
    this.H = H;
    this.pool = [];
    this.arrows = [];
    this.t = 0;
    parent.add(this.root);
    const hz = hazardTexture();
    for (let i = 0; i < 120; i++) {
      const m = mesh(plane(0.92, 0.92), basic('#ffffff', { map: hz, additive: true, opacity: 0, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.025, 0], cast: false });
      m.visible = false;
      this.root.add(m);
      this.pool.push(m);
    }
    const at = arrowTexture();
    for (let i = 0; i < 40; i++) {
      const m = mesh(plane(0.7, 0.7), basic('#bfe6ff', { map: at, additive: true, opacity: 0, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.04, 0], cast: false });
      m.visible = false;
      this.root.add(m);
      this.arrows.push(m);
    }
  }

  update(dt, telegraphs) {
    this.t += dt;
    let n = 0;
    let na = 0;
    for (const tg of telegraphs) {
      const color = TELE_COLORS[tg.kind] || '#ff7136';
      const pulse = 0.35 + Math.abs(Math.sin(this.t * (6 + (tg.progress || 0) * 10))) * 0.5;
      for (const c of tg.cells) {
        if (n >= this.pool.length) break;
        const m = this.pool[n++];
        const w = this.toWorld(c.x, c.y);
        m.position.set(w.x, 0.025, w.z);
        m.material.color.set(color);
        m.material.opacity = pulse;
        m.visible = true;
      }
      if ((tg.kind === 'lane' || tg.kind === 'wind') && tg.dir) {
        const ang = { right: 0, left: Math.PI, up: Math.PI / 2, down: -Math.PI / 2 }[tg.dir];
        const cells = tg.kind === 'lane' ? tg.cells.filter((_, i) => i % 2 === 0) : this._windCells();
        for (const c of cells) {
          if (na >= this.arrows.length) break;
          const m = this.arrows[na++];
          const w = this.toWorld(c.x, c.y);
          const shift = ((this.t * 1.5) % 1) * 0.6;
          const dx = Math.cos(ang) * shift;
          const dz = -Math.sin(ang) * shift;
          m.position.set(w.x + dx, 0.04, w.z + dz);
          m.rotation.set(-Math.PI / 2, 0, ang);
          m.material.color.set(tg.kind === 'wind' ? '#bfe6ff' : '#ffd166');
          m.material.opacity = 0.4 + Math.sin(this.t * 8) * 0.25;
          m.visible = true;
        }
      }
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
    for (let i = na; i < this.arrows.length; i++) this.arrows[i].visible = false;
  }

  _windCells() {
    const out = [];
    for (let y = 2; y < this.H - 1; y += 3) for (let x = 2; x < this.W - 1; x += 3) out.push({ x, y });
    return out;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── Rolling LP (LP LIBRARY 해저드) ─────────────────────────
export class RollingLpView {
  constructor(parent) {
    this.root = group();
    const groove = mat('#ffffff', { map: grooveTexture('#d9a441', 512), rough: 0.3 });
    this.disc = mesh(cyl(0.62, 0.62, 0.16, 48), [mat('#0c0c10'), groove, groove], { r: [Math.PI / 2, 0, 0], p: [0, 0.62, 0] });
    this.root.add(this.disc);
    this.root.visible = false;
    parent.add(this.root);
  }

  update(dt, v, toWorld) {
    if (!v || v.phase !== 'roll') {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const w = toWorld(v.pos, v.lane);
    this.root.position.set(w.x, 0, w.z);
    this.root.rotation.y = Math.PI / 2;
    this.disc.rotation.y -= dt * v.dir * 16;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── MR. ODD (House Event 전용 — 플레이어 아님) ────────────────
export class MrOddView {
  constructor(parent, toWorld, W, H) {
    this.toWorld = toWorld;
    this.W = W;
    this.H = H;
    this.rig = buildMrOdd();
    this.root = group([this.rig.root]);
    this.root.visible = false;
    this.backZ = toWorld(0, 0).z - 0.25; // 뒷벽 앞, 붙박이장 뒤에서 솟아오름
    this.root.position.set(0, -5, this.backZ);
    this.phase = 'hidden';
    this.t = 0;
    this.targetX = 0;
    this.targetZ = 0;
    this.kind = null;
    parent.add(this.root);
  }

  trigger(phase, kind, cells) {
    this.kind = kind;
    if (phase === 'warn') {
      this.phase = 'rise';
      this.t = 0;
      this.root.visible = true;
      if (cells && cells.length) {
        const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
        const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
        const w = this.toWorld(cx, cy);
        this.targetX = w.x;
        this.targetZ = w.z;
      } else {
        this.targetX = 0;
        this.targetZ = 0;
      }
    } else if (phase === 'act') {
      this.phase = 'act';
      this.t = 0;
    }
  }

  update(dt) {
    if (!this.root.visible) return;
    this.t += dt;
    const r = this.rig;
    const baseX = THREE.MathUtils.clamp(this.targetX * 0.6, -this.W / 2 + 3, this.W / 2 - 3);
    if (this.phase === 'rise') {
      const k = clamp01(this.t / 0.9);
      this.root.position.set(baseX, -4.2 + easeOutBack(k) * 3.0, this.backZ);
      r.head.rotation.y = Math.sin(this.t * 1.6) * 0.35;
      r.head.rotation.x = 0.35;
      // 손이 목표 위로
      r.handR.position.lerp(new THREE.Vector3(this.targetX - baseX + 0.4, 1.2 + Math.sin(this.t * 3) * 0.15, this.targetZ - this.backZ), 1 - Math.exp(-3 * dt));
      r.handL.position.lerp(new THREE.Vector3(-1.9, 1.6, 0.8), 1 - Math.exp(-3 * dt));
    } else if (this.phase === 'act') {
      const k = clamp01(this.t / 0.4);
      r.handR.position.y = 1.2 - Math.sin(k * Math.PI) * 0.9;
      if (this.t > 1.2) {
        this.phase = 'sink';
        this.t = 0;
      }
    } else if (this.phase === 'sink') {
      const k = clamp01(this.t / 0.8);
      this.root.position.y = -1.2 - k * 4;
      r.handR.position.lerp(new THREE.Vector3(1.9, 1.4, 0.6), 1 - Math.exp(-4 * dt));
      if (k >= 1) {
        this.root.visible = false;
        this.phase = 'hidden';
      }
    }
  }

  dispose() {
    this.root.removeFromParent();
  }
}
