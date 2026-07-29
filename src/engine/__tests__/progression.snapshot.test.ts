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
      [48, 52, 53, 57], // Dm7  = C3 E3 F3 A3
      [47, 52, 53, 57], // G7   = B2 E3 F3 A3
      [47, 50, 52, 55], // Cmaj7 = B2 D3 E3 G3
    ]);
    expect(PROGRESSION_SNAPSHOT['minor:A:0']).toEqual([
      [53, 56, 60, 62], // Dm7b5 = F3 Ab3 C4 D4
      [53, 56, 59, 62], // G7b9  = F3 Ab3 B3 D4
      [51, 55, 58, 62], // Cm9   = Eb3 G3 Bb3 D4
    ]);
    expect(PROGRESSION_SNAPSHOT['minor:B:0']).toEqual([
      [48, 50, 53, 56], // Dm7b5 = C3 D3 F3 Ab3
      [47, 50, 53, 56], // G7b9  = B2 D3 F3 Ab3
      [46, 50, 51, 55], // Cm9   = Bb2 D3 Eb3 G3
    ]);
  });
});
