import { GAME_CONFIG } from '../../config/gameConfig.js';
import { DIRS, DIR_NAMES, dirFromDelta } from '../constants.js';
import { Rng } from '../rng.js';

// ─────────────────────────────────────────────────────────────
// CPU 플레이어 — 사람과 똑같은 intent(dir/bomb/dash/item)를 만들어
// 공통 PlayerController 에 넣는다. 캐릭터별 AI 분기 없음.
// ─────────────────────────────────────────────────────────────

const INF = Infinity;

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

// 각 칸이 Wave 에 맞기까지 남은 시간 (Infinity = 안전)
export function computeDanger(gm, extraBomb = null) {
  const { grid } = gm;
  const W = grid.width;
  const danger = new Float64Array(W * grid.height).fill(INF);
  const rate = gm.bombs.fuseRate || 1;

  for (const w of gm.waves.cells.values()) danger[w.y * W + w.x] = 0;

  const entries = gm.bombs.bombs
    .filter((b) => !b.flying)
    .map((b) => ({ b, x: b.x, y: b.y, range: b.range, t: Math.max(0, b.fuse) / rate }));
  for (const b of gm.bombs.bombs) {
    if (b.flying && b.motion) {
      entries.push({ b, x: b.motion.toX, y: b.motion.toY, range: b.range, t: Math.max(b.fuse, GAME_CONFIG.bomb.minFuseAfterLanding) / rate });
    }
  }
  if (extraBomb) entries.push({ b: null, ...extraBomb });

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

  // 기믹 경고 (Rolling LP / 앰프 Pulse / 상자 낙하) 도 위험으로 간주
  for (const tg of gm.getTelegraphs()) {
    if (tg.kind === 'lane' || tg.kind === 'pulse') {
      const remain = Math.max(0, (1 - (tg.progress ?? 0)) * 1.5);
      for (const c of tg.cells) {
        const k = c.y * W + c.x;
        if (remain < danger[k]) danger[k] = remain;
      }
    }
  }
  return danger;
}

export class BotBrain {
  constructor(playerId, { skill = 0.75, seed = 1 } = {}) {
    this.playerId = playerId;
    this.skill = skill;
    this.seed = seed;
    this.rng = new Rng(seed * 7919 + playerId * 104729 + 13);
    this.thinkTimer = 0;
    this.path = null; // [{x,y}] 현재 따라가는 경로
    this.pathKind = null; // 'flee' | 'goal'
    this.goal = null;
    this.goalTimer = 0;
    this.bombCooldown = 0;
  }

  update(gm, dt) {
    const p = gm.players.get(this.playerId);
    const out = { dir: null, bomb: false, dash: false, item: false };
    if (!p || p.isEliminated) return out;
    this.thinkTimer -= dt;
    this.bombCooldown -= dt;
    this.goalTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.08 + (1 - this.skill) * 0.16 + this.rng.next() * 0.04;
      const d = this.think(gm, p);
      out.bomb = d.bomb;
      out.dash = d.dash;
      out.item = d.item;
      if (d.dir !== undefined && !this.path) out.dir = d.dir;
    }
    if (this.path) out.dir = this._follow(p);
    else if (!out.dir && this._fallbackDir) out.dir = this._fallbackDir;
    return out;
  }

  // 경로 따라가기 (매 틱) — 반올림 칸 기준으로 다음 칸 방향
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
    return steps / Math.max(1, p.moveSpeed) + 0.2;
  }

  // BFS (부모 포인터) — 걸을 수 있는 칸
  _bfs(gm, p, danger = null, avoidDanger = false) {
    const { grid } = gm;
    const W = grid.width;
    const dist = new Int32Array(W * grid.height).fill(-1);
    const parent = new Int32Array(W * grid.height).fill(-1);
    const start = p.cellY * W + p.cellX;
    const q = [start];
    dist[start] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi];
      const x = k % W;
      const y = (k - x) / W;
      for (const dir of DIR_NAMES) {
        const d = DIRS[dir];
        const nx = x + d.x;
        const ny = y + d.y;
        if (!grid.inBounds(nx, ny)) continue;
        const nk = ny * W + nx;
        if (dist[nk] >= 0 || gm.isBlockedFor(p, nx, ny)) continue;
        if (avoidDanger && danger) {
          const t = this._arrival(p, dist[k] + 1);
          const dv = danger[nk];
          if (dv === 0 || (dv < t + 0.35 && dv > t - 0.6)) continue;
        }
        dist[nk] = dist[k] + 1;
        parent[nk] = k;
        q.push(nk);
      }
    }
    return { dist, parent, W, start };
  }

  _pathTo(bfs, k) {
    const { parent, W, start } = bfs;
    const out = [];
    let c = k;
    for (let guard = 0; c >= 0 && guard < 400; guard++) {
      const x = c % W;
      out.push({ x, y: (c - x) / W });
      if (c === start) break;
      c = parent[c];
    }
    return out.reverse();
  }

  // 위험을 피해 도달 가능한 가장 가까운 안전 칸까지의 경로
  _safePath(gm, p, danger, limitTime = INF) {
    const bfs = this._bfs(gm, p, danger, true);
    let best = -1;
    let bestD = INF;
    for (let k = 0; k < bfs.dist.length; k++) {
      const d = bfs.dist[k];
      if (d < 0 || danger[k] !== INF) continue;
      if (this._arrival(p, d) >= limitTime) continue;
      // 막다른 길보다 출구가 많은 칸 선호
      const score = d - this._openness(gm, p, k % bfs.W, Math.floor(k / bfs.W)) * 0.3;
      if (score < bestD) {
        bestD = score;
        best = k;
      }
    }
    return best >= 0 ? this._pathTo(bfs, best) : null;
  }

  _openness(gm, p, x, y) {
    let n = 0;
    for (const dir of DIR_NAMES) {
      const d = DIRS[dir];
      if (!gm.isBlockedFor(p, x + d.x, y + d.y)) n++;
    }
    return n;
  }

  _pathStillSafe(gm, p, danger) {
    if (!this.path) return false;
    const W = gm.grid.width;
    const cx = p.cellX;
    const cy = p.cellY;
    const i = this.path.findIndex((c) => c.x === cx && c.y === cy);
    if (i < 0) return false;
    const end = this.path[this.path.length - 1];
    if (danger[end.y * W + end.x] !== INF) return false;
    for (let j = i + 1; j < this.path.length; j++) {
      const c = this.path[j];
      if (gm.isBlockedFor(p, c.x, c.y)) return false;
      const t = this._arrival(p, j - i);
      const dv = danger[c.y * W + c.x];
      if (dv === 0 || (dv < t + 0.35 && dv > t - 0.6)) return false;
    }
    return true;
  }

  _noise(x, y) {
    let h = (x * 73856093) ^ (y * 19349663) ^ (this.seed * 83492791) ^ (this.playerId * 2654435761);
    h = (h ^ (h >>> 13)) >>> 0;
    return (h % 1000) / 1000;
  }

  think(gm, p) {
    const res = { dir: undefined, bomb: false, dash: false, item: false };
    this._fallbackDir = null;
    const { grid } = gm;
    const W = grid.width;

    if (p.isTrapped) {
      this.path = null;
      if (p.heldItem?.type === 'needle') {
        res.item = true;
        return res;
      }
      const ally = gm.players.list.find((o) => o !== p && o.isActive && gm.mode.areAllies(o, p));
      if (ally) {
        const dx = ally.x - p.x;
        const dy = ally.y - p.y;
        res.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      } else res.dir = null;
      return res;
    }
    if (!p.isActive) return res;

    const danger = computeDanger(gm);
    const here = p.cellY * W + p.cellX;

    // ── 1) 위험: 안전 칸으로 (경로 유지) ──
    if (danger[here] !== INF || this.pathKind === 'flee') {
      if (this.pathKind === 'flee' && this._pathStillSafe(gm, p, danger)) return res;
      if (danger[here] === INF) {
        this.path = null;
        this.pathKind = null;
      } else {
        const path = this._safePath(gm, p, danger);
        if (path && path.length > 1) {
          this.path = path;
          this.pathKind = 'flee';
          if (path.length >= 3 && danger[here] < 1.0 && p.dash.cooldown <= 0 && this.rng.next() < this.skill) res.dash = true;
          return res;
        }
        // 안전 칸이 없으면 가장 늦게 터지는 이웃으로
        this.path = null;
        this.pathKind = null;
        let bestT = danger[here];
        let bestDir = null;
        for (const dir of DIR_NAMES) {
          const d = DIRS[dir];
          const nx = p.cellX + d.x;
          const ny = p.cellY + d.y;
          if (gm.isBlockedFor(p, nx, ny)) continue;
          if (danger[ny * W + nx] > bestT) {
            bestT = danger[ny * W + nx];
            bestDir = dir;
          }
        }
        res.dir = bestDir;
        this._fallbackDir = bestDir;
        return res;
      }
    }

    // ── 아이템 사용 (사람과 같은 E 키 규칙) ──
    if (p.heldItem?.type === 'rollerSkates') res.item = true;
    if (p.abilities.remote) {
      for (const b of gm.bombs.bombs.filter((b) => b.ownerId === p.id && !b.flying)) {
        const { cells } = blastCells(gm, b.x, b.y, b.range, b);
        const hitsEnemy = cells.some((c) => gm.players.list.some((o) => o.isActive && !gm.mode.areAllies(o, p) && o.cellX === c.x && o.cellY === c.y));
        const hitsMe = cells.some((c) => c.x === p.cellX && c.y === p.cellY);
        if (hitsEnemy && !hitsMe) res.item = true;
      }
    }
    if (p.abilities.glove && this._enemyInLine(gm, p, 6)) {
      const d = DIRS[p.facing];
      if (gm.bombs.at(p.cellX + d.x, p.cellY + d.y) || gm.bombs.at(p.cellX, p.cellY)) res.item = true;
    }

    const bfs = this._bfs(gm, p, danger, true);
    const { dist } = bfs;

    // ── 2) 갇힌 상대 → 터뜨리기 / 갇힌 팀원 → 구출 ──
    for (const o of gm.players.list) {
      if (o === p || !o.isTrapped) continue;
      const k = o.cellY * W + o.cellX;
      if (dist[k] < 0 || dist[k] > 9) continue;
      if (k === here) {
        this.path = null;
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        res.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        return res;
      }
      this.path = this._pathTo(bfs, k);
      this.pathKind = 'goal';
      this.goal = { x: o.cellX, y: o.cellY, kind: 'capsule' };
      return res;
    }

    // ── 3) 폭탄 설치 ──
    if (p.activeBombs < p.maxBombs && this.bombCooldown <= 0 && !gm.bombs.at(p.cellX, p.cellY)) {
      const value = this._spotValue(gm, p, p.cellX, p.cellY);
      const atGoal = this.goal && this.goal.kind === 'spot' && this.goal.x === p.cellX && this.goal.y === p.cellY;
      if (value > 0 && (atGoal || value >= 3 || this.rng.next() < 0.35 + this.skill * 0.3)) {
        const fuse = GAME_CONFIG.bomb.fuseTime / (gm.bombs.fuseRate || 1);
        const d2 = computeDanger(gm, { x: p.cellX, y: p.cellY, range: p.waveRange, t: fuse });
        const esc = this._safePath(gm, p, d2, fuse - 0.5);
        if (esc && esc.length > 1) {
          res.bomb = true;
          this.path = esc;
          this.pathKind = 'flee';
          this.goal = null;
          this.bombCooldown = 0.3;
          return res;
        }
      }
    }

    // ── 4) 목표: 아이템 → 폭탄 자리 → 상대 쪽 ──
    const goalValid =
      this.goal &&
      this.path &&
      this.pathKind === 'goal' &&
      this.goalTimer > 0 &&
      dist[this.goal.y * W + this.goal.x] >= 0 &&
      (this.goal.kind !== 'item' || gm.items.at(this.goal.x, this.goal.y));
    if (!goalValid) {
      let target = null;
      let bestScore = -INF;
      for (const it of gm.items.items) {
        const k = it.y * W + it.x;
        if (dist[k] < 0 || dist[k] > 10 || danger[k] !== INF) continue;
        const s = 26 - dist[k] * 2 + this._noise(it.x, it.y);
        if (s > bestScore) {
          bestScore = s;
          target = { x: it.x, y: it.y, kind: 'item' };
        }
      }
      for (let k = 0; k < dist.length; k++) {
        if (dist[k] < 0 || dist[k] > 12 || danger[k] !== INF) continue;
        const x = k % W;
        const y = (k - x) / W;
        const v = this._spotValue(gm, p, x, y);
        if (v <= 0) continue;
        const s = Math.min(v, 5) * 4 - dist[k] * 1.3 + this._noise(x, y) * 1.5;
        if (s > bestScore) {
          bestScore = s;
          target = { x, y, kind: 'spot' };
        }
      }
      if (!target) {
        const enemies = gm.players.list.filter((o) => o.isActive && !gm.mode.areAllies(o, p));
        let bestD = INF;
        for (let k = 0; k < dist.length; k++) {
          if (dist[k] < 0 || danger[k] !== INF) continue;
          const x = k % W;
          const y = (k - x) / W;
          for (const e of enemies) {
            const d = Math.abs(e.cellX - x) + Math.abs(e.cellY - y) + dist[k] * 0.25 + this._noise(x, y) * 0.5;
            if (d < bestD) {
              bestD = d;
              target = { x, y, kind: 'chase' };
            }
          }
        }
      }
      this.goal = target;
      this.goalTimer = 1.2;
      if (target) {
        const k = target.y * W + target.x;
        this.path = k === here ? null : this._pathTo(bfs, k);
        this.pathKind = this.path ? 'goal' : null;
      } else {
        this.path = null;
        this.pathKind = null;
      }
    }

    // 다음 칸이 위험해지면 멈춤
    if (this.path && this.pathKind === 'goal') {
      const i = this.path.findIndex((c) => c.x === p.cellX && c.y === p.cellY);
      const n = i >= 0 ? this.path[i + 1] : null;
      if (n && danger[n.y * W + n.x] !== INF) {
        this.path = null;
        this.pathKind = null;
        res.dir = null;
      }
    }
    return res;
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

  // (x,y)에 폭탄을 놓았을 때의 가치: 상자 + 상대 - 아군
  _spotValue(gm, p, x, y) {
    const { cells } = blastCells(gm, x, y, p.waveRange);
    let v = 0;
    for (const c of cells) {
      const cell = gm.grid.get(c.x, c.y);
      if (cell && cell.type === 'BREAKABLE') v += 1;
      for (const o of gm.players.list) {
        if (o === p || !o.isActive) continue;
        const near = Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 0.8;
        if (!near) continue;
        v += gm.mode.areAllies(o, p) ? -5 : 3;
      }
    }
    return v;
  }
}
