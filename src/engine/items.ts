import type { ChordQuality, Form, ProgressionType } from './types';
import { QUALITIES } from './voicings';
import { PROGRESSIONS } from './progressions';

/** SRS 항목 식별자: (rootPc, quality, form) — 고유 120개. 문맥(키·도수)은 식별자에 포함하지 않는다. */
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

export type ItemContext = {
  type: ProgressionType;
  keyPc: number;
  roman: string;
  /** 이 문맥에서의 코드 심볼 접미사 — 같은 m7이 'm7'(메이저 ii) / 'm9'(마이너 i)로 갈린다 */
  symbol: string;
};

/**
 * 이 item이 출제될 수 있는 문맥 목록. PROGRESSIONS에서 파생하므로 진행 정의만 고치면 따라온다.
 * m7만 두 개(메이저 ii / 마이너 i) — 의도된 것.
 * 출제 시 이 중 하나를 무작위로 골라 라벨을 붙인다.
 */
export function contextsFor(rootPc: number, quality: ChordQuality): ItemContext[] {
  const pc = ((rootPc % 12) + 12) % 12;
  const out: ItemContext[] = [];
  for (const type of ['major', 'minor'] as ProgressionType[]) {
    for (const slot of PROGRESSIONS[type]) {
      if (slot.quality !== quality) continue;
      out.push({
        type,
        keyPc: ((pc - slot.rootOffset) % 12 + 12) % 12,
        roman: slot.roman,
        symbol: slot.symbol,
      });
    }
  }
  return out;
}
