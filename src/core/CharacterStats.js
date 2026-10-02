import { STAT_KEYS } from '../config/characterConfig.js';

// 캐릭터 기본 능력치 (SPEED / BOMB / WAVE) — start 에서 시작, 아이템으로 성장, max 에서 정지.
// 현재값 = min(start + collected, max)
// 일시적인 아이템 효과(Speed Shoes 등)는 여기에 섞지 않는다 → PlayerController.modifiers
export class CharacterStats {
  constructor(characterDef) {
    this.characterId = characterDef.id;
    this.start = {};
    this.max = {};
    this.current = {};
    this.collected = {};
    for (const k of STAT_KEYS) {
      const { start, max } = characterDef[k];
      if (!(start >= 1) || !(max >= start)) {
        throw new Error(`Invalid ${k} stats for ${characterDef.id}: start=${start} max=${max}`);
      }
      this.start[k] = start;
      this.max[k] = max;
      this.current[k] = start;
      this.collected[k] = 0;
    }
  }

  get speed() {
    return this.current.speed;
  }
  get bomb() {
    return this.current.bomb;
  }
  get wave() {
    return this.current.wave;
  }

  // 성장. 실제로 오른 양을 반환 (max 에 도달했으면 0)
  increase(stat, amount = 1) {
    if (!STAT_KEYS.includes(stat)) throw new Error(`Unknown stat: ${stat}`);
    this.collected[stat] += amount;
    const before = this.current[stat];
    this.current[stat] = Math.min(before + amount, this.max[stat]);
    return this.current[stat] - before;
  }

  isMaxed(stat) {
    return this.current[stat] >= this.max[stat];
  }

  snapshot() {
    return {
      current: { ...this.current },
      max: { ...this.max },
      start: { ...this.start },
    };
  }
}
