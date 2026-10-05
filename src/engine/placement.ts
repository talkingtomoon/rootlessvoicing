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
 * 왼손이 쓰는 전체 범위. **화면 건반의 클릭 범위 · 채점 허용 범위 · 모든 배치가 이 안에 있다.**
 * 아래로는 canonical에서 한 옥타브까지(49-12=37), 위로는 엄지 상한인 C5까지.
 * canonical 최고음은 71이라 **정답이 72를 쓰는 일은 없다** — 72는 진행 보정(placeProgression)이
 * 보이스리딩을 지키느라 쓰는 자리다. 그 자리를 못 그리면 탐색 모드에서 음이 사라진다.
 * 셋 중 하나만 바꾸면 안 된다 — 여기를 바꾸고 전부 따라가게 하라.
 */
export const HAND_MIN = 36; // C2
export const HAND_MAX = 72; // C5

/** canonical이 실제로 차지하는 구간 (엔진 테스트가 고정한다) — 건반에 옅게 표시한다 */
export const CANONICAL_MIN = 49; // C#3
export const CANONICAL_MAX = 71; // B4

/**
 * canonical 배치. 암기 모드 채점 기준(옥타브까지 일치).
 * intervals는 오름차순이므로 마지막이 최고음.
 */
export function placeVoicing(rootPc: number, voicing: Voicing): number[] {
  const top = rootPc + voicing.intervals[voicing.intervals.length - 1];
  const shift = 12 * Math.ceil((TOP_MIN - top) / 12);
  return voicing.intervals.map((iv) => rootPc + iv + shift);
}
