import { describe, expect, it } from 'vitest';
import {
  degreeMidis,
  degreeNoteNames,
  degreePitchClasses,
  degreeSemitone,
  degreeSteps,
} from '../degrees';
import { QUALITIES, getVoicing } from '../voicings';
import { toGlyphs } from '../spelling';

const labels = (q: Parameters<typeof degreeSteps>[0]) =>
  degreeSteps(q)
    .map((s) => toGlyphs(s.degree))
    .join(' ');

describe('도수 드릴 — 찍을 음 (확정 스펙 §2)', () => {
  it('quality별 도수와 순서', () => {
    expect(labels('m7')).toBe('1 ♭3 5 ♭7 9');
    expect(labels('dom7')).toBe('1 3 5 ♭7 9 13');
    expect(labels('maj7')).toBe('1 3 5 7 9');
    expect(labels('m7b5')).toBe('1 ♭3 ♭5 ♭7');
    expect(labels('dom7b9b13')).toBe('1 3 5 ♭7 ♭9 ♭13');
    expect(labels('m6')).toBe('1 ♭3 5 6 9');
  });

  it('개수는 quality마다 다르다 — 보이싱이 불균등한 것이지 빠뜨린 게 아니다', () => {
    const counts = Object.fromEntries(QUALITIES.map((q) => [q, degreeSteps(q).length]));
    expect(counts).toEqual({ m7: 5, dom7: 6, maj7: 5, m7b5: 4, dom7b9b13: 6, m6: 5 });
  });

  it('두 도미넌트의 5는 드릴에 있지만 보이싱에는 없다 — 손으로 안 치는 음 표시', () => {
    for (const q of ['dom7', 'dom7b9b13'] as const) {
      const five = degreeSteps(q).find((s) => s.degree === '5')!;
      expect(five.chordTone, q).toBe(true);
      expect(five.inVoicing, q).toBe(false);
    }
    // 루트를 빼면 안 치는 음은 그 둘뿐이다
    const unplayed = QUALITIES.flatMap((q) =>
      degreeSteps(q)
        .filter((s) => !s.inVoicing && s.degree !== '1')
        .map((s) => `${q}:${s.degree}`),
    );
    expect(unplayed).toEqual(['dom7:5', 'dom7b9b13:5']);
  });

  it('m7♭5는 4음 — 맨 위에 루트를 또 넣지 않는다', () => {
    const steps = degreeSteps('m7b5');
    expect(steps.map((s) => s.degree)).toEqual(['1', 'b3', 'b5', 'b7']);
    expect(steps.filter((s) => s.degree === '1')).toHaveLength(1);
  });

  it('코드톤과 텐션이 갈린다 (m6의 6은 코드톤)', () => {
    const tension = (q: Parameters<typeof degreeSteps>[0]) =>
      degreeSteps(q)
        .filter((s) => !s.chordTone)
        .map((s) => s.degree);
    expect(tension('m7')).toEqual(['9']);
    expect(tension('dom7')).toEqual(['9', '13']);
    expect(tension('maj7')).toEqual(['9']);
    expect(tension('m7b5')).toEqual([]);
    expect(tension('dom7b9b13')).toEqual(['b9', 'b13']);
    expect(tension('m6')).toEqual(['9']);
    expect(degreeSteps('m6').find((s) => s.degree === '6')!.chordTone).toBe(true);
  });

  it('13·♭13 라벨을 6·♭6으로 바꾸지 않는다 (같은 건반, 다른 이름)', () => {
    expect(degreeSteps('dom7').map((s) => s.degree)).toContain('13');
    expect(degreeSteps('dom7b9b13').map((s) => s.degree)).toContain('b13');
    expect(degreeSemitone('13')).toBe(9);
    expect(degreeSemitone('6')).toBe(9);
    expect(degreeSemitone('b13')).toBe(8);
    expect(degreeSemitone('b9')).toBe(1);
  });

  it('코드톤 + 보이싱이 쓰는 텐션 = 드릴 (보이싱 음은 하나도 빠지지 않는다)', () => {
    for (const q of QUALITIES) {
      const drill = new Set(degreeSteps(q).map((s) => s.degree));
      for (const d of getVoicing(q, 'A').degrees) expect(drill, `${q}: ${d}`).toContain(d);
    }
  });

  it('한 옥타브 안 — 9는 2도 자리, 13은 6도 자리, ♭13은 ♭6도 자리', () => {
    const dom7 = degreeSteps('dom7');
    expect(dom7.find((s) => s.degree === '9')!.semitone).toBe(2);
    expect(dom7.find((s) => s.degree === '13')!.semitone).toBe(9);
    expect(degreeSteps('dom7b9b13').find((s) => s.degree === 'b13')!.semitone).toBe(8);
    for (const q of QUALITIES) {
      for (const s of degreeSteps(q)) {
        expect(s.semitone, `${q} ${s.degree}`).toBeGreaterThanOrEqual(0);
        expect(s.semitone, `${q} ${s.degree}`).toBeLessThan(12);
      }
    }
  });

  it('C 기준 손검산 (스펙 §4)', () => {
    const names = (q: Parameters<typeof degreeSteps>[0]) => degreeNoteNames(0, q).map(toGlyphs).join(' ');
    expect(names('dom7')).toBe('C E G B♭ D A');
    expect(names('dom7b9b13')).toBe('C E G B♭ D♭ A♭');
    expect(names('m7b5')).toBe('C E♭ G♭ B♭');
    expect(names('m6')).toBe('C E♭ G A D');
    expect(names('maj7')).toBe('C E G B D');
    expect(names('m7')).toBe('C E♭ G B♭ D');
  });

  it('72개 전부: 음높이가 단조 증가하고 pitch class는 누르는 자리와 같다', () => {
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (const q of QUALITIES) {
        const m = degreeMidis(rootPc, q);
        expect(m, `${rootPc} ${q}`).toHaveLength(degreeSteps(q).length);
        for (let i = 1; i < m.length; i++) expect(m[i], `${rootPc} ${q}`).toBeGreaterThan(m[i - 1]);
        expect(m.map((x) => x % 12)).toEqual(degreePitchClasses(rootPc, q));
      }
    }
    expect(degreeMidis(0, 'maj7')).toEqual([48, 52, 55, 59, 62]); // C3 E3 G3 B3 D4
    expect(degreeMidis(0, 'dom7')).toEqual([48, 52, 55, 58, 62, 69]); // C3 E3 G3 B♭3 D4 A4
  });

  it('항목은 6 quality × 12루트 = 72개', () => {
    const ids = new Set<string>();
    for (let rootPc = 0; rootPc < 12; rootPc++) for (const q of QUALITIES) ids.add(`${rootPc}:${q}`);
    expect(ids.size).toBe(72);
  });
});
