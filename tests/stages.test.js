import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_ORDER, CELL } from '../src/config/stageConfig.js';
import { GridManager } from '../src/core/GridManager.js';
import { Rng } from '../src/core/rng.js';
import { run, placeAt, press, DT } from './helpers.js';
import { GameManager } from '../src/core/GameManager.js';
import { BotBrain } from '../src/core/ai/BotBrain.js';
import { GAME_CONFIG } from '../src/config/gameConfig.js';

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

  it('start state: extra stage boxes (about 40% of cells), boxes 2~4 cells from every spawn, ~40 items per match', () => {
    const fourBots = ['vin', 'picker', 'rex', 'buddy'].map((c, i) => ({ slot: i, characterId: c, bot: true }));
    for (const id of Object.keys(STAGES)) {
      const base = ratios(STAGES[id].map).breakables;
      for (const seed of [1, 2, 3]) {
        const gm = new GameManager({ mode: 'battle', stageId: id, players: fourBots, seed, skipCountdown: true, spawn: 'random', startFill: true });
        const g = gm.grid;
        const inner = (g.width - 2) * (g.height - 2);
        const boxes = g.cells.filter((c) => c.type === CELL.BREAKABLE);
        expect(boxes.length, id).toBeGreaterThan(base + 15);
        expect(boxes.length / inner, id).toBeGreaterThanOrEqual(0.35);
        // 판정은 공통 BREAKABLE, 비주얼은 스테이지 소품
        for (const c of boxes) expect(STAGES[id].breakables, `${id} ${c.prop}`).toContain(c.prop);
        const expected = boxes.length * gm.items.dropTable.dropChance;
        expect(expected, id).toBeGreaterThanOrEqual(36);
        expect(expected, id).toBeLessThanOrEqual(48);
        for (const sp of g.spawns) {
          const near = g.cells.filter((c) => {
            const d = Math.abs(c.x - sp.x) + Math.abs(c.y - sp.y);
            return d >= 2 && d <= 4 && c.type === CELL.BREAKABLE;
          }).length;
          expect(near, `${id} seed ${seed} boxes near ${sp.x},${sp.y}`).toBeGreaterThanOrEqual(5);
          expect(g.isWalkable(sp.x, sp.y)).toBe(true);
          for (const c of sp.clear) expect(g.isWalkable(c.x, c.y), `${id} escape room ${c.x},${c.y}`).toBe(true);
        }
      }
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

describe('Mr. ODD House Event (Locked Room only)', () => {
  it('MR. ODD only appears in LOCKED ROOM; it is a map event, never a playable character', () => {
    for (const id of Object.keys(STAGES)) expect(!!STAGES[id].houseEvents, id).toBe(id === 'lockedRoom');
    const gm = game('lockedRoom', { seed: 5 });
    expect(gm.players.list.some((p) => p.characterId === 'mrOdd')).toBe(false);
  });

  it('House event is scheduled automatically at firstAt, with a warning first', () => {
    const gm = game('lockedRoom', { seed: 5 });
    run(gm, gm.stageDef.houseEvents.firstAt + 0.1, {});
    expect(gm.house.phase).toBe('warn');
    expect(gm.events.some((e) => e.type === 'houseEvent' && e.phase === 'warn')).toBe(true);
  });

  it('Locked Room changes the layout only a few times per match (limited)', () => {
    const h = STAGES.lockedRoom.houseEvents;
    expect(h.pushCount).toBe(1);
    const events = 1 + Math.floor((300 - h.firstAt) / h.interval);
    expect(events).toBeLessThanOrEqual(4);
  });

  it('Locked Room: a furniture move changes . ↔ # (after a warning)', () => {
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

  it('only the allowed gimmicks remain: Studio REC pulse, DJ beat drop + speaker drop, Terrace wind', () => {
    const kinds = (id) => STAGES[id].gimmicks.map((g) => g.kind).sort();
    expect(kinds('lounge')).toEqual([]);
    expect(kinds('lpLibrary')).toEqual([]);
    expect(kinds('studio')).toEqual(['gates', 'recPulse']);
    expect(STAGES.studio.gimmicks.find((g) => g.kind === 'gates').toggle).toBe(false);
    expect(kinds('djBooth')).toEqual(['beatDrop', 'speakerDrop']);
    expect(kinds('terrace')).toEqual(['wind']);
    expect(kinds('lockedRoom')).toEqual([]);
  });
});

describe('Stable arenas (the map does not keep moving)', () => {
  const fourBots = ['vin', 'picker', 'rex', 'buddy'].map((c, i) => ({ slot: i, characterId: c, bot: true }));
  const solids = (g) =>
    g.cells
      .filter((c) => c.type === CELL.SOLID || (c.type === CELL.GIMMICK && c.gimmick?.solid))
      .map((c) => `${c.x},${c.y}`)
      .join(';');

  for (const id of ['lounge', 'lpLibrary', 'studio', 'djBooth', 'terrace']) {
    it(`${id}: furniture / walls never move during a 2-minute CPU match`, () => {
      const gm = new GameManager({ mode: 'battle', stageId: id, players: fourBots, seed: 4, skipCountdown: true, spawn: 'random', startFill: true, timeLimit: 120 });
      const bots = gm.players.list.map((p) => new BotBrain(p.id, { seed: gm.seed }));
      const before = solids(gm.grid);
      let moved = 0;
      for (let i = 0; i < 120 * 60 && !gm.result; i++) {
        const it = {};
        for (const b of bots) it[b.playerId] = b.update(gm, DT);
        gm.step(DT, it);
        for (const e of gm.drainEvents()) if (['groupMoved', 'gatesToggled', 'turntableRotated', 'routeOpened'].includes(e.type)) moved++;
      }
      expect(moved).toBe(0);
      expect(solids(gm.grid)).toBe(before);
    });
  }

  it('STUDIO: a Sound Wave on an amp only lights it up — no wall ↔ path switch; REC still pulses', () => {
    const gm = game('studio', { a: 'vin' });
    expect(gm.grid.isSolid(8, 1)).toBe(true);
    expect(gm.grid.isSolid(4, 7)).toBe(false);
    const p = gm.players.get(0);
    placeAt(gm, p, 7, 1);
    press(gm, 0, 'bomb');
    placeAt(gm, p, 1, 3);
    run(gm, 3, {});
    expect(gm.events.some((e) => e.type === 'ampReact')).toBe(true);
    expect(gm.events.some((e) => e.type === 'gatesToggled')).toBe(false);
    expect(gm.grid.isSolid(8, 1)).toBe(true);
    expect(gm.grid.isSolid(4, 7)).toBe(false);

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

  it('DJ BOOTH: no terrain rotation — every 16s BEAT DROP! warning, then a Sound Pulse on the center 3×3', () => {
    const gm = game('djBooth', { houseEvents: false });
    expect(gm.stage.get('turntables')).toBeNull();
    const bd = gm.stage.get('beatDrop');
    expect(bd.cfg.interval).toBe(16);
    const snapshot = () => gm.grid.cells.map((c) => (c.type === CELL.SOLID ? '#' : '.')).join('');
    const before = snapshot();
    // 플레이어 하나를 중앙 3×3 안의 빈 칸에 세운다
    const zone = bd._zone().filter((c) => gm.grid.isWalkable(c.x, c.y));
    for (const c of bd._zone()) if (gm.grid.get(c.x, c.y).type === CELL.BREAKABLE) gm.grid.destroyBreakable(c.x, c.y);
    const p = gm.players.get(0);
    const spot = zone[0] || bd._zone()[0];
    placeAt(gm, p, spot.x, spot.y);
    const q = gm.players.get(1);
    placeAt(gm, q, 1, 1);
    let warned = false;
    let dropped = false;
    run(gm, bd.cfg.firstAt + bd.cfg.warnTime + 0.2, (g) => {
      if (g.events.some((e) => e.type === 'beatDropWarn')) warned = true;
      if (g.events.some((e) => e.type === 'beatDrop')) dropped = true;
      g.events.length = 0;
      return {};
    });
    expect(warned).toBe(true);
    expect(dropped).toBe(true);
    expect(p.isTrapped).toBe(true); // 중앙에 서 있던 플레이어는 맞는다
    expect(q.isTrapped).toBe(false);
    expect(p.cellX).toBe(spot.x); // 플레이어도 실려 가지 않는다
    expect(snapshot()).toBe(before); // 가구(SOLID) 위치 그대로

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

describe('Random start positions (every match starts somewhere different)', () => {
  const fourBots = ['vin', 'picker', 'rex', 'buddy'].map((c, i) => ({ slot: i, characterId: c, bot: true }));
  const open = (grid, x, y) => {
    const c = grid.get(x, y);
    return !!c && !c.border && !c.gimmick && c.type === CELL.EMPTY;
  };

  for (const id of Object.keys(STAGES)) {
    it(`${id}: random spawns are safe (L-shaped 2-cell room), spread out and seed-dependent`, () => {
      const seen = new Set();
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const gm = new GameManager({ mode: 'battle', stageId: id, players: fourBots, seed, skipCountdown: true, spawn: 'random' });
        const pos = gm.players.list.map((p) => ({ x: p.cellX, y: p.cellY }));
        seen.add(JSON.stringify(pos));
        expect(new Set(pos.map((p) => `${p.x},${p.y}`)).size).toBe(4);
        for (const p of pos) {
          expect(open(gm.grid, p.x, p.y), `${id} seed ${seed} spawn ${p.x},${p.y}`).toBe(true);
          // 수직인 두 방향으로 2칸씩 비어 있는 L 이 하나 이상
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          const clear = (dx, dy) => open(gm.grid, p.x + dx, p.y + dy) && open(gm.grid, p.x + 2 * dx, p.y + 2 * dy);
          const hasL = dirs.some(([ax, ay]) => clear(ax, ay) && dirs.some(([bx, by]) => ax * bx + ay * by === 0 && clear(bx, by)));
          expect(hasL, `${id} seed ${seed} L-room at ${p.x},${p.y}`).toBe(true);
          // 턴테이블 링 위가 아니다
          for (const c of gm.grid.cells) if (c.turntable) expect(Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y))).toBeGreaterThan(1);
        }
        let minD = Infinity;
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minD = Math.min(minD, Math.abs(pos[i].x - pos[j].x) + Math.abs(pos[i].y - pos[j].y));
        expect(minD, `${id} seed ${seed}`).toBeGreaterThanOrEqual(7);
      }
      expect(seen.size).toBeGreaterThan(3);
      // 같은 시드는 같은 배치 (결정론적 시뮬레이션)
      const a = new GameManager({ mode: 'battle', stageId: id, players: fourBots, seed: 9, skipCountdown: true, spawn: 'random' });
      const b = new GameManager({ mode: 'battle', stageId: id, players: fourBots, seed: 9, skipCountdown: true, spawn: 'random' });
      expect(a.players.list.map((p) => [p.x, p.y])).toEqual(b.players.list.map((p) => [p.x, p.y]));
    });
  }

  it('fixed spawns stay the default (tests / replays)', () => {
    const gm = new GameManager({ mode: 'battle', stageId: 'lounge', players: fourBots, seed: 1, skipCountdown: true });
    expect(gm.players.list.map((p) => [p.x, p.y]).sort()).toEqual([[1, 1], [1, 13], [15, 1], [15, 13]].sort());
  });
});

describe('Match start player position indicator', () => {
  it('arrows show during the countdown and ~2.5s after GO, in P1 red / P2 blue / P3 yellow / P4 white', () => {
    const a = GAME_CONFIG.startArrow;
    expect(a.visibleAfterStart).toBeGreaterThanOrEqual(2);
    expect(a.visibleAfterStart).toBeLessThanOrEqual(3);
    expect(a.fadeTime).toBeLessThan(a.visibleAfterStart);
    const [p1, p2, p3, p4] = GAME_CONFIG.playerColors.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    expect(p1[0]).toBeGreaterThan(200); // red
    expect(p1[1]).toBeLessThan(120);
    expect(p2[2]).toBeGreaterThan(200); // blue
    expect(p2[0]).toBeLessThan(120);
    expect(p3[0] + p3[1]).toBeGreaterThan(400); // yellow
    expect(p3[2]).toBeLessThan(120);
    expect(Math.min(...p4)).toBeGreaterThan(220); // white
  });
});
