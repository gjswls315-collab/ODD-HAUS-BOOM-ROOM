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
    desc: '소파·커피테이블·사이드테이블이 SOLID, LP 박스·책 더미·잡지 박스·쿠션이 BREAKABLE. 소파 네 개가 중앙 Floor Lamp 를 둘러싼 대칭 거실.',
    eventDesc: 'Mr. ODD 가 소파 하나를 밀어 통로 한 줄을 바꾼다.',
    map: [
      '#################',
      '#S..B.B...B.B..S#',
      '#.#B#.#B#B#.#B#.#',
      '#.B.B.B...B.B.B.#',
      '#B#B.###.###.B#B#',
      '#.B.B...B...B.B.#',
      '#B#.#B#...#B#.#B#',
      '#.B...#.G.#...B.#',
      '#B#.#B#...#B#.#B#',
      '#.B.B...B...B.B.#',
      '#B#B.###.###.B#B#',
      '#.B.B.B...B.B.B.#',
      '#.#B#.#B#B#.#B#.#',
      '#S..B.B...B.B..S#',
      '#################',
    ],
    breakables: ['lpBox', 'books', 'magazineBox', 'cushion'],
    solids: {
      merge: true,
      byLength: {
        1: ['sideTable', 'plant', 'speaker', 'coffeeTable', 'floorLamp', 'bookcase'],
        3: { prop: 'sofa', movable: true },
        default: 'bookcase',
      },
      borderAttached: 'bookcase',
    },
    legend: { G: { type: CELL.SOLID, prop: 'lamp', light: true } },
    gimmicks: [],
    houseEvents: {
      firstAt: 95,
      interval: 55,
      warnTime: 3.2,
      events: ['furniturePush'],
      pushCount: 1,
    },
    theme: {
      backdrop: 'lounge',
      border: 'room',
      floor: { a: '#6e4428', b: '#5f3a22', line: '#3e2414', style: 'planks' },
      rugs: [
        { x0: 5, y0: 5, x1: 11, y1: 9, color: '#7a2230', trim: '#d9a441' },
        { x0: 1, y0: 1, x1: 3, y1: 1, color: '#2b4a5a', trim: '#d9a441', kind: 'runner' },
        { x0: 13, y0: 13, x1: 15, y1: 13, color: '#2b4a5a', trim: '#d9a441', kind: 'runner' },
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
    desc: '긴 선반이 SOLID 미로를 만든다. 금색 Record Box 를 부수면 숨은 선반이 열려 위·아래 지름길이 생긴다. Bomb 배치를 실수하면 스스로 갇히기 쉽다.',
    eventDesc: '대형 LP 가 예고 후 3·11행을 굴러가며 상자를 부수고 플레이어와 아이템을 밀어낸다.',
    map: [
      '#################',
      '#S..B.B.B.B.B..S#',
      '#.##B##B#B##B##.#',
      '#...B.B...B.B...#',
      '#.#B.##.#.##.B#.#',
      '#B#.B...B...B.#B#',
      '#..B#B#...#B#B..#',
      '#.B.B.#.G.#.B.B.#',
      '#..B#B#...#B#B..#',
      '#B#.B...B...B.#B#',
      '#.#B.##.#.##.B#.#',
      '#...B.B...B.B...#',
      '#.##B##B#B##B##.#',
      '#S..B.B.B.B.B..S#',
      '#################',
    ],
    breakables: ['recordCrate', 'lpStack', 'cardboardBox'],
    solids: { merge: true, byLength: { default: 'shelf' }, borderAttached: 'shelf' },
    legend: { G: { type: CELL.SOLID, prop: 'recordPlayer' } },
    overrides: [
      { at: [7, 2], def: { type: CELL.BREAKABLE, prop: 'routeCrate', routeCrate: true } },
      { at: [8, 2], def: { type: CELL.GIMMICK, prop: 'secretShelf', gimmick: 'secretShelf' } },
      { at: [9, 12], def: { type: CELL.BREAKABLE, prop: 'routeCrate', routeCrate: true } },
      { at: [8, 12], def: { type: CELL.GIMMICK, prop: 'secretShelf', gimmick: 'secretShelf' } },
    ],
    gimmicks: [
      {
        kind: 'routeCrates',
        links: [
          { crate: [7, 2], opens: [[8, 2]] },
          { crate: [9, 12], opens: [[8, 12]] },
        ],
      },
      { kind: 'rollingLp', lanes: [3, 11], firstAt: 40, interval: 30, warnTime: 2.4, speed: 10 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'library',
      border: 'room',
      floor: { a: '#4b2e1f', b: '#42281a', line: '#2a170d', style: 'parquet' },
      rugs: [
        { x0: 1, y0: 3, x1: 15, y1: 3, color: '#2b3f6b', trim: '#c79a45', kind: 'runner' },
        { x0: 1, y0: 11, x1: 15, y1: 11, color: '#2b3f6b', trim: '#c79a45', kind: 'runner' },
        { x0: 7, y0: 6, x1: 9, y1: 8, color: '#5a2a2a', trim: '#c79a45' },
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
    desc: 'G 장비(Amp)가 공용 스위치로 연결된다. 아무 Sound Wave 나 G 에 닿으면 위·아래 장비가 내려가고 좌·우 장비가 올라오며 통로 ↔ 벽이 전환된다.',
    eventDesc: 'REC 표시 후 올라와 있는 장비 라인에 Sound Pulse 발생. 모두 똑같이 피해야 한다.',
    map: [
      '#################',
      '#S..B.B.G.B.B..S#',
      '#.#B#.#B.B#.#B#.#',
      '#.B.B.B...B.B.B.#',
      '#B#.##.#.#.##.#B#',
      '#.B.B.B...B.B.B.#',
      '#B#.#B#...#B#.#B#',
      '#.B.G...#...G.B.#',
      '#B#.#B#...#B#.#B#',
      '#.B.B.B...B.B.B.#',
      '#B#.##.#.#.##.#B#',
      '#.B.B.B...B.B.B.#',
      '#.#B#.#B.B#.#B#.#',
      '#S..B.B.G.B.B..S#',
      '#################',
    ],
    breakables: ['cableCase', 'gearBox', 'headphoneCase'],
    solids: {
      merge: true,
      byLength: { 1: ['speaker', 'micStand', 'mixerUnit', 'speaker'], 2: 'mixer', default: 'mixer' },
      borderAttached: 'speaker',
    },
    legend: { G: { type: CELL.GIMMICK, prop: 'ampGate', gimmick: 'gate' } },
    gimmicks: [
      { kind: 'gates', closed: [[8, 1], [8, 13]], open: [[4, 7], [12, 7]], cooldown: 2.5 },
      { kind: 'recPulse', firstAt: 30, interval: 28, warnTime: 1.8, range: 4 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'studio',
      border: 'room',
      floor: { a: '#2c2f38', b: '#262932', line: '#17191f', style: 'tiles' },
      rugs: [{ x0: 6, y0: 5, x1: 10, y1: 9, color: '#3b2350', trim: '#9a66ff' }],
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
    desc: 'G 는 Turntable Zone (5개). 일정 박자마다 턴테이블 둘레 8칸(가구·상자·아이템·폭탄)이 시계 방향으로 회전해 길 구조가 바뀐다.',
    eventDesc: 'Speaker Drop 예고 후 짧은 시간 Beat Bomb 카운트가 빨라진다.',
    map: [
      '#################',
      '#S..B.B...B.B..S#',
      '#.#B#.#B#B#.#B#.#',
      '#.B#B.......B#B.#',
      '#B.BG.#.B.#.GB.B#',
      '#.#.B#.....#B.#.#',
      '#B#B..#.#.#..B#B#',
      '#.B.B..BGB..B.B.#',
      '#B#B..#.#.#..B#B#',
      '#.#.B#.....#B.#.#',
      '#B.BG.#.B.#.GB.B#',
      '#.B#B.......B#B.#',
      '#.#B#.#B#B#.#B#.#',
      '#S..B.B...B.B..S#',
      '#################',
    ],
    breakables: ['vinylCrate', 'flightCase', 'speakerCase'],
    // 턴테이블이 칸 단위로 회전시키므로 # 를 한 덩어리로 묶지 않는다
    solids: { merge: false, byLength: { 1: ['speaker', 'vinylShelf', 'speaker', 'vinylShelf', 'speaker'] } },
    legend: { G: { type: CELL.SOLID, prop: 'turntable', turntable: true } },
    gimmicks: [
      { kind: 'turntables', interval: 8, warnTime: 1.2 },
      { kind: 'speakerDrop', firstAt: 60, interval: 50, duration: 9, warnTime: 2, fuseMultiplier: 0.6 },
    ],
    houseEvents: null,
    theme: {
      backdrop: 'djbooth',
      border: 'room',
      floor: { a: '#1f1a2c', b: '#1a1625', line: '#0f0c16', style: 'tiles' },
      rugs: [],
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
    desc: '화단·파티오 세트가 2×2 블록으로 모여 있어 가로·세로 긴 통로가 열려 있다 — WAVE 가 긴 캐릭터가 강한 맵. 중앙 G 는 바람 발생 장치.',
    eventDesc: '방향 화살표로 예고한 뒤 플레이어와 필드 아이템을 한 칸 밀어내는 Wind Event.',
    map: [
      '###################',
      '#S..B..B...B..B..S#',
      '#.##B.B##.##B.B##.#',
      '#.##B..##B##..B##.#',
      '#B..B.B..B..B.B..B#',
      '#..B.##.B.B.##.B..#',
      '#.BB.##.B.B.##.BB.#',
      '#B..B..B.G.B..B..B#',
      '#.BB.##.B.B.##.BB.#',
      '#..B.##.B.B.##.B..#',
      '#B..B.B..B..B.B..B#',
      '#.##B..##B##..B##.#',
      '#.##B.B##.##B.B##.#',
      '#S..B..B...B..B..S#',
      '###################',
    ],
    breakables: ['flowerPot', 'gardenBox', 'foldingChair'],
    solids: { merge: true, byLength: { 4: ['planterBed', 'patioSet'], 1: ['planter', 'patioTable'], default: 'planterBed' }, borderAttached: 'planter' },
    legend: { G: { type: CELL.SOLID, prop: 'windFan' } },
    gimmicks: [{ kind: 'wind', firstAt: 30, interval: 25, warnTime: 3 }],
    houseEvents: null,
    dropChance: 0.6,
    theme: {
      backdrop: 'terrace',
      border: 'terrace',
      floor: { a: '#5b4a3c', b: '#514235', line: '#33291f', style: 'deck' },
      rugs: [{ x0: 8, y0: 6, x1: 10, y1: 8, color: '#2f5a5a', trim: '#ffd27a' }],
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
    desc: '넓지만 오래된 가구가 빽빽해 실제 동선은 좁다. 중앙 GGG 는 Old Audio Machine. Mr. ODD 가 가구를 옮겨 후반 동선이 크게 바뀐다.',
    eventDesc: 'Mr. ODD 가 가구를 이동시켜 일부 . ↔ # 상태를 바꾸고, 불을 끄거나 상자를 떨어뜨린다.',
    map: [
      '###################',
      '#S..B#.B...B.#B..S#',
      '#.#...B#...#B...#.#',
      '#.B#B.B.#.#.B.B#B.#',
      '#B#.B##.....##B.#B#',
      '##.B.B.#.B.#.B.B.##',
      '#.B#B#..B.B..#B#B.#',
      '#B....B#.#.#B....B#',
      '##B.#B.BGGGB.B#.B##',
      '#B....B#.#.#B....B#',
      '#.B#B#..B.B..#B#B.#',
      '##.B.B.#.B.#.B.B.##',
      '#B#.B##.....##B.#B#',
      '#.B#B.B.#.#.B.B#B.#',
      '#.#...B#...#B...#.#',
      '#S..B#.B...B.#B..S#',
      '###################',
    ],
    breakables: ['oldBox', 'clothCovered', 'audioCase'],
    solids: {
      merge: true,
      byLength: {
        1: [{ prop: 'cabinet', movable: true }, { prop: 'armchair', movable: true }, { prop: 'grandfatherClock', movable: false }, { prop: 'armchair', movable: true }],
        default: { prop: 'cabinet', movable: true },
      },
      borderAttached: 'wardrobe',
    },
    legend: { G: { type: CELL.SOLID, prop: 'oldAudio' } },
    gimmicks: [],
    houseEvents: {
      firstAt: 70,
      interval: 45,
      warnTime: 3.0,
      events: ['furniturePush', 'lampOff', 'blockSpawn'],
      pushCount: 2,
      blockCount: 5,
      lampOffDuration: 6,
    },
    dropChance: 0.56,
    theme: {
      backdrop: 'lockedroom',
      border: 'room',
      floor: { a: '#3a3029', b: '#332a24', line: '#1f1915', style: 'planks' },
      rugs: [{ x0: 7, y0: 6, x1: 11, y1: 10, color: '#3d2a1e', trim: '#7a5a3a' }],
      wall: { color: '#221c1c', trim: '#3a2c22', accent: '#ffb35c' },
      fog: '#08080b',
      hemi: ['#9eabc8', '#251c16', 0.74],
      key: ['#ffd3a2', 1.65],
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
