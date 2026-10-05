import { describe, expect, it } from 'vitest';
import type { Item } from '../../engine/items';
import { contextOf, itemId, itemsOf, sortByFourths } from '../../engine/items';
import {
  answerCurrent,
  createSession,
  remaining,
  summarize,
  type Session,
  type SessionCard,
} from '../session';
import { allItems } from '../../engine/items';

const rand0 = () => 0;

function card(rootPc: number, quality: Item['quality'] = 'maj7', form: Item['form'] = 'A'): SessionCard {
  const item = { rootPc, quality, form };
  return { item, ctx: contextOf(rootPc, quality) };
}

function ids(cards: SessionCard[]): string[] {
  return cards.map((c) => itemId(c.item));
}

describe('키 순서', () => {
  it('4도 순환: quality 안에서 C F B♭ E♭ … 순', () => {
    const sorted = sortByFourths(itemsOf('m7', 'A'));
    expect(sorted.map((i) => i.rootPc)).toEqual([0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7]);
  });

  it('quality가 섞이면 quality → 폼 → 4도권 순', () => {
    const mixed = [
      { rootPc: 5, quality: 'dom7' as const, form: 'A' as const },
      { rootPc: 5, quality: 'm7' as const, form: 'A' as const },
      { rootPc: 0, quality: 'm7' as const, form: 'A' as const },
      { rootPc: 0, quality: 'm7' as const, form: 'B' as const },
    ];
    expect(sortByFourths(mixed).map((i) => `${i.rootPc}:${i.quality}:${i.form}`)).toEqual([
      '0:m7:A',
      '5:m7:A',
      '0:m7:B',
      '5:dom7:A',
    ]);
  });

  it('keepOrder면 섞지 않고 받은 순서 그대로 낸다', () => {
    const items = sortByFourths(itemsOf('maj7', 'A'));
    const s = createSession(items, 0, Math.random, true);
    const order = [s.current!, ...s.queue].map((c) => c.item.rootPc);
    expect(order).toEqual(items.map((i) => i.rootPc));
  });

  it('기본은 섞는다', () => {
    const items = sortByFourths(itemsOf('maj7', 'A'));
    const same = Array.from({ length: 5 }, () => {
      const s = createSession(items, 0, Math.random);
      return [s.current!, ...s.queue].map((c) => c.item.rootPc).join();
    });
    expect(new Set(same).size).toBeGreaterThan(1);
  });
});

describe('보관함 — 맞힐 때까지 남는다', () => {
  it('틀리면 몇 번이든 다시 나온다 (세 번 틀리고 네 번째에 맞혀야 빠진다)', () => {
    let s = createSession(allItems().slice(0, 3), 0, Math.random);
    const first = itemId(s.current!.item);
    for (let i = 0; i < 3; i++) {
      // 이 카드가 나올 때마다 틀린다
      while (itemId(s.current!.item) !== first) s = answerCurrent(s, true);
      s = answerCurrent(s, false);
      expect(remaining(s), `${i + 1}번째 오답 뒤`).toBeGreaterThan(0);
    }
    while (itemId(s.current!.item) !== first) s = answerCurrent(s, true);
    s = answerCurrent(s, true);
    const left = [s.current, ...s.queue, ...s.retry].filter(Boolean).map((c) => itemId(c!.item));
    expect(left).not.toContain(first);
  });

  it('세션은 보관함이 빌 때까지 끝나지 않는다', () => {
    let s = createSession(allItems().slice(0, 4), 0, Math.random);
    for (let i = 0; i < 20; i++) {
      expect(s.current, `${i}번째`).not.toBeNull();
      s = answerCurrent(s, false); // 계속 틀린다
    }
    expect(remaining(s)).toBeGreaterThanOrEqual(4);
  });

  it('첫 시도 결과만 진도에 들어간다 — 나중에 맞혀도 firstTry는 false', () => {
    let s = createSession(allItems().slice(0, 2), 0, Math.random);
    const id = itemId(s.current!.item);
    s = answerCurrent(s, false);
    while (itemId(s.current!.item) !== id) s = answerCurrent(s, true);
    s = answerCurrent(s, true);
    expect(s.firstTry[id]).toBe(false);
    expect(s.misses[id]).toBe(1);
  });
});

describe('보관함 루프', () => {
  it('생성: total = N, 남은 카드 = N, current 존재', () => {
    const s = createSession(allItems().slice(0, 12), 1000, Math.random);
    expect(s.total).toBe(12);
    expect(remaining(s)).toBe(12);
    expect(s.current).not.toBeNull();
  });

  it('전부 첫 시도 정답이면 N번 만에 종료', () => {
    let s = createSession(allItems().slice(0, 5), 0, Math.random);
    for (let i = 0; i < 5; i++) {
      expect(s.current).not.toBeNull();
      s = answerCurrent(s, true);
    }
    expect(s.current).toBeNull();
    expect(remaining(s)).toBe(0);
    expect(Object.values(s.firstTry).every(Boolean)).toBe(true);
  });

  it('틀리면 남은 카드가 줄지 않고 보관함으로 갔다가 다시 나온다', () => {
    let s = createSession(allItems().slice(0, 2), 0, rand0);
    const missedId = itemId(s.current!.item);
    s = answerCurrent(s, false); // 첫 카드 틀림 → 보관함
    expect(remaining(s)).toBe(2);
    s = answerCurrent(s, true); // 둘째 카드 정답 → 보관함 라운드 시작
    expect(remaining(s)).toBe(1);
    expect(itemId(s.current!.item)).toBe(missedId);
    s = answerCurrent(s, true);
    expect(s.current).toBeNull();
  });

  it('보관함 카드는 최근 2문제에 나온 카드를 피해 뽑는다', () => {
    const [a, b, c] = [card(0), card(1), card(2)];
    const s: Session = {
      queue: [b, c],
      retry: [],
      current: a,
      recent: [itemId(a.item), itemId(b.item)],
      firstTry: {},
      firstSlow: {},
      misses: {},
      total: 3,
      startedAt: 0,
    };
    const next = answerCurrent(s, true);
    // b는 최근 2문제 안에 있으므로 c를 먼저 낸다
    expect(itemId(next.current!.item)).toBe(itemId(c.item));
    expect(ids(next.queue)).toEqual([itemId(b.item)]);
  });

  it('대안이 없으면 간격 규칙을 포기하고 그냥 낸다 (마지막 한 장 반복)', () => {
    let s = createSession([{ rootPc: 0, quality: 'maj7', form: 'A' } as Item, { rootPc: 1, quality: 'maj7', form: 'A' } as Item], 0, rand0);
    s = answerCurrent(s, true);
    const lastId = itemId(s.current!.item);
    s = answerCurrent(s, false); // 마지막 카드 틀림 → 보관함에 혼자
    expect(itemId(s.current!.item)).toBe(lastId); // 그래도 나온다
    s = answerCurrent(s, true);
    expect(s.current).toBeNull();
  });

  it('첫 시도 결과만 기록, 오답은 누적', () => {
    let s = createSession(allItems().slice(0, 2), 0, rand0);
    const missedId = itemId(s.current!.item);
    s = answerCurrent(s, false);
    s = answerCurrent(s, true);
    s = answerCurrent(s, false); // 보관함에서 또 틀림
    s = answerCurrent(s, true); // 이번엔 맞힘
    expect(s.current).toBeNull();
    expect(s.firstTry[missedId]).toBe(false); // 나중에 맞혔어도 첫 시도는 오답
    expect(s.misses[missedId]).toBe(2);
  });

  it('summarize: 첫 시도 정답률과 최다 오답 상위 3개', () => {
    let s = createSession(allItems().slice(0, 3), 1000, rand0);
    s = answerCurrent(s, false);
    s = answerCurrent(s, true);
    s = answerCurrent(s, true);
    s = answerCurrent(s, true); // 보관함 처리
    const sum = summarize(s, 61000);
    expect(sum.elapsedMs).toBe(60000);
    expect(sum.total).toBe(3);
    expect(sum.firstTryCorrect).toBe(2);
    expect(sum.topMisses).toHaveLength(1);
    expect(sum.topMisses[0].count).toBe(1);
  });
});
