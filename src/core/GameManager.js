import { GAME_CONFIG } from '../config/gameConfig.js';
import { DROP_TABLES } from '../config/itemConfig.js';
import { getStage } from '../config/stageConfig.js';
import { MATCH_PHASE } from './constants.js';
import { Rng } from './rng.js';
import { GridManager } from './GridManager.js';
import { pickRandomSpawns } from './spawns.js';
import { PlayerManager } from './PlayerManager.js';
import { BeatBombManager } from './BeatBombManager.js';
import { SoundWaveManager } from './SoundWaveManager.js';
import { ItemManager } from './ItemManager.js';
import { StageManager } from './StageManager.js';
import { HouseEventManager } from './HouseEventManager.js';
import { createModeRules } from './modes.js';

// ─────────────────────────────────────────────────────────────
// GameManager — 한 경기(match)의 순수 시뮬레이션. Three.js / DOM 의존 없음.
// 고정 틱(step)으로 진행 → 테스트 가능 / 추후 온라인 동기화 기반.
//
// setup = {
//   mode: 'battle' | 'team',
//   stageId: 'lounge' | ...,
//   players: [{ slot, characterId, team?, bot? }],
//   seed?, timeLimit?, dropTable?, skipCountdown?, houseEvents?: false,
//   spawn?: 'fixed' | 'random'  (random = 매 경기 다른 시작 위치, 기본 fixed — 테스트 결정성)
//   stageDef? (테스트용 커스텀 스테이지)
// }
// ─────────────────────────────────────────────────────────────
export class GameManager {
  constructor(setup) {
    this.setup = setup;
    this.config = GAME_CONFIG;
    this.seed = setup.seed ?? Math.floor(Math.random() * 1e9);
    this.rng = new Rng(this.seed);
    this.events = [];

    this.mode = createModeRules(setup.mode || 'battle');
    const count = setup.players.length;
    if (count < this.mode.def.minPlayers || count > this.mode.def.maxPlayers) {
      throw new Error(`${this.mode.def.name} needs ${this.mode.def.minPlayers}-${this.mode.def.maxPlayers} players (got ${count})`);
    }

    this.stageDef = setup.stageDef || getStage(setup.stageId || 'lounge');
    this.grid = GridManager.fromStage(this.stageDef, this.rng);
    if (setup.spawn === 'random') {
      const spawns = pickRandomSpawns(this.grid, this.rng, Math.max(4, setup.players.length));
      if (spawns) this.grid.spawns = spawns;
      this.grid.version = 0;
    }
    this.players = new PlayerManager(this, setup.players);
    this.bombs = new BeatBombManager(this);
    this.waves = new SoundWaveManager(this);
    const dropTable = DROP_TABLES[setup.dropTable || 'standard'];
    const stageDrop = !setup.dropTable && this.stageDef.dropChance !== undefined ? { dropChance: this.stageDef.dropChance } : {};
    this.items = new ItemManager(this, { ...dropTable, ...stageDrop });
    this.stage = new StageManager(this, this.stageDef);
    this.house = new HouseEventManager(this, setup.houseEvents === false ? null : this.stageDef.houseEvents);

    this.time = 0; // 전체 경과 (카운트다운 포함)
    this.matchTime = 0; // 실제 경기 경과
    this.timeLimit = setup.timeLimit ?? this.mode.def.timeLimit;
    this.phase = setup.skipCountdown ? MATCH_PHASE.PLAYING : MATCH_PHASE.COUNTDOWN;
    this.countdown = setup.skipCountdown ? 0 : GAME_CONFIG.match.startCountdown;
    this._lastCountdownInt = Math.ceil(this.countdown);
    this.result = null;
    this.endedAt = null;
    this.tick = 0;
    if (this.phase === MATCH_PHASE.PLAYING) this.emit('matchStart', {});
  }

  get timeLeft() {
    return Math.max(0, this.timeLimit - this.matchTime);
  }

  // 경기 템포: 'early'(파밍) → 'mid'(교전) → 'late'(혼란)
  get tempo() {
    const t = GAME_CONFIG.tempo;
    if (this.matchTime < t.earlyUntil) return 'early';
    if (this.matchTime >= Math.min(t.lateFrom, this.timeLimit * 0.7)) return 'late';
    return 'mid';
  }

  // 스테이지 기믹 / House Event 의 다음 발생 간격 (후반에는 짧아진다)
  tempoInterval(base) {
    return this.tempo === 'late' ? base * GAME_CONFIG.tempo.lateIntervalScale : base;
  }

  emit(type, data = {}) {
    this.events.push({ ...data, type, t: this.time });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // 플레이어 이동 판정: 그리드 + 폭탄 (방금 놓은 폭탄은 빠져나갈 수 있음)
  isBlockedFor(player, x, y) {
    if (this.grid.isSolid(x, y)) return true;
    const b = this.bombs.at(x, y);
    if (b && !b.passable.has(player.id)) return true;
    return false;
  }

  onPlayerEnterCell(player, x, y) {
    if (this.phase !== MATCH_PHASE.PLAYING) return;
    this.stage.onPlayerEnterCell(player, x, y);
  }

  // intents: { [playerId]: intent }
  step(dt, intents = {}) {
    this.tick++;
    this.time += dt;

    if (this.phase === MATCH_PHASE.COUNTDOWN) {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this._lastCountdownInt) {
        this._lastCountdownInt = c;
        if (c > 0) this.emit('countdown', { value: c });
      }
      if (this.countdown <= 0) {
        this.phase = MATCH_PHASE.PLAYING;
        this.emit('matchStart', {});
      }
      // 카운트다운 중에도 연출용 애니메이션 상태 갱신
      for (const p of this.players.list) p.stateTime += dt;
      return;
    }

    if (this.phase === MATCH_PHASE.ENDED) {
      for (const p of this.players.list) p.stateTime += dt;
      this.waves.update();
      return;
    }

    this.matchTime += dt;

    this.players.update(dt, intents);
    this.bombs.update(dt);
    this.waves.update();
    this.items.update();
    this.stage.update(dt);
    this.house.update(dt);
    this.mode.update(dt, this);

    const res = this.mode.checkEnd(this) || (this.matchTime >= this.timeLimit ? this.mode.timeUp(this) : null);
    if (res) this.end(res);
  }

  end(result) {
    if (this.phase === MATCH_PHASE.ENDED) return;
    this.phase = MATCH_PHASE.ENDED;
    this.result = result;
    this.endedAt = this.time;
    this.players.setVictory(result.winnerIds);
    this.emit('matchEnd', { result });
  }

  getTelegraphs() {
    return [...this.stage.getTelegraphs(), ...this.house.getTelegraphs()];
  }
}
