import { DIRS } from '../constants.js';

// STUDIO — REC 스위치 (공용 Map Switch)
// 아무 플레이어나 밟거나, Sound Wave 로 맞히면 REC ON.
// REC 동안 앰프가 주기적으로 Sound Pulse(직선 파동)를 발사 — 발사 전 라인 경고.
export class RecStudio {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.state = 'idle';
    this.timer = 0;
    this.cycle = 0;
    this.charging = false;
    this.lines = [];
    this.switches = [];
    this.amps = [];
  }

  init() {
    const { grid } = this.gm;
    this.switches = grid.cells.filter((c) => c.gimmick && c.gimmick.kind === 'recSwitch');
    this.amps = grid.cells.filter((c) => c.amp).map((c) => ({ x: c.x, y: c.y, dir: c.amp }));
    for (const s of this.switches) s.gimmick.on = false;
  }

  activate(source) {
    if (this.state !== 'idle') return;
    this.state = 'rec';
    this.timer = this.cfg.recDuration;
    this.cycle = this.cfg.pulseInterval - this.cfg.telegraph - 0.35;
    this.charging = false;
    for (const s of this.switches) if (s.gimmick) s.gimmick.on = true;
    this.gm.grid.version++;
    this.gm.emit('recOn', { source, duration: this.cfg.recDuration });
  }

  onPlayerEnterCell(p, x, y) {
    if (this.switches.some((s) => s.x === x && s.y === y)) this.activate('player');
  }

  onWaveCell(x, y) {
    if (this.switches.some((s) => s.x === x && s.y === y)) this.activate('wave');
  }

  _computeLines() {
    const { grid } = this.gm;
    return this.amps.map((a) => {
      const d = DIRS[a.dir];
      const cells = [];
      for (let s = 1; s <= this.cfg.range; s++) {
        const x = a.x + d.x * s;
        const y = a.y + d.y * s;
        const inter = grid.waveInteraction(x, y);
        if (inter === 'block') break;
        cells.push({ x, y });
        if (inter === 'destroy') break;
      }
      return { amp: a, cells };
    });
  }

  update(dt) {
    const { cfg, gm } = this;
    if (this.state === 'rec') {
      this.timer -= dt;
      this.cycle += dt;
      if (!this.charging && this.cycle >= cfg.pulseInterval - cfg.telegraph) {
        this.charging = true;
        this.lines = this._computeLines();
        gm.emit('pulseCharge', {});
      }
      if (this.charging && this.cycle >= cfg.pulseInterval) {
        for (const a of this.amps) gm.waves.emitLine(a.x, a.y, a.dir, cfg.range, 'amp');
        this.cycle = 0;
        this.charging = false;
        this.lines = [];
      }
      if (this.timer <= 0 && !this.charging) {
        this.state = 'cooldown';
        this.timer = cfg.cooldown;
        for (const s of this.switches) if (s.gimmick) s.gimmick.on = false;
        gm.grid.version++;
        gm.emit('recOff', {});
      }
    } else if (this.state === 'cooldown') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'idle';
    }
  }

  getTelegraphs() {
    if (!this.charging) return [];
    const progress = Math.min(1, (this.cycle - (this.cfg.pulseInterval - this.cfg.telegraph)) / this.cfg.telegraph);
    return this.lines.map((l) => ({ kind: 'pulse', cells: l.cells, dir: l.amp.dir, progress }));
  }

  get visual() {
    return { state: this.state, charging: this.charging, timer: this.timer };
  }
}
