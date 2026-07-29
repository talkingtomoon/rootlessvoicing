import type { NoteName, ProgressionType, Voicing } from './types';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 진행의 키 이름 (관용적 재즈 표기). 인덱스 = pitch class */
export const MAJOR_KEYS: NoteName[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_KEYS: NoteName[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

export function keyName(keyPc: number, type: ProgressionType): NoteName {
  return (type === 'major' ? MAJOR_KEYS : MINOR_KEYS)[((keyPc % 12) + 12) % 12];
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

/** 보이싱 4음의 음이름 (낮은 성부부터) */
export function spellVoicing(root: NoteName, voicing: Voicing): NoteName[] {
  return voicing.intervals.map((iv, i) => spellInterval(root, voicing.degrees[i], iv % 12));
}

/** ASCII → 표시용 글리프 ('Db' → 'D♭', 'b3' → '♭3') */
export function toGlyphs(s: string): string {
  return s.replace(/b/g, '♭').replace(/#/g, '♯');
}
