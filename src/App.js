import { GameManager } from './core/GameManager.js';
import { BotBrain } from './core/ai/BotBrain.js';
import { MATCH_PHASE } from './core/constants.js';
import { GAME_CONFIG } from './config/gameConfig.js';
import { PLAYABLE_CHARACTER_IDS, isPlayable } from './config/characterConfig.js';
import { STAGES } from './config/stageConfig.js';
import { GLOBAL_KEYS } from './config/inputConfig.js';
import { GameRenderer } from './render/GameRenderer.js';
import { preloadCharacterModels } from './render/characters/CharacterVisual.js';
import { renderPortraits } from './render/PortraitRenderer.js';
import { InputManager } from './input/InputManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { UIManager } from './ui/UIManager.js';

const STEP = 1 / GAME_CONFIG.tickRate;
const DIR_ARROW = { up: '↑', down: '↓', left: '←', right: '→' };
const HOUSE_SUB = {
  furniturePush: '가구가 움직인다!',
  doorToggle: '문이 바뀐다!',
  lampOff: '불이 꺼진다!',
  blockSpawn: '상자가 떨어진다!',
};

// ─────────────────────────────────────────────────────────────
// App — 화면 흐름 + 메인 루프
//   Title(배경: CPU 데모 경기) → Character Select → Stage Select → Match → Result
// 시뮬레이션은 고정 틱(60Hz), 렌더는 rAF.
// ─────────────────────────────────────────────────────────────
export class App {
  constructor() {
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.renderer = new GameRenderer(document.getElementById('stage'));
    this.ui = new UIManager(document.getElementById('ui'), { input: this.input, audio: this.audio });
    this.state = 'boot';
    this.gm = null;
    this.bots = [];
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.mode = 'battle';
    this.lastSetup = null;
    this.lastSlots = {};
    this.lastStage = 'lounge';
    this.stats = {};
    this.resultShown = false;
    this.debug = false;
    this.fps = 60;
    this.input.onKey((e) => this._globalKey(e));
    window.addEventListener('pointerdown', () => {
      if (!this.audio.ctx) {
        this.audio.unlock();
        this.audio.startMusic();
      }
    });
  }

  async boot() {
    const ids = [...PLAYABLE_CHARACTER_IDS, 'mrOdd'];
    this.glbStatus = await preloadCharacterModels(ids);
    this.portraits = renderPortraits(ids);
    this.ui.setPortraits(this.portraits);
    document.getElementById('boot')?.classList.add('hide');
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    const params = new URLSearchParams(location.search);
    if (params.get('play')) this._quickStart(params);
    else this.goTitle();
  }

  // ?play=battle&stage=lounge&p=vin,cpu:picker&seed=1  (테스트 / 개발용 빠른 시작)
  _quickStart(params) {
    const mode = params.get('play') === 'team' ? 'team' : 'battle';
    const stageId = STAGES[params.get('stage')] ? params.get('stage') : 'lounge';
    const list = (params.get('p') || 'vin,cpu:picker').split(',');
    let humanCount = 0;
    const players = list.map((tok, i) => {
      const bot = tok.startsWith('cpu:');
      const id = bot ? tok.slice(4) : tok;
      if (!bot) humanCount++;
      return { slot: i, characterId: isPlayable(id) ? id : 'vin', bot, team: mode === 'team' ? (i % 2 === 0 ? 'A' : 'B') : undefined };
    });
    players.forEach((p) => {
      if (!p.bot) p.profile = humanCount === 1 ? 'solo' : `p${p.slot + 1}`;
    });
    this.mode = mode;
    this.lastStage = stageId;
    this.lastSetup = { mode, players };
    this.fixedSpawn = params.get('spawn') === 'fixed';
    this.startMatch({ seed: params.get('seed') ? Number(params.get('seed')) : undefined, skipCountdown: params.get('fast') === '1' });
  }

  _globalKey(e) {
    if (GLOBAL_KEYS.mute.includes(e.code)) {
      const m = this.audio.toggleMute();
      this.ui.banner?.(m ? 'MUTE' : 'SOUND ON', { ms: 700 });
    }
    if (GLOBAL_KEYS.debug.includes(e.code)) this.debug = !this.debug;
    if (GLOBAL_KEYS.minimap.includes(e.code) && this.state === 'match') this.ui.toggleMinimap();
    // 일시정지 토글은 여기서만 처리 (UI 메뉴는 ESC 를 처리하지 않음 → 중복 토글 방지)
    if (this.state === 'match' && GLOBAL_KEYS.pause.includes(e.code) && this.gm && this.gm.phase !== MATCH_PHASE.ENDED) {
      if (this.paused) this.resume();
      else this.pause();
    }
    // 첫 사용자 입력에서 오디오 시작 (브라우저 자동재생 정책)
    if (!this.audio.ctx) {
      this.audio.unlock();
      this.audio.startMusic();
    }
  }

  // ── 화면 전환 ───────────────────────────────────
  _startAttract() {
    const ids = PLAYABLE_CHARACTER_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    const gm = new GameManager({
      mode: 'battle',
      stageId: 'lounge',
      players: ids.map((id, i) => ({ slot: i, characterId: id, bot: true })),
      seed: Math.floor(Math.random() * 1e6),
      skipCountdown: true,
      spawn: 'random',
      startFill: true,
    });
    this._setMatch(gm, { hudTopPx: 0, dynamic: false, startArrows: false });
    this.attract = true;
  }

  goTitle() {
    this.state = 'title';
    this.paused = false;
    this._startAttract();
    this.renderer.focusOn(null);
    this.ui.showTitle({
      onMode: (mode) => this.goLobby(mode),
      onHowTo: () => this.ui.showHowTo(() => this.goTitle()),
      onWatch: () => this.startWatch(),
    });
    this.audio.setTempo(100);
    this.audio.startMusic();
  }

  // CPU 4명 관전 (키보드가 없는 기기에서도 게임을 확인할 수 있도록)
  startWatch() {
    const ids = PLAYABLE_CHARACTER_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    this.mode = 'battle';
    this.lastSetup = { mode: 'battle', players: ids.map((id, i) => ({ slot: i, characterId: id, bot: true })) };
    this.startMatch();
  }

  goLobby(mode) {
    this.mode = mode;
    this.state = 'lobby';
    if (!this.attract) this._startAttract();
    this.ui.showLobby({
      mode,
      previous: this.lastSlots[mode],
      onStart: (res) => {
        this.lastSetup = res;
        this.lastSlots[mode] = res.slots;
        this.goStageSelect();
      },
      onBack: () => this.goTitle(),
    });
  }

  goStageSelect() {
    this.state = 'stage';
    this.ui.showStageSelect({
      initial: this.lastStage,
      onConfirm: (id) => {
        this.lastStage = id;
        this.startMatch();
      },
      onBack: () => this.goLobby(this.mode),
    });
  }

  _setMatch(gm, opts) {
    this.gm = gm;
    this.bots = gm.players.list.filter((p) => p.isBot).map((p) => new BotBrain(p.id, { seed: gm.seed, skill: 0.78 }));
    this.renderer.setMatch(gm, opts);
    this.acc = 0;
  }

  startMatch({ seed, skipCountdown = false } = {}) {
    const setup = {
      mode: this.lastSetup.mode,
      stageId: this.lastStage,
      players: this.lastSetup.players.map((p) => ({ slot: p.slot, characterId: p.characterId, team: p.team, bot: p.bot })),
      seed: seed ?? Math.floor(Math.random() * 1e9),
      skipCountdown,
      spawn: this.fixedSpawn ? 'fixed' : 'random', // 매 경기 다른 시작 위치 (?spawn=fixed 로 고정 — 테스트용)
      startFill: !this.fixedSpawn, // 시작 BREAKABLE 보충
    };
    const gm = new GameManager(setup);
    this.attract = false;
    const touch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    const phone = window.innerWidth <= 700;
    const hasHuman = setup.players.some((p) => !p.bot);
    this._setMatch(gm, { hudTopPx: phone ? 132 : 96, bottomPx: touch && hasHuman ? 215 : 0 });
    let padIndex = 0;
    this.input.setAssignments(
      this.lastSetup.players
        .map((p, i) => (p.bot ? null : { playerId: i, profile: p.profile || 'solo', gamepad: padIndex++ }))
        .filter(Boolean),
    );
    this.stats = Object.fromEntries(gm.players.list.map((p) => [p.id, { bombs: 0, items: 0 }]));
    this.state = 'match';
    this.paused = false;
    this.resultShown = false;
    this.renderer.focusOn(null);
    this.ui.showHud(gm);
    this.audio.setTempo(100);
    this.audio.startMusic();
  }

  pause() {
    this.paused = true;
    this.ui.showPause({
      onResume: () => this.resume(),
      onRestart: () => this.startMatch(),
      onLobby: () => this.goLobby(this.mode),
      onTitle: () => this.goTitle(),
    });
  }

  resume() {
    this.paused = false;
    this.ui.hidePause();
    this.last = performance.now();
  }

  // ── 이벤트 → 사운드 / UI / 통계 ─────────────────
  _onEvents(events) {
    this.renderer.handleEvents(events);
    if (this.attract) return;
    const ui = this.ui;
    const au = this.audio;
    let boomed = false;
    for (const e of events) {
      switch (e.type) {
        case 'countdown':
          ui.countdown(e.value);
          au.sfx('countdown');
          break;
        case 'matchStart':
          ui.countdown('BOOM!');
          au.sfx('countdown', { go: true });
          break;
        case 'bombPlaced':
          au.sfx('place');
          if (this.stats[e.playerId]) this.stats[e.playerId].bombs++;
          break;
        case 'explosion':
          if (!boomed) au.sfx('boom');
          boomed = true;
          break;
        case 'pulse':
          au.sfx('pulse');
          break;
        case 'blockDestroyed':
          au.sfx('break');
          break;
        case 'itemPicked':
          au.sfx('pickup', { maxed: e.gained === 0 });
          if (this.stats[e.playerId]) this.stats[e.playerId].items++;
          break;
        case 'itemUsed':
          au.sfx('item');
          break;
        case 'itemFailed':
          au.sfx('fail');
          break;
        case 'shieldBlock':
          au.sfx('item');
          break;
        case 'dash':
          au.sfx('dash');
          break;
        case 'playerTrapped':
          au.sfx('trap');
          break;
        case 'playerRescued':
          au.sfx('rescue');
          break;
        case 'playerEliminated':
          au.sfx('pop');
          break;
        case 'houseEvent':
          if (e.phase === 'warn') {
            ui.banner('MR. ODD IS COMING!', { sub: HOUSE_SUB[e.kind] || '', color: '#ff7136', ms: 2400 });
            au.sfx('house');
          }
          break;
        case 'hazardWarn':
          ui.banner('ROLLING LP!', { sub: `${e.dir > 0 ? '→' : '←'} 가운데 통로 주의`, color: '#ffd166' });
          au.sfx('warn');
          break;
        case 'speakerDropWarn':
          ui.banner('SPEAKER DROP!', { sub: 'Beat Bomb 카운트 가속', color: '#b46bff' });
          au.sfx('warn');
          break;
        case 'speakerDropStart':
          au.setTempo(132);
          break;
        case 'speakerDropEnd':
          au.setTempo(100);
          break;
        case 'windWarn':
          ui.banner(`WIND ${DIR_ARROW[e.dir]}`, { sub: '돌풍이 분다 — 한 칸 밀림', color: '#bfe6ff' });
          au.sfx('warn');
          break;
        case 'recOn':
          ui.banner('● REC', { sub: '올라온 장비 라인에 Sound Pulse', color: '#ff3b4f' });
          au.sfx('warn');
          break;
        case 'doorsToggled':
          if (e.source !== 'houseEvent') ui.banner('DOORS!', { ms: 900, color: '#ffb35c' });
          break;
        case 'routeOpened':
          ui.banner('NEW ROUTE!', { ms: 1100, color: '#ffd166' });
          break;
        case 'gatesToggled':
          ui.banner('SWITCH!', { sub: '장비가 오르내린다 — 벽 ↔ 통로', ms: 1100, color: '#ff3b4f' });
          au.sfx('warn');
          break;
        case 'matchEnd':
          au.sfx('victory');
          break;
        default:
          break;
      }
    }
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
    this.input.pollGamepads();
    if (this.state === 'match' && this.input.padPausePressed() && this.gm?.phase !== MATCH_PHASE.ENDED) {
      if (this.paused) this.resume();
      else this.pause();
    }
    const gm = this.gm;
    if (gm && !this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        const intents = {};
        for (const a of this.input.assignments) intents[a.playerId] = this.input.intentFor(a.playerId);
        for (const b of this.bots) intents[b.playerId] = b.update(gm, STEP);
        gm.step(STEP, intents);
        this.input.consume();
        this.acc -= STEP;
        steps++;
      }
      if (steps === 6) this.acc = 0;
      const events = gm.drainEvents();
      if (events.length) this._onEvents(events);

      if (gm.phase === MATCH_PHASE.ENDED) {
        if (this.attract) {
          if (gm.time - gm.endedAt > 3) this._startAttract();
        } else if (!this.resultShown) {
          this.renderer.focusOn(gm.result.winnerIds);
          if (gm.time - gm.endedAt > GAME_CONFIG.match.resultDelay) {
            this.resultShown = true;
            this.ui.showResult(gm, this.stats, {
              onRematch: () => this.startMatch(),
              onLobby: () => this.goLobby(this.mode),
              onTitle: () => this.goTitle(),
            });
          }
        }
      }
    }
    if (this.state === 'match' && gm) this.ui.updateHud(gm, { view: this.renderer.viewRect });
    this.renderer.render(dt, { beat: this.audio.beat() });
    if (this.debug) this._debugOverlay();
    else if (this._debugEl) {
      this._debugEl.remove();
      this._debugEl = null;
    }
  }

  _debugOverlay() {
    if (!this._debugEl) {
      this._debugEl = document.createElement('div');
      this._debugEl.className = 'debug';
      document.getElementById('ui').appendChild(this._debugEl);
    }
    const gm = this.gm;
    if (!gm) return;
    const lines = [`FPS ${this.fps.toFixed(0)}  tick ${gm.tick}  t ${gm.matchTime.toFixed(1)}  seed ${gm.seed}`, `stage ${gm.stageDef.id}  bombs ${gm.bombs.bombs.length}  items ${gm.items.items.length}  house ${gm.house.phase}`];
    for (const p of gm.players.list) {
      const s = p.stats.current;
      const m = p.stats.max;
      lines.push(`${p.name.padEnd(7)} ${p.state.padEnd(10)} SPD ${s.speed}/${m.speed} (lv ${p.speedLevel}, ${p.moveSpeed.toFixed(1)}c/s)  BOMB ${p.activeBombs}/${s.bomb}/${m.bomb}  WAVE ${s.wave}/${m.wave}  item ${p.heldItem ? p.heldItem.type + 'x' + p.heldItem.charges : '-'}`);
    }
    lines.push(`GLB: ${Object.entries(this.glbStatus || {}).map(([k, v]) => `${k}:${v ? 'GLB' : '3D'}`).join(' ')}`);
    this._debugEl.textContent = lines.join('\n');
  }
}
