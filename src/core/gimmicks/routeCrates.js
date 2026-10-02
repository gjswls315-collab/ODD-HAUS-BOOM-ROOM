// LP LIBRARY — 특정 Record Box(금색 routeCrate)를 부수면 연결된 숨은 선반이 열려 새 Route 발생.
// cfg.links 로 명시하거나, 없으면 가장 가까운 상자에 자동 연결.
// 누구의 Wave 든 동일하게 작동하는 공용 기믹.
export class RouteCrates {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.links = new Map(); // "x,y" (crate) → [{x,y}] secret shelf cells
  }

  init() {
    const { grid } = this.gm;
    if (this.cfg.links) {
      for (const l of this.cfg.links) this.links.set(`${l.crate[0]},${l.crate[1]}`, l.opens.map(([x, y]) => ({ x, y })));
      return;
    }
    const crates = grid.cells.filter((c) => c.routeCrate);
    const secrets = grid.cells.filter((c) => c.gimmick && c.gimmick.kind === 'secretShelf');
    for (const s of secrets) {
      let best = null;
      let bestD = Infinity;
      for (const c of crates) {
        const d = Math.abs(c.x - s.x) + Math.abs(c.y - s.y);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) continue;
      const k = `${best.x},${best.y}`;
      if (!this.links.has(k)) this.links.set(k, []);
      this.links.get(k).push({ x: s.x, y: s.y });
    }
  }

  onBreakableDestroyed(x, y, before) {
    if (!before.routeCrate) return;
    const cells = this.links.get(`${x},${y}`) || [];
    const opened = [];
    for (const s of cells) {
      const c = this.gm.grid.get(s.x, s.y);
      if (c && c.gimmick && c.gimmick.kind === 'secretShelf') {
        this.gm.grid.setEmpty(s.x, s.y);
        opened.push(s);
      }
    }
    if (opened.length) this.gm.emit('routeOpened', { cells: opened, crate: { x, y } });
  }
}
