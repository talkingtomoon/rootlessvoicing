import type { Item, ItemContext, ItemId } from '../engine/items';
import { contextsFor, itemId } from '../engine/items';
import { shuffle } from '../lib/shuffle';

/**
 * 보관함 루프 (스펙 §5).
 * 한 세션 = 뽑은 목록이 보관함까지 다 빌 때까지. 날짜 개념 없음.
 * - 맞히면 제거, 틀리면 보관함(retry)으로
 * - 목록이 비면 보관함을 다시 돈다
 * - 보관함에서 나온 카드는 최소 2문제 간격 (대안이 없으면 그냥 낸다)
 */

export type SessionCard = {
  item: Item;
  /** 출제 문맥 — 카드 생성 시 무작위로 하나 고정 (m7만 두 개 중 택일) */
  ctx: ItemContext;
};

export type Session = {
  queue: SessionCard[];
  /** 보관함 — 이번 라운드에서 틀린 카드 */
  retry: SessionCard[];
  /** 지금 풀고 있는 카드. null이면 세션 종료 */
  current: SessionCard | null;
  /** 최근에 보여준 카드 id, 최신 순 (간격 규칙용) */
  recent: ItemId[];
  /** item별 첫 시도 결과 — Leitner 갱신과 정답률 계산의 근거 */
  firstTry: Record<ItemId, boolean>;
  /** item별 누적 오답 수 */
  misses: Record<ItemId, number>;
  total: number;
  startedAt: number;
};

export const SESSION_SIZES = [12, 30, 60, 120] as const;

export function createSession(items: Item[], startedAt: number, rand: () => number): Session {
  const cards: SessionCard[] = shuffle(items, rand).map((item) => {
    const ctxs = contextsFor(item.rootPc, item.quality);
    return { item, ctx: ctxs[Math.floor(rand() * ctxs.length)] };
  });
  const [current, ...queue] = cards;
  return {
    queue,
    retry: [],
    current: current ?? null,
    recent: current ? [itemId(current.item)] : [],
    firstTry: {},
    misses: {},
    total: cards.length,
    startedAt,
  };
}

/** 남은 카드 수 — 화면 상단에 크게 표시하는 그 숫자 */
export function remaining(s: Session): number {
  return s.queue.length + s.retry.length + (s.current ? 1 : 0);
}

/** 현재 카드에 답하고 다음 카드로. current가 null이 되면 세션 종료. */
export function answerCurrent(s: Session, correct: boolean): Session {
  if (!s.current) return s;
  const card = s.current;
  const id = itemId(card.item);

  const firstTry = id in s.firstTry ? s.firstTry : { ...s.firstTry, [id]: correct };
  const misses = correct ? s.misses : { ...s.misses, [id]: (s.misses[id] ?? 0) + 1 };

  let queue = [...s.queue];
  let retry = correct ? [...s.retry] : [...s.retry, card];
  if (queue.length === 0) {
    // 목록이 비면 보관함을 다시 돈다
    queue = retry;
    retry = [];
  }
  if (queue.length === 0) {
    return { ...s, queue, retry, current: null, firstTry, misses };
  }

  // 최근 2문제 안에 나온 카드는 피한다 (대안이 없으면 첫 카드)
  const avoid = s.recent.slice(0, 2);
  const idx = queue.findIndex((c) => !avoid.includes(itemId(c.item)));
  const pick = idx === -1 ? 0 : idx;
  const current = queue[pick];
  queue = queue.filter((_, i) => i !== pick);

  return {
    ...s,
    queue,
    retry,
    current,
    recent: [itemId(current.item), ...s.recent].slice(0, 4),
    firstTry,
    misses,
  };
}

export type SessionSummary = {
  elapsedMs: number;
  total: number;
  firstTryCorrect: number;
  /** 오답 수 내림차순 상위 3개 */
  topMisses: { id: ItemId; count: number }[];
};

export function summarize(s: Session, endedAt: number): SessionSummary {
  const firstTryCorrect = Object.values(s.firstTry).filter(Boolean).length;
  const topMisses = Object.entries(s.misses)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return { elapsedMs: endedAt - s.startedAt, total: s.total, firstTryCorrect, topMisses };
}
