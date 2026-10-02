# ODD HAUS: BOOM ROOM

> **Simple Rules. Different Stats. Same Chaos.**
> ODD HAUS 캐릭터들이 모두 같은 규칙과 조작으로 경쟁하는 3D 쿼터뷰 파티 폭탄 게임.
> 캐릭터 차이는 스킬이 아니라 **SPEED · BOMB · WAVE 의 시작값(start)과 최대값(max)** 뿐입니다.

기획 기준: `ODD_HAUS_BOOM_ROOM_Interactive_GDD_v3.html` (V3 FINAL CORE RULES) + 구현 마스터 프롬프트 — 캐릭터 액티브 스킬 없음, 능력치·아이템·맵 전략 게임.

---

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 코어 시뮬레이션 단위 테스트 (vitest)
npm run build      # dist/ (정적 배포 가능, base: './')
npm run build:single   # dist/boom-room-single.html — JS·CSS 를 한 파일에 묶은 버전 (더블클릭으로 열기)
```

- 타이틀의 **WATCH CPU MATCH** 로 키보드 없이 CPU 4명 경기를 관전할 수 있습니다.
- 터치 기기(휴대폰·태블릿)에서는 화면에 D-pad / BOMB / DASH / ITEM / 일시정지 버튼이 나타납니다 (P1 과 같은 입력 경로). 휴대폰은 가로 화면을 권장합니다.

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

## 핵심 규칙 (GDD v3)

```
CHARACTER = Start Stats + Max Stats
ITEM      = Stat Up / Common Special Item
COMBAT    = Beat Bomb → Sound Wave → Sound Capsule
MAP       = 13×11 논리 격자 + 공용 기믹 / 이벤트
```

1. **이동** — 4방향, 모두 동일 (코너 보정 포함)
2. **Beat Bomb** — `PLACE → COUNT → DROP → SOUND WAVE → RESULT`. 동시 설치 수 = BOMB
3. **Sound Wave** — 상하좌우 십자, 거리 = 설치 시점 WAVE. SOLID 에서 정지, BREAKABLE 은 파괴 후 정지, 다른 Beat Bomb 은 Chain Reaction
4. **Sound Capsule** — `ACTIVE → WAVE HIT → TRAPPED(약 4초) → RESCUE / FINISH / TIMEOUT`
   - 팀원이 접촉 → 즉시 구출 + 약 1초 무적 / 적이 접촉 → FINISH(탈락) / 4초 경과 → 자동 탈락 / NEEDLE 보유 → E 로 탈출
   - 초기 프로토타입 규칙대로 Capsule 은 셀에 고정 (Wave 방향 1칸 밀림은 `gameConfig.trap.pushCapsuleByWave` 자리만 마련)
5. **성장** — BREAKABLE 파괴 시 드랍되는 아이템으로 능력치 +1, **캐릭터 MAX 에서 정지** (ROLLER SKATES 만 잠깐 MAX+1)

### 캐릭터 능력치 (`src/config/characterConfig.js`, 5칸 척도)

| 캐릭터 | SPEED | BOMB | WAVE | 성향 |
| --- | --- | --- | --- | --- |
| VIN | 3 → 4 | 1 → 4 | 2 → 5 | 가장 균형적인 기본형 |
| PICKER | 4 → 5 | 1 → 3 | 1 → 4 | 초반부터 빠른 스피드형 |
| A.A. | 2 → 4 | 2 → 5 | 2 → 4 | 폭탄을 많이 놓는 물량형 |
| LOCKE | 3 → 4 | 2 → 4 | 2 → 4 | 안정적인 올라운더 |
| REX | 2 → 3 | 1 → 4 | 3 → 5 | 느리지만 장거리 파동형 |
| BUDDY | 3 → 5 | 2 → 4 | 2 → 3 | 초보자에게 편한 기동형 |
| BULLY | 4 → 5 | 1 → 3 | 2 → 5 | 빠르고 공격적인 고점형 |
| MR. ODD | – | – | – | 플레이 불가 / 맵 이벤트 |

MAX 총합은 맞추지 않고 장단점을 명확하게 했습니다. SPEED 레벨 → 실제 칸/초는 `gameConfig.speedTable` 에서 조정합니다.
애니메이션은 캐릭터마다 다릅니다 (Beat Bomb 설치: PICKER 툭 던지기, REX 묵직하게, BUDDY 앞발로 등) — 판정은 동일.

### 아이템 10종 (`src/config/itemConfig.js`) — 드랍 Speed 30% · Bomb 30% · Wave 30% · Special 10%

| 아이템 | 종류 | 효과 |
| --- | --- | --- |
| SPEED UP / BOMB UP / WAVE UP | 기본 성장 | 해당 능력치 +1 (캐릭터 MAX 까지) |
| KICK | 능력 (그 판 유지) | Bomb 에 몸이 닿으면 진행 방향으로 걷어참 → 벽에서 정지 |
| GLOVE / THROW | 능력 | Bomb 옆에서 E — 들어 올려 앞으로 던짐 |
| REMOTE | 능력 | E — 내 가장 오래된 Bomb 부터 즉시 발동 |
| SHIELD | 보유 1칸 | Sound Wave 1회 자동 방어 후 깨짐 |
| NEEDLE | 보유 1칸 | Sound Capsule 에 갇혔을 때 E — 즉시 탈출 |
| ROLLER SKATES | 보유 1칸 | E — 6초간 SPEED = 캐릭터 MAX + 1 (예: PICKER 5 → 6) |
| RANDOM LP BOX | 즉시 | Speed / Bomb / Wave / Shield / Kick 중 하나 |

아이템 키는 E 하나입니다. 우선순위: 갇힘+NEEDLE 탈출 → GLOVE 던지기 → ROLLER SKATES → REMOTE.
KICK·GLOVE·REMOTE 를 "그 판 동안 유지되는 능력"으로 둔 것은 키 하나로 여러 특수 아이템을 함께 쓰기 위한 구현 결정입니다 (`itemConfig.js` 의 `kind` 로 변경 가능).

### 스테이지 6종 (`src/config/stageConfig.js`) — GDD v3 13×11 격자 그대로, 모든 기믹 공용

`#` SOLID · `B` BREAKABLE · `.` 이동 · `S` SPAWN · `G` GIMMICK

| # | Stage | G / 공용 기믹 | 이벤트 |
| --- | --- | --- | --- |
| 01 | LOUNGE (기본기) | 중앙 Floor Lamp. `###` = 소파(이동 가능), 단독 `#` = 커피테이블·사이드테이블·화분 | MR. ODD 가 소파를 밀어 통로 변경 |
| 02 | LP LIBRARY (좁은 통로) | 중앙 청음 스테이션. 금색 Record Box 2개를 부수면 숨은 선반이 열려 새 경로 | 예고 후 대형 Rolling LP 가 한 행을 굴러가며 상자를 부수고 플레이어·아이템을 밀어냄 |
| 03 | STUDIO (기계 기믹) | G = Amp 장비 4개. 아무 Wave 나 G 에 닿으면 장비가 오르내려 벽 ↔ 통로 전환 | REC 예고 후 올라와 있는 장비 라인에 Sound Pulse |
| 04 | DJ BOOTH (움직이는 맵) | G = Turntable 6개. 일정 박자마다 둘레 8칸(벽·상자·폭탄·아이템)이 회전해 길 구조 변경 | Speaker Drop — 짧은 시간 Bomb 카운트 가속 |
| 05 | TERRACE (개방형 + 긴 Wave) | G = 바람 장치. 벽이 적어 WAVE 가 긴 캐릭터가 유리 | Wind — 방향 예고 후 플레이어·아이템 한 칸 밀림 |
| 06 | LOCKED ROOM (맵 변화) | 중앙 GGG = Old Audio Machine. 벽에 붙지 않은 가구 8개가 이동 가능 | MR. ODD 가 가구 2개씩 이동(. ↔ #) · 암전 · 상자 낙하 |

맵은 ASCII 논리 격자로 정의되고, `#` 를 어떤 가구로 보여줄지(`solids`)와 `G` 의 기믹은 스테이지별 설정입니다. 3D 메쉬(`src/render/propFactory.js`)는 그리드 규칙과 분리되어 있습니다.

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
│   ├── gimmicks/               routeCrates, rollingLp, gates, recPulse, turntables, speakerDrop, wind, doors
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

`npm test` — 70개

| 39절 기준 | 테스트 |
| --- | --- |
| VIN 선택 → 초기 Stats 적용 → 아이템 획득 시 증가 → MAX 에서 정지 | `characterStats.test.js` |
| PICKER: VIN 과 같은 조작, Speed 차이 | 〃 (같은 컨트롤러 클래스 + 이동 거리 비교) |
| A.A.: Bomb Capacity 차이 | 〃 |
| REX: Wave Range 차이 | 〃 |
| 7명 모두 Move / Bomb / Item / Trap / Victory 동일 시스템 | 〃 |
| Beat Bomb · Wave · Chain Reaction · 아이템 10종 · NEEDLE · 포획/구출 · 팀 모드 | `bombWave.test.js`, `itemsTrap.test.js` |
| 6개 맵이 GDD v3 13×11 격자와 동일 · 기믹 · MR. ODD House Event | `stages.test.js` |
| 스킬/캐릭터별 컨트롤러/Q 바인딩 재유입 방지, 코어의 Three.js 비의존 | `architecture.test.js` |
| 모든 스테이지 × BATTLE/TEAM, CPU 4인 150초 무오류 | `architecture.test.js` |

브라우저(Chromium)에서도 확인했습니다.
- Lounge: 실제 키 입력(이동 D / 설치 SPACE)과 아이템 성장·MAX 정지 — VIN·PICKER·A.A.·REX
- 로컬 2P: P1(WASD)·P2(방향키/ENTER)가 서로 독립적으로 이동·설치
- 화면 흐름: 타이틀 → 조작법 → BATTLE → 캐릭터 선택 → 스테이지 선택 → 카운트다운 → 일시정지/재개 → 결과
- 6개 스테이지 렌더링, MR. ODD House Event 연출

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
