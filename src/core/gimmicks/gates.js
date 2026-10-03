// STUDIO — 공용 스위치에 연결된 장비(Amp·Mixer) 게이트
// 아무 플레이어의 Sound Wave 가 G 장비에 닿으면 모든 G 가 전환된다:
//   올라와 있던 장비(벽, #) → 내려감(통로, .) / 내려가 있던 장비 → 올라옴
// 사람이나 폭탄이 있는 칸은 비워질 때 올라온다. 캐릭터 전용 조작 없음.
export class Gates {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.gates = [];
    this.cooldown = 0;
  }

  init() {
    const { grid } = this.gm;
    const closed = new Set((this.cfg.closed || []).map(([x, y]) => `${x},${y}`));
    this.gates = grid.cells.filter((c) => c.gimmick && c.gimmick.kind === 'gate');
    for (const g of this.gates) {
      const up = closed.has(`${g.x},${g.y}`);
      g.gimmick.open = !up;
      g.gimmick.solid = up;
      g.gimmick.wantClosed = false;
    }
  }

  _occupied(x, y) {
    return this.gm.players.at(x, y).length > 0 || !!this.gm.bombs.at(x, y);
  }

  toggle(source) {
    for (const c of this.gates) {
      const g = c.gimmick;
      if (g.open && !g.wantClosed) g.wantClosed = true;
      else {
        g.wantClosed = false;
        g.open = true;
        g.solid = false;
      }
    }
    this._applyPending();
    this.gm.grid.version++;
    this.gm.emit('gatesToggled', { source, cells: this.gates.map((c) => ({ x: c.x, y: c.y, open: c.gimmick.open })) });
  }

  _applyPending() {
    for (const c of this.gates) {
      const g = c.gimmick;
      if (g.wantClosed && !this._occupied(c.x, c.y)) {
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

  // 올라와 있는 장비는 Wave 를 막지만(그리드 판정), 그 장비에 Wave 가 "닿으면" 스위치가 작동한다
  //   toggle: false → 지형은 그대로, 장비 불빛만 반응 (거의 고정형 STUDIO)
  onWaveTouch(x, y, source) {
    if (source === 'amp' || this.cooldown > 0) return; // 장비 자신의 Pulse 로는 전환되지 않음
    if (!this.gates.some((c) => c.x === x && c.y === y)) return;
    if (this.cfg.toggle === false) {
      this.cooldown = 0.4;
      this.gm.emit('ampReact', { x, y });
      return;
    }
    this.cooldown = this.cfg.cooldown ?? 2.5;
    this.toggle(source);
  }

  onWaveCell(x, y, source) {
    this.onWaveTouch(x, y, source);
  }

  closedGates() {
    return this.gates.filter((c) => c.gimmick.solid);
  }
}
