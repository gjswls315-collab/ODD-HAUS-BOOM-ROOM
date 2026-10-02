import { describe, it, expect } from 'vitest';
import { makeGame, run, press, placeAt, DT } from './helpers.js';
import { GAME_CONFIG } from '../src/config/gameConfig.js';

const WALL_MAP = [
  '#############',
  '#1....H....2#',
  '#.....B.....#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#3.........4#',
  '#############',
];

describe('Beat Bomb / Sound Wave', () => {
  it('PLACE → COUNT → DROP → SOUND WAVE', () => {
    const gm = makeGame();
    const vin = gm.players.get(0);
    placeAt(gm, vin, 3, 3);
    press(gm, 0, 'bomb');
    const bomb = gm.bombs.at(3, 3);
    expect(bomb.state).toBe('COUNT');
    expect(vin.activeBombs).toBe(1);
    run(gm, GAME_CONFIG.bomb.fuseTime - GAME_CONFIG.bomb.dropTime + 0.05, {});
    expect(gm.bombs.at(3, 3).state).toBe('DROP');
    run(gm, 0.4, {});
    expect(gm.bombs.at(3, 3)).toBeNull();
    expect(vin.activeBombs).toBe(0);
  });

  it('cannot place two bombs on the same cell / over capacity', () => {
    const gm = makeGame({ chars: ['aa', 'vin'] });
    const aa = gm.players.get(0);
    placeAt(gm, aa, 3, 3);
    press(gm, 0, 'bomb');
    press(gm, 0, 'bomb');
    expect(gm.bombs.countFor(0)).toBe(1);
  });

  it('wave stops at SOLID, destroys BREAKABLE and stops there', () => {
    const gm = makeGame({ chars: ['rex', 'vin'], map: WALL_MAP });
    const rex = gm.players.get(0);
    // bomb at (6,3) → up: (6,2) is BREAKABLE → destroyed, (6,1) is SOLID shelf not reached
    placeAt(gm, rex, 6, 3);
    press(gm, 0, 'bomb');
    placeAt(gm, rex, 1, 5);
    const ex = [];
    run(gm, 3, (g) => {
      ex.push(...g.events.filter((e) => e.type === 'explosion' || e.type === 'blockDestroyed'));
      g.events.length = 0;
      return {};
    });
    const boom = ex.find((e) => e.type === 'explosion');
    expect(boom.arms.up).toBe(1);
    expect(ex.some((e) => e.type === 'blockDestroyed' && e.x === 6 && e.y === 2)).toBe(true);
    expect(gm.grid.get(6, 2).type).toBe('EMPTY');
    expect(gm.grid.get(6, 1).type).toBe('SOLID');
  });

  it('wave blocked by SOLID does not include the solid cell', () => {
    const gm = makeGame({ chars: ['rex', 'vin'], map: WALL_MAP });
    const rex = gm.players.get(0);
    placeAt(gm, rex, 5, 1); // right of it is H at (6,1)
    press(gm, 0, 'bomb');
    placeAt(gm, rex, 1, 5);
    let boom;
    run(gm, 3, (g) => {
      boom = boom || g.events.find((e) => e.type === 'explosion');
      return {};
    });
    expect(boom.arms.right).toBe(0);
  });

  it('chain reaction: a wave hitting another Beat Bomb detonates it', () => {
    const gm = makeGame({ chars: ['vin', 'aa'] });
    const vin = gm.players.get(0);
    const aa = gm.players.get(1);
    placeAt(gm, vin, 3, 3);
    press(gm, 0, 'bomb');
    run(gm, 1.5, {});
    // A.A. bomb placed later — would explode 1.5s after vin's otherwise
    placeAt(gm, aa, 5, 3);
    press(gm, 1, 'bomb');
    placeAt(gm, vin, 10, 5);
    placeAt(gm, aa, 10, 1);
    const booms = [];
    run(gm, 1.4, (g) => {
      for (const e of g.events) if (e.type === 'explosion') booms.push({ ...e, at: g.time });
      g.events.length = 0;
      return {};
    });
    expect(booms.length).toBe(2);
    expect(booms[1].chained).toBe(true);
    expect(booms[1].at - booms[0].at).toBeLessThan(0.2);
  });

  it('player can walk off the bomb just placed but not back onto it', () => {
    const gm = makeGame();
    const vin = gm.players.get(0);
    placeAt(gm, vin, 3, 3);
    press(gm, 0, 'bomb');
    run(gm, 0.2, { 0: { dir: 'right' } });
    expect(vin.cellX).toBe(4);
    run(gm, 0.6, { 0: { dir: 'left' } });
    expect(vin.cellX).toBe(4); // blocked by own bomb now
    expect(vin.x).toBeGreaterThan(3.5);
  });

  it('bomb uses wave range at placement time', () => {
    const gm = makeGame();
    const vin = gm.players.get(0);
    placeAt(gm, vin, 6, 3);
    press(gm, 0, 'bomb');
    gm.items.spawn('waveUp', 6, 3);
    gm.step(DT, {});
    expect(vin.waveRange).toBe(3);
    expect(gm.bombs.at(6, 3).range).toBe(2);
  });
});
