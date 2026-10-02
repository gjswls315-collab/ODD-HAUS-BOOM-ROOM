import { GAME_CONFIG } from '../config/gameConfig.js';
import { DIRS, DIR_NAMES, cellKey } from './constants.js';

const W = GAME_CONFIG.wave;

// ─────────────────────────────────────────────────────────────
// Sound Wave — 십자(상하좌우) 전파, 범위 = 설치 시점의 WAVE
//   SOLID     : 멈춤 (칸 미포함)
//   BREAKABLE : 파괴 후 해당 방향 종료
//   Beat Bomb : Chain Reaction (해당 방향 종료, 그 폭탄이 이어서 폭발)
// Wave 는 lingerTime 동안 칸에 남아 플레이어를 Sound Capsule 에 가둔다.
// ─────────────────────────────────────────────────────────────
export class SoundWaveManager {
  constructor(gm) {
    this.gm = gm;
    this.cells = new Map(); // key → { x, y, expires, ownerId, explosionId }
    this.explosions = []; // 렌더용 { id, x, y, arms, ownerId, time, expires, source }
    this.nextId = 1;
  }

  isActive(x, y) {
    return this.cells.has(cellKey(x, y));
  }

  cellAt(x, y) {
    return this.cells.get(cellKey(x, y)) || null;
  }

  explode(bomb) {
    const { gm } = this;
    gm.bombs.remove(bomb);
    const result = this._propagate(bomb.x, bomb.y, bomb.range, DIR_NAMES, {
      ownerId: bomb.ownerId,
      includeCenter: true,
      source: 'bomb',
      bombId: bomb.id,
    });
    gm.emit('explosion', {
      explosionId: result.explosion.id,
      bombId: bomb.id,
      x: bomb.x,
      y: bomb.y,
      arms: result.explosion.arms,
      ownerId: bomb.ownerId,
      chained: bomb.chained,
    });
    return result;
  }

  // 기믹(앰프 Sound Pulse 등)이 쏘는 직선 파동. 소유자 없음.
  emitLine(x, y, dir, range, source = 'pulse') {
    const result = this._propagate(x, y, range, [dir], { ownerId: null, includeCenter: false, source });
    this.gm.emit('pulse', { explosionId: result.explosion.id, x, y, dir, arms: result.explosion.arms, source });
    return result;
  }

  _propagate(x0, y0, range, dirs, { ownerId, includeCenter, source }) {
    const { gm } = this;
    const { grid } = gm;
    const cells = [];
    const arms = { up: 0, down: 0, left: 0, right: 0 };
    const ends = { up: 'open', down: 'open', left: 'open', right: 'open' };
    const toDestroy = [];
    const chained = [];
    const touched = []; // Wave 가 닿았지만 막힌 SOLID 칸 (스위치 장비 등)

    if (includeCenter) cells.push({ x: x0, y: y0 });
    for (const dir of dirs) {
      const d = DIRS[dir];
      for (let s = 1; s <= range; s++) {
        const x = x0 + d.x * s;
        const y = y0 + d.y * s;
        const inter = grid.waveInteraction(x, y);
        if (inter === 'block') {
          ends[dir] = 'block';
          touched.push({ x, y });
          break;
        }
        cells.push({ x, y });
        arms[dir] = s;
        if (inter === 'destroy') {
          toDestroy.push({ x, y });
          ends[dir] = 'destroy';
          break;
        }
        const other = gm.bombs.at(x, y);
        if (other) {
          chained.push(other);
          ends[dir] = 'chain';
          break;
        }
      }
    }

    // Chain Reaction
    for (const b of chained) gm.bombs.trigger(b, GAME_CONFIG.bomb.chainDelay);

    // 바닥 아이템 파괴 (드랍 직후 보호 중인 아이템 제외)
    if (W.destroysItems) {
      for (const c of cells) gm.items.destroyAt(c.x, c.y);
    }

    // BREAKABLE 파괴 + 아이템 드랍
    for (const c of toDestroy) {
      const before = grid.destroyBreakable(c.x, c.y);
      if (!before) continue;
      gm.emit('blockDestroyed', { x: c.x, y: c.y, prop: before.prop, group: before.group });
      gm.stage.onBreakableDestroyed(c.x, c.y, before);
      gm.items.rollDrop(c.x, c.y);
    }

    // Wave 칸 등록 (linger)
    const explosion = {
      id: this.nextId++,
      x: x0,
      y: y0,
      arms,
      ends,
      ownerId,
      source,
      time: gm.time,
      expires: gm.time + W.lingerTime,
      cells,
    };
    this.explosions.push(explosion);
    for (const c of cells) {
      this.cells.set(cellKey(c.x, c.y), {
        x: c.x,
        y: c.y,
        expires: explosion.expires,
        ownerId,
        explosionId: explosion.id,
      });
      gm.stage.onWaveCell(c.x, c.y, source);
    }
    for (const c of touched) gm.stage.onWaveTouch(c.x, c.y, source);
    // 즉시 판정 (같은 틱)
    this.applyHits();
    return { explosion, cells };
  }

  // Wave 위 플레이어 → Sound Capsule
  applyHits() {
    const { gm } = this;
    if (this.cells.size === 0) return;
    for (const p of gm.players.list) {
      if (!p.isActive || p.invulnerable > 0) continue;
      const w = this.cells.get(cellKey(p.cellX, p.cellY));
      if (w) gm.players.hit(p, w.ownerId, 'wave');
    }
  }

  update() {
    const now = this.gm.time;
    for (const [k, w] of this.cells) if (w.expires <= now) this.cells.delete(k);
    this.explosions = this.explosions.filter((e) => e.expires > now - 0.6);
    this.applyHits();
  }
}
