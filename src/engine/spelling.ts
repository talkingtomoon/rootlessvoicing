import type { NoteName, Voicing } from './types';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * 코드 루트 관용 표기 — item당 하나 고정, 문맥(키) 무관.
 * 같은 item은 어떤 문맥으로 출제돼도 항상 같은 심볼로 보인다.
 */
export const ROOT_NAMES: NoteName[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** 키 이름도 같은 고정 표기를 쓴다 — 토닉 기준 철자 로직 없음 */
export function keyName(keyPc: number): NoteName {
  return ROOT_NAMES[((keyPc % 12) + 12) % 12];
}

export function notePc(name: NoteName): number {
  const letter = name[0];
  let pc = LETTER_PC[letter];
  for (const ch of name.slice(1)) pc += ch === '#' ? 1 : -1;
  return ((pc % 12) + 12) % 12;
}

/**
 * 도수 기반 철자: 목표 글자는 루트 글자 + (도수 - 1), 임시표는 반음 차이로 결정.
 * 예: spellInterval('Db', '3', 4) = 'F', spellInterval('G', 'b9', 13) = 'Ab'
 */
export function spellInterval(root: NoteName, degree: string, semitones: number): NoteName {
  const degreeNum = parseInt(degree.replace(/[b#]/g, ''), 10);
  const steps = (degreeNum - 1) % 7;
  const letter = LETTERS[(LETTERS.indexOf(root[0] as (typeof LETTERS)[number]) + steps) % 7];
  const targetPc = (notePc(root) + semitones) % 12;
  let acc = ((targetPc - LETTER_PC[letter]) % 12 + 12) % 12;
  if (acc > 6) acc -= 12;
  return letter + (acc >= 0 ? '#'.repeat(acc) : 'b'.repeat(-acc));
}

const FLAT_NAMES: NoteName[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP_NAMES: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 겹임시표는 표시하지 않는다 — 같은 방향의 홑임시표/제자리표로 단순화 (예: E♭m7♭5의 ♭5 = B𝄫 → A) */
function simplify(name: NoteName): NoteName {
  if (name.includes('bb')) return FLAT_NAMES[notePc(name)];
  if (name.includes('##')) return SHARP_NAMES[notePc(name)];
  return name;
}

/** 보이싱 4음의 음이름 (낮은 성부부터), 도수 기반 철자 + 겹임시표 단순화 */
export function spellVoicing(root: NoteName, voicing: Voicing): NoteName[] {
  return voicing.intervals.map((iv, i) => simplify(spellInterval(root, voicing.degrees[i], iv % 12)));
}

/** ASCII → 표시용 글리프 ('Db' → 'D♭', 'b3' → '♭3') */
export function toGlyphs(s: string): string {
  return s.replace(/b/g, '♭').replace(/#/g, '♯');
}
