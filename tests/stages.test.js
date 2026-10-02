import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_ORDER, CELL } from '../src/config/stageConfig.js';
import { GridManager } from '../src/core/GridManager.js';
import { Rng } from '../src/core/rng.js';
import { run, placeAt, press, DT } from './helpers.js';
import { GameManager } from '../src/core/GameManager.js';

// BOOM ROOM v4 — 큰 아레나 크기
const V4_SIZES = {
  lounge: [17, 15],
  lpLibrary: [17, 15],
  studio: [17, 15],
  djBooth: [17, 15],
  terrace: [19, 15],
  lockedRoom: [19, 17],
};

// 테두리 제외 안쪽 칸 비율 (G 는 고정 장치로 SOLID 쪽에 센다)
function ratios(map) {
  let solid = 0;
  let brk = 0;
  let open = 0;
  for (let y = 1; y < map.length - 1; y++) {
    for (let x = 1; x < map[0].length - 1; x++) {
      const ch = map[y][x];
      if (ch === '#' || ch === 'G') solid++;
      else if (ch === 'B') brk++;
      else open++;
    }
  }
  const n = solid + brk + open;
  return { solid: solid / n, breakable: brk / n, open: open / n, breakables: brk };
}

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

describe('Stages (6 arenas, BOOM ROOM v4 big grids)', () => {
  it('6 stages in the GDD order', () => {
    expect(STAGE_ORDER).toEqual(['lounge', 'lpLibrary', 'studio', 'djBooth', 'terrace', 'lockedRoom']);
  });

  for (const id of Object.keys(STAGES)) {
    it(`${id}: v4 size, SOLID/BREAKABLE/open ratios, 4 corner spawns with 2-cell clearance, connected`, () => {
      const [W, H] = V4_SIZES[id];
      const map = STAGES[id].map;
      expect(map.length).toBe(H);
      expect(map.every((r) => r.length === W)).toBe(true);
      // 좌우·상하 대칭 (공정한 4인 시작)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) expect(map[y][x], `${id} ${x},${y}`).toBe(map[H - 1 - y][W - 1 - x]);

      const r = ratios(map);
      expect(r.solid).toBeGreaterThanOrEqual(0.2);
      expect(r.solid).toBeLessThanOrEqual(0.255);
      expect(r.breakable).toBeGreaterThanOrEqual(0.25);
      expect(r.breakable).toBeLessThanOrEqual(0.305);
      expect(r.open).toBeGreaterThanOrEqual(0.45);
      expect(r.open).toBeLessThanOrEqual(0.505);
      expect(r.breakables).toBeGreaterThanOrEqual(50);
      expect(r.breakables).toBeLessThanOrEqual(70);

      const grid = GridManager.fromStage(STAGES[id], new Rng(7));
      expect(grid.width).toBe(W);
      expect(grid.height).toBe(H);
      expect(grid.spawns).toEqual([
        { x: 1, y: 1 },
        { x: W - 2, y: 1 },
        { x: 1, y: H - 2 },
        { x: W - 2, y: H - 2 },
      ]);
      expect(connectedIgnoringBreakables(grid)).toBe(true);
      // 시작 위치 주변 2칸은 비어 있다 (가로 2칸 + 세로 2칸)
      for (const s of grid.spawns) {
        const sx = s.x === 1 ? 1 : -1;
        const sy = s.y === 1 ? 1 : -1;
        for (const [x, y] of [
          [s.x, s.y],
          [s.x + sx, s.y],
          [s.x + 2 * sx, s.y],
          [s.x, s.y + sy],
          [s.x, s.y + 2 * sy],
        ]) {
          expect(grid.isWalkable(x, y), `${id} spawn clear ${x},${y}`).toBe(true);
        }
      }
      // 논리 판정: # = SOLID, B = BREAKABLE (오버라이드 셀 제외)
      const overrides = new Set((STAGES[id].overrides || []).map((o) => `${o.at[0]},${o.at[1]}`));
      map.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (overrides.has(`${x},${y}`)) return;
          const c = grid.get(x, y);
          if (ch === '#') expect(c.type, `${id} ${x},${y}`).toBe(CELL.SOLID);
          if (ch === 'B') expect(c.type, `${id} ${x},${y}`).toBe(CELL.BREAKABLE);
          if (ch === '.' || ch === 'S') expect(c.type, `${id} ${x},${y}`).toBe(CELL.EMPTY);
        }),
      );
    });

    it(`${id}: interior SOLID cells are real furniture, never plain wall blocks`, () => {
      const grid = GridManager.fromStage(STAGES[id], new Rng(7));
      for (const c of grid.cells) {
        if (c.border || c.type !== CELL.SOLID) continue;
        expect(['wall', 'wallBlock', 'cabinetDefault'], `${id} ${c.x},${c.y} ${c.prop}`).not.toContain(c.prop);
        expect(c.prop).toBeTruthy();
      }
    });
  }

  it('expected item count per match is about 30~40 (BREAKABLE × drop chance)', () => {
    for (const id of Object.keys(STAGES)) {
      const gm = game(id);
      const n = gm.grid.cells.filter((c) => c.type === CELL.BREAKABLE).length;
      const expected = n * gm.items.dropTable.dropChance;
      expect(expected, id).toBeGreaterThanOrEqual(30);
      expect(expected, id).toBeLessThanOrEqual(40);
    }
  });

  it('fixed layout; seed only changes breakable prop visuals', () => {
    const a = GridManager.fromStage(STAGES.lounge, new Rng(123));
    const b = GridManager.fromStage(STAGES.lounge, new Rng(123));
    const c = GridManager.fromStage(STAGES.lounge, new Rng(999));
    expect(a.toAscii()).toBe(b.toAscii());
    expect(a.toAscii()).toBe(c.toAscii());
    expect(a.cells.map((x) => x.prop).join()).toBe(b.cells.map((x) => x.prop).join());
  });

  it('Lounge: 6 sofas (### runs) surround the center floor lamp and are movable', () => {
    const grid = GridManager.fromStage(STAGES.lounge, new Rng(1));
    const sofas = [...grid.groups.values()].filter((g) => g.prop === 'sofa');
    expect(sofas.length).toBe(6);
    expect(sofas.every((g) => g.movable && g.cells.length === 3)).toBe(true);
    expect(grid.get(8, 7).prop).toBe('lamp');
    expect(grid.get(8, 7).type).toBe(CELL.SOLID);
    // 대칭 위치에는 같은 가구
    expect(grid.get(2, 2).prop).toBe(grid.get(14, 12).prop);
    expect(grid.get(4, 6).prop).toBe(grid.get(12, 8).prop);
  });

  it('Locked Room: GGG is one Old Audio Machine, wall-attached pieces are not movable', () => {
    const grid = GridManager.fromStage(STAGES.lockedRoom, new Rng(1));
    const audio = [...grid.groups.values()].filter((g) => g.prop === 'oldAudio');
    expect(audio.length).toBe(1);
    expect(audio[0].cells.length).toBe(3);
    const movable = [...grid.groups.values()].filter((g) => g.movable);
    expect(movable.length).toBeGreaterThanOrEqual(8);
    expect(grid.get(5, 1).movable).toBe(false);
    expect(grid.get(5, 1).prop).toBe('wardrobe');
  });

  it('Terrace: planters / patio sets are 2×2 blocks so long lanes stay open', () => {
    const grid = GridManager.fromStage(STAGES.terrace, new Rng(1));
    const blocks = [...grid.groups.values()].filter((g) => g.prop === 'planterBed' || g.prop === 'patioSet');
    expect(blocks.length).toBe(12);
    expect(blocks.every((g) => g.cells.length === 4)).toBe(true);
    for (const y of [1, 4, 7, 10, 13]) {
      expect(STAGES.terrace.map[y].slice(1, -1)).not.toContain('#');
    }
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
    expect(gm.grid.get(8, 2).gimmick.kind).toBe('secretShelf');
    expect(gm.grid.isSolid(8, 2)).toBe(true);
    const rex = gm.players.get(0);
    placeAt(gm, rex, 7, 3);
    press(gm, 0, 'bomb');
    placeAt(gm, rex, 3, 1);
    run(gm, 3, {});
    expect(gm.grid.get(7, 2).type).toBe(CELL.EMPTY);
    expect(gm.grid.isSolid(8, 2)).toBe(false);
    expect(gm.events.some((e) => e.type === 'routeOpened')).toBe(true);
  });

  it('LP LIBRARY: Rolling LP smashes boxes and pushes players out of the row', () => {
    const gm = game('lpLibrary', { houseEvents: false });
    const p = gm.players.get(0);
    placeAt(gm, p, 1, 3);
    const lp = gm.stage.get('rollingLp');
    lp.cfg = { ...lp.cfg, lanes: [3] };
    lp.nextAt = 0;
    const boxesBefore = [4, 6, 10, 12].filter((x) => gm.grid.get(x, 3).type === CELL.BREAKABLE).length;
    run(gm, 4.5, {});
    expect(p.cellY).not.toBe(3);
    const boxesAfter = [4, 6, 10, 12].filter((x) => gm.grid.get(x, 3).type === CELL.BREAKABLE).length;
    expect(boxesAfter).toBeLessThan(boxesBefore);
  });

  it('STUDIO: a Sound Wave touching a G machine flips wall ↔ path; REC fires Sound Pulses', () => {
    const gm = game('studio', { a: 'vin' });
    expect(gm.grid.isSolid(8, 1)).toBe(true); // 올라와 있는 장비
    expect(gm.grid.isSolid(4, 7)).toBe(false); // 내려가 있는 장비
    const p = gm.players.get(0);
    placeAt(gm, p, 7, 1);
    press(gm, 0, 'bomb');
    placeAt(gm, p, 1, 3);
    run(gm, 3, {});
    expect(gm.events.some((e) => e.type === 'gatesToggled')).toBe(true);
    expect(gm.grid.isSolid(8, 1)).toBe(false);
    expect(gm.grid.isSolid(4, 7)).toBe(true);

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

  it('DJ BOOTH: 5 turntables; the ring (furniture included) rotates and changes the path', () => {
    const gm = game('djBooth', { houseEvents: false });
    const tt = gm.stage.get('turntables');
    expect(tt.decks.length).toBe(5);
    const deck = tt.decks.find((d) => d.x === 4 && d.y === 4);
    // ring: (3,3)# (4,3)B (5,3). (5,4). (5,5)# (4,5)B (3,5). (3,4)B
    expect(gm.grid.get(5, 5).type).toBe(CELL.SOLID);
    expect(gm.grid.get(3, 4).type).toBe(CELL.BREAKABLE);
    gm.items.spawn('bombUp', 5, 3);
    tt.rotate(deck);
    expect(gm.grid.get(4, 3).type).toBe(CELL.SOLID);
    expect(gm.grid.get(5, 5).type).toBe(CELL.EMPTY);
    expect(gm.grid.get(4, 5).type).toBe(CELL.SOLID);
    expect(gm.grid.get(3, 4).type).toBe(CELL.EMPTY);
    expect(gm.grid.get(3, 3).type).toBe(CELL.BREAKABLE);
    expect(gm.items.items[0]).toMatchObject({ x: 5, y: 4 });

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
    // 네 방향이 모두 열린 칸을 만든다 (어느 방향 바람이든 한 칸 밀린다)
    const open = { x: 9, y: 5 };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) gm.grid.destroyBreakable(open.x + dx, open.y + dy);
    placeAt(gm, p, open.x, open.y);
    run(gm, wind.cfg.warnTime + 0.4, {});
    expect(Math.abs(p.cellX - open.x) + Math.abs(p.cellY - open.y)).toBe(1);
  });
});

describe('Match tempo (v4: 4~6 min, early farming → mid fights → late chaos)', () => {
  it('battle lasts up to 5 minutes and the tempo moves early → mid → late', () => {
    const gm = game('lounge', { houseEvents: false });
    expect(gm.timeLimit).toBeGreaterThanOrEqual(240);
    expect(gm.timeLimit).toBeLessThanOrEqual(360);
    expect(gm.tempo).toBe('early');
    gm.matchTime = 120;
    expect(gm.tempo).toBe('mid');
    expect(gm.tempoInterval(30)).toBe(30);
    gm.matchTime = 250;
    expect(gm.tempo).toBe('late');
    expect(gm.tempoInterval(30)).toBeLessThan(30);
  });
});
