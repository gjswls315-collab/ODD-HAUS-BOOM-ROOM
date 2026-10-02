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
// 수치는 초기 밸런스 가안이다. 밸런스 조정은 이 파일만 수정하면 된다.
// (GDD v2 HTML 표와 일부 다름 — 구현 마스터 프롬프트 6절 수치를 우선 적용.
//  GDD v2 표: VIN bomb max 4 / PICKER wave 1→4 / A.A. wave 1→4 /
//  LOCKE 3→4,1→4,2→5 / REX wave max 6 / BULLY wave 2→5)
// ─────────────────────────────────────────────────────────────

export const STAT_KEYS = ['speed', 'bomb', 'wave'];

export const CHARACTERS = {
  vin: {
    id: 'vin',
    name: 'VIN',
    tagline: 'BALANCED',
    role: 'Balance Type',
    speed: { start: 3, max: 5 },
    bomb: { start: 1, max: 3 },
    wave: { start: 2, max: 5 },
  },

  picker: {
    id: 'picker',
    name: 'PICKER',
    tagline: 'FAST START',
    role: 'Speed Type',
    speed: { start: 4, max: 5 },
    bomb: { start: 1, max: 3 },
    wave: { start: 2, max: 4 },
  },

  aa: {
    id: 'aa',
    name: 'A.A.',
    tagline: 'MORE BOMBS',
    role: 'Bomb Type',
    speed: { start: 2, max: 4 },
    bomb: { start: 2, max: 5 },
    wave: { start: 2, max: 4 },
  },

  locke: {
    id: 'locke',
    name: 'LOCKE',
    tagline: 'STEADY',
    role: 'Stable Balance Type',
    speed: { start: 3, max: 4 },
    bomb: { start: 2, max: 4 },
    wave: { start: 3, max: 4 },
  },

  rex: {
    id: 'rex',
    name: 'REX',
    tagline: 'LONG WAVE',
    role: 'Wave Type',
    speed: { start: 2, max: 4 },
    bomb: { start: 1, max: 3 },
    wave: { start: 3, max: 5 },
  },

  buddy: {
    id: 'buddy',
    name: 'BUDDY',
    tagline: 'EASY START',
    role: 'Beginner Friendly',
    speed: { start: 4, max: 5 },
    bomb: { start: 1, max: 4 },
    wave: { start: 2, max: 4 },
  },

  bully: {
    id: 'bully',
    name: 'BULLY',
    tagline: 'AGGRESSIVE',
    role: 'Aggressive Speed Type',
    speed: { start: 4, max: 5 },
    bomb: { start: 1, max: 3 },
    wave: { start: 3, max: 4 },
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
