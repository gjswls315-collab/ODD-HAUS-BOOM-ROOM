import { GAME_CONFIG } from '../config/gameConfig.js';
import { ITEM_TYPES, RANDOM_BOX_POOL } from '../config/itemConfig.js';
import { DIRS } from './constants.js';

// ─────────────────────────────────────────────────────────────
// ItemManager — 공통 아이템 시스템
//   - BREAKABLE 파괴 시 드랍 테이블(config)로 드랍
//   - 자동 획득
//   - stat 아이템 → CharacterStats.increase (캐릭터 max 를 넘지 않음)
//   - special 아이템 → Held Item 슬롯 1칸, E 키로 사용 (누구나 동일)
// ─────────────────────────────────────────────────────────────
export class ItemManager {
  constructor(gm, dropTable) {
    this.gm = gm;
    this.dropTable = dropTable;
    this.items = []; // { id, type, x, y, protectUntil, spawnedAt }
    this.nextId = 1;
  }

  at(x, y) {
    return this.items.find((i) => i.x === x && i.y === y) || null;
  }

  spawn(type, x, y) {
    if (!ITEM_TYPES[type]) throw new Error(`Unknown item type ${type}`);
    const existing = this.at(x, y);
    if (existing) this._remove(existing);
    const item = {
      id: this.nextId++,
      type,
      x,
      y,
      protectUntil: this.gm.time + GAME_CONFIG.items.spawnProtect,
      spawnedAt: this.gm.time,
    };
    this.items.push(item);
    this.gm.emit('itemSpawned', { itemId: item.id, itemType: type, x, y });
    return item;
  }

  rollDrop(x, y) {
    const { rng } = this.gm;
    if (rng.next() >= this.dropTable.dropChance) return null;
    return this.spawn(rng.weighted(this.dropTable.weights), x, y);
  }

  destroyAt(x, y) {
    const item = this.at(x, y);
    if (!item || item.protectUntil > this.gm.time) return false;
    this._remove(item);
    this.gm.emit('itemDestroyed', { itemId: item.id, x, y });
    return true;
  }

  _remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  update() {
    for (const p of this.gm.players.list) {
      if (!p.isActive) continue;
      const item = this.at(p.cellX, p.cellY);
      if (item) {
        this._remove(item);
        this.apply(p, item.type, item);
      }
    }
  }

  // 아이템 효과 적용 — 캐릭터 구분 없이 동일
  apply(player, type, item = null) {
    const def = ITEM_TYPES[type];
    if (def.kind === 'stat') {
      const gained = player.stats.increase(def.stat, def.amount);
      this.gm.emit('itemPicked', {
        playerId: player.id,
        itemType: type,
        itemId: item?.id,
        stat: def.stat,
        gained,
        value: player.stats.current[def.stat],
        max: player.stats.max[def.stat],
        maxed: player.stats.isMaxed(def.stat),
      });
      return;
    }
    if (def.kind === 'special') {
      player.heldItem = { type, charges: def.charges };
      this.gm.emit('itemPicked', { playerId: player.id, itemType: type, itemId: item?.id, held: true });
      return;
    }
    if (def.kind === 'random') {
      const resolved = this.gm.rng.weighted(RANDOM_BOX_POOL);
      this.gm.emit('randomBox', { playerId: player.id, resolved });
      this.apply(player, resolved, item);
    }
  }

  // E 키 — 보유한 특수 아이템 사용. 성공 시 true
  useHeld(player) {
    const held = player.heldItem;
    if (!held || !player.isActive) return false;
    const def = ITEM_TYPES[held.type];
    const effect = ITEM_EFFECTS[held.type];
    if (def.passive || !effect) {
      this.gm.emit('itemPassive', { playerId: player.id, itemType: held.type });
      return false;
    }
    const ok = effect(player, this.gm, def);
    if (!ok) {
      this.gm.emit('itemFailed', { playerId: player.id, itemType: held.type });
      return false;
    }
    held.charges -= 1;
    this.gm.emit('itemUsed', { playerId: player.id, itemType: held.type, charges: held.charges });
    if (held.charges <= 0) player.heldItem = null;
    return true;
  }
}

// 바로 앞(또는 내 칸)의 폭탄
function bombInReach(player, gm) {
  const own = gm.bombs.at(player.cellX, player.cellY);
  if (own) return own;
  const d = DIRS[player.facing];
  return gm.bombs.at(player.cellX + d.x, player.cellY + d.y);
}

// 특수 아이템 효과 — 캐릭터 기본 Stats 와 분리된 공용 효과
export const ITEM_EFFECTS = {
  kick(player, gm) {
    const bomb = bombInReach(player, gm);
    if (!bomb) return false;
    return gm.bombs.kick(bomb, player.facing);
  },
  throw(player, gm) {
    const bomb = bombInReach(player, gm);
    if (!bomb) return false;
    return gm.bombs.throwBomb(bomb, player.facing);
  },
  remote(player, gm) {
    const own = gm.bombs.bombs.filter((b) => b.ownerId === player.id && !b.flying);
    if (own.length === 0) return false;
    own.sort((a, b) => a.placedAt - b.placedAt);
    gm.bombs.trigger(own[0], 0);
    gm.emit('remoteDetonate', { playerId: player.id, bombId: own[0].id });
    return true;
  },
  speedShoes(player, gm, def) {
    player.modifiers.speedBonus = def.speedBonus;
    player.modifiers.speedBonusTime = def.duration;
    gm.emit('modifierStart', { playerId: player.id, modifier: 'speedShoes', duration: def.duration });
    return true;
  },
};
