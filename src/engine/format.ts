import type { ProgressionType } from './types';
import { keyName, toGlyphs } from './spelling';

/**
 * 코드 심볼. 접미사는 quality가 아니라 진행 슬롯(문맥)이 정한다 —
 * 같은 m7 보이싱이 메이저 ii에서는 Dm7, 마이너 i에서는 Cm9다.
 * 접미사는 ProgressionSlot.symbol / ItemContext.symbol에서 가져올 것.
 */
export function chordSymbol(rootName: string, symbol: string): string {
  return toGlyphs(rootName) + toGlyphs(symbol);
}

/** eyebrow용 키 라벨: 'D♭ major' */
export function keyLabel(keyPc: number, type: ProgressionType): string {
  return `${toGlyphs(keyName(keyPc, type))} ${type}`;
}
