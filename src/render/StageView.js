import * as THREE from 'three';
import { buildProp } from './propFactory.js';
import { rbox, box, cyl, sphere, torus, plane, circle, mat, basic, mesh, group, easeOutBack, easeOutCubic, damp } from './kit.js';
import { floorTexture, rugTexture, wallpaperTexture, labelTexture, spinesTexture, glowTexture, grooveTexture } from './textures.js';

// ─────────────────────────────────────────────────────────────
// StageView — 논리 그리드를 3D 미니어처 디오라마로 표현
// 그리드 그룹(가구/상자)을 메쉬로 1:1 매칭하고, grid.version 변화 시 재조정한다.
// ─────────────────────────────────────────────────────────────

const FLOOR_STYLE = { lounge: 'planks', library: 'parquet', studio: 'tiles', djbooth: 'tiles', terrace: 'deck', lockedroom: 'planks' };

const PROP_THEME = {
  lounge: { sofa: '#8e2b2f', sofaCushion: '#a83a3c', lampShade: '#f2d29b' },
  library: { lampShade: '#f0c98a' },
  studio: {},
  djbooth: {},
  terrace: {},
  lockedroom: { sofa: '#5a4a3a' },
};

export class StageView {
  constructor(scene, gm) {
    this.scene = scene;
    this.gm = gm;
    this.grid = gm.grid;
    this.def = gm.stageDef;
    this.theme = this.def.theme;
    this.W = this.grid.width;
    this.H = this.grid.height;
    this.root = group([], { name: 'stage' });
    scene.add(this.root);
    this.groupMeshes = new Map(); // groupId → { obj, cellsKey, center, anim }
    this.dying = [];
    this.lamps = [];
    this.lights = [];
    this.speakers = [];
    this.decks = [];
    this.lastVersion = -1;
    this.t = 0;
    this.build();
  }

  toWorld(x, y) {
    return { x: x - (this.W - 1) / 2, z: y - (this.H - 1) / 2 };
  }

  build() {
    this._buildFloor();
    this._buildBorder();
    this._buildBackdrop();
    this.reconcile(true);
  }

  _buildFloor() {
    const { W, H } = this;
    const style = this.theme.floor.style || FLOOR_STYLE[this.theme.backdrop] || 'planks';
    // 바깥 바닥 (아레나 밖까지 이어지는 집 바닥)
    const outer = mesh(plane(W + 30, H + 30), mat(new THREE.Color(this.theme.floor.b).multiplyScalar(0.55), { rough: 0.9 }), { r: [-Math.PI / 2, 0, 0], p: [0, -0.01, 4], cast: false });
    this.root.add(outer);
    const tex = floorTexture(this.theme.floor, W - 2, H - 2, style);
    const floor = mesh(plane(W - 2, H - 2), mat('#ffffff', { map: tex, rough: style === 'tiles' ? 0.45 : 0.75, metal: style === 'tiles' ? 0.15 : 0 }), {
      r: [-Math.PI / 2, 0, 0],
      p: [0, 0, 0],
      cast: false,
    });
    floor.receiveShadow = true;
    this.root.add(floor);
    const rugs = this.theme.rugs || (this.theme.rug ? [this.theme.rug] : []);
    for (const rug of rugs) {
      const a = this.toWorld(rug.x0, rug.y0);
      const b = this.toWorld(rug.x1, rug.y1);
      const w = b.x - a.x + 1;
      const d = b.z - a.z + 1;
      const m = mesh(plane(w - 0.1, d - 0.1), mat('#ffffff', { map: rugTexture(rug.color, rug.trim, Math.round(w), Math.round(d), rug.kind), rough: 1 }), {
        r: [-Math.PI / 2, 0, 0],
        p: [(a.x + b.x) / 2, 0.006, (a.z + b.z) / 2],
        cast: false,
      });
      this.root.add(m);
    }
  }

  _buildBorder() {
    const { W, H } = this;
    const th = this.theme;
    const wallMat = mat(th.wall.trim, { rough: 0.7 });
    const back = this.toWorld(0, 0);
    const front = this.toWorld(0, H - 1);
    const left = this.toWorld(0, 0).x;
    const right = this.toWorld(W - 1, 0).x;
    if (th.border === 'terrace') {
      const rail = mat('#2a2a30', { metal: 0.6, rough: 0.4 });
      const post = (x, z) => this.root.add(mesh(cyl(0.05, 0.05, 0.7, 8), rail, { p: [x, 0.35, z] }));
      for (let x = 0; x < W; x++) {
        post(left + x, front.z);
      }
      for (let y = 0; y < H; y++) {
        const z = this.toWorld(0, y).z;
        post(left, z);
        post(right, z);
      }
      this.root.add(mesh(box(W, 0.06, 0.08), rail, { p: [0, 0.72, front.z] }));
      this.root.add(mesh(box(0.08, 0.06, H), rail, { p: [left, 0.72, 0] }));
      this.root.add(mesh(box(0.08, 0.06, H), rail, { p: [right, 0.72, 0] }));
      this.root.add(mesh(rbox(W, 0.2, 0.9, 0.04), mat('#4a3a2e'), { p: [0, 0.1, back.z] }));
      // 데크 가장자리
      this.root.add(mesh(box(W + 0.4, 0.12, H + 0.4), mat('#3a2e24', { rough: 0.9 }), { p: [0, -0.07, 0], cast: false }));
      return;
    }
    // 방: 뒤쪽 붙박이 수납장 / 양옆 낮은 벽 / 앞쪽 낮은 턱
    this.root.add(mesh(rbox(W, 0.62, 0.92, 0.05), wallMat, { p: [0, 0.31, back.z] }));
    this.root.add(mesh(box(W, 0.05, 0.98), mat(th.wall.accent, { metal: 0.5, rough: 0.4 }), { p: [0, 0.64, back.z] }));
    for (let x = 1; x < W - 1; x += 2) {
      this.root.add(mesh(box(0.8, 0.4, 0.02), mat(new THREE.Color(th.wall.trim).offsetHSL(0, 0, 0.05)), { p: [left + x + 0.5, 0.3, back.z + 0.47], cast: false }));
    }
    this.root.add(mesh(rbox(0.92, 0.5, H - 1, 0.05), wallMat, { p: [left, 0.25, 0.5] }));
    this.root.add(mesh(rbox(0.92, 0.5, H - 1, 0.05), wallMat, { p: [right, 0.25, 0.5] }));
    this.root.add(mesh(rbox(W - 2, 0.22, 0.92, 0.05), wallMat, { p: [0, 0.11, front.z] }));
  }

  _buildBackdrop() {
    const { W, H } = this;
    const th = this.theme;
    const back = this.toWorld(0, 0).z - 0.46;
    const left = this.toWorld(0, 0).x - 0.46;
    const right = this.toWorld(W - 1, 0).x + 0.46;
    const kind = th.backdrop;
    const wallH = 4.2;
    const wallStyle = { lounge: 'damask', library: 'stripe', studio: 'foam', djbooth: 'stripe', terrace: 'brick', lockedroom: 'brick' }[kind];
    const wp = wallpaperTexture(th.wall.color, th.wall.accent, wallStyle).clone();
    wp.repeat.set(W / 2, wallH / 2);
    wp.needsUpdate = true;
    const wallM = mat('#ffffff', { map: wp, rough: 0.9 });
    // 뒷벽
    this.root.add(mesh(plane(W + 1, wallH), wallM, { p: [0, wallH / 2, back], cast: false }));
    // 옆벽 (디오라마 컷어웨이)
    if (kind !== 'terrace') {
      const swp = wallpaperTexture(th.wall.color, th.wall.accent, wallStyle).clone();
      swp.repeat.set(H / 2, 1);
      swp.needsUpdate = true;
      const sideM = mat('#ffffff', { map: swp, rough: 0.9 });
      const sideH = 1.6;
      this.root.add(mesh(plane(H, sideH), sideM, { p: [left, sideH / 2, 0.3], r: [0, Math.PI / 2, 0], cast: false }));
      this.root.add(mesh(plane(H, sideH), sideM, { p: [right, sideH / 2, 0.3], r: [0, -Math.PI / 2, 0], cast: false }));
      this.root.add(mesh(box(0.08, 0.08, H), mat(th.wall.accent, { metal: 0.5 }), { p: [left, sideH, 0.3] }));
      this.root.add(mesh(box(0.08, 0.08, H), mat(th.wall.accent, { metal: 0.5 }), { p: [right, sideH, 0.3] }));
    }
    const deco = BACKDROPS[kind];
    if (deco) deco.call(this, { back, left, right, W, H, wallH, th });

    // 공통 조명 리그
    const accents = th.accents || ['#4fb8ff', '#9a66ff'];
    const a1 = new THREE.PointLight(accents[0], 6, 9, 1.6);
    a1.position.set(left + 1.5, 2.2, back + 0.8);
    const a2 = new THREE.PointLight(accents[1], 6, 9, 1.6);
    a2.position.set(right - 1.5, 2.2, back + 0.8);
    this.root.add(a1, a2);
    this.lights.push({ light: a1, base: 6 }, { light: a2, base: 6 });
    // LED 스트립 (뒷벽 상단)
    const led = mesh(box(W, 0.04, 0.04), basic(accents[1], { toneMapped: false }), { p: [0, 2.6, back + 0.03], cast: false });
    this.root.add(led);
    this.led = led;
  }

  // ── 그룹 ↔ 메쉬 재조정 ───────────────────────────
  _groupInfo(g) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of g.cells) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const w = maxX - minX + 1;
    const d = maxY - minY + 1;
    const wc = this.toWorld(cx, cy);
    const dx = (this.W - 1) / 2 - cx;
    const dy = (this.H - 1) / 2 - cy;
    const face = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dy) || 1 };
    return { w, d, wc, face, key: g.cells.map((c) => `${c.x},${c.y}`).sort().join(';') };
  }

  _createGroupMesh(g, initial) {
    const info = this._groupInfo(g);
    const cell = this.grid.get(g.cells[0].x, g.cells[0].y);
    const theme = { ...(PROP_THEME[this.theme.backdrop] || {}), wallTrim: this.theme.wall.trim, wallAccent: this.theme.wall.accent };
    const obj = buildProp(g.prop, { w: info.w, d: info.d, face: info.face, theme, seed: g.id * 7 + g.cells[0].x * 3 + g.cells[0].y });
    obj.position.set(info.wc.x, 0, info.wc.z);
    this.root.add(obj);
    const entry = { obj, key: info.key, from: null, to: obj.position.clone(), t: 1, dur: 0.35, spawn: initial ? 1 : 0, cellRef: cell };
    if (!initial) obj.scale.setScalar(0.01);
    if (cell && cell.light) this._addLamp(obj, info.wc);
    if (g.prop === 'speaker') this.speakers.push(obj);
    if (g.prop === 'turntable') this.decks.push({ obj, x: g.cells[0].x, y: g.cells[0].y, angle: 0, target: 0 });
    this.groupMeshes.set(g.id, entry);
    return entry;
  }

  _addLamp(obj, wc) {
    if (this.lamps.length >= 4) return;
    const light = new THREE.PointLight('#ffb35c', 9, 7, 1.5);
    light.position.set(wc.x, 1.1, wc.z);
    light.castShadow = false;
    this.root.add(light);
    this.lamps.push({ light, obj, base: 9, seed: Math.random() * 10 });
  }

  reconcile(initial = false) {
    const seen = new Set();
    for (const g of this.grid.groups.values()) {
      if (!g.cells.length) continue;
      seen.add(g.id);
      const existing = this.groupMeshes.get(g.id);
      if (!existing) {
        this._createGroupMesh(g, initial);
        continue;
      }
      const info = this._groupInfo(g);
      if (info.key !== existing.key) {
        existing.key = info.key;
        existing.from = existing.obj.position.clone();
        existing.to = new THREE.Vector3(info.wc.x, 0, info.wc.z);
        existing.t = 0;
      }
    }
    for (const [id, e] of this.groupMeshes) {
      if (!seen.has(id)) {
        this.groupMeshes.delete(id);
        this.dying.push({ obj: e.obj, t: 0, kind: e.obj.userData.prop === 'secretShelf' ? 'sink' : 'pop' });
        const li = this.lamps.findIndex((l) => l.obj === e.obj);
        if (li >= 0) {
          this.lamps[li].light.removeFromParent();
          this.lamps.splice(li, 1);
        }
      }
    }
    this.lastVersion = this.grid.version;
  }

  rotateDeck(x, y) {
    const d = this.decks.find((k) => k.x === x && k.y === y);
    if (d) d.target -= Math.PI / 4;
  }

  update(dt, { beat = 0, lightsOut = false, rec = null } = {}) {
    this.t += dt;
    if (this.grid.version !== this.lastVersion) this.reconcile(false);

    for (const e of this.groupMeshes.values()) {
      if (e.spawn < 1) {
        e.spawn = Math.min(1, e.spawn + dt * 3.2);
        const k = easeOutBack(e.spawn);
        e.obj.scale.setScalar(Math.max(0.01, k));
        e.obj.position.y = (1 - easeOutCubic(e.spawn)) * 2.5;
      }
      if (e.t < 1 && e.from) {
        e.t = Math.min(1, e.t + dt / e.dur);
        e.obj.position.lerpVectors(e.from, e.to, easeOutCubic(e.t));
        e.obj.position.y = Math.sin(e.t * Math.PI) * 0.12;
      }
      // 기믹 상태 표현
      const cell = this.grid.get(Math.round(e.to.x + (this.W - 1) / 2), Math.round(e.to.z + (this.H - 1) / 2));
      const gim = cell?.gimmick;
      if (gim) {
        if (gim.kind === 'door') {
          const panel = e.obj.getObjectByName('doorPanel');
          if (panel) panel.rotation.y = damp(panel.rotation.y, gim.open ? -Math.PI * 0.55 : 0, 10, dt);
        } else if (gim.kind === 'lever') {
          const arm = e.obj.getObjectByName('leverArm');
          if (arm) arm.rotation.z = damp(arm.rotation.z, gim.on ? -0.6 : 0.6, 10, dt);
        } else if (gim.kind === 'gate') {
          const body = e.obj.getObjectByName('gateBody');
          if (body) body.position.y = damp(body.position.y, gim.open ? -0.86 : 0, 9, dt);
          const ringM = e.obj.getObjectByName('gateRing');
          if (ringM) ringM.material.color.set(gim.open ? '#6ee3a3' : '#ff3b4f');
        } else if (gim.kind === 'recSwitch') {
          const b = e.obj.getObjectByName('button');
          if (b) b.material.emissiveIntensity = gim.on ? 1.6 + Math.sin(this.t * 10) * 0.6 : 0.25;
        }
      }
      if (rec && (e.obj.userData.prop === 'amp' || e.obj.userData.prop === 'ampGate')) {
        const l = e.obj.getObjectByName('ampLight');
        if (l) l.material.emissiveIntensity = rec.charging ? 2.5 + Math.sin(this.t * 30) * 1.5 : rec.state === 'rec' ? 1.2 : 0.4;
      }
    }

    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += dt;
      const k = Math.min(1, d.t / 0.28);
      if (d.kind === 'sink') {
        d.obj.position.y = -k * 1.2;
      } else {
        d.obj.scale.setScalar(Math.max(0.001, 1 + k * 0.25 - k * k * 1.2));
        d.obj.position.y = k * 0.2;
      }
      if (k >= 1) {
        d.obj.removeFromParent();
        this.dying.splice(i, 1);
      }
    }

    // 턴테이블은 시각적으로만 천천히 돈다 (논리 맵은 고정)
    for (const d of this.decks) {
      d.angle = damp(d.angle, d.target, 8, dt);
      const platter = d.obj.getObjectByName('platter');
      if (platter) platter.rotation.y = d.angle + this.t * 0.5;
    }
    // 스피커 비트 펄스 (불빛만 — 가구 자체는 움직이지 않는다)
    for (const s of this.speakers) {
      const g = s.getObjectByName('ringGlow');
      if (g) g.material.emissiveIntensity = 0.6 + beat * 2.2;
    }
    // 조명 / 암전
    const dim = lightsOut ? 0.12 : 1;
    for (const l of this.lamps) {
      l.light.intensity = damp(l.light.intensity, l.base * dim * (0.95 + Math.sin(this.t * 7 + l.seed) * 0.03), 6, dt);
      const glow = l.obj.getObjectByName('glow');
      if (glow) glow.material.opacity = 0.55 * dim;
    }
    for (const l of this.lights) l.light.intensity = damp(l.light.intensity, l.base * (lightsOut ? 0.25 : 1) * (0.85 + beat * 0.3), 6, dt);
    if (this.led) this.led.material.opacity = lightsOut ? 0.25 : 0.7 + beat * 0.3;
    if (this.discoBall) this.discoBall.rotation.y += dt * 0.8;
    // TERRACE 바람 장치 회전 (바람 예고 / 돌풍 때 빠르게)
    for (const e of this.groupMeshes.values()) {
      const blades = e.obj.userData.prop === 'windFan' ? e.obj.getObjectByName('fanBlades') : null;
      if (blades) blades.rotation.z += dt * (this.windBoost ? 26 : 4);
    }
  }

  dispose() {
    this.root.removeFromParent();
  }
}

// ── 스테이지별 배경 장식 ─────────────────────────────
function windowPane(w, h, glow = '#2a4a8a') {
  const g = group();
  g.add(mesh(box(w + 0.16, h + 0.16, 0.08), mat('#3e2618'), { cast: false }));
  const sky = document.createElement('canvas');
  sky.width = 128;
  sky.height = 128;
  const c = sky.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#0a1430');
  grad.addColorStop(1, glow);
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 128);
  c.fillStyle = '#fff';
  for (let i = 0; i < 30; i++) c.fillRect(Math.random() * 128, Math.random() * 90, 1, 1);
  c.fillStyle = '#f8f0c8';
  c.beginPath();
  c.arc(92, 30, 12, 0, Math.PI * 2);
  c.fill();
  const tex = new THREE.CanvasTexture(sky);
  tex.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(plane(w, h), basic('#ffffff', { map: tex, opacity: 1, toneMapped: false }), { p: [0, 0, 0.045], cast: false }));
  g.add(mesh(box(0.06, h, 0.04), mat('#3e2618'), { p: [0, 0, 0.07], cast: false }));
  g.add(mesh(box(w, 0.06, 0.04), mat('#3e2618'), { p: [0, 0, 0.07], cast: false }));
  return g;
}

function neon(text, color, w = 2.4, h = 0.6) {
  const tex = labelTexture(text, { color: '#ffffff', font: 'bold 92px "Arial Black", sans-serif', w: 1024, h: 256, glow: color });
  const m = mesh(plane(w, h), basic(color, { map: tex, additive: true, toneMapped: false }), { cast: false });
  return m;
}

function poster(text, bg, fg = '#fff') {
  const g = group();
  g.add(mesh(box(0.9, 1.2, 0.04), mat('#2a1a10'), { cast: false }));
  g.add(mesh(plane(0.8, 1.1), mat('#ffffff', { map: labelTexture(text, { color: fg, bg, font: 'bold 60px sans-serif', w: 256, h: 352 }) }), { p: [0, 0, 0.025], cast: false }));
  return g;
}

const BACKDROPS = {
  lounge({ back, left, right, W }) {
    const win = windowPane(2.2, 1.5);
    win.position.set(-3.2, 2.0, back + 0.02);
    this.root.add(win);
    const sign = neon('ODD HAUS', '#ff7136', 3.2, 0.8);
    sign.position.set(2.6, 2.3, back + 0.04);
    this.root.add(sign);
    const p1 = poster('BOOM', '#7a2230');
    p1.position.set(0, 1.8, back + 0.03);
    this.root.add(p1);
    const p2 = poster('LP', '#1f4f6e');
    p2.position.set(5.6, 1.6, back + 0.03);
    p2.scale.setScalar(0.8);
    this.root.add(p2);
    // 벽 선반 + LP
    const shelf = mesh(box(3, 0.06, 0.3), mat('#5a3620'), { p: [-6, 1.6, back + 0.15] });
    this.root.add(shelf);
    this.root.add(mesh(box(2.8, 0.34, 0.02), mat('#fff', { map: spinesTexture(3) }), { p: [-6, 1.8, back + 0.2], cast: false }));
    // 큰 스탠드 조명 (아레나 밖)
    const lamp = buildProp('lamp', { theme: {} });
    lamp.position.set(right + 0.9, 0, back + 1.2);
    lamp.scale.setScalar(1.6);
    this.root.add(lamp);
  },
  library({ back, W }) {
    for (let i = 0; i < 6; i++) {
      const x = -W / 2 + 1.5 + i * (W - 3) / 5;
      this.root.add(mesh(box(2.4, 3.2, 0.4), mat('#2c1a10'), { p: [x, 2.2, back + 0.2] }));
      for (let r = 0; r < 4; r++) this.root.add(mesh(box(2.2, 0.62, 0.02), mat('#fff', { map: spinesTexture(i * 4 + r + 1) }), { p: [x, 0.95 + r * 0.75, back + 0.41], cast: false }));
    }
    const ladder = group([], { p: [3.5, 0, back + 0.9], r: [-0.25, 0.2, 0] });
    for (const s of [-0.3, 0.3]) ladder.add(mesh(box(0.06, 3.4, 0.06), mat('#8a5a30'), { p: [s, 1.7, 0] }));
    for (let i = 0; i < 9; i++) ladder.add(mesh(box(0.6, 0.04, 0.05), mat('#8a5a30'), { p: [0, 0.3 + i * 0.36, 0] }));
    this.root.add(ladder);
    const sign = neon('LP LIBRARY', '#ffb14e', 2.8, 0.7);
    sign.position.set(0, 3.6, back + 0.45);
    this.root.add(sign);
  },
  studio({ back, right, left }) {
    const win = windowPane(3.2, 1.3, '#1d4f7a');
    win.position.set(-2.5, 2.0, back + 0.02);
    this.root.add(win);
    const rec = neon('● REC', '#ff3b4f', 1.8, 0.5);
    rec.position.set(3.0, 2.6, back + 0.04);
    rec.name = 'recSign';
    this.root.add(rec);
    this.recSign = rec;
    for (const x of [left + 1.2, right - 1.2]) {
      const sp = buildProp('speaker', {});
      sp.scale.setScalar(1.8);
      sp.position.set(x, 0.62, back + 0.6);
      this.root.add(sp);
      this.speakers.push(sp);
    }
  },
  djbooth({ back, W }) {
    const sign = neon('BOOM ROOM', '#b46bff', 4, 1);
    sign.position.set(0, 2.5, back + 0.04);
    this.root.add(sign);
    for (let i = 0; i < 5; i++) {
      const m = mesh(box(W, 0.03, 0.03), basic(i % 2 ? '#4fb8ff' : '#b46bff', { toneMapped: false }), { p: [0, 0.9 + i * 0.35, back + 0.03], cast: false });
      this.root.add(m);
    }
    const ball = group([], { p: [0, 3.6, back + 3] });
    ball.add(mesh(sphere(0.45, 16, 12), mat('#e8e8f0', { metal: 1, rough: 0.15, flat: true })));
    ball.add(mesh(cyl(0.01, 0.01, 1.2, 4), mat('#888'), { p: [0, 0.8, 0] }));
    this.root.add(ball);
    this.discoBall = ball;
  },
  terrace({ back, W }) {
    // 밤하늘
    const sky = document.createElement('canvas');
    sky.width = 256;
    sky.height = 256;
    const c = sky.getContext('2d');
    const grad = c.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#050a1e');
    grad.addColorStop(1, '#25305a');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#fff';
    for (let i = 0; i < 120; i++) c.fillRect(Math.random() * 256, Math.random() * 200, 1, 1);
    const tex = new THREE.CanvasTexture(sky);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.root.add(mesh(plane(60, 22), basic('#ffffff', { map: tex, toneMapped: false }), { p: [0, 8, back - 8], cast: false }));
    this.root.add(mesh(circle(0.9, 32), basic('#fff6d8', { toneMapped: false }), { p: [6, 9, back - 7.9], cast: false }));
    // 집 외벽 + 창문
    for (const x of [-4.5, 0, 4.5]) {
      const w = windowPane(1.4, 1.2, '#ffb35c');
      w.position.set(x, 1.8, back + 0.02);
      this.root.add(w);
    }
    // 스트링 라이트
    for (let i = 0; i <= 24; i++) {
      const x = -W / 2 + (i / 24) * W;
      const y = 3.0 - Math.sin((i / 24) * Math.PI) * 0.6;
      const b = mesh(sphere(0.06, 8, 6), basic(i % 3 ? '#ffd27a' : '#ff9a5a', { toneMapped: false }), { p: [x, y, back + 0.6], cast: false });
      this.root.add(b);
    }
  },
  lockedroom({ back, W }) {
    const door = group([], { p: [0, 0, back + 0.05] });
    door.add(mesh(box(1.6, 2.6, 0.1), mat('#3a2418'), { p: [0, 1.3, 0] }));
    door.add(mesh(torus(0.18, 0.04, 8, 20), mat('#888', { metal: 0.9, rough: 0.3 }), { p: [0, 1.3, 0.1] }));
    door.add(mesh(rbox(0.3, 0.3, 0.1, 0.03), mat('#b08a3a', { metal: 0.9, rough: 0.3 }), { p: [0, 1.0, 0.12] }));
    this.root.add(door);
    for (const x of [-4, 4]) {
      const f = group([], { p: [x, 1.9, back + 0.04] });
      f.add(mesh(box(1.4, 1.0, 0.06), mat('#6b4a2e'), { cast: false }));
      f.add(mesh(plane(1.2, 0.85), mat('#e3ddd0', { rough: 1 }), { p: [0, 0, 0.035], cast: false }));
      this.root.add(f);
    }
    const bulb = mesh(sphere(0.12, 12, 10), basic('#ffd9a0', { toneMapped: false }), { p: [0, 3.4, back + 2.5], cast: false });
    this.root.add(bulb);
    this.root.add(mesh(cyl(0.008, 0.008, 1.2, 4), mat('#222'), { p: [0, 4.0, back + 2.5] }));
    const l = new THREE.PointLight('#ffcf8a', 10, 12, 1.4);
    l.position.copy(bulb.position);
    this.root.add(l);
    this.lights.push({ light: l, base: 10 });
  },
};
