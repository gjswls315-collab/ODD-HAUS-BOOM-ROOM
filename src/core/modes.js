import { GAME_CONFIG } from '../config/gameConfig.js';

// 게임 모드 — BATTLE / TEAM 우선 구현. 나머지는 확장 예정.
export const MODES = {
  battle: {
    id: 'battle',
    name: 'BATTLE MODE',
    desc: '2~4인 개인전. 마지막까지 살아남기.',
    team: false,
    minPlayers: 2,
    maxPlayers: 4,
    trapTime: GAME_CONFIG.trap.battleTime,
    timeLimit: GAME_CONFIG.match.battleTimeLimit,
    available: true,
  },
  team: {
    id: 'team',
    name: 'TEAM MODE',
    desc: '2 VS 2. Sound Capsule 에 갇힌 팀원을 구출하자.',
    team: true,
    minPlayers: 4,
    maxPlayers: 4,
    trapTime: GAME_CONFIG.trap.teamTime,
    timeLimit: GAME_CONFIG.match.teamTimeLimit,
    available: true,
  },
  item: { id: 'item', name: 'ITEM MODE', desc: '특수 아이템 대량 등장', available: false },
  houseEvent: { id: 'houseEvent', name: 'HOUSE EVENT', desc: 'Mr. ODD 이벤트 빈도 UP', available: false },
  coop: { id: 'coop', name: 'CO-OP MODE', desc: '함께 맵 기믹 해결', available: false },
  custom: { id: 'custom', name: 'CUSTOM', desc: '시간/아이템/이벤트 조정', available: false },
};

export function createModeRules(modeId) {
  const def = MODES[modeId];
  if (!def || !def.available) throw new Error(`Mode not available: ${modeId}`);
  return def.team ? new TeamRules(def) : new BattleRules(def);
}

class BattleRules {
  constructor(def) {
    this.def = def;
  }

  areAllies(a, b) {
    return a === b;
  }

  // 마지막 생존자 (Last Player Standing)
  checkEnd(gm) {
    const alive = gm.players.alive();
    if (alive.length === 1) return { type: 'win', winnerIds: [alive[0].id], team: null, reason: 'lastStanding' };
    if (alive.length === 0) return { type: 'draw', winnerIds: [], team: null, reason: 'lastStanding' };
    return null;
  }

  // 제한 시간 종료: 생존자 중 점수 판정
  timeUp(gm) {
    const alive = gm.players.alive();
    if (!alive.length) return { type: 'draw', winnerIds: [], team: null, reason: 'timeUp' };
    const best = Math.max(...alive.map((p) => p.score));
    const top = alive.filter((p) => p.score === best);
    if (top.length === 1) return { type: 'win', winnerIds: [top[0].id], team: null, reason: 'timeUp' };
    return { type: 'draw', winnerIds: [], team: null, reason: 'timeUp' };
  }

  update() {}
}

class TeamRules {
  constructor(def) {
    this.def = def;
    this.wipeTimers = { A: 0, B: 0 };
  }

  areAllies(a, b) {
    return a.team === b.team;
  }

  teamsAlive(gm) {
    const set = new Set();
    for (const p of gm.players.alive()) set.add(p.team);
    return [...set];
  }

  checkEnd(gm) {
    const teams = this.teamsAlive(gm);
    if (teams.length === 1) {
      const team = teams[0];
      return {
        type: 'win',
        team,
        winnerIds: gm.players.list.filter((p) => p.team === team).map((p) => p.id),
        reason: 'lastStanding',
      };
    }
    if (teams.length === 0) return { type: 'draw', winnerIds: [], team: null, reason: 'lastStanding' };
    return null;
  }

  // 팀 전원이 갇혀서 구출할 사람이 없으면 잠시 후 전원 탈락 (팀 전멸)
  update(dt, gm) {
    for (const team of ['A', 'B']) {
      const members = gm.players.list.filter((p) => p.team === team && !p.isEliminated);
      const anyActive = members.some((p) => p.isActive);
      if (members.length && !anyActive) {
        this.wipeTimers[team] += dt;
        if (this.wipeTimers[team] >= 1.0) {
          for (const p of members) gm.players.eliminate(p, p.trap ? p.trap.byId : null, 'teamWipe');
          this.wipeTimers[team] = 0;
        }
      } else {
        this.wipeTimers[team] = 0;
      }
    }
  }

  timeUp(gm) {
    const count = (t) => gm.players.alive().filter((p) => p.team === t).length;
    const score = (t) => gm.players.list.filter((p) => p.team === t).reduce((s, p) => s + p.score, 0);
    const a = count('A');
    const b = count('B');
    let team = null;
    if (a !== b) team = a > b ? 'A' : 'B';
    else if (score('A') !== score('B')) team = score('A') > score('B') ? 'A' : 'B';
    if (!team) return { type: 'draw', winnerIds: [], team: null, reason: 'timeUp' };
    return {
      type: 'win',
      team,
      winnerIds: gm.players.list.filter((p) => p.team === team).map((p) => p.id),
      reason: 'timeUp',
    };
  }
}
