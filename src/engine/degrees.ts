import type { ChordQuality, NoteName } from './types';
import type { Item } from './items';
import { QUALITIES, getVoicing } from './voicings';
import { ROOT_NAMES, spellDegree } from './spelling';
import { stackAscending } from './grading';

/**
 * 도수 드릴 — 코드 심볼을 보고 그 코드의 음을 **루트부터 차례로** 찍는 층. 보이싱보다 먼저 거친다.
 *
 * 묻는 것은 "무슨 도수인가"가 아니라 **"그 도수가 근음 기준으로 어디인가"**다.
 * 그래서 도수는 화면에 미리 적어둔다. **가리는 모드를 넣지 마라** — 가리면 다른 문제가 된다.
 *
 * ## 생성 규칙: 코드톤 전부 + 그 보이싱이 쓰는 텐션
 *
 * | Quality | 드릴 | 개수 |
 * |---|---|---|
 * | m7 | 1 ♭3 5 ♭7 9 | 5 |
 * | dom7 | 1 3 5 ♭7 9 13 | 6 |
 * | maj7 | 1 3 5 7 9 | 5 |
 * | m7♭5 | 1 ♭3 ♭5 ♭7 | 4 |
 * | 7♭9♭13 | 1 3 5 ♭7 ♭9 ♭13 | 6 |
 * | m6 | 1 ♭3 5 6 9 | 5 |
 *
 * **개수가 quality마다 다른 것은 보이싱이 원래 불균등하기 때문이지 빠뜨린 게 아니다. 균등하게 맞추지 마라.**
 *
 * **두 도미넌트의 5는 보이싱에 안 쓰이지만 드릴에는 넣는다.** 빼면 `1 3 ♭7 9 13`만 반복하다가
 * 도미넌트 코드 자체를 1-3-♭7로 잘못 기억한다. 코드 정체성(1 3 5 ♭7)이 드릴 안에 늘 있어야 한다.
 * 13이 ♭7보다 위 자리라 5를 끼워도 맨 위 음은 그대로고, 비용은 클릭 한 번뿐이다.
 * 대신 "손으로는 안 치는 음"이라는 표시를 붙인다(`inVoicing`).
 *
 * **라벨은 `13`·`♭13`이다. `6`·`♭6`으로 바꾸지 마라** — 코드톤으로 오인된다.
 * m6의 `6`은 진짜 코드톤이라 `6`이 맞다. 같은 건반이지만 이름이 다른 것이 맞다.
 */
export type DegreeStep = {
  /** ASCII 도수 라벨: '1', 'b3', '13' … */
  degree: string;
  /** 루트에서 반음 (0..11) */
  semitone: number;
  /** 코드톤인가 (1·3·5·7 자리, m6의 6 포함). 아니면 텐션 — 화면에서 연하게 */
  chordTone: boolean;
  /** 이 보이싱이 실제로 손으로 치는 음인가. **두 도미넌트의 5만 false** (루트는 제외하고 본다) */
  inVoicing: boolean;
};

/** 코드톤 — 보이싱이 생략하는 음이 있어서 보이싱에서 파생할 수 없다. 여기가 소스다. */
const CHORD_TONES: Record<ChordQuality, string[]> = {
  m7: ['1', 'b3', '5', 'b7'],
  dom7: ['1', '3', '5', 'b7'],
  maj7: ['1', '3', '5', '7'],
  m7b5: ['1', 'b3', 'b5', 'b7'],
  dom7b9b13: ['1', '3', '5', 'b7'],
  m6: ['1', 'b3', '5', '6'],
};

const MAJOR_SCALE: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };

const degreeNumber = (degree: string) => parseInt(degree.replace(/[b#]/g, ''), 10);

/** 도수 라벨 → 루트에서 반음 (한 옥타브 안으로 접는다). '13' → 9, 'b9' → 1 */
export function degreeSemitone(degree: string): number {
  const num = degreeNumber(degree);
  const base = MAJOR_SCALE[((num - 1) % 7) + 1];
  const flats = (degree.match(/b/g) ?? []).length;
  const sharps = (degree.match(/#/g) ?? []).length;
  return (((base - flats + sharps) % 12) + 12) % 12;
}

export function degreeSteps(quality: ChordQuality): DegreeStep[] {
  const voicing = getVoicing(quality, 'A');
  const tones = CHORD_TONES[quality];
  const inVoicing = new Set(voicing.degrees);
  // 코드톤 + 보이싱이 쓰는 텐션 (코드톤에 이미 있는 건 빼고)
  const labels = [...tones, ...voicing.degrees.filter((d) => !tones.includes(d))];
  return labels
    .map((degree) => ({
      degree,
      semitone: degreeSemitone(degree),
      chordTone: tones.includes(degree),
      inVoicing: inVoicing.has(degree),
    }))
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
 * 화면 건반은 한 옥타브뿐이라 9는 2도 자리, ♭13은 ♭6도 자리를 누르지만
 * 소리는 루트에서 위로 쌓아 들려준다. 누르는 자리와 들리는 높이가 다른 것이 정상이다.
 */
export function degreeMidis(rootPc: number, quality: ChordQuality, base = 48): number[] {
  return stackAscending(degreePitchClasses(rootPc, quality), base);
}

/** 도수 순서대로의 음이름 (루트 기준 철자) */
export function degreeNoteNames(rootPc: number, quality: ChordQuality): NoteName[] {
  const root = ROOT_NAMES[((rootPc % 12) + 12) % 12];
  return degreeSteps(quality).map((s) => spellDegree(root, s.degree, s.semitone));
}
