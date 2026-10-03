// 공통 상수 — 캐릭터별 Skill State 는 존재하지 않는다.

export const PLAYER_STATE = {
  IDLE: 'IDLE',
  MOVE: 'MOVE',
  PLACE_BOMB: 'PLACE_BOMB',
  USE_ITEM: 'USE_ITEM',
  TRAPPED: 'TRAPPED',
  RESCUED: 'RESCUED',
  ELIMINATED: 'ELIMINATED',
  VICTORY: 'VICTORY',
};

export const BOMB_STATE = {
  COUNT: 'COUNT',
  DROP: 'DROP',
};

export const MATCH_PHASE = {
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  ENDED: 'ENDED',
};

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DIR_NAMES = ['up', 'down', 'left', 'right'];

export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function cellKey(x, y) {
  return (y << 8) | x;
}

export function dirFromDelta(dx, dy) {
  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  if (dy < 0) return 'up';
  return null;
}
