import type { ChordQuality, Form } from '../engine/types';
import { SESSION_SIZES } from '../session/session';
import { QUALITIES } from '../engine/voicings';

const LAST_N_KEY = 'rootless:lastSessionSize';
const LAST_QUALITY_KEY = 'rootless:lastQuality';
const LAST_FORM_KEY = 'rootless:lastForm';

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
