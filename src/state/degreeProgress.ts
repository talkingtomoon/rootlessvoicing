import type { Item } from '../engine/items';
import { degreeItems } from '../engine/degrees';
import { emptyProgress, type ProgressStore } from './progress';

/**
 * 도수 드릴의 진도. **보이싱 진도(`rootless:progress`)와 따로 저장한다.**
 *
 * - 형식과 규칙(Leitner 단계·학습일 세션)은 보이싱과 같아서 `progress.ts`의 함수를 그대로 쓴다
 * - 저장소를 나눈 이유: 진도 링크 포맷이 보이싱 144 item으로 고정돼 있다.
 *   도수 72개를 같은 통에 넣으면 옛 링크가 깨진다
 * - item은 `(rootPc, quality)`뿐이라 form은 'A'로 고정해 식별자만 빌려 쓴다 (도수는 폼과 무관)
 *
 * 그래서 도수 진도는 **기기에만 남고 링크로 옮겨지지 않는다.** 보이싱 앞 층이라 그래도 된다.
 */

const KEY = 'rootless:degreeProgress';

export function loadDegreeProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as ProgressStore;
    if (typeof parsed?.session !== 'number' || typeof parsed?.items !== 'object') return emptyProgress();
    return parsed;
  } catch {
    return emptyProgress();
  }
}

export function saveDegreeProgress(store: ProgressStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 저장 실패는 조용히 넘긴다
  }
}

/** 도수 드릴 전체 풀 — 6 quality × 12루트 = 72 */
export function degreePool(): Item[] {
  return degreeItems();
}
