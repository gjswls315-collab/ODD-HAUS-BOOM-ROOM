# ODD HAUS: BOOM ROOM

> **Simple Rules. Different Stats. Same Chaos.**
> ODD HAUS 캐릭터들이 모두 같은 규칙과 조작으로 경쟁하는 3D 쿼터뷰 파티 폭탄 게임.
> 캐릭터 차이는 스킬이 아니라 **SPEED · BOMB · WAVE 의 시작값(start)과 최대값(max)** 뿐입니다.

기획 기준: `ODD_HAUS_BOOM_ROOM_Interactive_GDD_v3.html` (V3 FINAL CORE RULES) + **BOOM ROOM v4 — Bigger Arena / Smarter CPU / Stronger ODD HAUS Identity** + 구현 마스터 프롬프트 — 캐릭터 액티브 스킬 없음, 능력치·아이템·맵 전략 게임.

---

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 코어 시뮬레이션 단위 테스트 (vitest)
npm run build      # dist/ (정적 배포 가능, base: './')
npm run build:single   # dist/boom-room-single.html — JS·CSS 를 한 파일에 묶은 버전 (더블클릭으로 열기)
```

- **GitHub Pages**: 저장소 Settings → Pages 에서 이 브랜치의 `/ (root)` 를 배포하면 빌드 없이 그대로 실행됩니다 (`index.html` 의 import map 이 three.js 를 CDN 에서 불러옴, `.nojekyll` 포함). 주소: `https://<계정>.github.io/<저장소>/`
- 타이틀의 **WATCH CPU MATCH** 로 키보드 없이 CPU 4명 경기를 관전할 수 있습니다.
- 터치 기기(휴대폰·태블릿)에서는 화면에 D-pad / BOMB / ITEM / 일시정지 버튼이 나타납니다 (P1 과 같은 입력 경로). 휴대폰은 가로 화면을 권장합니다.

빠른 시작(개발/테스트용 URL 파라미터):

```
/?play=battle&stage=lounge&p=vin,cpu:picker            # VIN(사람) vs PICKER(CPU)
/?play=team&stage=lockedRoom&p=vin,cpu:rex,cpu:aa,cpu:buddy
/?play=battle&stage=djBooth&p=cpu:vin,cpu:picker,cpu:aa,cpu:rex&fast=1   # 관전
```

`F3` 디버그 오버레이(현재/최대 능력치, 이동속도, GLB 사용 여부) · `M` 음소거 · `N` 미니맵 켜기/끄기 (터치: 타이머 탭)

## 조작 — 모든 캐릭터 동일: 이동 / Beat Bomb / Item 뿐 (대시·캐릭터 전용 키 없음, Q 키 미사용)

| 동작 | 혼자 플레이 | P1 | P2 | P3 | P4 | 게임패드 |
| --- | --- | --- | --- | --- | --- | --- |
| 이동 | WASD / 방향키 | WASD | 방향키 | IJKL | NUM 8456 | 스틱 / D-pad |
| Beat Bomb | SPACE | SPACE | ENTER | U | NUM 7 | A |
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
MAP       = 17×15 ~ 19×17 논리 격자 (v4) + 공용 기믹 / 이벤트
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

MAX 총합은 맞추지 않고 장단점을 명확하게 했습니다. SPEED 레벨 → 실제 칸/초는 `gameConfig.speedTable` 에서 조정합니다 (레벨당 약 +0.9칸/초 ≈ +25%: 2 → 3.4 · 3 → 4.3 · 4 → 5.2 · 5 → 6.1). 처음보다 빨라진 캐릭터는 발밑에 먼지 자국이 남습니다.
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

### 스테이지 6종 (`src/config/stageConfig.js`) — 맵마다 다른 실루엣, 모든 기믹 공용

`#` SOLID(실제 가구) · `B` BREAKABLE(스테이지 소품) · `.` 이동 · `S` SPAWN · `G` GIMMICK · 그 외 글자는 스테이지 전용 가구(예: `T` 커피테이블, `W` 부스 벽, `R` 무대 링)

| # | Stage | 크기 | 정체성 (한눈에 다른 맵) | 시작 BREAKABLE | 기믹 / 이벤트 (지형 변화) |
| --- | --- | --- | --- | --- | --- |
| 01 | LOUNGE (기본기) | 17×15 | **소파 섬 4개** (소파 + 커피테이블 + 러그) 가 중앙 **Floor Lamp**(사이드테이블 4개)를 둘러쌈 | 약 77개 | **고정형** — 지형 변화 없음 |
| 02 | LP LIBRARY (통로) | 17×15 | **가로로 긴 LP 선반 줄** → 선반 사이 긴 복도(aisle), 중앙 청음 스테이션 줄 | 약 79개 | **고정형** — 지형 변화 없음 |
| 03 | STUDIO (기계) | 17×15 | 오른쪽 위 **유리 녹음 부스**(입구 3곳, 안에 Amp) + 왼쪽 아래 **5×2 믹서 데스크** → L자 공간, Amp 3대 | 약 78개 | **거의 고정형** — Amp 는 Wave 에 불빛만 반응. REC 예고 후 Sound Pulse (지형 그대로) |
| 04 | DJ BOOTH (리듬) | 17×15 | 중앙 **대형 턴테이블**을 **네온 무대 링**이 둘러쌈 (동서남북 입구), 모서리 스피커 타워, 양옆 보조 덱 | 약 76개 | **턴테이블은 시각적으로만 회전** — 지형 이동 없음. 16초마다 **BEAT DROP!** 경고 후 중앙 3×3 Sound Pulse. Speaker Drop (폭탄 카운트 가속) |
| 05 | TERRACE (개방형) | 19×15 | 바깥 **2×2 화단·파티오 세트**, 가운데는 바람 장치만 있는 **넓은 광장** | 약 86개 | **바람만** — 예고 후 플레이어·아이템 한 칸 밀림 |
| 06 | LOCKED ROOM (고난도) | 19×17 | 조금씩 **비뚤게 놓인 오래된 가구 미로** (비대칭 — 길을 외워야 함), 중앙 Old Audio Machine | 약 96개 | **Mr. ODD 이벤트 때만** — 경고 후 가구 1개 이동 · 암전 · 상자 낙하 (90초에 처음, 이후 70초마다) |

- 맵 전체가 대칭일 필요는 없습니다 — 공정성은 **시작 위치 주변 여유**로 맞춥니다. **시작 위치는 매 경기 랜덤** (`src/core/spawns.js`): 서로 멀리 떨어진 빈 칸, 시작 칸에서 수직 두 방향 2칸씩(L자) 비움, 중앙 전투 구역 · 턴테이블 주변에서는 시작하지 않음. (`?spawn=fixed` 로 모서리 고정 시작)
- **시작 BREAKABLE 구역 배치** (`stage.startFill`, `fillBreakables`) — 총 수량은 이전과 같고 위치만 나눕니다
  - **SPAWN FARM ZONE**: 시작 위치에서 2~3칸 → 상자 5~7개 (시작하자마자 부술 상자, 너무 많아 갇히지는 않음)
  - **SIDE LOOT ZONE**: 맵 가장자리 띠 → 촘촘 (약 65%) — 아이템 파밍 구역
  - **CENTRAL COMBAT ZONE**: 맵 중앙 → 드문드문 (약 5~10%) — 전투 공간
  - 그 외 중간 구역 약 45~50%
- 시작 BREAKABLE 약 76~96개 × 드랍 확률(기본 55%, Terrace 48%, Locked Room 44%) → **한 판 아이템 약 40개**.
- 스테이지별 BREAKABLE: Lounge LP 박스·책 더미·잡지 박스·쿠션 / LP Library 레코드 크레이트·LP 더미·골판지 상자 / Studio 케이블 케이스·장비 상자·헤드폰 케이스 / DJ Booth 바이닐 크레이트·플라이트 케이스·스피커 케이스 / Terrace 작은 화분·원예 상자·접이식 의자 / Locked Room 오래된 상자·천 덮인 작은 물건·오래된 오디오 케이스

맵은 ASCII 논리 격자로 정의되고, 가구 종류(`solids`, `legend`)와 `G` 의 기믹은 스테이지별 설정입니다. 3D 메쉬(`src/render/propFactory.js`)는 그리드 규칙과 분리되어 있습니다.

### 경기 템포 (v4)

- 한 판 **5분** (`gameConfig.match`) — 0~70초 **초반 파밍** → **중반 교전** → 200초~ **후반 혼란**
- 후반에는 스테이지 기믹 / MR. ODD 이벤트 간격이 0.65배로 짧아집니다 (`gameConfig.tempo`, `GameManager.tempoInterval`)

### CPU (State Machine + A* + Stuck Recovery) — `src/core/ai/BotBrain.js`

```
SCAN → ITEM SEEK → ATTACK → ESCAPE → POSITIONING → SCAN   (갈 곳이 정말 없을 때만 WAIT)
```

- 우선순위: ① 위험 지역 탈출 ② 갇히지 않는 위치 확보 ③ 필요한 성장 아이템 ④ 부술 상자 접근 ⑤ 상대 동선 차단 ⑥ Beat Bomb 설치 ⑦ 특수 아이템 ⑧ 상대 추적
- **A\***: 칸마다 "곧 터질 칸" 비용, 지나가는 순간 터지는 칸은 통과 불가. 평소 이동은 위험 칸을 아예 피해 ESCAPE ↔ 이동 왕복이 생기지 않습니다
- **멈춰 보이지 않기** — 목표가 없으면 순서대로: 열린 위치 → 바로 옆 안전 칸(안전 칸 사이를 오감) → 늦게 터지는 칸을 폭발 전에(여유 0.8초) 지나 밖의 안전 칸 → 가장 열린 칸 → 그래도 없으면 **WAIT** (0.25초마다 다시 길 찾기). 기다리는 동안 **Look Around / Ready / Danger Wait** 포즈를 보여 줍니다 (렌더 전용 힌트). 탈출할 때는 한 칸짜리 구석보다 옆에 안전 칸이 있는 곳을 고릅니다
  - QA (CPU 4인, 랜덤 시작): 평소(NORMAL) 같은 칸 1.5초 이상 정지 **0회**. 주변이 위험해 기다리는 정지는 최대 약 2.9초 (퓨즈 2.6초 + Wave 0.5초 동안 한 칸짜리 구석에 있을 때만)
- **STUCK CHECK**: 같은 칸에 1초 이상 → 경로 폐기 → 새 도달 가능 칸 → 없으면 주변 안전 칸
- **필요 기반 아이템**: MAX 인 능력치 아이템은 무시, 가장 부족한 능력치 우선 (예: SPEED 2/5 · BOMB 3/3 · WAVE 1/4 → WAVE UP > SPEED UP > 특수 > BOMB UP 무시)
- **안전한 설치**: 폭발 전에 도달 가능한, 숨 쉴 공간이 있는 안전 칸이 있을 때만 Beat Bomb 을 놓습니다. 가상 폭탄으로 상대가 피할 칸 수를 계산해 동선을 막습니다
- **TEAM 캡슐 목표 점수**: 팀원 구출 긴급도(내가 아니면 못 구함) → 남은 포획 시간 → 경로 거리 → 상대 마무리. 도착 전에 끝날 캡슐은 포기
- 초반엔 파밍, 후반엔 추적 비중이 커집니다. REMOTE 를 가진 상대의 폭탄도 위험으로 계산합니다

### 카메라 · 화면

- **17×15 이하 맵** (LOUNGE · LP LIBRARY · STUDIO · DJ BOOTH): **고정 카메라** — 아레나 전체, 따라가기·확대 없음
- **큰 맵** (TERRACE 19×15 · LOCKED ROOM 19×17): **HYBRID** — 시작 후 2.5초 동안 전체 아레나 → 사람 플레이어 위주로 **아주 천천히** 따라가며 살짝 확대 (최대 약 17.5×15.5 칸 표시). 맵 일부는 화면 밖일 수 있지만 **사람 플레이어는 항상 화면 가장자리 2.4칸 안쪽**에 있습니다. 사람이 여럿이면 모두 담기 위해 전체 보기까지 물러납니다 (`CAMERA_CONFIG.hybrid`)
- 폭발 흔들림은 아주 약하게. 경기가 끝난 뒤 승리 연출에서만 승자 쪽으로 다가갑니다
- **미니맵** — 큰 맵에서는 **기본 켜짐**, 17×15 이하 맵은 기본 꺼짐. `N` 키 / 타이머 탭으로 토글 (맵 크기별로 따로 기억). 현재 화면 영역을 사각형으로 표시
- **시작 위치 화살표** — 카운트다운 동안 항상 + 시작 후 **최대 1.5초**. 첫 칸을 벗어나거나 첫 폭탄을 놓으면 그 플레이어의 화살표는 **바로 사라집니다**. P1 빨강 · P2 파랑 · P3 노랑 · P4 흰색(팀전은 팀 색) (`gameConfig.startArrow`)
- **격자선 없는 바닥** — 판자 이음새 · 파케이 결 · 타일 음영 · 데크 틈 · 러그 문양이 칸 경계에 맞춰 있어 칸이 읽힙니다
- **Beat Bomb vs VIN** — 폭탄은 **낮고 작은 LP 퍽 + 크게 빛나는 중앙 음표 + 진한 주인 색 바깥 링·테두리 + 바닥 빛 + 항상 은은한 박동**. VIN 은 세워진 LP 몸 + **큰 하얀 눈 + 큰 빨간 신발**이 먼저 보입니다. Beat 1 주황 펄스 → Beat 2 홈을 따라 도는 파란 빛 → Beat 3 중앙이 밝아짐 → DROP
- **Sound Capsule 피격** (렌더 전용) — 0.12초 Hit-stop(멈춤 + 하얀 번쩍) → Squash → 비눗방울 **POP!** → Capsule
- **MAX 능력치 아이템** — 헛걸음이 아니라 **MAX BONUS +1** (결과 화면 표시, 시간 종료 시 점수가 같으면 우선), **3번째마다 무작위 특수 아이템**으로 변환 (`itemConfig.MAX_STAT_REWARD`)
- **Sound Wave** — 불꽃이 아니라 바닥을 따라 퍼지는 파란/보라 음파

### 게임 모드

- **BATTLE MODE** — 2~4인, Last Player Standing (제한시간 종료 시 생존자 점수 판정)
- **TEAM MODE** — 2 VS 2, 갇힌 팀원 구출, 팀 전원 포획 시 팀 탈락
- ITEM / HOUSE EVENT / CO-OP / CUSTOM — 타이틀에 COMING SOON 으로 표시 (확장 예정)
- 빈 슬롯은 **CPU** 로 채울 수 있음 — CPU 도 사람과 같은 intent(이동/폭탄/아이템)를 공통 PlayerController 에 넣습니다

---

## 코드 구조

```
src/
├── config/                     ← 데이터 (밸런스 / 맵 / 키) — 코드에 하드코딩 금지
│   ├── characterConfig.js      CHARACTERS: speed/bomb/wave { start, max }
│   ├── characterVisualConfig.js GLB 경로 + 애니메이션 personality (판정과 무관)
│   ├── itemConfig.js           ITEM_TYPES / DROP_TABLES / RANDOM_BOX_POOL
│   ├── stageConfig.js          6개 Arena 논리 그리드 + 기믹 + House Event + 테마
│   ├── gameConfig.js           퓨즈·Wave·포획·속도표·시작 화살표 등 공통 규칙 수치
│   └── inputConfig.js          키 프로필 (Q 미사용)
├── core/                       ← 순수 시뮬레이션 (Three.js / DOM 의존 없음, 고정 60Hz 틱)
│   ├── GameManager.js          경기 1판: 단계(카운트다운/진행/종료), 이벤트 큐
│   ├── GridManager.js          논리 그리드, 가구 그룹, 파괴/이동
│   ├── PlayerManager.js        생성·스폰, Sound Capsule 포획/구출/탈락
│   ├── PlayerController.js     ★ 모든 캐릭터 공통 컨트롤러 (이동·설치·아이템)
│   ├── CharacterStats.js       start/current/max — min(start + items, max)
│   ├── BeatBombManager.js      설치·카운트·DROP·Kick 슬라이드·Throw 비행
│   ├── SoundWaveManager.js     십자 전파, 파괴, Chain Reaction, linger 판정
│   ├── ItemManager.js          드랍·획득·특수 아이템 효과(ITEM_EFFECTS)
│   ├── StageManager.js         스테이지 기믹 레지스트리
│   ├── HouseEventManager.js    MR. ODD IS COMING — 경고 → 그리드 변경
│   ├── modes.js                BATTLE / TEAM 규칙
│   ├── gimmicks/               routeCrates, rollingLp, gates, recPulse, turntables, speakerDrop, wind, doors
│   └── ai/BotBrain.js          CPU — State Machine + A* + Stuck Recovery (위험 지도, 필요 기반 아이템, 안전 설치)
├── render/                     ← Three.js 3D Quarter-view
│   ├── GameRenderer.js         PerspectiveCamera(50° 하향) Soft Follow + Dynamic Zoom, 조명, 이벤트 연출
│   ├── StageView.js            바닥/벽/배경 + 그리드 그룹 ↔ 메쉬 재조정
│   ├── EntityViews.js          PlayerRoot(VisualModel/BombOrigin/ItemOrigin/PlayerIndicator), Beat Bomb, Sound Wave, 아이템, 경고, Rolling LP, MR. ODD
│   ├── characters/             CharacterVisual(GLB 우선 → 3D Placeholder), placeholders
│   ├── propFactory.js          스테이지 가구·소품 50여 종 (정적 메쉬 자동 병합)
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
- 능력치는 옷으로 표현하지 않고 자세/움직임으로 (`idle`: PICKER 앞으로 기울어 조급함 · REX 낮은 무게중심에 느림 · BUDDY 통통 · A.A. 졸린 듯 흔들림 · LOCKE 주변 확인)
- Beat Bomb 을 놓을 때는 모든 캐릭터가 같은 **music pulse ring** 이 몸·손 주위로 퍼집니다

## 캐릭터 GLB

`public/assets/characters/<id>/...glb` 에 넣으면 자동 사용 (경로표: `public/assets/characters/README.md`).
없으면 캐릭터 업그레이드 시트를 따른 **3D Placeholder** 를 사용합니다 (최종 모델이 아님). 2D Sprite 대체는 하지 않습니다.

**GLB 제작 우선순위**: VIN → PICKER → BUDDY → A.A. → LOCKE → REX → BULLY → MR. ODD. GLB 가 들어와도 판정 · 충돌 · 능력치는 바뀌지 않습니다.

| 캐릭터 | v4 Placeholder 포인트 |
| --- | --- |
| VIN | 더 두꺼운 LP 몸, 빛을 받으면 보이는 홈, **큰 하얀 눈 + 큰 빨간 신발** (바닥의 납작한 Beat Bomb 과 구별) |
| PICKER | 더 긴 아래 끝 · 넓은 윗면, 큰 X 반창고, 진한 눈썹, 검은 팔다리 |
| A.A. | 큰 금속 캡, 빵빵한 비니, 선명한 노랑/파랑, 작은 충전 LED, 졸린 눈 |
| LOCKE | 과장된 열쇠 톱니, 긴 몸통, 작은 모자 · 배낭, 초록 재킷, 오래된 황동 |
| REX | 넓은 받침, 큰 왕관 · 망토(움직임), 작은 신발, 나무 + 금 체스 킹 |
| BUDDY | 귀 · 볼 · 가슴 · 꼬리의 두툼한 털 뭉치, 큰 파랑/노랑 넥타이, 이름표 |
| BULLY | 큰 빨간 기타, 뒤로 과장된 검은 모자 · 금발, 검은 티(해골) + 카키 바지 |
| MR. ODD | 더 큰 배 · 어깨, 작은 머리, 굵은 빨간 체크 가운, 머그컵 · 끈 벨트 · 슬리퍼 (플레이 불가) |

---

## 테스트 (마스터 프롬프트 39절 기준)

`npm test` — 106개

| 39절 기준 | 테스트 |
| --- | --- |
| VIN 선택 → 초기 Stats 적용 → 아이템 획득 시 증가 → MAX 에서 정지 | `characterStats.test.js` |
| PICKER: VIN 과 같은 조작, Speed 차이 | 〃 (같은 컨트롤러 클래스 + 이동 거리 비교) |
| A.A.: Bomb Capacity 차이 | 〃 |
| REX: Wave Range 차이 | 〃 |
| 7명 모두 Move / Bomb / Item / Trap / Victory 동일 시스템 | 〃 |
| Beat Bomb · Wave · Chain Reaction · 아이템 10종 · MAX BONUS · NEEDLE · 포획/구출 · 팀 모드 | `bombWave.test.js`, `itemsTrap.test.js` |
| 6개 맵 크기 · 맵 정체성(소파 섬 · 선반 통로 · 녹음 부스 · 무대 링 · 광장 · 비대칭 미로) · 가구 비율 · 시작 위치 여유 · 구역별 시작 상자 · 아이템 수 · 기믹 · MR. ODD House Event · 경기 템포 · 화살표 타이밍 | `stages.test.js` |
| CPU 상태 이름 · 필요 기반 아이템 · 안전한 폭탄 설치 · ESCAPE · STUCK CHECK · 멈춰 보이지 않는 CPU (NORMAL < 1.5초) · 대체 이동 순서 · WAIT · TEAM 캡슐 우선순위 | `botBrain.test.js` |
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
