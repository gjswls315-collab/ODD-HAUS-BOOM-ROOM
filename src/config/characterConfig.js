// ─────────────────────────────────────────────────────────────
// CHARACTER CONFIG — 능력치 데이터 전용 파일
//
// 규칙 (GDD v2):
//   - 모든 플레이 캐릭터는 동일한 조작 / 동일한 규칙을 사용한다.
//   - 캐릭터 차이는 SPEED / BOMB / WAVE 의 start(시작값)와 max(성장 한계)뿐이다.
//   - 캐릭터 전용 액티브 스킬, 스킬 게이지, 쿨다운은 존재하지 않는다.
//
// SPEED : 이동 속도 레벨 (실제 칸/초 변환은 gameConfig.speedTable)
// BOMB  : 동시에 설치 가능한 Beat Bomb 개수
// WAVE  : Sound Wave 가 상하좌우로 퍼지는 칸 수
//
// 수치는 초기 밸런스 가안이다 (GDD v3 FINAL CORE RULES). 밸런스 조정은 이 파일만 수정하면 된다.
// 5칸 척도. MAX 총합을 맞추지 않고 장단점을 명확하게:
//   PICKER 는 처음부터 빠르지만 폭탄·파동 상한이 낮고, REX 는 느리지만 후반 WAVE 가 길다.
// ─────────────────────────────────────────────────────────────

export const STAT_KEYS = ['speed', 'bomb', 'wave'];

export const CHARACTERS = {
  vin: {
    id: 'vin',
    name: 'VIN',
    tagline: 'BALANCED',
    label: '균형형',
    note: '초반과 후반 모두 안정적인 기준 캐릭터.',
    speed: { start: 3, max: 4 },
    bomb: { start: 1, max: 4 },
    wave: { start: 2, max: 5 },
  },

  picker: {
    id: 'picker',
    name: 'PICKER',
    tagline: 'FAST START',
    label: '스피드형',
    note: '처음부터 빠르지만 설치 수와 파동 상한은 낮다.',
    speed: { start: 4, max: 5 },
    bomb: { start: 1, max: 3 },
    wave: { start: 1, max: 4 },
  },

  aa: {
    id: 'aa',
    name: 'A.A.',
    tagline: 'MORE BOMBS',
    label: '폭탄 물량형',
    note: '초반부터 2개 설치. 후반에는 가장 많은 Beat Bomb 운용.',
    speed: { start: 2, max: 4 },
    bomb: { start: 2, max: 5 },
    wave: { start: 2, max: 4 },
  },

  locke: {
    id: 'locke',
    name: 'LOCKE',
    tagline: 'STEADY',
    label: '안정형 올라운더',
    note: '초반부터 Bomb 이 2개라 운영이 편한 올라운더.',
    speed: { start: 3, max: 4 },
    bomb: { start: 2, max: 4 },
    wave: { start: 2, max: 4 },
  },

  rex: {
    id: 'rex',
    name: 'REX',
    tagline: 'LONG WAVE',
    label: '장거리 파동형',
    note: '느리지만 시작 Wave 부터 길고 후반 장악력이 강하다.',
    speed: { start: 2, max: 3 },
    bomb: { start: 1, max: 4 },
    wave: { start: 3, max: 5 },
  },

  buddy: {
    id: 'buddy',
    name: 'BUDDY',
    tagline: 'EASY START',
    label: '초보 친화 기동형',
    note: 'Bomb 2개로 시작하고 속도가 크게 성장해 입문자에게 편하다.',
    speed: { start: 3, max: 5 },
    bomb: { start: 2, max: 4 },
    wave: { start: 2, max: 3 },
  },

  bully: {
    id: 'bully',
    name: 'BULLY',
    tagline: 'AGGRESSIVE',
    label: '공격적 고점형',
    note: '빠른 움직임과 긴 후반 Wave 로 상대를 압박한다.',
    speed: { start: 4, max: 5 },
    bomb: { start: 1, max: 3 },
    wave: { start: 2, max: 5 },
  },
};

// 선택 화면 순서
export const PLAYABLE_CHARACTER_IDS = ['vin', 'picker', 'aa', 'locke', 'rex', 'buddy', 'bully'];

// 플레이 불가 — House Event 전용 환경 캐릭터
export const NON_PLAYABLE_CHARACTERS = {
  mrOdd: {
    id: 'mrOdd',
    name: 'MR. ODD',
    tagline: 'HOUSE EVENT',
    role: 'Environment / House Event',
    playable: false,
  },
};

// 선택 화면 / HUD 에서 능력치 칸 개수 (모든 캐릭터 max 중 최댓값 이상)
export const STAT_DISPLAY_SLOTS = Math.max(
  5,
  ...Object.values(CHARACTERS).flatMap((c) => STAT_KEYS.map((k) => c[k].max)),
);

export function getCharacter(id) {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`Unknown or non-playable character: ${id}`);
  return def;
}

export function isPlayable(id) {
  return Object.prototype.hasOwnProperty.call(CHARACTERS, id);
}
