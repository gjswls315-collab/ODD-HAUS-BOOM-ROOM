# Character GLB 위치

최종 캐릭터 모델을 아래 경로에 넣으면 게임이 자동으로 GLB를 사용합니다.
파일이 없으면 3D Placeholder(절차적 모델)를 사용합니다 — Placeholder 는 최종 모델이 아닙니다. 2D Sprite로 대체하지 않습니다.

## 제작 우선순위

1. VIN — 대표 캐릭터. 바닥의 Beat Bomb(납작한 LP 퍽)과 헷갈리지 않게 **큰 하얀 눈 + 빨간 신발**이 먼저 읽혀야 함
2. PICKER
3. BUDDY
4. A.A.
5. LOCKE
6. REX
7. BULLY
8. MR. ODD (House Event 전용, 플레이 불가)

GLB 가 들어와도 판정 · 충돌 · 능력치(SPEED/BOMB/WAVE)는 바뀌지 않습니다 (공통 PlayerController + 논리 그리드).

| 캐릭터 | 경로 |
| --- | --- |
| VIN | `assets/characters/vin/chr_vin.glb` |
| PICKER | `assets/characters/picker/chr_picker.glb` |
| A.A. | `assets/characters/aa/chr_aa.glb` |
| LOCKE | `assets/characters/locke/chr_locke.glb` |
| REX | `assets/characters/rex/chr_rex.glb` |
| BUDDY | `assets/characters/buddy/npc_buddy.glb` |
| BULLY | `assets/characters/bully/enemy_bully.glb` |
| MR. ODD (House Event 전용) | `assets/characters/mr-odd/boss_mr_odd.glb` |

- 모델은 로드 시 `characterVisualConfig.js`의 `height`에 맞춰 자동 스케일되고, 발이 바닥(원점)에 오도록 정렬됩니다.
- 정면은 +Z 방향이 기준입니다.
- 애니메이션 클립 이름에 `idle`, `walk`/`run`, `place`/`bomb`, `trap`/`stun`, `victory`/`win`/`dance`가 포함되어 있으면 상태에 맞춰 자동으로 재생됩니다. 클립이 없으면 절차적 애니메이션을 사용합니다.
- 게임 판정은 모델과 무관합니다(공통 PlayerController + 논리 그리드).
