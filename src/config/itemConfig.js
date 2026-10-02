// ─────────────────────────────────────────────────────────────
// ITEM CONFIG — 아이템 정의 / 드랍 테이블
//
// 아이템 효과는 캐릭터 기본 Stats 와 분리된다.
//   - stat    : 기본 성장 아이템. CharacterStats 를 +1 (캐릭터 max 까지만)
//   - special : 누구나 획득 가능한 특수 아이템. Held Item 슬롯 1칸에 보관 → E 키로 사용
//               (shield 는 보유 중 자동 발동)
//   - random  : 획득 즉시 pool 에서 무작위 아이템으로 변환
// 캐릭터 전용 아이템 / 캐릭터 전용 효과는 없다.
// ─────────────────────────────────────────────────────────────

export const ITEM_TYPES = {
  speedUp: {
    id: 'speedUp',
    kind: 'stat',
    stat: 'speed',
    amount: 1,
    label: 'SPEED UP',
    desc: '이동속도 +1',
    color: '#54c7ff',
  },
  bombUp: {
    id: 'bombUp',
    kind: 'stat',
    stat: 'bomb',
    amount: 1,
    label: 'BOMB UP',
    desc: '동시 설치 수 +1',
    color: '#ffc55c',
  },
  waveUp: {
    id: 'waveUp',
    kind: 'stat',
    stat: 'wave',
    amount: 1,
    label: 'WAVE UP',
    desc: 'Sound Wave 거리 +1',
    color: '#6ee3a3',
  },

  kick: {
    id: 'kick',
    kind: 'special',
    charges: 3,
    label: 'KICK',
    desc: '앞의 Beat Bomb 을 한 방향으로 걷어찬다',
    color: '#ff7136',
  },
  throw: {
    id: 'throw',
    kind: 'special',
    charges: 3,
    label: 'THROW',
    desc: 'Beat Bomb 을 짧은 거리 던진다',
    color: '#f2e7d0',
  },
  shield: {
    id: 'shield',
    kind: 'special',
    charges: 1,
    passive: true,
    label: 'SHIELD',
    desc: 'Sound Wave 1회 자동 방어',
    color: '#7f9bff',
  },
  remote: {
    id: 'remote',
    kind: 'special',
    charges: 3,
    label: 'REMOTE',
    desc: '내 Beat Bomb 하나를 원하는 타이밍에 발동',
    color: '#ff5a8a',
  },
  speedShoes: {
    id: 'speedShoes',
    kind: 'special',
    charges: 1,
    duration: 6,
    speedBonus: 2, // 기본 Stats 와 별개의 일시 보너스 (캐릭터 max 무시, 절대 상한만 적용)
    label: 'SPEED SHOES',
    desc: '일정 시간 이동속도 크게 증가',
    color: '#b46bff',
  },

  randomBox: {
    id: 'randomBox',
    kind: 'random',
    label: 'RANDOM BOX',
    desc: '무작위 아이템',
    color: '#ffd166',
  },
};

// RANDOM BOX 변환 가중치
export const RANDOM_BOX_POOL = {
  speedUp: 2,
  bombUp: 2,
  waveUp: 2,
  kick: 1,
  throw: 1,
  shield: 1,
  remote: 1,
  speedShoes: 1,
};

// BREAKABLE 오브젝트 파괴 시 드랍 테이블
export const DROP_TABLES = {
  standard: {
    dropChance: 0.46,
    weights: {
      speedUp: 25,
      bombUp: 25,
      waveUp: 25,
      kick: 5,
      throw: 4,
      shield: 5,
      remote: 3,
      speedShoes: 4,
      randomBox: 4,
    },
  },
  // ITEM MODE (확장 예정) — 특수 아이템 비중 증가
  itemMode: {
    dropChance: 0.62,
    weights: {
      speedUp: 16,
      bombUp: 16,
      waveUp: 16,
      kick: 10,
      throw: 9,
      shield: 10,
      remote: 7,
      speedShoes: 9,
      randomBox: 7,
    },
  },
};

export const STAT_ITEM_FOR = { speed: 'speedUp', bomb: 'bombUp', wave: 'waveUp' };
