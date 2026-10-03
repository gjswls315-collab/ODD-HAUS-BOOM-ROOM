import { describe, it, expect } from 'vitest';
import { BotBrain, BOT_STATE, BOT_CONFIG } from '../src/core/ai/BotBrain.js';
import { GameManager } from '../src/core/GameManager.js';
import { makeGame, placeAt, OPEN_MAP, DT } from './helpers.js';

// BOOM ROOM v4 CPU — State Machine + A* + Stuck Recovery
describe('CPU (v4): state machine, needs-based items, safe bombs, stuck recovery', () => {
  it('uses the v4 state names', () => {
    expect(Object.keys(BOT_STATE)).toEqual(expect.arrayContaining(['SCAN', 'ITEM_SEEK', 'ATTACK', 'ESCAPE', 'POSITIONING']));
    expect(BOT_CONFIG.stuckTime).toBeLessThanOrEqual(1.0);
  });

  it('needs-based item priority: SPEED 2/5 · BOMB 3/3 · WAVE 1/4 → WAVE UP > SPEED UP > special > (ignore BOMB UP)', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    p.stats.current = { speed: 2, bomb: 3, wave: 1 };
    p.stats.max = { speed: 5, bomb: 3, wave: 4 };
    const brain = new BotBrain(0);
    const wave = brain.itemValue(p, 'waveUp', gm);
    const speed = brain.itemValue(p, 'speedUp', gm);
    const special = Math.max(brain.itemValue(p, 'shield', gm), brain.itemValue(p, 'kick', gm));
    const bomb = brain.itemValue(p, 'bombUp', gm);
    expect(wave).toBeGreaterThan(speed);
    expect(speed).toBeGreaterThan(special);
    expect(special).toBeGreaterThan(0);
    expect(bomb).toBe(0);
    // 이미 가진 능력은 다시 노리지 않는다
    p.abilities.kick = true;
    expect(brain.itemValue(p, 'kick', gm)).toBe(0);
  });

  it('places a Beat Bomb only when a safe cell is reachable before it explodes', () => {
    const gm = makeGame({
      map: [
        '#########',
        '#1#.....#',
        '#.#.....#',
        '#.#..2..#',
        '#########',
      ],
    });
    const p = gm.players.get(0);
    const brain = new BotBrain(0);
    // 막다른 세로 통로 (1,1)~(1,3): 어디로도 피할 수 없다 → 설치 금지
    expect(brain._safeBombPlan(gm, p, 1, 1)).toBeNull();
    // 열린 방: 피할 칸이 있다 → 설치 가능 + 탈출 경로
    placeAt(gm, p, 4, 2);
    const plan = brain._safeBombPlan(gm, p, 4, 2);
    expect(plan).not.toBeNull();
    const end = plan.path[plan.path.length - 1];
    expect(plan.d2[end.y * gm.grid.width + end.x]).toBe(Infinity);
  });

  it('never bombs itself into a dead end during play', () => {
    const gm = makeGame({
      map: [
        '#########',
        '#1#.....#',
        '#.#.....#',
        '#.#..2..#',
        '#########',
      ],
    });
    const brain = new BotBrain(0, { seed: 3 });
    let bombs = 0;
    for (let i = 0; i < 6 * 60; i++) {
      const it = { 0: brain.update(gm, DT) };
      gm.step(DT, it);
      for (const e of gm.drainEvents()) if (e.type === 'bombPlaced' && e.playerId === 0) bombs++;
    }
    expect(bombs).toBe(0);
    expect(gm.players.get(0).isTrapped).toBe(false);
  });

  it('escapes danger first (ESCAPE) and reaches a safe cell', () => {
    const gm = makeGame({ map: OPEN_MAP });
    const p = gm.players.get(0);
    placeAt(gm, p, 4, 3);
    const enemy = gm.players.get(1);
    placeAt(gm, enemy, 4, 3);
    gm.bombs.tryPlace(enemy);
    placeAt(gm, enemy, 11, 1);
    const brain = new BotBrain(0, { seed: 1 });
    gm.step(DT, { 0: brain.update(gm, DT) });
    expect(brain.state).toBe(BOT_STATE.ESCAPE);
    let exploded = false;
    for (let i = 0; i < 3.2 * 60; i++) {
      gm.step(DT, { 0: brain.update(gm, DT) });
      for (const e of gm.drainEvents()) if (e.type === 'explosion' && e.ownerId === 1) exploded = true;
    }
    expect(exploded).toBe(true);
    expect(p.isTrapped).toBe(false);
    expect(p.isEliminated).toBe(false);
  });

  it('STUCK CHECK: same cell for 1.2s → path discarded, moves to a new reachable cell', () => {
    const gm = makeGame({ map: OPEN_MAP });
    const p = gm.players.get(0);
    placeAt(gm, p, 5, 3);
    const brain = new BotBrain(0, { seed: 2 });
    brain.target = { x: 5, y: 3, kind: 'position', score: 1 };
    for (let t = 0; t < BOT_CONFIG.stuckTime + 0.05; t += DT) brain._trackStuck(gm, p, DT);
    expect(brain.stuckRecoveries).toBe(1);
    expect(brain.path).not.toBeNull();
    const end = brain.path[brain.path.length - 1];
    expect(end.x !== 5 || end.y !== 3).toBe(true);
    expect(gm.grid.isWalkable(end.x, end.y)).toBe(true);
    expect(brain.state).toBe(BOT_STATE.POSITIONING);
  });

  it('CPU is never idle: 4 bots on a v4 arena keep moving (no cell held > 6s while free)', () => {
    const players = ['vin', 'picker', 'rex', 'buddy'].map((c, i) => ({ slot: i, characterId: c, bot: true }));
    const gm = new GameManager({ mode: 'battle', stageId: 'lounge', players, seed: 21, skipCountdown: true, timeLimit: 120, spawn: 'random', startFill: true });
    const bots = gm.players.list.map((p) => new BotBrain(p.id, { seed: gm.seed }));
    const still = new Map();
    let worst = 0;
    let picked = 0;
    for (let i = 0; i < 120 * 60 && !gm.result; i++) {
      const it = {};
      for (const b of bots) it[b.playerId] = b.update(gm, DT);
      gm.step(DT, it);
      for (const e of gm.drainEvents()) if (e.type === 'itemPicked') picked++;
      for (const p of gm.players.list) {
        if (!p.isActive) {
          still.delete(p.id);
          continue;
        }
        const k = `${p.cellX},${p.cellY}`;
        const s = still.get(p.id);
        if (s && s.k === k) {
          s.t += DT;
          worst = Math.max(worst, s.t);
        } else still.set(p.id, { k, t: 0 });
      }
    }
    expect(worst).toBeLessThan(6);
    // 초반 파밍: 아이템을 실제로 모은다
    expect(picked).toBeGreaterThan(6);
  });
});
