import { GAME_CONFIG } from '../config/gameConfig.js';
import { BOMB_STATE, DIRS } from './constants.js';

const B = GAME_CONFIG.bomb;

// ─────────────────────────────────────────────────────────────
// Beat Bomb — 게임의 기본 공격 수단 (모든 캐릭터 동일)
//   PLACE → COUNT → DROP → SOUND WAVE → RESULT
// 논리 grid cell 에 설치. 동시 설치 수: activeBombs < player.maxBombs
// 설치 시점의 player.waveRange 를 range 로 기록한다.
// ─────────────────────────────────────────────────────────────
export class BeatBombManager {
  constructor(gm) {
    this.gm = gm;
    this.bombs = [];
    this.nextId = 1;
    this.fuseRate = 1; // DJ BOOTH Speaker Drop 등에서 카운트 속도 변경
  }

  // 지상에 놓인(비행 중이 아닌) 폭탄
  at(x, y) {
    for (const b of this.bombs) {
      if (!b.flying && b.x === x && b.y === y) return b;
    }
    return null;
  }

  countFor(playerId) {
    let n = 0;
    for (const b of this.bombs) if (b.ownerId === playerId) n++;
    return n;
  }

  canPlace(player) {
    if (!player.isActive) return false;
    if (player.activeBombs >= player.maxBombs) return false;
    const x = player.cellX;
    const y = player.cellY;
    if (this.gm.grid.isSolid(x, y)) return false;
    if (this.at(x, y)) return false;
    return true;
  }

  tryPlace(player) {
    if (!this.canPlace(player)) return null;
    const x = player.cellX;
    const y = player.cellY;
    const bomb = {
      id: this.nextId++,
      ownerId: player.id,
      x,
      y,
      range: player.waveRange,
      fuse: B.fuseTime,
      fuseTotal: B.fuseTime,
      state: BOMB_STATE.COUNT,
      passable: new Set(this.gm.players.at(x, y).map((p) => p.id)),
      motion: null,
      flying: false,
      placedAt: this.gm.time,
      chained: false,
    };
    this.bombs.push(bomb);
    player.activeBombs++;
    this.gm.emit('bombPlaced', { bombId: bomb.id, playerId: player.id, x, y, range: bomb.range });
    return bomb;
  }

  remove(bomb) {
    const i = this.bombs.indexOf(bomb);
    if (i < 0) return;
    this.bombs.splice(i, 1);
    const owner = this.gm.players.get(bomb.ownerId);
    if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);
  }

  // 즉시 발동 예약 (Remote / Chain Reaction / 해저드)
  trigger(bomb, delay = 0) {
    if (bomb.flying) return;
    if (bomb.fuse > delay) {
      bomb.fuse = delay;
      bomb.chained = delay > 0;
    }
  }

  blockedForBomb(x, y, self) {
    const { grid, players } = this.gm;
    if (grid.isSolid(x, y)) return true;
    const other = this.at(x, y);
    if (other && other !== self) return true;
    if (players.at(x, y).length > 0) return true;
    return false;
  }

  // Kick: 한 방향으로 미끄러짐
  kick(bomb, dir) {
    if (bomb.flying || bomb.motion) return false;
    const d = DIRS[dir];
    if (this.blockedForBomb(bomb.x + d.x, bomb.y + d.y, bomb)) return false;
    bomb.motion = { type: 'slide', dir, t: 0, step: 1 / B.kickSpeed, fromX: bomb.x, fromY: bomb.y, active: false };
    bomb.passable.clear();
    this.gm.emit('bombKicked', { bombId: bomb.id, dir });
    return true;
  }

  // Throw: 짧은 거리 던지기 (장애물 위로 날아감)
  throwBomb(bomb, dir, distance = B.throwDistance) {
    if (bomb.flying) return false;
    const d = DIRS[dir];
    const { grid } = this.gm;
    let tx = bomb.x + d.x * distance;
    let ty = bomb.y + d.y * distance;
    // 착지 칸이 막혀 있으면 계속 전진, 맵 밖이면 뒤로 탐색
    while (grid.inBounds(tx, ty) && this.blockedForBomb(tx, ty, bomb)) {
      tx += d.x;
      ty += d.y;
    }
    if (!grid.inBounds(tx, ty) || grid.isSolid(tx, ty)) {
      tx = bomb.x;
      ty = bomb.y;
      for (let s = distance - 1; s >= 1; s--) {
        const cx = bomb.x + d.x * s;
        const cy = bomb.y + d.y * s;
        if (!this.blockedForBomb(cx, cy, bomb)) {
          tx = cx;
          ty = cy;
          break;
        }
      }
      if (tx === bomb.x && ty === bomb.y) return false;
    }
    const dist = Math.abs(tx - bomb.x) + Math.abs(ty - bomb.y);
    bomb.motion = {
      type: 'fly',
      fromX: bomb.x,
      fromY: bomb.y,
      toX: tx,
      toY: ty,
      t: 0,
      dur: B.throwFlightTime * Math.max(1, dist / distance),
    };
    bomb.flying = true;
    bomb.passable.clear();
    this.gm.emit('bombThrown', { bombId: bomb.id, fromX: bomb.x, fromY: bomb.y, toX: tx, toY: ty });
    return true;
  }

  update(dt) {
    for (const b of this.bombs) {
      // 떠난 플레이어는 다시 폭탄 칸으로 들어올 수 없다
      if (b.passable.size) {
        for (const pid of b.passable) {
          const p = this.gm.players.get(pid);
          if (!p || p.cellX !== b.x || p.cellY !== b.y) b.passable.delete(pid);
        }
      }
      if (b.motion) this._updateMotion(b, dt);
      b.fuse -= dt * this.fuseRate;
      b.state = b.fuse <= B.dropTime ? BOMB_STATE.DROP : BOMB_STATE.COUNT;
    }
    // 폭발 처리 (Chain Reaction 은 chainDelay 후 다음 틱들에서 이어짐)
    for (let guard = 0; guard < 64; guard++) {
      const ready = this.bombs.find((b) => b.fuse <= 0 && !b.flying);
      if (!ready) break;
      this.gm.waves.explode(ready);
    }
  }

  _updateMotion(b, dt) {
    const m = b.motion;
    if (m.type === 'slide') {
      m.t += dt;
      if (!m.active) {
        // 다음 칸으로 출발
        const d = DIRS[m.dir];
        if (this.blockedForBomb(b.x + d.x, b.y + d.y, b)) {
          b.motion = null;
          this.gm.emit('bombStopped', { bombId: b.id, x: b.x, y: b.y });
          return;
        }
        m.fromX = b.x;
        m.fromY = b.y;
        b.x += d.x;
        b.y += d.y;
        m.active = true;
        m.t = 0;
      } else if (m.t >= m.step) {
        m.active = false;
        m.t -= m.step;
      }
    } else if (m.type === 'fly') {
      m.t += dt;
      if (m.t >= m.dur) {
        b.x = m.toX;
        b.y = m.toY;
        b.flying = false;
        b.motion = null;
        b.fuse = Math.max(b.fuse, B.minFuseAfterLanding);
        b.passable = new Set(this.gm.players.at(b.x, b.y).map((p) => p.id));
        this.gm.emit('bombLanded', { bombId: b.id, x: b.x, y: b.y });
      }
    }
  }

  // 렌더용 연속 좌표
  visualPosition(b) {
    const m = b.motion;
    if (!m) return { x: b.x, y: b.y, z: 0 };
    if (m.type === 'slide') {
      if (!m.active) return { x: b.x, y: b.y, z: 0 };
      const k = Math.min(1, m.t / m.step);
      return { x: m.fromX + (b.x - m.fromX) * k, y: m.fromY + (b.y - m.fromY) * k, z: 0 };
    }
    const k = Math.min(1, m.t / m.dur);
    return {
      x: m.fromX + (m.toX - m.fromX) * k,
      y: m.fromY + (m.toY - m.fromY) * k,
      z: Math.sin(k * Math.PI) * 1.4,
    };
  }
}
