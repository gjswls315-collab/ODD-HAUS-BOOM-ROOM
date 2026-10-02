import * as THREE from 'three';
import { glowTexture, labelTexture } from './textures.js';

// 파티클 / 떠오르는 텍스트 이펙트 (풀링)
const MAX_DEBRIS = 400;
const MAX_SPARK = 600;

export class Fx {
  constructor(scene) {
    this.scene = scene;
    // 파편 (InstancedMesh)
    this.debrisGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    this.debrisMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.debris = new THREE.InstancedMesh(this.debrisGeo, this.debrisMat, MAX_DEBRIS);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.castShadow = true;
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    scene.add(this.debris);
    this.debrisList = [];

    // 반짝이 (Points, additive)
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(MAX_SPARK * 3);
    this.sparkCol = new Float32Array(MAX_SPARK * 3);
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkMat = new THREE.PointsMaterial({
      size: 0.22,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.sparks = new THREE.Points(this.sparkGeo, this.sparkMat);
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    this.sparkList = [];

    this.texts = [];
    this.rings = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  burstDebris(pos, colors, n = 14, power = 2.6) {
    for (let i = 0; i < n; i++) {
      if (this.debrisList.length >= MAX_DEBRIS) this.debrisList.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * power;
      this.debrisList.push({
        p: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.5, pos.y + 0.2 + Math.random() * 0.4, pos.z + (Math.random() - 0.5) * 0.5),
        v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp),
        r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
        w: (Math.random() - 0.5) * 12,
        s: 0.6 + Math.random() * 1.2,
        life: 0.9 + Math.random() * 0.6,
        t: 0,
        color: new THREE.Color(colors[i % colors.length]),
      });
    }
  }

  sparkle(pos, color = '#ffd166', n = 18, { spread = 0.4, up = 2.2, life = 0.8, gravity = -2 } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.sparkList.length >= MAX_SPARK) this.sparkList.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * spread * 4;
      this.sparkList.push({
        p: new THREE.Vector3(pos.x, pos.y, pos.z),
        v: new THREE.Vector3(Math.cos(a) * sp, up * (0.4 + Math.random()), Math.sin(a) * sp),
        g: gravity,
        life: life * (0.6 + Math.random() * 0.6),
        t: 0,
        c,
      });
    }
  }

  ringPulse(pos, color, { from = 0.2, to = 1.4, life = 0.45, y = 0.05 } = {}) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, y, pos.z);
    this.scene.add(m);
    this.rings.push({ m, t: 0, life, from, to });
  }

  floatText(pos, text, color = '#ffffff', { size = 0.9, life = 1.1 } = {}) {
    const tex = labelTexture(text, { color, font: 'bold 72px "Arial Black", sans-serif', w: 512, h: 128, glow: 'rgba(0,0,0,0.9)' });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    sp.scale.set(size * 2.4, size * 0.6, 1);
    sp.position.set(pos.x, pos.y, pos.z);
    sp.renderOrder = 10;
    this.scene.add(sp);
    this.texts.push({ sp, t: 0, life, y0: pos.y });
  }

  update(dt) {
    // debris
    const L = this.debrisList;
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i];
      d.t += dt;
      if (d.t >= d.life) {
        L.splice(i, 1);
        continue;
      }
      d.v.y -= 9.8 * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.05) {
        d.p.y = 0.05;
        d.v.y *= -0.35;
        d.v.x *= 0.7;
        d.v.z *= 0.7;
      }
      d.r.x += d.w * dt;
      d.r.y += d.w * dt * 0.7;
    }
    this.debris.count = L.length;
    for (let i = 0; i < L.length; i++) {
      const d = L[i];
      const k = 1 - Math.max(0, (d.t - d.life * 0.6) / (d.life * 0.4));
      this._q.setFromEuler(d.r);
      this._s.setScalar(d.s * k);
      this._m.compose(d.p, this._q, this._s);
      this.debris.setMatrixAt(i, this._m);
      this.debris.setColorAt(i, d.color);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    if (this.debris.instanceColor) this.debris.instanceColor.needsUpdate = true;

    // sparks
    const S = this.sparkList;
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      s.t += dt;
      if (s.t >= s.life) {
        S.splice(i, 1);
        continue;
      }
      s.v.y += s.g * dt;
      s.p.addScaledVector(s.v, dt);
    }
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const k = 1 - s.t / s.life;
      this.sparkPos[i * 3] = s.p.x;
      this.sparkPos[i * 3 + 1] = s.p.y;
      this.sparkPos[i * 3 + 2] = s.p.z;
      this.sparkCol[i * 3] = s.c.r * k;
      this.sparkCol[i * 3 + 1] = s.c.g * k;
      this.sparkCol[i * 3 + 2] = s.c.b * k;
    }
    this.sparkGeo.setDrawRange(0, S.length);
    this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparkGeo.attributes.color.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.life);
      r.m.scale.setScalar(r.from + (r.to - r.from) * k);
      r.m.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        r.m.removeFromParent();
        r.m.geometry.dispose();
        r.m.material.dispose();
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      const k = t.t / t.life;
      t.sp.position.y = t.y0 + k * 0.8;
      t.sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (k >= 1) {
        t.sp.removeFromParent();
        t.sp.material.dispose();
        this.texts.splice(i, 1);
      }
    }
  }

  dispose() {
    this.debris.removeFromParent();
    this.sparks.removeFromParent();
    for (const r of this.rings) r.m.removeFromParent();
    for (const t of this.texts) t.sp.removeFromParent();
  }
}
