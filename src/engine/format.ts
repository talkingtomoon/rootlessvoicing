import type { ChordQuality, ProgressionType } from './types';
import { keyName, toGlyphs } from './spelling';

/**
 * 표기 접미사는 quality 하나로 결정된다. 쓰임이 둘이라 표기도 둘인데, **랜덤이 아니라 용도로 갈린다.**
 *
 * - `quiz`(간략): 문제 화면. 실제 악보에서 만나는 짧은 표기다
 * - `full`(명시): 정답 공개. 무엇을 눌러야 하는지 다 적혀 있다
 *
 * 다섯 quality는 같은 코드의 다른 글자일 뿐이지만 **7♭9♭13만 명시 쪽이 정보를 더 담는다** —
 * 문제는 C7♭9로 나와도 보이싱에는 ♭13이 들어간다. 그 한 줄을 정답 화면에서 같이 보여준다
 * (`FULL_ADDS_INFO`). 지우지 마라 — 이 코드에서 제일 자주 틀리는 지점이다.
 */
export type Notation = 'quiz' | 'full';

/** 정답(명시) 표기 */
export const QUALITY_SYMBOL: Record<ChordQuality, string> = {
  m7: 'm7',
  dom7: '7',
  maj7: 'maj7',
  m7b5: 'm7b5',
  dom7b9b13: '7b9b13',
  m6: 'm6',
};

/** 문제(간략) 표기. dom7은 둘이 같다. */
export const QUALITY_SYMBOL_QUIZ: Record<ChordQuality, string> = {
  m7: '-7',
  dom7: '7',
  maj7: 'Δ7',
  m7b5: 'ø7',
  dom7b9b13: '7b9',
  m6: '-6',
};

/** 명시 표기가 글자만이 아니라 **내용**을 더 담는 quality */
export const FULL_ADDS_INFO: ChordQuality[] = ['dom7b9b13'];

/** 'Db' + 'm7b5' → 'D♭m7♭5' (기본은 명시 표기) */
export function chordSymbol(rootName: string, quality: ChordQuality, notation: Notation = 'full'): string {
  const table = notation === 'quiz' ? QUALITY_SYMBOL_QUIZ : QUALITY_SYMBOL;
  return toGlyphs(rootName) + toGlyphs(table[quality]);
}

/** 문맥 라벨: 'E♭ major' */
export function keyLabel(keyPc: number, type: ProgressionType): string {
  return `${toGlyphs(keyName(keyPc))} ${type}`;
}
