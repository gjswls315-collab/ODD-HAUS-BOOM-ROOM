// ─────────────────────────────────────────────────────────────
// AudioManager — WebAudio 합성 사운드 (외부 음원 없이 동작)
// "Music Makes Mischief" — 배경 비트 + Beat Bomb / Sound Wave 효과음
// 비주얼 펄스용 beat 값(0~1)도 제공한다.
// ─────────────────────────────────────────────────────────────

const BASS = [0, 0, 3, 0, 5, 3, 7, 5]; // 단조 펜타토닉 느낌 (반음 단위)

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.bpm = 100;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.startPerf = performance.now();
    try {
      this.muted = localStorage.getItem('boomroom.muted') === '1';
    } catch {
      /* storage blocked */
    }
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('boomroom.muted', this.muted ? '1' : '0');
    } catch {
      /* storage blocked */
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  setTempo(bpm) {
    this.bpm = bpm;
  }

  // 0~1 비트 펄스 (오디오 없이도 동작)
  beat() {
    const t = (performance.now() - this.startPerf) / 1000;
    const ph = (t * this.bpm) / 60;
    return Math.pow(1 - (ph % 1), 4);
  }

  startMusic() {
    if (!this.ctx || this.playing) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stopMusic() {
    this.playing = false;
    clearInterval(this.timer);
  }

  _schedule() {
    const ctx = this.ctx;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const s = this.step % 16;
      const t = this.nextTime;
      if (s % 4 === 0) this._kick(t);
      if (s === 4 || s === 12) this._clap(t);
      if (s % 2 === 1) this._hat(t, 0.25);
      if (s % 2 === 0) this._bass(t, BASS[(Math.floor(this.step / 2) % 8)], (60 / this.bpm) * 0.45);
      if (s === 0 && Math.floor(this.step / 16) % 2 === 0) this._stab(t);
      this.nextTime += 60 / this.bpm / 4;
      this.step++;
    }
  }

  _env(node, t, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _osc(type, freq, t, dur, peak, dest, freqEnd = null) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    this._env(g, t, 0.005, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(t, dur, peak, dest, { type = 'highpass', freq = 6000, q = 0.7 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, 0.003, peak, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _kick(t) {
    this._osc('sine', 140, t, 0.22, 0.9, this.musicGain, 42);
  }
  _clap(t) {
    this._noise(t, 0.12, 0.35, this.musicGain, { type: 'bandpass', freq: 1500, q: 0.8 });
  }
  _hat(t, v) {
    this._noise(t, 0.04, v * 0.5, this.musicGain, { freq: 8000 });
  }
  _bass(t, semi, dur) {
    const f = 55 * Math.pow(2, semi / 12);
    const o = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(900, t);
    flt.frequency.exponentialRampToValueAtTime(180, t + dur);
    this._env(g, t, 0.01, 0.35, dur);
    o.connect(flt).connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  _stab(t) {
    for (const semi of [0, 3, 7]) this._osc('triangle', 220 * Math.pow(2, semi / 12), t, 0.3, 0.08, this.musicGain);
  }

  sfx(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.005;
    const D = this.sfxGain;
    switch (name) {
      case 'place':
        this._osc('square', 660, t, 0.08, 0.2, D, 880);
        break;
      case 'tick':
        this._osc('sine', 1200, t, 0.03, 0.08, D);
        break;
      case 'boom':
        this._osc('sine', 120, t, 0.5, 0.9, D, 35);
        this._noise(t, 0.35, 0.5, D, { type: 'lowpass', freq: 1800, q: 1 });
        this._osc('sawtooth', 300, t, 0.3, 0.12, D, 60);
        break;
      case 'pulse':
        this._osc('sawtooth', 220, t, 0.25, 0.15, D, 880);
        break;
      case 'break':
        this._noise(t, 0.18, 0.4, D, { type: 'bandpass', freq: 900, q: 1.2 });
        break;
      case 'pickup': {
        const base = opts.maxed ? 330 : 523;
        [0, 4, 7, 12].forEach((s, i) => this._osc('triangle', base * Math.pow(2, s / 12), t + i * 0.05, 0.12, 0.18, D));
        break;
      }
      case 'trap':
        this._osc('sine', 300, t, 0.35, 0.35, D, 900);
        break;
      case 'pop':
        this._osc('square', 900, t, 0.08, 0.3, D, 200);
        this._noise(t, 0.08, 0.3, D, { freq: 3000 });
        break;
      case 'rescue':
        [0, 5, 9, 12].forEach((s, i) => this._osc('sine', 660 * Math.pow(2, s / 12), t + i * 0.06, 0.15, 0.18, D));
        break;
      case 'item':
        this._osc('triangle', 440, t, 0.12, 0.2, D, 1320);
        break;
      case 'fail':
        this._osc('square', 160, t, 0.12, 0.12, D);
        break;
      case 'warn':
        for (let i = 0; i < 3; i++) this._osc('square', 520, t + i * 0.22, 0.12, 0.14, D, 400);
        break;
      case 'house':
        this._osc('sawtooth', 70, t, 0.9, 0.35, D, 50);
        this._osc('sawtooth', 105, t, 0.9, 0.2, D, 75);
        break;
      case 'countdown':
        this._osc('square', opts.go ? 880 : 440, t, opts.go ? 0.4 : 0.15, 0.25, D);
        break;
      case 'ui':
        this._osc('triangle', 700, t, 0.05, 0.12, D);
        break;
      case 'confirm':
        this._osc('triangle', 600, t, 0.08, 0.18, D, 1200);
        break;
      case 'victory':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this._osc('triangle', 392 * Math.pow(2, s / 12), t + i * 0.09, 0.25, 0.18, D));
        break;
      default:
        break;
    }
  }
}
