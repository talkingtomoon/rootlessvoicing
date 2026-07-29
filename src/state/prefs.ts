import { SESSION_SIZES } from '../session/session';

const LAST_N_KEY = 'rootless:lastSessionSize';

export function loadLastSessionSize(): number {
  const v = Number(localStorage.getItem(LAST_N_KEY));
  return (SESSION_SIZES as readonly number[]).includes(v) ? v : 12;
}

export function saveLastSessionSize(n: number): void {
  localStorage.setItem(LAST_N_KEY, String(n));
}
