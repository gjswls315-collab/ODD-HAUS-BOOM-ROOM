import { DIRS, DIR_NAMES } from '../constants.js';

// TERRACE — Wind Event
// 바람 방향을 warnTime 동안 미리 표시한 뒤, 돌풍이 불면 플레이어와 아이템이 한 칸 밀린다.
// (막힌 칸으로는 밀리지 않는다 — 과도한 랜덤성 방지)
export class Wind {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.phase = 'idle';
    this.nextAt = cfg.firstAt;
    this.t = 0;
    this.dir = 'right';
  }

  update(dt) {
    const { gm, cfg } = this;
    if (this.phase === 'idle') {
      if (gm.matchTime >= this.nextAt) {
        this.phase = 'warn';
        this.t = 0;
        this.dir = gm.rng.pick(DIR_NAMES);
        gm.emit('windWarn', { dir: this.dir, warnTime: cfg.warnTime });
      }
    } else if (this.phase === 'warn') {
      this.t += dt;
      if (this.t >= cfg.warnTime) {
        this.gust();
        this.phase = 'idle';
        this.nextAt = gm.matchTime + gm.tempoInterval(cfg.interval);
      }
    }
  }

  gust() {
    const { gm } = this;
    const d = DIRS[this.dir];
    const { grid } = gm;
    // 진행 방향 앞쪽부터 처리해서 서로 막히지 않게
    const order = (a, b) => (b.x - a.x) * d.x + (b.y - a.y) * d.y;

    const items = gm.items.items.slice().sort(order);
    let movedItems = 0;
    for (const it of items) {
      const tx = it.x + d.x;
      const ty = it.y + d.y;
      if (grid.isWalkable(tx, ty) && !gm.bombs.at(tx, ty) && !gm.items.at(tx, ty)) {
        it.x = tx;
        it.y = ty;
        movedItems++;
      }
    }

    let movedPlayers = 0;
    const players = gm.players.list
      .filter((p) => !p.isEliminated && !p.forced)
      .sort((a, b) => order({ x: a.cellX, y: a.cellY }, { x: b.cellX, y: b.cellY }));
    for (const p of players) {
      const tx = p.cellX + d.x;
      const ty = p.cellY + d.y;
      if (grid.isWalkable(tx, ty) && !gm.bombs.at(tx, ty)) {
        p.forced = { dx: d.x, dy: d.y, remaining: 1 };
        movedPlayers++;
      }
    }
    gm.emit('windGust', { dir: this.dir, movedItems, movedPlayers });
  }

  getTelegraphs() {
    if (this.phase !== 'warn') return [];
    return [{ kind: 'wind', cells: [], dir: this.dir, progress: this.t / this.cfg.warnTime }];
  }

  get visual() {
    return { phase: this.phase, dir: this.dir, t: this.t };
  }
}
