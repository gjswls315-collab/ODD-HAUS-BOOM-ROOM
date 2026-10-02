// ─────────────────────────────────────────────────────────────
// GAME CONFIG — 공통 규칙 수치 (모든 캐릭터에 동일하게 적용)
// ─────────────────────────────────────────────────────────────

export const GAME_CONFIG = {
  // 고정 시뮬레이션 틱 (온라인 확장 대비 결정론적 스텝)
  tickRate: 60,

  // SPEED 레벨 → 이동 속도 (칸/초). index = 레벨
  // 레벨당 약 +0.9칸/초 (약 +25%) — SPEED UP 을 먹으면 확실히 빨라진 게 느껴지도록
  speedTable: [0, 2.6, 3.4, 4.3, 5.2, 6.1, 6.9, 7.6, 8.2],
  // 일시적인 아이템 보너스(Speed Shoes)를 포함한 절대 상한 레벨
  speedAbsoluteCapLevel: 8,

  // 이동 보정 (코너 슬라이드)
  movement: {
    cornerAssist: 0.42, // 막힌 칸 옆 통로로 미끄러지는 허용 오프셋 (칸 단위)
  },

  bomb: {
    fuseTime: 2.6, // PLACE → COUNT 전체 시간 (초)
    dropTime: 0.32, // fuse 마지막 구간 = DROP 연출 구간
    chainDelay: 0.07, // Chain Reaction 시 다음 폭탄까지 지연
    kickSpeed: 7.5, // Kick 으로 미끄러지는 속도 (칸/초)
    throwDistance: 3, // Throw 비행 칸 수
    throwFlightTime: 0.42,
    minFuseAfterLanding: 0.5,
  },

  wave: {
    lingerTime: 0.5, // Sound Wave 가 칸에 남아 판정하는 시간
    destroysItems: true, // 바닥 아이템 파괴 여부
  },

  trap: {
    // GDD v3: 약 4초 포획 → 구출 / FINISH / TIMEOUT
    battleTime: 4.0, // Solo Battle: 4초 후 자동 탈락
    teamTime: 4.0, // Team Mode: 4초 안에 팀원 구출
    trappedMoveSpeed: 0, // 초기 프로토타입: Capsule 은 셀에 고정
    pushCapsuleByWave: false, // (추후) Sound Wave 방향으로 1칸 밀리는 고급 규칙
    enemyTouchPops: true, // 상대가 캡슐을 터치하면 즉시 탈락 (FINISH)
    rescueInvulnerable: 1.0, // 구출 / NEEDLE 탈출 후 무적
    shieldInvulnerable: 1.0,
    popGraceTime: 0.35, // 갇힌 직후 바로 터지지 않는 유예
  },

  dash: {
    distance: 1.5, // 칸
    duration: 0.16, // 초
    cooldown: 2.4, // 모든 캐릭터 공통 (캐릭터 스킬 아님)
  },

  actionAnimTime: 0.24, // PLACE_BOMB / USE_ITEM 연출 상태 유지 시간

  match: {
    startCountdown: 3,
    // v4: 큰 맵 기준 한 판 4~6분 — 초반 파밍 → 중반 교전 → 후반 혼란
    battleTimeLimit: 300,
    teamTimeLimit: 300,
    resultDelay: 1.6, // 승패 확정 후 결과 화면까지
  },

  // 경기 템포 구간 (matchTime 기준). 후반에는 스테이지 기믹 / Mr. ODD 이벤트 간격이 짧아진다
  tempo: {
    earlyUntil: 70, // 0~70초: 파밍 위주 (CPU 도 아이템 우선)
    lateFrom: 200, // 200초~: 후반 혼란
    lateIntervalScale: 0.65,
  },

  items: {
    spawnProtect: 0.6, // 드랍 직후 같은 Wave 에 파괴되지 않는 시간
  },

  // 플레이어 색 (HUD / 바닥 링 / 폭탄 링)
  playerColors: ['#ff5a4f', '#4fb8ff', '#6ee3a3', '#ffc55c'],
  teamColors: { A: '#ff5a4f', B: '#4fb8ff' },
  teamNames: { A: 'RED', B: 'BLUE' },
};

export function speedLevelToCellsPerSecond(level) {
  const t = GAME_CONFIG.speedTable;
  const i = Math.max(0, Math.min(t.length - 1, Math.floor(level)));
  return t[i];
}
