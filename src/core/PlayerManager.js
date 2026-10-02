import { GAME_CONFIG } from '../config/gameConfig.js';
import { PLAYER_STATE } from './constants.js';
import { PlayerController } from './PlayerController.js';

const S = PLAYER_STATE;

// 슬롯 수에 따른 스폰 배치 (대각선 우선)
const FFA_SPAWN_ORDER = [0, 3, 1, 2];
const TEAM_SPAWNS = { A: [0, 2], B: [1, 3] };

// 플레이어 생성 / 포획(Sound Capsule) / 구출 / 탈락 관리 — 모든 캐릭터 동일 규칙
export class PlayerManager {
  constructor(gm, playerSetups) {
    this.gm = gm;
    this.list = [];
    const teamCounters = { A: 0, B: 0 };
    const spawns = gm.grid.spawns;
    const ffaOrder = FFA_SPAWN_ORDER.filter((i) => spawns[i]);
    playerSetups.forEach((p, i) => {
      let spawnIndex;
      if (gm.mode.def.team) {
        const t = p.team || (i % 2 === 0 ? 'A' : 'B');
        spawnIndex = TEAM_SPAWNS[t][teamCounters[t]++ % 2];
      } else {
        spawnIndex = ffaOrder[i % ffaOrder.length];
      }
      const spawn = spawns[spawnIndex];
      if (!spawn) throw new Error(`Stage has no spawn #${spawnIndex + 1}`);
      const team = gm.mode.def.team ? p.team || (i % 2 === 0 ? 'A' : 'B') : null;
      this.list.push(
        new PlayerController({
          id: i,
          slot: p.slot ?? i,
          characterId: p.characterId,
          team,
          isBot: !!p.bot,
          spawn,
          color: team ? GAME_CONFIG.teamColors[team] : GAME_CONFIG.playerColors[(p.slot ?? i) % 4],
        }),
      );
    });
  }

  get(id) {
    return this.list[id];
  }

  alive() {
    return this.list.filter((p) => !p.isEliminated);
  }

  at(x, y) {
    return this.list.filter((p) => !p.isEliminated && p.cellX === x && p.cellY === y);
  }

  update(dt, intents) {
    for (const p of this.list) {
      p.update(dt, intents[p.id] || EMPTY_INTENT, this.gm);
    }
    this._capsuleContacts();
  }

  // 갇힌 플레이어와의 접촉: 아군 → 구출 / 상대 → 터뜨림(탈락)
  _capsuleContacts() {
    const { mode } = this.gm;
    for (const t of this.list) {
      if (!t.isTrapped || t.trap.time < GAME_CONFIG.trap.popGraceTime) continue;
      for (const p of this.list) {
        if (p === t || !p.isActive) continue;
        const dist = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
        if (dist > 0.6) continue;
        if (mode.areAllies(p, t)) {
          this.rescue(t, p);
        } else if (GAME_CONFIG.trap.enemyTouchPops) {
          this.eliminate(t, p.id, 'pop');
        }
        break;
      }
    }
  }

  hit(player, byId, source = 'wave') {
    if (!player.isActive || player.invulnerable > 0) return false;
    if (player.heldItem && player.heldItem.type === 'shield') {
      player.heldItem = null;
      player.invulnerable = GAME_CONFIG.trap.shieldInvulnerable;
      this.gm.emit('shieldBlock', { playerId: player.id });
      return false;
    }
    this.trapPlayer(player, byId, source);
    return true;
  }

  trapPlayer(player, byId, source = 'wave') {
    player.dash.time = 0;
    player.forced = null;
    player.trap = { time: 0, maxTime: this.gm.mode.def.trapTime, byId };
    player.setState(S.TRAPPED);
    this.gm.emit('playerTrapped', { playerId: player.id, byId, source });
  }

  rescue(player, rescuer) {
    player.trap = null;
    player.invulnerable = GAME_CONFIG.trap.rescueInvulnerable;
    player.setState(S.RESCUED);
    this.gm.emit('playerRescued', { playerId: player.id, byId: rescuer ? rescuer.id : null });
  }

  eliminate(player, byId, reason) {
    if (player.isEliminated) return;
    const creditId = byId;
    player.trap = null;
    player.forced = null;
    player.eliminatedAt = this.gm.matchTime;
    player.setState(S.ELIMINATED);
    if (creditId !== null && creditId !== undefined && creditId !== player.id) {
      const killer = this.list[creditId];
      if (killer && !this.gm.mode.areAllies(killer, player)) killer.score += 1;
    }
    this.gm.emit('playerEliminated', { playerId: player.id, byId: creditId, reason });
  }

  // 승리 연출 상태 (게임 로직 종료 후)
  setVictory(ids) {
    for (const p of this.list) {
      if (ids.includes(p.id)) {
        p.trap = null;
        p.setState(S.VICTORY);
      }
    }
  }
}

export const EMPTY_INTENT = Object.freeze({ dir: null, bomb: false, dash: false, item: false });
