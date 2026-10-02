import { describe, it, expect } from 'vitest';
import {
  CHARACTERS,
  PLAYABLE_CHARACTER_IDS,
  NON_PLAYABLE_CHARACTERS,
  STAT_KEYS,
  isPlayable,
} from '../src/config/characterConfig.js';
import { CharacterStats } from '../src/core/CharacterStats.js';
import { makeGame, run, press, placeAt, DT } from './helpers.js';

describe('Character config (stats only, no skills)', () => {
  it('has exactly 7 playable characters and Mr. ODD is not playable', () => {
    expect(PLAYABLE_CHARACTER_IDS).toEqual(['vin', 'picker', 'aa', 'locke', 'rex', 'buddy', 'bully']);
    expect(Object.keys(CHARACTERS).sort()).toEqual([...PLAYABLE_CHARACTER_IDS].sort());
    expect(isPlayable('mrOdd')).toBe(false);
    expect(NON_PLAYABLE_CHARACTERS.mrOdd.playable).toBe(false);
    expect(() => makeGame({ chars: ['vin', 'mrOdd'] })).toThrow();
  });

  it('every character only defines speed/bomb/wave start+max (no skill fields)', () => {
    for (const c of Object.values(CHARACTERS)) {
      for (const k of STAT_KEYS) {
        expect(c[k].start).toBeGreaterThanOrEqual(1);
        expect(c[k].max).toBeGreaterThanOrEqual(c[k].start);
      }
      const keys = Object.keys(c).join(',').toLowerCase();
      expect(keys).not.toMatch(/skill|ability|cooldown|ultimate|gauge/);
    }
  });

  it('matches the balance draft from the implementation prompt', () => {
    expect(CHARACTERS.vin.speed).toEqual({ start: 3, max: 5 });
    expect(CHARACTERS.picker.speed).toEqual({ start: 4, max: 5 });
    expect(CHARACTERS.aa.bomb).toEqual({ start: 2, max: 5 });
    expect(CHARACTERS.rex.wave).toEqual({ start: 3, max: 5 });
    expect(CHARACTERS.locke).toMatchObject({ speed: { start: 3, max: 4 }, bomb: { start: 2, max: 4 }, wave: { start: 3, max: 4 } });
  });

  it('CharacterStats.increase never exceeds max', () => {
    const s = new CharacterStats(CHARACTERS.vin);
    expect(s.increase('speed')).toBe(1); // 4
    expect(s.increase('speed')).toBe(1); // 5
    expect(s.increase('speed')).toBe(0); // capped
    expect(s.current.speed).toBe(5);
    expect(s.isMaxed('speed')).toBe(true);
  });
});

describe('Section 39 — test criteria', () => {
  it('VIN: initial stats applied, items raise stats, growth stops at MAX', () => {
    const gm = makeGame({ chars: ['vin', 'picker'] });
    const vin = gm.players.get(0);
    expect(vin.characterId).toBe('vin');
    expect(vin.stats.current).toEqual({ speed: 3, bomb: 1, wave: 2 });
    expect(vin.maxBombs).toBe(1);
    expect(vin.waveRange).toBe(2);

    const feed = (type, times) => {
      for (let i = 0; i < times; i++) {
        gm.items.spawn(type, vin.cellX, vin.cellY);
        gm.step(DT, {});
      }
    };
    feed('speedUp', 1);
    expect(vin.stats.current.speed).toBe(4);
    feed('speedUp', 5);
    expect(vin.stats.current.speed).toBe(5); // VIN max 5

    feed('bombUp', 6);
    expect(vin.stats.current.bomb).toBe(3); // VIN max 3
    feed('waveUp', 6);
    expect(vin.stats.current.wave).toBe(5); // VIN max 5

    const maxedEvents = gm.events.filter((e) => e.type === 'itemPicked' && e.maxed);
    expect(maxedEvents.length).toBeGreaterThan(0);
  });

  it('PICKER: same controls as VIN, but faster', () => {
    const gm = makeGame({ chars: ['vin', 'picker'] });
    const vin = gm.players.get(0);
    const picker = gm.players.get(1);
    placeAt(gm, vin, 1, 2);
    placeAt(gm, picker, 1, 4);
    run(gm, 0.5, { 0: { dir: 'right' }, 1: { dir: 'right' } });
    const vinDist = vin.x - 1;
    const pickerDist = picker.x - 1;
    expect(vinDist).toBeGreaterThan(0.5);
    expect(pickerDist).toBeGreaterThan(vinDist);
    expect(picker.moveSpeed).toBeGreaterThan(vin.moveSpeed);
    // 동일한 컨트롤러 클래스
    expect(Object.getPrototypeOf(vin)).toBe(Object.getPrototypeOf(picker));
  });

  it('A.A.: more Beat Bomb capacity than VIN', () => {
    const gm = makeGame({ chars: ['vin', 'aa'] });
    const vin = gm.players.get(0);
    const aa = gm.players.get(1);
    placeAt(gm, vin, 3, 2);
    placeAt(gm, aa, 3, 4);

    press(gm, 0, 'bomb');
    placeAt(gm, vin, 4, 2);
    press(gm, 0, 'bomb');
    expect(gm.bombs.countFor(0)).toBe(1); // VIN start bomb = 1

    press(gm, 1, 'bomb');
    placeAt(gm, aa, 4, 4);
    press(gm, 1, 'bomb');
    placeAt(gm, aa, 5, 4);
    press(gm, 1, 'bomb');
    expect(gm.bombs.countFor(1)).toBe(2); // A.A. start bomb = 2
  });

  it('REX: longer Sound Wave than VIN', () => {
    const gm = makeGame({ chars: ['vin', 'rex'] });
    const vin = gm.players.get(0);
    const rex = gm.players.get(1);
    placeAt(gm, vin, 6, 2);
    placeAt(gm, rex, 6, 5);
    press(gm, 0, 'bomb');
    press(gm, 1, 'bomb');
    const explosions = [];
    run(gm, 3.2, (g) => {
      for (const e of g.events) if (e.type === 'explosion') explosions.push(e);
      g.events.length = 0;
      return {};
    });
    const vinBoom = explosions.find((e) => e.ownerId === 0);
    const rexBoom = explosions.find((e) => e.ownerId === 1);
    expect(vinBoom.arms.left).toBe(2);
    expect(vinBoom.arms.right).toBe(2);
    expect(rexBoom.arms.left).toBe(3);
    expect(rexBoom.arms.right).toBe(3);
  });

  it('all 7 characters use the same Move / Bomb / Item / Trap / Victory systems', () => {
    for (const id of ['vin', 'picker', 'aa', 'locke', 'rex', 'buddy', 'bully']) {
      const other = id === 'vin' ? 'picker' : 'vin';
      const gm = makeGame({ chars: [id, other] });
      const p = gm.players.get(0);
      const o = gm.players.get(1);
      placeAt(gm, p, 2, 2);
      placeAt(gm, o, 10, 5);

      // Move
      run(gm, 0.3, { 0: { dir: 'right' } });
      expect(p.x).toBeGreaterThan(2);
      placeAt(gm, p, 2, 2);

      // Item
      gm.items.spawn('waveUp', 2, 2);
      gm.step(DT, {});
      expect(p.stats.collected.wave).toBe(1);

      // Bomb
      press(gm, 0, 'bomb');
      expect(gm.bombs.countFor(0)).toBe(1);

      // 내 폭탄은 안전한 곳에서 터지게
      placeAt(gm, p, 8, 4);
      run(gm, 3.0, {});
      expect(gm.bombs.countFor(0)).toBe(0);
      expect(p.isActive).toBe(true);

      // Trap → 상대 폭탄 Wave 에 갇힘
      placeAt(gm, o, 6, 5);
      press(gm, 1, 'bomb');
      placeAt(gm, o, 10, 1);
      placeAt(gm, p, 5, 5);
      run(gm, 3.0, {});
      expect(p.isTrapped).toBe(true);

      // Victory → other player wins after timeout
      run(gm, 6, {});
      expect(gm.result).not.toBeNull();
      expect(gm.result.winnerIds).toEqual([1]);
      expect(o.state).toBe('VICTORY');
    }
  });
});
