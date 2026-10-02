// ─────────────────────────────────────────────────────────────
// INPUT CONFIG — 모든 캐릭터 공통 조작 (캐릭터 전용 키 없음)
//
//   이동        : Arrow Keys / WASD
//   Beat Bomb   : SPACE
//   Dash        : SHIFT
//   특수 아이템 : E
//   Pause       : ESC
//
// Q 키는 의도적으로 바인딩하지 않는다 (캐릭터 스킬 복구 금지).
// 로컬 멀티플레이 시 한 키보드를 나눠 쓰도록 플레이어별 프로필을 둔다.
// 값은 KeyboardEvent.code
// ─────────────────────────────────────────────────────────────

export const KEY_PROFILES = {
  // 혼자 플레이할 때 P1: WASD + 방향키 모두 사용
  solo: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    bomb: ['Space', 'Enter'],
    dash: ['ShiftLeft', 'ShiftRight'],
    item: ['KeyE', 'Slash'],
  },
  p1: {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    bomb: ['Space'],
    dash: ['ShiftLeft'],
    item: ['KeyE'],
  },
  p2: {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    bomb: ['Enter', 'Numpad0'],
    dash: ['ShiftRight', 'NumpadDecimal'],
    item: ['Slash', 'NumpadEnter'],
  },
  p3: {
    up: ['KeyI'],
    down: ['KeyK'],
    left: ['KeyJ'],
    right: ['KeyL'],
    bomb: ['KeyU'],
    dash: ['KeyY'],
    item: ['KeyO'],
  },
  p4: {
    up: ['Numpad8'],
    down: ['Numpad5'],
    left: ['Numpad4'],
    right: ['Numpad6'],
    bomb: ['Numpad7'],
    dash: ['Numpad1'],
    item: ['Numpad9'],
  },
};

export const KEY_LABELS = {
  solo: { move: 'WASD / ←↑↓→', bomb: 'SPACE', dash: 'SHIFT', item: 'E' },
  p1: { move: 'WASD', bomb: 'SPACE', dash: 'L-SHIFT', item: 'E' },
  p2: { move: '←↑↓→', bomb: 'ENTER', dash: 'R-SHIFT', item: '/' },
  p3: { move: 'IJKL', bomb: 'U', dash: 'Y', item: 'O' },
  p4: { move: 'NUM 8456', bomb: 'NUM 7', dash: 'NUM 1', item: 'NUM 9' },
};

export const GLOBAL_KEYS = {
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  debug: ['F3', 'Backquote'],
};

// Gamepad (Standard mapping) — 연결 순서대로 P1~P4 에 추가 배정
export const GAMEPAD_MAP = {
  bomb: [0], // A
  item: [1], // B
  dash: [2, 5], // X, RB
  pause: [9], // Start
  deadzone: 0.35,
};
