import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rbox, box, cyl, sphere, torus, cone, capsule, plane, mat, basic, mesh, group } from './kit.js';
import { grooveTexture, spinesTexture, labelTexture, glowTexture } from './textures.js';

// ─────────────────────────────────────────────────────────────
// 스테이지 소품 3D 모델 (절차적 로우폴리 미니어처 디오라마 스타일)
// 논리 그리드 셀 type 과 독립 — 여기서 메쉬를 바꿔도 게임 규칙은 그대로.
// buildProp(kind, { w, d, face, theme, seed }) → Group (원점 = 바닥 중앙)
//   w,d: 점유 칸 수 / face: 정면 방향 {x,z} (아레나 중앙 쪽)
// ─────────────────────────────────────────────────────────────

const WOOD = '#7a4a2a';
const WOOD_DARK = '#4a2c18';
const CARD = '#c99a5e';
const METAL = '#9aa3ad';
const BLACK = '#17171c';

function rotY(face) {
  // 기본 정면 = +z
  return Math.atan2(face.x, face.z);
}

const BUILDERS = {
  // ── LOUNGE ─────────────────────────────────────
  sofa({ w, d, face, theme }) {
    const horizontal = w >= d;
    const L = (horizontal ? w : d) - 0.12;
    const D = 0.86;
    const fabric = theme.sofa || '#8e2b2f';
    const cushion = theme.sofaCushion || '#a83a3c';
    const g = group();
    const inner = group();
    inner.add(mesh(rbox(L, 0.3, D, 0.08), mat(fabric, { rough: 0.9 }), { p: [0, 0.22, 0] }));
    const n = Math.round(L);
    for (let i = 0; i < n; i++) {
      const cx = -L / 2 + (i + 0.5) * (L / n);
      inner.add(mesh(rbox(L / n - 0.06, 0.14, D - 0.28, 0.06), mat(cushion, { rough: 0.95 }), { p: [cx, 0.43, 0.08] }));
      inner.add(mesh(rbox(L / n - 0.1, 0.34, 0.16, 0.07), mat(cushion, { rough: 0.95 }), { p: [cx, 0.6, -D / 2 + 0.22], r: [-0.18, 0, 0] }));
    }
    inner.add(mesh(rbox(L, 0.56, 0.2, 0.08), mat(fabric, { rough: 0.9 }), { p: [0, 0.48, -D / 2 + 0.1] }));
    for (const s of [-1, 1]) inner.add(mesh(rbox(0.18, 0.44, D, 0.08), mat(fabric, { rough: 0.9 }), { p: [s * (L / 2 - 0.09), 0.36, 0] }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) inner.add(mesh(cyl(0.035, 0.025, 0.1, 8), mat(WOOD_DARK), { p: [sx * (L / 2 - 0.1), 0.05, sz * (D / 2 - 0.1)] }));
    // 등받이는 아레나 바깥쪽, 좌석은 중앙을 향하도록
    if (!horizontal) {
      inner.rotation.y = face.x >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      inner.rotation.y = face.z >= 0 ? 0 : Math.PI;
    }
    g.add(inner);
    return g;
  },

  coffeeTable({ w, d }) {
    const W = w - 0.25;
    const D = d - 0.3;
    const g = group();
    g.add(mesh(rbox(W, 0.08, D, 0.04), mat(WOOD, { rough: 0.5 }), { p: [0, 0.4, 0] }));
    g.add(mesh(rbox(W - 0.2, 0.04, D - 0.2, 0.02), mat(WOOD_DARK, { rough: 0.6 }), { p: [0, 0.14, 0] }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(cyl(0.05, 0.04, 0.4, 10), mat(WOOD_DARK), { p: [sx * (W / 2 - 0.12), 0.2, sz * (D / 2 - 0.12)] }));
    // 위에 놓인 LP 두 장과 머그컵
    const disc = mat('#ffffff', { map: grooveTexture('#ffb347'), rough: 0.35 });
    g.add(mesh(cyl(0.3, 0.3, 0.015, 32), [mat(BLACK), disc, disc], { p: [-W * 0.22, 0.455, 0.05], r: [0, 0.4, 0] }));
    g.add(mesh(cyl(0.3, 0.3, 0.015, 32), [mat(BLACK), mat('#fff', { map: grooveTexture('#4fb8ff') }), mat(BLACK)], { p: [-W * 0.18, 0.47, -0.08], r: [0, 1.1, 0] }));
    g.add(mesh(cyl(0.06, 0.05, 0.12, 12), mat('#e9e2d4', { rough: 0.4 }), { p: [W * 0.25, 0.5, 0.1] }));
    g.add(mesh(rbox(0.36, 0.05, 0.26, 0.02), mat('#d94b3d'), { p: [W * 0.2, 0.465, -0.15], r: [0, 0.3, 0] }));
    return g;
  },

  lpBox({ seed }) {
    const g = group();
    g.add(mesh(rbox(0.78, 0.44, 0.7, 0.04), mat(CARD, { rough: 0.95 }), { p: [0, 0.22, 0] }));
    // 열린 뚜껑 날개
    g.add(mesh(box(0.78, 0.02, 0.2), mat('#b8895a', { rough: 0.95 }), { p: [0, 0.47, 0.42], r: [0.9, 0, 0] }));
    g.add(mesh(box(0.78, 0.02, 0.2), mat('#b8895a', { rough: 0.95 }), { p: [0, 0.47, -0.42], r: [-0.9, 0, 0] }));
    const cols = ['#d94b3d', '#3d8bd9', '#f2c14e', '#2fa37c', '#ececec', '#9a66ff'];
    for (let i = 0; i < 5; i++) {
      g.add(mesh(box(0.6, 0.5, 0.025), mat(cols[(seed + i * 2) % cols.length], { rough: 0.6 }), { p: [0, 0.32 + ((seed + i) % 3) * 0.025, -0.24 + i * 0.12], r: [0.08 * (i - 2), 0, 0] }));
    }
    g.add(mesh(plane(0.36, 0.17), mat('#fff', { map: labelTexture('LP', { color: '#2a1a10', bg: '#efe2c4', font: 'bold 90px sans-serif', w: 256, h: 128 }) }), { p: [0, 0.24, 0.352], cast: false }));
    return g;
  },

  books({ seed }) {
    const g = group();
    const cols = ['#b83a3a', '#2f5d8c', '#d9a441', '#2f7a5a', '#6d3f8c', '#e0d6c2'];
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const h = 0.1 + ((seed + i) % 3) * 0.02;
      g.add(mesh(rbox(0.66 - (i % 2) * 0.08, h, 0.5, 0.015), mat(cols[(seed + i) % cols.length], { rough: 0.8 }), { p: [0.03 * Math.sin(seed + i * 2), y + h / 2, 0], r: [0, 0.15 * Math.sin(seed * 3 + i), 0] }));
      g.add(mesh(box(0.6 - (i % 2) * 0.08, h * 0.8, 0.46), mat('#f3ecd8'), { p: [0.03 * Math.sin(seed + i * 2) + 0.04, y + h / 2, 0], r: [0, 0.15 * Math.sin(seed * 3 + i), 0], cast: false }));
      y += h;
    }
    g.add(mesh(rbox(0.3, 0.3, 0.06, 0.02), mat(cols[(seed + 3) % 6]), { p: [0.2, y + 0.15, 0.05], r: [-0.3, 0.4, 0.1] }));
    return g;
  },

  lamp({ theme }) {
    const g = group();
    g.add(mesh(cyl(0.22, 0.26, 0.06, 20), mat('#2a2522', { metal: 0.6, rough: 0.4 }), { p: [0, 0.03, 0] }));
    g.add(mesh(cyl(0.025, 0.025, 1.05, 8), mat('#c9a35a', { metal: 0.8, rough: 0.3 }), { p: [0, 0.56, 0] }));
    const shade = mesh(cyl(0.2, 0.32, 0.32, 24, true), mat(theme.lampShade || '#f2d29b', { emissive: '#ffb35c', ei: 0.9, side: THREE.DoubleSide, rough: 0.9 }), { p: [0, 1.15, 0], cast: false });
    g.add(shade);
    g.add(mesh(sphere(0.08, 12, 10), basic('#fff2cc', { toneMapped: false }), { p: [0, 1.08, 0], cast: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb35c', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(1.6, 1.6, 1);
    glow.position.set(0, 1.1, 0);
    glow.name = 'glow';
    g.add(glow);
    g.userData.lightPos = new THREE.Vector3(0, 1.1, 0);
    return g;
  },

  plant({ seed }) {
    const g = group();
    g.add(mesh(cyl(0.24, 0.18, 0.36, 16), mat('#b5603a', { rough: 0.9 }), { p: [0, 0.18, 0] }));
    g.add(mesh(cyl(0.25, 0.25, 0.05, 16), mat('#9c4f2f'), { p: [0, 0.36, 0] }));
    const leaf = mat('#3f8a4a', { rough: 0.8 });
    const leaf2 = mat('#2f6e3b', { rough: 0.8 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + seed;
      g.add(mesh(sphere(0.16, 10, 8), i % 2 ? leaf : leaf2, { p: [Math.cos(a) * 0.15, 0.62 + (i % 3) * 0.12, Math.sin(a) * 0.15], s: [0.7, 1.6, 0.35], r: [Math.sin(a) * 0.5, a, Math.cos(a) * 0.5] }));
    }
    g.add(mesh(sphere(0.14, 10, 8), leaf, { p: [0, 0.95, 0], s: [0.8, 1.4, 0.8] }));
    return g;
  },

  // ── LP LIBRARY ─────────────────────────────────
  shelf({ w, d, seed }) {
    const W = w - 0.06;
    const D = d - 0.12;
    const H = 1.1;
    const g = group();
    g.add(mesh(rbox(W, H, D, 0.03), mat('#3b2416', { rough: 0.7 }), { p: [0, H / 2, 0] }));
    const spines = mat('#fff', { map: spinesTexture(seed), rough: 0.8 });
    for (let r = 0; r < 3; r++) {
      g.add(mesh(box(W - 0.1, 0.28, 0.02), spines, { p: [0, 0.2 + r * 0.33, D / 2 + 0.005], cast: false }));
      g.add(mesh(box(W - 0.06, 0.035, D), mat('#5a3620'), { p: [0, 0.05 + r * 0.33, 0.01] }));
    }
    g.add(mesh(box(W + 0.04, 0.05, D + 0.04), mat('#8a5a34', { rough: 0.5 }), { p: [0, H, 0] }));
    // 위에 눕혀 놓은 LP 몇 장 (위에서 볼 때 선반임을 알 수 있게)
    g.add(mesh(box(W * 0.6, 0.04, D * 0.7), mat(['#d94b3d', '#3d8bd9', '#f2c14e'][seed % 3], { rough: 0.6 }), { p: [0.05, H + 0.045, 0], r: [0, 0.2, 0] }));
    return g;
  },

  secretShelf({ w, d, seed }) {
    const g = BUILDERS.shelf({ w, d, seed: seed + 5 });
    g.add(mesh(box(0.9, 0.04, 0.02), mat('#d9a441', { metal: 0.8, rough: 0.3, emissive: '#5a3a00', ei: 0.6 }), { p: [0, 1.0, (d - 0.12) / 2 + 0.02], cast: false }));
    g.add(mesh(sphere(0.05, 10, 8), mat('#d9a441', { metal: 0.9, rough: 0.2 }), { p: [0.32, 0.55, (d - 0.12) / 2 + 0.03] }));
    return g;
  },

  recordCrate({ seed }) {
    const g = group();
    const wood = mat('#a8774a', { rough: 0.9 });
    for (const y of [0.08, 0.26, 0.44]) {
      g.add(mesh(box(0.74, 0.12, 0.04), wood, { p: [0, y, 0.33] }));
      g.add(mesh(box(0.74, 0.12, 0.04), wood, { p: [0, y, -0.33] }));
      g.add(mesh(box(0.04, 0.12, 0.66), wood, { p: [0.35, y, 0] }));
      g.add(mesh(box(0.04, 0.12, 0.66), wood, { p: [-0.35, y, 0] }));
    }
    g.add(mesh(box(0.7, 0.03, 0.66), wood, { p: [0, 0.015, 0] }));
    const cols = ['#1c1c22', '#d94b3d', '#3d8bd9', '#f2c14e', '#ececec'];
    for (let i = 0; i < 6; i++) g.add(mesh(box(0.025, 0.58, 0.58), mat(cols[(seed + i) % 5]), { p: [-0.25 + i * 0.1, 0.33, 0], r: [0, 0, 0.12 * Math.sin(seed + i)] }));
    return g;
  },

  routeCrate({ seed }) {
    const g = BUILDERS.recordCrate({ seed });
    g.add(mesh(box(0.78, 0.08, 0.7), mat('#d9a441', { metal: 0.7, rough: 0.3, emissive: '#6a4400', ei: 0.5 }), { p: [0, 0.3, 0] }));
    g.add(mesh(plane(0.3, 0.3), basic('#ffe08a', { map: labelTexture('★', { color: '#fff3c0', font: 'bold 180px sans-serif', w: 256, h: 256, glow: '#ffb000' }), additive: true }), { p: [0, 0.32, 0.37], cast: false }));
    return g;
  },

  // ── STUDIO ─────────────────────────────────────
  mixer({ w, d }) {
    const W = w - 0.1;
    const D = d - 0.12;
    const g = group();
    g.add(mesh(rbox(W, 0.5, D, 0.05), mat('#26262e', { rough: 0.5 }), { p: [0, 0.25, 0] }));
    const top = group([], { p: [0, 0.53, 0.02], r: [-0.25, 0, 0] });
    top.add(mesh(rbox(W - 0.08, 0.06, D - 0.1, 0.02), mat('#33343e', { rough: 0.4, metal: 0.3 })));
    const cols = Math.round(W * 6);
    for (let i = 0; i < cols; i++) {
      const x = -W / 2 + 0.12 + i * ((W - 0.24) / (cols - 1));
      for (let r = 0; r < 3; r++) top.add(mesh(cyl(0.025, 0.025, 0.05, 8), mat(r === 0 ? '#ff5a4f' : '#d8dde5', { rough: 0.3 }), { p: [x, 0.05, -0.22 + r * 0.1] }));
      top.add(mesh(box(0.03, 0.03, 0.14), mat('#111'), { p: [x, 0.04, 0.16] }));
      top.add(mesh(box(0.05, 0.04, 0.04), mat('#ededed'), { p: [x, 0.06, 0.12 + ((i * 37) % 7) * 0.012] }));
    }
    for (let i = 0; i < 8; i++) top.add(mesh(box(0.04, 0.02, 0.02), basic(i < 5 ? '#6ee3a3' : i < 7 ? '#ffc55c' : '#ff5a4f', { toneMapped: false }), { p: [W / 2 - 0.4 + i * 0.045, 0.04, -0.3], cast: false }));
    g.add(top);
    return g;
  },

  speaker() {
    const g = group();
    g.add(mesh(rbox(0.66, 0.92, 0.56, 0.05), mat('#1c1c22', { rough: 0.6 }), { p: [0, 0.46, 0] }));
    const cone1 = mat('#2a2a33', { rough: 0.4, metal: 0.2 });
    g.add(mesh(cyl(0.2, 0.22, 0.04, 28), cone1, { p: [0, 0.32, 0.28], r: [Math.PI / 2, 0, 0] }));
    g.add(mesh(torus(0.21, 0.02, 8, 28), mat('#4fb8ff', { emissive: '#4fb8ff', ei: 1.4 }), { p: [0, 0.32, 0.29], name: 'ringGlow', cast: false }));
    g.add(mesh(sphere(0.06, 12, 10), mat('#555', { metal: 0.6, rough: 0.3 }), { p: [0, 0.32, 0.3] }));
    g.add(mesh(cyl(0.08, 0.09, 0.04, 20), cone1, { p: [0, 0.7, 0.28], r: [Math.PI / 2, 0, 0] }));
    g.name = 'speaker';
    return g;
  },

  amp({ face }) {
    const g = group();
    const inner = group();
    inner.add(mesh(rbox(0.76, 0.5, 0.56, 0.04), mat('#1d1d22', { rough: 0.7 }), { p: [0, 0.25, 0] }));
    inner.add(mesh(rbox(0.78, 0.22, 0.58, 0.04), mat('#2b2620', { rough: 0.5 }), { p: [0, 0.62, 0] }));
    inner.add(mesh(box(0.66, 0.38, 0.02), mat('#3a332a', { rough: 1 }), { p: [0, 0.25, 0.285] }));
    for (let i = 0; i < 6; i++) inner.add(mesh(cyl(0.025, 0.025, 0.04, 8), mat('#d8c27a', { metal: 0.6 }), { p: [-0.28 + i * 0.11, 0.62, 0.3], r: [Math.PI / 2, 0, 0] }));
    inner.add(mesh(box(0.7, 0.05, 0.03), mat('#ff3b4f', { emissive: '#ff3b4f', ei: 0.6 }), { p: [0, 0.5, 0.29], name: 'ampLight', cast: false }));
    inner.rotation.y = rotY(face);
    g.add(inner);
    return g;
  },

  micStand() {
    const g = group();
    g.add(mesh(cyl(0.2, 0.22, 0.04, 16), mat('#1e1e24', { metal: 0.6, rough: 0.3 }), { p: [0, 0.02, 0] }));
    g.add(mesh(cyl(0.022, 0.022, 0.9, 8), mat(METAL, { metal: 0.8, rough: 0.25 }), { p: [0, 0.47, 0] }));
    g.add(mesh(cyl(0.018, 0.018, 0.5, 8), mat(METAL, { metal: 0.8, rough: 0.25 }), { p: [0.12, 0.92, 0.08], r: [0.9, 0, -0.5] }));
    g.add(mesh(capsule(0.07, 0.12), mat('#3a3a44', { metal: 0.4, rough: 0.4 }), { p: [0.26, 1.04, 0.22], r: [1.0, 0, -0.4] }));
    g.add(mesh(sphere(0.085, 14, 10), mat('#8c8c96', { metal: 0.7, rough: 0.5 }), { p: [0.29, 1.1, 0.27] }));
    return g;
  },

  cableCase() {
    const g = group();
    g.add(mesh(rbox(0.74, 0.46, 0.6, 0.04), mat('#2b2b33', { rough: 0.5 }), { p: [0, 0.23, 0] }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(rbox(0.12, 0.48, 0.12, 0.02), mat(METAL, { metal: 0.8, rough: 0.3 }), { p: [sx * 0.33, 0.24, sz * 0.27] }));
    g.add(mesh(box(0.76, 0.03, 0.62), mat(METAL, { metal: 0.8, rough: 0.3 }), { p: [0, 0.3, 0] }));
    g.add(mesh(torus(0.16, 0.04, 8, 22), mat('#ff7136', { rough: 0.6 }), { p: [0.05, 0.5, 0], r: [Math.PI / 2, 0, 0] }));
    g.add(mesh(torus(0.12, 0.035, 8, 22), mat('#4fb8ff', { rough: 0.6 }), { p: [-0.12, 0.54, 0.05], r: [Math.PI / 2, 0.2, 0] }));
    return g;
  },

  gearBox({ seed }) {
    const g = BUILDERS.box({ seed });
    g.add(mesh(plane(0.5, 0.14), mat('#fff', { map: labelTexture('FRAGILE', { color: '#fff', bg: '#c8102e', font: 'bold 70px sans-serif', w: 512, h: 128 }) }), { p: [0, 0.3, 0.311], cast: false }));
    return g;
  },

  recSwitch() {
    const g = group();
    g.add(mesh(cyl(0.36, 0.4, 0.06, 28), mat('#2b2b33', { metal: 0.5, rough: 0.4 }), { p: [0, 0.03, 0], cast: false }));
    g.add(mesh(cyl(0.2, 0.22, 0.08, 24), mat('#c8102e', { emissive: '#ff2030', ei: 0.3, unique: true }), { p: [0, 0.09, 0], name: 'button', cast: false }));
    g.add(mesh(plane(0.36, 0.14), basic('#fff', { map: labelTexture('REC', { color: '#fff', font: 'bold 96px sans-serif', w: 256, h: 128 }) }), { p: [0, 0.135, 0], r: [-Math.PI / 2, 0, 0], cast: false }));
    return g;
  },

  // ── DJ BOOTH ───────────────────────────────────
  turntable() {
    const g = group();
    g.add(mesh(rbox(2.92, 0.08, 2.92, 0.06), mat('#1a1a20', { rough: 0.45, metal: 0.3 }), { p: [0, 0.04, 0], cast: false }));
    const platter = group([], { name: 'platter' });
    platter.add(mesh(cyl(1.4, 1.4, 0.05, 64), [mat('#8a8a96', { metal: 0.8, rough: 0.25 }), mat('#fff', { map: grooveTexture('#b46bff', 512), rough: 0.25, emissive: '#2a1440', ei: 0.6 }), mat('#111')], { p: [0, 0.105, 0], cast: false }));
    platter.add(mesh(torus(1.42, 0.025, 6, 64), basic('#d6a8ff', { toneMapped: false }), { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0], cast: false }));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      platter.add(mesh(box(0.07, 0.015, 0.07), basic(i % 2 ? '#4fb8ff' : '#b46bff', { toneMapped: false }), { p: [Math.cos(a) * 1.46, 0.09, Math.sin(a) * 1.46], cast: false }));
    }
    g.add(platter);
    g.add(mesh(cyl(0.3, 0.34, 0.42, 24), mat('#24242c', { metal: 0.6, rough: 0.3 }), { p: [0, 0.31, 0] }));
    g.add(mesh(cyl(0.24, 0.24, 0.02, 24), mat('#fff', { map: grooveTexture('#ff7136', 128) }), { p: [0, 0.53, 0] }));
    g.add(mesh(cyl(0.04, 0.04, 0.12, 10), mat(METAL, { metal: 0.9, rough: 0.2 }), { p: [0, 0.59, 0] }));
    return g;
  },

  vinylShelf({ seed }) {
    const g = group();
    g.add(mesh(rbox(0.86, 0.78, 0.66, 0.03), mat('#1f1830', { rough: 0.6 }), { p: [0, 0.39, 0] }));
    g.add(mesh(box(0.76, 0.3, 0.02), mat('#fff', { map: spinesTexture(seed + 20) }), { p: [0, 0.22, 0.335], cast: false }));
    g.add(mesh(box(0.76, 0.3, 0.02), mat('#fff', { map: spinesTexture(seed + 21) }), { p: [0, 0.57, 0.335], cast: false }));
    g.add(mesh(box(0.88, 0.02, 0.02), basic('#b46bff', { toneMapped: false }), { p: [0, 0.79, 0.34], cast: false }));
    return g;
  },

  vinylCrate({ seed }) {
    const g = group();
    g.add(mesh(rbox(0.72, 0.44, 0.62, 0.03), mat('#3a2e5a', { rough: 0.7 }), { p: [0, 0.22, 0] }));
    const cols = ['#1c1c22', '#b46bff', '#4fb8ff', '#ff5a8a'];
    for (let i = 0; i < 6; i++) g.add(mesh(box(0.02, 0.5, 0.5), mat(cols[(seed + i) % 4]), { p: [-0.25 + i * 0.1, 0.4, 0], r: [0, 0, 0.15 * Math.sin(seed + i * 1.7)] }));
    return g;
  },

  // ── TERRACE ────────────────────────────────────
  planter({ seed }) {
    const g = group();
    g.add(mesh(rbox(0.84, 0.46, 0.84, 0.05), mat('#6a4a36', { rough: 0.9 }), { p: [0, 0.23, 0] }));
    g.add(mesh(box(0.76, 0.04, 0.76), mat('#3a2a1e'), { p: [0, 0.46, 0] }));
    const greens = [mat('#3f8a4a'), mat('#2f6e3b'), mat('#5aa35a')];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39 + seed;
      const r = 0.12 + (i % 3) * 0.1;
      g.add(mesh(sphere(0.15, 10, 8), greens[i % 3], { p: [Math.cos(a) * r, 0.6 + (i % 2) * 0.1, Math.sin(a) * r], s: [1, 1.3, 1] }));
    }
    const flowers = ['#ff7aa8', '#ffd166', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + seed;
      g.add(mesh(sphere(0.05, 8, 6), mat(flowers[i % 3], { emissive: flowers[i % 3], ei: 0.15 }), { p: [Math.cos(a) * 0.25, 0.8, Math.sin(a) * 0.25] }));
    }
    return g;
  },

  patioTable() {
    const g = group();
    g.add(mesh(cyl(0.4, 0.4, 0.05, 28), mat('#e8e2d6', { rough: 0.4 }), { p: [0, 0.48, 0] }));
    g.add(mesh(cyl(0.04, 0.04, 0.46, 10), mat('#2a2a30', { metal: 0.7 }), { p: [0, 0.24, 0] }));
    g.add(mesh(cyl(0.22, 0.24, 0.03, 20), mat('#2a2a30', { metal: 0.7 }), { p: [0, 0.015, 0] }));
    g.add(mesh(cyl(0.07, 0.08, 0.16, 10, true), mat('#f8f0d8', { emissive: '#ffcf7a', ei: 1.2, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), { p: [0.1, 0.59, 0.05], cast: false }));
    return g;
  },

  chair({ seed }) {
    const g = group();
    const c = mat(seed % 2 ? '#e6e1d8' : '#3d6b7a', { rough: 0.6 });
    g.add(mesh(rbox(0.54, 0.06, 0.52, 0.03), c, { p: [0, 0.38, 0] }));
    g.add(mesh(rbox(0.54, 0.46, 0.06, 0.03), c, { p: [0, 0.62, -0.23], r: [-0.12, 0, 0] }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(cyl(0.025, 0.025, 0.38, 8), mat('#2a2a30', { metal: 0.6 }), { p: [sx * 0.22, 0.19, sz * 0.21] }));
    g.rotation.y = (seed % 4) * 0.4 - 0.6;
    return g;
  },

  flowerPot({ seed }) {
    const g = group();
    g.add(mesh(cyl(0.26, 0.19, 0.38, 16), mat('#c06b44', { rough: 0.9 }), { p: [0, 0.19, 0] }));
    g.add(mesh(cyl(0.28, 0.28, 0.06, 16), mat('#a85a38'), { p: [0, 0.38, 0] }));
    const cols = ['#ff7aa8', '#ffd166', '#b46bff', '#ff5a4f'];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + seed;
      g.add(mesh(sphere(0.12, 8, 6), mat('#3f8a4a'), { p: [Math.cos(a) * 0.12, 0.48, Math.sin(a) * 0.12] }));
      g.add(mesh(sphere(0.07, 8, 6), mat(cols[(seed + i) % 4], { emissive: cols[(seed + i) % 4], ei: 0.12 }), { p: [Math.cos(a) * 0.15, 0.6, Math.sin(a) * 0.15] }));
    }
    return g;
  },

  crate() {
    const g = group();
    const wood = mat('#b0814f', { rough: 0.9 });
    g.add(mesh(rbox(0.74, 0.62, 0.68, 0.03), wood, { p: [0, 0.31, 0] }));
    const dark = mat('#7a5530');
    for (const z of [0.345, -0.345]) {
      g.add(mesh(box(0.74, 0.08, 0.02), dark, { p: [0, 0.08, z] }));
      g.add(mesh(box(0.74, 0.08, 0.02), dark, { p: [0, 0.54, z] }));
      g.add(mesh(box(0.08, 0.62, 0.02), dark, { p: [0, 0.31, z], r: [0, 0, 0.72] }));
    }
    return g;
  },

  // ── LOCKED ROOM ────────────────────────────────
  cabinet({ w, d, face }) {
    const W = w - 0.1;
    const D = d - 0.1;
    const g = group();
    g.add(mesh(rbox(W, 0.92, D, 0.04), mat('#5a3a26', { rough: 0.7 }), { p: [0, 0.48, 0] }));
    g.add(mesh(box(W + 0.06, 0.06, D + 0.06), mat('#3e2618'), { p: [0, 0.96, 0] }));
    const n = Math.max(1, Math.round(Math.max(W, D)));
    const front = face.z >= 0 ? 1 : -1;
    const alongX = W >= D;
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < 3; r++) {
        const off = -((alongX ? W : D) / 2) + (i + 0.5) * ((alongX ? W : D) / n);
        const p = alongX ? [off, 0.2 + r * 0.26, front * (D / 2 + 0.01)] : [front * (W / 2 + 0.01), 0.2 + r * 0.26, off];
        g.add(mesh(box(alongX ? 0.8 : 0.02, 0.2, alongX ? 0.02 : 0.8), mat('#6b4630'), { p, cast: false }));
        const hp = alongX ? [off, 0.2 + r * 0.26, front * (D / 2 + 0.04)] : [front * (W / 2 + 0.04), 0.2 + r * 0.26, off];
        g.add(mesh(sphere(0.03, 8, 6), mat('#d9a441', { metal: 0.9, rough: 0.3 }), { p: hp }));
      }
    }
    return g;
  },

  coveredFurniture({ seed }) {
    const g = group();
    const cloth = mat('#e3ddd0', { rough: 1 });
    g.add(mesh(rbox(0.8, 0.62, 0.74, 0.18, 4), cloth, { p: [0, 0.31, 0] }));
    g.add(mesh(sphere(0.3, 14, 10), cloth, { p: [0.12 * Math.sin(seed), 0.66, -0.05], s: [1.2, 0.6, 1] }));
    g.add(mesh(cone(0.48, 0.3, 14), cloth, { p: [0, 0.12, 0], s: [1, 1, 0.92] }));
    return g;
  },

  oldAudio() {
    const g = group();
    g.add(mesh(rbox(0.8, 0.72, 0.56, 0.05), mat('#6b4a2e', { rough: 0.6 }), { p: [0, 0.36, 0] }));
    g.add(mesh(box(0.66, 0.36, 0.02), mat('#d8c9a8', { rough: 0.9 }), { p: [0, 0.44, 0.285] }));
    for (const x of [-0.17, 0.17]) {
      g.add(mesh(cyl(0.13, 0.13, 0.03, 24), mat('#2a2a30', { metal: 0.5 }), { p: [x, 0.46, 0.3], r: [Math.PI / 2, 0, 0] }));
      g.add(mesh(cyl(0.04, 0.04, 0.05, 10), mat(METAL, { metal: 0.8 }), { p: [x, 0.46, 0.31], r: [Math.PI / 2, 0, 0] }));
    }
    for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.03, 0.03, 0.04, 8), mat('#d9a441', { metal: 0.7 }), { p: [-0.22 + i * 0.15, 0.15, 0.3], r: [Math.PI / 2, 0, 0] }));
    g.add(mesh(box(0.1, 0.04, 0.02), basic('#ffb35c', { toneMapped: false }), { p: [0.28, 0.15, 0.29], cast: false }));
    return g;
  },

  box({ seed = 0 }) {
    const g = group();
    g.add(mesh(rbox(0.72, 0.6, 0.62, 0.03), mat(seed % 2 ? CARD : '#b8895a', { rough: 0.95 }), { p: [0, 0.3, 0] }));
    g.add(mesh(box(0.74, 0.04, 0.14), mat('#d8c39a', { rough: 0.6 }), { p: [0, 0.6, 0] }));
    g.add(mesh(box(0.14, 0.4, 0.64), mat('#d8c39a', { rough: 0.6 }), { p: [0, 0.4, 0], s: [1, 1, 1.0] }));
    return g;
  },

  door() {
    const g = group();
    const frame = mat('#3e2618', { rough: 0.7 });
    g.add(mesh(box(0.1, 1.0, 0.24), frame, { p: [-0.45, 0.5, 0] }));
    g.add(mesh(box(0.1, 1.0, 0.24), frame, { p: [0.45, 0.5, 0] }));
    g.add(mesh(box(1.0, 0.1, 0.24), frame, { p: [0, 1.0, 0] }));
    const panel = group([], { name: 'doorPanel', p: [-0.4, 0, 0] });
    panel.add(mesh(rbox(0.8, 0.9, 0.08, 0.02), mat('#7a4e30', { rough: 0.6 }), { p: [0.4, 0.46, 0] }));
    panel.add(mesh(box(0.6, 0.3, 0.02), mat('#6b4630'), { p: [0.4, 0.65, 0.05], cast: false }));
    panel.add(mesh(box(0.6, 0.3, 0.02), mat('#6b4630'), { p: [0.4, 0.27, 0.05], cast: false }));
    panel.add(mesh(sphere(0.04, 8, 6), mat('#d9a441', { metal: 0.9, rough: 0.2 }), { p: [0.7, 0.46, 0.07] }));
    g.add(panel);
    return g;
  },

  lever() {
    const g = group();
    g.add(mesh(rbox(0.5, 0.12, 0.4, 0.03), mat('#3a3a44', { metal: 0.6, rough: 0.4 }), { p: [0, 0.06, 0], cast: false }));
    const arm = group([], { name: 'leverArm', p: [0, 0.12, 0] });
    arm.add(mesh(cyl(0.025, 0.025, 0.5, 8), mat(METAL, { metal: 0.9, rough: 0.2 }), { p: [0, 0.25, 0] }));
    arm.add(mesh(sphere(0.07, 12, 10), mat('#c8102e', { rough: 0.3 }), { p: [0, 0.52, 0] }));
    arm.rotation.z = 0.6;
    g.add(arm);
    return g;
  },
};

// 그 외 알 수 없는 prop → 상자
export function buildProp(kind, ctx) {
  const fn = BUILDERS[kind] || BUILDERS.box;
  const g = fn({ w: 1, d: 1, face: { x: 0, z: 1 }, theme: {}, seed: 0, ...ctx });
  if (ctx.merge !== false) mergeStatic(g);
  g.userData.prop = kind;
  return g;
}

// 정적 메쉬를 머티리얼별로 병합해 드로우콜 감소 (이름 있는 애니메이션 파트는 유지)
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.transparent) return;
    let p = o;
    while (p && p !== root) {
      if (p.name) return;
      p = p.parent;
    }
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}`;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) return;
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    buckets.get(key).geos.push(geo);
    victims.push(o);
  });
  if (victims.length < 3) return;
  for (const v of victims) v.removeFromParent();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast;
    m.receiveShadow = true;
    root.add(m);
  }
}

export const PROP_KINDS = Object.keys(BUILDERS);
