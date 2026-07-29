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
