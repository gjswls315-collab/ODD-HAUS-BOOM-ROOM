import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_ORDER, CELL } from '../src/config/stageConfig.js';
import { GridManager } from '../src/core/GridManager.js';
import { Rng } from '../src/core/rng.js';
import { run, placeAt, press, DT } from './helpers.js';
import { GameManager } from '../src/core/GameManager.js';

// GDD v3 13×11 원본 격자 (맵 데이터가 기획서와 동일한지 확인)
const GDD_V3_GRIDS = {
  lounge: ['#############', '#S..B...B..S#', '#.#B#B#B#B#.#', '#..BB...BB..#', '#B###...###B#', '#....BGB....#', '#B###...###B#', '#..BB...BB..#', '#.#B#B#B#B#.#', '#S..B...B..S#', '#############'],
  lpLibrary: ['#############', '#S.B#B.B#B.S#', '#.#.#B#.#.#.#', '#B..B...B..B#', '###.B.#.B.###', '#..B..G..B..#', '###.B.#.B.###', '#B..B...B..B#', '#.#.#B#.#.#.#', '#S.B#B.B#B.S#', '#############'],
  studio: ['#############', '#S..B.G.B..S#', '#.#B#B#B#B#.#', '#...B...B...#', '#B#B.#.#.B#B#', '#..G.....G..#', '#B#B.#.#.B#B#', '#...B...B...#', '#.#B#B#B#B#.#', '#S..B.G.B..S#', '#############'],
  djBooth: ['#############', '#S..B...B..S#', '#.#B#G#G#B#.#', '#..B.....B..#', '#B###B.B###B#', '#..G.....G..#', '#B###B.B###B#', '#..B.....B..#', '#.#B#G#G#B#.#', '#S..B...B..S#', '#############'],
  terrace: ['#############', '#S.........S#', '#..B.#.#.B..#', '#.B.......B.#', '#...#B.B#...#', '#....G.G....#', '#...#B.B#...#', '#.B.......B.#', '#..B.#.#.B..#', '#S.........S#', '#############'],
  lockedRoom: ['#############', '#S.B#...#B.S#', '#.#B#.B.#B#.#', '#B...#.#...B#', '###B.....B###', '#..B.GGG.B..#', '###B.....B###', '#B...#.#...B#', '#.#B#.B.#B#.#', '#S.B#...#B.S#', '#############'],
};

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
      // 상자·숨은 선반·게이트는 열릴 수 있으므로 통과 가능으로 본다
      if (cell.type === CELL.SOLID) continue;
      seen.add(`${x},${y}`);
      q.push({ x, y });
    }
  }
  return grid.spawns.every((s) => seen.has(`${s.x},${s.y}`));
}

function game(stageId, opts = {}) {
  return new GameManager({
    mode: 'battle',
    stageId,
    players: [{ characterId: opts.a || 'vin' }, { characterId: opts.b || 'picker' }],
    seed: opts.seed ?? 3,
    skipCountdown: true,
    houseEvents: opts.houseEvents,
  });
}

describe('Stages (6 arenas, GDD v3 13×11 grids)', () => {
  it('6 stages in the GDD order', () => {
    expect(STAGE_ORDER).toEqual(['lounge', 'lpLibrary', 'studio', 'djBooth', 'terrace', 'lockedRoom']);
  });

  for (const id of Object.keys(STAGES)) {
    it(`${id}: map is exactly the GDD v3 grid, 4 spawns, connected, safe corners`, () => {
      expect(STAGES[id].map).toEqual(GDD_V3_GRIDS[id]);
      const grid = GridManager.fromStage(STAGES[id], new Rng(7));
      expect(grid.width).toBe(13);
      expect(grid.height).toBe(11);
      expect(grid.spawns.filter(Boolean).length).toBe(4);
      expect(grid.spawns).toEqual([
        { x: 1, y: 1 },
        { x: 11, y: 1 },
        { x: 1, y: 9 },
        { x: 11, y: 9 },
      ]);
      expect(connectedIgnoringBreakables(grid)).toBe(true);
      for (const s of grid.spawns) {
        expect(grid.isWalkable(s.x, s.y)).toBe(true);
        const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid.isWalkable(s.x + dx, s.y + dy));
        expect(free.length).toBeGreaterThanOrEqual(2);
      }
      // 논리 판정: # = SOLID, B = BREAKABLE (오버라이드 셀 제외)
      const overrides = new Set((STAGES[id].overrides || []).map((o) => `${o.at[0]},${o.at[1]}`));
      GDD_V3_GRIDS[id].forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (overrides.has(`${x},${y}`)) return;
          const c = grid.get(x, y);
          if (ch === '#') expect(c.type, `${id} ${x},${y}`).toBe(CELL.SOLID);
          if (ch === 'B') expect(c.type, `${id} ${x},${y}`).toBe(CELL.BREAKABLE);
          if (ch === '.' || ch === 'S') expect(c.type, `${id} ${x},${y}`).toBe(CELL.EMPTY);
        }),
      );
    });
  }

  it('fixed layout; seed only changes breakable prop visuals', () => {
    const a = GridManager.fromStage(STAGES.lounge, new Rng(123));
    const b = GridManager.fromStage(STAGES.lounge, new Rng(123));
    const c = GridManager.fromStage(STAGES.lounge, new Rng(999));
    expect(a.toAscii()).toBe(b.toAscii());
    expect(a.toAscii()).toBe(c.toAscii());
    expect(a.cells.map((x) => x.prop).join()).toBe(b.cells.map((x) => x.prop).join());
  });

  it('Lounge: 4 sofas (### runs) are movable furniture, center G is the floor lamp', () => {
    const grid = GridManager.fromStage(STAGES.lounge, new Rng(1));
    const sofas = [...grid.groups.values()].filter((g) => g.prop === 'sofa');
    expect(sofas.length).toBe(4);
    expect(sofas.every((g) => g.movable && g.cells.length === 3)).toBe(true);
    expect(grid.get(6, 5).prop).toBe('lamp');
    expect(grid.get(6, 5).type).toBe(CELL.SOLID);
  });

  it('Locked Room: GGG is one Old Audio Machine, wall-attached pieces are not movable', () => {
    const grid = GridManager.fromStage(STAGES.lockedRoom, new Rng(1));
    const audio = [...grid.groups.values()].filter((g) => g.prop === 'oldAudio');
    expect(audio.length).toBe(1);
    expect(audio[0].cells.length).toBe(3);
    const movable = [...grid.groups.values()].filter((g) => g.movable);
    expect(movable.length).toBe(8);
    expect(grid.get(4, 1).movable).toBe(false);
  });
});

describe('Mr. ODD House Event (Lounge / Locked Room)', () => {
  it('Lounge: MR. ODD pushes a sofa (logic grid changes, not a hero skill)', () => {
    const gm = game('lounge', { seed: 5 });
    const before = gm.grid.toAscii();
    gm.house.forceStart('furniturePush');
    expect(gm.events.some((e) => e.type === 'houseEvent' && e.phase === 'warn')).toBe(true);
    run(gm, gm.stageDef.houseEvents.warnTime + 0.1, {});
    expect(gm.events.some((e) => e.type === 'groupMoved')).toBe(true);
    expect(gm.grid.toAscii()).not.toBe(before);
    expect(gm.players.list.some((p) => p.characterId === 'mrOdd')).toBe(false);
  });

  it('House event is scheduled automatically at firstAt', () => {
    const gm = game('lounge', { seed: 5 });
    run(gm, gm.stageDef.houseEvents.firstAt + 0.1, {});
    expect(gm.house.phase).not.toBe('idle');
  });

  it('Locked Room: furniture moves change . ↔ # (two pieces at once)', () => {
    const gm = game('lockedRoom', { seed: 8 });
    const before = gm.grid.toAscii();
    gm.house.forceStart('furniturePush');
    run(gm, gm.stageDef.houseEvents.warnTime + 0.1, {});
    expect(gm.events.filter((e) => e.type === 'groupMoved').length).toBeGreaterThanOrEqual(1);
    expect(gm.grid.toAscii()).not.toBe(before);
  });

  it('blockSpawn never drops on players', () => {
    const gm = game('lockedRoom', { seed: 9 });
    gm.house.forceStart('blockSpawn');
    run(gm, 3.5, {});
    for (const p of gm.players.list) expect(gm.grid.isWalkable(p.cellX, p.cellY)).toBe(true);
  });

  it('stages without Mr. ODD use their own stage events instead', () => {
    for (const id of ['lpLibrary', 'studio', 'djBooth', 'terrace']) {
      expect(STAGES[id].houseEvents).toBeNull();
      expect(STAGES[id].gimmicks.length).toBeGreaterThan(0);
    }
  });
});

describe('Stage gimmicks (shared by all characters)', () => {
  it('LP LIBRARY: breaking a golden Record Box opens the hidden shelf route', () => {
    const gm = game('lpLibrary', { a: 'rex' });
    expect(gm.grid.get(6, 2).gimmick.kind).toBe('secretShelf');
    expect(gm.grid.isSolid(6, 2)).toBe(true);
    const rex = gm.players.get(0);
    placeAt(gm, rex, 5, 3);
    press(gm, 0, 'bomb');
    placeAt(gm, rex, 3, 1);
    run(gm, 3, {});
    expect(gm.grid.get(5, 2).type).toBe(CELL.EMPTY);
    expect(gm.grid.isSolid(6, 2)).toBe(false);
    expect(gm.events.some((e) => e.type === 'routeOpened')).toBe(true);
  });

  it('LP LIBRARY: Rolling LP smashes boxes and pushes players out of the row', () => {
    const gm = game('lpLibrary', { houseEvents: false });
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    const lp = gm.stage.get('rollingLp');
    lp.cfg = { ...lp.cfg, lanes: [3] };
    lp.nextAt = 0;
    const boxesBefore = [1, 4, 8, 11].filter((x) => gm.grid.get(x, 3).type === CELL.BREAKABLE).length;
    run(gm, 4.5, {});
    expect(p.cellY).not.toBe(3);
    const boxesAfter = [1, 4, 8, 11].filter((x) => gm.grid.get(x, 3).type === CELL.BREAKABLE).length;
    expect(boxesAfter).toBeLessThan(boxesBefore);
  });

  it('STUDIO: a Sound Wave touching a G machine flips wall ↔ path; REC fires Sound Pulses', () => {
    const gm = game('studio', { a: 'vin' });
    expect(gm.grid.isSolid(6, 1)).toBe(true); // 올라와 있는 장비
    expect(gm.grid.isSolid(3, 5)).toBe(false); // 내려가 있는 장비
    const p = gm.players.get(0);
    placeAt(gm, p, 5, 1);
    press(gm, 0, 'bomb');
    placeAt(gm, p, 1, 3);
    run(gm, 3, {});
    expect(gm.events.some((e) => e.type === 'gatesToggled')).toBe(true);
    expect(gm.grid.isSolid(6, 1)).toBe(false);
    expect(gm.grid.isSolid(3, 5)).toBe(true);

    const rec = gm.stage.get('recPulse');
    rec.nextAt = 0;
    let pulses = 0;
    run(gm, rec.cfg.warnTime + 0.3, (g) => {
      pulses += g.events.filter((e) => e.type === 'pulse').length;
      g.events.length = 0;
      return {};
    });
    expect(pulses).toBeGreaterThan(0);
  });

  it('DJ BOOTH: 6 turntables; the ring (walls included) rotates and changes the path', () => {
    const gm = game('djBooth', { houseEvents: false });
    const tt = gm.stage.get('turntables');
    expect(tt.decks.length).toBe(6);
    const deck = tt.decks.find((d) => d.x === 3 && d.y === 5);
    // ring: (2,4)# (3,4)# (4,4)# (4,5). (4,6)# (3,6)# (2,6)# (2,5).
    expect(gm.grid.isSolid(4, 5)).toBe(false);
    gm.items.spawn('bombUp', 2, 5);
    tt.rotate(deck);
    expect(gm.grid.isSolid(4, 5)).toBe(true);
    expect(gm.grid.isSolid(4, 6)).toBe(false);
    expect(gm.grid.isSolid(2, 4)).toBe(false);
    expect(gm.items.items[0]).toMatchObject({ x: 2, y: 4 });

    const sd = gm.stage.get('speakerDrop');
    sd.nextAt = 0;
    run(gm, sd.cfg.warnTime + 0.1, {});
    expect(gm.bombs.fuseRate).toBeGreaterThan(1);
  });

  it('TERRACE: wind is telegraphed, then pushes players one cell', () => {
    const gm = game('terrace', { houseEvents: false });
    const wind = gm.stage.get('wind');
    wind.nextAt = 0;
    gm.step(DT, {});
    expect(wind.phase).toBe('warn');
    expect(gm.getTelegraphs().some((t) => t.kind === 'wind')).toBe(true);
    const p = gm.players.get(0);
    placeAt(gm, p, 6, 3);
    run(gm, wind.cfg.warnTime + 0.4, {});
    expect(Math.abs(p.cellX - 6) + Math.abs(p.cellY - 3)).toBe(1);
  });
});
