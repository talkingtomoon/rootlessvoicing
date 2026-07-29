export type ChordQuality = 'm7' | 'dom7' | 'maj7' | 'm7b5' | 'dom7b9';

export type Form = 'A' | 'B';

export type Voicing = {
  quality: ChordQuality;
  form: Form;
  /** 루트로부터 반음 수, 낮은 성부부터 오름차순 */
  intervals: number[];
  /** 표시용 도수 라벨 (ASCII: 'b3', '5', 'b7', '9', ...) — intervals와 같은 순서 */
  degrees: string[];
};

export type ProgressionType = 'major' | 'minor';

/** ASCII 음이름: 'C', 'Db', 'F#', 'Cb', 'B#' ... 렌더링 시에만 ♭/♯ 변환 */
export type NoteName = string;
