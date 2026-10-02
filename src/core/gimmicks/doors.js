// LOCKED ROOM — 문 / 레버 (공용 인터랙션)
// 아무 플레이어나 레버를 밟거나 Wave 로 맞히면 모든 문이 열림↔닫힘 전환.
// House Event(doorToggle)도 이 기믹을 사용한다. 사람/폭탄이 있는 칸의 문은 비워질 때 닫힌다.
export class Doors {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.doors = [];
    this.levers = [];
    this.cooldown = 0;
  }

  init() {
    const { grid } = this.gm;
    this.doors = grid.cells.filter((c) => c.gimmick && c.gimmick.kind === 'door');
    this.levers = grid.cells.filter((c) => c.gimmick && c.gimmick.kind === 'lever');
    for (const l of this.levers) l.gimmick.on = false;
  }

  _occupied(x, y) {
    return this.gm.players.at(x, y).length > 0 || !!this.gm.bombs.at(x, y);
  }

  toggleAll(source) {
    for (const d of this.doors) {
      const g = d.gimmick;
      if (!g) continue;
      if (g.open && !g.wantClosed) {
        g.wantClosed = true;
      } else {
        g.wantClosed = false;
        g.open = true;
        g.solid = false;
      }
    }
    for (const l of this.levers) l.gimmick.on = !l.gimmick.on;
    this._applyPending();
    this.gm.grid.version++;
    this.gm.emit('doorsToggled', { source });
  }

  _applyPending() {
    for (const d of this.doors) {
      const g = d.gimmick;
      if (g && g.wantClosed && !this._occupied(d.x, d.y)) {
        g.open = false;
        g.solid = true;
        g.wantClosed = false;
        this.gm.grid.version++;
      }
    }
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this._applyPending();
  }

  _lever(x, y, source) {
    if (this.cooldown > 0) return;
    if (!this.levers.some((l) => l.x === x && l.y === y)) return;
    this.cooldown = this.cfg.leverCooldown ?? 3;
    this.toggleAll(source);
  }

  onPlayerEnterCell(p, x, y) {
    this._lever(x, y, 'lever');
  }

  onWaveCell(x, y) {
    this._lever(x, y, 'lever');
  }

  getTelegraphs() {
    return [];
  }
}
