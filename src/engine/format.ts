import type { ChordQuality, ProgressionType } from './types';
import { keyName, toGlyphs } from './spelling';

export const QUALITY_SYMBOL: Record<ChordQuality, string> = {
  m7: 'm7',
  dom7: '7',
  maj7: 'maj7',
  m7b5: 'm7b5',
  dom7b9: '7b9',
};

/** 'Db' + 'm7b5' → 'D♭m7♭5' */
export function chordSymbol(rootName: string, quality: ChordQuality): string {
  return toGlyphs(rootName) + toGlyphs(QUALITY_SYMBOL[quality]);
}

/** eyebrow용 키 라벨: 'D♭ major' */
export function keyLabel(keyPc: number, type: ProgressionType): string {
  return `${toGlyphs(keyName(keyPc, type))} ${type}`;
}
