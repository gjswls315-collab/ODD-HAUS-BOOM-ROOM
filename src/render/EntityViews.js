import * as THREE from 'three';
import { ITEM_TYPES } from '../config/itemConfig.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { CharacterVisual } from './characters/CharacterVisual.js';
import { buildMrOdd } from './characters/placeholders.js';
import { rbox, cyl, sphere, torus, plane, circle, ring, mat, basic, mesh, group, damp, easeOutBack, clamp01 } from './kit.js';
import { grooveTexture, noteTexture, glowTexture, ringTexture, eqTexture, itemIconTexture, labelTexture, arrowTexture, hazardTexture } from './textures.js';

const DIR_ANGLE = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
// 납작한 캐릭터(LP·피크·열쇠)는 옆면만 보이지 않도록 좌우 회전을 줄여 얼굴이 카메라 쪽으로 보이게
const SIDE_YAW = { vin: 0.85, picker: 0.95, locke: 1.05 };

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

  update(dt, p, t) {
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
    if (p.modifiers.speedBonusTime > 0) this.ringMesh.material.opacity = 0.6 + Math.sin(t * 20) * 0.4;
    else this.ringMesh.material.opacity = 0.9;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── Beat Bomb ─────────────────────────────────────────────
export class BombView {
  constructor(parent, bomb, color) {
    this.root = group();
    this.body = group();
    this.body.add(mesh(cyl(0.3, 0.34, 0.12, 28), mat('#1d1d24', { rough: 0.4, metal: 0.5 }), { p: [0, 0.06, 0] }));
    this.body.add(mesh(torus(0.32, 0.025, 8, 32), mat('#ff7136', { emissive: '#ff7136', ei: 1.5, unique: true }), { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0], name: 'rim', cast: false }));
    const disc = group([], { p: [0, 0.42, 0], r: [-0.35, 0, 0] });
    const groove = mat('#ffffff', { map: grooveTexture('#2a2a30'), rough: 0.3 });
    disc.add(mesh(cyl(0.3, 0.3, 0.07, 36), [mat('#0c0c10'), groove, groove], { r: [Math.PI / 2, 0, 0] }));
    disc.add(mesh(circle(0.13, 24), basic('#ffffff', { map: noteTexture('#ffb347'), toneMapped: false, depthWrite: true }), { p: [0, 0, 0.037], cast: false, name: 'note' }));
    this.body.add(disc);
    this.disc = disc;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff8a3c', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(1.2, 1.2, 1);
    glow.position.set(0, 0.42, 0.05);
    this.glow = glow;
    this.body.add(glow);
    this.root.add(this.body);
    this.floorRing = mesh(ring(0.4, 0.46, 40), basic(color, { opacity: 0.85, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.012, 0], cast: false });
    this.root.add(this.floorRing);
    this.fuseArc = mesh(ring(0.3, 0.38, 40), basic('#ffd166', { opacity: 0.9, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [0, 0.013, 0], cast: false });
    this.root.add(this.fuseArc);
    this.lastFrac = -1;
    this.t = 0;
    this.spawn = 0;
    parent.add(this.root);
  }

  update(dt, bomb, pos) {
    this.t += dt;
    this.spawn = Math.min(1, this.spawn + dt * 6);
    this.root.position.set(pos.x, pos.y, pos.z);
    const frac = Math.max(0, bomb.fuse / bomb.fuseTotal);
    // 카운트가 줄수록 빠르게 비트
    const bpm = 2 + (1 - frac) * 7;
    const beat = Math.pow(Math.max(0, Math.sin(this.t * bpm * Math.PI)), 6);
    const drop = bomb.state === 'DROP';
    const s = easeOutBack(this.spawn);
    if (drop) {
      const k = 1 - bomb.fuse / GAME_CONFIG.bomb.dropTime;
      this.body.scale.set(s * (1 + k * 0.35), s * (1 - k * 0.4), s * (1 + k * 0.35));
      this.glow.material.opacity = 0.6 + k;
      this.glow.material.color.set('#fff1c0');
    } else {
      this.body.scale.setScalar(s * (1 + beat * 0.12));
      this.glow.material.opacity = 0.35 + beat * 0.5;
    }
    this.disc.rotation.z += dt * (2 + (1 - frac) * 10);
    const rim = this.body.getObjectByName('rim');
    rim.material.emissiveIntensity = 1 + beat * 3 + (drop ? 4 : 0);
    if (Math.abs(frac - this.lastFrac) > 0.02) {
      this.fuseArc.geometry = new THREE.RingGeometry(0.3, 0.38, 40, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, frac));
      this.lastFrac = frac;
    }
    this.fuseArc.material.color.set(frac < 0.3 ? '#ff4d4d' : '#ffd166');
    this.floorRing.visible = pos.y < 0.05;
    this.fuseArc.visible = pos.y < 0.05;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── Sound Wave (폭발) ─────────────────────────────────────
const WAVE_A = new THREE.Color('#54c7ff');
const WAVE_B = new THREE.Color('#b46bff');
export class WaveView {
  constructor(parent, explosion, toWorld, { pulse = false } = {}) {
    this.root = group();
    this.t = 0;
    this.life = GAME_CONFIG.wave.lingerTime + 0.35;
    this.tiles = [];
    const ringTex = ringTexture();
    const eq = eqTexture();
    const cells = explosion.cells || [];
    const c0 = toWorld(explosion.x, explosion.y);
    for (const c of cells) {
      const w = toWorld(c.x, c.y);
      const d = Math.abs(c.x - explosion.x) + Math.abs(c.y - explosion.y);
      const col = WAVE_A.clone().lerp(WAVE_B, Math.min(1, d / 5));
      if (pulse) col.set('#ffd166');
      const tile = mesh(plane(1.0, 1.0), basic(col, { map: ringTex, additive: true, opacity: 0.0, toneMapped: false }), { r: [-Math.PI / 2, 0, 0], p: [w.x, 0.03, w.z], cast: false });
      this.root.add(tile);
      const bar = mesh(cyl(0.34, 0.42, 0.9, 20, true), basic(col, { map: eq, additive: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false }), { p: [w.x, 0.45, w.z], cast: false });
      this.root.add(bar);
      this.tiles.push({ tile, bar, delay: d * 0.025 });
    }
    // 중심 폭발
    if (!pulse) {
      this.core = mesh(sphere(0.5, 20, 14), basic('#e8f6ff', { additive: true, opacity: 0.9, toneMapped: false }), { p: [c0.x, 0.45, c0.z], cast: false });
      this.root.add(this.core);
    }
    parent.add(this.root);
  }

  update(dt) {
    this.t += dt;
    const L = GAME_CONFIG.wave.lingerTime;
    for (const tl of this.tiles) {
      const lt = this.t - tl.delay;
      if (lt < 0) continue;
      const fadeIn = clamp01(lt / 0.06);
      const fadeOut = 1 - clamp01((lt - L) / 0.3);
      const a = fadeIn * fadeOut;
      tl.tile.material.opacity = a * 0.95;
      tl.tile.scale.setScalar(0.7 + clamp01(lt / 0.25) * 0.35);
      tl.bar.material.opacity = a * 0.5;
      tl.bar.scale.set(1, 0.4 + Math.abs(Math.sin(lt * 18 + tl.delay * 30)) * 0.9, 1);
      tl.bar.material.map.offset.y -= dt * 2;
    }
    if (this.core) {
      const k = clamp01(this.t / 0.35);
      this.core.scale.setScalar(0.6 + k * 1.4);
      this.core.material.opacity = 0.9 * (1 - k);
    }
    return this.t < this.life;
  }

  dispose() {
    this.root.removeFromParent();
    for (const tl of this.tiles) {
      tl.tile.material.dispose();
      tl.bar.material.dispose();
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
