# Rootless Voicing Trainer

재즈 rootless voicing(좌손 4성부) 12키 암기 연습용 SPA. 로컬 전용, 서버/로그인 없음.
목표는 암기와 산출이지 이론 교육이 아니다. 설명 텍스트 최소화, 반복 루프 우선.

## Commands

- `npm run dev` — dev server
- `npm test` — Vitest (engine unit tests)
- `npm run build` — tsc + vite build

## 데이터 모델 (절대 규칙)

12키를 하드코딩하지 않는다. 보이싱은 **루트로부터의 반음 간격 배열**로 정의하고 런타임에 이조한다.
소스는 `src/engine/` — UI에서 음악 계산을 하지 마라.

### 기준 테이블 (A형만 소스, B형은 파생)

| Quality | A형 intervals | A형 도수 |
|---|---|---|
| `m7` | `[3, 7, 10, 14]` | b3 5 b7 9 |
| `dom7` | `[10, 14, 16, 21]` | b7 9 3 13 |
| `maj7` | `[4, 7, 11, 14]` | 3 5 7 9 |
| `m7b5` | `[3, 6, 10, 12]` | b3 b5 b7 1 |
| `dom7b9` | `[10, 13, 16, 19]` | b7 b9 3 5 |

**B형은 A형의 위 두 성부를 한 옥타브 내려 아래에 놓은 것.** 코드에서 A형으로부터 파생시킨다
(`voicings.ts`의 `getVoicing`). B형 테이블을 손으로 따로 적지 마라.

### 진행

- 메이저 ii–V–I: `m7` → `dom7` → `maj7` (루트 오프셋 +2, +7, 0)
- 마이너 ii–V–i: `m7b5` → `dom7b9` → `m7` (동일 오프셋)

마이너 i가 `m7`이라 메이저 ii와 같은 quality인 것은 **의도된 것**이다.

### Item 식별자

- item = `(rootPc, quality, form)` — 고유 120개 (12 × 5 × 2). id 문자열: `"{rootPc}:{quality}:{form}"`
- 화면 라벨은 문맥(키·도수)에 따라 달라지지만 SRS 카운트는 item 기준 통합.
  같은 Dm7 A형이 "C major · ii"로도 "D minor · i"로도 출제된다. 문맥별로 별개 항목으로 세지 마라.

### 옥타브 배치 — 두 층

- **canonical** (`placeVoicing`): 이조 후 최저음이 MIDI 48–59 (C3–B3). **암기 모드 정답 표시 전용.**
- **진행 배치** (`placeProgression`): 첫 코드(ii)는 canonical(이게 앵커), 이후 코드는 ±1 옥타브
  보정으로 보이스리딩 유지. **탐색 모드는 개별 코드 클릭·연속 재생 모두 이것만 쓴다** —
  탐색은 항상 진행 문맥 안이므로 canonical을 섞지 마라.
- `placeProgression` 결과는 12키 × {major,minor} × {A,B} = 48진행 전체가
  `progression.snapshot.ts`에 동결돼 있다. 보정 로직을 의도적으로 바꿀 때만
  `npx tsx scripts/gen-progression-snapshot.ts`로 재생성하고 손검산 앵커를 재확인하라.

### 채점 (암기 모드) — 옥타브 관대

`gradeAttempt` (`grading.ts`): 시도한 4음이 정답 보이싱의 **온옥타브 이동형**이고 전체가
**MIDI 41–72 (F2–C5)** 안이면 정답. 다른 옥타브로 맞혔어도 정답 처리하되,
정답 표시는 항상 canonical 하나로 보여준다. 옥타브 단위 이동은 전체가 함께 이동한 것만 인정
(일부 성부만 이동하면 오답).

### 음이름 표기

조성 기준. 철자는 **도수 기반**으로 계산한다(`spelling.ts`): 목표 글자 = 루트 글자 + (도수-1),
임시표 = 반음 차이. D♭키에서 C♯이라 쓰지 않는다. 키 이름은 `MAJOR_KEYS`/`MINOR_KEYS` 상수를 쓴다.
내부 표기는 ASCII(`Db`, `F#`, `b3`), 화면 렌더링 시에만 ♭/♯ 글리프로 변환.

## 저장

`localStorage`만. IndexedDB 금지. item당 `{ level: 1..5, lastSeenSession }` + 전역 세션 카운터.
날짜 개념 없음 — 세션 카운터 기준 Leitner (간격 1/2/4/8/16 세션).

## 하지 말 것

이론 설명/튜토리얼/온보딩, 계정/서버, 악보 렌더링 라이브러리, 메트로놈, 청음 퀴즈,
게임화(배지/XP/스트릭), 다크모드 토글(다크 하나만), SM-2, IndexedDB.
