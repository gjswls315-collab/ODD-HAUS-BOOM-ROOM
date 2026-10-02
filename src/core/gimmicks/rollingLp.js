// LP LIBRARY Stage Hazard — Rolling LP
// 지정된 행(lane)을 대형 LP 가 굴러가며 상자를 부수고, 플레이어를 옆 칸으로 밀어내고, 아이템을 쓸어내며, 폭탄을 터뜨린다.
// 사전에 lane 경고 표시 (warnTime).
export class RollingLp {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.nextAt = cfg.firstAt;
    this.phase = 'idle';
    this.t = 0;
    this.lane = cfg.lanes[0];
    this.dir = 1;
    this.pos = 0;
    this.lastCell = 0;
    this.count = 0;
  }

  update(dt) {
    const { gm, cfg } = this;
    if (this.phase === 'idle') {
      if (gm.matchTime >= this.nextAt) {
        this.phase = 'warn';
        this.t = 0;
        this.lane = gm.rng.pick(cfg.lanes);
        this.dir = this.count % 2 === 0 ? 1 : -1;
        this.count++;
        gm.emit('hazardWarn', { kind: 'rollingLp', lane: this.lane, dir: this.dir, warnTime: cfg.warnTime });
      }
      return;
    }
    if (this.phase === 'warn') {
      this.t += dt;
      if (this.t >= cfg.warnTime) {
        this.phase = 'roll';
        this.pos = this.dir > 0 ? 0 : gm.grid.width - 1;
        this.lastCell = Math.round(this.pos);
        gm.emit('rollingLpStart', { lane: this.lane, dir: this.dir });
      }
      return;
    }
    if (this.phase === 'roll') {
      this.pos += this.dir * cfg.speed * dt;
      const cell = Math.round(this.pos);
      while (this.lastCell !== cell) {
        this.lastCell += this.dir;
        if (!this._enter(this.lastCell)) {
          this._end();
          return;
        }
      }
    }
  }

  _end() {
    this.phase = 'idle';
    this.nextAt = this.gm.matchTime + this.gm.tempoInterval(this.cfg.interval);
    this.gm.emit('rollingLpEnd', { lane: this.lane, x: this.lastCell });
  }

  // false → 굴러가기 종료
  _enter(x) {
    const { gm } = this;
    const y = this.lane;
    if (x <= 0 || x >= gm.grid.width - 1) return false;
    // 상자(BREAKABLE)는 부수며 지나가고, SOLID 가구에서 멈춘다
    if (gm.grid.waveInteraction(x, y) === 'destroy') {
      const before = gm.grid.destroyBreakable(x, y);
      if (before) {
        gm.emit('blockDestroyed', { x, y, prop: before.prop, group: before.group, by: 'rollingLp' });
        gm.stage.onBreakableDestroyed(x, y, before);
        gm.items.rollDrop(x, y);
      }
    } else if (gm.grid.isSolid(x, y)) return false;

    for (const it of gm.items.items.filter((i) => i.x === x && i.y === y)) {
      gm.items._remove(it);
      gm.emit('itemDestroyed', { itemId: it.id, x, y, by: 'rollingLp' });
    }
    const bomb = gm.bombs.at(x, y);
    if (bomb) gm.bombs.trigger(bomb, 0.05);

    for (const p of gm.players.at(x, y)) {
      if (p.forced) continue;
      const prefer = p.y - y <= 0 ? [-1, 1] : [1, -1];
      let pushed = false;
      for (const dy of prefer) {
        const ty = y + dy;
        if (gm.grid.isWalkable(x, ty) && !gm.bombs.at(x, ty)) {
          p.x = x;
          p.y = y;
          p.forced = { dx: 0, dy, remaining: 1 };
          pushed = true;
          break;
        }
      }
      if (!pushed && p.isActive) gm.players.hit(p, null, 'rollingLp');
      gm.emit('rollingLpHit', { playerId: p.id, pushed });
    }
    return true;
  }

  getTelegraphs() {
    if (this.phase === 'idle') return [];
    const { grid } = this.gm;
    const cells = [];
    for (let x = 1; x < grid.width - 1; x++) if (grid.waveInteraction(x, this.lane) !== 'block') cells.push({ x, y: this.lane });
    return [
      {
        kind: 'lane',
        cells,
        dir: this.dir > 0 ? 'right' : 'left',
        progress: this.phase === 'warn' ? this.t / this.cfg.warnTime : 1,
      },
    ];
  }

  get visual() {
    return { phase: this.phase, lane: this.lane, dir: this.dir, pos: this.pos };
  }
}
