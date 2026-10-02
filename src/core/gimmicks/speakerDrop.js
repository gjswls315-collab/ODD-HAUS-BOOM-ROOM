// DJ BOOTH — Speaker Drop Event
// 일정 시간 동안 모든 Beat Bomb 카운트가 빨라진다 (모든 플레이어 동일 적용).
export class SpeakerDrop {
  constructor(gm, cfg) {
    this.gm = gm;
    this.cfg = cfg;
    this.phase = 'idle';
    this.nextAt = cfg.firstAt;
    this.t = 0;
  }

  update(dt) {
    const { gm, cfg } = this;
    if (this.phase === 'idle') {
      if (gm.matchTime >= this.nextAt) {
        this.phase = 'warn';
        this.t = 0;
        gm.emit('speakerDropWarn', { warnTime: cfg.warnTime });
      }
    } else if (this.phase === 'warn') {
      this.t += dt;
      if (this.t >= cfg.warnTime) {
        this.phase = 'active';
        this.t = 0;
        gm.bombs.fuseRate = 1 / cfg.fuseMultiplier;
        gm.emit('speakerDropStart', { duration: cfg.duration });
      }
    } else if (this.phase === 'active') {
      this.t += dt;
      if (this.t >= cfg.duration) {
        this.phase = 'idle';
        gm.bombs.fuseRate = 1;
        this.nextAt = gm.matchTime + gm.tempoInterval(cfg.interval);
        gm.emit('speakerDropEnd', {});
      }
    }
  }

  get active() {
    return this.phase === 'active';
  }

  get visual() {
    return { phase: this.phase, t: this.t };
  }
}
