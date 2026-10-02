// ─────────────────────────────────────────────────────────────
// ITEM CONFIG — 아이템 10종 (GDD v3): 기본 성장 3종 + 공용 특수 7종
//
// 아이템 효과는 캐릭터 기본 Stats 와 분리된다. 캐릭터 전용 아이템은 없다.
//   kind 'stat'    : 기본 성장. CharacterStats +1 (캐릭터 MAX 를 넘지 않음)
//   kind 'ability' : 획득하면 그 판 동안 유지되는 공용 능력 (KICK / GLOVE / REMOTE)
//   kind 'held'    : 보유 슬롯 1칸 소모형 (SHIELD 자동 / NEEDLE / ROLLER SKATES). 새로 먹으면 교체
//   kind 'random'  : 획득 즉시 pool 에서 무작위 아이템으로 변환
//
// 아이템 키(E) 하나로 처리 — 우선순위:
//   ① 갇힘 + NEEDLE → 탈출  ② GLOVE + 손 닿는 Bomb → 던지기
//   ③ ROLLER SKATES → 가속  ④ REMOTE → 내 가장 오래된 Bomb 즉시 발동
// KICK 은 키 없이 Bomb 에 몸이 닿으면 진행 방향으로 걷어찬다.
// ─────────────────────────────────────────────────────────────

export const ITEM_TYPES = {
  speedUp: {
    id: 'speedUp',
    kind: 'stat',
    stat: 'speed',
    amount: 1,
    label: 'SPEED UP',
    desc: '이동속도 +1 (캐릭터 MAX 까지)',
    color: '#ff5a4f',
  },
  bombUp: {
    id: 'bombUp',
    kind: 'stat',
    stat: 'bomb',
    amount: 1,
    label: 'BOMB UP',
    desc: '동시 설치 가능 Beat Bomb +1',
    color: '#ffc55c',
  },
  waveUp: {
    id: 'waveUp',
    kind: 'stat',
    stat: 'wave',
    amount: 1,
    label: 'WAVE UP',
    desc: 'Sound Wave 거리 +1',
    color: '#54c7ff',
  },

  kick: {
    id: 'kick',
    kind: 'ability',
    label: 'KICK',
    desc: 'Bomb 에 몸이 닿으면 진행 방향으로 걷어참 (벽에서 정지)',
    color: '#ff7136',
  },
  glove: {
    id: 'glove',
    kind: 'ability',
    label: 'GLOVE',
    desc: 'Bomb 옆에서 E — 들어 올려 앞으로 던짐',
    color: '#f2e7d0',
  },
  remote: {
    id: 'remote',
    kind: 'ability',
    label: 'REMOTE',
    desc: 'E — 내 가장 오래된 Bomb 을 원하는 순간 발동',
    color: '#ff5a8a',
  },
  shield: {
    id: 'shield',
    kind: 'held',
    passive: true,
    label: 'SHIELD',
    desc: 'Sound Wave 1회 자동 방어 후 깨짐',
    color: '#7f9bff',
  },
  needle: {
    id: 'needle',
    kind: 'held',
    label: 'NEEDLE',
    desc: 'Sound Capsule 에 갇혔을 때 E — 즉시 탈출',
    color: '#d9f0ff',
  },
  rollerSkates: {
    id: 'rollerSkates',
    kind: 'held',
    duration: 6, // 5~8초 권장
    overMax: 1, // SPEED 를 캐릭터 MAX 보다 1 높게 (예: PICKER 5 → 6)
    label: 'ROLLER SKATES',
    desc: 'E — 일정 시간 SPEED 가 캐릭터 MAX + 1',
    color: '#b46bff',
  },

  randomBox: {
    id: 'randomBox',
    kind: 'random',
    label: 'RANDOM LP BOX',
    desc: 'Speed / Bomb / Wave / Shield / Kick 중 하나',
    color: '#ffd166',
  },
};

// RANDOM LP BOX 변환 가중치
export const RANDOM_BOX_POOL = {
  speedUp: 1,
  bombUp: 1,
  waveUp: 1,
  shield: 1,
  kick: 1,
};

// BREAKABLE 오브젝트 파괴 시 드랍 테이블
// 권장 초기 비율: Speed 30% · Bomb 30% · Wave 30% · Special 10%
// v4: BREAKABLE 약 55개 × 드랍 60~70% → 한 판 아이템 약 30~40개 (모두가 MAX 까지 가지는 못한다)
export const DROP_TABLES = {
  standard: {
    dropChance: 0.65,
    weights: {
      speedUp: 30,
      bombUp: 30,
      waveUp: 30,
      // Special 10%
      kick: 2,
      glove: 1.5,
      remote: 1.5,
      shield: 1.5,
      needle: 1.5,
      rollerSkates: 1,
      randomBox: 1,
    },
  },
  // ITEM MODE (확장 예정) — 특수 아이템 비중 증가
  itemMode: {
    dropChance: 0.7,
    weights: {
      speedUp: 18,
      bombUp: 18,
      waveUp: 18,
      kick: 7,
      glove: 7,
      remote: 7,
      shield: 7,
      needle: 7,
      rollerSkates: 6,
      randomBox: 5,
    },
  },
};

export const STAT_ITEM_FOR = { speed: 'speedUp', bomb: 'bombUp', wave: 'waveUp' };
export const ABILITY_IDS = Object.values(ITEM_TYPES)
  .filter((d) => d.kind === 'ability')
  .map((d) => d.id);
