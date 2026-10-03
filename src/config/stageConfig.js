// ─────────────────────────────────────────────────────────────
// STAGE CONFIG — 6개 기본 Arena (BOOM ROOM v4: 17×15 ~ 19×17 큰 논리 격자)
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
// v4 비율 기준 (테두리 제외 안쪽 칸): SOLID/고정 가구 20~25% · BREAKABLE 25~30% · 초기 이동 공간 45~50%
//   4인 시작 위치 주변은 2~3칸 비워 둔다 (스폰 → 가로 2칸 · 세로 2칸 통로)
//
// solids    : 안쪽 # 를 어떤 가구로 보여줄지 (merge = 붙어 있는 # 를 한 덩어리 가구로)
//             byLength[칸 수] = prop 또는 [목록 — 좌우/상하 대칭 위치에 같은 가구] / borderAttached = 테두리에 붙은 덩어리
//             # 는 벽 블록이 아니라 실제 가구(소파·커피테이블·스피커·책장·램프)로 보인다
// overrides : 특정 좌표만 다른 셀로 (숨은 선반, 금색 Record Box 등)
// dropChance: 스테이지별 아이템 드랍 확률 (없으면 공통 드랍 테이블 값) — 맵당 아이템 약 30~40개 목표
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
  // ───────────────────────────── 01 LOUNGE (17×15)
  lounge: {
    id: 'lounge',
    no: '01',
    name: 'LOUNGE',
    subtitle: '거실 배틀 · 기본형 / 학습',
    desc: '소파 네 개가 각각 커피테이블과 "소파 섬"을 이루고, 한가운데 Floor Lamp 가 사이드테이블에 둘러싸여 있다. 가장자리에 LP 박스가 몰려 있는 기본형 거실.',
    eventDesc: '고정형 맵 — 경기 중 지형이 바뀌지 않는다.',
    map: [
      '#################',
      '#S.............S#',
      '#.p.BBB...BBB.p.#',
      '#...###...###...#',
      '#....T.....T....#',
      '##.............##',
      '##.....e.e.....##',
      '#..k....G....k..#',
      '##.....e.e.....##',
      '##.............##',
      '#....T.....T....#',
      '#...###...###...#',
      '#.p.BBB...BBB.p.#',
      '#S.............S#',
      '#################',
    ],
    breakables: ['lpBox', 'books', 'magazineBox', 'cushion'],
    solids: {
      merge: true,
      byLength: { 3: { prop: 'sofa', movable: true }, default: 'bookcase' },
      borderAttached: 'bookcase',
    },
    legend: {
      G: { type: CELL.SOLID, prop: 'lamp', light: true },
      T: { type: CELL.SOLID, solid: true, prop: 'coffeeTable' },
      e: { type: CELL.SOLID, solid: true, prop: 'sideTable', single: true },
      p: { type: CELL.SOLID, solid: true, prop: 'plant' },
      k: { type: CELL.SOLID, solid: true, prop: 'speaker' },
    },
    // 시작 BREAKABLE 구역 배치: SPAWN FARM 5~7 · SIDE LOOT 촘촘 · CENTRAL COMBAT 드문드문 (core/spawns.js)
    startFill: { zones: { center: [3, 2], side: 2 }, density: { center: 0.06, side: 0.72, mid: 0.48 }, farm: [5, 7] },
    gimmicks: [],
    houseEvents: null,
    theme: {
      backdrop: 'lounge',
      border: 'room',
      floor: { a: '#6e4428', b: '#5f3a22', line: '#3e2414', style: 'planks' },
      rugs: [
        { x0: 6, y0: 5, x1: 10, y1: 9, color: '#7a2230', trim: '#d9a441' },
        { x0: 4, y0: 3, x1: 6, y1: 5, color: '#2b4a5a', trim: '#d9a441' },
        { x0: 10, y0: 3, x1: 12, y1: 5, color: '#2b4a5a', trim: '#d9a441' },
        { x0: 4, y0: 9, x1: 6, y1: 11, color: '#2b4a5a', trim: '#d9a441' },
        { x0: 10, y0: 9, x1: 12, y1: 11, color: '#2b4a5a', trim: '#d9a441' },
      ],
      wall: { color: '#183235', trim: '#4a2c18', accent: '#d9a441' },
      fog: '#0a0c12',
      hemi: ['#9db6e0', '#3a2414', 0.62],
      key: ['#ffd7a6', 1.6],
      accents: ['#4fb8ff', '#9a66ff'],
      extraLamps: 2,
    },
  },

  // ───────────────────────────── 02 LP LIBRARY (17×15)
  lpLibrary: {
    id: 'lpLibrary',
    no: '02',
    name: 'LP LIBRARY',
    subtitle: 'LP 서재 배틀 · 미로형 / 좁은 통로',
    desc: '가로로 긴 LP 선반 줄이 통로(aisle)를 만든다. 선반 사이 긴 복도에서는 Wave 가 멀리 뻗고, 중앙 청음 스테이션 줄이 가장 위험하다.',
    eventDesc: '고정형 맵 — 경기 중 지형이 바뀌지 않는다.',
    map: [
      '#################',
      '#S.............S#',
      '#.B...B...B...B.#',
      '#.####B.#.B####.#',
      '#...............#',
      '#B.............B#',
      '#.###.#####.###.#',
      '#.......G.......#',
      '#.###.#####.###.#',
      '#B.............B#',
      '#...............#',
      '#.####B.#.B####.#',
      '#.B...B...B...B.#',
      '#S.............S#',
      '#################',
    ],
    breakables: ['recordCrate', 'lpStack', 'cardboardBox'],
    solids: { merge: true, byLength: { default: 'shelf' }, borderAttached: 'shelf' },
    legend: { G: { type: CELL.SOLID, prop: 'recordPlayer' } },
    // 고정형 맵: 숨은 선반 / Rolling LP 같은 지형 변화 기믹 없음 (gimmicks/routeCrates·rollingLp 는 확장용으로 남겨 둠)
    // 시작 BREAKABLE 구역 배치: SPAWN FARM 5~7 · SIDE LOOT 촘촘 · CENTRAL COMBAT 드문드문 (core/spawns.js)
    startFill: { zones: { center: [3, 2], side: 2 }, density: { center: 0.06, side: 0.68, mid: 0.46 }, farm: [5, 7] },
    gimmicks: [],
    houseEvents: null,
    theme: {
      backdrop: 'library',
      border: 'room',
      floor: { a: '#4b2e1f', b: '#42281a', line: '#2a170d', style: 'parquet' },
      rugs: [
        { x0: 1, y0: 4, x1: 15, y1: 4, color: '#2b3f6b', trim: '#c79a45', kind: 'runner' },
        { x0: 1, y0: 10, x1: 15, y1: 10, color: '#2b3f6b', trim: '#c79a45', kind: 'runner' },
        { x0: 1, y0: 7, x1: 15, y1: 7, color: '#5a2a2a', trim: '#c79a45', kind: 'runner' },
      ],
      wall: { color: '#2a1a14', trim: '#5a3620', accent: '#c79a45' },
      fog: '#0b0a0e',
      hemi: ['#b8c6e6', '#3b2616', 0.78],
      key: ['#ffd7a6', 1.7],
      accents: ['#ffb14e', '#6f8cff'],
    },
  },

  // ───────────────────────────── 03 STUDIO (17×15)
  studio: {
    id: 'studio',
    no: '03',
    name: 'STUDIO',
    subtitle: '녹음실 배틀 · 기계형 / 스위치',
    desc: '오른쪽 위는 유리 녹음 부스(입구 3곳, 안에 Amp), 왼쪽 아래는 5×2 믹서 데스크 — 장비가 L자로 공간을 나눈다. Amp(G) 3대는 고정, Wave 가 닿으면 불빛만 반응한다.',
    eventDesc: 'REC 표시 후 서 있는 장비 라인에 Sound Pulse 발생. 모두 똑같이 피해야 한다.',
    map: [
      '#################',
      '#S.............S#',
      '#..k.m..G.......#',
      '#.k.......WW.WW.#',
      '#....B....W...W.#',
      '#.k..B......m.W.#',
      '#....B....W..GW.#',
      '#.k.......WW.WW.#',
      '#...............#',
      '#..#####....k...#',
      '#..#####..B.....#',
      '#.....B...B..k..#',
      '#.k..B..G....B..#',
      '#S.............S#',
      '#################',
    ],
    breakables: ['cableCase', 'gearBox', 'headphoneCase'],
    solids: { merge: true, byLength: { default: 'mixer' }, borderAttached: 'speaker' },
    legend: {
      G: { type: CELL.GIMMICK, prop: 'ampGate', gimmick: 'gate' },
      W: { type: CELL.SOLID, solid: true, prop: 'boothWall', single: true },
      k: { type: CELL.SOLID, solid: true, prop: 'speaker', single: true },
      m: { type: CELL.SOLID, solid: true, prop: 'micStand', single: true },
    },
    // 시작 BREAKABLE 구역 배치: SPAWN FARM 5~7 · SIDE LOOT 촘촘 · CENTRAL COMBAT 드문드문 (core/spawns.js)
    startFill: { zones: { center: [3, 2], side: 2 }, density: { center: 0.06, side: 0.72, mid: 0.46 }, farm: [5, 7] },
    gimmicks: [
      { kind: 'gates', closed: [[8, 2], [13, 6], [8, 12]], open: [], cooldown: 2.5, toggle: false },
      { kind: 'recPulse', firstAt: 30, interval: 28, warnTime: 1.8, range: 4 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'studio',
      border: 'room',
      floor: { a: '#2c2f38', b: '#262932', line: '#17191f', style: 'tiles' },
      rugs: [
        { x0: 11, y0: 4, x1: 13, y1: 6, color: '#3b2350', trim: '#9a66ff' },
        { x0: 2, y0: 8, x1: 8, y1: 11, color: '#22303f', trim: '#4fb8ff' },
      ],
      wall: { color: '#1b1e2a', trim: '#2c2f3c', accent: '#ff3b4f' },
      fog: '#090a10',
      hemi: ['#9db0e6', '#241a2c', 0.66],
      key: ['#ffd8b4', 1.5],
      accents: ['#4fb8ff', '#ff3b4f'],
    },
  },

  // ───────────────────────────── 04 DJ BOOTH (17×15)
  djBooth: {
    id: 'djBooth',
    no: '04',
    name: 'DJ BOOTH',
    subtitle: 'DJ 부스 배틀 · 리듬형 / 변형',
    desc: '중앙 대형 턴테이블(G)을 LED 무대 링이 둘러싼 랜드마크 맵. 링은 동서남북으로 열려 있다. 턴테이블은 시각적으로만 회전 — 지형은 절대 움직이지 않는다. 16초마다 BEAT DROP! 경고 후 중앙 턴테이블 둘레 3×3 에 Sound Pulse.',
    eventDesc: 'Speaker Drop 예고 후 짧은 시간 Beat Bomb 카운트가 빨라진다.',
    map: [
      '#################',
      '#S....v...v....S#',
      '#.kk.........kk.#',
      '#.kk..R...R..kk.#',
      '#....RR...RR....#',
      '#...RR.....RR...#',
      '#...............#',
      '#.D.....G.....D.#',
      '#...............#',
      '#...RR.....RR...#',
      '#....RR...RR....#',
      '#.kk..R...R..kk.#',
      '#.kk.........kk.#',
      '#S....v...v....S#',
      '#################',
    ],
    breakables: ['vinylCrate', 'flightCase', 'speakerCase'],
    // 턴테이블이 칸 단위로 회전시키므로 # 를 한 덩어리로 묶지 않는다
    solids: { merge: true, byLength: { default: 'speaker' } },
    legend: {
      G: { type: CELL.SOLID, prop: 'turntable', turntable: true },
      D: { type: CELL.SOLID, solid: true, prop: 'djDeck' },
      R: { type: CELL.SOLID, solid: true, prop: 'stageRing', single: true },
      k: { type: CELL.SOLID, solid: true, prop: 'speaker', single: true },
      v: { type: CELL.SOLID, solid: true, prop: 'vinylShelf' },
    },
    // 시작 BREAKABLE 구역 배치: SPAWN FARM 5~7 · SIDE LOOT 촘촘 · CENTRAL COMBAT 드문드문 (core/spawns.js)
    startFill: { zones: { center: [3, 2], side: 2 }, density: { center: 0.06, side: 0.8, mid: 0.56 }, farm: [5, 7] },
    gimmicks: [
      // 턴테이블 링 회전(지형 이동)은 사용하지 않는다 → BEAT DROP 으로 대체
      { kind: 'beatDrop', center: [8, 7], radius: 1, firstAt: 16, interval: 16, warnTime: 2.0 },
      { kind: 'speakerDrop', firstAt: 60, interval: 50, duration: 9, warnTime: 2, fuseMultiplier: 0.6 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'djbooth',
      border: 'room',
      floor: { a: '#1f1a2c', b: '#1a1625', line: '#0f0c16', style: 'tiles' },
      rugs: [{ x0: 6, y0: 5, x1: 10, y1: 9, color: '#24183a', trim: '#b46bff' }],
      wall: { color: '#140f22', trim: '#2a2140', accent: '#b46bff' },
      fog: '#08060e',
      hemi: ['#a296f0', '#22163a', 1.05],
      key: ['#ffd6ee', 1.75],
      accents: ['#b46bff', '#4fb8ff'],
    },
  },

  // ───────────────────────────── 05 TERRACE (19×15)
  terrace: {
    id: 'terrace',
    no: '05',
    name: 'TERRACE',
    subtitle: '테라스 배틀 · 개방형 / 긴 Wave',
    desc: '바깥쪽은 2×2 화단·파티오 세트가 줄지어 있고, 가운데는 바람 장치(G)만 있는 넓은 광장. 가로·세로 긴 통로가 열려 있어 WAVE 가 긴 캐릭터가 강한 맵.',
    eventDesc: '방향 화살표로 예고한 뒤 플레이어와 필드 아이템을 한 칸 밀어내는 Wind Event.',
    map: [
      '###################',
      '#S...............S#',
      '#.##..##...##..##.#',
      '#.##..##...##..##.#',
      '#.................#',
      '#....#.......#....#',
      '#.##...........##.#',
      '#.##.....G.....##.#',
      '#.##...........##.#',
      '#....#.......#....#',
      '#.................#',
      '#.##..##...##..##.#',
      '#.##..##...##..##.#',
      '#S...............S#',
      '###################',
    ],
    breakables: ['flowerPot', 'gardenBox', 'foldingChair'],
    solids: { merge: true, byLength: { 4: ['planterBed', 'patioSet'], 1: ['planter', 'patioTable'], default: 'planterBed' }, borderAttached: 'planter' },
    legend: { G: { type: CELL.SOLID, prop: 'windFan' } },
    // 시작 BREAKABLE 구역 배치: SPAWN FARM 5~7 · SIDE LOOT 촘촘 · CENTRAL COMBAT 드문드문 (core/spawns.js)
    startFill: { zones: { center: [4, 2], side: 2 }, density: { center: 0.06, side: 0.8, mid: 0.6 }, farm: [5, 7] },
    gimmicks: [{ kind: 'wind', firstAt: 30, interval: 25, warnTime: 3 }],
    houseEvents: null,
    dropChance: 0.48,
    theme: {
      backdrop: 'terrace',
      border: 'terrace',
      floor: { a: '#5b4a3c', b: '#514235', line: '#33291f', style: 'deck' },
      rugs: [{ x0: 7, y0: 5, x1: 11, y1: 9, color: '#2f5a5a', trim: '#ffd27a' }],
      wall: { color: '#2b2433', trim: '#4a3a2a', accent: '#ffd27a' },
      fog: '#0a0f1c',
      hemi: ['#7f9fe0', '#2a2018', 0.7],
      key: ['#b9cfff', 1.2],
      accents: ['#ffd27a', '#7f9bff'],
    },
  },

  // ───────────────────────────── 06 LOCKED ROOM (19×17)
  lockedRoom: {
    id: 'lockedRoom',
    no: '06',
    name: 'LOCKED ROOM',
    subtitle: '잠긴 방 배틀 · 고난도 / 구조 변경',
    desc: '오래된 가구가 조금씩 비뚤게 놓인 미로. 대칭이 아니라 길을 외워야 한다 (시작 위치 주변 여유는 모두 같다). 중앙 GGG 는 Old Audio Machine. Mr. ODD 가 가구를 옮겨 후반 동선이 바뀐다.',
    eventDesc: 'Mr. ODD 이벤트(경고 후)에서만 가구 1개 이동 · 암전 · 상자 낙하. 그 외에는 지형이 바뀌지 않는다.',
    map: [
      '###################',
      '#S.....#.........S#',
      '#.##.#...###..#.#.#',
      '#.#.....#.......#.#',
      '#...##....#.##....#',
      '#.#....#.......#..#',
      '##..##.#..###.....#',
      '#......#......#.#.#',
      '#.#.#...GGG.#.....#',
      '#.#...#.....#.##..#',
      '#...###.##.....#..#',
      '#.#.......#.##...##',
      '#...#.#.#.#.......#',
      '#.##....#...#.##..#',
      '#.....#.....#.....#',
      '#S..#......#.....S#',
      '###################',
    ],
    breakables: ['oldBox', 'clothCovered', 'audioCase'],
    solids: {
      merge: false,
      byLength: {
        1: [{ prop: 'cabinet', movable: true }, { prop: 'armchair', movable: true }, { prop: 'grandfatherClock', movable: false }, { prop: 'armchair', movable: true }],
        default: { prop: 'cabinet', movable: true },
      },
      borderAttached: 'wardrobe',
    },
    legend: { G: { type: CELL.SOLID, prop: 'oldAudio' } },
    // 시작 BREAKABLE 구역 배치: SPAWN FARM 5~7 · SIDE LOOT 촘촘 · CENTRAL COMBAT 드문드문 (core/spawns.js)
    startFill: { zones: { center: [3, 3], side: 2 }, density: { center: 0.06, side: 0.76, mid: 0.54 }, farm: [5, 7] },
    gimmicks: [],
    houseEvents: {
      firstAt: 90,
      interval: 70,
      warnTime: 3.0,
      events: ['furniturePush', 'lampOff', 'blockSpawn'],
      pushCount: 1,
      blockCount: 4,
      lampOffDuration: 6,
      lateScale: false, // 후반에도 간격을 줄이지 않는다
    },
    dropChance: 0.44,
    theme: {
      backdrop: 'lockedroom',
      border: 'room',
      floor: { a: '#3a3029', b: '#332a24', line: '#1f1915', style: 'planks' },
      rugs: [{ x0: 7, y0: 7, x1: 11, y1: 9, color: '#3d2a1e', trim: '#7a5a3a' }],
      wall: { color: '#221c1c', trim: '#3a2c22', accent: '#ffb35c' },
      fog: '#08080b',
      hemi: ['#9eabc8', '#251c16', 0.9],
      key: ['#ffd3a2', 1.8],
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
