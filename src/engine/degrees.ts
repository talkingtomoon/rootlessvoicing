import type { ChordQuality, NoteName } from './types';
import type { Item } from './items';
import { QUALITIES, getVoicing } from './voicings';
import { ROOT_NAMES, spellDegree } from './spelling';
import { stackAscending } from './grading';

/**
 * 도수 드릴 — 코드 심볼을 보고 구성음을 **루트부터 차례로** 찍는 층. 보이싱보다 먼저 거친다.
 *
 * **루트를 빼면 그 코드의 보이싱 그 자체다.** 이게 이 모드의 존재 이유다 —
 * 도수 드릴에서 보이싱으로 넘어갈 때 "루트 빼고 나머지"가 전부가 되도록 맞춰져 있다.
 * 그래서 두 도미넌트에는 5음이 없고, m7♭5는 루트가 보이싱에 들어 있어 4음이다.
 * **균일하게 만들지 마라** — 표를 손으로 따로 적지도 마라. A형 보이싱에서 파생한다.
 *
 * 한 옥타브 안에서 찍는다. 9는 2도 자리, 13은 6도 자리다 (옥타브를 올려 찍게 하지 않는다).
 */
export type DegreeStep = {
  /** ASCII 도수 라벨: '1', 'b3', '13' … */
  degree: string;
  /** 루트에서 반음 (0..11) */
  semitone: number;
};

const degreeNumber = (degree: string) => parseInt(degree.replace(/[b#]/g, ''), 10);

export function degreeSteps(quality: ChordQuality): DegreeStep[] {
  const voicing = getVoicing(quality, 'A');
  // 루트 + A형 보이싱 구성음 (m7♭5는 보이싱이 이미 루트를 품어 중복이 사라진다)
  const byDegree = new Map<string, number>([['1', 0]]);
  voicing.degrees.forEach((degree, i) => {
    byDegree.set(degree, ((voicing.intervals[i] % 12) + 12) % 12);
  });
  return [...byDegree]
    .map(([degree, semitone]) => ({ degree, semitone }))
    .sort((a, b) => degreeNumber(a.degree) - degreeNumber(b.degree));
}

/** 이 코드에서 찍을 pitch class, 도수 순서대로 */
export function degreePitchClasses(rootPc: number, quality: ChordQuality): number[] {
  return degreeSteps(quality).map((s) => (((rootPc + s.semitone) % 12) + 12) % 12);
}

/**
 * 도수 드릴의 출제 단위 — 6 quality × 12루트 = 72개.
 * 보관함 루프가 Item을 받으므로 같은 모양을 쓰되 **form은 쓰지 않는다**(도수는 폼과 무관하다).
 */
export function degreeItems(): Item[] {
  const out: Item[] = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const quality of QUALITIES) out.push({ rootPc, quality, form: 'A' });
  }
  return out;
}

/**
 * 도수 순서대로의 실제 음높이. **도수가 올라가면 음도 올라간다** —
 * 화면 건반은 한 옥타브뿐이지만 9는 2도 자리를, 13은 6도 자리를 누르되
 * 소리는 루트에서 위로 쌓아 들려준다(1 3 5 7 9가 실제로 올라가게).
 */
export function degreeMidis(rootPc: number, quality: ChordQuality, base = 48): number[] {
  return stackAscending(degreePitchClasses(rootPc, quality), base);
}

/** 도수 순서대로의 음이름 (루트 기준 철자) */
export function degreeNoteNames(rootPc: number, quality: ChordQuality): NoteName[] {
  const root = ROOT_NAMES[((rootPc % 12) + 12) % 12];
  return degreeSteps(quality).map((s) => spellDegree(root, s.degree, s.semitone));
}
