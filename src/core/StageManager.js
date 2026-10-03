import { RouteCrates } from './gimmicks/routeCrates.js';
import { RollingLp } from './gimmicks/rollingLp.js';
import { Gates } from './gimmicks/gates.js';
import { RecPulse } from './gimmicks/recPulse.js';
import { Turntables } from './gimmicks/turntables.js';
import { SpeakerDrop } from './gimmicks/speakerDrop.js';
import { Wind } from './gimmicks/wind.js';
import { Doors } from './gimmicks/doors.js';
import { BeatDrop } from './gimmicks/beatDrop.js';

// 스테이지 기믹 레지스트리 — 전부 공용 (캐릭터 전용 기믹 없음)
export const GIMMICK_REGISTRY = {
  routeCrates: RouteCrates,
  rollingLp: RollingLp,
  gates: Gates,
  recPulse: RecPulse,
  turntables: Turntables,
  speakerDrop: SpeakerDrop,
  wind: Wind,
  doors: Doors,
  beatDrop: BeatDrop,
};

export class StageManager {
  constructor(gm, stageDef) {
    this.gm = gm;
    this.def = stageDef;
    this.gimmicks = (stageDef.gimmicks || []).map((cfg) => {
      const Cls = GIMMICK_REGISTRY[cfg.kind];
      if (!Cls) throw new Error(`Unknown gimmick ${cfg.kind}`);
      const g = new Cls(gm, cfg);
      g.kind = cfg.kind;
      return g;
    });
    for (const g of this.gimmicks) g.init?.();
  }

  get(kind) {
    return this.gimmicks.find((g) => g.kind === kind) || null;
  }

  update(dt) {
    for (const g of this.gimmicks) g.update?.(dt);
  }

  onPlayerEnterCell(p, x, y) {
    for (const g of this.gimmicks) g.onPlayerEnterCell?.(p, x, y);
  }

  onWaveCell(x, y, source) {
    for (const g of this.gimmicks) g.onWaveCell?.(x, y, source);
  }

  onWaveTouch(x, y, source) {
    for (const g of this.gimmicks) g.onWaveTouch?.(x, y, source);
  }

  onBreakableDestroyed(x, y, before) {
    for (const g of this.gimmicks) g.onBreakableDestroyed?.(x, y, before);
  }

  getTelegraphs() {
    const out = [];
    for (const g of this.gimmicks) if (g.getTelegraphs) out.push(...g.getTelegraphs());
    return out;
  }
}
