import type { Form, ProgressionType } from '../engine/types';
import { itemId, type Item, type ItemId } from '../engine/items';
import { FOURTHS_ORDER } from '../engine/chord';
import { PROGRESSIONS } from '../engine/progressions';
import { isDue, LEITNER_INTERVALS, nextSessionNo, seenToday, type ProgressStore } from '../state/progress';

/**
 * 오늘의 15분. 순서가 정해진 코스(유닛)로 새 코드를 들이고, 짧은 판을 반복해 복습한다.
 *
 * 코스 = 폼 × 진행 × 키. A형 메이저 12키 → A형 마이너 12키 → B형 메이저 → B형 마이너.
 * 키는 4도권 순. 한 유닛 = 한 키의 ii–V–I 세 코드(마이너의 i는 이미 배운 m7이라 보통 새 코드 2개).
 * 메이저를 먼저 굳히는 이유: 마이너 ii∅·V7♭9는 같은 루트 m7·7에서 두 음만 내린 모양이라 기댈 데가 생긴다.
 *
 * 유닛 진도는 따로 저장하지 않는다 — "아직 안 배운 item이 있는 첫 유닛"이 다음 유닛이다.
 * 그래서 진도 링크로 옮겨도, 암기 모드에서 먼저 배운 게 있어도 그대로 맞는다.
 */

export type Unit = {
  form: Form;
  type: ProgressionType;
  keyPc: number;
  /** ii, V, I 순 */
  items: Item[];
};

export const UNIT_FORMS: Form[] = ['A', 'B'];
export const UNIT_TYPES: ProgressionType[] = ['major', 'minor'];

export function unitItems(keyPc: number, type: ProgressionType, form: Form): Item[] {
  return PROGRESSIONS[type].map((slot) => ({
    rootPc: (keyPc + slot.rootOffset) % 12,
    quality: slot.quality,
    form,
  }));
}

/** 설정으로 꺼둔 진행·폼은 코스에서 뺀다 */
export function curriculum(forms: Form[] = UNIT_FORMS, types: ProgressionType[] = UNIT_TYPES): Unit[] {
  const out: Unit[] = [];
  for (const form of UNIT_FORMS) {
    if (!forms.includes(form)) continue;
    for (const type of UNIT_TYPES) {
      if (!types.includes(type)) continue;
      for (const keyPc of FOURTHS_ORDER) out.push({ form, type, keyPc, items: unitItems(keyPc, type, form) });
    }
  }
  return out;
}

export function isLearned(store: ProgressStore, item: Item): boolean {
  return itemId(item) in store.items;
}

/** 다음에 배울 유닛과 그 안의 새 item. 코스를 다 배웠으면 null */
export function nextUnit(store: ProgressStore, units: Unit[]): { unit: Unit; index: number; fresh: Item[] } | null {
  for (let i = 0; i < units.length; i++) {
    const fresh = units[i].items.filter((it) => !isLearned(store, it));
    if (fresh.length > 0) return { unit: units[i], index: i, fresh };
  }
  return null;
}

/** 유닛 상태: 다 배움 / 일부 / 안 배움 */
export function unitState(store: ProgressStore, unit: Unit): 'done' | 'partial' | 'none' {
  const n = unit.items.filter((it) => isLearned(store, it)).length;
  return n === unit.items.length ? 'done' : n > 0 ? 'partial' : 'none';
}

/** 한 판 카드 수 — 폰으로 1분 남짓 */
export const ROUND_SIZE = 8;
/** 하루에 들이는 유닛 상한 */
export const MAX_UNITS_PER_DAY = 3;
/** 단계 1(흔들리는) 항목이 이만큼 쌓이면 새 유닛을 멈춘다 */
export const FRAGILE_LIMIT = 10;

/** 오늘 아직 채점 안 한, 간격이 지난 항목 — 단계 낮은 순, 같으면 더 밀린 순 */
export function dueToday(store: ProgressStore, pool: Item[], day: string): Item[] {
  const sessionNo = nextSessionNo(store, day);
  const overdue = (id: ItemId) => {
    const p = store.items[id];
    return sessionNo - p.lastSeenSession - LEITNER_INTERVALS[p.level - 1];
  };
  return pool
    .filter((it) => {
      const id = itemId(it);
      const p = store.items[id];
      return p && !seenToday(store, id, day) && isDue(p, sessionNo);
    })
    .sort((a, b) => {
      const pa = store.items[itemId(a)];
      const pb = store.items[itemId(b)];
      return pa.level - pb.level || overdue(itemId(b)) - overdue(itemId(a));
    });
}

export function fragileCount(store: ProgressStore, pool: Item[]): number {
  return pool.filter((it) => store.items[itemId(it)]?.level === 1).length;
}

/**
 * 판을 시작하기 전에 새 유닛을 들일까.
 * 복습이 한 판 넘게 밀려 있거나, 흔들리는 항목이 많거나, 오늘 이미 충분히 들였으면 안 들인다.
 */
export function shouldIntroduce(
  store: ProgressStore,
  pool: Item[],
  units: Unit[],
  day: string,
  unitsToday: number,
): boolean {
  if (unitsToday >= MAX_UNITS_PER_DAY) return false;
  if (!nextUnit(store, units)) return false;
  if (dueToday(store, pool, day).length > ROUND_SIZE) return false;
  return fragileCount(store, pool) < FRAGILE_LIMIT;
}

/**
 * 한 판 구성. 우선순위:
 * ① 방금 배운 새 코드 ② 오늘 안 본 due ③ 오늘 틀렸거나 흔들리는(단계 ≤2) 항목 다시
 * ④ 오늘 안 본 나머지 배운 항목, 단계 낮은 순·오래된 순 ⑤ 그래도 모자라면 오늘 본 것 단계 낮은 순
 * 출제 순서는 createSession이 섞는다.
 */
export function planRound(
  store: ProgressStore,
  pool: Item[],
  day: string,
  fresh: Item[] = [],
  size = ROUND_SIZE,
): Item[] {
  const picked: Item[] = [];
  const has = new Set<ItemId>();
  const add = (items: Item[]) => {
    for (const it of items) {
      if (picked.length >= size) return;
      const id = itemId(it);
      if (has.has(id)) continue;
      has.add(id);
      picked.push(it);
    }
  };

  add(fresh);
  add(dueToday(store, pool, day));

  const learned = pool.filter((it) => isLearned(store, it));
  const byLevelThenAge = (a: Item, b: Item) => {
    const pa = store.items[itemId(a)];
    const pb = store.items[itemId(b)];
    return pa.level - pb.level || pa.lastSeenSession - pb.lastSeenSession;
  };
  const today = learned.filter((it) => seenToday(store, itemId(it), day));
  const notToday = learned.filter((it) => !seenToday(store, itemId(it), day));

  // 오늘 흔들린 것은 한 판에 절반까지만 다시 — 판 전체가 같은 카드로 채워지지 않게
  const shaky = today.filter((it) => store.items[itemId(it)].level <= 2).sort(byLevelThenAge);
  add(shaky.slice(0, Math.ceil(size / 2)));
  add([...notToday].sort(byLevelThenAge));
  add([...today].sort(byLevelThenAge));
  return picked;
}

/** 반응 시간 기준 (ms). 이보다 오래 걸리면 맞아도 "느림" — 단계를 올리지 않는다 */
export const FAST_MS = {
  /** 화면 건반에 4음 순서대로 — 누르는 시간까지 포함 */
  tap: 6000,
} as const;
