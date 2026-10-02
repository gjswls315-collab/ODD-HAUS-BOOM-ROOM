// ─────────────────────────────────────────────────────────────
// STAGE CONFIG — 6개 기본 Arena (Logic Grid + Visual Theme 분리)
//
// map 문자열은 "논리 그리드"다. 3D 메쉬(prop)가 바뀌어도 그리드 규칙은 유지된다.
//
// 공통 legend
//   #  : 방 경계 (SOLID)
//   .  : 빈 바닥 (랜덤 채움 금지)
//   ,  : 빈 바닥 — 경기 시작 시 randomFill.density 확률로 BREAKABLE 생성
//   1~4: SPAWN
//
// 셀 type: EMPTY / SOLID / BREAKABLE / GIMMICK / SPAWN / ITEM / HAZARD
//   (ITEM / SPAWN / HAZARD 는 런타임 오버레이로 관리된다)
//
// 모든 기믹은 공용이다. 특정 캐릭터만 사용할 수 있는 맵 기능은 없다.
// ─────────────────────────────────────────────────────────────

export const CELL = {
  EMPTY: 'EMPTY',
  SOLID: 'SOLID',
  BREAKABLE: 'BREAKABLE',
  GIMMICK: 'GIMMICK',
  SPAWN: 'SPAWN',
  ITEM: 'ITEM',
  HAZARD: 'HAZARD',
};

const COMMON_LEGEND = {
  '#': { type: CELL.SOLID, prop: 'wall' },
  '.': { type: CELL.EMPTY },
  ',': { type: CELL.EMPTY, randomFill: true },
  1: { type: CELL.EMPTY, spawn: 0 },
  2: { type: CELL.EMPTY, spawn: 1 },
  3: { type: CELL.EMPTY, spawn: 2 },
  4: { type: CELL.EMPTY, spawn: 3 },
};

export const STAGES = {
  // ───────────────────────────── 01 LOUNGE
  lounge: {
    id: 'lounge',
    no: '01',
    name: 'LOUNGE',
    subtitle: '거실 배틀 · Beginner',
    desc: '소파와 테이블이 파동을 막고 LP 박스·책 더미가 파괴된다. 가장 표준적인 배틀 맵.',
    legend: {
      S: { type: CELL.SOLID, prop: 'sofa', movable: true },
      T: { type: CELL.SOLID, prop: 'coffeeTable' },
      B: { type: CELL.BREAKABLE, prop: 'lpBox' },
      k: { type: CELL.BREAKABLE, prop: 'books' },
      L: { type: CELL.SOLID, prop: 'lamp', light: true },
      P: { type: CELL.SOLID, prop: 'plant' },
    },
    randomFill: { density: 0.62, props: ['lpBox', 'books', 'lpBox'] },
    map: [
      '#################',
      '#1.,B,,k,k,,B,.2#',
      '#.L,,,,,,,,,,,L.#',
      '#,,P,SSS,SSS,P,,#',
      '#B,,,,,,,,,,,,,B#',
      '#k,S,,,,,,,,,S,k#',
      '#,,S,B,TTT,B,S,,#',
      '#k,S,,,,,,,,,S,k#',
      '#B,,,,,,,,,,,,,B#',
      '#,,P,SSS,SSS,P,,#',
      '#.L,,,,,,,,,,,L.#',
      '#3.,B,,k,k,,B,.4#',
      '#################',
    ],
    gimmicks: [],
    houseEvents: {
      firstAt: 55,
      interval: 45,
      warnTime: 3.2,
      events: ['furniturePush'],
      pushCount: 1,
    },
    theme: {
      backdrop: 'lounge',
      border: 'room',
      floor: { a: '#6e4428', b: '#5f3a22', line: '#3e2414' },
      rug: { x0: 4, y0: 4, x1: 12, y1: 8, color: '#7a2230', trim: '#d9a441' },
      wall: { color: '#183235', trim: '#4a2c18', accent: '#d9a441' },
      fog: '#0a0c12',
      hemi: ['#9db6e0', '#3a2414', 0.55],
      key: ['#ffd7a6', 1.55],
      accents: ['#4fb8ff', '#9a66ff'],
    },
  },

  // ───────────────────────────── 02 LP LIBRARY
  lpLibrary: {
    id: 'lpLibrary',
    no: '02',
    name: 'LP LIBRARY',
    subtitle: 'LP 서재 배틀 · Maze',
    desc: '높은 선반이 긴 벽 역할. 금색 Record Box 를 부수면 숨은 선반이 열려 새 Route 가 생긴다. 가운데 통로엔 Rolling LP 주의.',
    legend: {
      H: { type: CELL.SOLID, prop: 'shelf' },
      G: { type: CELL.GIMMICK, prop: 'secretShelf', gimmick: 'secretShelf' },
      X: { type: CELL.BREAKABLE, prop: 'routeCrate', routeCrate: true },
      R: { type: CELL.BREAKABLE, prop: 'recordCrate' },
    },
    randomFill: { density: 0.58, props: ['recordCrate'] },
    map: [
      '#################',
      '#1.,R,,H,H,,R,.2#',
      '#.HH,HH,,,HH,HH.#',
      '#,,,,,H,X,H,,,,,#',
      '#,HH,R,HGH,R,HH,#',
      '#R,,,,,,,,,,,,,R#',
      '#...............#',
      '#R,,,,,,,,,,,,,R#',
      '#,HH,R,HGH,R,HH,#',
      '#,,,,,H,X,H,,,,,#',
      '#.HH,HH,,,HH,HH.#',
      '#3.,R,,H,H,,R,.4#',
      '#################',
    ],
    gimmicks: [
      { kind: 'routeCrates' },
      { kind: 'rollingLp', lanes: [6], firstAt: 24, interval: 24, warnTime: 2.4, speed: 10 },
    ],
    houseEvents: {
      firstAt: 70,
      interval: 55,
      warnTime: 3.2,
      events: ['blockSpawn'],
      blockCount: 5,
    },
    theme: {
      backdrop: 'library',
      border: 'room',
      floor: { a: '#4b2e1f', b: '#42281a', line: '#2a170d' },
      rug: { x0: 1, y0: 6, x1: 15, y1: 6, color: '#2b3f6b', trim: '#c79a45' },
      wall: { color: '#2a1a14', trim: '#5a3620', accent: '#c79a45' },
      fog: '#0b0a0e',
      hemi: ['#a8b8d8', '#2b1a10', 0.5],
      key: ['#ffcf96', 1.45],
      accents: ['#ffb14e', '#6f8cff'],
    },
  },

  // ───────────────────────────── 03 STUDIO
  studio: {
    id: 'studio',
    no: '03',
    name: 'STUDIO',
    subtitle: '녹음실 배틀 · Mechanical',
    desc: '앰프·믹서·케이블이 장애물. 가운데 REC 스위치를 밟거나 Wave 로 맞히면 REC 가 켜지고 앰프가 Sound Pulse 를 쏜다.',
    legend: {
      M: { type: CELL.SOLID, prop: 'mixer' },
      K: { type: CELL.SOLID, prop: 'speaker' },
      '>': { type: CELL.SOLID, prop: 'amp', amp: 'right' },
      '<': { type: CELL.SOLID, prop: 'amp', amp: 'left' },
      m: { type: CELL.SOLID, prop: 'micStand' },
      C: { type: CELL.BREAKABLE, prop: 'cableCase' },
      W: { type: CELL.GIMMICK, prop: 'recSwitch', gimmick: 'recSwitch' },
    },
    randomFill: { density: 0.58, props: ['gearBox', 'cableCase'] },
    map: [
      '#################',
      '#1.,,C,,K,,C,,.2#',
      '#.m,,,,,,,,,,,m.#',
      '#,,>,,,,,,,,,<,,#',
      '#C,,,C,MMM,C,,,C#',
      '#,,K,,,,,,,,,K,,#',
      '#,C,,,,,W,,,,,C,#',
      '#,,K,,,,,,,,,K,,#',
      '#C,,,C,MMM,C,,,C#',
      '#,,>,,,,,,,,,<,,#',
      '#.m,,,,,,,,,,,m.#',
      '#3.,,C,,K,,C,,.4#',
      '#################',
    ],
    gimmicks: [
      { kind: 'recStudio', recDuration: 8, pulseInterval: 2.4, telegraph: 1.0, range: 4, cooldown: 10 },
    ],
    houseEvents: {
      firstAt: 65,
      interval: 55,
      warnTime: 3.2,
      events: ['lampOff', 'blockSpawn'],
      blockCount: 4,
      lampOffDuration: 7,
    },
    theme: {
      backdrop: 'studio',
      border: 'room',
      floor: { a: '#2c2f38', b: '#262932', line: '#17191f' },
      rug: { x0: 5, y0: 5, x1: 11, y1: 7, color: '#3b2350', trim: '#9a66ff' },
      wall: { color: '#1b1e2a', trim: '#2c2f3c', accent: '#ff3b4f' },
      fog: '#090a10',
      hemi: ['#8aa0d8', '#1a1420', 0.5],
      key: ['#ffd2a8', 1.35],
      accents: ['#4fb8ff', '#ff3b4f'],
    },
  },

  // ───────────────────────────── 04 DJ BOOTH
  djBooth: {
    id: 'djBooth',
    no: '04',
    name: 'DJ BOOTH',
    subtitle: 'DJ 부스 배틀 · Dynamic',
    desc: '양쪽 턴테이블 바닥이 일정 박자마다 회전한다. Speaker Drop 동안 Beat Bomb 카운트가 짧아진다.',
    legend: {
      O: { type: CELL.SOLID, prop: 'turntable' },
      u: { type: CELL.EMPTY, randomFill: true, ring: true },
      K: { type: CELL.SOLID, prop: 'speaker' },
      M: { type: CELL.SOLID, prop: 'mixer' },
      V: { type: CELL.SOLID, prop: 'vinylShelf' },
      c: { type: CELL.BREAKABLE, prop: 'vinylCrate' },
    },
    randomFill: { density: 0.55, props: ['vinylCrate'] },
    map: [
      '#################',
      '#1.,,c,,K,,c,,.2#',
      '#.K,,,,,,,,,,,K.#',
      '#,,,c,,,M,,,c,,,#',
      '#c,,,,V,,,V,,,,c#',
      '#,,uuu,,,,,uuu,,#',
      '#,,uOu,,M,,uOu,,#',
      '#,,uuu,,,,,uuu,,#',
      '#c,,,,V,,,V,,,,c#',
      '#,,,c,,,M,,,c,,,#',
      '#.K,,,,,,,,,,,K.#',
      '#3.,,c,,K,,c,,.4#',
      '#################',
    ],
    gimmicks: [
      { kind: 'turntables', interval: 5, warnTime: 0.9 },
      { kind: 'speakerDrop', firstAt: 40, interval: 42, duration: 9, warnTime: 2, fuseMultiplier: 0.6 },
    ],
    houseEvents: {
      firstAt: 75,
      interval: 60,
      warnTime: 3.2,
      events: ['lampOff', 'blockSpawn'],
      blockCount: 4,
      lampOffDuration: 6,
    },
    theme: {
      backdrop: 'djbooth',
      border: 'room',
      floor: { a: '#1f1a2c', b: '#1a1625', line: '#0f0c16' },
      rug: null,
      wall: { color: '#140f22', trim: '#2a2140', accent: '#b46bff' },
      fog: '#08060e',
      hemi: ['#8a7fd8', '#160e22', 0.5],
      key: ['#ffc9e8', 1.2],
      accents: ['#b46bff', '#4fb8ff'],
    },
  },

  // ───────────────────────────── 05 TERRACE
  terrace: {
    id: 'terrace',
    no: '05',
    name: 'TERRACE',
    subtitle: '테라스 배틀 · Open',
    desc: '벽이 적은 개방형 맵. 바람 방향이 미리 표시되고, 돌풍이 불면 플레이어와 아이템이 한 칸 밀린다.',
    legend: {
      p: { type: CELL.SOLID, prop: 'planter' },
      t: { type: CELL.SOLID, prop: 'patioTable' },
      h: { type: CELL.BREAKABLE, prop: 'chair' },
      f: { type: CELL.BREAKABLE, prop: 'flowerPot' },
    },
    randomFill: { density: 0.48, props: ['flowerPot', 'crate'] },
    map: [
      '#################',
      '#1.,,,,f,f,,,,.2#',
      '#.,,p,,,,,,,p,,.#',
      '#,,,,,h,t,h,,,,,#',
      '#,p,,,,,,,,,,,p,#',
      '#,,,h,,,,,,,h,,,#',
      '#f,t,,,,p,,,,t,f#',
      '#,,,h,,,,,,,h,,,#',
      '#,p,,,,,,,,,,,p,#',
      '#,,,,,h,t,h,,,,,#',
      '#.,,p,,,,,,,p,,.#',
      '#3.,,,,f,f,,,,.4#',
      '#################',
    ],
    gimmicks: [{ kind: 'wind', firstAt: 22, interval: 22, warnTime: 3 }],
    houseEvents: {
      firstAt: 70,
      interval: 55,
      warnTime: 3.2,
      events: ['lampOff', 'blockSpawn'],
      blockCount: 5,
      lampOffDuration: 6,
    },
    theme: {
      backdrop: 'terrace',
      border: 'terrace',
      floor: { a: '#5b4a3c', b: '#514235', line: '#33291f' },
      rug: null,
      wall: { color: '#2b2433', trim: '#4a3a2a', accent: '#ffd27a' },
      fog: '#0a0f1c',
      hemi: ['#7f9fe0', '#2a2018', 0.62],
      key: ['#b9cfff', 1.1],
      accents: ['#ffd27a', '#7f9bff'],
    },
  },

  // ───────────────────────────── 06 LOCKED ROOM
  lockedRoom: {
    id: 'lockedRoom',
    no: '06',
    name: 'LOCKED ROOM',
    subtitle: '잠긴 방 배틀 · Advanced',
    desc: '좁은 길과 단단한 가구. 가운데 레버로 문을 열고 닫는다. Mr. ODD 가 자주 나타나 가구 배치를 크게 바꾼다.',
    legend: {
      Q: { type: CELL.SOLID, prop: 'cabinet', movable: true },
      F: { type: CELL.SOLID, prop: 'coveredFurniture', movable: true },
      E: { type: CELL.SOLID, prop: 'oldAudio' },
      x: { type: CELL.BREAKABLE, prop: 'box' },
      D: { type: CELL.GIMMICK, prop: 'door', gimmick: 'door', open: true },
      d: { type: CELL.GIMMICK, prop: 'door', gimmick: 'door', open: false },
      V: { type: CELL.GIMMICK, prop: 'lever', gimmick: 'lever' },
    },
    randomFill: { density: 0.6, props: ['box'] },
    map: [
      '#################',
      '#1.,x,Q,,,Q,x,.2#',
      '#.E,,,Q,d,Q,,,E.#',
      '#,,,F,,,,,,,F,,,#',
      '#x,QQ,,E,E,,QQ,x#',
      '#,,,D,,x,x,,D,,,#',
      '#x,,Q,,,V,,,Q,,x#',
      '#,,,D,,x,x,,D,,,#',
      '#x,QQ,,E,E,,QQ,x#',
      '#,,,F,,,,,,,F,,,#',
      '#.E,,,Q,d,Q,,,E.#',
      '#3.,x,Q,,,Q,x,.4#',
      '#################',
    ],
    gimmicks: [{ kind: 'doors', leverCooldown: 3 }],
    houseEvents: {
      firstAt: 35,
      interval: 28,
      warnTime: 3.0,
      events: ['furniturePush', 'doorToggle', 'lampOff', 'blockSpawn'],
      pushCount: 3,
      blockCount: 4,
      lampOffDuration: 6,
    },
    theme: {
      backdrop: 'lockedroom',
      border: 'room',
      floor: { a: '#3a3029', b: '#332a24', line: '#1f1915' },
      rug: { x0: 6, y0: 5, x1: 10, y1: 7, color: '#3d2a1e', trim: '#7a5a3a' },
      wall: { color: '#221c1c', trim: '#3a2c22', accent: '#ffb35c' },
      fog: '#08080b',
      hemi: ['#8c9ab8', '#1a1410', 0.42],
      key: ['#ffcf9a', 1.25],
      accents: ['#ffb35c', '#6f8cff'],
    },
  },
};

export const STAGE_ORDER = ['lounge', 'lpLibrary', 'studio', 'djBooth', 'terrace', 'lockedRoom'];

export function getStage(id) {
  const s = STAGES[id];
  if (!s) throw new Error(`Unknown stage: ${id}`);
  return s;
}

export function legendFor(stage) {
  return { ...COMMON_LEGEND, ...stage.legend };
}
