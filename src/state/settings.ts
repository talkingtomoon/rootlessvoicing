import type { Form, ProgressionType } from '../engine/types';
import { allItems, contextsFor, type Item } from '../engine/items';

/**
 * 설정은 이것뿐이다 (스펙 §7). 여기에 항목을 더 넣지 마라.
 * 세션 크기는 설정이 아니라 시작 화면에 노출한다.
 */
export type Settings = {
  major: boolean;
  minor: boolean;
  A: boolean;
  B: boolean;
};

export const DEFAULT_SETTINGS: Settings = { major: true, minor: true, A: true, B: true };

const KEY = 'rootless:settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Partial<Settings>;
    const s: Settings = {
      major: p.major !== false,
      minor: p.minor !== false,
      A: p.A !== false,
      B: p.B !== false,
    };
    // 한쪽이라도 다 꺼져 있으면 기본값으로 되돌린다 (뽑을 게 없어지는 상태 방지)
    if (!s.major && !s.minor) return DEFAULT_SETTINGS;
    if (!s.A && !s.B) return DEFAULT_SETTINGS;
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function enabledTypes(s: Settings): ProgressionType[] {
  const out: ProgressionType[] = [];
  if (s.major) out.push('major');
  if (s.minor) out.push('minor');
  return out;
}

export function enabledForms(s: Settings): Form[] {
  const out: Form[] = [];
  if (s.A) out.push('A');
  if (s.B) out.push('B');
  return out;
}

/**
 * 암기 '전체'가 뽑을 수 있는 item 풀.
 * quality는 문맥으로 판정한다 — m7은 메이저 ii이자 마이너 i라 어느 한쪽만 켜도 남는다.
 */
export function enabledItems(s: Settings): Item[] {
  const types = enabledTypes(s);
  const forms = enabledForms(s);
  return allItems().filter(
    (it) =>
      forms.includes(it.form) &&
      contextsFor(it.rootPc, it.quality).some((c) => types.includes(c.type)),
  );
}
