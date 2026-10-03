import { GameManager } from '../src/core/GameManager.js';
import { CELL } from '../src/config/stageConfig.js';

export const DT = 1 / 60;

// 테스트용 간단한 스테이지 (모든 칸 결정적)
export function testStage(map, extra = {}) {
  return {
    id: 'test',
    no: '00',
    name: 'TEST',
    legend: {
      B: { type: CELL.BREAKABLE, prop: 'box' },
      S: { type: CELL.SOLID, prop: 'sofa', movable: true },
      H: { type: CELL.SOLID, prop: 'shelf' },
      ...(extra.legend || {}),
    },
    randomFill: null,
    map,
    gimmicks: extra.gimmicks || [],
    houseEvents: extra.houseEvents || null,
    theme: {},
  };
}

export const OPEN_MAP = [
  '#############',
  '#1.........2#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#3.........4#',
  '#############',
];

export function makeGame({
  chars = ['vin', 'picker'],
  map = OPEN_MAP,
  stageDef = null,
  stageId = null,
  mode = 'battle',
  teams = null,
  seed = 42,
  extra = {},
  houseEvents,
} = {}) {
  const players = chars.map((c, i) => ({ slot: i, characterId: c, team: teams ? teams[i] : undefined }));
  return new GameManager({
    mode,
    stageId: stageId || undefined,
    stageDef: stageId ? undefined : stageDef || testStage(map, extra),
    players,
    seed,
    skipCountdown: true,
    houseEvents,
  });
}

export function run(gm, seconds, intents = {}) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const it = typeof intents === 'function' ? intents(gm, i) : intents;
    gm.step(DT, it);
  }
}

export function press(gm, playerId, key, dir = null) {
  gm.step(DT, { [playerId]: { dir, bomb: key === 'bomb', item: key === 'item' } });
}

export function placeAt(gm, p, x, y) {
  p.x = x;
  p.y = y;
  p.lastCellX = x;
  p.lastCellY = y;
}
