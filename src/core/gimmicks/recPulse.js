import { DIRS, DIR_NAMES } from '../constants.js';

// STUDIO Event — REC 표시 후, 올라와 있는 장비(G)에서 십자 방향으로 Sound Pulse 발생.
// 발사 전 warnTime 동안 라인을 경고 표시한다. 모든 플레이어가 동일하게 회피.
export class RecPulse {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.phase = 'idle';
    this.nextAt = cfg.firstAt;
    this.t = 0;
    this.lines = [];
  }

  _sources() {
    const gates = this.gm.stage.get('gates');
    return gates ? gates.closedGates() : [];
  }

  _computeLines() {
    const { grid } = this.gm;
    const out = [];
    for (const src of this._sources()) {
      for (const dir of DIR_NAMES) {
        const d = DIRS[dir];
        const cells = [];
        for (let s = 1; s <= this.cfg.range; s++) {
          const x = src.x + d.x * s;
          const y = src.y + d.y * s;
          const inter = grid.waveInteraction(x, y);
          if (inter === 'block') break;
          cells.push({ x, y });
          if (inter === 'destroy') break;
        }
        if (cells.length) out.push({ src: { x: src.x, y: src.y }, dir, cells });
      }
    }
    return out;
  }

  update(dt) {
    const { gm, cfg } = this;
    if (this.phase === 'idle') {
      if (gm.matchTime >= this.nextAt) {
        this.lines = this._computeLines();
        if (!this.lines.length) {
          this.nextAt = gm.matchTime + 4;
          return;
        }
        this.phase = 'warn';
        this.t = 0;
        gm.emit('recOn', { warnTime: cfg.warnTime });
      }
      return;
    }
    if (this.phase === 'warn') {
      this.t += dt;
      if (this.t >= cfg.warnTime) {
        for (const l of this.lines) gm.waves.emitLine(l.src.x, l.src.y, l.dir, cfg.range, 'amp');
        this.phase = 'idle';
        this.lines = [];
        this.nextAt = gm.matchTime + gm.tempoInterval(cfg.interval);
        gm.emit('recOff', {});
      }
    }
  }

  getTelegraphs() {
    if (this.phase !== 'warn') return [];
    const progress = this.t / this.cfg.warnTime;
    return this.lines.map((l) => ({ kind: 'pulse', cells: l.cells, dir: l.dir, progress }));
  }

  get visual() {
    return { state: this.phase === 'warn' ? 'rec' : 'idle', charging: this.phase === 'warn' };
  }
}
