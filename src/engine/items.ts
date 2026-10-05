import type { ChordQuality, Form, ProgressionType } from './types';
import { QUALITIES } from './voicings';
import { PROGRESSIONS } from './progressions';

/** SRS 항목 식별자: (rootPc, quality, form) — 고유 144개. 문맥(키·도수)은 식별자에 포함하지 않는다. */
export type Item = {
  rootPc: number;
  quality: ChordQuality;
  form: Form;
};

export type ItemId = string; // "{rootPc}:{quality}:{form}"

export function itemId(item: Item): ItemId {
  return `${item.rootPc}:${item.quality}:${item.form}`;
}

export function parseItemId(id: ItemId): Item {
  const [rootPc, quality, form] = id.split(':');
  return { rootPc: Number(rootPc), quality: quality as ChordQuality, form: form as Form };
}

export function allItems(): Item[] {
  const items: Item[] = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const quality of QUALITIES) {
      for (const form of ['A', 'B'] as Form[]) {
        items.push({ rootPc, quality, form });
      }
    }
  }
  return items;
}

/** 한 quality × form의 12루트 — 타입별 암기 모드의 출제 단위 */
export function itemsOf(quality: ChordQuality, form: Form): Item[] {
  return Array.from({ length: 12 }, (_, rootPc) => ({ rootPc, quality, form }));
}

export type ItemContext = {
  type: ProgressionType;
  keyPc: number;
  roman: string;
};

/**
 * 이 item의 출제 문맥. PROGRESSIONS에서 파생하므로 진행 정의만 고치면 따라온다.
 * **quality마다 자리가 하나뿐이다** — 마이너 i가 m6이 되면서 m7의 이중 문맥(메이저 ii / 마이너 i)이 사라졌다.
 * 정의가 어긋나 자리를 못 찾으면 메이저 ii로 떨어진다(카드가 사라지는 것보다 낫다).
 */
export function contextOf(rootPc: number, quality: ChordQuality): ItemContext {
  const pc = ((rootPc % 12) + 12) % 12;
  for (const type of ['major', 'minor'] as ProgressionType[]) {
    for (const slot of PROGRESSIONS[type]) {
      if (slot.quality !== quality) continue;
      return { type, keyPc: ((pc - slot.rootOffset) % 12 + 12) % 12, roman: slot.roman };
    }
  }
  return { type: 'major', keyPc: pc, roman: PROGRESSIONS.major[0].roman };
}
