import type { ChordQuality, ProgressionType } from './types';
import { keyName, toGlyphs } from './spelling';

/**
 * 표기 접미사는 quality 하나로 결정된다.
 * 마이너 i는 9음을 품지만 메이저 ii와 같은 m7로 표기한다 (같은 보이싱 = 같은 라벨).
 */
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

/** 문맥 라벨: 'E♭ major' */
export function keyLabel(keyPc: number, type: ProgressionType): string {
  return `${toGlyphs(keyName(keyPc))} ${type}`;
}
