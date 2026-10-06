import { describe, expect, it } from 'vitest';
import { degreeMidis, degreeNoteNames, degreePitchClasses, degreeSteps } from '../degrees';
import { QUALITIES, getVoicing } from '../voicings';
import { buildChord } from '../chord';
import { toGlyphs } from '../spelling';

const labels = (q: Parameters<typeof degreeSteps>[0]) => degreeSteps(q).map((s) => toGlyphs(s.degree)).join(' ');

describe('도수 드릴 — 찍을 음 (스펙 §4)', () => {
  it('quality별 도수와 순서', () => {
    expect(labels('maj7')).toBe('1 3 5 7 9');
    expect(labels('dom7')).toBe('1 3 ♭7 9 13');
    expect(labels('m7')).toBe('1 ♭3 5 ♭7 9');
    expect(labels('m7b5')).toBe('1 ♭3 ♭5 ♭7');
    expect(labels('dom7b9b13')).toBe('1 3 ♭7 ♭9 ♭13');
    expect(labels('m6')).toBe('1 ♭3 5 6 9');
  });

  it('칸 수는 quality마다 다르다 — 균일하게 만들지 마라', () => {
    expect(degreeSteps('m7b5')).toHaveLength(4); // 보이싱이 루트를 품는다
    for (const q of QUALITIES.filter((q) => q !== 'm7b5')) {
      expect(degreeSteps(q), q).toHaveLength(5);
    }
    // 두 도미넌트에는 5음이 없다
    expect(labels('dom7')).not.toContain('5');
    expect(degreeSteps('dom7b9b13').some((s) => s.degree === '5')).toBe(false);
  });

  it('루트를 빼면 그 코드의 보이싱 구성음 그대로다', () => {
    for (const q of QUALITIES) {
      const drill = new Set(degreeSteps(q).map((s) => s.semitone));
      const voicing = new Set(getVoicing(q, 'A').intervals.map((iv) => iv % 12));
      drill.delete(0); // 루트
      voicing.delete(0); // m7♭5의 루트
      expect([...drill].sort(), q).toEqual([...voicing].sort());
    }
  });

  it('한 옥타브 안 — 9는 2도 자리, 13은 6도 자리', () => {
    const dom7 = degreeSteps('dom7');
    expect(dom7.find((s) => s.degree === '9')!.semitone).toBe(2);
    expect(dom7.find((s) => s.degree === '13')!.semitone).toBe(9);
    for (const q of QUALITIES) {
      for (const s of degreeSteps(q)) {
        expect(s.semitone, `${q} ${s.degree}`).toBeGreaterThanOrEqual(0);
        expect(s.semitone, `${q} ${s.degree}`).toBeLessThan(12);
      }
    }
  });

  it('pitch class는 루트에서 이조된다', () => {
    expect(degreePitchClasses(0, 'maj7')).toEqual([0, 4, 7, 11, 2]); // C E G B D
    expect(degreePitchClasses(7, 'dom7')).toEqual([7, 11, 5, 9, 4]); // G B F A E
    expect(degreePitchClasses(2, 'm7b5')).toEqual([2, 5, 8, 0]); // D F Ab C
  });

  it('음이름은 루트 기준 철자 — 보이싱 표기와 같은 글자', () => {
    expect(degreeNoteNames(0, 'm6').map(toGlyphs)).toEqual(['C', 'E♭', 'G', 'A', 'D']);
    expect(degreeNoteNames(7, 'dom7b9b13').map(toGlyphs)).toEqual(['G', 'B', 'F', 'A♭', 'E♭']);
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (const q of QUALITIES) {
        const drill = degreeNoteNames(rootPc, q);
        const voiced = buildChord(rootPc, q, 'A').noteNames;
        // 보이싱에 있는 음은 드릴에도 같은 철자로 있다
        for (const name of voiced) expect(drill, `${rootPc} ${q}`).toContain(name);
      }
    }
  });

  it('도수가 올라가면 음높이도 올라간다 (화면은 한 옥타브여도)', () => {
    // C maj7: 1 3 5 7 9 → C3 E3 G3 B3 D4
    expect(degreeMidis(0, 'maj7')).toEqual([48, 52, 55, 59, 62]);
    // G7: 1 3 ♭7 9 13 → G3 B3 F4 A4 E5
    expect(degreeMidis(7, 'dom7')).toEqual([55, 59, 65, 69, 76]);
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (const q of QUALITIES) {
        const m = degreeMidis(rootPc, q);
        for (let i = 1; i < m.length; i++) expect(m[i], `${rootPc} ${q}`).toBeGreaterThan(m[i - 1]);
        // pitch class는 찍을 자리 그대로
        expect(m.map((x) => x % 12)).toEqual(degreePitchClasses(rootPc, q));
      }
    }
  });

  it('항목은 6 quality × 12루트 = 72개', () => {
    const ids = new Set<string>();
    for (let rootPc = 0; rootPc < 12; rootPc++) for (const q of QUALITIES) ids.add(`${rootPc}:${q}`);
    expect(ids.size).toBe(72);
  });
});
