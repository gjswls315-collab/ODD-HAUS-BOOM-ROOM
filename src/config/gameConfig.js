// ─────────────────────────────────────────────────────────────
// GAME CONFIG — 공통 규칙 수치 (모든 캐릭터에 동일하게 적용)
// ─────────────────────────────────────────────────────────────

export const GAME_CONFIG = {
  // 고정 시뮬레이션 틱 (온라인 확장 대비 결정론적 스텝)
  tickRate: 60,

  // SPEED 레벨 → 이동 속도 (칸/초). index = 레벨
  speedTable: [0, 2.7, 3.3, 3.9, 4.5, 5.1, 5.6, 6.1, 6.6],
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
    battleTime: 4.0, // Solo Battle: Sound Capsule 유지 후 탈락
    teamTime: 6.0, // Team Mode: 구출 가능 시간
    trappedMoveSpeed: 0.75, // 캡슐 안에서 천천히 굴러감 (칸/초)
    enemyTouchPops: true, // 상대가 캡슐을 터치하면 즉시 탈락
    rescueInvulnerable: 1.4,
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
    battleTimeLimit: 180,
    teamTimeLimit: 180,
    resultDelay: 1.6, // 승패 확정 후 결과 화면까지
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
