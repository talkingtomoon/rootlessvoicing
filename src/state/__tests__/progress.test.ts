import { describe, expect, it } from 'vitest';
import { allItems, itemId, itemsOf, type Item } from '../../engine/items';
import {
  applyResults,
  emptyProgress,
  isDue,
  LEITNER_INTERVALS,
  levelOf,
  MAX_LEVEL,
  selectItems,
  type ProgressStore,
} from '../progress';

const seq = (start = 0.5) => {
  let x = start;
  return () => {
    x = (x * 9301 + 49297) % 233280 / 233280;
    return x;
  };
};

function storeWith(entries: [Item, number, number][]): ProgressStore {
  const items: ProgressStore['items'] = {};
  let session = 0;
  for (const [item, level, lastSeen] of entries) {
    items[itemId(item)] = { level, lastSeenSession: lastSeen };
    session = Math.max(session, lastSeen);
  }
  return { session, items };
}

describe('Leitner 간격', () => {
  it('단계별 간격은 1/2/4/8/16 세션', () => {
    expect(LEITNER_INTERVALS).toEqual([1, 2, 4, 8, 16]);
  });

  it('isDue: 간격을 채웠을 때만 true', () => {
    expect(isDue({ level: 1, lastSeenSession: 5 }, 6)).toBe(true); // 1세션 지남
    expect(isDue({ level: 2, lastSeenSession: 5 }, 6)).toBe(false);
    expect(isDue({ level: 2, lastSeenSession: 5 }, 7)).toBe(true);
    expect(isDue({ level: 5, lastSeenSession: 5 }, 20)).toBe(false);
    expect(isDue({ level: 5, lastSeenSession: 5 }, 21)).toBe(true);
  });
});

describe('세션 종료 갱신', () => {
  const [a, b] = allItems();

  it('첫 시도 정답이면 +1, 오답이면 1로', () => {
    const store = storeWith([
      [a, 3, 1],
      [b, 4, 1],
    ]);
    const next = applyResults(store, { [itemId(a)]: true, [itemId(b)]: false });
    expect(next.items[itemId(a)].level).toBe(4);
    expect(next.items[itemId(b)].level).toBe(1);
  });

  it('미학습은 정답이면 2, 오답이면 1', () => {
    const next = applyResults(emptyProgress(), { [itemId(a)]: true, [itemId(b)]: false });
    expect(next.items[itemId(a)].level).toBe(2);
    expect(next.items[itemId(b)].level).toBe(1);
  });

  it('최대 단계를 넘지 않는다', () => {
    const store = storeWith([[a, MAX_LEVEL, 1]]);
    expect(applyResults(store, { [itemId(a)]: true }).items[itemId(a)].level).toBe(MAX_LEVEL);
  });

  it('세션 카운터가 1 오르고 lastSeenSession이 그 번호로 기록된다', () => {
    const store = storeWith([[a, 2, 3]]);
    const next = applyResults(store, { [itemId(a)]: true });
    expect(next.session).toBe(store.session + 1);
    expect(next.items[itemId(a)].lastSeenSession).toBe(next.session);
  });

  it('세션에 안 나온 항목은 건드리지 않는다', () => {
    const store = storeWith([
      [a, 3, 1],
      [b, 2, 1],
    ]);
    const next = applyResults(store, { [itemId(a)]: false });
    expect(next.items[itemId(b)]).toEqual(store.items[itemId(b)]);
  });
});

describe('출제 목록 선정', () => {
  const all = allItems();

  it('첫 세션은 신규 상한 min(6, N/2)만큼만 뽑는다', () => {
    for (const n of [12, 30, 60, 120]) {
      const picked = selectItems(emptyProgress(), all, n, seq());
      expect(picked.length, `N=${n}`).toBe(Math.min(6, Math.floor(n / 2)));
    }
  });

  it('간격 지난 항목이 신규보다 먼저 채워진다', () => {
    // 10개를 level 1 / 세션 1에 봤고 지금은 세션 2 → 전부 due
    const dueItems = all.slice(0, 10);
    const store = storeWith(dueItems.map((it) => [it, 1, 1] as [Item, number, number]));
    const picked = selectItems(store, all, 12, seq());
    const pickedIds = picked.map(itemId);
    for (const it of dueItems) expect(pickedIds).toContain(itemId(it));
    // 나머지 2장은 신규로 채워진다
    expect(picked).toHaveLength(12);
  });

  it('due가 N보다 많으면 단계 낮은 순으로 자른다', () => {
    const store: ProgressStore = { session: 40, items: {} };
    all.forEach((it, i) => {
      store.items[itemId(it)] = { level: (i % 5) + 1, lastSeenSession: 0 };
    });
    const picked = selectItems(store, all, 12, seq());
    expect(picked).toHaveLength(12);
    expect(picked.every((it) => store.items[itemId(it)].level === 1)).toBe(true);
  });

  it('due도 신규도 부족하면 단계 낮은 순으로 채운다', () => {
    // 전 항목이 방금 본 상태(간격 안 됨) → due 0, 신규 0
    const store: ProgressStore = { session: 1, items: {} };
    all.forEach((it, i) => {
      store.items[itemId(it)] = { level: (i % 5) + 1, lastSeenSession: 1 };
    });
    const picked = selectItems(store, all, 12, seq());
    expect(picked).toHaveLength(12);
    expect(picked.every((it) => store.items[itemId(it)].level === 1)).toBe(true);
  });

  it('중복 없이 뽑는다', () => {
    const store = storeWith(all.slice(0, 30).map((it) => [it, 1, 1] as [Item, number, number]));
    const picked = selectItems(store, all, 60, seq());
    expect(new Set(picked.map(itemId)).size).toBe(picked.length);
  });

  it('세션을 거듭하면 학습 항목이 늘어난다 (램프업)', () => {
    let store = emptyProgress();
    for (let i = 0; i < 5; i++) {
      const picked = selectItems(store, all, 12, seq(0.1 * (i + 1)));
      const firstTry: Record<string, boolean> = {};
      for (const it of picked) firstTry[itemId(it)] = true;
      store = applyResults(store, firstTry);
    }
    expect(store.session).toBe(5);
    expect(Object.keys(store.items).length).toBeGreaterThan(6);
  });
});

describe('히트맵 조회', () => {
  it('levelOf: 미학습이면 null', () => {
    const [a] = allItems();
    expect(levelOf(emptyProgress(), a)).toBeNull();
    expect(levelOf(storeWith([[a, 3, 1]]), a)).toBe(3);
  });

  it('히트맵 한 칸 = item 하나 (12루트 × 5quality × 2폼 = 120)', () => {
    const cells = (['A', 'B'] as const).flatMap((form) =>
      (['m7', 'dom7', 'maj7', 'm7b5', 'dom7b9'] as const).flatMap((q) => itemsOf(q, form)),
    );
    expect(cells).toHaveLength(120);
    expect(new Set(cells.map(itemId)).size).toBe(120);
  });
});
