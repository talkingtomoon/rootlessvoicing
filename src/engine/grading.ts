/**
 * 옥타브 관대 채점: 시도한 4음이 정답 보이싱의 온옥타브 이동형이고
 * 전체가 MIDI 41–72 (F2–C5) 안에 들어오면 정답.
 * 정답 "표시"는 항상 canonical 하나 (placeVoicing).
 */
export const GRADE_MIN = 41; // F2
export const GRADE_MAX = 72; // C5

export function gradeAttempt(attempt: number[], canonicalMidi: number[]): boolean {
  if (attempt.length !== canonicalMidi.length) return false;
  const sorted = [...attempt].sort((a, b) => a - b);
  if (new Set(sorted).size !== sorted.length) return false;
  const shift = sorted[0] - canonicalMidi[0];
  if (shift % 12 !== 0) return false;
  if (!sorted.every((n, i) => n === canonicalMidi[i] + shift)) return false;
  return sorted[0] >= GRADE_MIN && sorted[sorted.length - 1] <= GRADE_MAX;
}

/**
 * 폰용 순서 입력: 한 옥타브 건반에서 **아래 성부부터 차례로** 누른 pitch class를
 * 직전 음보다 위로 쌓는다 → 옥타브 경계를 넘는 보이싱도 페이징 없이 입력된다.
 */
export function stackAscending(pcs: number[], base = 48): number[] {
  const out: number[] = [];
  for (const pc of pcs) {
    const p = ((pc % 12) + 12) % 12;
    if (out.length === 0) {
      out.push(base + p);
      continue;
    }
    const prev = out[out.length - 1];
    out.push(prev + ((((p - prev) % 12) + 12) % 12 || 12));
  }
  return out;
}

/** 순서 입력 채점. 순서가 폼(A/B)을 가르므로 네 음이 맞아도 순서가 틀리면 오답이다. */
export function gradeSequence(pcs: number[], canonicalMidi: number[]): boolean {
  if (pcs.length !== canonicalMidi.length) return false;
  const stacked = stackAscending(pcs);
  const shift = stacked[0] - canonicalMidi[0];
  if (shift % 12 !== 0) return false;
  return stacked.every((m, i) => m - shift === canonicalMidi[i]);
}
