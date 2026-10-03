// DJ BOOTH — BEAT DROP
// 일정 간격마다 "BEAT DROP!" 경고 → 중앙 턴테이블 둘레(3×3)에 Sound Pulse.
// 맵 구조(가구 · 상자 위치 · 플레이어 위치)는 절대 움직이지 않는다. 턴테이블은 시각적으로만 돈다.
// 상자는 일반 Wave 처럼 부서지고(드랍 포함), 그 위의 폭탄은 연쇄 폭발한다.
export class BeatDrop {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.phase = 'idle';
    this.nextAt = cfg.firstAt ?? cfg.interval;
    this.t = 0;
    this.cells = [];
  }

  _zone() {
    const { grid } = this.gm;
    const [cx, cy] = this.cfg.center;
    const r = this.cfg.radius ?? 1;
    const out = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (grid.waveInteraction(x, y) === 'block') continue;
        out.push({ x, y });
      }
    }
    return out;
  }

  update(dt) {
    const { gm, cfg } = this;
    if (this.phase === 'idle') {
      if (gm.matchTime >= this.nextAt) {
        this.cells = this._zone();
        this.phase = 'warn';
        this.t = 0;
        gm.emit('beatDropWarn', { warnTime: cfg.warnTime, cells: this.cells });
      }
      return;
    }
    if (this.phase === 'warn') {
      this.t += dt;
      if (this.t >= cfg.warnTime) {
        const [cx, cy] = cfg.center;
        const res = gm.waves.emitArea(this.zoneNow(), cx, cy, 'beatDrop');
        gm.emit('beatDrop', { explosionId: res.explosion.id, x: cx, y: cy });
        this.phase = 'idle';
        this.cells = [];
        this.nextAt = gm.matchTime + cfg.interval;
      }
    }
  }

  // 발사 순간 다시 계산 (경고 중 상자가 부서졌을 수 있음)
  zoneNow() {
    return this._zone();
  }

  getTelegraphs() {
    if (this.phase !== 'warn') return [];
    return [{ kind: 'pulse', cells: this.cells, progress: this.t / this.cfg.warnTime }];
  }

  get visual() {
    return { phase: this.phase, t: this.t };
  }
}
