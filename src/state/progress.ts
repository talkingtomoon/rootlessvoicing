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
  /** 완료한 세션 수. 다음 세션 번호는 session + 1 (같은 학습일이면 session 그대로 — nextSessionNo) */
  session: number;
  items: Record<ItemId, ItemProgress>;
  /**
   * 마지막으로 기록한 학습일 (studyDay, 'YYYY-MM-DD'). 있으면 같은 날의 여러 판은 한 세션으로 친다 —
   * 매일 15분을 몇 판으로 나눠 해도 간격(1/2/4/8/16)이 "학습일" 단위로 유지된다.
   * 진도 링크에는 실리지 않는다 (가져온 뒤 첫 기록은 새 세션이 된다).
   */
  lastDay?: string;
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

/** 다음(또는 오늘 진행 중인) 세션 번호. day를 주면 같은 학습일은 같은 번호 */
export function nextSessionNo(store: ProgressStore, day?: string): number {
  return day !== undefined && store.lastDay === day ? store.session : store.session + 1;
}

/** 오늘(이 학습일) 이미 채점에 반영된 항목인가 */
export function seenToday(store: ProgressStore, id: ItemId, day: string): boolean {
  return store.lastDay === day && store.items[id]?.lastSeenSession === store.session;
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
  day?: string,
): Item[] {
  const sessionNo = nextSessionNo(store, day);
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

export type ApplyOptions = {
  /** 학습일. 주면 같은 날의 판들은 한 세션으로 묶이고, 그날 이미 채점된 항목은 다시 올리거나 내리지 않는다 */
  day?: string;
  /** 첫 시도에 맞혔지만 느렸던 항목 — 단계를 유지한다 (올리지도 내리지도 않음) */
  slow?: Record<ItemId, boolean>;
  /** 오늘 처음 배운 항목 — 방금 보고 맞힌 것이라 결과와 무관하게 단계 1(내일 복습)로 둔다 */
  introduced?: ItemId[];
};

/**
 * 세션 종료 갱신. 첫 시도에 맞혔으면 단계 +1, 아니면 단계 1로.
 * (보관함에서 나중에 맞힌 건 올리지 않는다 — firstTry만 본다.)
 * 미학습 항목은 단계 1에서 시작하므로 첫 시도 정답이면 2, 오답이면 1이 된다.
 * 느린 정답(slow)은 단계 유지, 오늘 배운 항목(introduced)은 단계 1.
 */
export function applyResults(
  store: ProgressStore,
  firstTry: Record<ItemId, boolean>,
  opts: ApplyOptions = {},
): ProgressStore {
  const { day, slow = {}, introduced = [] } = opts;
  const sessionNo = nextSessionNo(store, day);
  const items = { ...store.items };
  for (const [id, ok] of Object.entries(firstTry)) {
    const prev = items[id];
    // 같은 학습일에 두 번째로 나온 건 연습일 뿐 — 첫 결과가 그날의 기록이다
    if (day !== undefined && store.lastDay === day && prev?.lastSeenSession === sessionNo) continue;
    let level: number;
    if (!ok) level = 1;
    else if (introduced.includes(id)) level = 1;
    else if (slow[id]) level = prev?.level ?? 1;
    else level = Math.min(MAX_LEVEL, (prev?.level ?? 1) + 1);
    items[id] = { level, lastSeenSession: sessionNo };
  }
  const next: ProgressStore = { session: sessionNo, items };
  if (day !== undefined) next.lastDay = day;
  return next;
}

/** 히트맵용 조회 — 미학습이면 null */
export function levelOf(store: ProgressStore, item: Item): number | null {
  return store.items[itemId(item)]?.level ?? null;
}

/**
 * 두 기기의 진도 합치기 (덮어쓰기의 대안).
 *
 * 세션 번호는 기기마다 다르므로 **나이**(세션번호 − lastSeenSession)로 환산해 비교한다.
 * 진도 링크가 절대 번호가 아니라 나이를 싣는 것도 같은 이유다.
 * - 단계는 **높은 쪽** — 한쪽에서 굳힌 건 굳힌 것이다
 * - 나이는 **더 밀린 쪽** — 복습이 일찍 돌아오는 쪽으로 기운다 (모르는 걸 안다고 치는 것보다 낫다)
 * - 한쪽에만 있는 항목은 나이를 지킨 채로 들어온다
 *
 * 세션 번호와 학습일은 이 기기 것을 유지한다. 연습 시간 기록(timeLog)은 링크에 없으니 합쳐지지 않는다.
 */
function ageOf(store: ProgressStore, p: ItemProgress): number {
  return Math.max(0, store.session - p.lastSeenSession);
}

export function mergeProgress(local: ProgressStore, incoming: ProgressStore): ProgressStore {
  const items: Record<ItemId, ItemProgress> = {};
  const ids = new Set([...Object.keys(local.items), ...Object.keys(incoming.items)]);
  for (const id of ids) {
    const a = local.items[id];
    const b = incoming.items[id];
    const level = Math.max(a?.level ?? 0, b?.level ?? 0);
    const age = Math.max(a ? ageOf(local, a) : 0, b ? ageOf(incoming, b) : 0);
    items[id] = { level, lastSeenSession: local.session - age };
  }
  const next: ProgressStore = { session: local.session, items };
  if (local.lastDay !== undefined) next.lastDay = local.lastDay;
  return next;
}

export type MergeSummary = {
  /** 이 기기에 없던 항목 */
  added: number;
  /** 단계가 올라가는 항목 */
  raised: number;
  /** 합친 뒤 학습한 항목 수 */
  total: number;
};

export function mergeSummary(local: ProgressStore, incoming: ProgressStore): MergeSummary {
  let added = 0;
  let raised = 0;
  for (const [id, b] of Object.entries(incoming.items)) {
    const a = local.items[id];
    if (!a) added++;
    else if (b.level > a.level) raised++;
  }
  return { added, raised, total: Object.keys(mergeProgress(local, incoming).items).length };
}
