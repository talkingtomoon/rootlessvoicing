/**
 * 학습일과 하루 연습 시간. localStorage만 쓴다.
 * 학습일은 새벽 4시에 넘어간다 — 자정 넘겨 연습해도 "어제"로 친다.
 */

export const DAY_ROLLOVER_HOUR = 4;
/** 하루 목표 (초) */
export const DAILY_GOAL_SEC = 15 * 60;

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' (로컬 시각, 새벽 4시 기준) */
export function studyDay(now: Date = new Date()): string {
  const d = new Date(now.getTime() - DAY_ROLLOVER_HOUR * 3600_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 학습일 문자열 → 그 날 정오의 Date (요일·날짜 표시용) */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** day에서 n일 이동한 학습일 */
export function addDays(day: string, n: number): string {
  const d = dayToDate(day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** day가 속한 주의 월~일 7일 */
export function weekOf(day: string): string[] {
  const dow = (dayToDate(day).getDay() + 6) % 7; // 월=0
  return Array.from({ length: 7 }, (_, i) => addDays(day, i - dow));
}

export type TimeLog = Record<string, number>;

const KEY = 'rootless:timeLog';
/** 오래된 날은 지운다 — 주간 표시에 필요한 만큼만 */
const KEEP_DAYS = 60;

export function loadTimeLog(): TimeLog {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as TimeLog) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function addSeconds(log: TimeLog, day: string, sec: number): TimeLog {
  const next: TimeLog = { ...log, [day]: (log[day] ?? 0) + sec };
  const cutoff = addDays(day, -KEEP_DAYS);
  for (const k of Object.keys(next)) if (k < cutoff) delete next[k];
  return next;
}

export function saveTimeLog(log: TimeLog): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // 저장 실패는 조용히 넘긴다 — 시간 기록은 진도가 아니다
  }
}

/** 오늘 들인 유닛 수 — 앱을 닫았다 열어도 하루 상한(MAX_UNITS_PER_DAY)이 유지되게 */
const UNITS_KEY = 'rootless:unitsToday';

export function loadUnitsToday(day: string): number {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    const p = raw ? (JSON.parse(raw) as { day: string; n: number }) : null;
    return p && p.day === day && typeof p.n === 'number' ? p.n : 0;
  } catch {
    return 0;
  }
}

export function saveUnitsToday(day: string, n: number): void {
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify({ day, n }));
  } catch {
    // 무시
  }
}
