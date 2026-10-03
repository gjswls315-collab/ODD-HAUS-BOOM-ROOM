import { GAME_CONFIG, speedLevelToCellsPerSecond } from '../config/gameConfig.js';
import { getCharacter } from '../config/characterConfig.js';
import { CharacterStats } from './CharacterStats.js';
import { DIRS, PLAYER_STATE } from './constants.js';

const S = PLAYER_STATE;

// ─────────────────────────────────────────────────────────────
// PlayerController — 모든 캐릭터가 사용하는 "단 하나의" 컨트롤러.
// 캐릭터별 Controller(VinController 등)는 만들지 않는다.
// 캐릭터 차이 = CharacterStats(데이터) + CharacterVisual(렌더 레이어) 뿐.
//
// intent = { dir: 'up'|'down'|'left'|'right'|null, bomb: bool, item: bool, pose?: 'lookAround'|'ready'|'dangerWait' }
//   (bomb / item 은 이번 틱에 눌렸는지 — edge trigger)
// 기본 조작은 이동 / Beat Bomb / Item 뿐. 대시 같은 공통 회피기는 없다 — 이동 속도는 SPEED · 아이템이 담당
// ─────────────────────────────────────────────────────────────
export class PlayerController {
  constructor({ id, slot, characterId, team = null, isBot = false, spawn, color }) {
    this.id = id;
    this.slot = slot;
    this.characterId = characterId;
    this.def = getCharacter(characterId);
    this.name = this.def.name;
    this.team = team;
    this.isBot = isBot;
    this.color = color;

    this.stats = new CharacterStats(this.def);
    // 아이템의 일시 효과 — 기본 Stats 와 분리 (ItemModifier)
    //   ROLLER SKATES: 일정 시간 SPEED 를 캐릭터 MAX + 1 레벨로 고정
    this.modifiers = { speedOverride: 0, speedOverrideTime: 0 };
    // 공용 능력 (그 판 동안 유지) — KICK / GLOVE / REMOTE. 캐릭터 전용 능력 아님
    this.abilities = { kick: false, glove: false, remote: false };
    this.heldItem = null; // 소모형 1칸: { type } — SHIELD / NEEDLE / ROLLER SKATES

    this.x = spawn.x;
    this.y = spawn.y;
    this.spawn = { ...spawn };
    this.facing = 'down';
    this.lastCellX = spawn.x;
    this.lastCellY = spawn.y;

    this.state = S.IDLE;
    this.stateTime = 0;
    this.pose = null;
    this.actionTimer = 0;
    this.moving = false;

    this.forced = null; // { dx, dy, remaining } 바람 / Rolling LP 등 강제 이동
    this.trap = null; // { time, maxTime, byId }
    this.invulnerable = 0;

    this.activeBombs = 0;
    this.score = 0;
    this.bonus = 0; // MAX BONUS (MAX 능력치 아이템을 먹은 횟수만큼)
    this.maxPickups = 0;
    this.eliminatedAt = null;
  }

  get cellX() {
    return Math.round(this.x);
  }
  get cellY() {
    return Math.round(this.y);
  }

  // ── 현재 능력치 (기본 Stats) ─────────────────────
  get maxBombs() {
    return this.stats.current.bomb;
  }
  get waveRange() {
    return this.stats.current.wave;
  }
  get speedLevel() {
    const base = this.modifiers.speedOverrideTime > 0 ? Math.max(this.modifiers.speedOverride, this.stats.current.speed) : this.stats.current.speed;
    return Math.min(base, GAME_CONFIG.speedAbsoluteCapLevel);
  }
  get moveSpeed() {
    return speedLevelToCellsPerSecond(this.speedLevel);
  }

  get isEliminated() {
    return this.state === S.ELIMINATED;
  }
  get isTrapped() {
    return this.state === S.TRAPPED;
  }
  // 이동 / 설치 / 아이템 사용이 가능한 상태
  get isActive() {
    return this.state !== S.TRAPPED && this.state !== S.ELIMINATED && this.state !== S.VICTORY;
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
  }

  // ─────────────────────────────────────────────────
  update(dt, intent, gm) {
    this.stateTime += dt;
    this.pose = intent.pose || null; // 대기 포즈 힌트 (렌더 전용 — 판정과 무관)
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.modifiers.speedOverrideTime > 0) {
      this.modifiers.speedOverrideTime -= dt;
      if (this.modifiers.speedOverrideTime <= 0) {
        this.modifiers.speedOverrideTime = 0;
        this.modifiers.speedOverride = 0;
        gm.emit('modifierEnd', { playerId: this.id, modifier: 'rollerSkates' });
      }
    }
    if (this.actionTimer > 0) this.actionTimer = Math.max(0, this.actionTimer - dt);

    if (this.state === S.ELIMINATED || this.state === S.VICTORY) return;

    // 강제 이동 (바람, Rolling LP 밀림) — 입력보다 우선
    if (this.forced) {
      const step = Math.min(this.forced.remaining, 9 * dt);
      this.x += this.forced.dx * step;
      this.y += this.forced.dy * step;
      this.forced.remaining -= step;
      if (this.forced.remaining <= 1e-6) {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.forced = null;
      }
      this._checkCellChange(gm);
      return;
    }

    if (this.state === S.TRAPPED) {
      this.trap.time += dt;
      // NEEDLE 보유 시 아이템 키로 직접 탈출
      if (intent.item && gm.items.useItemKey(this)) return;
      if (intent.dir && GAME_CONFIG.trap.trappedMoveSpeed > 0) {
        this.facing = intent.dir;
        this.moveAlong(intent.dir, GAME_CONFIG.trap.trappedMoveSpeed * dt, gm);
      }
      this._checkCellChange(gm);
      if (this.trap.time >= this.trap.maxTime) {
        gm.players.eliminate(this, this.trap.byId, 'timeout');
      }
      return;
    }

    if (this.state === S.RESCUED && this.stateTime > 0.6) this.setState(S.IDLE);

    // ── Beat Bomb 설치 (누른 순간 서 있던 칸에 설치되도록 이동보다 먼저) ──
    if (intent.bomb) {
      if (gm.bombs.tryPlace(this)) {
        this.actionTimer = GAME_CONFIG.actionAnimTime;
        this.setState(S.PLACE_BOMB);
      }
    }

    // ── 특수 아이템 사용 (공통 ItemManager 가 처리) ──
    if (intent.item) {
      if (intent.dir) this.facing = intent.dir;
      if (gm.items.useItemKey(this)) {
        this.actionTimer = GAME_CONFIG.actionAnimTime;
        this.setState(S.USE_ITEM);
      }
    }

    let moved = false;
    if (intent.dir) {
      this.facing = intent.dir;
      moved = this.moveAlong(intent.dir, this.moveSpeed * dt, gm);
    }
    this.moving = moved;
    this._checkCellChange(gm);

    // ── KICK: Bomb 에 몸이 닿은 채로 밀면 진행 방향으로 걷어참 ──
    if (this.abilities.kick && intent.dir) this._tryKick(intent.dir, gm);

    // ── 상태 결정 ──
    if (this.actionTimer > 0 && (this.state === S.PLACE_BOMB || this.state === S.USE_ITEM)) return;
    if (this.state === S.RESCUED) return;
    if (moved) this.setState(S.MOVE);
    else this.setState(S.IDLE);
  }

  _tryKick(dirName, gm) {
    const d = DIRS[dirName];
    const bomb = gm.bombs.at(this.cellX + d.x, this.cellY + d.y);
    if (!bomb || bomb.motion || bomb.passable.has(this.id)) return;
    // 칸 중앙까지 붙어 있고 옆으로 크게 어긋나지 않았을 때만
    const along = d.x !== 0 ? (this.cellX - this.x) * d.x : (this.cellY - this.y) * d.y;
    const off = d.x !== 0 ? Math.abs(this.y - this.cellY) : Math.abs(this.x - this.cellX);
    if (along > 0.08 || off > 0.3) return;
    if (gm.bombs.kick(bomb, dirName)) gm.emit('itemUsed', { playerId: this.id, itemType: 'kick' });
  }

  _checkCellChange(gm) {
    const cx = this.cellX;
    const cy = this.cellY;
    if (cx !== this.lastCellX || cy !== this.lastCellY) {
      this.lastCellX = cx;
      this.lastCellY = cy;
      gm.onPlayerEnterCell(this, cx, cy);
    }
  }

  // ─────────────────────────────────────────────────
  // 그리드 이동 + 코너 보정 (Crazy Arcade / Bomberman 방식)
  moveAlong(dirName, dist, gm) {
    const d = DIRS[dirName];
    let remaining = dist;
    let moved = false;
    for (let guard = 0; remaining > 1e-6 && guard < 12; guard++) {
      const consumed = this._moveStep(d, Math.min(remaining, 0.2), gm);
      if (consumed <= 1e-6) break;
      remaining -= consumed;
      moved = true;
    }
    return moved;
  }

  _moveStep(d, step, gm) {
    const horizontal = d.x !== 0;
    const s = horizontal ? d.x : d.y;
    const posMain = horizontal ? this.x : this.y;
    const posPerp = horizontal ? this.y : this.x;
    const cMain = Math.round(posMain);
    const cPerp = Math.round(posPerp);
    const off = posPerp - cPerp;

    const blockedAt = (main, lane) => (horizontal ? gm.isBlockedFor(this, main, lane) : gm.isBlockedFor(this, lane, main));
    const setMain = (v) => (horizontal ? (this.x = v) : (this.y = v));
    const setPerp = (v) => (horizontal ? (this.y = v) : (this.x = v));

    // 1) 내 라인 앞 칸이 열려 있으면: 라인 중앙으로 정렬하며 전진
    if (!blockedAt(cMain + s, cPerp)) {
      if (Math.abs(off) > 1e-4) {
        const a = Math.min(Math.abs(off), step);
        setPerp(posPerp - Math.sign(off) * a);
        const rest = step - a;
        if (rest > 0) setMain(posMain + s * rest);
        return step;
      }
      setMain(posMain + s * step);
      return step;
    }

    // 2) 앞이 막혀 있으면 현재 칸 중앙까지는 전진 가능
    const toCenter = (cMain - posMain) * s;
    if (toCenter > 1e-4) {
      const a = Math.min(toCenter, step);
      setMain(posMain + s * a);
      return a;
    }

    // 3) 코너 보정: 옆 라인 앞 칸이 열려 있으면 그쪽으로 미끄러짐
    if (Math.abs(off) >= 0.5 - GAME_CONFIG.movement.cornerAssist) {
      const lane2 = cPerp + Math.sign(off);
      if (!blockedAt(cMain, lane2) && !blockedAt(cMain + s, lane2)) {
        const a = Math.min(step, 0.5 - Math.abs(off) + 0.01);
        setPerp(posPerp + Math.sign(off) * a);
        return a;
      }
    } else if (Math.abs(off) <= 1e-4) {
      // 정확히 중앙: 한쪽 대각선만 열려 있을 때는 보정하지 않는다 (의도치 않은 이동 방지)
      return 0;
    }
    // 중앙으로 복귀
    if (Math.abs(off) > 1e-4) {
      const a = Math.min(Math.abs(off), step);
      setPerp(posPerp - Math.sign(off) * a);
      return 0; // 전진하지 않았으므로 반복 종료
    }
    return 0;
  }

  snapshot() {
    return {
      id: this.id,
      slot: this.slot,
      characterId: this.characterId,
      team: this.team,
      x: this.x,
      y: this.y,
      state: this.state,
      stats: this.stats.snapshot(),
      heldItem: this.heldItem ? { ...this.heldItem } : null,
      abilities: { ...this.abilities },
      activeBombs: this.activeBombs,
    };
  }
}
