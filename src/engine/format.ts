import type { ChordQuality, ProgressionType } from './types';
import { keyName, toGlyphs } from './spelling';

/**
 * 표기 접미사는 quality 하나로 결정된다. 현장에서 쓰는 표기가 두 갈래라 둘 다 외워야 한다.
 * **문제에는 둘 중 하나만 보여준다** — 나란히 놓으면 대조가 되어 인식 훈련이 안 된다
 * (`createSession`이 카드마다 하나를 뽑는다). 같은 item이 한 세션에 두 표기로 나오는 건 괜찮다.
 */
export type Notation = 'plain' | 'alt';

export const QUALITY_SYMBOL: Record<ChordQuality, string> = {
  m7: 'm7',
  dom7: '7',
  maj7: 'maj7',
  m7b5: 'm7b5',
  dom7b9b13: '7b9b13',
  m6: 'm6',
};

/** 같은 코드의 다른 관용 표기. dom7은 둘이 같다. */
export const QUALITY_SYMBOL_ALT: Record<ChordQuality, string> = {
  m7: '-7',
  dom7: '7',
  maj7: 'Δ7',
  m7b5: 'ø7',
  dom7b9b13: '7(b9b13)',
  m6: '-6',
};

export const NOTATIONS: Notation[] = ['plain', 'alt'];

/** 'Db' + 'm7b5' → 'D♭m7♭5' */
export function chordSymbol(rootName: string, quality: ChordQuality, notation: Notation = 'plain'): string {
  const table = notation === 'alt' ? QUALITY_SYMBOL_ALT : QUALITY_SYMBOL;
  return toGlyphs(rootName) + toGlyphs(table[quality]);
}

/** 문맥 라벨: 'E♭ major' */
export function keyLabel(keyPc: number, type: ProgressionType): string {
  return `${toGlyphs(keyName(keyPc))} ${type}`;
}
