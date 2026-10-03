// DJ BOOTH — Turntable Rotation (GDD v3: G = Turntable Zone)
// 턴테이블 둘레 8칸이 일정 박자마다 시계 방향으로 한 칸 회전 → 길 구조가 바뀐다.
// 링 위의 SOLID 가구 / BREAKABLE / Beat Bomb / 아이템이 함께 돌고, 서 있는 플레이어도 함께 실려 간다.
// (내용물 전체가 같이 도는 순열이라 벽이 사람 위로 겹치지 않는다)
const RING = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export class Turntables {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.decks = [];
    this.timer = 0;
    this.warned = false;
  }

  init() {
    const { grid } = this.gm;
    // cfg.decks 가 있으면 그 턴테이블만 회전 (나머지는 고정 장식)
    const only = this.cfg.decks ? new Set(this.cfg.decks.map(([x, y]) => `${x},${y}`)) : null;
    for (const c of grid.cells) {
      if (!(c.turntable || c.prop === 'turntable')) continue;
      if (only && !only.has(`${c.x},${c.y}`)) continue;
      const ring = RING.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }));
      if (ring.every((p) => grid.inBounds(p.x, p.y) && !grid.get(p.x, p.y).border)) {
        this.decks.push({ x: c.x, y: c.y, ring, rotations: 0 });
      }
    }
  }

  update(dt) {
    if (this.decks.length === 0) return;
    this.timer += dt;
    if (!this.warned && this.timer >= this.cfg.interval - this.cfg.warnTime) {
      this.warned = true;
      this.gm.emit('turntableWarn', {});
    }
    if (this.timer >= this.cfg.interval) {
      this.timer = 0;
      this.warned = false;
      for (const d of this.decks) this.rotate(d);
    }
  }

  rotate(deck) {
    const { gm } = this;
    const ring = deck.ring;
    const n = ring.length;
    const idxOf = (x, y) => ring.findIndex((p) => p.x === x && p.y === y);

    const movesBombs = gm.bombs.bombs
      .filter((b) => !b.flying)
      .map((b) => ({ b, i: idxOf(b.x, b.y) }))
      .filter((o) => o.i >= 0);
    const movesItems = gm.items.items.map((it) => ({ it, i: idxOf(it.x, it.y) })).filter((o) => o.i >= 0);
    const movesPlayers = gm.players.list
      .filter((p) => !p.isEliminated)
      .map((p) => ({ p, i: idxOf(p.cellX, p.cellY) }))
      .filter((o) => o.i >= 0);

    gm.grid.permuteContents(ring);
    for (const { b, i } of movesBombs) {
      const to = ring[(i + 1) % n];
      b.motion = null;
      b.x = to.x;
      b.y = to.y;
    }
    for (const { it, i } of movesItems) {
      const to = ring[(i + 1) % n];
      it.x = to.x;
      it.y = to.y;
    }
    for (const { p, i } of movesPlayers) {
      const to = ring[(i + 1) % n];
      p.x = to.x;
      p.y = to.y;
      p.forced = null;
      p.lastCellX = to.x;
      p.lastCellY = to.y;
    }
    deck.rotations++;
    gm.emit('turntableRotated', { x: deck.x, y: deck.y, rotations: deck.rotations });
  }

  getTelegraphs() {
    if (!this.warned) return [];
    return this.decks.map((d) => ({
      kind: 'ring',
      cells: d.ring,
      progress: (this.timer - (this.cfg.interval - this.cfg.warnTime)) / this.cfg.warnTime,
    }));
  }

  get visual() {
    return { decks: this.decks, timer: this.timer, interval: this.cfg.interval };
  }
}
