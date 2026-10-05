import type { Voicing } from './types';

/**
 * 좌손 스윗스팟: **최고음(엄지)이 C4–C5**에 들어오도록 옥타브 이동한다.
 * 교재의 rule of thumb — 엄지가 가온다와 그 위 C 사이에 있으면 너무 탁하지도 얇지도 않다.
 * 엄지가 멜로디에 가장 가까운 성부라 기준점으로도 자연스럽다.
 * (옛 기준은 최저음 48–59였다. 바꾼 것이니 되돌리지 마라.)
 */
export const TOP_MIN = 60; // C4
export const TOP_MAX = 72; // C5

/**
 * canonical 배치. 암기 모드 채점 기준(옥타브까지 일치).
 * intervals는 오름차순이므로 마지막이 최고음.
 */
export function placeVoicing(rootPc: number, voicing: Voicing): number[] {
  const top = rootPc + voicing.intervals[voicing.intervals.length - 1];
  const shift = 12 * Math.ceil((TOP_MIN - top) / 12);
  return voicing.intervals.map((iv) => rootPc + iv + shift);
}
