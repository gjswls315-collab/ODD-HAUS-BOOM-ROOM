import * as THREE from 'three';
import { StageView } from './StageView.js';
import { PlayerView, BombView, WaveView, ItemView, TelegraphView, RollingLpView, MrOddView } from './EntityViews.js';
import { Fx } from './Fx.js';
import { damp } from './kit.js';
import { ITEM_TYPES } from '../config/itemConfig.js';

// ─────────────────────────────────────────────────────────────
// GameRenderer — 실제 3D Quarter-view (PerspectiveCamera, 약 50° 하향)
// 완전 Top-down / 완전 Side View 금지. 아레나 구조와 캐릭터가 동시에 읽히도록.
// 시뮬레이션(GameManager) 상태를 읽어서 그리기만 한다.
// ─────────────────────────────────────────────────────────────

const PITCH = THREE.MathUtils.degToRad(50);
const FOV = 34;

// v4 카메라: Soft Follow + Dynamic Zoom
//   살아 있는 플레이어 "모두"를 담도록 부드럽게 따라가고, 서로 가까워지면 조금 확대 / 멀어지면 축소
//   (시작할 때 1P 쪽으로 확대하지 않는다 — 사람 플레이어는 항상 화면 안에 들어오도록 중심만 보정)
//   최대 축소 제한이 있어 큰 맵은 일부가 화면 밖으로 나갈 수 있다
export const CAMERA_CONFIG = {
  minView: [14, 10.5], // 가장 가까울 때 보이는 칸 수 (가로, 세로) — 너무 바짝 당기지 않는다
  maxView: [17.5, 15.5], // 가장 멀 때 — 17×15 맵은 전부 보이고, 이보다 큰 맵은 일부가 화면 밖
  margin: 2.6, // 플레이어 묶음 바깥 여유 칸
  followRate: 2.0,
  zoomRate: 1.2,
  startHold: 4, // 경기 시작 후 이 시간 동안은 처음 화면(전체 보기) 그대로
};

const PROP_DEBRIS = {
  lpBox: ['#c99a5e', '#a37a45', '#d94b3d', '#3d8bd9'],
  books: ['#b83a3a', '#2f5d8c', '#d9a441', '#f3ecd8'],
  recordCrate: ['#a8774a', '#1c1c22', '#d94b3d'],
  routeCrate: ['#d9a441', '#a8774a', '#fff3c0'],
  cableCase: ['#2b2b33', '#9aa3ad', '#ff7136'],
  gearBox: ['#c99a5e', '#c8102e'],
  vinylCrate: ['#3a2e5a', '#b46bff', '#1c1c22'],
  chair: ['#e6e1d8', '#3d6b7a', '#2a2a30'],
  flowerPot: ['#c06b44', '#3f8a4a', '#ff7aa8'],
  crate: ['#b0814f', '#7a5530'],
  box: ['#c99a5e', '#d8c39a'],
  magazineBox: ['#c99a5e', '#d94b3d', '#3d8bd9', '#f2c14e'],
  cushion: ['#c94f3d', '#e8b04a', '#3d7a8c'],
  lpStack: ['#1c1c22', '#d94b3d', '#3d8bd9', '#f2c14e'],
  cardboardBox: ['#c99a5e', '#b88a52', '#d8c39a'],
  headphoneCase: ['#2e3038', '#5c606c', '#ff5a4f'],
  flightCase: ['#18181d', '#9aa3ad', '#b46bff'],
  speakerCase: ['#24202e', '#b46bff', '#9aa3ad'],
  gardenBox: ['#9a6a3c', '#3a2a1e', '#5aa35a'],
  foldingChair: ['#c99a5e', '#2f6e7a', '#c94f3d'],
  oldBox: ['#6b5440', '#c9b48a', '#8a7a68'],
  clothCovered: ['#e3ddd0', '#cfc6b4'],
  audioCase: ['#5a3a26', '#c9a35a', '#2e2018'],
};

export class GameRenderer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'game-canvas';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 200);
    this.camTarget = new THREE.Vector3();
    this.camDist = 20;
    this.camBase = { target: new THREE.Vector3(), dist: 20 };
    this.focus = null;
    this.trauma = 0;
    this.t = 0;
    this.gm = null;
    this.hudTopPx = 96;
    this.bottomPx = 0;

    this.hemi = new THREE.HemisphereLight('#9db6e0', '#3a2414', 0.55);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.12);
    this.key = new THREE.DirectionalLight('#ffd7a6', 1.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 4;
    this.fill = new THREE.DirectionalLight('#7f9bff', 0.35);
    this.scene.add(this.hemi, this.ambient, this.key, this.key.target, this.fill);

    // 적응형 품질: 실제 FPS 가 낮으면 픽셀비 → 그림자 순으로 낮춘다
    this.quality = { level: 2, acc: 0, frames: 0 };

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  _adaptQuality(dt) {
    const q = this.quality;
    if (q.level === 0 || document.hidden) return;
    q.acc += dt;
    q.frames++;
    if (q.acc < 3) return;
    const fps = q.frames / q.acc;
    q.acc = 0;
    q.frames = 0;
    if (fps >= 42) return;
    if (q.level === 2) {
      this.renderer.setPixelRatio(1);
      this.resize();
    } else if (q.level === 1) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    }
    q.level--;
    console.info(`[BOOM ROOM] quality → ${q.level} (fps ${fps.toFixed(0)})`);
  }

  get domElement() {
    return this.renderer.domElement;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.gm) this._fitCamera();
  }

  toWorld = (x, y) => ({ x: x - (this.W - 1) / 2, z: y - (this.H - 1) / 2 });

  setMatch(gm, { hudTopPx = 96, bottomPx = 0, dynamic = true } = {}) {
    this.clearMatch();
    this.gm = gm;
    this.hudTopPx = hudTopPx;
    this.bottomPx = bottomPx;
    this.dynamicCamera = dynamic;
    this.W = gm.grid.width;
    this.H = gm.grid.height;
    const th = gm.stageDef.theme;
    this.scene.background = new THREE.Color(th.fog);
    this.scene.fog = new THREE.Fog(th.fog, 26, 60);
    this.hemi.color.set(th.hemi[0]);
    this.hemi.groundColor.set(th.hemi[1]);
    this.hemi.intensity = th.hemi[2];
    this.key.color.set(th.key[0]);
    this.key.intensity = th.key[1];
    this.baseLight = { hemi: th.hemi[2], key: th.key[1], amb: 0.12 };
    const S = Math.max(this.W, this.H) * 0.62;
    this.key.position.set(-7, 15, 10);
    this.key.target.position.set(0, 0, 0);
    Object.assign(this.key.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 50 });
    this.key.shadow.camera.updateProjectionMatrix();
    this.fill.position.set(8, 6, 12);

    this.matchRoot = new THREE.Group();
    this.scene.add(this.matchRoot);
    this.stageView = new StageView(this.matchRoot, gm);
    this.fx = new Fx(this.matchRoot);
    this.telegraph = new TelegraphView(this.matchRoot, this.toWorld, this.W, this.H);
    this.rollingLp = new RollingLpView(this.matchRoot);
    this.mrOdd = new MrOddView(this.matchRoot, this.toWorld, this.W, this.H);
    this.playerViews = new Map();
    for (const p of gm.players.list) this.playerViews.set(p.id, new PlayerView(this.matchRoot, p, this.toWorld));
    this.bombViews = new Map();
    this.itemViews = new Map();
    this.waveViews = [];
    this.flash = new THREE.PointLight('#8fd8ff', 0, 7, 1.6);
    this.matchRoot.add(this.flash);
    this.focus = null;
    this._fitCamera();
    this.camTarget.copy(this.camBase.target);
    this.camDist = this.camBase.dist;
    this.viewRect = { x0: 0, y0: 0, x1: this.W - 1, y1: this.H - 1 };
  }

  clearMatch() {
    if (!this.gm) return;
    this.fx?.dispose();
    this.matchRoot.removeFromParent();
    this.gm = null;
  }

  // 아레나 전체가 화면에 들어오는 거리 계산
  _fitCamera() {
    const el = this.renderer.domElement;
    const hpx = el.clientHeight || window.innerHeight || 720;
    const wpx = el.clientWidth || window.innerWidth || 1280;
    const W = this.W - 0.4;
    const H = this.H - 0.6;
    const pts = [];
    for (const x of [-W / 2, W / 2]) for (const z of [-H / 2, H / 2]) for (const y of [0, 0.8]) pts.push(new THREE.Vector3(x, y, z));
    const target = new THREE.Vector3(0, 0, 0.45);
    // HUD(위) / 터치 버튼(아래)을 피한 영역에 아레나를 맞춘다
    const topLim = 1 - 2 * Math.min(0.35, this.hudTopPx / hpx) - 0.02;
    const botLim = -1 + 2 * Math.min(0.35, this.bottomPx / hpx) + 0.02;
    this.camera.clearViewOffset();
    const measure = (d) => {
      this._placeCamera(target, d, 0);
      this.camera.updateMatrixWorld();
      let xmax = 0;
      let ymin = Infinity;
      let ymax = -Infinity;
      for (const p of pts) {
        const v = p.clone().project(this.camera);
        xmax = Math.max(xmax, Math.abs(v.x));
        ymin = Math.min(ymin, v.y);
        ymax = Math.max(ymax, v.y);
      }
      return { xmax, ymin, ymax };
    };
    let lo = 5;
    let hi = 160;
    for (let i = 0; i < 30; i++) {
      const d = (lo + hi) / 2;
      const m = measure(d);
      if (m.xmax <= 0.98 && m.ymax - m.ymin <= topLim - botLim) hi = d;
      else lo = d;
    }
    const m = measure(hi);
    const dy = (topLim + botLim) / 2 - (m.ymax + m.ymin) / 2;
    if (Math.abs(dy) > 0.001) this.camera.setViewOffset(wpx, hpx, 0, (dy * hpx) / 2, wpx, hpx);
    this.camBase.target.copy(target);
    this.camBase.dist = hi;
    this._buildZoomModel(target, topLim, botLim);
    this._placeCamera(target, hi, 0);
    // 카메라가 멀어지는 좁은 화면에서도 안개에 묻히지 않도록
    if (this.scene.fog) {
      this.scene.fog.near = hi * 0.95;
      this.scene.fog.far = hi * 2.6;
    }
    this.camera.far = Math.max(200, hi * 4);
    this.camera.updateProjectionMatrix();
  }

  // 상자(w×h 칸)를 화면(HUD/터치 영역 제외)에 담는 카메라 거리 — 선형 모델로 근사해 매 프레임 계산을 가볍게
  _boxDist(target, w, h, topLim, botLim) {
    const pts = [];
    for (const x of [-w / 2, w / 2]) for (const z of [-h / 2, h / 2]) pts.push(new THREE.Vector3(target.x + x, 0.4, target.z + z));
    let lo = 2;
    let hi = 200;
    for (let i = 0; i < 26; i++) {
      const d = (lo + hi) / 2;
      this._placeCamera(target, d, 0);
      this.camera.updateMatrixWorld();
      let xmax = 0;
      let ymin = Infinity;
      let ymax = -Infinity;
      for (const p of pts) {
        const v = p.clone().project(this.camera);
        xmax = Math.max(xmax, Math.abs(v.x));
        ymin = Math.min(ymin, v.y);
        ymax = Math.max(ymax, v.y);
      }
      if (xmax <= 0.98 && ymax - ymin <= topLim - botLim) hi = d;
      else lo = d;
    }
    return hi;
  }

  _buildZoomModel(target, topLim, botLim) {
    const t = target.clone();
    const a1 = 6;
    const a2 = 20;
    const w1 = this._boxDist(t, a1, 0.1, topLim, botLim);
    const w2 = this._boxDist(t, a2, 0.1, topLim, botLim);
    const h1 = this._boxDist(t, 0.1, a1, topLim, botLim);
    const h2 = this._boxDist(t, 0.1, a2, topLim, botLim);
    const kw = (w2 - w1) / (a2 - a1);
    const kh = (h2 - h1) / (a2 - a1);
    this.zoomModel = { kw, bw: w1 - kw * a1, kh, bh: h1 - kh * a1 };
    const C = CAMERA_CONFIG;
    this.camMin = Math.min(this.camBase.dist, this._distFor(C.minView[0], C.minView[1]));
    this.camMax = Math.min(this.camBase.dist, Math.max(this.camMin, this._distFor(C.maxView[0], C.maxView[1])));
  }

  _distFor(w, h) {
    const m = this.zoomModel;
    return Math.max(m.kw * w + m.bw, m.kh * h + m.bh);
  }

  // 카메라 거리 d 에서 보이는 칸 수 (가로, 세로)
  _viewSize(d) {
    const m = this.zoomModel;
    return { w: (d - m.bw) / m.kw, h: (d - m.bh) / m.kh };
  }

  _placeCamera(target, dist, sway) {
    this.camera.position.set(target.x + Math.sin(sway) * 0.4, target.y + Math.sin(PITCH) * dist, target.z + Math.cos(PITCH) * dist);
    this.camera.lookAt(target);
  }

  focusOn(playerIds) {
    if (!this.gm || !playerIds?.length) {
      this.focus = null;
      return;
    }
    this.focus = playerIds;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // 시뮬레이션 이벤트 → 연출
  handleEvents(events) {
    if (!this.gm) return;
    const gm = this.gm;
    for (const e of events) {
      switch (e.type) {
        case 'explosion': {
          const ex = gm.waves.explosions.find((x) => x.id === e.explosionId);
          if (ex) this.waveViews.push(new WaveView(this.matchRoot, ex, this.toWorld));
          const w = this.toWorld(e.x, e.y);
          this.fx.sparkle({ x: w.x, y: 0.5, z: w.z }, '#8fd8ff', 22, { spread: 0.6, up: 3 });
          this.fx.ringPulse({ x: w.x, z: w.z }, '#54c7ff', { to: 1 + (e.arms ? Math.max(...Object.values(e.arms)) : 2) * 0.9 });
          this.flash.position.set(w.x, 1, w.z);
          this.flash.intensity = 30;
          this.shake(0.22);
          break;
        }
        case 'pulse': {
          const ex = gm.waves.explosions.find((x) => x.id === e.explosionId);
          if (ex) this.waveViews.push(new WaveView(this.matchRoot, ex, this.toWorld, { pulse: true }));
          this.shake(0.08);
          break;
        }
        case 'blockDestroyed': {
          const w = this.toWorld(e.x, e.y);
          this.fx.burstDebris({ x: w.x, y: 0.2, z: w.z }, PROP_DEBRIS[e.prop] || PROP_DEBRIS.box, 14);
          break;
        }
        case 'itemPicked': {
          const p = gm.players.get(e.playerId);
          const w = this.toWorld(p.x, p.y);
          const def = ITEM_TYPES[e.itemType];
          let text = def.label;
          if (def.kind === 'stat') text = e.gained > 0 ? `${def.stat.toUpperCase()} ${e.value}` : `${def.stat.toUpperCase()} MAX`;
          this.fx.floatText({ x: w.x, y: 1.5, z: w.z }, text, e.gained === 0 && def.kind === 'stat' ? '#ff9a9a' : def.color);
          this.fx.sparkle({ x: w.x, y: 0.6, z: w.z }, def.color, 16);
          break;
        }
        case 'playerTrapped': {
          const p = gm.players.get(e.playerId);
          const w = this.toWorld(p.x, p.y);
          this.fx.ringPulse({ x: w.x, z: w.z }, '#b46bff', { to: 1.6 });
          this.fx.sparkle({ x: w.x, y: 0.7, z: w.z }, '#d9c2ff', 20);
          break;
        }
        case 'playerRescued': {
          const p = gm.players.get(e.playerId);
          const w = this.toWorld(p.x, p.y);
          this.fx.sparkle({ x: w.x, y: 0.7, z: w.z }, '#6ee3a3', 30, { spread: 0.8, up: 3 });
          this.fx.floatText({ x: w.x, y: 1.6, z: w.z }, e.method === 'needle' ? 'ESCAPE!' : 'RESCUE!', '#6ee3a3');
          break;
        }
        case 'playerEliminated': {
          const p = gm.players.get(e.playerId);
          const w = this.toWorld(p.x, p.y);
          this.fx.sparkle({ x: w.x, y: 0.7, z: w.z }, '#ffffff', 36, { spread: 1, up: 3.5 });
          this.fx.ringPulse({ x: w.x, z: w.z }, '#ffffff', { to: 2.2 });
          this.fx.floatText({ x: w.x, y: 1.6, z: w.z }, 'POP!', '#ffffff');
          this.shake(0.3);
          break;
        }
        case 'shieldBlock': {
          const p = gm.players.get(e.playerId);
          const w = this.toWorld(p.x, p.y);
          this.fx.ringPulse({ x: w.x, z: w.z }, '#7f9bff', { to: 1.4 });
          this.fx.floatText({ x: w.x, y: 1.6, z: w.z }, 'BLOCK!', '#a8b8ff');
          break;
        }
        case 'bombPlaced': {
          const w = this.toWorld(e.x, e.y);
          this.fx.sparkle({ x: w.x, y: 0.1, z: w.z }, '#ffb347', 8, { spread: 0.4, up: 1 });
          break;
        }
        case 'dash': {
          const p = gm.players.get(e.playerId);
          const w = this.toWorld(p.x, p.y);
          this.fx.sparkle({ x: w.x, y: 0.15, z: w.z }, '#e8e0d0', 10, { spread: 0.5, up: 0.6, gravity: 0 });
          break;
        }
        case 'turntableRotated':
          this.stageView.rotateDeck(e.x, e.y);
          break;
        case 'houseEvent':
          this.mrOdd.trigger(e.phase, e.kind, e.cells);
          if (e.phase === 'act') this.shake(0.35);
          break;
        case 'blocksSpawned':
          for (const c of e.cells) {
            const w = this.toWorld(c.x, c.y);
            this.fx.sparkle({ x: w.x, y: 0.1, z: w.z }, '#e8d0a0', 10, { spread: 0.6, up: 1 });
          }
          break;
        case 'windGust':
          for (let i = 0; i < 6; i++) this.fx.sparkle({ x: (Math.random() - 0.5) * this.W, y: 0.4, z: (Math.random() - 0.5) * this.H }, '#d8f0ff', 6, { spread: 0.2, up: 0.3, gravity: 0 });
          this.shake(0.12);
          break;
        case 'gatesToggled':
          for (const c of e.cells) {
            const w = this.toWorld(c.x, c.y);
            this.fx.ringPulse({ x: w.x, z: w.z }, c.open ? '#6ee3a3' : '#ff3b4f', { to: 1.2 });
          }
          this.shake(0.1);
          break;
        case 'routeOpened':
          for (const c of e.cells) {
            const w = this.toWorld(c.x, c.y);
            this.fx.sparkle({ x: w.x, y: 0.6, z: w.z }, '#ffd166', 26, { spread: 0.6, up: 2 });
          }
          break;
        default:
          break;
      }
    }
  }

  render(dt, { beat = 0 } = {}) {
    this.t += dt;
    if (dt > 0) this._adaptQuality(dt);
    const gm = this.gm;
    if (gm) {
      const rec = gm.stage.get('recPulse');
      const lightsOut = gm.house.lightsOut;
      const wind = gm.stage.get('wind');
      this.stageView.windBoost = wind ? wind.phase === 'warn' : false;
      this.stageView.update(dt, { beat, lightsOut, rec: rec ? rec.visual : null });
      if (this.stageView.recSign && rec) this.stageView.recSign.material.opacity = rec.state === 'rec' ? 0.7 + Math.sin(this.t * 8) * 0.3 : 0.25;

      // 플레이어
      for (const p of gm.players.list) this.playerViews.get(p.id)?.update(dt, p, this.t);
      this._speedTrails(dt, gm);

      // 폭탄
      const seenB = new Set();
      for (const b of gm.bombs.bombs) {
        seenB.add(b.id);
        let v = this.bombViews.get(b.id);
        if (!v) {
          const owner = gm.players.get(b.ownerId);
          v = new BombView(this.matchRoot, b, owner ? owner.color : '#ffffff');
          this.bombViews.set(b.id, v);
        }
        const vp = gm.bombs.visualPosition(b);
        const w = this.toWorld(vp.x, vp.y);
        v.update(dt, b, { x: w.x, y: vp.z, z: w.z });
      }
      for (const [id, v] of this.bombViews) {
        if (!seenB.has(id)) {
          v.dispose();
          this.bombViews.delete(id);
        }
      }

      // 아이템
      const seenI = new Set();
      for (const it of gm.items.items) {
        seenI.add(it.id);
        let v = this.itemViews.get(it.id);
        if (!v) {
          v = new ItemView(this.matchRoot, it);
          this.itemViews.set(it.id, v);
        }
        v.update(dt, it, this.toWorld);
      }
      for (const [id, v] of this.itemViews) {
        if (!seenI.has(id)) {
          v.dispose();
          this.itemViews.delete(id);
        }
      }

      // 웨이브
      this.waveViews = this.waveViews.filter((w) => {
        const alive = w.update(dt);
        if (!alive) w.dispose();
        return alive;
      });
      this.flash.intensity = damp(this.flash.intensity, 0, 10, dt);

      this.telegraph.update(dt, gm.getTelegraphs());
      this.rollingLp.update(dt, gm.stage.get('rollingLp')?.visual, this.toWorld);
      this.mrOdd.update(dt);
      this.fx.update(dt);

      // 조명 (암전 이벤트: 판정은 그대로, 시야만 제한)
      const dim = lightsOut ? 0.22 : 1;
      this.hemi.intensity = damp(this.hemi.intensity, this.baseLight.hemi * dim, 5, dt);
      this.key.intensity = damp(this.key.intensity, this.baseLight.key * (lightsOut ? 0.15 : 1), 5, dt);

      this._updateCamera(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  // 따라갈 대상: 살아 있는 플레이어 전원 (사람 플레이어는 화면 밖으로 나가지 않도록 따로 표시)
  _interest() {
    const alive = this.gm.players.list.filter((p) => !p.isEliminated);
    if (!alive.length) return null;
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of alive) {
      box.x0 = Math.min(box.x0, p.x);
      box.x1 = Math.max(box.x1, p.x);
      box.y0 = Math.min(box.y0, p.y);
      box.y1 = Math.max(box.y1, p.y);
    }
    return { box, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, humans: alive.filter((p) => !p.isBot) };
  }

  // SPEED 가 오를수록 발밑 먼지 자국이 촘촘해진다 (아이템으로 빨라진 걸 눈으로 확인)
  _speedTrails(dt, gm) {
    if (!this.trails) this.trails = new Map();
    for (const p of gm.players.list) {
      if (!p.isActive || !p.moving) continue;
      const extra = p.speedLevel - p.stats.start.speed + (p.modifiers.speedOverrideTime > 0 ? 1 : 0);
      if (extra <= 0) continue;
      let acc = (this.trails.get(p.id) || 0) + dt * (3 + extra * 4);
      if (acc >= 1) {
        acc -= 1;
        const w = this.toWorld(p.x, p.y);
        const back = { up: [0, 0.3], down: [0, -0.3], left: [0.3, 0], right: [-0.3, 0] }[p.facing] || [0, 0];
        const skate = p.modifiers.speedOverrideTime > 0;
        this.fx.sparkle({ x: w.x + back[0], y: 0.08, z: w.z + back[1] }, skate ? '#ffd166' : '#efe6d6', 2 + Math.min(3, extra), { spread: 0.18, up: 0.5, gravity: 0 });
      }
      this.trails.set(p.id, acc);
    }
  }

  _updateCamera(dt) {
    let target = this.camBase.target;
    let dist = this.camBase.dist;
    let follow = CAMERA_CONFIG.followRate;
    let zoom = CAMERA_CONFIG.zoomRate;
    const gm = this.gm;
    if (this.focus) {
      const ps = this.focus.map((id) => gm.players.get(id)).filter(Boolean);
      if (ps.length) {
        const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
        const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length;
        const w = this.toWorld(cx, cy);
        target = new THREE.Vector3(w.x, 0.3, w.z);
        dist = this.camBase.dist * 0.45;
        follow = 3;
        zoom = 3;
      }
    } else if (this.dynamicCamera && this.zoomModel && gm.phase !== 'COUNTDOWN' && gm.matchTime > CAMERA_CONFIG.startHold) {
      const it = this._interest();
      if (it) {
        const C = CAMERA_CONFIG;
        const bw = it.box.x1 - it.box.x0 + 1 + C.margin * 2;
        const bh = it.box.y1 - it.box.y0 + 1 + C.margin * 2;
        dist = Math.min(this.camMax, Math.max(this.camMin, this._distFor(bw, bh)));
        const view = this._viewSize(dist);
        // 모두 담지 못할 때도 사람 플레이어는 화면 안에 남도록 중심을 옮긴다
        let cx = it.cx;
        let cy = it.cy;
        const hx = view.w / 2 - 1.5;
        const hy = view.h / 2 - 1.5;
        for (const h of it.humans) {
          if (h.x > cx + hx) cx = h.x - hx;
          if (h.x < cx - hx) cx = h.x + hx;
          if (h.y > cy + hy) cy = h.y - hy;
          if (h.y < cy - hy) cy = h.y + hy;
        }
        // 맵 밖 빈 공간이 많이 보이지 않도록 중심을 아레나 안쪽으로 제한
        const w = this.toWorld(cx, cy);
        const base = this.camBase.target;
        const limX = Math.max(0, (this.W - view.w) / 2 + 0.6);
        const limZ = Math.max(0, (this.H - view.h) / 2 + 0.6);
        target = new THREE.Vector3(
          THREE.MathUtils.clamp(w.x, base.x - limX, base.x + limX),
          0,
          THREE.MathUtils.clamp(w.z + base.z, base.z - limZ, base.z + limZ),
        );
      }
    }
    this.camTarget.lerp(target, 1 - Math.exp(-follow * dt));
    this.camDist = damp(this.camDist, dist, zoom, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const sh = this.trauma * this.trauma * 0.35;
    const t = this.t;
    const off = new THREE.Vector3(Math.sin(t * 47) * sh, Math.sin(t * 53 + 1) * sh, Math.sin(t * 41 + 2) * sh);
    this._placeCamera(this.camTarget, this.camDist, Math.sin(t * 0.15) * 0.25);
    this.camera.position.add(off);

    // 미니맵용 화면 영역 (칸 좌표)
    if (this.zoomModel) {
      const v = this._viewSize(this.camDist);
      const cx = this.camTarget.x + (this.W - 1) / 2;
      const cy = this.camTarget.z - this.camBase.target.z + (this.H - 1) / 2;
      this.viewRect = { x0: cx - v.w / 2, x1: cx + v.w / 2, y0: cy - v.h / 2, y1: cy + v.h / 2 };
    }
  }
}
