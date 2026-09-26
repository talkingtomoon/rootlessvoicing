import { describe, expect, it } from 'vitest';
import { allItems, itemId } from '../../engine/items';
import { emptyProgress, isDue, mergeProgress, mergeSummary, type ProgressStore } from '../progress';
import { decodeProgress, encodeProgress } from '../progressCode';

const [a, b, c] = allItems();
const ids = { a: itemId(a), b: itemId(b), c: itemId(c) };

function store(session: number, entries: [string, number, number][]): ProgressStore {
  return {
    session,
    items: Object.fromEntries(entries.map(([id, level, lastSeenSession]) => [id, { level, lastSeenSession }])),
  };
}

describe('진도 합치기', () => {
  it('세션 번호가 달라도 나이로 비교한다', () => {
    // 이 기기: 세션 20, a를 2세션 전에 (나이 2) / 가져온 것: 세션 5, a를 4세션 전에 (나이 4)
    const local = store(20, [[ids.a, 3, 18]]);
    const incoming = store(5, [[ids.a, 3, 1]]);
    const merged = mergeProgress(local, incoming);
    expect(merged.session).toBe(20);
    expect(merged.items[ids.a].lastSeenSession).toBe(16); // 더 밀린 쪽(나이 4)
  });

  it('단계는 높은 쪽, 나이는 더 밀린 쪽', () => {
    const local = store(10, [[ids.a, 2, 9]]); // 단계 2, 나이 1
    const incoming = store(10, [[ids.a, 4, 4]]); // 단계 4, 나이 6
    const merged = mergeProgress(local, incoming);
    expect(merged.items[ids.a]).toEqual({ level: 4, lastSeenSession: 4 });
  });

  it('복습이 일찍 돌아오는 쪽으로 기운다', () => {
    const local = store(10, [[ids.a, 2, 10]]); // 방금 봄 — 아직 안 밀림
    const incoming = store(10, [[ids.a, 2, 4]]); // 나이 6 — 단계 2 간격(2)을 넘김
    const merged = mergeProgress(local, incoming);
    expect(isDue(local.items[ids.a], local.session + 1)).toBe(false);
    expect(isDue(merged.items[ids.a], merged.session + 1)).toBe(true);
  });

  it('한쪽에만 있는 항목은 나이를 지킨 채 들어오고, 이쪽 것은 남는다', () => {
    const local = store(10, [[ids.a, 5, 8]]);
    const incoming = store(3, [[ids.b, 2, 1]]); // 나이 2
    const merged = mergeProgress(local, incoming);
    expect(merged.items[ids.a]).toEqual({ level: 5, lastSeenSession: 8 });
    expect(merged.items[ids.b]).toEqual({ level: 2, lastSeenSession: 8 });
  });

  it('덮어쓰기와 달리 이쪽 진도가 사라지지 않는다', () => {
    const local = store(10, [
      [ids.a, 4, 9],
      [ids.b, 3, 9],
    ]);
    const incoming = store(2, [[ids.c, 1, 2]]);
    expect(Object.keys(mergeProgress(local, incoming).items)).toHaveLength(3);
  });

  it('학습일은 이 기기 것을 유지한다', () => {
    const local: ProgressStore = { ...store(4, [[ids.a, 2, 4]]), lastDay: '2026-09-26' };
    expect(mergeProgress(local, store(9, [[ids.b, 2, 9]])).lastDay).toBe('2026-09-26');
    expect(mergeProgress(store(1, []), store(1, [])).lastDay).toBeUndefined();
  });

  it('같은 것을 합치면 그대로다', () => {
    const local = store(7, [
      [ids.a, 3, 5],
      [ids.b, 1, 7],
    ]);
    expect(mergeProgress(local, local)).toEqual({ session: 7, items: local.items });
  });

  it('빈 진도와 합치면 상대를 그대로 받는다', () => {
    const incoming = store(3, [[ids.a, 2, 2]]);
    const merged = mergeProgress(emptyProgress(), incoming);
    expect(merged.items[ids.a].level).toBe(2);
    expect(merged.session).toBe(0);
  });

  it('링크를 통과해도(나이 보존) 같은 결과', () => {
    const local = store(30, [[ids.a, 2, 29]]);
    const far = store(9, [
      [ids.a, 4, 3],
      [ids.b, 5, 8],
    ]);
    const throughLink = decodeProgress(encodeProgress(far))!;
    expect(mergeProgress(local, throughLink)).toEqual(mergeProgress(local, far));
  });

  it('요약: 늘어나는 수와 단계가 오르는 수', () => {
    const local = store(5, [
      [ids.a, 2, 5],
      [ids.b, 4, 5],
    ]);
    const incoming = store(5, [
      [ids.a, 3, 5], // 단계 오름
      [ids.b, 1, 5], // 이쪽이 더 높음
      [ids.c, 2, 5], // 새로 들어옴
    ]);
    expect(mergeSummary(local, incoming)).toEqual({ added: 1, raised: 1, total: 3 });
  });
});
