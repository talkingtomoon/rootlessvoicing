import { describe, expect, it } from 'vitest';
import { allItems, itemId, type Item } from '../../engine/items';
import { applyResults, emptyProgress, nextSessionNo, seenToday, type ProgressStore } from '../../state/progress';
import {
  curriculum,
  dueToday,
  FRAGILE_LIMIT,
  MAX_UNITS_PER_DAY,
  nextUnit,
  planRound,
  ROUND_SIZE,
  shouldIntroduce,
  unitState,
} from '../daily';
import { answerCurrent, createSession } from '../session';
import { addDays, studyDay, weekOf } from '../../state/day';

const all = allItems();
const ok = (items: Item[]) => Object.fromEntries(items.map((it) => [itemId(it), true]));

describe('코스', () => {
  it('48유닛이 120개를 빠짐없이 덮는다', () => {
    const units = curriculum();
    expect(units).toHaveLength(48);
    const ids = new Set(units.flatMap((u) => u.items.map(itemId)));
    expect(ids.size).toBe(120);
  });

  it('A형 메이저 C부터 4도권 순, 그 다음 A형 마이너', () => {
    const units = curriculum();
    expect(units[0]).toMatchObject({ form: 'A', type: 'major', keyPc: 0 });
    expect(units[1].keyPc).toBe(5);
    expect(units[12]).toMatchObject({ form: 'A', type: 'minor', keyPc: 0 });
    expect(units[24]).toMatchObject({ form: 'B', type: 'major' });
  });

  it('A형 메이저를 다 배우면 마이너 유닛의 i(m7)는 이미 배운 것이라 새 코드는 둘', () => {
    const units = curriculum();
    let store = emptyProgress();
    store = applyResults(store, ok(units.slice(0, 12).flatMap((u) => u.items)));
    const next = nextUnit(store, units)!;
    expect(next.index).toBe(12);
    expect(next.fresh.map((it) => it.quality)).toEqual(['m7b5', 'dom7b9']);
    expect(unitState(store, units[0])).toBe('done');
    expect(unitState(store, units[12])).toBe('partial');
  });

  it('설정으로 끈 진행·폼은 코스에서 빠진다', () => {
    expect(curriculum(['A'], ['major'])).toHaveLength(12);
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
    const { fresh } = nextUnit(store, units)!;
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

  it('하루 흐름: 판을 돌면 새 유닛이 들어오고 흔들리는 항목 상한에서 멈춘다', () => {
    let store = emptyProgress();
    let unitsToday = 0;
    for (let r = 0; r < 12; r++) {
      let fresh: Item[] = [];
      if (shouldIntroduce(store, all, units, day, unitsToday)) {
        fresh = nextUnit(store, units)!.fresh;
        unitsToday++;
      }
      let s = createSession(planRound(store, all, day, fresh), 0, Math.random);
      while (s.current) s = answerCurrent(s, true);
      store = applyResults(store, s.firstTry, { day, slow: s.firstSlow, introduced: fresh.map(itemId) });
    }
    expect(unitsToday).toBe(MAX_UNITS_PER_DAY);
    expect(Object.keys(store.items)).toHaveLength(9);
    expect(store.session).toBe(1);
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
