import { KEY_PROFILES, GLOBAL_KEYS, GAMEPAD_MAP } from '../config/inputConfig.js';

// ─────────────────────────────────────────────────────────────
// InputManager — 키보드 / 게임패드 → intent
// 모든 플레이어 동일한 액션 세트: 이동 / bomb / item (캐릭터 전용 키 없음)
// 방향은 "가장 최근에 누른 키" 우선 (Crazy Arcade 감각).
// bomb / item 은 눌린 순간을 래치해 다음 시뮬레이션 틱에서 소비한다.
// ─────────────────────────────────────────────────────────────

const ACTIONS = ['bomb', 'item'];
const DIRS = ['up', 'down', 'left', 'right'];

export class InputManager {
  constructor() {
    this.down = new Map(); // code → press order
    this.counter = 0;
    this.latched = new Set(); // codes pressed since last consume
    this.assignments = []; // [{ playerId, profile, gamepad }]
    this.listeners = new Set();
    this.pads = new Map(); // index → { prevButtons }
    this.padLatched = new Map(); // `${index}:${action}`
    this.enabled = true;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', () => this.down.clear());
    this.gameKeys = new Set(Object.values(KEY_PROFILES).flatMap((p) => Object.values(p).flat()));
  }

  onKey(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (this.gameKeys.has(e.code) || GLOBAL_KEYS.pause.includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      this.down.set(e.code, ++this.counter);
      this.latched.add(e.code);
    }
    for (const fn of this.listeners) fn(e);
  }

  _onKeyUp(e) {
    this.down.delete(e.code);
  }

  // 터치 버튼 → 키보드와 같은 경로로 입력 (모든 캐릭터 동일 조작)
  virtualKey(code, isDown) {
    if (isDown) {
      if (this.down.has(code)) return;
      this.down.set(code, ++this.counter);
      this.latched.add(code);
      const fake = { code, repeat: false, target: null, preventDefault() {} };
      for (const fn of this.listeners) fn(fake);
    } else {
      this.down.delete(code);
    }
  }

  // playerId ↔ 키 프로필 / 게임패드 배정
  setAssignments(list) {
    this.assignments = list;
  }

  isDown(code) {
    return this.down.has(code);
  }

  // 메뉴용: 이 코드가 어떤 프로필의 어떤 액션인지
  static actionOf(code, profileName) {
    const prof = KEY_PROFILES[profileName];
    if (!prof) return null;
    for (const [action, codes] of Object.entries(prof)) if (codes.includes(code)) return action;
    return null;
  }

  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const prev = this.pads.get(pad.index) || { buttons: [] };
      const now = pad.buttons.map((b) => b.pressed);
      for (const action of ['bomb', 'item', 'pause']) {
        for (const bi of GAMEPAD_MAP[action]) {
          if (now[bi] && !prev.buttons[bi]) this.padLatched.set(`${pad.index}:${action}`, true);
        }
      }
      this.pads.set(pad.index, { buttons: now, pad });
    }
  }

  padPausePressed() {
    for (const k of this.padLatched.keys()) {
      if (k.endsWith(':pause')) {
        this.padLatched.delete(k);
        return true;
      }
    }
    return false;
  }

  _padDir(index) {
    const entry = this.pads.get(index);
    if (!entry) return null;
    const pad = entry.pad;
    const dz = GAMEPAD_MAP.deadzone;
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const b = entry.buttons;
    if (b[12]) return 'up';
    if (b[13]) return 'down';
    if (b[14]) return 'left';
    if (b[15]) return 'right';
    if (Math.abs(ax) < dz && Math.abs(ay) < dz) return null;
    if (Math.abs(ax) > Math.abs(ay)) return ax > 0 ? 'right' : 'left';
    return ay > 0 ? 'down' : 'up';
  }

  intentFor(playerId) {
    const a = this.assignments.find((x) => x.playerId === playerId);
    const intent = { dir: null, bomb: false, item: false };
    if (!a || !this.enabled) return intent;
    const prof = KEY_PROFILES[a.profile];
    if (prof) {
      let best = -1;
      for (const d of DIRS) {
        for (const code of prof[d]) {
          const order = this.down.get(code);
          if (order !== undefined && order > best) {
            best = order;
            intent.dir = d;
          }
        }
      }
      for (const act of ACTIONS) {
        if (prof[act].some((c) => this.latched.has(c))) intent[act] = true;
      }
    }
    if (a.gamepad !== undefined && a.gamepad !== null) {
      const pd = this._padDir(a.gamepad);
      if (pd) intent.dir = pd;
      for (const act of ACTIONS) if (this.padLatched.get(`${a.gamepad}:${act}`)) intent[act] = true;
    }
    return intent;
  }

  // 시뮬레이션 1틱에서 눌림 이벤트를 소비
  consume() {
    this.latched.clear();
    for (const k of [...this.padLatched.keys()]) if (!k.endsWith(':pause')) this.padLatched.delete(k);
  }
}
