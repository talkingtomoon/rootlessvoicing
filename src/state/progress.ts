import type { Item, ItemId } from '../engine/items';
import { itemId } from '../engine/items';
import { shuffle } from '../lib/shuffle';

/**
 * 진도 (스펙 §6). Leitner 박스이되 날짜가 아니라 **세션 카운터** 기준.
 * item당 단계 하나만 저장한다. SM-2 같은 건 구현하지 않는다.
 */

export type ItemProgress = {
  /** 1~5 */
  level: number;
  /** 마지막으로 낸 세션 번호 */
  lastSeenSession: number;
};

export type ProgressStore = {
  /** 완료한 세션 수. 다음 세션 번호는 session + 1 */
  session: number;
  items: Record<ItemId, ItemProgress>;
};

export const MAX_LEVEL = 5;
/** 단계별 재출제 간격(세션 단위) — 인덱스 = level - 1 */
export const LEITNER_INTERVALS = [1, 2, 4, 8, 16];

const KEY = 'rootless:progress';

export function emptyProgress(): ProgressStore {
  return { session: 0, items: {} };
}

export function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressStore;
    if (typeof parsed?.session !== 'number' || typeof parsed?.items !== 'object') {
      return emptyProgress();
    }
    return parsed;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(store: ProgressStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

/** 이 항목이 재출제 간격을 지났는가 */
export function isDue(p: ItemProgress, sessionNo: number): boolean {
  return sessionNo - p.lastSeenSession >= LEITNER_INTERVALS[p.level - 1];
}

/**
 * 출제 목록 뽑기. 우선순위 ① 간격 지난 항목 ② 미학습 신규 ③ 단계 낮은 순.
 * 신규는 한 세션에 min(6, floor(N/2))개까지만 — 처음 보는 카드로만 채워지지 않게 한다.
 * 그래서 초반에는 N보다 적게 뽑힐 수 있다(의도된 램프업).
 */
export function selectItems(
  store: ProgressStore,
  all: Item[],
  n: number,
  rand: () => number,
): Item[] {
  const sessionNo = store.session + 1;
  const rows = all.map((item) => ({ item, p: store.items[itemId(item)] }));

  const due = rows.filter((r) => r.p && isDue(r.p, sessionNo));
  const fresh = rows.filter((r) => !r.p);
  const rest = rows.filter((r) => r.p && !isDue(r.p, sessionNo));

  // ① 간격 지난 항목 — 단계 낮은 순, 같으면 더 오래 밀린 순
  const overdue = (p: ItemProgress) => sessionNo - p.lastSeenSession - LEITNER_INTERVALS[p.level - 1];
  const picked = [...due]
    .sort((a, b) => a.p!.level - b.p!.level || overdue(b.p!) - overdue(a.p!))
    .slice(0, n)
    .map((r) => r.item);

  // ② 미학습 신규 (상한 있음)
  if (picked.length < n) {
    const cap = Math.min(6, Math.floor(n / 2));
    picked.push(
      ...shuffle(fresh, rand)
        .slice(0, Math.min(cap, n - picked.length))
        .map((r) => r.item),
    );
  }

  // ③ 아직 간격이 안 된 항목을 단계 낮은 순으로 채운다
  if (picked.length < n) {
    picked.push(
      ...[...rest]
        .sort((a, b) => a.p!.level - b.p!.level)
        .slice(0, n - picked.length)
        .map((r) => r.item),
    );
  }

  return picked;
}

/**
 * 세션 종료 갱신. 첫 시도에 맞혔으면 단계 +1, 아니면 단계 1로.
 * (보관함에서 나중에 맞힌 건 올리지 않는다 — firstTry만 본다.)
 * 미학습 항목은 단계 1에서 시작하므로 첫 시도 정답이면 2, 오답이면 1이 된다.
 */
export function applyResults(
  store: ProgressStore,
  firstTry: Record<ItemId, boolean>,
): ProgressStore {
  const sessionNo = store.session + 1;
  const items = { ...store.items };
  for (const [id, ok] of Object.entries(firstTry)) {
    const level = ok ? Math.min(MAX_LEVEL, (items[id]?.level ?? 1) + 1) : 1;
    items[id] = { level, lastSeenSession: sessionNo };
  }
  return { session: sessionNo, items };
}

/** 히트맵용 조회 — 미학습이면 null */
export function levelOf(store: ProgressStore, item: Item): number | null {
  return store.items[itemId(item)]?.level ?? null;
}
