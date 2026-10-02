import { CELL } from '../config/stageConfig.js';
import { DIRS, DIR_NAMES } from './constants.js';

// ─────────────────────────────────────────────────────────────
// MR. ODD House Event — 플레이 캐릭터가 아닌 "집" 이벤트.
//   "MR. ODD IS COMING" 경고(warnTime) → 실행 → 논리 그리드 일부 변경
// Mr. ODD 는 플레이어를 직접 공격하지 않는다 (Hero Skill 구조 아님).
// 이벤트 종류
//   furniturePush : 소파/캐비닛 등 movable 가구를 한 칸 이동 (사람은 같이 밀림)
//   doorToggle    : 문 열림/닫힘 전환
//   lampOff       : 조명 OFF (시야만 변화, 판정 동일)
//   blockSpawn    : 빈 칸에 상자를 떨어뜨림 (플레이어 근처 제외)
// ─────────────────────────────────────────────────────────────
export class HouseEventManager {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg || null;
    this.enabled = !!(cfg && cfg.events && cfg.events.length);
    this.phase = 'idle'; // idle | warn | act
    this.nextAt = cfg ? cfg.firstAt : Infinity;
    this.t = 0;
    this.current = null; // { kind, plan, cells }
    this.lightsOutUntil = 0;
    this.history = [];
    this.lastKind = null;
  }

  get lightsOut() {
    return this.gm.matchTime < this.lightsOutUntil;
  }

  update(dt) {
    if (!this.enabled) return;
    const { gm } = this;
    if (this.phase === 'idle') {
      if (gm.matchTime >= this.nextAt) this._start();
      return;
    }
    this.t += dt;
    if (this.phase === 'warn' && this.t >= this.cfg.warnTime) {
      this._execute();
      this.phase = 'act';
      this.t = 0;
    } else if (this.phase === 'act' && this.t >= 1.4) {
      this.phase = 'idle';
      this.current = null;
      this.nextAt = gm.matchTime + this.cfg.interval;
    }
  }

  // 테스트 / 디버그용 강제 실행
  forceStart(kind) {
    this._start(kind);
  }

  _start(forcedKind) {
    const { gm, cfg } = this;
    let kinds = forcedKind ? [forcedKind] : gm.rng.shuffle(cfg.events);
    // 같은 이벤트 연속 방지
    if (!forcedKind && kinds.length > 1 && kinds[0] === this.lastKind) kinds = [...kinds.slice(1), kinds[0]];
    for (const kind of kinds) {
      const plan = this._plan(kind);
      if (plan) {
        this.current = { kind, plan, cells: plan.cells || [] };
        this.phase = 'warn';
        this.t = 0;
        this.lastKind = kind;
        gm.emit('houseEvent', { phase: 'warn', kind, cells: this.current.cells, warnTime: cfg.warnTime });
        return true;
      }
    }
    this.nextAt = gm.matchTime + 8;
    return false;
  }

  _plan(kind) {
    switch (kind) {
      case 'furniturePush':
        return this._planPush();
      case 'doorToggle': {
        const doors = this.gm.stage.get('doors');
        if (!doors || doors.doors.length === 0) return null;
        return { cells: doors.doors.map((d) => ({ x: d.x, y: d.y })) };
      }
      case 'lampOff':
        return { cells: [], duration: this.cfg.lampOffDuration || 6 };
      case 'blockSpawn':
        return this._planBlocks();
      default:
        return null;
    }
  }

  // ── furniturePush ──────────────────────────────
  _pushValid(group, dx, dy) {
    const { grid, bombs, players } = this.gm;
    const own = new Set(group.cells.map((c) => `${c.x},${c.y}`));
    const shoves = [];
    for (const c of group.cells) {
      const tx = c.x + dx;
      const ty = c.y + dy;
      if (own.has(`${tx},${ty}`)) continue;
      const cell = grid.get(tx, ty);
      if (!cell || cell.type !== CELL.EMPTY || cell.gimmick) return null;
      if (bombs.at(tx, ty)) return null;
      // 사람은 한 칸 더 밀어낸다
      for (const p of players.at(tx, ty)) {
        const sx = tx + dx;
        const sy = ty + dy;
        if (!grid.isWalkable(sx, sy) || bombs.at(sx, sy) || own.has(`${sx},${sy}`)) return null;
        shoves.push(p);
      }
    }
    return { shoves };
  }

  _planPush() {
    const { grid, rng } = this.gm;
    const movable = [...grid.groups.values()].filter((g) => g.movable && g.cells.length);
    const candidates = [];
    for (const g of rng.shuffle(movable)) {
      for (const dir of rng.shuffle(DIR_NAMES)) {
        const d = DIRS[dir];
        if (this._pushValid(g, d.x, d.y)) candidates.push({ groupId: g.id, dir });
      }
    }
    if (!candidates.length) return null;
    const picks = [];
    const used = new Set();
    for (const c of candidates) {
      if (used.has(c.groupId)) continue;
      used.add(c.groupId);
      picks.push(c);
      if (picks.length >= (this.cfg.pushCount || 1)) break;
    }
    const cells = [];
    for (const p of picks) {
      const g = grid.groups.get(p.groupId);
      const d = DIRS[p.dir];
      for (const c of g.cells) cells.push({ x: c.x + d.x, y: c.y + d.y });
    }
    return { pushes: picks, cells };
  }

  // ── blockSpawn ─────────────────────────────────
  _planBlocks() {
    const { grid, players, bombs, items, rng } = this.gm;
    const live = players.list.filter((p) => !p.isEliminated);
    const free = grid.cells.filter((c) => {
      if (c.type !== CELL.EMPTY || c.gimmick || c.ring) return false;
      if (bombs.at(c.x, c.y) || items.at(c.x, c.y)) return false;
      if (grid.spawns.some((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) <= 1)) return false;
      return live.every((p) => Math.abs(p.cellX - c.x) + Math.abs(p.cellY - c.y) >= 3);
    });
    if (!free.length) return null;
    const n = Math.min(this.cfg.blockCount || 4, free.length);
    return { cells: rng.shuffle(free).slice(0, n).map((c) => ({ x: c.x, y: c.y })) };
  }

  _execute() {
    const { gm } = this;
    const { kind, plan } = this.current;
    const result = { kind, changed: [] };
    if (kind === 'furniturePush') {
      for (const p of plan.pushes) {
        const g = gm.grid.groups.get(p.groupId);
        if (!g) continue;
        const d = DIRS[p.dir];
        const v = this._pushValid(g, d.x, d.y);
        if (!v) continue; // 계획 이후 막혔으면 취소
        for (const pl of v.shoves) {
          pl.x = pl.cellX;
          pl.y = pl.cellY;
          pl.forced = { dx: d.x, dy: d.y, remaining: 1 };
        }
        gm.grid.moveGroup(p.groupId, d.x, d.y);
        result.changed.push({ groupId: p.groupId, dir: p.dir });
        gm.emit('groupMoved', { groupId: p.groupId, dx: d.x, dy: d.y });
      }
    } else if (kind === 'doorToggle') {
      gm.stage.get('doors')?.toggleAll('houseEvent');
    } else if (kind === 'lampOff') {
      this.lightsOutUntil = gm.matchTime + plan.duration;
      result.duration = plan.duration;
    } else if (kind === 'blockSpawn') {
      const props = gm.stageDef.randomFill?.props || ['box'];
      for (const c of plan.cells) {
        const cell = gm.grid.get(c.x, c.y);
        if (!cell || cell.type !== CELL.EMPTY || cell.gimmick) continue;
        if (gm.bombs.at(c.x, c.y) || gm.players.at(c.x, c.y).length) continue;
        gm.items.destroyAt(c.x, c.y);
        gm.grid.setBreakable(c.x, c.y, gm.rng.pick(props));
        result.changed.push(c);
      }
      gm.emit('blocksSpawned', { cells: result.changed });
    }
    this.history.push({ kind, at: gm.matchTime });
    gm.emit('houseEvent', { phase: 'act', kind, result });
  }

  getTelegraphs() {
    if (this.phase !== 'warn' || !this.current) return [];
    return [
      {
        kind: this.current.kind === 'blockSpawn' ? 'drop' : 'house',
        cells: this.current.cells,
        progress: this.t / this.cfg.warnTime,
      },
    ];
  }
}
