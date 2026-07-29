import type { Voicing } from './types';

/** 좌손 스윗스팟: 이조 후 최저음이 이 범위(MIDI)에 들어오도록 옥타브 이동 */
export const LOWEST_MIN = 48; // C3
export const LOWEST_MAX = 59; // B3

/**
 * canonical 배치. 암기 모드 채점 기준(옥타브까지 일치).
 * intervals는 오름차순이므로 intervals[0]이 최저음.
 */
export function placeVoicing(rootPc: number, voicing: Voicing): number[] {
  const lowest = rootPc + voicing.intervals[0];
  const shift = 12 * Math.ceil((LOWEST_MIN - lowest) / 12);
  return voicing.intervals.map((iv) => rootPc + iv + shift);
}
