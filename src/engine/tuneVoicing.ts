import type { Form } from './types';
import type { Tune, TuneChord } from './tunes';
import { tuneChords } from './tunes';
import { getVoicing } from './voicings';
import { HAND_MAX, HAND_MIN, placeVoicing, TOP_MAX, TOP_MIN } from './placement';
import { spellVoicing } from './spelling';
import { ROOT_NAMES } from './spelling';

/**
 * 곡 한 곡의 보이싱을 고른다 — **폼(A/B)과 옥타브를 보이스리딩으로 정한다.**
 *
 * 후보는 각 코드의 A형·B형 × 옥타브(canonical ±1). 손 범위(HAND_MIN..HAND_MAX) 밖은 버린다.
 * 직전 코드와 성부별 이동량 합이 가장 작은 후보를 고르고, 같으면 **폼을 유지하는 쪽**을 고른다
 * (ii–V 안에서 폼이 흔들리면 손 모양이 깨진다).
 *
 * 첫 코드는 엄지가 G4(67) 근처인 후보로 시작한다 — 너무 낮지도 높지도 않은 자리.
 */
export type VoicedChord = {
  chord: TuneChord;
  form: Form;
  /** 낮은 성부부터 */
  midi: number[];
  /** midi와 같은 순서의 음이름 */
  noteNames: string[];
  /** 직전 코드에서 움직인 성부 수 (첫 코드는 0) */
  moved: number;
};

const FORMS: Form[] = ['A', 'B'];
const START_TOP = 67; // G4

function candidates(chord: TuneChord): { form: Form; midi: number[] }[] {
  const out: { form: Form; midi: number[] }[] = [];
  for (const form of FORMS) {
    const base = placeVoicing(chord.rootPc, getVoicing(chord.quality, form));
    for (const shift of [-12, 0, 12]) {
      const midi = base.map((n) => n + shift);
      const top = midi[midi.length - 1];
      // 엄지는 C4–C5, 전체는 손 범위 안 — canonical 규칙을 곡에서도 지킨다
      if (top < TOP_MIN || top > TOP_MAX) continue;
      if (midi[0] < HAND_MIN || top > HAND_MAX) continue;
      out.push({ form, midi });
    }
  }
  return out;
}

const distance = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0);

export function voiceTune(tune: Tune): VoicedChord[] {
  const out: VoicedChord[] = [];
  let prev: { form: Form; midi: number[] } | null = null;

  for (const chord of tuneChords(tune)) {
    const options = candidates(chord);
    const best = options.reduce((bestSoFar, cand) => {
      if (!prev) {
        // 첫 코드: 엄지가 G4에 가장 가까운 자리
        const score = Math.abs(cand.midi[cand.midi.length - 1] - START_TOP);
        const bestScore = Math.abs(bestSoFar.midi[bestSoFar.midi.length - 1] - START_TOP);
        return score < bestScore ? cand : bestSoFar;
      }
      const cost = distance(cand.midi, prev.midi);
      const bestCost = distance(bestSoFar.midi, prev.midi);
      if (cost !== bestCost) return cost < bestCost ? cand : bestSoFar;
      // 같으면 폼을 유지하는 쪽
      if (cand.form === prev.form && bestSoFar.form !== prev.form) return cand;
      return bestSoFar;
    }, options[0]);

    out.push({
      chord,
      form: best.form,
      midi: best.midi,
      noteNames: spellVoicing(ROOT_NAMES[chord.rootPc], getVoicing(chord.quality, best.form)),
      moved: prev ? best.midi.filter((n, i) => n !== prev!.midi[i]).length : 0,
    });
    prev = best;
  }

  return out;
}

/** 한 박의 길이(초) */
export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}
