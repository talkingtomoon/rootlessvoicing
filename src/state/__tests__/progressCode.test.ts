import { describe, expect, it } from 'vitest';
import { allItems, itemId } from '../../engine/items';
import { applyResults, emptyProgress, isDue, type ProgressStore } from '../progress';
import { decodeProgress, encodeProgress, parsePasted, readIncoming } from '../progressCode';

function storeOf(session: number, entries: [number, number, number][]): ProgressStore {
  const all = allItems();
  const items: ProgressStore['items'] = {};
  for (const [idx, level, lastSeen] of entries) {
    items[itemId(all[idx])] = { level, lastSeenSession: lastSeen };
  }
  return { session, items };
}

describe('진도 코드', () => {
  it('빈 진도도 왕복된다', () => {
    const code = encodeProgress(emptyProgress());
    expect(decodeProgress(code)).toEqual(emptyProgress());
  });

  it('단계·나이가 그대로 왕복된다', () => {
    const store = storeOf(40, [
      [0, 1, 40],
      [7, 3, 38],
      [119, 5, 25],
    ]);
    expect(decodeProgress(encodeProgress(store))).toEqual(store);
  });

  it('120개 전부 학습된 상태도 왕복된다', () => {
    let store = emptyProgress();
    const firstTry: Record<string, boolean> = {};
    for (const it of allItems()) firstTry[itemId(it)] = true;
    store = applyResults(store, firstTry);
    expect(decodeProgress(encodeProgress(store))).toEqual(store);
  });

  it('URL에 넣을 만큼 짧다 (200자 미만)', () => {
    let store = emptyProgress();
    const firstTry: Record<string, boolean> = {};
    for (const it of allItems()) firstTry[itemId(it)] = true;
    store = applyResults(store, firstTry);
    const code = encodeProgress(store);
    expect(code.length).toBeLessThan(200);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe
  });

  it('나이를 31에서 잘라도 재출제 판정은 같다', () => {
    // 세션 100에 마지막으로 본 게 세션 1 (나이 99 → 31로 잘림)
    const store = storeOf(100, [[0, 5, 1]]);
    const back = decodeProgress(encodeProgress(store))!;
    const id = itemId(allItems()[0]);
    expect(back.items[id].lastSeenSession).toBe(69); // 100 - 31
    // 간격 판정은 둘 다 '지남'
    expect(isDue(store.items[id], 101)).toBe(true);
    expect(isDue(back.items[id], 101)).toBe(true);
  });

  it('망가진 코드는 null (진도를 날리지 않는다)', () => {
    expect(decodeProgress('')).toBeNull();
    expect(decodeProgress('!!!not base64!!!')).toBeNull();
    expect(decodeProgress('AAAA')).toBeNull(); // 길이 부족
    const good = encodeProgress(storeOf(3, [[0, 2, 3]]));
    expect(decodeProgress(good.slice(0, -4))).toBeNull();
  });

  it('버전이 다르면 null', () => {
    const bytes = new Uint8Array(123);
    bytes[0] = 99;
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const code = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeProgress(code)).toBeNull();
  });

  it('item 순서는 포맷의 일부 — 바뀌면 옛 코드가 깨진다', () => {
    const all = allItems();
    expect(all).toHaveLength(120);
    expect(itemId(all[0])).toBe('0:m7:A');
    expect(itemId(all[119])).toBe('11:dom7b9:B');
  });

  it('parsePasted: 링크 전체든 코드만이든, 출처가 달라도 읽는다', () => {
    const store = storeOf(7, [[10, 2, 5]]);
    const code = encodeProgress(store);
    expect(parsePasted(code)).toEqual(store);
    expect(parsePasted(`http://localhost:4174/#p=${code}`)).toEqual(store);
    expect(parsePasted(`https://talkingtomoon.github.io/rootlessvoicing/#p=${code}`)).toEqual(store);
    expect(parsePasted(`  http://localhost:4174/?v=1#p=${code}  `)).toEqual(store);
    expect(parsePasted('')).toBeNull();
    expect(parsePasted('https://example.com/')).toBeNull();
    expect(parsePasted('#p=쓰레기')).toBeNull();
  });

  it('readIncoming: 주소에서 코드를 읽는다', () => {
    const store = storeOf(5, [[3, 4, 2]]);
    const code = encodeProgress(store);
    expect(readIncoming(`#p=${code}`)).toEqual(store);
    expect(readIncoming('#p=쓰레기')).toBeNull();
    expect(readIncoming('')).toBeNull();
    expect(readIncoming('#other=1')).toBeNull();
  });
});
