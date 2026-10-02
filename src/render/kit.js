import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// 공유 지오메트리 / 머티리얼 캐시 + 간단한 메쉬 조립 헬퍼

const geoCache = new Map();
const matCache = new Map();

function gkey(...a) {
  return a.map((v) => (typeof v === 'number' ? v.toFixed(3) : String(v))).join('|');
}

export function rbox(w, h, d, r = 0.06, seg = 2) {
  const k = gkey('rbox', w, h, d, r, seg);
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
  return geoCache.get(k);
}

export function box(w, h, d) {
  const k = gkey('box', w, h, d);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

export function cyl(rt, rb, h, seg = 24, open = false) {
  const k = gkey('cyl', rt, rb, h, seg, open);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  return geoCache.get(k);
}

export function sphere(r, ws = 16, hs = 12, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, thetaLen = Math.PI) {
  const k = gkey('sph', r, ws, hs, phiStart, phiLen, thetaStart, thetaLen);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thetaStart, thetaLen));
  return geoCache.get(k);
}

export function torus(r, t, rs = 10, ts = 28, arc = Math.PI * 2) {
  const k = gkey('tor', r, t, rs, ts, arc);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.TorusGeometry(r, t, rs, ts, arc));
  return geoCache.get(k);
}

export function cone(r, h, seg = 20) {
  const k = gkey('cone', r, h, seg);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.ConeGeometry(r, h, seg));
  return geoCache.get(k);
}

export function capsule(r, len, cs = 8, rs = 16) {
  const k = gkey('cap', r, len, cs, rs);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CapsuleGeometry(r, len, cs, rs));
  return geoCache.get(k);
}

export function plane(w, h) {
  const k = gkey('plane', w, h);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.PlaneGeometry(w, h));
  return geoCache.get(k);
}

export function circle(r, seg = 32) {
  const k = gkey('circle', r, seg);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CircleGeometry(r, seg));
  return geoCache.get(k);
}

export function ring(ri, ro, seg = 40, start = 0, len = Math.PI * 2) {
  const k = gkey('ring', ri, ro, seg, start, len);
  if (!geoCache.has(k)) geoCache.set(k, new THREE.RingGeometry(ri, ro, seg, 1, start, len));
  return geoCache.get(k);
}

// opts: rough, metal, emissive, ei, map, transparent, opacity, side, flat
export function mat(color, opts = {}) {
  const k = gkey('mat', color, opts.rough ?? 0.7, opts.metal ?? 0, opts.emissive ?? '', opts.ei ?? 1, opts.map?.uuid ?? '', opts.opacity ?? 1, opts.side ?? 0, opts.flat ?? false);
  if (opts.unique || !matCache.has(k)) {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.7,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.ei ?? 1,
      map: opts.map ?? null,
      transparent: (opts.opacity ?? 1) < 1 || !!opts.transparent,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      flatShading: !!opts.flat,
    });
    if (opts.unique) return m;
    matCache.set(k, m);
  }
  return matCache.get(k);
}

export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    map: opts.map ?? null,
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: opts.side ?? THREE.FrontSide,
    toneMapped: opts.toneMapped ?? true,
  });
}

// mesh(geo, mat, { p:[x,y,z], r:[x,y,z], s:[x,y,z]|n, cast, receive, name })
export function mesh(geo, material, o = {}) {
  const m = new THREE.Mesh(geo, material);
  if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) {
    if (typeof o.s === 'number') m.scale.setScalar(o.s);
    else m.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  return m;
}

export function group(children = [], o = {}) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  if (o.p) g.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) g.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) {
    if (typeof o.s === 'number') g.scale.setScalar(o.s);
    else g.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  if (o.name) g.name = o.name;
  return g;
}

export function shadowless(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return obj;
}

export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
