import type { ChordQuality, Form, NoteName } from './types';
import { getVoicing } from './voicings';
import { placeVoicing } from './placement';
import { ROOT_NAMES, spellVoicing } from './spelling';

export type Chord = {
  quality: ChordQuality;
  form: Form;
  rootName: NoteName;
  rootPc: number;
  /** 낮은 성부부터, canonical 배치 */
  midi: number[];
  /** midi와 같은 순서의 음이름 */
  noteNames: NoteName[];
  /** midi와 같은 순서의 도수 라벨 */
  degrees: string[];
};

/**
 * 진행 문맥 없는 단일 코드. 배치는 canonical(`placeVoicing`).
 * 타입별 듣기·암기 정답 표시처럼 ii–V–I 문맥이 없는 곳에서 쓴다.
 */
export function buildChord(rootPc: number, quality: ChordQuality, form: Form): Chord {
  const pc = ((rootPc % 12) + 12) % 12;
  const rootName = ROOT_NAMES[pc];
  const voicing = getVoicing(quality, form);
  return {
    quality,
    form,
    rootName,
    rootPc: pc,
    midi: placeVoicing(pc, voicing),
    noteNames: spellVoicing(rootName, voicing),
    degrees: [...voicing.degrees],
  };
}

/** 반음계 순 */
export const CHROMATIC_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** 4도권 순 (C F B♭ E♭ A♭ C♯ F♯ B E A D G) — 한 보이싱을 12키에 굳힐 때의 관용 순서 */
export const FOURTHS_ORDER = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
