import * as THREE from 'three';
import { rbox, box, cyl, sphere, torus, cone, capsule, mat, mesh, group } from '../kit.js';
import { grooveTexture, plaidTexture } from '../textures.js';

// ─────────────────────────────────────────────────────────────
// 3D Placeholder — GLB(assets/characters/...)가 없을 때만 사용.
// ODD HAUS 원본 캐릭터의 실루엣 / 색 / 핵심 소품을 따른다 (임의 redesign 금지).
// 최종 GLB 가 들어오면 자동으로 교체된다. 2D Sprite 대체는 하지 않는다.
//
// 반환 rig: { root, body, head?, armL, armR, legL, legR, tail?, cape?, prop? }
//   root: 발 기준 원점, +z 정면
// ─────────────────────────────────────────────────────────────

const WHITE = '#fbfbf7';
const BLACK = '#121216';

function eye(r = 0.1, { pupil = BLACK, iris = null, angry = 0, look = 0.35, brow = 1, lid = null } = {}) {
  const g = group();
  g.add(mesh(sphere(r, 18, 14), mat(WHITE, { rough: 0.25 }), { s: [0.85, 1.1, 0.6], cast: false }));
  if (iris) g.add(mesh(sphere(r * 0.55, 14, 10), mat(iris, { rough: 0.3 }), { p: [0, -r * 0.05, r * look * 1.2], s: [1, 1, 0.5], cast: false }));
  g.add(mesh(sphere(r * 0.42, 14, 10), mat(pupil, { rough: 0.2 }), { p: [0, -r * (lid ? 0.22 : 0.08), r * (look + 0.18)], s: [1, 1.15, 0.5], cast: false }));
  if (!lid) g.add(mesh(sphere(r * 0.13, 8, 6), mat('#ffffff', { emissive: '#ffffff', ei: 0.5 }), { p: [r * 0.15, r * 0.2, r * 0.62], cast: false }));
  // 졸린 눈꺼풀 (위쪽 절반을 덮는다)
  if (lid) g.add(mesh(sphere(r * 1.04, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(lid, { rough: 0.4 }), { s: [0.88, 1.12, 0.64], r: [0.22, 0, 0], cast: false }));
  if (angry) g.add(mesh(box(r * 2.0 * brow, r * 0.32 * brow, r * 0.3), mat(BLACK), { p: [0, r * (1.0 + 0.08 * brow), r * 0.3], r: [0, 0, angry], cast: false }));
  return g;
}

function glove(color = WHITE, s = 1) {
  const g = group();
  g.add(mesh(sphere(0.075 * s, 14, 10), mat(color, { rough: 0.5 }), { s: [1, 0.9, 0.85] }));
  g.add(mesh(sphere(0.035 * s, 10, 8), mat(color, { rough: 0.5 }), { p: [0.05 * s, 0.03 * s, 0.02 * s] }));
  g.add(mesh(torus(0.05 * s, 0.018 * s, 6, 16), mat(color, { rough: 0.5 }), { p: [0, 0.06 * s, 0], r: [Math.PI / 2, 0, 0] }));
  return g;
}

function sneaker(color = '#e63b2e', sole = WHITE, s = 1) {
  const g = group();
  g.add(mesh(rbox(0.13 * s, 0.08 * s, 0.2 * s, 0.035 * s), mat(color, { rough: 0.5 }), { p: [0, 0.05 * s, 0.03 * s] }));
  g.add(mesh(rbox(0.14 * s, 0.035 * s, 0.22 * s, 0.015 * s), mat(sole, { rough: 0.6 }), { p: [0, 0.018 * s, 0.035 * s] }));
  g.add(mesh(box(0.1 * s, 0.012 * s, 0.05 * s), mat(sole), { p: [0, 0.092 * s, 0.05 * s], cast: false }));
  return g;
}

// 엉덩이 관절에서 내려오는 다리 (pivot 회전으로 걷기)
function leg(x, hipY, len, r, color, shoe) {
  const pivot = group([], { p: [x, hipY, 0] });
  pivot.add(mesh(cyl(r, r, len, 10), mat(color, { rough: 0.6 }), { p: [0, -len / 2, 0] }));
  shoe.position.set(0, -len - 0.02, 0);
  pivot.add(shoe);
  return pivot;
}

// 어깨 관절에서 내려오는 팔
function arm(x, shoulderY, len, r, color, hand, side) {
  const pivot = group([], { p: [x, shoulderY, 0] });
  pivot.add(mesh(cyl(r, r, len, 8), mat(color, { rough: 0.6 }), { p: [side * 0.02, -len / 2, 0], r: [0, 0, side * 0.12] }));
  hand.position.set(side * 0.05, -len - 0.02, 0.01);
  pivot.add(hand);
  pivot.rotation.z = side * 0.35;
  return pivot;
}

function smile(w = 0.08, y = 0, z = 0, color = BLACK, thick = 0.012) {
  return mesh(torus(w, thick, 6, 16, Math.PI * 0.8), mat(color, { rough: 0.4 }), { p: [0, y, z], r: [0, 0, Math.PI * 1.1], cast: false });
}

function rig(root, body, extra = {}) {
  root.add(body);
  return { root, body, ...extra };
}

// ── VIN : 큰 눈의 검은 LP 레코드 (v4: 두꺼운 몸 · 빛에 보이는 홈 · 큰 빨간 신발) ──
function buildVin() {
  const root = group();
  const hipY = 0.32;
  const body = group([], { p: [0, hipY, 0] });
  const front = mat('#ffffff', { map: grooveTexture('#2a2a30', 512), rough: 0.18, metal: 0.45 });
  const back = mat('#ffffff', { map: grooveTexture('#ff5a4f', 512), rough: 0.18, metal: 0.45 });
  body.add(mesh(cyl(0.36, 0.36, 0.17, 56), [mat('#0c0c10', { rough: 0.25, metal: 0.4 }), front, back], { p: [0, 0.36, 0], r: [Math.PI / 2, 0, 0] }));
  for (const z of [-0.085, 0.085]) body.add(mesh(torus(0.355, 0.016, 8, 56), mat('#2b2b33', { metal: 0.6, rough: 0.25 }), { p: [0, 0.36, z], cast: false }));
  const head = group([], { p: [0, 0.36, 0.09] });
  const eL = eye(0.125, { look: 0.3 });
  const eR = eye(0.125, { look: 0.3 });
  eL.position.set(-0.105, 0.095, 0.02);
  eR.position.set(0.105, 0.095, 0.02);
  head.add(eL, eR);
  head.add(smile(0.06, -0.095, 0.03, '#e8e8e8', 0.011));
  body.add(head);
  const armL = arm(-0.32, 0.4, 0.2, 0.022, BLACK, glove(), -1);
  const armR = arm(0.32, 0.4, 0.2, 0.022, BLACK, glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.11, hipY + 0.02, 0.2, 0.024, BLACK, sneaker('#e63b2e', WHITE, 1.4));
  const legR = leg(0.11, hipY + 0.02, 0.2, 0.024, BLACK, sneaker('#e63b2e', WHITE, 1.4));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, spinPart: body.children[0] });
}

// ── PICKER : 화난 눈의 빨간 기타 피크 (v4: 더 긴 아래 끝 · 넓은 윗면 · 큰 반창고 · 진한 눈썹) ──
function pickShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.47);
  s.quadraticCurveTo(0.15, -0.24, 0.35, 0.1);
  s.quadraticCurveTo(0.43, 0.31, 0.2, 0.37);
  s.quadraticCurveTo(0, 0.41, -0.2, 0.37);
  s.quadraticCurveTo(-0.43, 0.31, -0.35, 0.1);
  s.quadraticCurveTo(-0.15, -0.24, 0, -0.47);
  return s;
}
let pickGeo = null;
function buildPicker() {
  const root = group();
  const hipY = 0.28;
  const body = group([], { p: [0, hipY, 0] });
  if (!pickGeo) {
    pickGeo = new THREE.ExtrudeGeometry(pickShape(), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 18 });
    pickGeo.translate(0, 0, -0.04);
  }
  body.add(mesh(pickGeo, mat('#e2261f', { rough: 0.22, metal: 0.05 }), { p: [0, 0.46, 0] }));
  // 큰 반창고 (오른쪽 위)
  const band = group([], { p: [0.19, 0.72, 0.088], r: [0, 0, 0.55] });
  band.add(mesh(rbox(0.3, 0.09, 0.016, 0.025), mat('#f7e7cf', { rough: 0.8 }), { cast: false }));
  band.add(mesh(rbox(0.3, 0.09, 0.014, 0.025), mat('#f2dcc0', { rough: 0.8 }), { r: [0, 0, -1.1], p: [0, 0, -0.002], cast: false }));
  band.add(mesh(rbox(0.09, 0.085, 0.02, 0.01), mat('#e3bf98', { rough: 0.9 }), { cast: false }));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) band.add(mesh(sphere(0.006, 4, 3), mat('#c9a07a'), { p: [sx * 0.012, sy * 0.012, 0.012], cast: false }));
  body.add(band);
  const head = group([], { p: [0, 0.52, 0.08] });
  const eL = eye(0.1, { angry: -0.55, look: 0.3, brow: 1.45 });
  const eR = eye(0.1, { angry: 0.55, look: 0.3, brow: 1.45 });
  eL.position.set(-0.105, 0.06, 0);
  eR.position.set(0.105, 0.06, 0);
  head.add(eL, eR);
  head.add(mesh(torus(0.05, 0.013, 6, 14, Math.PI * 0.8), mat(BLACK), { p: [0, -0.11, 0.02], r: [0, 0, Math.PI * 0.1], cast: false }));
  body.add(head);
  const armL = arm(-0.33, 0.5, 0.18, 0.02, BLACK, glove(), -1);
  const armR = arm(0.33, 0.5, 0.18, 0.02, BLACK, glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.09, hipY + 0.03, 0.2, 0.022, BLACK, sneaker('#f2f2f2', '#e2261f'));
  const legR = leg(0.09, hipY + 0.03, 0.2, 0.022, BLACK, sneaker('#f2f2f2', '#e2261f'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR });
}

// ── A.A. : 비니를 쓴 노란 배터리 (v4: 큰 금속 캡 · 빵빵한 비니 · 선명한 노랑/파랑 · 충전 LED · 졸린 눈) ──
function boltShape() {
  const s = new THREE.Shape();
  s.moveTo(0.02, 0.09);
  s.lineTo(-0.05, -0.005);
  s.lineTo(0.0, -0.005);
  s.lineTo(-0.025, -0.09);
  s.lineTo(0.055, 0.02);
  s.lineTo(0.005, 0.02);
  s.closePath();
  return s;
}
let boltGeo = null;
function buildAA() {
  const root = group();
  const hipY = 0.24;
  const body = group([], { p: [0, hipY, 0] });
  const yellow = '#ffd000';
  const metal = mat('#e8c25a', { metal: 0.9, rough: 0.22 });
  body.add(mesh(capsule(0.25, 0.3, 10, 24), mat(yellow, { rough: 0.3 }), { p: [0, 0.4, 0] }));
  body.add(mesh(cyl(0.259, 0.259, 0.18, 32), mat('#1f5fff', { rough: 0.35 }), { p: [0, 0.22, 0] }));
  // 큰 금속 캡 (아래 / 위 테두리)
  body.add(mesh(cyl(0.21, 0.24, 0.07, 32), metal, { p: [0, 0.02, 0] }));
  body.add(mesh(torus(0.245, 0.03, 8, 32), metal, { p: [0, 0.6, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  if (!boltGeo) boltGeo = new THREE.ExtrudeGeometry(boltShape(), { depth: 0.02, bevelEnabled: false });
  body.add(mesh(boltGeo, mat('#ffe14a', { emissive: '#ffb000', ei: 0.5 }), { p: [-0.05, 0.22, 0.252], s: 1.15, cast: false }));
  // 작은 충전 LED
  for (let i = 0; i < 3; i++) body.add(mesh(box(0.025, 0.05, 0.012), mat(i < 2 ? '#6ee36e' : '#2a4a2a', { emissive: i < 2 ? '#3aff6a' : '#000000', ei: 1.4 }), { p: [0.08 + i * 0.034, 0.22, 0.258], cast: false, name: i === 1 ? 'led' : undefined }));
  // 빵빵한 비니
  const beanie = group([], { p: [0, 0.62, 0], s: [1.1, 1.08, 1.1] });
  beanie.add(mesh(sphere(0.262, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat('#1d1d24', { rough: 0.95 }), { s: [1, 0.95, 1] }));
  beanie.add(mesh(torus(0.252, 0.07, 10, 28), mat('#2a2a33', { rough: 0.95 }), { p: [0, 0.01, 0], r: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    beanie.add(mesh(box(0.02, 0.1, 0.02), mat('#22222a', { rough: 1 }), { p: [Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.3], r: [0, -a, 0], cast: false }));
  }
  beanie.add(mesh(sphere(0.09, 12, 10), mat('#2a2a33', { rough: 1 }), { p: [0, 0.26, 0] }));
  body.add(beanie);
  const head = group([], { p: [0, 0.46, 0.2] });
  const eL = eye(0.088, { look: 0.3, lid: yellow });
  const eR = eye(0.088, { look: 0.3, lid: yellow });
  eL.position.set(-0.088, 0.02, 0);
  eR.position.set(0.088, 0.02, 0);
  head.add(eL, eR);
  head.add(mesh(torus(0.04, 0.011, 6, 14, Math.PI * 0.6), mat(BLACK), { p: [0.02, -0.08, 0.03], r: [0, 0, Math.PI * 1.25], cast: false }));
  body.add(head);
  const armL = arm(-0.26, 0.38, 0.16, 0.022, '#e0b010', glove(), -1);
  const armR = arm(0.26, 0.38, 0.16, 0.022, '#e0b010', glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.1, hipY + 0.04, 0.17, 0.024, '#c99a10', sneaker('#1f5fff'));
  const legR = leg(0.1, hipY + 0.04, 0.17, 0.024, '#c99a10', sneaker('#1f5fff'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR });
}

// ── LOCKE : 열쇠 머리 + 모자 (v4: 과장된 톱니 · 긴 몸통 · 초록 재킷 · 배낭 · 오래된 황동) ──
function buildLocke() {
  const root = group();
  const hipY = 0.26;
  const body = group([], { p: [0, hipY, 0] });
  const brass = mat('#c49a52', { rough: 0.42, metal: 0.55 });
  const patina = mat('#6b8a6a', { rough: 0.9 });
  // 긴 열쇠 몸통(shaft) + 과장된 톱니
  body.add(mesh(rbox(0.19, 0.46, 0.12, 0.04), brass, { p: [0, 0.23, 0] }));
  body.add(mesh(box(0.14, 0.08, 0.1), brass, { p: [0.15, 0.05, 0] }));
  body.add(mesh(box(0.09, 0.06, 0.1), brass, { p: [0.13, 0.14, 0] }));
  body.add(mesh(box(0.12, 0.07, 0.1), brass, { p: [0.14, 0.23, 0] }));
  body.add(mesh(sphere(0.025, 6, 4), patina, { p: [-0.06, 0.12, 0.06], s: [1.4, 1, 0.3], cast: false }));
  // 초록 재킷 (윗몸통) + 칼라
  const jacket = mat('#3f6b3a', { rough: 0.85 });
  body.add(mesh(rbox(0.3, 0.2, 0.18, 0.06), jacket, { p: [0, 0.4, 0] }));
  body.add(mesh(box(0.02, 0.18, 0.01), mat('#2a4a28'), { p: [0, 0.4, 0.091], cast: false }));
  for (const sx of [-1, 1]) body.add(mesh(box(0.08, 0.06, 0.02), mat('#4f8a48', { rough: 0.85 }), { p: [sx * 0.06, 0.49, 0.09], r: [0, 0, sx * 0.5], cast: false }));
  // 작은 배낭
  const pack = group([], { p: [0, 0.38, -0.14] });
  pack.add(mesh(rbox(0.22, 0.24, 0.1, 0.04), mat('#7a5230', { rough: 0.9 }), {}));
  pack.add(mesh(rbox(0.18, 0.08, 0.04, 0.02), mat('#6b4423', { rough: 0.9 }), { p: [0, -0.04, -0.06] }));
  for (const sx of [-1, 1]) body.add(mesh(box(0.025, 0.2, 0.2), mat('#5a3a1c'), { p: [sx * 0.1, 0.4, -0.02], cast: false }));
  body.add(pack);
  // 열쇠 머리(bow) = 얼굴
  const head = group([], { p: [0, 0.68, 0] });
  head.add(mesh(cyl(0.25, 0.25, 0.13, 40), brass, { r: [Math.PI / 2, 0, 0] }));
  head.add(mesh(torus(0.25, 0.025, 8, 40), mat('#a8823f', { metal: 0.6, rough: 0.4 }), { cast: false }));
  head.add(mesh(sphere(0.03, 6, 4), patina, { p: [0.17, 0.12, 0.066], s: [1.6, 1, 0.2], cast: false }));
  const eL = eye(0.085, { look: 0.3 });
  const eR = eye(0.085, { look: 0.3 });
  eL.position.set(-0.085, 0.02, 0.07);
  eR.position.set(0.085, 0.02, 0.07);
  head.add(eL, eR);
  head.add(mesh(torus(0.035, 0.01, 6, 14, Math.PI * 0.7), mat(BLACK), { p: [0, -0.1, 0.07], r: [0, 0, Math.PI * 1.15], cast: false }));
  // 작은 모자
  const hat = group([], { p: [0, 0.2, 0], s: 0.85 });
  hat.add(mesh(sphere(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6b4423', { rough: 0.8 }), { s: [1.05, 0.75, 1] }));
  hat.add(mesh(cyl(0.27, 0.27, 0.025, 28), mat('#5a381c', { rough: 0.8 }), { p: [0, 0.0, 0.03] }));
  hat.add(mesh(cyl(0.205, 0.205, 0.04, 28), mat('#b8302a', { rough: 0.7 }), { p: [0, 0.03, 0] }));
  head.add(hat);
  body.add(head);
  const armL = arm(-0.16, 0.46, 0.18, 0.024, '#3f6b3a', glove(), -1);
  const armR = arm(0.16, 0.46, 0.18, 0.024, '#3f6b3a', glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.07, hipY + 0.02, 0.2, 0.024, '#5a3a1c', sneaker('#6b4423', '#f2e6c9'));
  const legR = leg(0.07, hipY + 0.02, 0.2, 0.024, '#5a3a1c', sneaker('#6b4423', '#f2e6c9'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, hat });
}

// ── REX : 나무 + 금 체스 킹 (v4: 넓은 받침 · 큰 왕관/망토 · 작은 신발) ─────────
let rexLathe = null;
function buildRex() {
  const root = group();
  const hipY = 0.16;
  const body = group([], { p: [0, hipY, 0] });
  if (!rexLathe) {
    const pts = [
      [0.0, 0],
      [0.31, 0],
      [0.32, 0.05],
      [0.25, 0.1],
      [0.18, 0.22],
      [0.15, 0.36],
      [0.2, 0.42],
      [0.16, 0.46],
      [0.21, 0.58],
      [0.22, 0.68],
      [0.18, 0.76],
      [0.0, 0.78],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    rexLathe = new THREE.LatheGeometry(pts, 36);
  }
  const wood = mat('#9a6034', { rough: 0.55 });
  const gold = mat('#f2c14e', { metal: 0.35, rough: 0.3, emissive: '#5a3a00', ei: 0.5 });
  body.add(mesh(rexLathe, wood, {}));
  body.add(mesh(torus(0.29, 0.022, 8, 36), gold, { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  body.add(mesh(torus(0.195, 0.018, 8, 36), gold, { p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0], cast: false }));
  // 큰 망토 (움직임)
  const cape = group([], { p: [0, 0.46, -0.02] });
  cape.add(mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.6, 28, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat('#b3122a', { rough: 0.7, side: THREE.DoubleSide }), { p: [0, -0.26, 0] }));
  cape.add(mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.04, 28, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat('#f2c14e', { metal: 0.6, rough: 0.4, side: THREE.DoubleSide }), { p: [0, -0.56, 0], cast: false }));
  cape.add(mesh(torus(0.2, 0.07, 10, 24), mat('#f8f6f0', { rough: 1 }), { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    cape.add(mesh(sphere(0.016, 6, 5), mat(BLACK), { p: [Math.cos(a) * 0.22, 0.07, Math.sin(a) * 0.22], cast: false }));
  }
  body.add(cape);
  // 큰 왕관
  const crown = group([], { p: [0, 0.8, 0], s: 1.32 });
  crown.add(mesh(cyl(0.15, 0.16, 0.1, 24, true), mat('#f2c14e', { metal: 0.35, rough: 0.3, emissive: '#5a3a00', ei: 0.5, side: THREE.DoubleSide }), { p: [0, 0.05, 0] }));
  crown.add(mesh(cyl(0.148, 0.148, 0.02, 24), mat('#b3122a', { rough: 0.8 }), { p: [0, 0.03, 0] }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crown.add(mesh(cone(0.035, 0.1, 8), gold, { p: [Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14] }));
    crown.add(mesh(sphere(0.02, 8, 6), mat('#ff2e4a', { emissive: '#ff2e4a', ei: 0.3 }), { p: [Math.cos(a) * 0.155, 0.05, Math.sin(a) * 0.155], cast: false }));
  }
  crown.add(mesh(sphere(0.03, 8, 6), mat('#2e7bff', { emissive: '#2e7bff', ei: 0.3 }), { p: [0, 0.07, 0.16], cast: false }));
  crown.add(mesh(box(0.02, 0.09, 0.02), gold, { p: [0, 0.2, 0] }));
  crown.add(mesh(box(0.07, 0.02, 0.02), gold, { p: [0, 0.22, 0] }));
  body.add(crown);
  const head = group([], { p: [0, 0.62, 0.18] });
  const eL = eye(0.072, { look: 0.3 });
  const eR = eye(0.072, { look: 0.3 });
  eL.position.set(-0.072, 0.02, 0);
  eR.position.set(0.072, 0.02, 0);
  head.add(eL, eR);
  head.add(smile(0.04, -0.06, 0.02));
  body.add(head);
  const armL = arm(-0.18, 0.44, 0.14, 0.02, '#7a4a28', glove(), -1);
  const scepter = group([], { p: [0, -0.02, 0.04] });
  scepter.add(mesh(cyl(0.014, 0.014, 0.42, 8), gold, { p: [0, 0.12, 0] }));
  scepter.add(mesh(sphere(0.045, 10, 8), mat('#ff2e4a', { emissive: '#ff2e4a', ei: 0.25 }), { p: [0, 0.34, 0] }));
  const handR = glove();
  handR.add(scepter);
  const armR = arm(0.18, 0.44, 0.14, 0.02, '#7a4a28', handR, 1);
  body.add(armL, armR);
  const legL = leg(-0.08, hipY + 0.01, 0.1, 0.025, '#7a4a28', sneaker('#b3122a', '#f2c14e', 0.7));
  const legR = leg(0.08, hipY + 0.01, 0.1, 0.025, '#7a4a28', sneaker('#b3122a', '#f2c14e', 0.7));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, cape, crown });
}

// ── BUDDY : 크림색 장모 강아지 (v4: 두툼한 털 뭉치 · 큰 파랑/노랑 넥타이 · 이름표) ──
function buildBuddy() {
  const root = group();
  const hipY = 0.16;
  const body = group([], { p: [0, hipY, 0] });
  const fur = mat('#f1e4c8', { rough: 1 });
  const fur2 = mat('#e2c79a', { rough: 1 });
  const brown = mat('#b07a45', { rough: 1 });
  body.add(mesh(sphere(0.26, 18, 14), fur, { p: [0, 0.2, -0.02], s: [0.9, 0.8, 1.15] }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    body.add(mesh(sphere(0.11, 10, 8), i % 2 ? fur : fur2, { p: [Math.cos(a) * 0.21, 0.12 + (i % 2) * 0.07, Math.sin(a) * 0.25] }));
  }
  // 가슴 털 뭉치
  for (let i = 0; i < 4; i++) body.add(mesh(sphere(0.075, 10, 8), fur, { p: [(i - 1.5) * 0.07, 0.24 - (i % 2) * 0.04, 0.24] }));
  // 큰 파랑/노랑 넥타이 + 이름표
  const tie = group([], { p: [0, 0.2, 0.37], r: [-0.75, 0, 0], s: 1.35 });
  tie.add(mesh(rbox(0.08, 0.06, 0.04, 0.015), mat('#1f4fae', { rough: 0.5 }), {}));
  tie.add(mesh(cone(0.07, 0.2, 4), mat('#1f4fae', { rough: 0.5 }), { p: [0, -0.13, 0], r: [Math.PI, Math.PI / 4, 0], s: [1, 1, 0.35] }));
  for (let i = 0; i < 3; i++) tie.add(mesh(box(0.1 - i * 0.02, 0.018, 0.04), mat('#ffd23f', { rough: 0.5 }), { p: [0, -0.07 - i * 0.05, 0.004], r: [0, 0, 0.4], cast: false }));
  body.add(tie);
  body.add(mesh(torus(0.17, 0.025, 6, 24), mat('#1f4fae', { rough: 0.5 }), { p: [0, 0.32, 0.12], r: [Math.PI / 2 + 0.3, 0, 0], cast: false }));
  body.add(mesh(cyl(0.045, 0.045, 0.014, 16), mat('#f2c14e', { metal: 0.35, rough: 0.3, emissive: '#5a3a00', ei: 0.5 }), { p: [0.12, 0.2, 0.34], r: [Math.PI / 2 - 0.7, 0, 0], cast: false }));
  const head = group([], { p: [0, 0.44, 0.18] });
  head.add(mesh(sphere(0.21, 18, 14), fur, { s: [1.05, 0.95, 0.95] }));
  head.add(mesh(sphere(0.12, 12, 10), brown, { p: [-0.1, 0.1, 0.05], s: [1, 0.8, 0.6] }));
  head.add(mesh(sphere(0.1, 14, 10), mat('#f8f0de', { rough: 1 }), { p: [0, -0.05, 0.16], s: [1.2, 0.85, 0.9] }));
  head.add(mesh(sphere(0.04, 10, 8), mat(BLACK, { rough: 0.2 }), { p: [0, -0.01, 0.25] }));
  head.add(mesh(sphere(0.03, 8, 6), mat('#e86a7a'), { p: [0, -0.1, 0.22], s: [1, 0.6, 1], cast: false }));
  for (const s of [-1, 1]) {
    head.add(mesh(sphere(0.045, 12, 10), mat('#2a1c14', { rough: 0.15 }), { p: [s * 0.085, 0.05, 0.17], cast: false }));
    head.add(mesh(sphere(0.012, 6, 5), mat('#fff', { emissive: '#fff', ei: 0.6 }), { p: [s * 0.085 + 0.012, 0.065, 0.21], cast: false }));
    // 털 뭉치 귀 (뭉치 3개)
    for (let k = 0; k < 3; k++) head.add(mesh(sphere(0.085 - k * 0.012, 10, 8), k % 2 ? fur2 : brown, { p: [s * (0.2 + k * 0.02), 0.02 - k * 0.08, -0.02], s: [0.7, 1.05, 0.85] }));
    // 볼 털
    head.add(mesh(sphere(0.07, 10, 8), fur, { p: [s * 0.15, -0.09, 0.08] }));
  }
  head.add(mesh(sphere(0.07, 10, 8), fur2, { p: [0, 0.21, 0.02] }));
  head.add(mesh(sphere(0.05, 10, 8), fur, { p: [0.06, 0.22, 0.06] }));
  body.add(head);
  // 두툼한 꼬리
  const tail = group([], { p: [0, 0.28, -0.28] });
  for (let k = 0; k < 3; k++) tail.add(mesh(sphere(0.08 - k * 0.012, 10, 8), k % 2 ? fur : fur2, { p: [0, 0.04 + k * 0.07, -0.02 - k * 0.04] }));
  body.add(tail);
  // 다리 4개 (앞다리 = arm 으로 취급)
  const paw = () => group([mesh(sphere(0.06, 10, 8), fur2, { s: [1, 0.7, 1.2] })]);
  const armL = leg(-0.11, 0.1, 0.1, 0.048, '#efe0c0', paw());
  armL.position.z = 0.14;
  const armR = leg(0.11, 0.1, 0.1, 0.048, '#efe0c0', paw());
  armR.position.z = 0.14;
  body.add(armL, armR);
  const legL = leg(-0.11, hipY + 0.06, 0.12, 0.048, '#efe0c0', paw());
  legL.position.z = -0.14;
  const legR = leg(0.11, hipY + 0.06, 0.12, 0.048, '#efe0c0', paw());
  legR.position.z = -0.14;
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, tail, quadruped: true });
}

// ── BULLY : 뒤로 쓴 검은 모자 + 금발 + 큰 빨간 기타 (v4: 검은 티 · 카키 바지 · 3색 대비) ──
function buildBully() {
  const root = group();
  const hipY = 0.3;
  const body = group([], { p: [0, hipY, 0] });
  const skin = mat('#f4c9a1', { rough: 0.6 });
  body.add(mesh(rbox(0.34, 0.3, 0.22, 0.08), mat('#1b1b20', { rough: 0.85 }), { p: [0, 0.16, 0] }));
  // 해골 프린트
  body.add(mesh(sphere(0.045, 10, 8), mat('#f2f2f2', { rough: 0.8 }), { p: [-0.06, 0.2, 0.108], s: [1, 1, 0.3], cast: false }));
  body.add(mesh(box(0.05, 0.025, 0.01), mat('#f2f2f2'), { p: [-0.06, 0.155, 0.11], cast: false }));
  for (const sx of [-1, 1]) body.add(mesh(sphere(0.011, 6, 4), mat(BLACK), { p: [-0.06 + sx * 0.017, 0.205, 0.123], cast: false }));
  const head = group([], { p: [0, 0.52, 0.02] });
  head.add(mesh(sphere(0.2, 20, 16), skin, { s: [1, 0.95, 0.95] }));
  // 뒤로 과장된 금발
  const hair = mat('#f2c14e', { rough: 0.8 });
  for (let i = 0; i < 9; i++) {
    const a = -1.3 + i * 0.33;
    head.add(mesh(cone(0.06, 0.26, 6), hair, { p: [Math.sin(a) * 0.17, 0.08 + Math.cos(a) * 0.03, -0.1 + Math.cos(a) * 0.02], r: [-1.25, 0, -a * 0.45] }));
  }
  for (let i = 0; i < 3; i++) head.add(mesh(cone(0.05, 0.14, 6), hair, { p: [-0.08 + i * 0.08, 0.16, 0.12], r: [0.6, 0, (i - 1) * 0.3] }));
  // 뒤로 쓴 검은 모자 (챙이 뒤로 길게)
  head.add(mesh(sphere(0.207, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#1a1a1f', { rough: 0.6 }), { p: [0, 0.03, -0.01], s: [1.02, 0.8, 1.02], r: [-0.3, 0, 0] }));
  head.add(mesh(rbox(0.24, 0.03, 0.22, 0.01), mat('#111114'), { p: [0, 0.06, -0.28], r: [-0.55, 0, 0] }));
  head.add(mesh(sphere(0.02, 6, 5), mat('#d0261f'), { p: [0, 0.2, -0.02], cast: false }));
  const eL = eye(0.06, { iris: '#3d8bd9', look: 0.3 });
  const eR = eye(0.06, { iris: '#3d8bd9', look: 0.3 });
  eL.position.set(-0.07, 0.0, 0.16);
  eR.position.set(0.07, 0.0, 0.16);
  head.add(eL, eR);
  head.add(mesh(torus(0.06, 0.014, 6, 16, Math.PI), mat('#8a2a1a'), { p: [0, -0.09, 0.17], r: [0, 0, Math.PI], cast: false }));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) head.add(mesh(sphere(0.008, 5, 4), mat('#c97a50'), { p: [s * (0.09 + i * 0.015), -0.04 + (i % 2) * 0.015, 0.175], cast: false }));
  body.add(head);
  // 큰 빨간 기타
  const guitar = group([], { p: [0.03, 0.12, 0.16], r: [0, 0, -0.7], s: 1.45 });
  guitar.add(mesh(rbox(0.22, 0.17, 0.05, 0.06), mat('#d0101e', { rough: 0.25, metal: 0.1 }), { p: [-0.05, -0.02, 0] }));
  guitar.add(mesh(rbox(0.1, 0.08, 0.052, 0.03), mat('#f2f2f2', { rough: 0.4 }), { p: [-0.02, -0.04, 0.002], cast: false }));
  guitar.add(mesh(box(0.3, 0.035, 0.03), mat('#6b4423'), { p: [0.21, 0, 0] }));
  guitar.add(mesh(box(0.07, 0.055, 0.03), mat('#1d1d24'), { p: [0.38, 0, 0] }));
  body.add(guitar);
  const armL = arm(-0.19, 0.27, 0.16, 0.035, '#1b1b20', group([mesh(sphere(0.05, 10, 8), skin)]), -1);
  const armR = arm(0.19, 0.27, 0.16, 0.035, '#1b1b20', group([mesh(sphere(0.05, 10, 8), skin)]), 1);
  body.add(armL, armR);
  const legL = leg(-0.08, hipY + 0.02, 0.2, 0.048, '#b8a27a', sneaker('#d0261f'));
  const legR = leg(0.08, hipY + 0.02, 0.2, 0.048, '#b8a27a', sneaker('#d0261f'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, guitar });
}

// ── MR. ODD : 곱슬머리 + 콧수염 (House Event 전용, 플레이 불가)
//    v4: 더 큰 배/어깨 · 작은 머리 · 굵은 빨간 체크 가운 · 머그컵 · 끈 벨트 · 슬리퍼 ───
export function buildMrOdd() {
  const root = group();
  const body = group([], { p: [0, 0, 0] });
  const skin = mat('#e9b48c', { rough: 0.6 });
  const robe = mat('#ffffff', { map: plaidTexture('#c8102e', '#1a0608'), rough: 0.9 });
  body.add(mesh(rbox(3.5, 2.1, 1.8, 0.6, 4), robe, { p: [0, 1.05, 0] }));
  body.add(mesh(sphere(1.25, 24, 18), robe, { p: [0, 0.95, 0.55], s: [1.25, 0.95, 0.75] }));
  for (const s of [-1, 1]) body.add(mesh(sphere(0.75, 18, 14), robe, { p: [s * 1.55, 1.85, 0], s: [1, 0.75, 1] }));
  // 가운 깃 (V넥) + 끈 벨트
  for (const s of [-1, 1]) body.add(mesh(box(0.35, 1.3, 0.08), mat('#7a0a16', { rough: 0.8 }), { p: [s * 0.3, 1.55, 0.92], r: [0, 0, s * 0.35], cast: false }));
  body.add(mesh(box(0.42, 0.7, 0.05), mat('#f2e6d8'), { p: [0, 1.75, 0.9], cast: false }));
  body.add(mesh(torus(1.55, 0.09, 8, 36), mat('#d8b07a', { rough: 0.9 }), { p: [0, 0.75, 0.25], r: [Math.PI / 2, 0, 0], s: [1.15, 0.75, 1] }));
  body.add(mesh(sphere(0.14, 8, 6), mat('#d8b07a', { rough: 0.9 }), { p: [0.45, 0.7, 1.32] }));
  // 슬리퍼
  for (const s of [-1, 1]) body.add(mesh(rbox(0.6, 0.25, 0.9, 0.12), mat('#5a2a4a', { rough: 0.9 }), { p: [s * 0.65, 0.12, 0.95] }));
  const head = group([], { p: [0, 2.72, 0.15], s: 0.8 });
  head.add(mesh(sphere(0.95, 28, 22), skin, { s: [1.05, 1.0, 0.95] }));
  const hair = mat('#18120f', { rough: 0.9 });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const y = 0.45 + (i % 3) * 0.18;
    head.add(mesh(sphere(0.28, 10, 8), hair, { p: [Math.cos(a) * 0.82, y, Math.sin(a) * 0.72 - 0.1] }));
  }
  for (let i = 0; i < 9; i++) head.add(mesh(sphere(0.32, 10, 8), hair, { p: [-0.6 + (i % 3) * 0.6, 0.85 + Math.floor(i / 3) * 0.05, -0.4 + Math.floor(i / 3) * 0.35] }));
  for (const s of [-1, 1]) {
    head.add(mesh(sphere(0.26, 14, 10), mat('#14100d', { rough: 0.8 }), { p: [s * 0.24, -0.28, 0.82], s: [1.4, 0.6, 0.6], r: [0, 0, s * 0.25] }));
    const e = eye(0.17, { look: 0.3 });
    e.position.set(s * 0.32, 0.18, 0.78);
    head.add(e);
    head.add(mesh(box(0.42, 0.1, 0.1), hair, { p: [s * 0.32, 0.42, 0.82], r: [0, 0, -s * 0.15] }));
  }
  head.add(mesh(sphere(0.2, 14, 10), mat('#d99a74'), { p: [0, -0.02, 0.92] }));
  body.add(head);
  const handL = group([mesh(sphere(0.42, 16, 12), skin, { s: [1, 0.8, 1.1] })], { p: [-2.1, 1.4, 0.7] });
  const handR = group([mesh(sphere(0.42, 16, 12), skin, { s: [1, 0.8, 1.1] })], { p: [2.1, 1.4, 0.7] });
  // 머그컵
  const mug = group([], { p: [0, 0.45, 0.1] });
  mug.add(mesh(cyl(0.26, 0.24, 0.5, 18), mat('#f2efe8', { rough: 0.4 }), {}));
  mug.add(mesh(cyl(0.22, 0.22, 0.02, 18), mat('#4a2c18'), { p: [0, 0.25, 0], cast: false }));
  mug.add(mesh(torus(0.13, 0.04, 6, 14), mat('#f2efe8', { rough: 0.4 }), { p: [0.3, 0, 0], r: [0, 0, 0] }));
  mug.add(mesh(box(0.2, 0.14, 0.01), mat('#c8102e'), { p: [0, 0.02, 0.255], cast: false }));
  handR.add(mug);
  body.add(handL, handR);
  root.add(body);
  return { root, body, head, handL, handR };
}

const BUILDERS = {
  vin: buildVin,
  picker: buildPicker,
  aa: buildAA,
  locke: buildLocke,
  rex: buildRex,
  buddy: buildBuddy,
  bully: buildBully,
};

export function buildPlaceholder(characterId) {
  const fn = BUILDERS[characterId];
  if (!fn) throw new Error(`No placeholder for ${characterId}`);
  const r = fn();
  r.placeholder = true;
  return r;
}
