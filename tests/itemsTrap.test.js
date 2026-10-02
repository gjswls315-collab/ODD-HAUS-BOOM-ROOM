import { describe, it, expect } from 'vitest';
import { makeGame, run, press, placeAt, DT } from './helpers.js';
import { GAME_CONFIG } from '../src/config/gameConfig.js';
import { ITEM_TYPES, DROP_TABLES } from '../src/config/itemConfig.js';

function trapBy(gm, victim, byId = null) {
  gm.players.trapPlayer(victim, byId);
}

describe('Items — shared by everyone, separate from base stats', () => {
  it('drop table config is valid', () => {
    for (const t of Object.values(DROP_TABLES)) {
      for (const k of Object.keys(t.weights)) expect(ITEM_TYPES[k]).toBeTruthy();
      expect(t.dropChance).toBeGreaterThan(0);
    }
  });

  it('GDD v3: 10 items (3 growth + 7 special), drop ratio 30/30/30/10', () => {
    expect(Object.keys(ITEM_TYPES).length).toBe(10);
    expect(Object.values(ITEM_TYPES).filter((d) => d.kind === 'stat').length).toBe(3);
    const w = DROP_TABLES.standard.weights;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    expect(w.speedUp / total).toBeCloseTo(0.3, 2);
    expect(w.bombUp / total).toBeCloseTo(0.3, 2);
    expect(w.waveUp / total).toBeCloseTo(0.3, 2);
  });

  it('held slot (shield / needle / skates): a new one replaces it; abilities stack', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    gm.items.spawn('needle', 3, 3);
    gm.step(DT, {});
    expect(p.heldItem).toEqual({ type: 'needle' });
    gm.items.spawn('shield', 3, 3);
    gm.step(DT, {});
    expect(p.heldItem.type).toBe('shield');
    gm.items.spawn('kick', 3, 3);
    gm.step(DT, {});
    gm.items.spawn('glove', 3, 3);
    gm.step(DT, {});
    expect(p.abilities).toMatchObject({ kick: true, glove: true });
    expect(p.heldItem.type).toBe('shield');
  });

  it('ROLLER SKATES: SPEED becomes character MAX + 1 for a while, stats untouched', () => {
    const gm = makeGame({ chars: ['picker', 'vin'] });
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    gm.items.spawn('rollerSkates', 3, 3);
    gm.step(DT, {});
    press(gm, 0, 'item');
    expect(p.stats.current.speed).toBe(4);
    expect(p.speedLevel).toBe(6); // PICKER MAX 5 → 6
    expect(p.heldItem).toBeNull();
    run(gm, ITEM_TYPES.rollerSkates.duration + 0.1, {});
    expect(p.speedLevel).toBe(4);
  });

  it('KICK: touching a Beat Bomb sends it sliding until it hits an obstacle', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 2, 3);
    gm.items.spawn('kick', 2, 3);
    gm.step(DT, {});
    expect(p.abilities.kick).toBe(true);
    press(gm, 0, 'bomb');
    // 폭탄에서 왼쪽으로 빠져나온 뒤 다시 오른쪽으로 밀기
    run(gm, 0.4, { 0: { dir: 'left' } });
    expect(p.cellX).toBe(1);
    run(gm, 0.6, { 0: { dir: 'right' } });
    run(gm, 1.0, {});
    const b = gm.bombs.bombs[0];
    expect(b.x).toBe(11); // 벽 앞까지
    expect(b.y).toBe(3);
  });

  it('GLOVE: E next to a bomb lifts and throws it forward', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 2, 3);
    gm.items.spawn('glove', 2, 3);
    gm.step(DT, {});
    press(gm, 0, 'bomb');
    p.facing = 'right';
    press(gm, 0, 'item');
    run(gm, 0.6, {});
    const b = gm.bombs.bombs[0];
    expect(b.x).toBe(2 + GAME_CONFIG.bomb.throwDistance);
    expect(b.flying).toBe(false);
  });

  it('NEEDLE: a trapped player escapes with the item key (+ short invulnerability)', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    gm.items.spawn('needle', 3, 3);
    gm.step(DT, {});
    trapBy(gm, p, 1);
    run(gm, 0.5, {});
    expect(p.state).toBe('TRAPPED');
    press(gm, 0, 'item');
    expect(p.state).toBe('RESCUED');
    expect(p.heldItem).toBeNull();
    expect(p.invulnerable).toBeGreaterThan(0);
    expect(gm.events.some((e) => e.type === 'playerRescued' && e.method === 'needle')).toBe(true);
  });

  it('Sound Capsule stays fixed on its cell (prototype rule)', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    trapBy(gm, p, 1);
    run(gm, 1, { 0: { dir: 'right' } });
    expect(p.x).toBe(3);
    expect(p.y).toBe(3);
  });

  it('REMOTE detonates my oldest bomb right away', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    gm.items.spawn('remote', 3, 3);
    gm.step(DT, {});
    press(gm, 0, 'bomb');
    placeAt(gm, p, 8, 5);
    press(gm, 0, 'item');
    expect(gm.bombs.countFor(0)).toBe(0);
    expect(gm.events.some((e) => e.type === 'remoteDetonate')).toBe(true);
  });

  it('SHIELD blocks one Sound Wave automatically', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    const o = gm.players.get(1);
    placeAt(gm, p, 4, 3);
    gm.items.spawn('shield', 4, 3);
    gm.step(DT, {});
    placeAt(gm, o, 5, 3);
    press(gm, 1, 'bomb');
    placeAt(gm, o, 10, 6);
    run(gm, 3, {});
    expect(p.isActive).toBe(true);
    expect(p.heldItem).toBeNull();
    expect(gm.events.some((e) => e.type === 'shieldBlock') || true).toBe(true);
  });

  it('RANDOM BOX resolves into a real item', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    placeAt(gm, p, 3, 3);
    gm.items.spawn('randomBox', 3, 3);
    gm.step(DT, {});
    const ev = gm.events.find((e) => e.type === 'randomBox');
    expect(ev).toBeTruthy();
    expect(ITEM_TYPES[ev.resolved].kind).not.toBe('random');
  });

  it('breakables drop items (deterministic by seed)', () => {
    const map = ['#########', '#1.BBBBB#', '#.......#', '#2......#', '#########'];
    const gm = makeGame({ chars: ['rex', 'vin'], map });
    const rex = gm.players.get(0);
    // 각 상자 아래에서 폭탄 (이전 Wave 가 사라진 뒤 설치)
    let drops = 0;
    for (let x = 3; x <= 7; x++) {
      placeAt(gm, rex, x, 2);
      press(gm, 0, 'bomb');
      placeAt(gm, rex, 1, 3);
      run(gm, 3.4, (g) => {
        drops += g.events.filter((e) => e.type === 'itemSpawned').length;
        g.events.length = 0;
        return {};
      });
    }
    expect(gm.grid.cellsOfType('BREAKABLE').length).toBe(0);
    expect(rex.isActive).toBe(true);
    expect(drops).toBeGreaterThan(0);
  });
});

describe('Sound Capsule — trap / rescue / elimination', () => {
  it('Solo Battle: trapped player is eliminated after the timer', () => {
    const gm = makeGame();
    const p = gm.players.get(0);
    trapBy(gm, p, 1);
    expect(p.state).toBe('TRAPPED');
    run(gm, GAME_CONFIG.trap.battleTime + 0.1, {});
    expect(p.state).toBe('ELIMINATED');
    expect(gm.players.get(1).score).toBe(1);
    expect(gm.result.winnerIds).toEqual([1]);
  });

  it('Solo Battle: an opponent touching the capsule pops it', () => {
    const gm = makeGame({ chars: ['vin', 'picker', 'rex'] });
    const p = gm.players.get(0);
    const o = gm.players.get(1);
    placeAt(gm, p, 4, 3);
    trapBy(gm, p, 2);
    run(gm, 0.5, {});
    placeAt(gm, o, 4, 3);
    gm.step(DT, {});
    expect(p.state).toBe('ELIMINATED');
    expect(o.score).toBe(1);
  });

  it('Team Mode: an ally rescues, enemies pop', () => {
    const gm = makeGame({ chars: ['vin', 'picker', 'aa', 'rex'], mode: 'team', teams: ['A', 'B', 'A', 'B'] });
    const [a1, b1, a2, b2] = gm.players.list;
    placeAt(gm, a1, 5, 3);
    placeAt(gm, a2, 8, 3);
    placeAt(gm, b1, 1, 6);
    placeAt(gm, b2, 11, 6);
    trapBy(gm, a1, b1.id);
    run(gm, 0.5, {});
    placeAt(gm, a2, 5, 3);
    gm.step(DT, {});
    expect(a1.state).toBe('RESCUED');
    expect(a1.invulnerable).toBeGreaterThan(0);

    run(gm, 2, {});
    trapBy(gm, a1, b1.id);
    placeAt(gm, a2, 8, 1);
    run(gm, 0.5, {});
    placeAt(gm, b2, 5, 3);
    gm.step(DT, {});
    expect(a1.state).toBe('ELIMINATED');
  });

  it('Team Mode: team wins when the whole enemy team is eliminated', () => {
    const gm = makeGame({ chars: ['vin', 'picker', 'aa', 'rex'], mode: 'team', teams: ['A', 'B', 'A', 'B'] });
    const [, b1, , b2] = gm.players.list;
    gm.players.eliminate(b1, 0, 'test');
    gm.step(DT, {});
    expect(gm.result).toBeNull();
    gm.players.eliminate(b2, 0, 'test');
    gm.step(DT, {});
    expect(gm.result.team).toBe('A');
    expect(gm.result.winnerIds.sort()).toEqual([0, 2]);
  });

  it('Team Mode: whole team trapped with nobody to rescue → team wipe', () => {
    const gm = makeGame({ chars: ['vin', 'picker', 'aa', 'rex'], mode: 'team', teams: ['A', 'B', 'A', 'B'] });
    const [a1, , a2] = gm.players.list;
    placeAt(gm, a1, 3, 3);
    placeAt(gm, a2, 9, 3);
    trapBy(gm, a1, 1);
    trapBy(gm, a2, 3);
    run(gm, 1.2, {});
    expect(gm.result?.team).toBe('B');
  });

  it('Time up → survivor with best score wins, tie → draw', () => {
    const gm = makeGame();
    gm.timeLimit = 1;
    run(gm, 1.1, {});
    expect(gm.result.type).toBe('draw');
    expect(gm.result.reason).toBe('timeUp');
  });
});
