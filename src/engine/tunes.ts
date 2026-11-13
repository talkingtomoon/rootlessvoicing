import type { ChordQuality } from './types';

/**
 * 곡 모드 — 실제 곡의 진행을 순서대로 치는 연습.
 *
 * 차트의 코드를 앱의 여섯 quality로 **옮겨 적는다**. 앱에 없는 모양을 새로 만들지 마라:
 * - `D7(♭5♭9)` · `D7(♯5♯9)` 같은 알터드는 전부 `dom7b9b13`
 * - `F6`는 `maj7`로 친다 (6과 7의 차이는 라벨에 남긴다)
 * - `B♭-`는 `m7` (m6으로 치고 싶으면 그 자리만 바꿔 듣는다)
 *
 * `label`은 **차트에 적힌 표기 그대로**다 — 화면에는 이걸 보여준다.
 * 앱이 만들어내는 심볼(`chordSymbol`)과 다를 수 있고, 그게 맞다.
 */
export type TuneChord = {
  rootPc: number;
  quality: ChordQuality;
  /** 이 코드가 차지하는 박 (4/4의 한 마디 = 4) */
  beats: number;
  /** 차트 표기 그대로 */
  label: string;
};

export type Tune = {
  id: string;
  title: string;
  composer: string;
  /** 조성 (pitch class) — 표시용 */
  keyPc: number;
  beatsPerBar: number;
  /** 마디별 코드 */
  bars: TuneChord[][];
};

const bar = (...chords: [number, ChordQuality, string, number?][]): TuneChord[] =>
  chords.map(([rootPc, quality, label, beats]) => ({ rootPc, quality, label, beats: beats ?? 4 }));

/** The Days of Wine and Roses — Henry Mancini, F장조 32마디 */
export const DAYS_OF_WINE_AND_ROSES: Tune = {
  id: 'days-of-wine-and-roses',
  title: 'The Days of Wine and Roses',
  composer: 'Mancini',
  keyPc: 5,
  beatsPerBar: 4,
  bars: [
    bar([5, 'maj7', 'Fmaj7']),
    bar([3, 'dom7', 'E♭7']),
    bar([2, 'dom7b9b13', 'D7alt']),
    bar([2, 'dom7', 'D7']),
    bar([7, 'm7', 'Gm7']),
    bar([7, 'm7', 'Gm7']),
    bar([10, 'm7', 'B♭m7']),
    bar([3, 'dom7', 'E♭7']),
    bar([9, 'm7', 'Am7']),
    bar([2, 'm7', 'Dm7']),
    bar([7, 'm7', 'Gm7']),
    bar([0, 'dom7', 'C7']),
    bar([4, 'm7b5', 'Em7♭5', 2], [9, 'dom7b9b13', 'A7♭9', 2]),
    bar([2, 'm7', 'Dm7', 2], [7, 'dom7', 'G7', 2]),
    bar([7, 'm7', 'Gm7']),
    bar([0, 'dom7', 'C7']),
    bar([5, 'maj7', 'Fmaj7']),
    bar([3, 'dom7', 'E♭7']),
    bar([2, 'dom7b9b13', 'D7alt']),
    bar([2, 'dom7', 'D7']),
    bar([7, 'm7', 'Gm7']),
    bar([7, 'm7', 'Gm7']),
    bar([10, 'm7', 'B♭m7']),
    bar([3, 'dom7', 'E♭7']),
    bar([9, 'm7', 'Am7']),
    bar([2, 'm7', 'Dm7']),
    bar([11, 'm7b5', 'Bm7♭5']),
    bar([10, 'dom7', 'B♭7']),
    bar([9, 'm7', 'Am7', 2], [2, 'm7', 'Dm7', 2]),
    bar([7, 'm7', 'Gm7', 2], [0, 'dom7', 'C7', 2]),
    bar([5, 'maj7', 'F6']),
    bar([7, 'm7', 'Gm7', 2], [0, 'dom7', 'C7', 2]),
  ],
};

export const TUNES: Tune[] = [DAYS_OF_WINE_AND_ROSES];

/** 마디를 펴서 코드 순서대로 */
export function tuneChords(tune: Tune): TuneChord[] {
  return tune.bars.flat();
}
