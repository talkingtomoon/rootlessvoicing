import type { ChordQuality, Form } from '../engine/types';
import type { KeyOrder } from '../engine/items';
import { SESSION_SIZES } from '../session/session';
import { QUALITIES } from '../engine/voicings';

const LAST_N_KEY = 'rootless:lastSessionSize';
const LAST_QUALITY_KEY = 'rootless:lastQuality';
const LAST_FORM_KEY = 'rootless:lastForm';
const LAST_ORDER_KEY = 'rootless:lastOrder';
const LAST_EXPLORE_MODE_KEY = 'rootless:lastExploreMode';
const LAST_MEMORIZE_MODE_KEY = 'rootless:lastMemorizeMode';

export function loadLastSessionSize(): number {
  const v = Number(localStorage.getItem(LAST_N_KEY));
  return (SESSION_SIZES as readonly number[]).includes(v) ? v : 12;
}

export function saveLastSessionSize(n: number): void {
  localStorage.setItem(LAST_N_KEY, String(n));
}

export function loadLastQuality(): ChordQuality {
  const v = localStorage.getItem(LAST_QUALITY_KEY) as ChordQuality | null;
  return v && QUALITIES.includes(v) ? v : 'm7';
}

export function saveLastQuality(q: ChordQuality): void {
  localStorage.setItem(LAST_QUALITY_KEY, q);
}

export function loadLastForm(): Form {
  return localStorage.getItem(LAST_FORM_KEY) === 'B' ? 'B' : 'A';
}

export function saveLastForm(f: Form): void {
  localStorage.setItem(LAST_FORM_KEY, f);
}

/** 타입별 듣기의 12루트 나열 순서 */
export function loadLastOrder(): 'fourths' | 'chromatic' {
  return localStorage.getItem(LAST_ORDER_KEY) === 'chromatic' ? 'chromatic' : 'fourths';
}

export function saveLastOrder(o: 'fourths' | 'chromatic'): void {
  localStorage.setItem(LAST_ORDER_KEY, o);
}

export type MemorizeMode = 'all' | 'type' | 'degree';

export function loadLastMemorizeMode(): MemorizeMode {
  const v = localStorage.getItem(LAST_MEMORIZE_MODE_KEY);
  return v === 'type' || v === 'degree' ? v : 'all';
}

export function saveLastMemorizeMode(m: MemorizeMode): void {
  localStorage.setItem(LAST_MEMORIZE_MODE_KEY, m);
}

export function loadLastExploreMode(): 'progression' | 'type' {
  return localStorage.getItem(LAST_EXPLORE_MODE_KEY) === 'type' ? 'type' : 'progression';
}

export function saveLastExploreMode(m: 'progression' | 'type'): void {
  localStorage.setItem(LAST_EXPLORE_MODE_KEY, m);
}

const KEY_ORDER_KEY = 'rootless:keyOrder';
const DEGREE_LABELS_KEY = 'rootless:degreeLabels';

/** 세션의 키 순서 — 4도 순환이 기본 */
export function loadKeyOrder(): KeyOrder {
  return localStorage.getItem(KEY_ORDER_KEY) === 'random' ? 'random' : 'fourths';
}

export function saveKeyOrder(o: KeyOrder): void {
  localStorage.setItem(KEY_ORDER_KEY, o);
}

/** 보이싱 문제 화면에 도수를 같이 보여줄까 — 기본 켜짐 (도수 드릴에서 넘어오는 다리) */
export function loadDegreeLabels(): boolean {
  return localStorage.getItem(DEGREE_LABELS_KEY) !== 'off';
}

export function saveDegreeLabels(on: boolean): void {
  localStorage.setItem(DEGREE_LABELS_KEY, on ? 'on' : 'off');
}

const INPUT_MODE_KEY = 'rootless:inputMode';

/** 오늘 연습의 입력 방식 — tap: 화면 건반에 순서대로, piano: 실제 피아노로 치고 자가채점 */
export type InputMode = 'tap' | 'piano';

export function loadInputMode(): InputMode {
  return localStorage.getItem(INPUT_MODE_KEY) === 'piano' ? 'piano' : 'tap';
}

export function saveInputMode(m: InputMode): void {
  localStorage.setItem(INPUT_MODE_KEY, m);
}
