import { describe, expect, it } from 'vitest';
import { gradeSequence, stackAscending } from '../grading';
import { buildChord } from '../chord';
import { allItems } from '../items';

describe('순서 입력 채점', () => {
  it('직전 음보다 위로 쌓는다', () => {
    expect(stackAscending([5, 9, 11, 4])).toEqual([53, 57, 59, 64]); // F A B E
  });

  it('120개 전부: 아래 성부부터 누르면 정답', () => {
    for (const it of allItems()) {
      const c = buildChord(it.rootPc, it.quality, it.form);
      expect(gradeSequence(c.midi.map((m) => m % 12), c.midi)).toBe(true);
    }
  });

  it('같은 네 음이라도 순서가 다르면(A형 vs B형) 오답', () => {
    const a = buildChord(2, 'm7', 'A'); // F A C E
    const b = buildChord(2, 'm7', 'B'); // C E F A
    expect(gradeSequence(a.midi.map((m) => m % 12), b.midi)).toBe(false);
    expect(gradeSequence(b.midi.map((m) => m % 12), a.midi)).toBe(false);
  });

  it('음 하나 틀리거나 모자라면 오답', () => {
    const g7 = buildChord(7, 'dom7', 'A');
    expect(gradeSequence([5, 9, 0, 4], g7.midi)).toBe(false);
    expect(gradeSequence([5, 9, 11], g7.midi)).toBe(false);
  });
});
