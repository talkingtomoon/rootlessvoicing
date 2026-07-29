import type { ChordQuality, Form, ProgressionType } from './types';
import { QUALITIES } from './voicings';

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
};

/**
 * 이 item이 출제될 수 있는 문맥 목록. m7만 두 개(메이저 ii / 마이너 i) — 의도된 것.
 * 출제 시 이 중 하나를 무작위로 골라 라벨을 붙인다.
 */
export function contextsFor(rootPc: number, quality: ChordQuality): ItemContext[] {
  const pc = ((rootPc % 12) + 12) % 12;
  switch (quality) {
    case 'm7':
      return [
        { type: 'major', keyPc: (pc + 10) % 12, roman: 'ii' },
        { type: 'minor', keyPc: pc, roman: 'i' },
      ];
    case 'dom7':
      return [{ type: 'major', keyPc: (pc + 5) % 12, roman: 'V' }];
    case 'maj7':
      return [{ type: 'major', keyPc: pc, roman: 'I' }];
    case 'm7b5':
      return [{ type: 'minor', keyPc: (pc + 10) % 12, roman: 'ii∅' }];
    case 'dom7b9':
      return [{ type: 'minor', keyPc: (pc + 5) % 12, roman: 'V' }];
  }
}
