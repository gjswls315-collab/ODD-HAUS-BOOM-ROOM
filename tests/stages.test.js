import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_ORDER, CELL } from '../src/config/stageConfig.js';
import { GridManager } from '../src/core/GridManager.js';
import { Rng } from '../src/core/rng.js';
import { makeGame, run, placeAt, DT } from './helpers.js';
import { GameManager } from '../src/core/GameManager.js';

function connectedIgnoringBreakables(grid) {
  const seen = new Set();
  const start = grid.spawns[0];
  const q = [start];
  seen.add(`${start.x},${start.y}`);
  while (q.length) {
    const c = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const cell = grid.get(x, y);
      if (!cell || seen.has(`${x},${y}`)) continue;
      const solid = cell.type === CELL.SOLID || (cell.type === CELL.GIMMICK && cell.gimmick?.solid && cell.gimmick.kind !== 'door');
      if (solid) continue;
      seen.add(`${x},${y}`);
      q.push({ x, y });
    }
  }
  return grid.spawns.every((s) => seen.has(`${s.x},${s.y}`));
}

describe('Stages (6 arenas)', () => {
  it('6 stages in the GDD order', () => {
    expect(STAGE_ORDER).toEqual(['lounge', 'lpLibrary', 'studio', 'djBooth', 'terrace', 'lockedRoom']);
  });

  for (const id of Object.keys(STAGES)) {
    it(`${id}: valid grid, 4 spawns, spawns connected, safe spawn corners`, () => {
      const grid = GridManager.fromStage(STAGES[id], new Rng(7));
      expect(grid.spawns.filter(Boolean).length).toBe(4);
      expect(connectedIgnoringBreakables(grid)).toBe(true);
      for (const s of grid.spawns) {
        expect(grid.isWalkable(s.x, s.y)).toBe(true);
        const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid.isWalkable(s.x + dx, s.y + dy));
        expect(free.length).toBeGreaterThanOrEqual(2);
      }
    });
  }

  it('same seed → same random fill (deterministic)', () => {
    const a = GridManager.fromStage(STAGES.lounge, new Rng(123)).toAscii();
    const b = GridManager.fromStage(STAGES.lounge, new Rng(123)).toAscii();
    const c = GridManager.fromStage(STAGES.lounge, new Rng(999)).toAscii();
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('Lounge sofas are grouped as multi-cell movable furniture', () => {
    const grid = GridManager.fromStage(STAGES.lounge, new Rng(1));
    const sofas = [...grid.groups.values()].filter((g) => g.prop === 'sofa');
    expect(sofas.length).toBe(6);
    expect(sofas.every((g) => g.movable && g.cells.length === 3)).toBe(true);
  });
});

describe('Mr. ODD House Event', () => {
  it('Lounge: MR. ODD pushes a sofa (logic grid changes, not a hero skill)', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lounge',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 5,
      skipCountdown: true,
    });
    const before = gm.grid.toAscii();
    gm.house.forceStart('furniturePush');
    expect(gm.events.some((e) => e.type === 'houseEvent' && e.phase === 'warn')).toBe(true);
    run(gm, gm.stageDef.houseEvents.warnTime + 0.1, {});
    expect(gm.events.some((e) => e.type === 'groupMoved')).toBe(true);
    expect(gm.grid.toAscii()).not.toBe(before);
    // Mr. ODD 는 플레이어가 아니다
    expect(gm.players.list.some((p) => p.characterId === 'mrOdd')).toBe(false);
  });

  it('House event is scheduled automatically at firstAt', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lounge',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 5,
      skipCountdown: true,
    });
    run(gm, gm.stageDef.houseEvents.firstAt + 0.1, {});
    expect(gm.house.phase).not.toBe('idle');
  });

  it('blockSpawn never drops on players', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lpLibrary',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 9,
      skipCountdown: true,
    });
    gm.house.forceStart('blockSpawn');
    run(gm, 3.5, {});
    for (const p of gm.players.list) expect(gm.grid.isWalkable(p.cellX, p.cellY)).toBe(true);
  });
});

describe('Stage gimmicks (shared by all characters)', () => {
  it('LP LIBRARY: breaking a route crate opens the secret shelf', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lpLibrary',
      players: [{ characterId: 'rex' }, { characterId: 'vin' }],
      seed: 3,
      skipCountdown: true,
    });
    expect(gm.grid.get(8, 4).gimmick.kind).toBe('secretShelf');
    expect(gm.grid.isSolid(8, 4)).toBe(true);
    const before = gm.grid.destroyBreakable(8, 3);
    gm.stage.onBreakableDestroyed(8, 3, before);
    expect(gm.grid.isSolid(8, 4)).toBe(false);
    expect(gm.events.some((e) => e.type === 'routeOpened')).toBe(true);
  });

  it('LP LIBRARY: Rolling LP pushes players out of the lane', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lpLibrary',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 3,
      skipCountdown: true,
      houseEvents: false,
    });
    const p = gm.players.get(0);
    gm.grid.setEmpty(6, 5);
    gm.grid.setEmpty(6, 7);
    placeAt(gm, p, 6, 6);
    const lp = gm.stage.get('rollingLp');
    lp.nextAt = 0;
    run(gm, 4, {});
    expect(p.cellY).not.toBe(6);
  });

  it('STUDIO: REC switch makes amps fire Sound Pulses', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'studio',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 3,
      skipCountdown: true,
      houseEvents: false,
    });
    const p = gm.players.get(0);
    gm.grid.setEmpty(8, 5);
    placeAt(gm, p, 8, 5);
    run(gm, 0.5, { 0: { dir: 'down' } });
    expect(gm.stage.get('recStudio').state).toBe('rec');
    let pulses = 0;
    run(gm, 3, (g) => {
      pulses += g.events.filter((e) => e.type === 'pulse').length;
      g.events.length = 0;
      return {};
    });
    expect(pulses).toBeGreaterThan(0);
  });

  it('DJ BOOTH: turntable ring rotates contents; Speaker Drop speeds up fuses', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'djBooth',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 3,
      skipCountdown: true,
      houseEvents: false,
    });
    const tt = gm.stage.get('turntables');
    expect(tt.decks.length).toBe(2);
    const deck = tt.decks[0];
    for (const c of deck.ring) gm.grid.setEmpty(c.x, c.y);
    gm.grid.setBreakable(deck.ring[0].x, deck.ring[0].y, 'vinylCrate');
    gm.items.spawn('bombUp', deck.ring[2].x, deck.ring[2].y);
    tt.rotate(deck);
    expect(gm.grid.get(deck.ring[1].x, deck.ring[1].y).type).toBe('BREAKABLE');
    expect(gm.grid.get(deck.ring[0].x, deck.ring[0].y).type).toBe('EMPTY');
    expect(gm.items.items[0].x).toBe(deck.ring[3].x);
    expect(gm.items.items[0].y).toBe(deck.ring[3].y);

    const sd = gm.stage.get('speakerDrop');
    sd.nextAt = 0;
    run(gm, sd.cfg.warnTime + 0.1, {});
    expect(gm.bombs.fuseRate).toBeGreaterThan(1);
  });

  it('TERRACE: wind is telegraphed, then pushes players one cell', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'terrace',
      players: [{ characterId: 'vin' }, { characterId: 'picker' }],
      seed: 3,
      skipCountdown: true,
      houseEvents: false,
    });
    const wind = gm.stage.get('wind');
    wind.nextAt = 0;
    gm.step(DT, {});
    expect(wind.phase).toBe('warn');
    expect(gm.getTelegraphs().some((t) => t.kind === 'wind')).toBe(true);
    const p = gm.players.get(0);
    for (let y = 1; y < gm.grid.height - 1; y++) for (let x = 1; x < gm.grid.width - 1; x++) if (gm.grid.get(x, y).type === 'BREAKABLE') gm.grid.setEmpty(x, y);
    placeAt(gm, p, 8, 4);
    const sx = p.cellX;
    const sy = p.cellY;
    run(gm, wind.cfg.warnTime + 0.4, {});
    expect(Math.abs(p.cellX - sx) + Math.abs(p.cellY - sy)).toBe(1);
  });

  it('LOCKED ROOM: any player can flip the lever to toggle doors', () => {
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lockedRoom',
      players: [{ characterId: 'buddy' }, { characterId: 'bully' }],
      seed: 3,
      skipCountdown: true,
      houseEvents: false,
    });
    expect(gm.grid.isSolid(8, 2)).toBe(true); // closed door
    expect(gm.grid.isSolid(4, 5)).toBe(false); // open door
    const p = gm.players.get(0);
    gm.grid.setEmpty(8, 5);
    placeAt(gm, p, 8, 5);
    run(gm, 0.5, { 0: { dir: 'down' } });
    expect(gm.grid.isSolid(8, 2)).toBe(false);
    expect(gm.grid.isSolid(4, 5)).toBe(true);
  });
});
