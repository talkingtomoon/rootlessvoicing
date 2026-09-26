import { describe, expect, it } from 'vitest';
import { allItems, itemId, type Item } from '../../engine/items';
import { applyResults, emptyProgress, nextSessionNo, seenToday, type ProgressStore } from '../../state/progress';
import {
  BLOCKS,
  curriculum,
  dueToday,
  FRAGILE_LIMIT,
  isEligible,
  MAX_UNITS_PER_DAY,
  nextUnit,
  planRound,
  PREREQ_LEVEL,
  ROUND_SIZE,
  shouldIntroduce,
  unitPrereqs,
  unitState,
} from '../daily';
import { answerCurrent, createSession } from '../session';
import { addDays, studyDay, weekOf } from '../../state/day';

const all = allItems();
const ok = (items: Item[]) => Object.fromEntries(items.map((it) => [itemId(it), true]));

/** 하루치 연습 — 오늘 탭(TodayView)이 도는 순서 그대로. 전부 첫 시도 정답. */
function runDay(store: ProgressStore, day: string, maxRounds = 8): { store: ProgressStore; learned: Item[] } {
  const units = curriculum();
  const learned: Item[] = [];
  let unitsToday = 0;
  for (let r = 0; r < maxRounds; r++) {
    let fresh: Item[] = [];
    if (shouldIntroduce(store, all, units, day, unitsToday)) {
      fresh = nextUnit(store, units, all)!.fresh;
      learned.push(...fresh);
      unitsToday++;
    }
    const items = planRound(store, all, day, fresh);
    if (items.length === 0) break;
    let s = createSession(items, 0, Math.random);
    while (s.current) s = answerCurrent(s, true);
    store = applyResults(store, s.firstTry, { day, slow: s.firstSlow, introduced: fresh.map(itemId) });
  }
  return { store, learned };
}

describe('코스 — 같은 모양을 세 루트로', () => {
  const units = curriculum();

  it('블록은 4도권 세 키씩 네 덩어리', () => {
    expect(BLOCKS).toEqual([
      [0, 5, 10],
      [3, 8, 1],
      [6, 11, 4],
      [9, 2, 7],
    ]);
  });

  it('40유닛이 120개를 중복 없이 덮는다', () => {
    expect(units).toHaveLength(40);
    const ids = units.flatMap((u) => u.items.map(itemId));
    expect(new Set(ids).size).toBe(120);
    expect(ids).toHaveLength(120);
  });

  it('한 유닛은 같은 quality × 폼, 세 루트', () => {
    for (const u of units) {
      expect(u.items).toHaveLength(3);
      expect(u.items.every((it) => it.quality === u.quality && it.form === u.form)).toBe(true);
      expect(new Set(u.items.map((it) => it.rootPc)).size).toBe(3);
    }
  });

  it('블록 안에서 ii → V → I 순, 블록을 끝내면 ii–V–I가 세 개 완성된다', () => {
    expect(units.slice(0, 3).map((u) => u.quality)).toEqual(['m7', 'dom7', 'maj7']);
    expect(units[0].items.map((it) => it.rootPc)).toEqual([2, 7, 0]); // C·F·B♭의 ii
    expect(units[1].items.map((it) => it.rootPc)).toEqual([7, 0, 5]); // 그 V
    expect(units[2].items.map((it) => it.rootPc)).toEqual([0, 5, 10]); // 그 I
    expect(units[3].keys).toEqual(BLOCKS[1]);
  });

  it('폼당 quality는 한 번만 — 마이너 i(m7)는 메이저 ii에서 이미 배운다', () => {
    const aMajor = units.filter((u) => u.form === 'A' && u.type === 'major');
    const aMinor = units.filter((u) => u.form === 'A' && u.type === 'minor');
    expect(aMajor).toHaveLength(12);
    expect(aMinor).toHaveLength(8);
    expect(new Set(aMinor.map((u) => u.quality))).toEqual(new Set(['m7b5', 'dom7b9']));
  });

  it('메이저를 끄면 m7을 마이너 단계에서 가르친다', () => {
    const onlyMinor = curriculum(['A'], ['minor']);
    expect(onlyMinor).toHaveLength(12);
    expect(new Set(onlyMinor.map((u) => u.quality))).toEqual(new Set(['m7b5', 'dom7b9', 'm7']));
  });
});

describe('기둥 규칙', () => {
  const units = curriculum();
  const unitOf = (form: 'A' | 'B', quality: string, block = 0) =>
    units.find((u) => u.form === form && u.quality === quality && u.keys === BLOCKS[block])!;

  it('ii는 기댈 데가 없고, V는 그 ii를, I는 그 V를 기둥으로 삼는다', () => {
    expect(unitPrereqs(unitOf('A', 'm7'))).toEqual([]);
    expect(unitPrereqs(unitOf('A', 'dom7')).map((p) => `${p.rootPc}:${p.quality}`)).toEqual([
      '2:m7',
      '7:m7',
      '0:m7',
    ]);
    expect(unitPrereqs(unitOf('A', 'maj7')).map((p) => p.quality)).toEqual(['dom7', 'dom7', 'dom7']);
  });

  it('마이너는 같은 루트 메이저 짝, B형은 같은 코드 A형을 기둥으로 삼는다', () => {
    const minorII = unitOf('A', 'm7b5');
    expect(unitPrereqs(minorII).map((p) => p.quality)).toEqual(['m7', 'm7', 'm7']);
    const bForm = unitOf('B', 'm7');
    expect(unitPrereqs(bForm).every((p) => p.form === 'A' && p.quality === 'm7')).toBe(true);
  });

  it('기둥이 단계 1이면 아직 자격이 없다', () => {
    const v = unitOf('A', 'dom7');
    const level = (n: number): ProgressStore => ({
      session: 3,
      items: Object.fromEntries(unitPrereqs(v).map((p) => [itemId(p), { level: n, lastSeenSession: 1 }])),
    });
    expect(isEligible(level(1), all, v)).toBe(false);
    expect(isEligible(level(PREREQ_LEVEL), all, v)).toBe(true);
    expect(isEligible(emptyProgress(), all, v)).toBe(false);
  });

  it('풀에 없는 기둥은 따지지 않는다 (설정으로 A형을 껐을 때 B형)', () => {
    const bUnit = unitOf('B', 'm7');
    const onlyB = all.filter((it) => it.form === 'B');
    expect(isEligible(emptyProgress(), onlyB, bUnit)).toBe(true);
  });

  it('자격을 갖춘 유닛이 없으면 막히지 않게 첫 유닛을 낸다', () => {
    // 모든 m7을 배웠지만 전부 단계 1 — V도 I도 아직 자격이 없다
    const m7s = all.filter((it) => it.quality === 'm7' && it.form === 'A');
    const store: ProgressStore = {
      session: 1,
      items: Object.fromEntries(m7s.map((it) => [itemId(it), { level: 1, lastSeenSession: 1 }])),
    };
    const onlyA = curriculum(['A'], ['major']);
    const picked = nextUnit(store, onlyA, all)!;
    expect(picked.blocked).toBe(true);
    expect(picked.unit.quality).toBe('dom7');
  });
});

describe('하루하루 흐름', () => {
  it('첫날은 ii만, 다음 날 V, 그다음 날 I이 들어온다', () => {
    let store = emptyProgress();
    const day1 = runDay(store, '2026-10-01');
    store = day1.store;
    expect(day1.learned).toHaveLength(MAX_UNITS_PER_DAY * 3);
    expect(new Set(day1.learned.map((it) => it.quality))).toEqual(new Set(['m7']));

    const day2 = runDay(store, '2026-10-02');
    store = day2.store;
    const q2 = new Set(day2.learned.map((it) => it.quality));
    expect(q2.has('dom7')).toBe(true);
    expect(q2.has('maj7')).toBe(false);

    const day3 = runDay(store, '2026-10-03');
    expect(new Set(day3.learned.map((it) => it.quality)).has('maj7')).toBe(true);
    expect(store.session).toBe(2);
  });

  it('보름이면 코스를 거의 다 훑는다 (하루 9개 상한)', () => {
    let store = emptyProgress();
    let day = '2026-10-01';
    for (let d = 0; d < 15; d++) {
      store = runDay(store, day).store;
      day = addDays(day, 1);
    }
    expect(Object.keys(store.items).length).toBeGreaterThan(100);
  });
});

describe('학습일 세션', () => {
  const [a, b] = all;

  it('같은 날 여러 판은 한 세션, 다음 날은 +1', () => {
    let store = applyResults(emptyProgress(), ok([a]), { day: '2026-09-17' });
    expect(store.session).toBe(1);
    store = applyResults(store, ok([b]), { day: '2026-09-17' });
    expect(store.session).toBe(1);
    expect(nextSessionNo(store, '2026-09-17')).toBe(1);
    expect(nextSessionNo(store, '2026-09-18')).toBe(2);
    store = applyResults(store, ok([b]), { day: '2026-09-18' });
    expect(store.session).toBe(2);
  });

  it('같은 날 두 번째로 나온 항목은 단계를 다시 바꾸지 않는다', () => {
    const day = '2026-09-17';
    let store = applyResults(emptyProgress(), ok([a]), { day });
    expect(store.items[itemId(a)].level).toBe(2);
    store = applyResults(store, { [itemId(a)]: false }, { day });
    expect(store.items[itemId(a)].level).toBe(2);
    expect(seenToday(store, itemId(a), day)).toBe(true);
    expect(seenToday(store, itemId(a), '2026-09-18')).toBe(false);
  });

  it('느린 정답은 단계 유지, 오늘 배운 것은 단계 1', () => {
    const store: ProgressStore = { session: 3, items: { [itemId(a)]: { level: 3, lastSeenSession: 1 } } };
    const next = applyResults(store, ok([a, b]), {
      day: 'x',
      slow: { [itemId(a)]: true },
      introduced: [itemId(b)],
    });
    expect(next.items[itemId(a)].level).toBe(3);
    expect(next.items[itemId(b)].level).toBe(1);
  });
});

describe('판 구성', () => {
  const units = curriculum();
  const day = '2026-09-17';

  it('처음엔 새 유닛을 들이고, 판은 새 코드로 시작한다', () => {
    const store = emptyProgress();
    expect(shouldIntroduce(store, all, units, day, 0)).toBe(true);
    const { fresh } = nextUnit(store, units, all)!;
    const round = planRound(store, all, day, fresh);
    expect(round.map(itemId)).toEqual(fresh.map(itemId));
  });

  it('복습이 한 판 넘게 밀려 있으면 새 유닛을 들이지 않는다', () => {
    const items: ProgressStore['items'] = {};
    for (const it of all.slice(0, ROUND_SIZE + 1)) items[itemId(it)] = { level: 3, lastSeenSession: 0 };
    const store: ProgressStore = { session: 10, items };
    expect(dueToday(store, all, day)).toHaveLength(ROUND_SIZE + 1);
    expect(shouldIntroduce(store, all, units, day, 0)).toBe(false);
  });

  it('흔들리는 항목이 많거나 오늘 유닛을 충분히 들였으면 멈춘다', () => {
    const items: ProgressStore['items'] = {};
    for (const it of all.slice(0, FRAGILE_LIMIT)) items[itemId(it)] = { level: 1, lastSeenSession: 5 };
    const store: ProgressStore = { session: 5, items, lastDay: day };
    expect(shouldIntroduce(store, all, units, day, 0)).toBe(false);
    expect(shouldIntroduce(emptyProgress(), all, units, day, MAX_UNITS_PER_DAY)).toBe(false);
  });

  it('due가 먼저, 판 크기를 넘지 않고, 중복 없음', () => {
    const items: ProgressStore['items'] = {};
    all.slice(0, 30).forEach((it, i) => (items[itemId(it)] = { level: (i % 3) + 1, lastSeenSession: 0 }));
    const store: ProgressStore = { session: 1, items };
    const round = planRound(store, all, day);
    expect(round).toHaveLength(ROUND_SIZE);
    expect(new Set(round.map(itemId)).size).toBe(ROUND_SIZE);
    expect(round.every((it) => store.items[itemId(it)].level === 1)).toBe(true);
  });

  it('배운 게 3개뿐이어도 판은 만들어진다 (오늘 본 것 재연습)', () => {
    const fresh = all.slice(0, 3);
    const store = applyResults(emptyProgress(), ok(fresh), { day, introduced: fresh.map(itemId) });
    const round = planRound(store, all, day);
    expect(round.map(itemId).sort()).toEqual(fresh.map(itemId).sort());
  });

  it('유닛 상태: 다 배움 / 일부 / 안 배움', () => {
    const u = units[0];
    expect(unitState(emptyProgress(), u)).toBe('none');
    const partial = applyResults(emptyProgress(), ok([u.items[0]]), { day });
    expect(unitState(partial, u)).toBe('partial');
    const done = applyResults(emptyProgress(), ok(u.items), { day });
    expect(unitState(done, u)).toBe('done');
  });
});

describe('느린 정답', () => {
  it('첫 시도에서만 한 번 더 돌고, 다시 느려도 끝난다', () => {
    let s = createSession(all.slice(0, 1), 0, Math.random);
    s = answerCurrent(s, true, true);
    expect(s.current).not.toBeNull();
    expect(s.firstSlow[itemId(all[0])]).toBe(true);
    s = answerCurrent(s, true, true);
    expect(s.current).toBeNull();
    expect(s.firstTry[itemId(all[0])]).toBe(true);
  });
});

describe('학습일', () => {
  it('새벽 4시 전은 전날', () => {
    expect(studyDay(new Date(2026, 8, 18, 3, 59))).toBe('2026-09-17');
    expect(studyDay(new Date(2026, 8, 18, 4, 0))).toBe('2026-09-18');
  });
  it('주는 월요일부터', () => {
    const w = weekOf('2026-09-17'); // 목요일
    expect(w[0]).toBe('2026-09-14');
    expect(w[6]).toBe('2026-09-20');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
