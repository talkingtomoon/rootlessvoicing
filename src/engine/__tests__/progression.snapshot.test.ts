import { describe, expect, it } from 'vitest';
import { placeProgression } from '../progressions';
import type { Form, ProgressionType } from '../types';
import { PROGRESSION_SNAPSHOT } from './progression.snapshot';

describe('placeProgression 스냅샷 (12키 × major/minor × A/B)', () => {
  it('스냅샷 항목이 48개', () => {
    expect(Object.keys(PROGRESSION_SNAPSHOT)).toHaveLength(48);
  });

  it('전 진행이 동결된 MIDI 배열과 정확히 일치', () => {
    for (const type of ['major', 'minor'] as ProgressionType[]) {
      for (const form of ['A', 'B'] as Form[]) {
        for (let keyPc = 0; keyPc < 12; keyPc++) {
          const key = `${type}:${form}:${keyPc}`;
          expect(placeProgression(keyPc, type, form), key).toEqual(PROGRESSION_SNAPSHOT[key]);
        }
      }
    }
  });

  // 손검산 앵커 — 스냅샷 재생성 시에도 이 값은 변하면 안 된다
  it('손검산 앵커: C major A/B, C minor A/B', () => {
    expect(PROGRESSION_SNAPSHOT['major:A:0']).toEqual([
      [53, 57, 60, 64], // Dm7  = F3 A3 C4 E4
      [53, 57, 59, 64], // G7   = F3 A3 B3 E4
      [52, 55, 59, 62], // Cmaj7 = E3 G3 B3 D4
    ]);
    expect(PROGRESSION_SNAPSHOT['major:B:0']).toEqual([
      [60, 64, 65, 69], // Dm7  = C4 E4 F4 A4
      [59, 64, 65, 69], // G7   = B3 E4 F4 A4
      [59, 62, 64, 67], // Cmaj7 = B3 D4 E4 G4
    ]);
    expect(PROGRESSION_SNAPSHOT['minor:A:0']).toEqual([
      [53, 56, 60, 62], // Dm7b5   = F3 Ab3 C4 D4
      [53, 56, 59, 63], // G7b9b13 = F3 Ab3 B3 Eb4
      [51, 55, 57, 62], // Cm6     = Eb3 G3 A3 D4
    ]);
    expect(PROGRESSION_SNAPSHOT['minor:B:0']).toEqual([
      [60, 62, 65, 68], // Dm7b5   = C4 D4 F4 Ab4
      [59, 63, 65, 68], // G7b9b13 = B3 Eb4 F4 Ab4
      [57, 62, 63, 67], // Cm6     = A3 D4 Eb4 G4
    ]);
  });
});
