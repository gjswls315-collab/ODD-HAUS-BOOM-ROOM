import { describe, it, expect } from 'vitest';
import { BotBrain, BOT_STATE, BOT_CONFIG, BOT_POSE, computeDanger } from '../src/core/ai/BotBrain.js';
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

  it('CPU never looks frozen: NORMAL stop < 1.5s, waiting next to danger ≤ ~2.5s (4 CPUs, Lounge, 3 min)', () => {
    const players = ['vin', 'picker', 'rex', 'buddy'].map((c, i) => ({ slot: i, characterId: c, bot: true }));
    const gm = new GameManager({ mode: 'battle', stageId: 'lounge', players, seed: 21, skipCountdown: true, timeLimit: 180, spawn: 'random', startFill: true });
    const bots = gm.players.list.map((p) => new BotBrain(p.id, { seed: gm.seed }));
    const W = gm.grid.width;
    const still = new Map();
    let worstNormal = 0;
    let worstWait = 0;
    let picked = 0;
    let poses = 0;
    for (let i = 0; i < 180 * 60 && !gm.result; i++) {
      const it = {};
      for (const b of bots) it[b.playerId] = b.update(gm, DT);
      gm.step(DT, it);
      for (const e of gm.drainEvents()) if (e.type === 'itemPicked') picked++;
      for (const b of bots) {
        const p = gm.players.get(b.playerId);
        if (!p.isActive) {
          still.delete(p.id);
          continue;
        }
        if (it[b.playerId].pose) poses++;
        const k = p.cellY * W + p.cellX;
        const st = still.get(p.id);
        if (st && st.k === k) {
          st.t += DT;
          if (st.kind === undefined && st.t > 0.3) {
            // 주변 2칸 안에 위험(곧 터질 칸 / Wave)이 있으면 "대기", 아니면 NORMAL
            const d = computeDanger(gm, null, p);
            let near = false;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (gm.grid.inBounds(p.cellX + dx, p.cellY + dy) && d[(p.cellY + dy) * W + p.cellX + dx] !== Infinity) near = true;
            st.kind = near ? 'wait' : 'normal';
          }
          if (st.kind === 'normal') worstNormal = Math.max(worstNormal, st.t);
          if (st.kind === 'wait') worstWait = Math.max(worstWait, st.t);
        } else still.set(p.id, { k, t: 0 });
      }
    }
    expect(worstNormal).toBeLessThan(1.5);
    // 퓨즈 2.6초 + Wave 0.5초 — 한 칸짜리 구석에서 기다릴 때도 3초를 넘기지 않는다
    expect(worstWait).toBeLessThanOrEqual(3.1);
    // 초반 파밍: 아이템을 실제로 모은다
    expect(picked).toBeGreaterThan(6);
    // 기다리는 동안에는 대기 포즈 힌트를 보낸다 (렌더 전용)
    expect(poses).toBeGreaterThan(0);
  });

  it('wander fallback: safe neighbour → crossing late-exploding cells → WAIT with re-path every 0.25s', () => {
    // 한 칸짜리 막다른 구석: 사방이 막혀 있으면 WAIT + 포즈
    const gm = makeGame({
      map: [
        '#######',
        '#1#...#',
        '###...#',
        '#....2#',
        '#######',
      ],
    });
    const p = gm.players.get(0);
    const brain = new BotBrain(0, { seed: 4 });
    const danger = computeDanger(gm, null, p);
    const field = brain._search(gm, p, danger, { strict: true });
    expect(brain._wander(gm, p, danger, field)).toBe(false);
    expect(brain.state).toBe(BOT_STATE.WAIT);
    expect(brain.thinkTimer).toBeLessThanOrEqual(BOT_CONFIG.waitRethink);
    expect(brain._waitPose(gm, p, danger)).toBe(BOT_POSE.LOOK_AROUND);

    // 열린 방: 목표가 없어도 옆 칸 / 열린 칸으로 움직인다
    const g2 = makeGame({ map: OPEN_MAP });
    const q = g2.players.get(0);
    placeAt(g2, q, 5, 3);
    const b2 = new BotBrain(0, { seed: 5 });
    const d2 = computeDanger(g2, null, q);
    expect(b2._wander(g2, q, d2, b2._search(g2, q, d2, { strict: true }))).toBe(true);
    expect(b2.path.length).toBeGreaterThan(1);

    // 주머니 밖으로: 2.6초 뒤에 터질 칸을 폭발 전에(여유 0.8초) 지나 안전 칸으로 나간다
    const g3 = makeGame({ map: ['#########', '#1......#', '#########', '#......2#', '#########'] });
    const r = g3.players.get(0);
    const W3 = g3.grid.width;
    const d3 = new Float64Array(W3 * g3.grid.height).fill(Infinity);
    d3[1 * W3 + 2] = 2.6;
    d3[1 * W3 + 3] = 2.6;
    const b3 = new BotBrain(0, { seed: 6 });
    const f3 = b3._search(g3, r, d3, { strict: true });
    expect(b3._wander(g3, r, d3, f3)).toBe(true);
    expect(b3.target.via).toBe('cross');
    expect(b3.target.x).toBe(4);
    expect(b3._crossingSafe(r, b3.path, d3, W3)).toBe(true);
    // 곧(0.6초 뒤) 터질 칸은 지나가지 않는다 → WAIT
    d3[1 * W3 + 2] = 0.6;
    const b4 = new BotBrain(0, { seed: 6 });
    expect(b4._wander(g3, r, d3, b4._search(g3, r, d3, { strict: true }))).toBe(false);
    expect(b4.state).toBe(BOT_STATE.WAIT);
  });

  it('TEAM: capsule target = ally rescue first (urgency, time left, distance), enemy finish after', () => {
    const gm = makeGame({ chars: ['vin', 'picker', 'rex', 'buddy'], mode: 'team', teams: ['A', 'A', 'B', 'B'], map: OPEN_MAP });
    const me = gm.players.get(0);
    const ally = gm.players.get(1);
    const enemyA = gm.players.get(2);
    const enemyB = gm.players.get(3);
    placeAt(gm, me, 5, 3);
    placeAt(gm, enemyA, 6, 3); // 바로 옆 상대 캡슐
    placeAt(gm, ally, 9, 3); // 조금 먼 팀원 캡슐
    placeAt(gm, enemyB, 11, 6);
    gm.players.trapPlayer(enemyA, 3);
    gm.players.trapPlayer(ally, 2);
    const brain = new BotBrain(0, { seed: 7 });
    const danger = computeDanger(gm, null, me);
    const field = brain._search(gm, me, danger, { strict: true });
    expect(brain._capsuleTarget(gm, me, field).o).toBe(ally);
    // 팀원 캡슐이 제때 못 갈 만큼 거의 끝났으면 → 상대 마무리
    ally.trap.time = ally.trap.maxTime - 0.05;
    expect(brain._capsuleTarget(gm, me, field).o).toBe(enemyA);
    // 실제 경기: 구하러 간다
    ally.trap.time = 0;
    const b2 = new BotBrain(0, { seed: 8 });
    for (let i = 0; i < 90; i++) gm.step(DT, { 0: b2.update(gm, DT) });
    expect(ally.isTrapped).toBe(false);
  });

});
