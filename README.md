# ODD HAUS: BOOM ROOM

> **Simple Rules. Different Stats. Same Chaos.**
> ODD HAUS 캐릭터들이 모두 같은 규칙과 조작으로 경쟁하는 3D 쿼터뷰 파티 폭탄 게임.
> 캐릭터 차이는 스킬이 아니라 **SPEED · BOMB · WAVE 의 시작값(start)과 최대값(max)** 뿐입니다.

기획 기준: `ODD_HAUS_BOOM_ROOM_Interactive_GDD_v2.html` + 구현 마스터 프롬프트 (캐릭터 액티브 스킬 구조 폐기, 능력치 기반 룰).

---

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 코어 시뮬레이션 단위 테스트 (vitest)
npm run build      # dist/ (정적 배포 가능, base: './')
```

빠른 시작(개발/테스트용 URL 파라미터):

```
/?play=battle&stage=lounge&p=vin,cpu:picker            # VIN(사람) vs PICKER(CPU)
/?play=team&stage=lockedRoom&p=vin,cpu:rex,cpu:aa,cpu:buddy
/?play=battle&stage=djBooth&p=cpu:vin,cpu:picker,cpu:aa,cpu:rex&fast=1   # 관전
```

`F3` 디버그 오버레이(현재/최대 능력치, 이동속도, GLB 사용 여부) · `M` 음소거

## 조작 — 모든 캐릭터 동일 (캐릭터 전용 키 없음, Q 키 미사용)

| 동작 | 혼자 플레이 | P1 | P2 | P3 | P4 | 게임패드 |
| --- | --- | --- | --- | --- | --- | --- |
| 이동 | WASD / 방향키 | WASD | 방향키 | IJKL | NUM 8456 | 스틱 / D-pad |
| Beat Bomb | SPACE | SPACE | ENTER | U | NUM 7 | A |
| Dash (짧은 회피) | SHIFT | L-SHIFT | R-SHIFT | Y | NUM 1 | X / RB |
| 특수 아이템 | E | E | / | O | NUM 9 | B |
| Pause | ESC | | | | | Start |

키 배치는 `src/config/inputConfig.js` 에서 수정합니다.

---

## [CURRENT] 기존 프로젝트 분석 결과

작업 시작 시점의 저장소(`gjswls315-collab/ODD-HAUS-BOOM-ROOM`) 상태를 분석했습니다.

| 분석 항목 | 결과 |
| --- | --- |
| 저장소 | **커밋/브랜치/파일이 없는 빈 저장소** (원격도 비어 있음) |
| 캐릭터별 Skill 코드 위치 | 저장소 안에는 없음. GDD v2 의 "삭제되는 시스템"(Vin Resonance, Picker Dash, A.A. Overcharge, Locke Secret Door, Rex Royal Push)으로만 언급됨 |
| Player Controller 구조 | 없음. GDD 내장 2D 프로토타입에 단일 플레이어 객체 `p = { stats, max, active }` 만 존재 |
| Bomb 구조 | GDD 프로토타입: `plant()` / `boom()` — 1.5초 퓨즈, 십자 전파, 벽에서 정지, 상자 파괴 후 정지 (연쇄 폭발·포획 없음) |
| Item 구조 | GDD 프로토타입: speed/bomb/wave 3종, `min(stat + 1, max)` 로 성장 (특수 아이템 없음) |
| Stage 구조 | GDD 프로토타입: 11×8 고정 격자 1개 (3D·기믹 없음) |
| UI 의 Skill 관련 부분 | 없음 (GDD HUD 목업도 "캐릭터 스킬 게이지 삭제"로 명시) |

따라서 "유지할 것"은 **GDD 프로토타입의 규칙(격자, 십자 Wave, SOLID 정지/BREAKABLE 파괴, `min(start + items, max)` 성장 공식)** 이었고,
이를 그대로 계승해 구현 마스터 프롬프트의 구조(공통 PlayerController + CharacterStats Config + CharacterVisual)로 새로 구축했습니다.
삭제 대상인 캐릭터 스킬 / 스킬 게이지 / 쿨다운 / Q 스킬 UI 는 처음부터 만들지 않았고, `tests/architecture.test.js` 가 재유입을 막습니다.

> 이전 스킬 기반 코드가 다른 저장소(예: `odd-haus-3d`)에 있다면 알려주세요. 이번 세션은 이 저장소만 접근하도록 설정되어 있어 다른 저장소는 열람하지 않았습니다.

---

## 핵심 규칙 (GDD v2)

1. **이동** — 4방향, 모두 동일 (코너 보정 포함)
2. **Beat Bomb** — `PLACE → COUNT → DROP → SOUND WAVE → RESULT`. 동시 설치 수 = BOMB
3. **Sound Wave** — 상하좌우 십자, 거리 = 설치 시점 WAVE. SOLID 에서 정지, BREAKABLE 은 파괴 후 정지, 다른 Beat Bomb 은 Chain Reaction
4. **포획** — Wave 에 맞으면 즉사가 아니라 **Sound Capsule** 에 갇힘 → 팀원이 구출 / 상대가 건드리면 POP(탈락) / 시간 초과 시 탈락
5. **성장** — BREAKABLE 파괴 시 드랍되는 아이템으로 능력치 +1, **캐릭터 max 에서 정지**

### 캐릭터 능력치 (`src/config/characterConfig.js`, 초기 밸런스 가안)

| 캐릭터 | 성향 | SPEED | BOMB | WAVE |
| --- | --- | --- | --- | --- |
| VIN | BALANCED | 3 → 5 | 1 → 3 | 2 → 5 |
| PICKER | FAST START | 4 → 5 | 1 → 3 | 2 → 4 |
| A.A. | MORE BOMBS | 2 → 4 | 2 → 5 | 2 → 4 |
| LOCKE | STEADY | 3 → 4 | 2 → 4 | 3 → 4 |
| REX | LONG WAVE | 2 → 4 | 1 → 3 | 3 → 5 |
| BUDDY | EASY START | 4 → 5 | 1 → 4 | 2 → 4 |
| BULLY | AGGRESSIVE | 4 → 5 | 1 → 3 | 3 → 4 |
| MR. ODD | 플레이 불가 — House Event 전용 | – | – | – |

수치는 마스터 프롬프트 6절 값입니다. GDD v2 HTML 표와 다른 항목(VIN BOMB max 4 등)은 파일 상단 주석에 남겨 두었습니다.
SPEED 레벨 → 실제 칸/초 변환은 `gameConfig.speedTable` 에서 조정합니다.

### 아이템 (`src/config/itemConfig.js`)

- 기본 성장: **SPEED UP / BOMB UP / WAVE UP** (+1, 캐릭터 max 까지)
- 특수(누구나 획득, Held Item 1칸, `E` 사용): **KICK**(앞 폭탄 차기) · **THROW**(폭탄 던지기) · **SHIELD**(Wave 1회 자동 방어) · **REMOTE**(내 폭탄 원격 발동) · **SPEED SHOES**(일시 가속 — 기본 Stats 와 분리된 modifier) · **RANDOM BOX**
- 드랍 확률/가중치는 `DROP_TABLES` 에서 관리

### 스테이지 6종 (`src/config/stageConfig.js`) — 모든 기믹은 공용

| # | Stage | 공용 기믹 | Mr. ODD House Event |
| --- | --- | --- | --- |
| 01 | LOUNGE (입문) | 소파·테이블 SOLID / LP박스·책 BREAKABLE | 소파 위치 이동 |
| 02 | LP LIBRARY (미로) | 금색 Record Box 파괴 → 숨은 선반 열림(새 Route), **Rolling LP** 해저드(경고 후 통로 굴러감) | 상자 낙하 |
| 03 | STUDIO (장비) | **REC 스위치**(밟거나 Wave 로 작동) → 앰프 Sound Pulse (발사 전 라인 경고) | 조명 OFF / 상자 낙하 |
| 04 | DJ BOOTH (동적) | **턴테이블 링 회전**(링 위 상자·폭탄·아이템·플레이어 이동), **Speaker Drop**(카운트 가속) | 조명 OFF / 상자 낙하 |
| 05 | TERRACE (개방) | **Wind** — 방향을 3초 전 표시 후 플레이어·아이템 한 칸 밀림 | String Light 암전 / 상자 낙하 |
| 06 | LOCKED ROOM (고난도) | 레버로 모든 문 열림/닫힘 | 잦은 이벤트: 캐비닛 대이동 · 문 전환 · 암전 · 상자 낙하 |

맵은 ASCII 논리 그리드(`EMPTY / SOLID / BREAKABLE / GIMMICK / SPAWN / ITEM / HAZARD`)로 정의되며, 3D 메쉬(`src/render/propFactory.js`)는 그리드 규칙과 분리되어 있습니다.

### 게임 모드

- **BATTLE MODE** — 2~4인, Last Player Standing (제한시간 종료 시 생존자 점수 판정)
- **TEAM MODE** — 2 VS 2, 갇힌 팀원 구출, 팀 전원 포획 시 팀 탈락
- ITEM / HOUSE EVENT / CO-OP / CUSTOM — 타이틀에 COMING SOON 으로 표시 (확장 예정)
- 빈 슬롯은 **CPU** 로 채울 수 있음 — CPU 도 사람과 같은 intent(이동/폭탄/대시/아이템)를 공통 PlayerController 에 넣습니다

---

## 코드 구조

```
src/
├── config/                     ← 데이터 (밸런스 / 맵 / 키) — 코드에 하드코딩 금지
│   ├── characterConfig.js      CHARACTERS: speed/bomb/wave { start, max }
│   ├── characterVisualConfig.js GLB 경로 + 애니메이션 personality (판정과 무관)
│   ├── itemConfig.js           ITEM_TYPES / DROP_TABLES / RANDOM_BOX_POOL
│   ├── stageConfig.js          6개 Arena 논리 그리드 + 기믹 + House Event + 테마
│   ├── gameConfig.js           퓨즈·Wave·포획·대시·속도표 등 공통 규칙 수치
│   └── inputConfig.js          키 프로필 (Q 미사용)
├── core/                       ← 순수 시뮬레이션 (Three.js / DOM 의존 없음, 고정 60Hz 틱)
│   ├── GameManager.js          경기 1판: 단계(카운트다운/진행/종료), 이벤트 큐
│   ├── GridManager.js          논리 그리드, 가구 그룹, 파괴/이동
│   ├── PlayerManager.js        생성·스폰, Sound Capsule 포획/구출/탈락
│   ├── PlayerController.js     ★ 모든 캐릭터 공통 컨트롤러 (이동·대시·설치·아이템)
│   ├── CharacterStats.js       start/current/max — min(start + items, max)
│   ├── BeatBombManager.js      설치·카운트·DROP·Kick 슬라이드·Throw 비행
│   ├── SoundWaveManager.js     십자 전파, 파괴, Chain Reaction, linger 판정
│   ├── ItemManager.js          드랍·획득·특수 아이템 효과(ITEM_EFFECTS)
│   ├── StageManager.js         스테이지 기믹 레지스트리
│   ├── HouseEventManager.js    MR. ODD IS COMING — 경고 → 그리드 변경
│   ├── modes.js                BATTLE / TEAM 규칙
│   ├── gimmicks/               routeCrates, rollingLp, recStudio, turntables, speakerDrop, wind, doors
│   └── ai/BotBrain.js          CPU (위험 지도 + 경로 유지)
├── render/                     ← Three.js 3D Quarter-view
│   ├── GameRenderer.js         PerspectiveCamera(50° 하향, 아레나 자동 맞춤), 조명, 이벤트 연출
│   ├── StageView.js            바닥/벽/배경 + 그리드 그룹 ↔ 메쉬 재조정
│   ├── EntityViews.js          PlayerRoot(VisualModel/BombOrigin/ItemOrigin/PlayerIndicator), Beat Bomb, Sound Wave, 아이템, 경고, Rolling LP, MR. ODD
│   ├── characters/             CharacterVisual(GLB 우선 → 3D Placeholder), placeholders
│   ├── propFactory.js          스테이지 소품 30여 종 (정적 메쉬 자동 병합)
│   ├── Fx.js / textures.js / kit.js / PortraitRenderer.js
├── ui/UIManager.js, styles.css ← 타이틀 / 캐릭터 선택(START·MAX) / 스테이지 선택 / HUD / 일시정지 / 결과
├── input/InputManager.js       키보드 + 게임패드 → intent
├── audio/AudioManager.js       WebAudio 합성 비트 & 효과음
├── App.js                      화면 흐름 + 메인 루프
└── main.js
```

설계 원칙
- **게임 로직은 공통, 캐릭터 차이는 데이터** — `VinController` 같은 캐릭터별 컨트롤러 없음
- 3D 그래픽과 게임 로직 그리드 분리 → 메쉬/GLB 를 바꿔도 판정 동일, 추후 온라인 동기화 기반
- 애니메이션 personality 만 캐릭터별 (`placeStyle`: VIN 차분히 / PICKER 툭 던지듯 / A.A. 묵직하게 / LOCKE 주변 확인 / REX 무겁게 / BUDDY 앞발로 / BULLY 차듯이)

## 캐릭터 GLB

`public/assets/characters/<id>/...glb` 에 넣으면 자동 사용 (경로표: `public/assets/characters/README.md`).
없으면 원본 디자인 특징(VIN 검은 LP + 큰 눈, PICKER 빨간 피크 + 화난 눈, A.A. 비니 쓴 노란 배터리, LOCKE 열쇠 머리 + 갈색 모자, REX 왕관 + 빨간 망토, BUDDY 크림색 강아지, BULLY 뒤로 쓴 빨간 모자 + 기타, MR. ODD 곱슬머리 + 콧수염 + 체크 셔츠)을 따른 **3D Placeholder** 를 사용합니다. 2D Sprite 대체는 하지 않습니다.

---

## 테스트 (마스터 프롬프트 39절 기준)

`npm test` — 65개

| 39절 기준 | 테스트 |
| --- | --- |
| VIN 선택 → 초기 Stats 적용 → 아이템 획득 시 증가 → MAX 에서 정지 | `characterStats.test.js` |
| PICKER: VIN 과 같은 조작, Speed 차이 | 〃 (같은 컨트롤러 클래스 + 이동 거리 비교) |
| A.A.: Bomb Capacity 차이 | 〃 |
| REX: Wave Range 차이 | 〃 |
| 7명 모두 Move / Bomb / Item / Trap / Victory 동일 시스템 | 〃 |
| Beat Bomb · Wave · Chain Reaction · 아이템 · 포획/구출 · 팀 모드 | `bombWave.test.js`, `itemsTrap.test.js` |
| 6개 스테이지 그리드 유효성 · 기믹 · MR. ODD House Event | `stages.test.js` |
| 스킬/캐릭터별 컨트롤러/Q 바인딩 재유입 방지, 코어의 Three.js 비의존 | `architecture.test.js` |
| 모든 스테이지 × BATTLE/TEAM, CPU 4인 150초 무오류 | `architecture.test.js` |

브라우저(Chromium)에서 Lounge 기준으로 실제 키 입력(이동 D / 설치 SPACE)과 아이템 성장·MAX 정지를 VIN·PICKER·A.A.·REX 로 확인했습니다.

## 개발 단계 현황

| Phase | 내용 | 상태 |
| --- | --- | --- |
| 01 | Core Grid Prototype (이동, 설치, 카운트, Wave, 파괴, 기본 아이템) | ✅ |
| 02 | Lounge Vertical Slice (3D 맵, VIN·PICKER, Local 2P, UI, Victory) | ✅ |
| 03 | Character Stats (7인 config, Start/Max, 캐릭터 선택, Stat Item) | ✅ |
| 04 | Item System (Speed/Bomb/Wave Up, Kick, Throw, Shield, Remote, Speed Shoes, Random) | ✅ |
| 05 | Map Expansion (LP Library, Studio, DJ Booth, Terrace, Locked Room) | ✅ 1차 |
| 06 | Mr. ODD House Event | ✅ 1차 (가구 이동 / 문 / 암전 / 상자 낙하) |
| 07 | Local 4P (키보드 4프로필 + 게임패드) | ✅ |
| 08 | Online Multiplayer | ⏳ 코어가 결정론적 고정 틱이라 입력 동기화 방식으로 확장 예정 |
| 09 | Polish (최종 GLB, 애니메이션, 사운드, 밸런스) | ⏳ |
