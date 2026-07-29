import { describe, expect, it } from 'vitest';
import type { Item } from '../../engine/items';
import { contextsFor, itemId } from '../../engine/items';
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
  return { item, ctx: contextsFor(rootPc, quality)[0] };
}

function ids(cards: SessionCard[]): string[] {
  return cards.map((c) => itemId(c.item));
}

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
