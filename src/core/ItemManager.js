import { GAME_CONFIG } from '../config/gameConfig.js';
import { ITEM_TYPES, RANDOM_BOX_POOL, MAX_STAT_REWARD, SPECIAL_POOL } from '../config/itemConfig.js';
import { DIRS } from './constants.js';

// ─────────────────────────────────────────────────────────────
// ItemManager — 공통 아이템 시스템
//   - BREAKABLE 파괴 시 드랍 테이블(config)로 드랍
//   - 자동 획득
//   - stat 아이템 → CharacterStats.increase (캐릭터 max 를 넘지 않음) · 이미 MAX 면 MAX BONUS (+3번째마다 특수 아이템)
//   - ability 아이템 → 그 판 동안 유지 (KICK / GLOVE / REMOTE)
//   - held 아이템 → 소모형 1칸 (SHIELD 자동 / NEEDLE / ROLLER SKATES), E 키 (누구나 동일)
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
      const wasMax = player.stats.isMaxed(def.stat);
      const gained = player.stats.increase(def.stat, def.amount);
      if (wasMax) {
        this._maxReward(player, type, item);
        return;
      }
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
    if (def.kind === 'ability') {
      const had = player.abilities[type];
      player.abilities[type] = true;
      this.gm.emit('itemPicked', { playerId: player.id, itemType: type, itemId: item?.id, ability: true, had });
      return;
    }
    if (def.kind === 'held') {
      player.heldItem = { type };
      this.gm.emit('itemPicked', { playerId: player.id, itemType: type, itemId: item?.id, held: true });
      return;
    }
    if (def.kind === 'random') {
      const resolved = this.gm.rng.weighted(RANDOM_BOX_POOL);
      this.gm.emit('randomBox', { playerId: player.id, resolved });
      this.apply(player, resolved, item);
    }
  }

  // MAX 능력치 아이템 → MAX BONUS +1, specialEvery 번째마다 무작위 특수 아이템
  _maxReward(player, type, item) {
    const R = MAX_STAT_REWARD;
    player.maxPickups = (player.maxPickups || 0) + 1;
    player.bonus = (player.bonus || 0) + R.bonus;
    const convert = player.maxPickups % R.specialEvery === 0;
    this.gm.emit('itemPicked', { playerId: player.id, itemType: type, itemId: item?.id, stat: ITEM_TYPES[type].stat, gained: 0, maxed: true, maxBonus: R.bonus, maxCount: player.maxPickups, converts: convert });
    if (convert) {
      // 이미 가진 능력은 빼고 고른다 (전부 가졌으면 SHIELD)
      const pool = {};
      for (const [k, w] of Object.entries(SPECIAL_POOL)) {
        const d = ITEM_TYPES[k];
        if (d.kind === 'ability' && player.abilities[k]) continue;
        if (d.kind === 'held' && player.heldItem?.type === k) continue;
        pool[k] = w;
      }
      const resolved = Object.keys(pool).length ? this.gm.rng.weighted(pool) : 'shield';
      this.gm.emit('maxSpecial', { playerId: player.id, resolved });
      this.apply(player, resolved, item);
    }
  }

  // 아이템 키(E) — 모든 캐릭터 동일한 우선순위. 무언가 했으면 true
  //   ① 갇힘 + NEEDLE → 탈출  ② GLOVE + 손 닿는 Bomb → 던지기
  //   ③ ROLLER SKATES → 가속  ④ REMOTE → 내 가장 오래된 Bomb 발동
  useItemKey(player) {
    const { gm } = this;
    const held = player.heldItem;
    if (player.isTrapped) {
      if (held?.type === 'needle') {
        player.heldItem = null;
        gm.players.rescue(player, null, 'needle');
        gm.emit('itemUsed', { playerId: player.id, itemType: 'needle' });
        return true;
      }
      return false;
    }
    if (!player.isActive) return false;

    if (player.abilities.glove && ITEM_EFFECTS.glove(player, gm)) {
      gm.emit('itemUsed', { playerId: player.id, itemType: 'glove' });
      return true;
    }
    if (held?.type === 'rollerSkates') {
      ITEM_EFFECTS.rollerSkates(player, gm, ITEM_TYPES.rollerSkates);
      player.heldItem = null;
      gm.emit('itemUsed', { playerId: player.id, itemType: 'rollerSkates' });
      return true;
    }
    if (player.abilities.remote && ITEM_EFFECTS.remote(player, gm)) {
      gm.emit('itemUsed', { playerId: player.id, itemType: 'remote' });
      return true;
    }
    if (held) gm.emit('itemPassive', { playerId: player.id, itemType: held.type });
    else gm.emit('itemFailed', { playerId: player.id });
    return false;
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
  // GLOVE / THROW: 인접 Bomb 을 들어 앞으로 던짐
  glove(player, gm) {
    const bomb = bombInReach(player, gm);
    if (!bomb) return false;
    return gm.bombs.throwBomb(bomb, player.facing);
  },
  // REMOTE: 자신의 가장 오래된 Beat Bomb 을 즉시 발동
  remote(player, gm) {
    const own = gm.bombs.bombs.filter((b) => b.ownerId === player.id && !b.flying);
    if (own.length === 0) return false;
    own.sort((a, b) => a.placedAt - b.placedAt);
    gm.bombs.trigger(own[0], 0);
    gm.emit('remoteDetonate', { playerId: player.id, bombId: own[0].id });
    return true;
  },
  // ROLLER SKATES: 일정 시간 SPEED = 캐릭터 MAX + overMax
  rollerSkates(player, gm, def) {
    player.modifiers.speedOverride = player.stats.max.speed + def.overMax;
    player.modifiers.speedOverrideTime = def.duration;
    gm.emit('modifierStart', { playerId: player.id, modifier: 'rollerSkates', duration: def.duration, level: player.modifiers.speedOverride });
    return true;
  },
};
