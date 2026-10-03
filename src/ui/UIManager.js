import { CHARACTERS, PLAYABLE_CHARACTER_IDS, NON_PLAYABLE_CHARACTERS, STAT_KEYS, STAT_DISPLAY_SLOTS } from '../config/characterConfig.js';
import { STAGES, STAGE_ORDER, legendFor, CELL } from '../config/stageConfig.js';
import { ITEM_TYPES } from '../config/itemConfig.js';
import { KEY_LABELS } from '../config/inputConfig.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { MODES } from '../core/modes.js';
import { InputManager } from '../input/InputManager.js';
import { itemIconDataURL } from '../render/textures.js';

// ─────────────────────────────────────────────────────────────
// UIManager — 화면(DOM 오버레이)
//   Title / Character Select(START·MAX 비교) / Stage Select / HUD / Pause / Result / How to Play
// 캐릭터 스킬 UI(스킬 게이지, Q 스킬, 쿨다운 아이콘)는 존재하지 않는다.
// ─────────────────────────────────────────────────────────────

const STAT_LABEL = { speed: 'SPEED', bomb: 'BOMB', wave: 'WAVE' };
const ROSTER = [...PLAYABLE_CHARACTER_IDS, 'mrOdd'];
const SLOT_COLORS = GAME_CONFIG.playerColors;
const TEAM_PRESETS = [
  ['A', 'B', 'A', 'B'],
  ['A', 'A', 'B', 'B'],
  ['A', 'B', 'B', 'A'],
];

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function pips(n, cls, total = STAT_DISPLAY_SLOTS) {
  let s = '<span class="pips">';
  for (let i = 0; i < total; i++) s += `<i class="pip ${i < n ? cls : ''}"></i>`;
  return s + '</span>';
}

// 선택 화면: START → MAX
export function startMaxLine(def, k) {
  return `<div class="statline"><span>${STAT_LABEL[k]}</span>${pips(def[k].start, 'on')}<span class="arrow">→</span>${pips(def[k].max, 'max')}<span class="num">${def[k].start}→${def[k].max}</span></div>`;
}

// HUD: 현재값 / 캐릭터 MAX / 그 이상은 잠김
function hudPips(cur, max) {
  let s = '<span class="pips">';
  for (let i = 0; i < STAT_DISPLAY_SLOTS; i++) s += `<i class="pip ${i < cur ? 'on' : i < max ? 'cap' : 'lock'}"></i>`;
  return s + '</span>';
}

const fmtTime = (s) => {
  const t = Math.ceil(s);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export class UIManager {
  constructor(root, { input, audio }) {
    this.root = root;
    this.input = input;
    this.audio = audio;
    this.portraits = {};
    this.icons = {};
    this.keyHandler = null;
    this.layers = {};
    this.hud = null;
    input.onKey((e) => {
      if (this.keyHandler) this.keyHandler(e);
    });
  }

  setPortraits(p) {
    this.portraits = p;
    for (const [id, def] of Object.entries(ITEM_TYPES)) this.icons[id] = itemIconDataURL(id, def.color);
  }

  _layer(name, node) {
    this.clearLayer(name);
    this.layers[name] = node;
    this.root.appendChild(node);
    return node;
  }

  clearLayer(name) {
    if (this.layers[name]) {
      this.layers[name].remove();
      delete this.layers[name];
    }
  }

  clearAll() {
    for (const k of Object.keys(this.layers)) this.clearLayer(k);
    this.keyHandler = null;
    this.hud = null;
  }

  // 메뉴 키보드 내비게이션 (모든 키 프로필 공통 방향키 + Enter/Space)
  _menuNav(buttons, { onBack, cols = 1, initial = 0 } = {}) {
    let i = initial;
    const focus = () => buttons.forEach((b, j) => b.classList.toggle('focus', j === i));
    focus();
    buttons.forEach((b, j) => b.addEventListener('mouseenter', () => {
      i = j;
      focus();
    }));
    this.keyHandler = (e) => {
      const act = navAction(e.code);
      if (act === 'up') i = (i - cols + buttons.length) % buttons.length;
      else if (act === 'down') i = (i + cols) % buttons.length;
      else if (act === 'left' && cols > 1) i = (i - 1 + buttons.length) % buttons.length;
      else if (act === 'right' && cols > 1) i = (i + 1) % buttons.length;
      else if (act === 'confirm') {
        buttons[i].click();
        return;
      } else if (act === 'back' && onBack) {
        onBack();
        return;
      } else return;
      this.audio.sfx('ui');
      focus();
    };
  }

  // ── TITLE ──────────────────────────────────────
  showTitle({ onMode, onHowTo, onWatch }) {
    this.clearAll();
    const modeBtns = ['item', 'houseEvent', 'coop', 'custom'].map((m) => `<button class="btn disabled" data-soon="${m}">${MODES[m].name}<span class="soon">SOON</span></button>`).join('');
    const node = this._layer(
      'screen',
      el(`<div class="screen title-screen">
        <div class="title-left">
          <div class="logo"><span class="l1">ODD HAUS</span><span class="l2">BOOM ROOM</span><span class="l3">Music Makes Mischief!</span></div>
          <div class="tagline">작은 친구들의 음악 폭탄 대소동!<br>ODD HAUS의 거대한 집을 무대로 <b>Beat Bomb</b>을 설치하고,<br>아이템으로 성장해 상대를 <b>Sound Capsule</b>에 가두세요.</div>
          <div><span class="pill">3D PARTY ACTION</span><span class="pill">LOCAL MULTI</span><span class="pill">2-4 PLAYERS</span></div>
          <div class="menu">
            <button class="btn" data-go="battle">BATTLE MODE<small>2~4인 개인전 · 마지막까지 살아남기</small></button>
            <button class="btn" data-go="team">TEAM MODE<small>2 VS 2 · 갇힌 팀원을 구출</small></button>
            <button class="btn" data-go="howto">HOW TO PLAY<small>조작법 · 규칙 · 아이템</small></button>
            <button class="btn" data-go="watch">WATCH CPU MATCH<small>CPU 4명 관전 · 키보드 없이 구경하기</small></button>
            <div class="menu-row">${modeBtns}</div>
          </div>
          <div class="title-footer">SPACE / ENTER 또는 클릭·탭으로 선택 · M 음소거 · 모든 캐릭터 동일 조작 — 차이는 SPEED · BOMB · WAVE 성장치</div>
        </div>
        <div class="title-right">
          <div class="core-card"><h4>핵심 규칙 — Simple Rules. Different Stats. Same Chaos.</h4>
            <div class="core-grid">
              <div><span>🕹️</span>같은 조작</div><div><span>🎵</span>Beat Bomb</div><div><span>⬆️</span>아이템 성장</div><div><span>🫧</span>상대 포획</div>
            </div>
          </div>
        </div>
      </div>`),
    );
    const btns = [...node.querySelectorAll('.menu > .btn')];
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.sfx('confirm');
        const go = b.dataset.go;
        if (go === 'howto') onHowTo();
        else if (go === 'watch') onWatch();
        else onMode(go);
      }),
    );
    this._menuNav(btns, {});
  }

  // ── HOW TO PLAY ────────────────────────────────
  showHowTo(onClose) {
    const items = Object.values(ITEM_TYPES)
      .map((d) => `<div><img src="${this.icons[d.id]}" alt=""><span><b>${d.label}</b><small>${d.desc}</small></span></div>`)
      .join('');
    const prevHandler = this.keyHandler;
    const node = this._layer(
      'overlay',
      el(`<div class="screen overlay howto"><div class="box panel">
        <h2>HOW TO PLAY</h2>
        <div class="cols">
          <div>
            <h3>핵심 규칙 — 모든 캐릭터 동일</h3>
            <ol>
              <li><b>이동</b> — 모두 같은 4방향 이동</li>
              <li><b>Beat Bomb 설치</b> — 내 칸에 설치, 카운트 후 Sound Wave 발생</li>
              <li><b>Sound Wave</b> — 상하좌우 십자. 가구(SOLID)에서 멈추고, 상자(BREAKABLE)는 부수고 멈춤. 다른 폭탄을 만나면 연쇄 폭발</li>
              <li><b>포획</b> — Wave 에 맞으면 약 4초 동안 Sound Capsule 에 갇힘. 팀원이 닿으면 구출(+1초 무적), 상대가 닿으면 FINISH, NEEDLE 이 있으면 E 로 탈출</li>
              <li><b>성장</b> — 상자에서 나온 아이템으로 SPEED · BOMB · WAVE 상승 (캐릭터 MAX 까지)</li>
            </ol>
            <h3>캐릭터 차이 = 능력치뿐</h3>
            <p class="hint">캐릭터 전용 스킬은 없습니다. 캐릭터마다 SPEED · BOMB · WAVE 의 <b>시작값</b>과 <b>최대값</b>(5칸 척도)만 다릅니다.</p>
            <h3>아이템 키 E (하나로 모두)</h3>
            <p class="hint">갇혔을 때 NEEDLE 탈출 → GLOVE 로 옆 Bomb 던지기 → ROLLER SKATES 가속 → REMOTE 로 가장 오래된 Bomb 발동. KICK 은 Bomb 에 몸이 닿으면 자동. KICK·GLOVE·REMOTE 는 획득하면 그 판 동안 유지됩니다.</p>
          </div>
          <div>
            <h3>조작 (모든 캐릭터 공통)</h3>
            <div class="ctl">
              <span><span class="key">WASD</span><span class="key">←↑↓→</span></span><span>이동</span>
              <span><span class="key">SPACE</span></span><span>Beat Bomb 설치</span>
              <span><span class="key">E</span></span><span>특수 아이템 사용</span>
              <span><span class="key">N</span></span><span>미니맵 켜기/끄기 (터치: 타이머 탭)</span>
              <span><span class="key">ESC</span></span><span>Pause</span>
            </div>
            <p class="hint">로컬 멀티: P1 WASD/SPACE/L-SHIFT/E · P2 방향키/ENTER/R-SHIFT/ / · P3 IJKL/U/Y/O · P4 NUM8456/NUM7/NUM1/NUM9 · 게임패드 A 폭탄 · B 아이템 · X/RB 대시</p>
          </div>
        </div>
        <h3>아이템</h3>
        <div class="items-list">${items}</div>
        <div style="margin-top:14px"><button class="btn" data-close style="text-align:center">닫기 (ESC)</button></div>
      </div></div>`),
    );
    const close = () => {
      this.clearLayer('overlay');
      this.keyHandler = prevHandler;
      onClose?.();
    };
    node.querySelector('[data-close]').addEventListener('click', close);
    this.keyHandler = (e) => {
      const a = navAction(e.code);
      if (a === 'back' || a === 'confirm') close();
    };
  }

  // ── CHARACTER SELECT (LOBBY) ───────────────────
  showLobby({ mode, previous, onStart, onBack }) {
    this.clearAll();
    const def = MODES[mode];
    const team = def.team;
    const slots =
      previous ||
      [0, 1, 2, 3].map((i) => ({
        type: i === 0 ? 'human' : team || i === 1 ? 'cpu' : 'off',
        characterId: PLAYABLE_CHARACTER_IDS[[0, 1, 2, 4][i]],
        cursor: [0, 1, 2, 4][i],
        ready: i !== 0,
        team: TEAM_PRESETS[0][i],
      }));
    if (team) {
      for (const s of slots) if (s.type === 'off') s.type = 'cpu';
    }
    for (const s of slots) if (s.type === 'human') s.ready = false;
    let teamPreset = 0;

    const node = this._layer(
      'screen',
      el(`<div class="screen lobby">
        <div class="lobby-head"><h2>CHARACTER SELECT</h2><span class="sub">${def.name} — 모두 같은 조작법, 다른 능력치! (START → MAX)</span><span class="right hint"><span class="key">ESC</span>뒤로</span></div>
        <div class="roster"></div>
        <div>
          <div class="slots"></div>
          <div class="lobby-foot" style="margin-top:10px">
            <span>각자 이동키로 고르고 <b>폭탄 키</b>로 READY · 아이템/대시 키로 취소</span>
            <span><span class="key">2</span><span class="key">3</span><span class="key">4</span> 슬롯 HUMAN/CPU/OFF</span>
            ${team ? '<span><span class="key">T</span> 팀 배치 변경</span>' : ''}
            <button class="btn go">START ▶</button>
          </div>
        </div>
      </div>`),
    );
    const rosterEl = node.querySelector('.roster');
    const slotsEl = node.querySelector('.slots');
    const goBtn = node.querySelector('.go');

    const humans = () => slots.map((s, i) => ({ s, i })).filter((o) => o.s.type === 'human');
    const profileFor = (i) => (humans().length === 1 ? 'solo' : `p${i + 1}`);
    const active = () => slots.filter((s) => s.type !== 'off');
    const canStart = () => {
      const a = active();
      if (a.length < def.minPlayers || a.length > def.maxPlayers) return false;
      if (team) {
        const ca = a.filter((s) => s.team === 'A').length;
        if (ca !== 2) return false;
      }
      return a.every((s) => s.ready) && humans().length > 0;
    };

    const renderRoster = () => {
      rosterEl.innerHTML = '';
      ROSTER.forEach((id, idx) => {
        const locked = id === 'mrOdd';
        const c = locked ? NON_PLAYABLE_CHARACTERS.mrOdd : CHARACTERS[id];
        const cursors = slots
          .map((s, i) => ({ s, i }))
          .filter((o) => o.s.type === 'human' && o.s.cursor === idx)
          .map((o) => `<span class="cur" style="background:${SLOT_COLORS[o.i]}">${o.i + 1}P</span>`)
          .join('');
        const card = el(`<div class="ccard ${locked ? 'locked' : ''}" data-idx="${idx}">
          <div class="cursors">${cursors}</div>
          <img src="${this.portraits[id] || ''}" alt="${c.name}">
          <div class="nm">${c.name}</div>
          <div class="tg">${c.tagline}${c.label ? ` · ${c.label}` : ''}</div>
          ${locked ? '<div class="lockmsg">🔒 플레이 불가 — House Event 전용<br>경기 중 MR. ODD IS COMING!</div>' : `<div class="stats">${STAT_KEYS.map((k) => startMaxLine(c, k)).join('')}</div>`}
        </div>`);
        card.addEventListener('click', () => {
          this.audio.unlock();
          const h = humans().find((o) => !o.s.ready) || humans()[0];
          if (!h) return;
          if (locked) {
            card.classList.add('shake');
            this.audio.sfx('fail');
            return;
          }
          h.s.cursor = idx;
          h.s.characterId = id;
          h.s.ready = true;
          this.audio.sfx('confirm');
          render();
        });
        rosterEl.appendChild(card);
      });
    };

    const renderSlots = () => {
      slotsEl.innerHTML = '';
      slots.forEach((s, i) => {
        const c = CHARACTERS[s.characterId];
        const keys = s.type === 'human' ? KEY_LABELS[profileFor(i)] : null;
        const teamBadge = team && s.type !== 'off' ? `<span class="team" style="background:${GAME_CONFIG.teamColors[s.team]};color:#0b0b0b">TEAM ${GAME_CONFIG.teamNames[s.team]}</span>` : '';
        const card = el(`<div class="slot ${s.type === 'off' ? 'off' : ''} ${s.ready && s.type !== 'off' ? 'ready' : ''}" style="border-color:${s.type === 'off' ? '' : SLOT_COLORS[i]}">
          ${s.type === 'off' ? '<div></div>' : `<img src="${this.portraits[s.characterId] || ''}" alt="">`}
          <div class="who"><span class="tag" style="background:${SLOT_COLORS[i]}">${i + 1}P</span>${teamBadge}<span class="type" data-type>${s.type.toUpperCase()}</span></div>
          <div class="cname">${s.type === 'off' ? '—' : c.name}</div>
          <div class="keys">${s.type === 'off' ? '참가 안 함' : keys ? `${keys.move} · 폭탄 ${keys.bomb} · 아이템 ${keys.item}` : `CPU · ${c.tagline}`}</div>
          <div class="state">${s.type === 'off' ? '' : s.ready ? 'READY!' : '선택 중…'}</div>
        </div>`);
        card.querySelector('[data-type]').addEventListener('click', () => cycleType(i));
        card.querySelector('.team')?.addEventListener('click', () => {
          s.team = s.team === 'A' ? 'B' : 'A';
          render();
        });
        if (s.type === 'cpu') {
          card.querySelector('img')?.addEventListener('click', () => {
            const n = (PLAYABLE_CHARACTER_IDS.indexOf(s.characterId) + 1) % PLAYABLE_CHARACTER_IDS.length;
            s.characterId = PLAYABLE_CHARACTER_IDS[n];
            render();
          });
        }
        slotsEl.appendChild(card);
      });
      goBtn.classList.toggle('disabled', !canStart());
    };

    const render = () => {
      renderRoster();
      renderSlots();
    };

    const cycleType = (i) => {
      if (i === 0) return; // P1 은 항상 사람
      const s = slots[i];
      const order = team ? ['cpu', 'human'] : ['cpu', 'human', 'off'];
      s.type = order[(order.indexOf(s.type) + 1) % order.length];
      s.ready = s.type === 'cpu';
      if (s.type === 'cpu') s.characterId = PLAYABLE_CHARACTER_IDS[Math.floor(Math.random() * PLAYABLE_CHARACTER_IDS.length)];
      this.audio.sfx('ui');
      render();
    };

    const start = () => {
      if (!canStart()) {
        this.audio.sfx('fail');
        return;
      }
      this.audio.sfx('confirm');
      const players = [];
      slots.forEach((s, i) => {
        if (s.type === 'off') return;
        players.push({ slot: i, characterId: s.characterId, team: team ? s.team : undefined, bot: s.type === 'cpu', profile: s.type === 'human' ? profileFor(i) : null });
      });
      onStart({ mode, players, slots: slots.map((s) => ({ ...s })) });
    };
    goBtn.addEventListener('click', start);

    this.keyHandler = (e) => {
      if (e.code === 'Escape') return onBack();
      if (e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') return cycleType(Number(e.code.slice(5)) - 1);
      if (team && e.code === 'KeyT') {
        teamPreset = (teamPreset + 1) % TEAM_PRESETS.length;
        slots.forEach((s, i) => (s.team = TEAM_PRESETS[teamPreset][i]));
        this.audio.sfx('ui');
        return render();
      }
      for (const { s, i } of humans()) {
        const act = InputManager.actionOf(e.code, profileFor(i));
        if (!act) continue;
        if (['up', 'down', 'left', 'right'].includes(act)) {
          if (s.ready) continue;
          const cols = 4;
          const n = ROSTER.length;
          if (act === 'left') s.cursor = (s.cursor - 1 + n) % n;
          if (act === 'right') s.cursor = (s.cursor + 1) % n;
          if (act === 'up') s.cursor = (s.cursor - cols + n) % n;
          if (act === 'down') s.cursor = (s.cursor + cols) % n;
          if (ROSTER[s.cursor] !== 'mrOdd') s.characterId = ROSTER[s.cursor];
          this.audio.sfx('ui');
          render();
        } else if (act === 'bomb') {
          if (s.ready) {
            if (canStart()) return start();
            continue;
          }
          if (ROSTER[s.cursor] === 'mrOdd') {
            rosterEl.children[s.cursor]?.classList.add('shake');
            this.audio.sfx('fail');
            continue;
          }
          s.characterId = ROSTER[s.cursor];
          s.ready = true;
          this.audio.sfx('confirm');
          render();
        } else if (act === 'item') {
          if (s.ready) {
            s.ready = false;
            this.audio.sfx('ui');
            render();
          }
        }
      }
      if (e.code === 'Enter' && canStart() && humans().length === 1) start();
    };
    render();
  }

  // ── STAGE SELECT ───────────────────────────────
  showStageSelect({ initial = 'lounge', onConfirm, onBack }) {
    this.clearAll();
    const node = this._layer(
      'screen',
      el(`<div class="screen stage-select">
        <div class="lobby-head"><h2>STAGE SELECT</h2><span class="sub">ODD HAUS 의 6개 공간 — 모든 기믹은 누구나 동일하게 사용</span><span class="right hint"><span class="key">ESC</span>뒤로</span></div>
        <div class="stage-grid"></div>
        <div class="lobby-foot"><span>방향키로 선택 · SPACE / ENTER 시작</span></div>
      </div>`),
    );
    const grid = node.querySelector('.stage-grid');
    const cards = STAGE_ORDER.map((id) => {
      const s = STAGES[id];
      const card = el(`<div class="scard"><canvas width="340" height="260"></canvas>
        <div class="info"><div class="sn"><span>${s.no}</span><b>${s.name}</b></div><div class="ss">${s.subtitle}</div><p>${s.desc}</p></div></div>`);
      drawMinimap(card.querySelector('canvas'), s);
      card.addEventListener('click', () => {
        this.audio.sfx('confirm');
        onConfirm(id);
      });
      grid.appendChild(card);
      return card;
    });
    this._menuNav(cards, { onBack, cols: 3, initial: Math.max(0, STAGE_ORDER.indexOf(initial)) });
  }

  // ── HUD ────────────────────────────────────────
  showHud(gm, { showControls = true } = {}) {
    this.clearLayer('screen');
    this.clearLayer('overlay');
    this.keyHandler = null;
    const node = this._layer(
      'hud',
      el(`<div class="screen hud passthrough">
        <div class="hud-top"><div class="hud-side left"></div><div class="timer"><b>${fmtTime(gm.timeLeft)}</b><small>${gm.stageDef.name}</small></div><div class="hud-side right"></div></div>
        ${showControls && gm.players.list.some((p) => !p.isBot) ? `<div class="hud-controls"><span class="key">${hudMoveLabel(gm)}</span>이동 <span class="key">SPACE</span>Beat Bomb <span class="key">E</span>Item <span class="key">N</span>Map <span class="key">ESC</span>Pause</div>` : ''}
      </div>`),
    );
    const left = node.querySelector('.hud-side.left');
    const right = node.querySelector('.hud-side.right');
    const cards = gm.players.list.map((p, i) => {
      const c = el(`<div class="pcard" style="border-color:${p.color}88">
        <div class="por" style="border-color:${p.color}"><img src="${this.portraits[p.characterId] || ''}" alt=""></div>
        <div class="top"><span class="tag" style="background:${p.color}">${p.isBot ? 'CPU' : `${p.slot + 1}P`}</span>${p.name}<span class="st">ACTIVE</span></div>
        <div class="held"></div>
        <div class="rows"></div>
      </div>`);
      (i < Math.ceil(gm.players.list.length / 2) ? left : right).appendChild(c);
      return { el: c, key: '' };
    });
    this.hud = { node, cards, timer: node.querySelector('.timer'), timerB: node.querySelector('.timer b'), controls: node.querySelector('.hud-controls'), born: performance.now() };
    this._minimap(node, gm);
    if (isTouchDevice() && gm.players.list.some((p) => !p.isBot)) this._touchControls(node);
    else if (isTouchDevice()) this._touchPause(node);
  }

  // 터치 조작 — P1 키 프로필과 같은 코드로 입력 (캐릭터 전용 버튼 없음)
  _touchControls(node) {
    const pad = el(`<div class="touch">
      <div class="dpad">
        <button data-k="KeyW" class="up" aria-label="위">▲</button>
        <button data-k="KeyA" class="left" aria-label="왼쪽">◀</button>
        <button data-k="KeyD" class="right" aria-label="오른쪽">▶</button>
        <button data-k="KeyS" class="down" aria-label="아래">▼</button>
      </div>
      <div class="acts">
        <button data-k="KeyE" class="item">ITEM</button>
        <button data-k="Space" class="bomb">BOMB</button>
      </div>
      <button data-k="Escape" class="tpause" aria-label="일시정지">II</button>
    </div>`);
    for (const b of pad.querySelectorAll('button')) {
      const code = b.dataset.k;
      const down = (e) => {
        e.preventDefault();
        try {
          b.setPointerCapture?.(e.pointerId);
        } catch {
          /* 일부 브라우저: 캡처 불가 — 무시 */
        }
        b.classList.add('on');
        this.input.virtualKey(code, true);
      };
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('on');
        this.input.virtualKey(code, false);
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    node.appendChild(pad);
    this.hud.controls?.remove();
    this.hud.controls = null;
  }

  _touchPause(node) {
    const b = el('<div class="touch"><button data-k="Escape" class="tpause" aria-label="일시정지">II</button></div>');
    b.querySelector('button').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.virtualKey('Escape', true);
      this.input.virtualKey('Escape', false);
    });
    node.appendChild(b);
    this.hud.controls?.remove();
    this.hud.controls = null;
  }

  // ── MINIMAP (선택) — 큰 맵에서 화면 밖 상황 확인. N 키 / 터치: 타이머 탭 ──
  _minimap(node, gm) {
    // 17×15 이하: 고정 카메라로 아레나 전체가 보이므로 기본 꺼짐
    // 그보다 큰 맵(TERRACE · LOCKED ROOM): 카메라가 따라가며 일부가 화면 밖 → 기본 켜짐 (설정은 따로 기억)
    const big = gm.grid.width > 17 || gm.grid.height > 15;
    const key = big ? 'boomroom.minimapBig' : 'boomroom.minimap2';
    let on = big;
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) on = saved === '1';
    } catch {
      /* storage 차단 — 기본값 사용 */
    }
    const cs = window.innerWidth <= 700 ? 5 : 7;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = el('<canvas class="minimap" aria-label="미니맵"></canvas>');
    cv.width = gm.grid.width * cs * dpr;
    cv.height = gm.grid.height * cs * dpr;
    cv.style.width = `${gm.grid.width * cs}px`;
    cv.style.height = `${gm.grid.height * cs}px`;
    cv.classList.toggle('off', !on);
    node.appendChild(cv);
    this.hud.minimap = { cv, ctx: cv.getContext('2d'), cs: cs * dpr, on, frame: 0, key };
    this.hud.timer.addEventListener('pointerdown', () => this.toggleMinimap());
    this.hud.timer.style.pointerEvents = 'auto';
  }

  toggleMinimap() {
    const mm = this.hud?.minimap;
    if (!mm) return;
    mm.on = !mm.on;
    mm.cv.classList.toggle('off', !mm.on);
    try {
      localStorage.setItem(mm.key, mm.on ? '1' : '0');
    } catch {
      /* 무시 */
    }
  }

  _drawMinimap(gm, view) {
    const mm = this.hud?.minimap;
    if (!mm || !mm.on) return;
    if (mm.frame++ % 2) return;
    const { ctx, cs } = mm;
    const g = gm.grid;
    ctx.clearRect(0, 0, mm.cv.width, mm.cv.height);
    for (const c of g.cells) {
      let col = null;
      if (c.border) col = '#10141b';
      else if (c.type === 'SOLID') col = '#5b6778';
      else if (c.type === 'BREAKABLE') col = c.routeCrate ? '#d9a441' : '#9a6a3c';
      else if (c.type === 'GIMMICK') col = c.gimmick?.solid ? '#8a62e8' : '#3d3060';
      else col = '#262c36';
      ctx.fillStyle = col;
      ctx.fillRect(c.x * cs, c.y * cs, cs, cs);
    }
    for (const w of gm.waves.cells.values()) {
      ctx.fillStyle = 'rgba(110, 200, 255, 0.85)';
      ctx.fillRect(w.x * cs, w.y * cs, cs, cs);
    }
    for (const it of gm.items.items) {
      ctx.fillStyle = ITEM_TYPES[it.type]?.color || '#fff';
      ctx.fillRect(it.x * cs + cs * 0.3, it.y * cs + cs * 0.3, cs * 0.4, cs * 0.4);
    }
    const blink = Math.floor(performance.now() / 160) % 2;
    for (const b of gm.bombs.bombs) {
      ctx.fillStyle = blink ? '#ff5a4f' : '#ffd166';
      ctx.beginPath();
      ctx.arc((b.x + 0.5) * cs, (b.y + 0.5) * cs, cs * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of gm.players.list) {
      if (p.isEliminated) continue;
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * cs, (p.y + 0.5) * cs, cs * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = p.isTrapped ? '#b46bff' : p.color;
      ctx.fill();
      ctx.lineWidth = Math.max(1, cs * 0.12);
      ctx.strokeStyle = p.isBot ? 'rgba(0,0,0,0.6)' : '#ffffff';
      ctx.stroke();
    }
    if (view) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = Math.max(1, cs * 0.14);
      const x0 = Math.max(0, view.x0 + 0.5) * cs;
      const y0 = Math.max(0, view.y0 + 0.5) * cs;
      const x1 = Math.min(g.width, view.x1 + 0.5) * cs;
      const y1 = Math.min(g.height, view.y1 + 0.5) * cs;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  updateHud(gm, { view = null } = {}) {
    const h = this.hud;
    if (!h) return;
    this._drawMinimap(gm, view);
    const tl = gm.timeLeft;
    h.timerB.textContent = fmtTime(tl);
    h.timer.classList.toggle('hurry', tl <= 30 && gm.phase === 'PLAYING');
    if (h.controls && performance.now() - h.born > 9000) h.controls.classList.add('fade');
    gm.players.list.forEach((p, i) => {
      const card = h.cards[i];
      const st = p.stats.current;
      const mx = p.stats.max;
      const held = p.heldItem;
      const status = p.state === 'ELIMINATED' ? 'OUT' : p.state === 'TRAPPED' ? `TRAPPED ${Math.max(0, p.trap.maxTime - p.trap.time).toFixed(1)}` : p.state === 'VICTORY' ? 'WIN!' : p.modifiers.speedOverrideTime > 0 ? 'SKATES' : 'ACTIVE';
      const avail = Math.max(0, p.maxBombs - p.activeBombs);
      const abil = ['kick', 'glove', 'remote'].filter((k) => p.abilities[k]);
      const key = `${status}|${st.speed}|${st.bomb}|${st.wave}|${avail}|${held ? held.type : ''}|${abil.join()}`;
      if (key === card.key) return;
      card.key = key;
      card.el.classList.toggle('trapped', p.state === 'TRAPPED');
      card.el.classList.toggle('out', p.state === 'ELIMINATED');
      card.el.querySelector('.st').textContent = status;
      card.el.querySelector('.rows').innerHTML =
        `<div class="hrow"><span>SPD</span>${hudPips(st.speed, mx.speed)}</div>` +
        `<div class="hrow"><span>BOMB</span>${hudPips(st.bomb, mx.bomb)}</div>` +
        `<div class="hrow"><span>WAVE</span>${hudPips(st.wave, mx.wave)}</div>` +
        (abil.length ? `<div class="abil">${abil.map((k) => `<img src="${this.icons[k]}" alt="${k}" title="${ITEM_TYPES[k].label}">`).join('')}</div>` : '');
      card.el.querySelector('.held').innerHTML = held ? `<img src="${this.icons[held.type]}" alt="${held.type}" title="${ITEM_TYPES[held.type].label}"><i>${ITEM_TYPES[held.type].passive ? 'AUTO' : 'E'}</i>` : '';
    });
  }

  banner(text, { sub = '', color = '#ffffff', ms = 1600 } = {}) {
    if (!this.hud) return;
    const b = el(`<div class="banner" style="color:${color}">${text}${sub ? `<small>${sub}</small>` : ''}</div>`);
    this.hud.node.appendChild(b);
    setTimeout(() => b.classList.add('out'), ms);
    setTimeout(() => b.remove(), ms + 500);
  }

  countdown(value) {
    if (!this.hud) return;
    const c = el(`<div class="countdown"><b>${value}</b></div>`);
    this.hud.node.appendChild(c);
    setTimeout(() => c.remove(), 950);
  }

  // ── PAUSE ──────────────────────────────────────
  showPause({ onResume, onRestart, onLobby, onTitle }) {
    const node = this._layer(
      'overlay',
      el(`<div class="screen overlay"><div class="box panel">
        <h2>PAUSE</h2>
        <div class="menu" style="max-width:none">
          <button class="btn" data-a="resume">RESUME<small>ESC</small></button>
          <button class="btn" data-a="restart">RESTART<small>같은 캐릭터 · 같은 스테이지</small></button>
          <button class="btn" data-a="lobby">CHARACTER SELECT</button>
          <button class="btn" data-a="title">TITLE</button>
        </div>
      </div></div>`),
    );
    const map = { resume: onResume, restart: onRestart, lobby: onLobby, title: onTitle };
    const btns = [...node.querySelectorAll('.btn')];
    btns.forEach((b) => b.addEventListener('click', () => map[b.dataset.a]()));
    this._menuNav(btns, {}); // ESC 재개는 App 의 전역 키 처리에서
  }

  hidePause() {
    this.clearLayer('overlay');
    this.keyHandler = null;
  }

  // ── RESULT ─────────────────────────────────────
  showResult(gm, stats, { onRematch, onLobby, onTitle }) {
    const r = gm.result;
    const winners = r.winnerIds.map((id) => gm.players.get(id));
    let headline = 'DRAW';
    let color = '#ffc55c';
    if (r.type === 'win') {
      if (r.team) {
        headline = `TEAM ${GAME_CONFIG.teamNames[r.team]} WINS!`;
        color = GAME_CONFIG.teamColors[r.team];
      } else {
        headline = `${winners[0].name} WINS!`;
        color = winners[0].color;
      }
    }
    const order = gm.players.list.slice().sort((a, b) => {
      const wa = r.winnerIds.includes(a.id) ? 1 : 0;
      const wb = r.winnerIds.includes(b.id) ? 1 : 0;
      if (wa !== wb) return wb - wa;
      const ea = a.eliminatedAt ?? Infinity;
      const eb = b.eliminatedAt ?? Infinity;
      if (ea !== eb) return eb - ea;
      return b.score - a.score || (b.bonus || 0) - (a.bonus || 0);
    });
    const rows = order
      .map((p, i) => {
        const s = stats[p.id] || {};
        return `<tr><td>${i + 1}</td><td><span class="key" style="background:${p.color};color:#000">${p.isBot ? 'CPU' : `${p.slot + 1}P`}</span> ${p.name}</td><td>${p.team ? GAME_CONFIG.teamNames[p.team] : '—'}</td><td>${p.score}${p.bonus ? ` <small title="MAX BONUS">+${p.bonus}</small>` : ''}</td><td>${s.bombs || 0}</td><td>${s.items || 0}</td><td>${p.stats.current.speed}/${p.stats.max.speed}</td><td>${p.stats.current.bomb}/${p.stats.max.bomb}</td><td>${p.stats.current.wave}/${p.stats.max.wave}</td></tr>`;
      })
      .join('');
    const node = this._layer(
      'overlay',
      el(`<div class="screen overlay result"><div class="box panel">
        <div class="result-win">${winners.map((w) => `<img src="${this.portraits[w.characterId]}" alt="">`).join('')}<div><div class="big" style="color:${color}">${headline}</div><div class="hint">${r.reason === 'timeUp' ? 'TIME UP — 생존자 점수 판정' : 'LAST STANDING'} · ${gm.stageDef.name}</div></div></div>
        <table><thead><tr><th>#</th><th>PLAYER</th><th>TEAM</th><th>CAPTURE</th><th>BOMBS</th><th>ITEMS</th><th>SPEED</th><th>BOMB</th><th>WAVE</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="row-btns"><button class="btn" data-a="rematch">REMATCH<small>SPACE</small></button><button class="btn" data-a="lobby">CHARACTER SELECT</button><button class="btn" data-a="title">TITLE</button></div>
      </div></div>`),
    );
    const map = { rematch: onRematch, lobby: onLobby, title: onTitle };
    const btns = [...node.querySelectorAll('.btn')];
    btns.forEach((b) => b.addEventListener('click', () => map[b.dataset.a]()));
    this._menuNav(btns, { cols: 3 });
  }
}

function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
}

function navAction(code) {
  if (['ArrowUp', 'KeyW', 'KeyI', 'Numpad8'].includes(code)) return 'up';
  if (['ArrowDown', 'KeyS', 'KeyK', 'Numpad5', 'Numpad2'].includes(code)) return 'down';
  if (['ArrowLeft', 'KeyA', 'KeyJ', 'Numpad4'].includes(code)) return 'left';
  if (['ArrowRight', 'KeyD', 'KeyL', 'Numpad6'].includes(code)) return 'right';
  if (['Enter', 'Space', 'NumpadEnter'].includes(code)) return 'confirm';
  if (['Escape', 'Backspace'].includes(code)) return 'back';
  return null;
}

function hudMoveLabel(gm) {
  const humans = gm.players.list.filter((p) => !p.isBot);
  return humans.length <= 1 ? 'WASD/←↑↓→' : 'WASD';
}

export function drawMinimap(canvas, stage) {
  const g = canvas.getContext('2d');
  const rows = stage.map;
  const H = rows.length;
  const W = rows[0].length;
  const cw = canvas.width / W;
  const ch = canvas.height / H;
  const legend = legendFor(stage);
  g.fillStyle = stage.theme.floor.a;
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = rows[y][x];
      const d = legend[c];
      let col = null;
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      if (c === '#' && border) col = '#1c242e';
      else if (c === 'G') col = '#b46bff';
      else if (d.type === CELL.SOLID) col = '#6b4a33';
      else if (d.type === CELL.BREAKABLE) col = d.routeCrate ? '#ffd166' : '#c99a5e';
      else if (d.type === CELL.GIMMICK) col = '#b46bff';
      else if (d.randomFill) col = 'rgba(201,154,94,0.38)';
      else if (d.ring) col = '#3a2e5a';
      if (col) {
        g.fillStyle = col;
        g.fillRect(x * cw + 0.5, y * ch + 0.5, cw - 1, ch - 1);
      }
      // 시작 위치는 매 경기 랜덤이라 미리보기에는 표시하지 않는다
    }
  }
}
