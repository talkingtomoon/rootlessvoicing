import { describe, expect, it } from 'vitest';
import { bottomDegree, formALink, movedLabels, progressionLinks, shapeGaps, siblingLink } from '../links';
import { QUALITIES } from '../voicings';

describe('모양', () => {
  it('A형 간격', () => {
    expect(shapeGaps('m7', 'A')).toEqual([4, 3, 4]);
    expect(shapeGaps('maj7', 'A')).toEqual([3, 4, 3]);
    expect(shapeGaps('dom7', 'A')).toEqual([4, 2, 5]);
    expect(shapeGaps('m7b5', 'A')).toEqual([3, 4, 2]);
    expect(shapeGaps('dom7b9', 'A')).toEqual([3, 3, 3]);
  });
  it('B형 간격', () => {
    expect(shapeGaps('m7', 'B')).toEqual([4, 1, 4]);
    expect(shapeGaps('dom7', 'B')).toEqual([5, 1, 4]);
    expect(shapeGaps('dom7b9', 'B')).toEqual([3, 3, 3]);
  });
  it('맨 아래 도수', () => {
    expect(bottomDegree('m7', 'A')).toBe('b3');
    expect(bottomDegree('dom7', 'A')).toBe('b7');
    expect(bottomDegree('maj7', 'B')).toBe('7');
  });
});

describe('진행 연결', () => {
  it('C major A형: Dm7→G7은 C→B 한 음, G7→Cmaj7은 세 음', () => {
    const [toV] = progressionLinks(0, 'major', 'A', 0);
    expect(toV.kind).toBe('next');
    expect(movedLabels(toV.moves)).toEqual(['C→B']);
    const [fromii, toI] = progressionLinks(0, 'major', 'A', 1);
    expect(movedLabels(fromii.moves)).toEqual(['C→B']);
    expect(movedLabels(toI.moves)).toEqual(['F→E', 'A→G', 'E→D']);
  });

  it('ii→V는 12키 × 메이저/마이너 × A/B 모두 한 음만 반음 내려간다', () => {
    for (let k = 0; k < 12; k++) {
      for (const type of ['major', 'minor'] as const) {
        for (const form of ['A', 'B'] as const) {
          const [link] = progressionLinks(k, type, form, 0);
          const moved = link.moves.filter((m) => m.delta !== 0);
          expect(moved).toHaveLength(1);
          expect(moved[0].delta).toBe(-1);
        }
      }
    }
  });

  it('움직임 표시엔 E♯·B♯ 대신 건반 이름 (C♯ major A형 V→I)', () => {
    const [prev] = progressionLinks(1, 'major', 'A', 2);
    expect(movedLabels(prev.moves)).toEqual(['G♭→F', 'B♭→G♯', 'F→D♯']);
  });

  it('C minor A형: G7♭9→Cm7', () => {
    const [prev] = progressionLinks(0, 'minor', 'A', 2);
    expect(movedLabels(prev.moves)).toEqual(['F→E♭', 'A♭→G', 'B→B♭']);
  });
});

describe('형제 연결', () => {
  it('m7→m7♭5, 7→7♭9: 12루트 × A/B 모두 2·4번째 성부만 내려간다', () => {
    for (let r = 0; r < 12; r++) {
      for (const form of ['A', 'B'] as const) {
        for (const q of ['m7b5', 'dom7b9'] as const) {
          const link = siblingLink(r, q, form)!;
          const idx = link.moves.flatMap((m, i) => (m.delta !== 0 ? [i] : []));
          expect(idx).toEqual([1, 3]);
          expect(link.moves.every((m) => m.delta <= 0)).toBe(true);
        }
      }
    }
    expect(movedLabels(siblingLink(2, 'm7b5', 'A')!.moves)).toEqual(['A→A♭', 'E→D']);
  });
  it('메이저 계열은 형제가 없다', () => {
    for (const q of QUALITIES.filter((q) => q !== 'm7b5' && q !== 'dom7b9')) {
      expect(siblingLink(0, q, 'A')).toBeNull();
    }
  });
  it('B형만 A형 연결', () => {
    expect(formALink(2, 'm7', 'A')).toBeNull();
    expect(formALink(2, 'm7', 'B')!.otherSymbol).toBe('Dm7 A형');
  });
});
