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

function eye(r = 0.1, { pupil = BLACK, iris = null, angry = 0, look = 0.35 } = {}) {
  const g = group();
  g.add(mesh(sphere(r, 18, 14), mat(WHITE, { rough: 0.25 }), { s: [0.85, 1.1, 0.6], cast: false }));
  if (iris) g.add(mesh(sphere(r * 0.55, 14, 10), mat(iris, { rough: 0.3 }), { p: [0, -r * 0.05, r * look * 1.2], s: [1, 1, 0.5], cast: false }));
  g.add(mesh(sphere(r * 0.42, 14, 10), mat(pupil, { rough: 0.2 }), { p: [0, -r * 0.08, r * (look + 0.18)], s: [1, 1.15, 0.5], cast: false }));
  g.add(mesh(sphere(r * 0.13, 8, 6), mat('#ffffff', { emissive: '#ffffff', ei: 0.5 }), { p: [r * 0.15, r * 0.2, r * 0.62], cast: false }));
  if (angry) g.add(mesh(box(r * 2.0, r * 0.32, r * 0.3), mat(BLACK), { p: [0, r * 1.05, r * 0.3], r: [0, 0, angry], cast: false }));
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

// ── VIN : 큰 눈의 검은 LP 레코드 ─────────────────────────────
function buildVin() {
  const root = group();
  const hipY = 0.3;
  const body = group([], { p: [0, hipY, 0] });
  const front = mat('#ffffff', { map: grooveTexture('#2a2a30'), rough: 0.3, metal: 0.1 });
  const back = mat('#ffffff', { map: grooveTexture('#ff5a4f'), rough: 0.3, metal: 0.1 });
  body.add(mesh(cyl(0.34, 0.34, 0.1, 48), [mat('#0c0c10', { rough: 0.35 }), front, back], { p: [0, 0.34, 0], r: [Math.PI / 2, 0, 0] }));
  body.add(mesh(torus(0.335, 0.012, 6, 48), mat('#2b2b33', { metal: 0.4, rough: 0.3 }), { p: [0, 0.34, 0], cast: false }));
  const head = group([], { p: [0, 0.34, 0.05] });
  const eL = eye(0.12, { look: 0.3 });
  const eR = eye(0.12, { look: 0.3 });
  eL.position.set(-0.1, 0.09, 0.02);
  eR.position.set(0.1, 0.09, 0.02);
  head.add(eL, eR);
  head.add(smile(0.06, -0.09, 0.03, '#e8e8e8', 0.01));
  body.add(head);
  const armL = arm(-0.3, 0.38, 0.2, 0.02, BLACK, glove(), -1);
  const armR = arm(0.3, 0.38, 0.2, 0.02, BLACK, glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.1, hipY + 0.02, 0.2, 0.022, BLACK, sneaker('#e63b2e'));
  const legR = leg(0.1, hipY + 0.02, 0.2, 0.022, BLACK, sneaker('#e63b2e'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, spinPart: body.children[0] });
}

// ── PICKER : 화난 눈의 빨간 기타 피크 ──────────────────────────
function pickShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.36);
  s.quadraticCurveTo(0.12, -0.2, 0.3, 0.12);
  s.quadraticCurveTo(0.36, 0.3, 0.16, 0.34);
  s.quadraticCurveTo(0, 0.37, -0.16, 0.34);
  s.quadraticCurveTo(-0.36, 0.3, -0.3, 0.12);
  s.quadraticCurveTo(-0.12, -0.2, 0, -0.36);
  return s;
}
let pickGeo = null;
function buildPicker() {
  const root = group();
  const hipY = 0.28;
  const body = group([], { p: [0, hipY, 0] });
  if (!pickGeo) {
    pickGeo = new THREE.ExtrudeGeometry(pickShape(), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 16 });
    pickGeo.translate(0, 0, -0.04);
  }
  body.add(mesh(pickGeo, mat('#e2261f', { rough: 0.25, metal: 0.05 }), { p: [0, 0.38, 0] }));
  const head = group([], { p: [0, 0.42, 0.08] });
  const eL = eye(0.095, { angry: -0.45, look: 0.3 });
  const eR = eye(0.095, { angry: 0.45, look: 0.3 });
  eL.position.set(-0.1, 0.06, 0);
  eR.position.set(0.1, 0.06, 0);
  head.add(eL, eR);
  head.add(mesh(torus(0.05, 0.012, 6, 14, Math.PI * 0.8), mat(BLACK), { p: [0, -0.1, 0.02], r: [0, 0, Math.PI * 0.1], cast: false }));
  body.add(head);
  const armL = arm(-0.28, 0.42, 0.18, 0.02, '#8e1410', glove(), -1);
  const armR = arm(0.28, 0.42, 0.18, 0.02, '#8e1410', glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.09, hipY + 0.03, 0.2, 0.022, '#8e1410', sneaker('#f2f2f2', '#e2261f'));
  const legR = leg(0.09, hipY + 0.03, 0.2, 0.022, '#8e1410', sneaker('#f2f2f2', '#e2261f'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR });
}

// ── A.A. : 비니를 쓴 노란 배터리 (파란 밴드 + 번개) ─────────────
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
  body.add(mesh(capsule(0.25, 0.3, 10, 24), mat('#f5c518', { rough: 0.35 }), { p: [0, 0.4, 0] }));
  body.add(mesh(cyl(0.258, 0.258, 0.17, 32), mat('#1f4fae', { rough: 0.4 }), { p: [0, 0.22, 0] }));
  if (!boltGeo) boltGeo = new THREE.ExtrudeGeometry(boltShape(), { depth: 0.02, bevelEnabled: false });
  body.add(mesh(boltGeo, mat('#ffd23f', { emissive: '#ffb000', ei: 0.4 }), { p: [0, 0.22, 0.25], s: 1.1, cast: false }));
  // 비니
  const beanie = group([], { p: [0, 0.6, 0] });
  beanie.add(mesh(sphere(0.262, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat('#1d1d24', { rough: 0.95 }), { s: [1, 0.9, 1] }));
  beanie.add(mesh(torus(0.25, 0.05, 8, 28), mat('#2a2a33', { rough: 0.95 }), { p: [0, 0.0, 0], r: [Math.PI / 2, 0, 0] }));
  beanie.add(mesh(sphere(0.06, 10, 8), mat('#2a2a33', { rough: 1 }), { p: [0, 0.24, 0] }));
  body.add(beanie);
  const head = group([], { p: [0, 0.47, 0.2] });
  const eL = eye(0.085, { look: 0.3 });
  const eR = eye(0.085, { look: 0.3 });
  eL.position.set(-0.085, 0.02, 0);
  eR.position.set(0.085, 0.02, 0);
  head.add(eL, eR);
  head.add(smile(0.05, -0.08, 0.03));
  body.add(head);
  const armL = arm(-0.26, 0.38, 0.16, 0.022, '#e0b010', glove(), -1);
  const armR = arm(0.26, 0.38, 0.16, 0.022, '#e0b010', glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.1, hipY + 0.04, 0.17, 0.024, '#c99a10', sneaker('#1f4fae'));
  const legR = leg(0.1, hipY + 0.04, 0.17, 0.024, '#c99a10', sneaker('#1f4fae'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR });
}

// ── LOCKE : 열쇠 머리 + 갈색 모자 ─────────────────────────────
function buildLocke() {
  const root = group();
  const hipY = 0.26;
  const body = group([], { p: [0, hipY, 0] });
  const brass = mat('#e2b866', { rough: 0.3, metal: 0.45 });
  // 열쇠 몸통(shaft) + 톱니
  body.add(mesh(rbox(0.2, 0.32, 0.12, 0.04), brass, { p: [0, 0.16, 0] }));
  body.add(mesh(box(0.08, 0.06, 0.1), brass, { p: [0.13, 0.08, 0] }));
  body.add(mesh(box(0.06, 0.05, 0.1), brass, { p: [0.12, 0.2, 0] }));
  body.add(mesh(cyl(0.035, 0.035, 0.13, 12), mat('#2a1a10'), { p: [0, 0.18, 0.0], r: [Math.PI / 2, 0, 0], cast: false }));
  // 열쇠 머리(bow) = 얼굴
  const head = group([], { p: [0, 0.52, 0] });
  head.add(mesh(cyl(0.25, 0.25, 0.13, 40), brass, { r: [Math.PI / 2, 0, 0] }));
  head.add(mesh(torus(0.25, 0.025, 8, 40), mat('#c99a45', { metal: 0.6, rough: 0.3 }), { cast: false }));
  const eL = eye(0.085, { look: 0.3 });
  const eR = eye(0.085, { look: 0.3 });
  eL.position.set(-0.085, 0.02, 0.07);
  eR.position.set(0.085, 0.02, 0.07);
  head.add(eL, eR);
  head.add(smile(0.05, -0.1, 0.07));
  // 모자
  const hat = group([], { p: [0, 0.2, 0] });
  hat.add(mesh(sphere(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6b4423', { rough: 0.8 }), { s: [1.05, 0.75, 1] }));
  hat.add(mesh(cyl(0.29, 0.29, 0.025, 28), mat('#5a381c', { rough: 0.8 }), { p: [0, 0.0, 0.03] }));
  hat.add(mesh(cyl(0.205, 0.205, 0.04, 28), mat('#b8302a', { rough: 0.7 }), { p: [0, 0.03, 0] }));
  head.add(hat);
  body.add(head);
  const armL = arm(-0.12, 0.3, 0.18, 0.022, '#c99a45', glove(), -1);
  const armR = arm(0.12, 0.3, 0.18, 0.022, '#c99a45', glove(), 1);
  body.add(armL, armR);
  const legL = leg(-0.07, hipY + 0.02, 0.2, 0.024, '#6b4423', sneaker('#6b4423', '#f2e6c9'));
  const legR = leg(0.07, hipY + 0.02, 0.2, 0.024, '#6b4423', sneaker('#6b4423', '#f2e6c9'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, hat });
}

// ── REX : 왕관 + 빨간 망토의 체스 킹 ──────────────────────────
let rexLathe = null;
function buildRex() {
  const root = group();
  const hipY = 0.2;
  const body = group([], { p: [0, hipY, 0] });
  if (!rexLathe) {
    const pts = [
      [0.0, 0],
      [0.24, 0],
      [0.25, 0.04],
      [0.2, 0.08],
      [0.16, 0.2],
      [0.14, 0.34],
      [0.19, 0.4],
      [0.15, 0.44],
      [0.2, 0.56],
      [0.21, 0.66],
      [0.17, 0.74],
      [0.0, 0.76],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    rexLathe = new THREE.LatheGeometry(pts, 32);
  }
  body.add(mesh(rexLathe, mat('#f3e7c8', { rough: 0.35 }), {}));
  // 망토
  const cape = group([], { p: [0, 0.42, -0.02] });
  cape.add(mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.5, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat('#b3122a', { rough: 0.7, side: THREE.DoubleSide }), { p: [0, -0.2, 0] }));
  cape.add(mesh(torus(0.18, 0.06, 10, 24), mat('#f8f6f0', { rough: 1 }), { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cape.add(mesh(sphere(0.015, 6, 5), mat(BLACK), { p: [Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2], cast: false }));
  }
  body.add(cape);
  // 왕관
  const crown = group([], { p: [0, 0.78, 0] });
  crown.add(mesh(cyl(0.15, 0.16, 0.1, 24, true), mat('#f2c14e', { metal: 0.9, rough: 0.25, side: THREE.DoubleSide }), { p: [0, 0.05, 0] }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crown.add(mesh(cone(0.035, 0.1, 8), mat('#f2c14e', { metal: 0.9, rough: 0.25 }), { p: [Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14] }));
    crown.add(mesh(sphere(0.02, 8, 6), mat('#ff2e4a', { emissive: '#ff2e4a', ei: 0.3 }), { p: [Math.cos(a) * 0.155, 0.05, Math.sin(a) * 0.155], cast: false }));
  }
  crown.add(mesh(sphere(0.03, 8, 6), mat('#2e7bff', { emissive: '#2e7bff', ei: 0.3 }), { p: [0, 0.07, 0.16], cast: false }));
  body.add(crown);
  const head = group([], { p: [0, 0.6, 0.17] });
  const eL = eye(0.07, { look: 0.3 });
  const eR = eye(0.07, { look: 0.3 });
  eL.position.set(-0.07, 0.02, 0);
  eR.position.set(0.07, 0.02, 0);
  head.add(eL, eR);
  head.add(smile(0.04, -0.06, 0.02));
  body.add(head);
  const armL = arm(-0.17, 0.42, 0.14, 0.02, '#e8dcb8', glove(), -1);
  const scepter = group([], { p: [0, -0.02, 0.04] });
  scepter.add(mesh(cyl(0.014, 0.014, 0.4, 8), mat('#f2c14e', { metal: 0.9, rough: 0.25 }), { p: [0, 0.12, 0] }));
  scepter.add(mesh(sphere(0.04, 10, 8), mat('#ff2e4a', { emissive: '#ff2e4a', ei: 0.25 }), { p: [0, 0.33, 0] }));
  const handR = glove();
  handR.add(scepter);
  const armR = arm(0.17, 0.42, 0.14, 0.02, '#e8dcb8', handR, 1);
  body.add(armL, armR);
  const legL = leg(-0.08, hipY + 0.02, 0.14, 0.025, '#e8dcb8', sneaker('#b3122a', '#f2c14e', 0.9));
  const legR = leg(0.08, hipY + 0.02, 0.14, 0.025, '#e8dcb8', sneaker('#b3122a', '#f2c14e', 0.9));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, cape, crown });
}

// ── BUDDY : 크림색 장모 강아지 ────────────────────────────────
function buildBuddy() {
  const root = group();
  const hipY = 0.16;
  const body = group([], { p: [0, hipY, 0] });
  const fur = mat('#f1e4c8', { rough: 1 });
  const fur2 = mat('#e2c79a', { rough: 1 });
  const brown = mat('#b07a45', { rough: 1 });
  body.add(mesh(sphere(0.26, 18, 14), fur, { p: [0, 0.2, -0.02], s: [0.9, 0.8, 1.15] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    body.add(mesh(sphere(0.1, 10, 8), i % 2 ? fur : fur2, { p: [Math.cos(a) * 0.2, 0.12 + (i % 2) * 0.06, Math.sin(a) * 0.24] }));
  }
  const head = group([], { p: [0, 0.42, 0.18] });
  head.add(mesh(sphere(0.21, 18, 14), fur, { s: [1.05, 0.95, 0.95] }));
  head.add(mesh(sphere(0.12, 12, 10), brown, { p: [-0.1, 0.1, 0.05], s: [1, 0.8, 0.6] }));
  head.add(mesh(sphere(0.1, 14, 10), mat('#f8f0de', { rough: 1 }), { p: [0, -0.05, 0.16], s: [1.2, 0.85, 0.9] }));
  head.add(mesh(sphere(0.04, 10, 8), mat(BLACK, { rough: 0.2 }), { p: [0, -0.01, 0.25] }));
  head.add(mesh(sphere(0.03, 8, 6), mat('#e86a7a'), { p: [0, -0.1, 0.22], s: [1, 0.6, 1], cast: false }));
  for (const s of [-1, 1]) {
    head.add(mesh(sphere(0.045, 12, 10), mat('#2a1c14', { rough: 0.15 }), { p: [s * 0.085, 0.05, 0.17], cast: false }));
    head.add(mesh(sphere(0.012, 6, 5), mat('#fff', { emissive: '#fff', ei: 0.6 }), { p: [s * 0.085 + 0.012, 0.065, 0.21], cast: false }));
    head.add(mesh(sphere(0.11, 12, 10), brown, { p: [s * 0.2, -0.04, -0.02], s: [0.55, 1.3, 0.8], r: [0, 0, s * 0.25] }));
  }
  head.add(mesh(sphere(0.06, 10, 8), fur2, { p: [0, 0.2, 0.02] }));
  body.add(head);
  const tail = group([], { p: [0, 0.28, -0.28] });
  tail.add(mesh(sphere(0.08, 10, 8), fur2, { p: [0, 0.06, -0.02], s: [0.8, 1.3, 0.8], r: [-0.6, 0, 0] }));
  body.add(tail);
  // 다리 4개 (앞다리 = arm 으로 취급)
  const paw = () => group([mesh(sphere(0.055, 10, 8), fur2, { s: [1, 0.7, 1.2] })]);
  const armL = leg(-0.11, 0.1, 0.1, 0.045, '#efe0c0', paw());
  armL.position.z = 0.14;
  const armR = leg(0.11, 0.1, 0.1, 0.045, '#efe0c0', paw());
  armR.position.z = 0.14;
  body.add(armL, armR);
  const legL = leg(-0.11, hipY + 0.06, 0.12, 0.045, '#efe0c0', paw());
  legL.position.z = -0.14;
  const legR = leg(0.11, hipY + 0.06, 0.12, 0.045, '#efe0c0', paw());
  legR.position.z = -0.14;
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, tail, quadruped: true });
}

// ── BULLY : 뒤로 쓴 빨간 모자 + 금발 + 기타 ─────────────────────
function buildBully() {
  const root = group();
  const hipY = 0.3;
  const body = group([], { p: [0, hipY, 0] });
  const skin = mat('#f4c9a1', { rough: 0.6 });
  body.add(mesh(rbox(0.34, 0.3, 0.22, 0.08), mat('#4f7a3a', { rough: 0.8 }), { p: [0, 0.16, 0] }));
  body.add(mesh(box(0.14, 0.24, 0.02), mat('#f2f2f2'), { p: [0, 0.17, 0.11], cast: false }));
  const head = group([], { p: [0, 0.52, 0.02] });
  head.add(mesh(sphere(0.2, 20, 16), skin, { s: [1, 0.95, 0.95] }));
  const hair = mat('#f2c14e', { rough: 0.8 });
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + i * 0.4;
    head.add(mesh(cone(0.06, 0.16, 6), hair, { p: [Math.sin(a) * 0.17, 0.12 + Math.cos(a) * 0.02, 0.08 + Math.cos(a) * 0.04], r: [0.9, 0, -a * 0.6] }));
  }
  head.add(mesh(sphere(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat('#d0261f', { rough: 0.6 }), { p: [0, 0.03, -0.01], s: [1.02, 0.8, 1.02], r: [-0.25, 0, 0] }));
  head.add(mesh(rbox(0.22, 0.03, 0.16, 0.01), mat('#a81c16'), { p: [0, 0.08, -0.24], r: [-0.4, 0, 0] }));
  const eL = eye(0.06, { iris: '#3d8bd9', look: 0.3 });
  const eR = eye(0.06, { iris: '#3d8bd9', look: 0.3 });
  eL.position.set(-0.07, 0.0, 0.16);
  eR.position.set(0.07, 0.0, 0.16);
  head.add(eL, eR);
  head.add(mesh(torus(0.06, 0.014, 6, 16, Math.PI), mat('#8a2a1a'), { p: [0, -0.09, 0.17], r: [0, 0, Math.PI], cast: false }));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) head.add(mesh(sphere(0.008, 5, 4), mat('#c97a50'), { p: [s * (0.09 + i * 0.015), -0.04 + (i % 2) * 0.015, 0.175], cast: false }));
  body.add(head);
  // 기타
  const guitar = group([], { p: [0.02, 0.14, 0.15], r: [0, 0, -0.7] });
  guitar.add(mesh(rbox(0.22, 0.16, 0.05, 0.05), mat('#c8102e', { rough: 0.3 }), { p: [-0.05, -0.02, 0] }));
  guitar.add(mesh(box(0.28, 0.035, 0.03), mat('#6b4423'), { p: [0.2, 0, 0] }));
  guitar.add(mesh(box(0.06, 0.05, 0.03), mat('#1d1d24'), { p: [0.36, 0, 0] }));
  body.add(guitar);
  const armL = arm(-0.19, 0.27, 0.16, 0.035, '#4f7a3a', group([mesh(sphere(0.05, 10, 8), skin)]), -1);
  const armR = arm(0.19, 0.27, 0.16, 0.035, '#4f7a3a', group([mesh(sphere(0.05, 10, 8), skin)]), 1);
  body.add(armL, armR);
  const legL = leg(-0.08, hipY + 0.02, 0.2, 0.045, '#2f4f8a', sneaker('#d0261f'));
  const legR = leg(0.08, hipY + 0.02, 0.2, 0.045, '#2f4f8a', sneaker('#d0261f'));
  root.add(legL, legR);
  return rig(root, body, { head, armL, armR, legL, legR, guitar });
}

// ── MR. ODD : 곱슬머리 + 콧수염 + 빨간 체크 셔츠 (House Event 전용) ───
export function buildMrOdd() {
  const root = group();
  const body = group([], { p: [0, 0, 0] });
  const skin = mat('#e9b48c', { rough: 0.6 });
  body.add(mesh(rbox(3.0, 2.0, 1.6, 0.5, 4), mat('#ffffff', { map: plaidTexture(), rough: 0.9 }), { p: [0, 1.0, 0] }));
  body.add(mesh(box(0.7, 0.9, 0.05), mat('#f2f2f2'), { p: [0, 1.5, 0.79], cast: false }));
  const head = group([], { p: [0, 2.75, 0.1] });
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
  const handL = group([mesh(sphere(0.42, 16, 12), skin, { s: [1, 0.8, 1.1] })], { p: [-1.9, 1.4, 0.6] });
  const handR = group([mesh(sphere(0.42, 16, 12), skin, { s: [1, 0.8, 1.1] })], { p: [1.9, 1.4, 0.6] });
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
