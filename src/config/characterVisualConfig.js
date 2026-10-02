// ─────────────────────────────────────────────────────────────
// CHARACTER VISUAL CONFIG — 비주얼 / 애니메이션 성격 (게임 판정과 무관)
//
// PlayerRoot
// ├── VisualModel      ← 캐릭터별 GLB (없으면 3D Placeholder, 2D Sprite 대체 금지)
// ├── Collision        ← 공통 (논리 그리드 셀)
// ├── BombOrigin
// ├── ItemOrigin
// └── PlayerIndicator
//
// Gameplay Rule 은 모두 같고, 애니메이션 personality 만 다르다.
//   placeStyle: Beat Bomb 설치 모션
//   walk: { bob, freq, lean, sway }
//   victory: 승리 포즈
//
// GLB 애니메이션 클립 이름 규칙(대소문자 무관, 포함 검색):
//   idle / walk|run / place|bomb / trap|stun / victory|win|dance
// ─────────────────────────────────────────────────────────────

export const CHARACTER_VISUALS = {
  vin: {
    glb: 'assets/characters/vin/chr_vin.glb',
    height: 0.95,
    placeStyle: 'calm', // 차분하게 LP 장치를 내려놓음
    walk: { bob: 0.06, freq: 9, lean: 0.12, sway: 0.08 },
    victory: 'spin',
    accent: '#ff5a4f',
  },
  picker: {
    glb: 'assets/characters/picker/chr_picker.glb',
    height: 0.95,
    placeStyle: 'flick', // 빠르게 툭 던지듯
    walk: { bob: 0.08, freq: 12, lean: 0.2, sway: 0.05 },
    victory: 'jump',
    accent: '#ff3b3b',
  },
  aa: {
    glb: 'assets/characters/aa/chr_aa.glb',
    height: 0.95,
    placeStyle: 'heavy', // 조금 묵직하게
    walk: { bob: 0.05, freq: 8, lean: 0.08, sway: 0.1 },
    victory: 'flex',
    accent: '#ffd23f',
  },
  locke: {
    glb: 'assets/characters/locke/chr_locke.glb',
    height: 0.98,
    placeStyle: 'cautious', // 주변을 확인하며
    walk: { bob: 0.05, freq: 9, lean: 0.1, sway: 0.06 },
    victory: 'tipHat',
    accent: '#d9a441',
  },
  rex: {
    glb: 'assets/characters/rex/chr_rex.glb',
    height: 1.0,
    placeStyle: 'royal', // 무겁게 내려놓음
    walk: { bob: 0.04, freq: 7, lean: 0.05, sway: 0.12 },
    victory: 'royal',
    accent: '#c8102e',
  },
  buddy: {
    glb: 'assets/characters/buddy/npc_buddy.glb',
    height: 0.8,
    placeStyle: 'paw', // 앞발로 툭 밀어
    walk: { bob: 0.07, freq: 13, lean: 0.06, sway: 0.1 },
    victory: 'wag',
    accent: '#e8c48a',
  },
  bully: {
    glb: 'assets/characters/bully/enemy_bully.glb',
    height: 1.0,
    placeStyle: 'kick', // 장난스럽게 차듯
    walk: { bob: 0.07, freq: 11, lean: 0.16, sway: 0.07 },
    victory: 'guitar',
    accent: '#3fa34d',
  },
  mrOdd: {
    glb: 'assets/characters/mr-odd/boss_mr_odd.glb',
    height: 4.2,
    placeStyle: null,
    walk: { bob: 0.02, freq: 3, lean: 0, sway: 0.05 },
    victory: null,
    accent: '#c8102e',
  },
};
