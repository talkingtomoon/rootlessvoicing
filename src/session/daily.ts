import type { ChordQuality, Form, ProgressionType } from '../engine/types';
import { itemId, type Item, type ItemId } from '../engine/items';
import { FOURTHS_ORDER } from '../engine/chord';
import { PROGRESSIONS } from '../engine/progressions';
import { majorSiblingOf } from '../engine/links';
import { isDue, LEITNER_INTERVALS, nextSessionNo, seenToday, type ProgressStore } from '../state/progress';

/**
 * 오늘의 15분. 코스(유닛)로 새 코드를 들이고, 짧은 판을 반복해 복습한다.
 *
 * **한 유닛 = 같은 quality를 세 루트로** (4도권 세 키가 한 블록).
 * 외울 대상은 (루트, quality, 폼) → 네 음이고 조성은 그 계산에 없다. 그래서 같은 모양을
 * 연달아 세 루트로 옮겨보는 게 조성 하나의 ii–V–I를 한 번에 배우는 것보다 빨리 손에 붙는다.
 *
 * 블록 안 순서는 진행 순서(ii → V → I)라 블록을 끝내면 완성된 ii–V–I가 세 개 생긴다.
 * 폼당 quality는 한 번만 가르친다 — 마이너 i(m7)는 메이저 ii에서 이미 배운다.
 *
 * **기둥 규칙**: 기대는 코드가 단계 2 이상일 때만 그 유닛을 들인다 (`isEligible`).
 * 단계 2 = 다른 날에 한 번 이상 맞힌 것. "Dm7에서 C만 B로" 같은 힌트는 Dm7이 굳은 뒤라야 쓸모가 있다.
 * 그래서 첫날은 기댈 데가 없는 ii(m7·ii∅)들만 들어오고, V는 다음 날, I는 그다음 날 들어온다.
 * 막히지 않게, 자격을 갖춘 유닛이 하나도 없으면 순서상 첫 유닛을 그냥 낸다.
 *
 * 유닛 진도는 따로 저장하지 않는다 — "아직 안 배운 item이 있는 첫 유닛"이 다음 유닛이다.
 * 그래서 진도 링크로 옮겨도, 암기 모드에서 먼저 배운 게 있어도 그대로 맞는다.
 */

export type Unit = {
  form: Form;
  type: ProgressionType;
  quality: ChordQuality;
  /** 출제 문맥의 도수 (ii, V, I …) — 세 키에서 같은 자리다 */
  roman: string;
  /** 이 유닛이 도는 세 키 (4도권 블록) */
  keys: number[];
  /** keys와 같은 순서 — 같은 모양, 세 루트 */
  items: Item[];
};

export const UNIT_FORMS: Form[] = ['A', 'B'];
export const UNIT_TYPES: ProgressionType[] = ['major', 'minor'];
/** 한 블록 = 4도권으로 이어지는 세 키. 블록을 끝내면 ii–V–I가 세 개 완성된다 */
export const BLOCK_SIZE = 3;
export const BLOCKS: number[][] = Array.from({ length: FOURTHS_ORDER.length / BLOCK_SIZE }, (_, i) =>
  FOURTHS_ORDER.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE),
);
/** 기둥으로 인정하는 최소 단계 — 2면 다른 날에 한 번 이상 맞혔다는 뜻이다 */
export const PREREQ_LEVEL = 2;

/** 설정으로 꺼둔 진행·폼은 코스에서 뺀다. 폼당 quality는 한 번만 가르친다. */
export function curriculum(forms: Form[] = UNIT_FORMS, types: ProgressionType[] = UNIT_TYPES): Unit[] {
  const out: Unit[] = [];
  for (const form of UNIT_FORMS) {
    if (!forms.includes(form)) continue;
    const taught = new Set<ChordQuality>();
    for (const type of UNIT_TYPES) {
      if (!types.includes(type)) continue;
      const slots = PROGRESSIONS[type].filter((s) => !taught.has(s.quality));
      for (const s of slots) taught.add(s.quality);
      for (const keys of BLOCKS) {
        for (const slot of slots) {
          out.push({
            form,
            type,
            quality: slot.quality,
            roman: slot.roman,
            keys,
            items: keys.map((k) => ({ rootPc: (k + slot.rootOffset) % 12, quality: slot.quality, form })),
          });
        }
      }
    }
  }
  return out;
}

export function isLearned(store: ProgressStore, item: Item): boolean {
  return itemId(item) in store.items;
}

/**
 * 이 유닛이 기대는 코드들. 셋 다 "이걸 알면 저건 한두 음 차이"인 관계다.
 * ① 진행에서 바로 앞 코드 (V는 ii에서, I는 V에서)
 * ② 마이너 ii∅·V7♭9는 같은 루트의 m7·7
 * ③ B형은 같은 코드의 A형
 */
export function unitPrereqs(unit: Unit): Item[] {
  const slots = PROGRESSIONS[unit.type];
  const slotIdx = slots.findIndex((s) => s.roman === unit.roman);
  const out: Item[] = [];
  for (const [i, item] of unit.items.entries()) {
    if (slotIdx > 0) {
      const prev = slots[slotIdx - 1];
      out.push({ rootPc: (unit.keys[i] + prev.rootOffset) % 12, quality: prev.quality, form: unit.form });
    }
    const sibling = majorSiblingOf(item.quality);
    if (sibling) out.push({ rootPc: item.rootPc, quality: sibling, form: unit.form });
    if (unit.form === 'B') out.push({ rootPc: item.rootPc, quality: item.quality, form: 'A' });
  }
  return out;
}

/** 기둥이 다 섰는가. 풀에 없는(설정으로 끈) 기둥은 따지지 않는다. */
export function isEligible(store: ProgressStore, pool: Item[], unit: Unit): boolean {
  const inPool = new Set(pool.map(itemId));
  return unitPrereqs(unit).every((p) => {
    const id = itemId(p);
    if (!inPool.has(id)) return true;
    return (store.items[id]?.level ?? 0) >= PREREQ_LEVEL;
  });
}

/**
 * 다음에 배울 유닛과 그 안의 새 item. 코스를 다 배웠으면 null.
 * 기둥이 선 유닛을 먼저 고르고, 하나도 없으면 순서상 첫 유닛으로 떨어진다(막히지 않게).
 */
export function nextUnit(
  store: ProgressStore,
  units: Unit[],
  pool?: Item[],
): { unit: Unit; index: number; fresh: Item[]; blocked: boolean } | null {
  let fallback: { unit: Unit; index: number; fresh: Item[]; blocked: boolean } | null = null;
  for (let i = 0; i < units.length; i++) {
    const fresh = units[i].items.filter((it) => !isLearned(store, it));
    if (fresh.length === 0) continue;
    if (!pool || isEligible(store, pool, units[i])) {
      return { unit: units[i], index: i, fresh, blocked: false };
    }
    fallback ??= { unit: units[i], index: i, fresh, blocked: true };
  }
  return fallback;
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
