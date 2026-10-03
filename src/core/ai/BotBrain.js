import { GAME_CONFIG } from '../../config/gameConfig.js';
import { ITEM_TYPES } from '../../config/itemConfig.js';
import { DIRS, DIR_NAMES, dirFromDelta } from '../constants.js';
import { Rng } from '../rng.js';

// ─────────────────────────────────────────────────────────────
// CPU 플레이어 (BOOM ROOM v4) — State Machine + A* + Stuck Recovery
//
// 사람과 똑같은 intent(dir/bomb/item)를 만들어 공통 PlayerController 에 넣는다.
// 캐릭터별 AI 분기 없음 — 캐릭터 차이는 Stats(SPEED/BOMB/WAVE) 뿐.
//
//   SCAN ─▶ ITEM_SEEK ─▶ ATTACK ─▶ ESCAPE ─▶ POSITIONING ─▶ SCAN
//   (갈 곳이 정말 없을 때만 WAIT — 0.25초마다 다시 길을 찾고, 대기 포즈를 보여 준다)
//
// 우선순위 (높은 순)
//   1 위험 지역 탈출          5 상대 동선 차단
//   2 갇히지 않는 위치 확보    6 Beat Bomb 설치
//   3 필요한 성장 아이템       7 특수 아이템
//   4 부술 상자 접근           8 상대 추적
//
// STUCK CHECK: 같은 칸에 1초 이상 머물면 경로 폐기 → 새 도달 가능 칸 → 없으면 주변 안전 칸.
// 멈춰 보이지 않기: 목표가 없으면 열린 칸 → 옆 안전 칸(왔다 갔다) → 늦게 터지는 칸을 지나 밖으로
//   → 가장 열린 칸 → 그래도 없으면 WAIT (Look Around / Ready / Danger Wait 포즈)
// 폭탄은 "터지기 전에 도달 가능한 안전 칸"이 있을 때만 놓는다.
// ─────────────────────────────────────────────────────────────

const INF = Infinity;

export const BOT_STATE = Object.freeze({
  SCAN: 'SCAN',
  ITEM_SEEK: 'ITEM_SEEK',
  ATTACK: 'ATTACK',
  ESCAPE: 'ESCAPE',
  POSITIONING: 'POSITIONING',
  WAIT: 'WAIT',
  TRAPPED: 'TRAPPED',
});

// 대기 포즈 (렌더 전용 힌트 — 게임 판정과 무관)
export const BOT_POSE = Object.freeze({ LOOK_AROUND: 'lookAround', READY: 'ready', DANGER_WAIT: 'dangerWait' });
const ST = BOT_STATE;

export const BOT_CONFIG = {
  stuckTime: 1.0, // 같은 칸에 이만큼(초) 머물면 STUCK → 경로 폐기 후 재탐색
  idleMoveAfter: 0.5, // 위험하지 않은데 이만큼 같은 칸이면 다른 칸으로 (왔다 갔다라도)
  waitRethink: 0.25, // WAIT 상태에서 길 다시 찾기 간격
  crossMargin: 0.8, // 늦게 터지는 칸을 지나갈 때 폭발 전 여유 (초)
  blockedTime: 0.45, // 이동 입력 중인데 좌표가 그대로면 경로가 막힌 것
  blacklistTime: 4, // STUCK 으로 버린 목표 칸은 잠시 다시 고르지 않는다
  bombEscapeMargin: 0.45, // 폭발 전 안전 칸 도착 여유 (초)
  switchMargin: 2.5, // 목표 교체 히스테리시스
  // 경기 템포별 가중치 — 초반엔 파밍, 후반엔 공격
  tempo: {
    early: { item: 1.3, farm: 1.35, attack: 0.45, chase: 0.2 },
    mid: { item: 1.0, farm: 1.0, attack: 1.0, chase: 0.7 },
    late: { item: 0.8, farm: 0.6, attack: 1.45, chase: 1.3 },
  },
};

// 폭탄 하나의 Wave 가 닿을 칸 (SoundWaveManager 와 같은 규칙)
export function blastCells(gm, x0, y0, range, ignoreBomb = null) {
  const { grid } = gm;
  const cells = [{ x: x0, y: y0 }];
  const hitBombs = [];
  for (const dir of DIR_NAMES) {
    const d = DIRS[dir];
    for (let s = 1; s <= range; s++) {
      const x = x0 + d.x * s;
      const y = y0 + d.y * s;
      const inter = grid.waveInteraction(x, y);
      if (inter === 'block') break;
      cells.push({ x, y });
      if (inter === 'destroy') break;
      const b = gm.bombs.at(x, y);
      if (b && b !== ignoreBomb) {
        hitBombs.push(b);
        break;
      }
    }
  }
  return { cells, hitBombs };
}

// 각 칸이 Wave 에 맞기까지 남은 시간 (Infinity = 안전). extraBomb = 가상의 폭탄 {x,y,range,t}
// viewer 를 주면: REMOTE 를 가진 상대의 폭탄은 언제든 터질 수 있다고 본다
export function computeDanger(gm, extraBomb = null, viewer = null) {
  const { grid } = gm;
  const W = grid.width;
  const danger = new Float64Array(W * grid.height).fill(INF);
  const rate = gm.bombs.fuseRate || 1;

  for (const w of gm.waves.cells.values()) danger[w.y * W + w.x] = 0;

  const remoteRisk = (b) => {
    if (!viewer || b.ownerId === viewer.id) return INF;
    const owner = gm.players.get(b.ownerId);
    return owner && owner.isActive && owner.abilities.remote ? 0.7 : INF;
  };
  const entries = gm.bombs.bombs
    .filter((b) => !b.flying)
    .map((b) => ({ b, x: b.x, y: b.y, range: b.range, t: Math.min(Math.max(0, b.fuse) / rate, remoteRisk(b)) }));
  for (const b of gm.bombs.bombs) {
    if (b.flying && b.motion) {
      entries.push({ b, x: b.motion.toX, y: b.motion.toY, range: b.range, t: Math.max(b.fuse, GAME_CONFIG.bomb.minFuseAfterLanding) / rate });
    }
  }
  if (extraBomb) entries.push({ b: null, ...extraBomb });

  // DJ BOOTH 턴테이블: 회전이 다가오면 링 위 폭탄은 "다음 칸"에서도 터질 수 있다
  const tt = gm.stage?.get?.('turntables');
  let ringSoon = null;
  if (tt && tt.decks.length) {
    const until = tt.cfg.interval - tt.timer;
    if (until < 2.2) {
      ringSoon = until;
      for (const d of tt.decks) {
        d.ring.forEach((c, i) => {
          for (const e of entries.slice()) {
            if (e.x === c.x && e.y === c.y && e.t > until) {
              const n = d.ring[(i + 1) % d.ring.length];
              entries.push({ b: e.b, x: n.x, y: n.y, range: e.range, t: e.t });
            }
          }
        });
      }
    }
  }

  const blasts = entries.map((e) => blastCells(gm, e.x, e.y, e.range, e.b));
  // Chain Reaction 반영 (완화 반복)
  for (let iter = 0; iter < 6; iter++) {
    let changed = false;
    entries.forEach((e, i) => {
      for (const c of blasts[i].cells) {
        entries.forEach((o, j) => {
          if (j !== i && o.x === c.x && o.y === c.y && o.t > e.t + GAME_CONFIG.bomb.chainDelay) {
            o.t = e.t + GAME_CONFIG.bomb.chainDelay;
            changed = true;
          }
        });
      }
    });
    if (!changed) break;
  }
  entries.forEach((e, i) => {
    for (const c of blasts[i].cells) {
      const k = c.y * W + c.x;
      if (e.t < danger[k]) danger[k] = e.t;
    }
  });

  // 회전 직전의 링 칸은 서 있으면 실려 가므로 위험으로 본다 (밟고 지나가지 않음)
  if (ringSoon !== null && ringSoon < 1.4) {
    for (const d of tt.decks) {
      for (const c of d.ring) {
        const k = c.y * W + c.x;
        if (ringSoon + 0.4 < danger[k]) danger[k] = ringSoon + 0.4;
      }
    }
  }

  // 기믹 경고 (Rolling LP / 앰프 Pulse / 상자 낙하) 도 위험으로 간주
  for (const tg of gm.getTelegraphs()) {
    if (tg.kind === 'lane' || tg.kind === 'pulse' || tg.kind === 'drop') {
      const remain = Math.max(0, (1 - (tg.progress ?? 0)) * 1.5);
      for (const c of tg.cells) {
        const k = c.y * W + c.x;
        if (remain < danger[k]) danger[k] = remain;
      }
    }
  }
  return danger;
}

// 작은 이진 힙 (A* / Dijkstra 용)
class MinHeap {
  constructor() {
    this.k = [];
    this.p = [];
  }
  get size() {
    return this.k.length;
  }
  push(key, pri) {
    const { k, p } = this;
    let i = k.length;
    k.push(key);
    p.push(pri);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= p[i]) break;
      [k[i], k[j]] = [k[j], k[i]];
      [p[i], p[j]] = [p[j], p[i]];
      i = j;
    }
  }
  pop() {
    const { k, p } = this;
    const top = k[0];
    const lk = k.pop();
    const lp = p.pop();
    if (k.length) {
      k[0] = lk;
      p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[i], k[m]] = [k[m], k[i]];
        [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}

// 지나가는 순간 그 칸이 터지는가 (Wave 잔류 시간 포함)
function hitWindow(dv, t) {
  return dv === 0 || (dv < t + 0.35 && dv > t - 0.6);
}

export class BotBrain {
  constructor(playerId, { skill = 0.75, seed = 1 } = {}) {
    this.playerId = playerId;
    this.skill = skill;
    this.seed = seed;
    this.rng = new Rng(seed * 7919 + playerId * 104729 + 13);
    this.state = ST.SCAN;
    this.stateTime = 0;
    this.thinkTimer = 0;
    this.path = null; // [{x,y}] 현재 따라가는 경로
    this.target = null; // { x, y, kind, score }
    this.stuck = { key: -1, t: 0 };
    this.blocked = { t: 0, x: 0, y: 0 };
    this.blacklist = new Map(); // cellKey → 만료 시각
    this.stuckRecoveries = 0;
    this.lastDir = null;
    this.clock = 0;
    this.pose = null; // 대기 포즈 힌트 (BOT_POSE)
    this.prevCell = -1; // 왔다 갔다 할 때 직전 칸
  }

  // 매 틱 호출 → intent
  update(gm, dt) {
    const p = gm.players.get(this.playerId);
    const out = { dir: null, bomb: false, item: false, pose: null };
    if (!p || p.isEliminated) return out;
    this.clock += dt;
    this.stateTime += dt;
    this.thinkTimer -= dt;

    this._trackStuck(gm, p, dt);

    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.07 + (1 - this.skill) * 0.14 + this.rng.next() * 0.04;
      const d = this.think(gm, p);
      out.bomb = d.bomb;
      out.item = d.item;
      if (d.dir !== undefined && !this.path) out.dir = d.dir;
    }
    if (this.path) out.dir = this._follow(p);
    else if (!out.dir && this._fallbackDir) out.dir = this._fallbackDir;
    this.lastDir = out.dir;
    out.pose = out.dir ? null : this.pose;
    return out;
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
  }

  // ── STUCK CHECK ─────────────────────────────────
  _trackStuck(gm, p, dt) {
    if (!p.isActive) {
      this.stuck.t = 0;
      return;
    }
    const W = gm.grid.width;
    const key = p.cellY * W + p.cellX;
    if (key === this.stuck.key) this.stuck.t += dt;
    else {
      this.prevCell = this.stuck.key;
      this.stuck.key = key;
      this.stuck.t = 0;
    }
    // 이동 입력 중인데 좌표가 그대로 → 경로가 막혔다 (다른 폭탄 등) → 즉시 재계획
    if (this.lastDir && Math.abs(p.x - this.blocked.x) + Math.abs(p.y - this.blocked.y) < 0.004) {
      this.blocked.t += dt;
      if (this.blocked.t >= BOT_CONFIG.blockedTime) {
        this.blocked.t = 0;
        this.path = null;
        this.thinkTimer = 0;
      }
    } else this.blocked.t = 0;
    this.blocked.x = p.x;
    this.blocked.y = p.y;

    if (this.stuck.t >= BOT_CONFIG.stuckTime) {
      this.stuck.t = 0;
      this._recoverStuck(gm, p);
    }
  }

  // 경로 폐기 → 새 도달 가능 칸 → 없으면 주변 안전 칸
  _recoverStuck(gm, p) {
    const { grid } = gm;
    const W = grid.width;
    if (this.target) this.blacklist.set(this.target.y * W + this.target.x, this.clock + BOT_CONFIG.blacklistTime);
    this.path = null;
    this.target = null;
    this.stuckRecoveries++;
    const danger = computeDanger(gm, null, p);
    const field = this._search(gm, p, danger);
    const here = p.cellY * W + p.cellX;
    const options = [];
    for (let k = 0; k < field.cost.length; k++) {
      if (field.cost[k] === INF || k === here || danger[k] !== INF) continue;
      const s = field.steps[k];
      if (s < 2 || s > 9 || this._blacklisted(k)) continue;
      const x = k % W;
      const y = (k - x) / W;
      options.push({ k, w: this._openness(gm, p, x, y) + this.rng.next() * 2 });
    }
    options.sort((a, b) => b.w - a.w);
    let pick = options[0]?.k;
    if (pick === undefined) {
      for (const dir of this.rng.shuffle(DIR_NAMES.slice())) {
        const d = DIRS[dir];
        const nx = p.cellX + d.x;
        const ny = p.cellY + d.y;
        if (gm.isBlockedFor(p, nx, ny)) continue;
        if (danger[ny * W + nx] === INF || danger[here] !== INF) {
          pick = ny * W + nx;
          break;
        }
      }
    }
    if (pick === undefined) return;
    const x = pick % W;
    const y = (pick - x) / W;
    const path = field.cost[pick] !== INF ? this._pathTo(field, pick) : [{ x: p.cellX, y: p.cellY }, { x, y }];
    this.path = path;
    this.target = { x, y, kind: 'position', score: 0, until: this.clock + 2.5 };
    this._setState(danger[here] !== INF ? ST.ESCAPE : ST.POSITIONING);
  }

  _blacklisted(k) {
    const t = this.blacklist.get(k);
    if (t === undefined) return false;
    if (t < this.clock) {
      this.blacklist.delete(k);
      return false;
    }
    return true;
  }

  // ── 경로 따라가기 (매 틱) ───────────────────────
  _follow(p) {
    const path = this.path;
    const cx = p.cellX;
    const cy = p.cellY;
    const i = path.findIndex((c) => c.x === cx && c.y === cy);
    if (i < 0) {
      this.path = null;
      return null;
    }
    if (i === path.length - 1) {
      const ox = cx - p.x;
      const oy = cy - p.y;
      if (Math.abs(ox) < 0.12 && Math.abs(oy) < 0.12) {
        this.path = null;
        return null;
      }
      return Math.abs(ox) > Math.abs(oy) ? (ox > 0 ? 'right' : 'left') : oy > 0 ? 'down' : 'up';
    }
    const n = path[i + 1];
    return dirFromDelta(n.x - cx, n.y - cy);
  }

  _arrival(p, steps) {
    return steps / Math.max(1, p.moveSpeed) + 0.15;
  }

  // ── A* (goal 지정) / Dijkstra (goal 없음 → 전체 비용장) ──
  //   비용 = 1칸 1 + 곧 터질 칸 통과 2.5 + 상대 바로 옆 0.6
  //   지나가는 순간 터지는 칸은 통과 불가
  //   strict  : 위험 칸(곧 터질 칸)은 아예 지나가지 않는다 — 평소 목표 이동용 (ESCAPE ↔ 이동 왕복 방지)
  //   relaxed : 지나가는 타이밍을 무시 — 안전 경로가 전혀 없을 때의 마지막 탈출 시도
  _search(gm, who, danger, { goal = -1, from = -1, blockExtra = -1, strict = false, relaxed = false } = {}) {
    const { grid } = gm;
    const W = grid.width;
    const N = W * grid.height;
    const cost = new Float64Array(N).fill(INF);
    const steps = new Int16Array(N).fill(-1);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const start = from >= 0 ? from : who.cellY * W + who.cellX;
    const gx = goal >= 0 ? goal % W : 0;
    const gy = goal >= 0 ? (goal - gx) / W : 0;
    const h = (k) => {
      if (goal < 0) return 0;
      const x = k % W;
      return Math.abs(x - gx) + Math.abs((k - x) / W - gy);
    };
    const enemies = gm.players.list.filter((o) => o !== who && o.isActive && !gm.mode.areAllies(o, who));
    const speed = Math.max(1, who.moveSpeed);
    cost[start] = 0;
    steps[start] = 0;
    const heap = new MinHeap();
    heap.push(start, h(start));
    while (heap.size) {
      const k = heap.pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === goal) break;
      const x = k % W;
      const y = (k - x) / W;
      for (const dir of DIR_NAMES) {
        const d = DIRS[dir];
        const nx = x + d.x;
        const ny = y + d.y;
        if (!grid.inBounds(nx, ny)) continue;
        const nk = ny * W + nx;
        if (closed[nk] || nk === blockExtra || gm.isBlockedFor(who, nx, ny)) continue;
        const s = steps[k] + 1;
        const dv = danger[nk];
        if (strict ? dv !== INF : relaxed ? dv === 0 : hitWindow(dv, s / speed + 0.15)) continue;
        let c = cost[k] + 1;
        if (dv !== INF) c += 2.5;
        for (const e of enemies) if (Math.abs(e.cellX - nx) + Math.abs(e.cellY - ny) <= 1) c += 0.6;
        if (c < cost[nk]) {
          cost[nk] = c;
          steps[nk] = s;
          parent[nk] = k;
          heap.push(nk, c + h(nk));
        }
      }
    }
    return { cost, steps, parent, W, start };
  }

  _pathTo(field, k) {
    const { parent, W, start } = field;
    const out = [];
    let c = k;
    for (let guard = 0; c >= 0 && guard < 600; guard++) {
      const x = c % W;
      out.push({ x, y: (c - x) / W });
      if (c === start) break;
      c = parent[c];
    }
    return out.reverse();
  }

  _openness(gm, p, x, y) {
    let n = 0;
    for (const dir of DIR_NAMES) {
      const d = DIRS[dir];
      if (!gm.isBlockedFor(p, x + d.x, y + d.y)) n++;
    }
    return n;
  }

  // 상대가 다음 폭탄으로 노릴 수 있는 칸인가 (상대 Wave 길이의 직선 위)
  _enemyThreat(gm, p, x, y) {
    let t = 0;
    for (const o of gm.players.list) {
      if (o === p || !o.isActive || gm.mode.areAllies(o, p)) continue;
      if (o.activeBombs >= o.maxBombs) continue;
      const dx = Math.abs(o.cellX - x);
      const dy = Math.abs(o.cellY - y);
      if ((dx === 0 && dy <= o.waveRange) || (dy === 0 && dx <= o.waveRange)) t++;
    }
    return t;
  }

  // 위험(danger)을 피해 도달 가능한 "갇히지 않는" 안전 칸까지의 경로
  _safePath(gm, p, danger, { limitTime = INF, from = -1, relaxed = false } = {}) {
    const field = this._search(gm, p, danger, { from, relaxed });
    const W = field.W;
    let best = -1;
    let bestScore = INF;
    for (let k = 0; k < field.cost.length; k++) {
      if (field.cost[k] === INF || danger[k] !== INF) continue;
      if (this._arrival(p, field.steps[k]) >= limitTime) continue;
      const x = k % W;
      const y = (k - x) / W;
      // 막다른 길 / 상대 직선 위는 피한다 (갇히지 않는 위치 확보)
      //   옆에 안전 칸이 하나도 없는 칸(한 칸짜리 구석)은 폭발까지 꼼짝 못 하므로 덜 고른다
      let safeNb = 0;
      for (const dir of DIR_NAMES) {
        const d = DIRS[dir];
        if (!gm.isBlockedFor(p, x + d.x, y + d.y) && danger[(y + d.y) * W + x + d.x] === INF) safeNb++;
      }
      const score = field.cost[k] - this._openness(gm, p, x, y) * 0.45 + this._enemyThreat(gm, p, x, y) * 1.5 + (safeNb === 0 ? 1.2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    return best >= 0 ? this._pathTo(field, best) : null;
  }

  _pathStillSafe(gm, p, danger) {
    if (!this.path) return false;
    const W = gm.grid.width;
    const i = this.path.findIndex((c) => c.x === p.cellX && c.y === p.cellY);
    if (i < 0) return false;
    const end = this.path[this.path.length - 1];
    if (danger[end.y * W + end.x] !== INF) return false;
    for (let j = i + 1; j < this.path.length; j++) {
      const c = this.path[j];
      if (gm.isBlockedFor(p, c.x, c.y)) return false;
      if (hitWindow(danger[c.y * W + c.x], this._arrival(p, j - i))) return false;
    }
    return true;
  }

  _noise(x, y) {
    let h = (x * 73856093) ^ (y * 19349663) ^ (this.seed * 83492791) ^ (this.playerId * 2654435761);
    h = (h ^ (h >>> 13)) >>> 0;
    return (h % 1000) / 1000;
  }

  // ── 필요 기반 아이템 가치 ───────────────────────
  //   이미 MAX 인 능력치 아이템은 무시. 많이 부족한 능력치일수록 우선.
  //   예) SPEED 2/5 · BOMB 3/3 · WAVE 1/4 → WAVE UP > SPEED UP > 특수 > (BOMB UP 무시)
  itemValue(p, type, gm = null) {
    const def = ITEM_TYPES[type];
    if (!def) return 0;
    if (def.kind === 'stat') {
      const st = p.stats;
      const k = def.stat;
      if (st.current[k] >= st.max[k]) return 0;
      const missing = (st.max[k] - st.current[k]) / st.max[k];
      return 10 + 12 * missing;
    }
    if (def.kind === 'ability') {
      if (p.abilities[type]) return 0;
      return type === 'kick' ? 9 : 8.5;
    }
    if (def.kind === 'held') {
      if (p.heldItem) return p.heldItem.type === type ? 0 : 1.5;
      if (type === 'needle') return gm?.mode?.def?.team ? 9.5 : 8.5;
      if (type === 'rollerSkates') return 7.5;
      return 9; // shield
    }
    return 7.5; // random box
  }

  // (x,y)에 폭탄을 놓았을 때: 부술 상자 / 맞는 상대 / 맞는 아군 / 잃는 아이템
  _spotInfo(gm, p, x, y, danger) {
    const { cells } = blastCells(gm, x, y, p.waveRange);
    const W = gm.grid.width;
    let boxes = 0;
    let enemies = 0;
    let allies = 0;
    let itemLoss = 0;
    for (const c of cells) {
      const cell = gm.grid.get(c.x, c.y);
      // 이미 다른 폭탄이 부술 상자는 세지 않는다 (중복 폭탄 방지)
      if (cell && cell.type === 'BREAKABLE' && danger[c.y * W + c.x] === INF) boxes += cell.routeCrate ? 1.5 : 1;
      if (gm.items.at(c.x, c.y)) itemLoss++;
      for (const o of gm.players.list) {
        if (o === p || !o.isActive) continue;
        if (Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= 0.8) continue;
        if (gm.mode.areAllies(o, p)) allies++;
        else enemies++;
      }
    }
    return { boxes, enemies, allies, itemLoss };
  }

  // 상대가 가상의 폭탄을 피해 갈 수 있는 안전 칸 수 (동선 차단 평가)
  _enemyEscapes(gm, e, d2, bombKey) {
    const field = this._search(gm, e, d2, { blockExtra: bombKey });
    let n = 0;
    for (let k = 0; k < field.cost.length; k++) {
      if (field.cost[k] !== INF && field.steps[k] <= 8 && d2[k] === INF) {
        n++;
        if (n >= 4) break;
      }
    }
    return n;
  }

  // 폭탄을 놓아도 되는가 — 폭발 전에 도달 가능한 "갇히지 않는" 안전 칸이 있어야 한다
  _safeBombPlan(gm, p, x, y) {
    const fuse = GAME_CONFIG.bomb.fuseTime / (gm.bombs.fuseRate || 1);
    const d2 = computeDanger(gm, { x, y, range: p.waveRange, t: fuse }, p);
    const W = gm.grid.width;
    const from = y * W + x;
    const esc = this._safePath(gm, p, d2, { limitTime: fuse - BOT_CONFIG.bombEscapeMargin, from });
    if (!esc || esc.length < 2) return null;
    // 도착한 안전 칸에서도 숨 쉴 공간(안전 칸 2개 이상)이 있어야 한다
    const end = esc[esc.length - 1];
    const field = this._search(gm, p, d2, { from: end.y * W + end.x, blockExtra: from });
    let room = 0;
    for (let k = 0; k < field.cost.length && room < 2; k++) if (field.cost[k] !== INF && field.steps[k] <= 4 && d2[k] === INF) room++;
    if (room < 2) return null;
    return { path: esc, d2 };
  }

  // ─────────────────────────────────────────────────
  think(gm, p) {
    const res = { dir: undefined, bomb: false, item: false };
    this._fallbackDir = null;
    this.pose = null;
    const { grid } = gm;
    const W = grid.width;

    if (p.isTrapped) {
      this._setState(ST.TRAPPED);
      this.path = null;
      this.target = null;
      if (p.heldItem?.type === 'needle') res.item = true;
      return res;
    }
    if (!p.isActive) return res;
    if (this.state === ST.TRAPPED) this._setState(ST.SCAN);

    const danger = computeDanger(gm, null, p);
    const here = p.cellY * W + p.cellX;

    // ── 1) ESCAPE: 위험 지역 탈출 ──
    if (danger[here] !== INF) {
      if (this.state === ST.ESCAPE && this._pathStillSafe(gm, p, danger)) return res;
      const path = this._safePath(gm, p, danger);
      this._setState(ST.ESCAPE);
      this.target = null;
      if (path && path.length > 1) {
        this.path = path;
        return res;
      }
      // 제때 닿는 안전 칸이 없으면 → 타이밍을 무시하고라도 가장 가까운 안전 칸으로 (멈춰 서지 않는다)
      const gamble = this._safePath(gm, p, danger, { relaxed: true });
      if (gamble && gamble.length > 1) {
        this.path = gamble;
        return res;
      }
      // 그래도 없으면 가장 늦게 터지는 / 가장 열린 이웃으로
      this.path = null;
      let bestS = -INF;
      let bestDir = null;
      for (const dir of DIR_NAMES) {
        const d = DIRS[dir];
        const nx = p.cellX + d.x;
        const ny = p.cellY + d.y;
        if (gm.isBlockedFor(p, nx, ny)) continue;
        const dv = danger[ny * W + nx];
        const sc = (dv === INF ? 50 : dv) * 4 + this._openness(gm, p, nx, ny);
        if (sc > bestS) {
          bestS = sc;
          bestDir = dir;
        }
      }
      res.dir = bestDir;
      this._fallbackDir = bestDir;
      if (!bestDir) this.pose = BOT_POSE.DANGER_WAIT;
      return res;
    }
    // 탈출 완료 → 내 폭탄이 터질 때까지 POSITIONING
    if (this.state === ST.ESCAPE) {
      this.path = null;
      this.target = null;
      this._setState(ST.POSITIONING);
    }

    // ── 아이템 키 (사람과 같은 E 키 규칙) ──
    res.item = this._wantItemKey(gm, p);

    const field = this._search(gm, p, danger, { strict: true });

    // ── 갇힌 팀원 구출 / 갇힌 상대 마무리 (터치) ──
    const cap = this._capsuleTarget(gm, p, field);
    if (cap) {
      const o = cap.o;
      const k = o.cellY * W + o.cellX;
      this._setState(ST.ATTACK);
      if (k === here) {
        this.path = null;
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        res.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        return res;
      }
      this.path = this._pathTo(field, k);
      this.target = { x: o.cellX, y: o.cellY, kind: 'capsule', score: 99 };
      return res;
    }

    const tempo = BOT_CONFIG.tempo[gm.tempo] || BOT_CONFIG.tempo.mid;
    const canBomb = p.activeBombs < p.maxBombs && !gm.bombs.at(p.cellX, p.cellY);

    // ── 지금 이 칸에 폭탄을 놓을 가치가 있으면 (동선 차단 / 상자) 바로 설치 ──
    if (canBomb) {
      const info = this._spotInfo(gm, p, p.cellX, p.cellY, danger);
      const atSpot = this.target && this.target.kind === 'bomb' && this.target.x === p.cellX && this.target.y === p.cellY;
      let want = false;
      if (info.allies === 0) {
        if (atSpot && (info.boxes > 0 || info.enemies > 0 || this.target.trap)) want = true;
        else if (info.enemies > 0 && gm.tempo !== 'early') want = true;
        else if (info.boxes >= 2 && info.itemLoss === 0) want = true;
        else if (info.boxes >= 1 && info.itemLoss === 0 && this.rng.next() < 0.25 + this.skill * 0.25) want = true;
      }
      if (want) {
        const plan = this._safeBombPlan(gm, p, p.cellX, p.cellY);
        if (plan) {
          res.bomb = true;
          this.path = plan.path;
          this.target = null;
          this._setState(ST.ESCAPE);
          return res;
        }
        if (atSpot) {
          this.blacklist.set(here, this.clock + 3);
          this.target = null;
          this.path = null;
        }
      }
    }

    // ── SCAN: 목표 선택 (우선순위 2~8 을 점수로) ──
    const best = this._chooseTarget(gm, p, danger, field, tempo, canBomb || p.activeBombs < p.maxBombs);
    const cur = this._currentTargetScore(gm, p, danger, field, tempo);
    if (!best && cur === null) {
      // 아무 목표도 없으면 → POSITIONING (멈춰 있지 않는다)
      if (!this.path) this._wander(gm, p, danger, field);
      if (!this.path) this.pose = this._waitPose(gm, p, danger);
      return res;
    }
    if (cur === null || (best && best.score > cur + BOT_CONFIG.switchMargin)) {
      this.target = best;
      const k = best.y * W + best.x;
      this.path = k === here ? null : this._pathTo(field, k);
      this._setState(best.state);
    } else if (this.target && !this.path) {
      const k = this.target.y * W + this.target.x;
      if (k !== here && field.cost[k] !== INF) this.path = this._pathTo(field, k);
    }

    // 멈춰 서 있지 않기: 위험하지 않은데 0.5초 넘게 같은 칸이면 바로 다른 칸으로 (STUCK CHECK 보다 먼저)
    if (!this.path && !res.bomb && this.stuck.t > BOT_CONFIG.idleMoveAfter) {
      this.blacklist.set(here, this.clock + 2);
      this._wander(gm, p, danger, field);
    }

    // 다음 칸이 곧 위험해지면 멈춤
    if (this.path) {
      const i = this.path.findIndex((c) => c.x === p.cellX && c.y === p.cellY);
      const n = i >= 0 ? this.path[i + 1] : null;
      if (n && danger[n.y * W + n.x] !== INF && hitWindow(danger[n.y * W + n.x], this._arrival(p, 1))) {
        this.path = null;
        res.dir = null;
        this.pose = BOT_POSE.DANGER_WAIT;
      }
    }
    if (!this.path && !res.bomb && res.dir == null && !this.pose) this.pose = this._waitPose(gm, p, danger);
    return res;
  }

  // 아이템 키(E) 사용 판단 — ItemManager.useItemKey 의 우선순위와 동일하게 예측
  _wantItemKey(gm, p) {
    // GLOVE: 손 닿는 Bomb 을 상대 쪽으로 던지기
    if (p.abilities.glove) {
      const d = DIRS[p.facing];
      const reach = gm.bombs.at(p.cellX, p.cellY) || gm.bombs.at(p.cellX + d.x, p.cellY + d.y);
      if (reach) return this._enemyInLine(gm, p, 6);
    }
    if (p.heldItem?.type === 'rollerSkates') return true;
    if (p.abilities.remote) {
      const own = gm.bombs.bombs.filter((b) => b.ownerId === p.id && !b.flying).sort((a, b) => a.placedAt - b.placedAt);
      const b = own[0];
      if (b) {
        const { cells } = blastCells(gm, b.x, b.y, b.range, b);
        const hits = (o) => cells.some((c) => c.x === o.cellX && c.y === o.cellY);
        const hitsEnemy = gm.players.list.some((o) => o.isActive && !gm.mode.areAllies(o, p) && hits(o));
        const hitsFriend = gm.players.list.some((o) => o.isActive && (o === p || gm.mode.areAllies(o, p)) && hits(o));
        if (hitsEnemy && !hitsFriend) return true;
      }
    }
    return false;
  }

  _currentTargetScore(gm, p, danger, field, tempo) {
    const t = this.target;
    if (!t) return null;
    const W = gm.grid.width;
    const k = t.y * W + t.x;
    if (field.cost[k] === INF || danger[k] !== INF || this._blacklisted(k)) return null;
    if (t.until !== undefined && this.clock > t.until) return null;
    if (t.kind === 'item') {
      const it = gm.items.at(t.x, t.y);
      if (!it) return null;
      return this.itemValue(p, it.type, gm) * tempo.item * 1.6 - field.cost[k] * 1.1 + 2;
    }
    if (t.kind === 'bomb') {
      if (p.activeBombs >= p.maxBombs) return null;
      const info = this._spotInfo(gm, p, t.x, t.y, danger);
      if (info.allies > 0) return null;
      if (info.boxes === 0 && info.enemies === 0 && !t.trap) return null;
      return t.score + 1;
    }
    // 추적 / 위치 목표에 도착하면 다시 SCAN
    if (t.kind === 'chase' || t.kind === 'position') return k === p.cellY * W + p.cellX ? null : t.score;
    return null;
  }

  _chooseTarget(gm, p, danger, field, tempo, bombsLeft) {
    const W = gm.grid.width;
    const here = p.cellY * W + p.cellX;
    let best = null;
    const consider = (c) => {
      if (!best || c.score > best.score) best = c;
    };

    // 3·7) 아이템 — 필요 기반
    for (const it of gm.items.items) {
      const k = it.y * W + it.x;
      if (field.cost[k] === INF || field.steps[k] > 14 || danger[k] !== INF || this._blacklisted(k)) continue;
      const v = this.itemValue(p, it.type, gm);
      if (v <= 0) continue;
      const score = v * tempo.item * 1.6 - field.cost[k] * 1.1 + this._noise(it.x, it.y);
      consider({ x: it.x, y: it.y, kind: 'item', state: ST.ITEM_SEEK, score });
    }

    // 4·5·6) 폭탄 자리 — 상자(파밍) / 상대(공격·동선 차단)
    if (bombsLeft) {
      const enemies = gm.players.list.filter((o) => o !== p && o.isActive && !gm.mode.areAllies(o, p));
      const spots = [];
      for (let k = 0; k < field.cost.length; k++) {
        if (field.cost[k] === INF || field.steps[k] > 13 || danger[k] !== INF || this._blacklisted(k)) continue;
        const x = k % W;
        const y = (k - x) / W;
        if (gm.bombs.at(x, y)) continue;
        const info = this._spotInfo(gm, p, x, y, danger);
        if (info.allies > 0) continue;
        // 초반(파밍 구간)에는 가까이 있는 상대만 노린다
        const reach = gm.tempo === 'early' ? Math.min(p.waveRange + 1, 3) : p.waveRange + 1;
        const nearEnemy = (gm.tempo !== 'early' || field.cost[k] <= 5) && enemies.some((e) => Math.abs(e.cellX - x) + Math.abs(e.cellY - y) <= reach);
        if (info.boxes === 0 && info.enemies === 0 && !nearEnemy) continue;
        const farm = info.boxes * 3.2 * tempo.farm - info.itemLoss * 3;
        const attack = info.enemies * 5 * tempo.attack;
        const score = farm + attack - field.cost[k] * 0.9 + this._noise(x, y) * 1.5 + (k === here ? 0.5 : 0);
        spots.push({ x, y, k, kind: 'bomb', state: info.enemies > 0 || nearEnemy ? ST.ATTACK : ST.ITEM_SEEK, score, nearEnemy });
      }
      spots.sort((a, b) => b.score - a.score);
      // 상위 후보 몇 개만 "상대 동선 차단" 정밀 평가 (가상 폭탄 → 상대가 피할 칸 수)
      const fuse = GAME_CONFIG.bomb.fuseTime / (gm.bombs.fuseRate || 1);
      let evaluated = 0;
      for (const s of spots) {
        if (!s.nearEnemy) continue;
        if (evaluated++ >= 4) break;
        const d2 = computeDanger(gm, { x: s.x, y: s.y, range: p.waveRange, t: fuse });
        for (const e of enemies) {
          if (Math.abs(e.cellX - s.x) + Math.abs(e.cellY - s.y) > p.waveRange + 3) continue;
          const inBlast = d2[e.cellY * W + e.cellX] !== INF;
          const escapes = this._enemyEscapes(gm, e, d2, s.k);
          if (inBlast && escapes === 0) {
            s.score += 14 * tempo.attack;
            s.trap = true;
          } else if (inBlast && escapes <= 2) s.score += 5 * tempo.attack;
          else if (escapes <= 1) {
            s.score += 3 * tempo.attack;
            s.trap = true;
          }
        }
        s.state = ST.ATTACK;
      }
      for (const s of spots.slice(0, 12)) consider(s);
    }

    // 8) 상대 추적 — 부술 상자가 줄어들수록 / 후반일수록 적극적으로
    const enemies = gm.players.list.filter((o) => o !== p && o.isActive && !gm.mode.areAllies(o, p));
    if (enemies.length && tempo.chase > 0) {
      if (this.initialBoxes === undefined) this.initialBoxes = Math.max(1, gm.grid.cells.filter((c) => c.type === 'BREAKABLE').length);
      const boxesLeft = gm.grid.cells.filter((c) => c.type === 'BREAKABLE').length;
      const scarcity = 1 - Math.min(1, boxesLeft / this.initialBoxes);
      let chase = null;
      for (let k = 0; k < field.cost.length; k++) {
        if (k === here || field.cost[k] === INF || danger[k] !== INF || this._blacklisted(k)) continue;
        const x = k % W;
        const y = (k - x) / W;
        for (const e of enemies) {
          const dx = Math.abs(e.cellX - x);
          const dy = Math.abs(e.cellY - y);
          const md = dx + dy;
          if (md < 2) continue; // 바로 옆에 붙지는 않는다
          // 상대가 내 Wave 직선 위에 들어오는 칸 선호
          const inLine = (dx === 0 && dy <= p.waveRange) || (dy === 0 && dx <= p.waveRange) ? 1.5 : 0;
          const s = inLine - md * 0.5 - field.cost[k] * 0.12 + this._noise(x, y) * 0.5;
          if (!chase || s > chase.s) chase = { s, x, y };
        }
      }
      if (chase) consider({ x: chase.x, y: chase.y, kind: 'chase', state: ST.ATTACK, score: (2 + 4 * scarcity) * tempo.chase + chase.s * 0.3 });
    }

    // 2) 갇히지 않는 위치 — 열린 칸, 상대 직선 밖, 상자 근처
    if (!best || best.score < 1) {
      const pos = this._positionTarget(gm, p, danger, field);
      if (pos) consider(pos);
    }
    return best;
  }

  _positionTarget(gm, p, danger, field) {
    const W = gm.grid.width;
    const here = p.cellY * W + p.cellX;
    let best = null;
    for (let k = 0; k < field.cost.length; k++) {
      if (k === here || field.cost[k] === INF || danger[k] !== INF || field.steps[k] > 10 || this._blacklisted(k)) continue;
      const x = k % W;
      const y = (k - x) / W;
      const open = this._openness(gm, p, x, y);
      if (open < 2) continue;
      const s = open * 0.8 - this._enemyThreat(gm, p, x, y) * 2.5 - Math.abs(field.steps[k] - 4) * 0.35 + this._noise(x, y);
      if (!best || s > best.score) best = { x, y, kind: 'position', state: ST.POSITIONING, score: s, until: this.clock + 3 };
    }
    return best;
  }

  // 목표가 없을 때 — 멈춰 보이지 않도록 순서대로 시도
  //   1 열린 위치 목표 → 2 바로 옆 안전 칸 (주머니 안에서 왔다 갔다)
  //   → 3 늦게 터지는 칸을 폭발 전에 지나 밖의 안전 칸으로 → 4 가장 열린 도달 칸
  //   → 5 WAIT (0.25초마다 다시 찾기 + 대기 포즈)
  _wander(gm, p, danger, field) {
    const W = gm.grid.width;
    const here = p.cellY * W + p.cellX;
    const go = (k, kind, until) => {
      const x = k % W;
      const y = (k - x) / W;
      this.target = { x, y, kind: 'position', score: 0, until: this.clock + until, via: kind };
      this.path = this._pathTo(field, k);
      this._setState(ST.POSITIONING);
      return true;
    };

    // 1) 열린 위치 목표 (기존 POSITIONING)
    const pos = this._positionTarget(gm, p, danger, field);
    if (pos) {
      this.target = pos;
      this.path = this._pathTo(field, pos.y * W + pos.x);
      this._setState(ST.POSITIONING);
      return true;
    }

    // 2) 바로 옆 안전 칸 — 방금 온 칸은 마지막에 (같은 두 칸 사이를 천천히 오간다)
    const near = [];
    for (const dir of DIR_NAMES) {
      const d = DIRS[dir];
      const k = (p.cellY + d.y) * W + p.cellX + d.x;
      if (field.cost[k] === INF || danger[k] !== INF || k === here) continue;
      near.push({ k, w: (k === this.prevCell ? 0 : 2) + this._openness(gm, p, p.cellX + d.x, p.cellY + d.y) * 0.3 + this.rng.next() });
    }
    near.sort((a, b) => b.w - a.w);
    if (near.length) return go(near[0].k, 'step', 1.2);

    // 3) 지금 주머니 밖 — 늦게 터지는 칸을 폭발 전에(여유 crossMargin) 지나 안전 칸으로
    const loose = this._search(gm, p, danger);
    let bestK = -1;
    let bestC = INF;
    for (let k = 0; k < loose.cost.length; k++) {
      if (loose.cost[k] === INF || danger[k] !== INF || k === here || loose.steps[k] > 10) continue;
      if (loose.cost[k] >= bestC || !this._crossingSafe(p, this._pathTo(loose, k), danger, W)) continue;
      bestC = loose.cost[k];
      bestK = k;
    }
    if (bestK >= 0) {
      const x = bestK % W;
      const y = (bestK - x) / W;
      this.target = { x, y, kind: 'position', score: 0, until: this.clock + 2, via: 'cross' };
      this.path = this._pathTo(loose, bestK);
      this._setState(ST.POSITIONING);
      return true;
    }

    // 4) 가장 열린 도달 칸 (거리 제한 없이)
    let open = -1;
    let openW = -INF;
    for (let k = 0; k < field.cost.length; k++) {
      if (field.cost[k] === INF || danger[k] !== INF || k === here) continue;
      const x = k % W;
      const w = this._openness(gm, p, x, (k - x) / W) - field.steps[k] * 0.05;
      if (w > openW) {
        openW = w;
        open = k;
      }
    }
    if (open >= 0) return go(open, 'open', 3);

    // 5) WAIT — 갈 수 있는 칸이 하나도 없다 (주변이 모두 위험 / 막힘)
    this.path = null;
    this.target = null;
    this._setState(ST.WAIT);
    this.thinkTimer = Math.min(this.thinkTimer, BOT_CONFIG.waitRethink);
    return false;
  }

  // 경로 위의 위험 칸을 "터지기 전(여유 포함)" 또는 "Wave 가 사라진 뒤"에만 지나가는가
  _crossingSafe(p, path, danger, W) {
    const linger = GAME_CONFIG.wave.lingerTime;
    for (let j = 1; j < path.length; j++) {
      const dv = danger[path[j].y * W + path[j].x];
      if (dv === INF) continue;
      const t = this._arrival(p, j);
      const tLeave = this._arrival(p, j + 1);
      if (tLeave < dv - BOT_CONFIG.crossMargin) continue;
      if (t > dv + linger + 0.3) continue;
      return false;
    }
    return true;
  }

  // 대기 포즈: 주변이 위험하면 Danger Wait / 내 폭탄을 기다리면 Ready / 그 외 Look Around
  _waitPose(gm, p, danger) {
    const W = gm.grid.width;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = p.cellX + dx;
        const y = p.cellY + dy;
        if (!gm.grid.inBounds(x, y)) continue;
        if (danger[y * W + x] !== INF) return BOT_POSE.DANGER_WAIT;
      }
    }
    if (p.activeBombs > 0) return BOT_POSE.READY;
    return BOT_POSE.LOOK_AROUND;
  }

  // TEAM: 갇힌 캡슐 목표 점수 — 팀원 구출 긴급도 → 남은 포획 시간 → 경로 거리 → 상대 마무리
  _capsuleTarget(gm, p, field) {
    const W = gm.grid.width;
    const here = p.cellY * W + p.cellX;
    let best = null;
    for (const o of gm.players.list) {
      if (o === p || !o.isTrapped) continue;
      const k = o.cellY * W + o.cellX;
      if (k !== here && (field.cost[k] === INF || field.steps[k] > 10)) continue;
      const steps = k === here ? 0 : field.steps[k];
      const left = Math.max(0, (o.trap?.maxTime ?? 4) - (o.trap?.time ?? 0));
      const eta = this._arrival(p, steps);
      if (eta > left + 0.05) continue; // 도착하기 전에 끝난다 → 다른 일
      const ally = gm.mode.areAllies(o, p);
      let score;
      if (ally) {
        // 긴급도: 내가 아니면 제때 못 구한다 (다른 팀원이 더 멀다)
        const others = gm.players.list.filter((a) => a !== p && a !== o && a.isActive && gm.mode.areAllies(a, p));
        const otherEta = Math.min(INF, ...others.map((a) => (Math.abs(a.cellX - o.cellX) + Math.abs(a.cellY - o.cellY)) / Math.max(1, a.moveSpeed)));
        const urgent = otherEta > left || otherEta > eta + 0.4 ? 1 : 0;
        score = 3000 + urgent * 1000 + (4 - left) * 60 - steps * 4;
      } else {
        // 상대 마무리: 상대 팀원이 구하러 오기 전에
        score = 1000 - steps * 4 + (4 - left) * 10;
      }
      if (!best || score > best.score) best = { o, score, ally };
    }
    return best;
  }

  _enemyInLine(gm, p, maxDist) {
    const d = DIRS[p.facing];
    for (let s = 1; s <= maxDist; s++) {
      const x = p.cellX + d.x * s;
      const y = p.cellY + d.y * s;
      if (gm.grid.isSolid(x, y)) return false;
      if (gm.players.list.some((o) => o.isActive && !gm.mode.areAllies(o, p) && o.cellX === x && o.cellY === y)) return true;
    }
    return false;
  }
}
