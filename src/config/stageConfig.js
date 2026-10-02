// ─────────────────────────────────────────────────────────────
// STAGE CONFIG — 6개 기본 Arena (GDD v3: 13×11 논리 격자)
//
// map 문자열은 "논리 그리드"다. 3D 메쉬가 바뀌어도 그리드 규칙은 유지된다.
//   # = SOLID (파괴 불가 — 바깥 테두리는 벽, 안쪽은 스테이지 가구)
//   B = BREAKABLE (파괴 가능 — 스테이지별 소품)
//   . = 이동 가능
//   S = SPAWN (읽는 순서대로 1P 좌상 · 2P 우상 · 3P 좌하 · 4P 우하)
//   G = Stage Gimmick (스테이지마다 정의)
//
// 셀 type: EMPTY / SOLID / BREAKABLE / GIMMICK / SPAWN / ITEM / HAZARD
//   (ITEM / SPAWN / HAZARD 는 런타임 오버레이로 관리된다)
//
// solids    : 안쪽 # 를 어떤 가구로 보여줄지 (merge = 붙어 있는 # 를 한 덩어리 가구로)
//             byLength[칸 수] = prop 또는 [순환 목록] / borderAttached = 테두리에 붙은 덩어리
// overrides : 특정 좌표만 다른 셀로 (숨은 선반, 금색 Record Box 등)
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
  '#': { type: CELL.SOLID, solid: true },
  B: { type: CELL.BREAKABLE, breakable: true },
  '.': { type: CELL.EMPTY },
  S: { type: CELL.EMPTY, spawn: 'auto' },
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
    subtitle: '거실 배틀 · 기본형 / 학습',
    desc: '소파·커피테이블은 SOLID, LP 박스·책은 BREAKABLE. 중앙 Floor Lamp 가 기준점. 처음 배우기 좋은 대칭 구조.',
    eventDesc: 'Mr. ODD 가 소파 일부를 밀어 통로 한 줄을 바꾼다.',
    map: [
      '#############',
      '#S..B...B..S#',
      '#.#B#B#B#B#.#',
      '#..BB...BB..#',
      '#B###...###B#',
      '#....BGB....#',
      '#B###...###B#',
      '#..BB...BB..#',
      '#.#B#B#B#B#.#',
      '#S..B...B..S#',
      '#############',
    ],
    breakables: ['lpBox', 'books'],
    solids: {
      merge: true,
      byLength: { 1: ['plant', 'sideTable', 'coffeeTable', 'sideTable', 'plant'], 3: { prop: 'sofa', movable: true } },
      borderAttached: 'wallBlock',
    },
    legend: { G: { type: CELL.SOLID, prop: 'lamp', light: true } },
    gimmicks: [],
    houseEvents: {
      firstAt: 50,
      interval: 40,
      warnTime: 3.2,
      events: ['furniturePush'],
      pushCount: 1,
    },
    theme: {
      backdrop: 'lounge',
      border: 'room',
      floor: { a: '#6e4428', b: '#5f3a22', line: '#3e2414' },
      rugs: [{ x0: 3, y0: 3, x1: 9, y1: 7, color: '#7a2230', trim: '#d9a441' }],
      wall: { color: '#183235', trim: '#4a2c18', accent: '#d9a441' },
      fog: '#0a0c12',
      hemi: ['#9db6e0', '#3a2414', 0.62],
      key: ['#ffd7a6', 1.6],
      accents: ['#4fb8ff', '#9a66ff'],
      extraLamps: 2,
    },
  },

  // ───────────────────────────── 02 LP LIBRARY
  lpLibrary: {
    id: 'lpLibrary',
    no: '02',
    name: 'LP LIBRARY',
    subtitle: 'LP 서재 배틀 · 미로형 / 좁은 통로',
    desc: '선반이 긴 SOLID 벽. 금색 Record Box 를 부수면 숨은 선반이 열려 새 경로가 생긴다. Bomb 배치를 실수하면 스스로 갇히기 쉽다.',
    eventDesc: '대형 LP 가 예고 후 한 행을 굴러가며 플레이어와 아이템을 밀어낸다.',
    map: [
      '#############',
      '#S.B#B.B#B.S#',
      '#.#.#B#.#.#.#',
      '#B..B...B..B#',
      '###.B.#.B.###',
      '#..B..G..B..#',
      '###.B.#.B.###',
      '#B..B...B..B#',
      '#.#.#B#.#.#.#',
      '#S.B#B.B#B.S#',
      '#############',
    ],
    breakables: ['recordCrate'],
    solids: { merge: true, byLength: { default: 'shelf' }, borderAttached: 'shelf' },
    legend: { G: { type: CELL.SOLID, prop: 'recordPlayer' } },
    overrides: [
      { at: [5, 2], def: { type: CELL.BREAKABLE, prop: 'routeCrate', routeCrate: true } },
      { at: [6, 2], def: { type: CELL.GIMMICK, prop: 'secretShelf', gimmick: 'secretShelf' } },
      { at: [5, 8], def: { type: CELL.BREAKABLE, prop: 'routeCrate', routeCrate: true } },
      { at: [6, 8], def: { type: CELL.GIMMICK, prop: 'secretShelf', gimmick: 'secretShelf' } },
    ],
    gimmicks: [
      {
        kind: 'routeCrates',
        links: [
          { crate: [5, 2], opens: [[6, 2]] },
          { crate: [5, 8], opens: [[6, 8]] },
        ],
      },
      { kind: 'rollingLp', lanes: [3, 7], firstAt: 22, interval: 22, warnTime: 2.4, speed: 9 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'library',
      border: 'room',
      floor: { a: '#4b2e1f', b: '#42281a', line: '#2a170d' },
      rugs: [
        { x0: 1, y0: 3, x1: 11, y1: 3, color: '#2b3f6b', trim: '#c79a45' },
        { x0: 1, y0: 7, x1: 11, y1: 7, color: '#2b3f6b', trim: '#c79a45' },
      ],
      wall: { color: '#2a1a14', trim: '#5a3620', accent: '#c79a45' },
      fog: '#0b0a0e',
      hemi: ['#b8c6e6', '#3b2616', 0.78],
      key: ['#ffd7a6', 1.7],
      accents: ['#ffb14e', '#6f8cff'],
    },
  },

  // ───────────────────────────── 03 STUDIO
  studio: {
    id: 'studio',
    no: '03',
    name: 'STUDIO',
    subtitle: '녹음실 배틀 · 기계형 / 스위치',
    desc: 'G 장비(Amp·Mixer)가 공용 스위치로 연결된다. 아무 Sound Wave 나 G 에 닿으면 장비가 올라오고 내려가며 통로 ↔ 벽이 전환된다.',
    eventDesc: 'REC 표시 후 올라와 있는 장비 라인에 Sound Pulse 발생. 모두 똑같이 피해야 한다.',
    map: [
      '#############',
      '#S..B.G.B..S#',
      '#.#B#B#B#B#.#',
      '#...B...B...#',
      '#B#B.#.#.B#B#',
      '#..G.....G..#',
      '#B#B.#.#.B#B#',
      '#...B...B...#',
      '#.#B#B#B#B#.#',
      '#S..B.G.B..S#',
      '#############',
    ],
    breakables: ['cableCase', 'gearBox'],
    solids: { merge: true, byLength: { 1: ['speaker', 'micStand', 'mixerUnit', 'micStand', 'speaker'], default: 'speaker' }, borderAttached: 'wallBlock' },
    legend: { G: { type: CELL.GIMMICK, prop: 'ampGate', gimmick: 'gate' } },
    gimmicks: [
      { kind: 'gates', closed: [[6, 1], [6, 9]], open: [[3, 5], [9, 5]], cooldown: 2.5 },
      { kind: 'recPulse', firstAt: 20, interval: 24, warnTime: 1.8, range: 3 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'studio',
      border: 'room',
      floor: { a: '#2c2f38', b: '#262932', line: '#17191f' },
      rugs: [{ x0: 4, y0: 4, x1: 8, y1: 6, color: '#3b2350', trim: '#9a66ff' }],
      wall: { color: '#1b1e2a', trim: '#2c2f3c', accent: '#ff3b4f' },
      fog: '#090a10',
      hemi: ['#9db0e6', '#241a2c', 0.66],
      key: ['#ffd8b4', 1.5],
      accents: ['#4fb8ff', '#ff3b4f'],
    },
  },

  // ───────────────────────────── 04 DJ BOOTH
  djBooth: {
    id: 'djBooth',
    no: '04',
    name: 'DJ BOOTH',
    subtitle: 'DJ 부스 배틀 · 리듬형 / 변형',
    desc: 'G 는 Turntable Zone. 일정 박자마다 턴테이블 둘레 8칸(벽·상자·아이템·폭탄)이 시계 방향으로 회전해 길 구조가 바뀐다.',
    eventDesc: 'Speaker Drop 예고 후 짧은 시간 Beat Bomb 카운트가 빨라진다.',
    map: [
      '#############',
      '#S..B...B..S#',
      '#.#B#G#G#B#.#',
      '#..B.....B..#',
      '#B###B.B###B#',
      '#..G.....G..#',
      '#B###B.B###B#',
      '#..B.....B..#',
      '#.#B#G#G#B#.#',
      '#S..B...B..S#',
      '#############',
    ],
    breakables: ['vinylCrate'],
    // 턴테이블이 칸 단위로 회전시키므로 # 를 한 덩어리로 묶지 않는다
    solids: { merge: false, byLength: { 1: ['speaker', 'vinylShelf', 'vinylShelf'] } },
    legend: { G: { type: CELL.SOLID, prop: 'turntable', turntable: true } },
    gimmicks: [
      { kind: 'turntables', interval: 6, warnTime: 1.0 },
      { kind: 'speakerDrop', firstAt: 35, interval: 40, duration: 9, warnTime: 2, fuseMultiplier: 0.6 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'djbooth',
      border: 'room',
      floor: { a: '#1f1a2c', b: '#1a1625', line: '#0f0c16' },
      rugs: [],
      wall: { color: '#140f22', trim: '#2a2140', accent: '#b46bff' },
      fog: '#08060e',
      hemi: ['#a296f0', '#22163a', 0.8],
      key: ['#ffd6ee', 1.45],
      accents: ['#b46bff', '#4fb8ff'],
    },
  },

  // ───────────────────────────── 05 TERRACE
  terrace: {
    id: 'terrace',
    no: '05',
    name: 'TERRACE',
    subtitle: '테라스 배틀 · 개방형 / 긴 Wave',
    desc: '벽이 적어 Wave 가 길게 뻗는다 — WAVE 가 긴 캐릭터가 강한 맵. G 는 바람 발생 장치.',
    eventDesc: '방향 화살표로 예고한 뒤 플레이어와 필드 아이템을 한 칸 밀어내는 Wind Event.',
    map: [
      '#############',
      '#S.........S#',
      '#..B.#.#.B..#',
      '#.B.......B.#',
      '#...#B.B#...#',
      '#....G.G....#',
      '#...#B.B#...#',
      '#.B.......B.#',
      '#..B.#.#.B..#',
      '#S.........S#',
      '#############',
    ],
    breakables: ['flowerPot', 'chair', 'crate'],
    solids: { merge: true, byLength: { 1: ['planter', 'patioTable'], default: 'planter' }, borderAttached: 'planter' },
    legend: { G: { type: CELL.SOLID, prop: 'windFan' } },
    gimmicks: [{ kind: 'wind', firstAt: 20, interval: 20, warnTime: 3 }],
    houseEvents: null,
    theme: {
      backdrop: 'terrace',
      border: 'terrace',
      floor: { a: '#5b4a3c', b: '#514235', line: '#33291f' },
      rugs: [],
      wall: { color: '#2b2433', trim: '#4a3a2a', accent: '#ffd27a' },
      fog: '#0a0f1c',
      hemi: ['#7f9fe0', '#2a2018', 0.7],
      key: ['#b9cfff', 1.2],
      accents: ['#ffd27a', '#7f9bff'],
    },
  },

  // ───────────────────────────── 06 LOCKED ROOM
  lockedRoom: {
    id: 'lockedRoom',
    no: '06',
    name: 'LOCKED ROOM',
    subtitle: '잠긴 방 배틀 · 고난도 / 구조 변경',
    desc: '좁은 통로와 높은 SOLID 비율. 중앙 GGG 는 Old Audio Machine. Mr. ODD 가 가구를 옮겨 후반 동선이 크게 바뀐다.',
    eventDesc: 'Mr. ODD 가 가구를 이동시켜 일부 . ↔ # 상태를 바꾼다.',
    map: [
      '#############',
      '#S.B#...#B.S#',
      '#.#B#.B.#B#.#',
      '#B...#.#...B#',
      '###B.....B###',
      '#..B.GGG.B..#',
      '###B.....B###',
      '#B...#.#...B#',
      '#.#B#.B.#B#.#',
      '#S.B#...#B.S#',
      '#############',
    ],
    breakables: ['box', 'crate'],
    solids: {
      merge: true,
      byLength: { 1: [{ prop: 'cabinet', movable: true }, { prop: 'coveredFurniture', movable: true }], default: { prop: 'cabinet', movable: true } },
      borderAttached: 'wallBlock',
    },
    legend: { G: { type: CELL.SOLID, prop: 'oldAudio' } },
    gimmicks: [],
    houseEvents: {
      firstAt: 30,
      interval: 26,
      warnTime: 3.0,
      events: ['furniturePush', 'lampOff', 'blockSpawn'],
      pushCount: 2,
      blockCount: 4,
      lampOffDuration: 6,
    },
    theme: {
      backdrop: 'lockedroom',
      border: 'room',
      floor: { a: '#3a3029', b: '#332a24', line: '#1f1915' },
      rugs: [{ x0: 4, y0: 4, x1: 8, y1: 6, color: '#3d2a1e', trim: '#7a5a3a' }],
      wall: { color: '#221c1c', trim: '#3a2c22', accent: '#ffb35c' },
      fog: '#08080b',
      hemi: ['#9eabc8', '#251c16', 0.58],
      key: ['#ffd3a2', 1.45],
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
