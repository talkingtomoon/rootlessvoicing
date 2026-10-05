import { describe, expect, it } from 'vitest';
import { getVoicing, QUALITIES } from '../voicings';
import { CANONICAL_MAX, CANONICAL_MIN, HAND_MAX, HAND_MIN, placeVoicing, TOP_MIN, TOP_MAX } from '../placement';
import { buildProgression, placeProgression, PROGRESSIONS } from '../progressions';
import { keyName, notePc, spellInterval, spellVoicing, toGlyphs, ROOT_NAMES } from '../spelling';
import { allItems, contextOf, itemId, itemsOf, parseItemId } from '../items';
import { chordSymbol, NOTATIONS, QUALITY_SYMBOL, QUALITY_SYMBOL_ALT } from '../format';
import { buildChord, CHROMATIC_ORDER, FOURTHS_ORDER } from '../chord';
import type { Form, ProgressionType } from '../types';

const FORMS: Form[] = ['A', 'B'];
const TYPES: ProgressionType[] = ['major', 'minor'];

describe('B형 파생', () => {
  // 스펙 §2 기준 테이블의 B형 값과 파생 결과가 일치해야 한다
  const EXPECTED_B: Record<string, { intervals: number[]; degrees: string[] }> = {
    m7: { intervals: [10, 14, 15, 19], degrees: ['b7', '9', 'b3', '5'] },
    dom7: { intervals: [16, 21, 22, 26], degrees: ['3', '13', 'b7', '9'] },
    maj7: { intervals: [11, 14, 16, 19], degrees: ['7', '9', '3', '5'] },
    m7b5: { intervals: [10, 12, 15, 18], degrees: ['b7', '1', 'b3', 'b5'] },
    dom7b9b13: { intervals: [16, 20, 22, 25], degrees: ['3', 'b13', 'b7', 'b9'] },
    m6: { intervals: [9, 14, 15, 19], degrees: ['6', '9', 'b3', '5'] },
  };

  it.each(QUALITIES)('%s B형 = A형 위 두 성부를 옥타브 내려 아래에 배치', (q) => {
    const b = getVoicing(q, 'B');
    expect(b.intervals).toEqual(EXPECTED_B[q].intervals);
    expect(b.degrees).toEqual(EXPECTED_B[q].degrees);
  });

  it.each(QUALITIES)('%s intervals는 오름차순 4음', (q) => {
    for (const form of FORMS) {
      const v = getVoicing(q, form);
      expect(v.intervals).toHaveLength(4);
      expect([...v.intervals].sort((a, b) => a - b)).toEqual(v.intervals);
    }
  });
});

describe('검산: C major A형', () => {
  const chords = buildProgression(0, 'major', 'A');

  it('Dm7 = F A C E', () => {
    expect(chords[0].rootName).toBe('D');
    expect(chords[0].noteNames).toEqual(['F', 'A', 'C', 'E']);
  });
  it('G7 = F A B E', () => {
    expect(chords[1].rootName).toBe('G');
    expect(chords[1].noteNames).toEqual(['F', 'A', 'B', 'E']);
  });
  it('Cmaj7 = E G B D', () => {
    expect(chords[2].rootName).toBe('C');
    expect(chords[2].noteNames).toEqual(['E', 'G', 'B', 'D']);
  });
});

describe('검산: C minor A형', () => {
  const chords = buildProgression(0, 'minor', 'A');

  it('Dm7b5 = F Ab C D', () => {
    expect(chords[0].rootName).toBe('D');
    expect(chords[0].noteNames).toEqual(['F', 'Ab', 'C', 'D']);
  });
  it('G7b9b13 = F Ab B Eb', () => {
    expect(chords[1].rootName).toBe('G');
    expect(chords[1].noteNames).toEqual(['F', 'Ab', 'B', 'Eb']);
  });
  it('Cm6 = Eb G A D', () => {
    expect(chords[2].rootName).toBe('C');
    expect(chords[2].noteNames).toEqual(['Eb', 'G', 'A', 'D']);
  });
});

describe('검산: C minor B형', () => {
  const chords = buildProgression(0, 'minor', 'B');

  it('Dm7b5 = C D F Ab', () => {
    expect(chords[0].noteNames).toEqual(['C', 'D', 'F', 'Ab']);
  });
  it('G7b9b13 = B Eb F Ab', () => {
    expect(chords[1].noteNames).toEqual(['B', 'Eb', 'F', 'Ab']);
  });
  it('Cm6 = A D Eb G', () => {
    expect(chords[2].noteNames).toEqual(['A', 'D', 'Eb', 'G']);
  });
});

describe('옥타브 배치 (canonical)', () => {
  it('전 144개 item: 최고음(엄지)이 MIDI 60–72, 4음 순증가', () => {
    for (const item of allItems()) {
      const midi = placeVoicing(item.rootPc, getVoicing(item.quality, item.form));
      expect(midi).toHaveLength(4);
      expect(midi[3]).toBeGreaterThanOrEqual(TOP_MIN);
      expect(midi[3]).toBeLessThanOrEqual(TOP_MAX);
      for (let i = 1; i < 4; i++) expect(midi[i]).toBeGreaterThan(midi[i - 1]);
    }
  });

  it('canonical이 실제로 쓰는 구간은 49–71이고, 손 범위(36–72) 안이다', () => {
    const all = allItems().map((it) => placeVoicing(it.rootPc, getVoicing(it.quality, it.form)));
    expect(Math.min(...all.map((m) => m[0]))).toBe(CANONICAL_MIN);
    expect(Math.max(...all.map((m) => m[3]))).toBe(CANONICAL_MAX);
    expect(CANONICAL_MIN).toBeGreaterThanOrEqual(HAND_MIN);
    expect(CANONICAL_MAX).toBeLessThanOrEqual(HAND_MAX);
    // 한 옥타브 아래로 쳐도 건반 안 (관대 채점이 실제로 쓸 수 있다)
    expect(CANONICAL_MIN - 12).toBeGreaterThanOrEqual(HAND_MIN);
  });

  it('C major A형의 canonical 배치는 F3 A3 C4 E4 / F3 A3 B3 E4 / E3 G3 B3 D4', () => {
    const [ii, V, I] = buildProgression(0, 'major', 'A');
    expect(ii.midi).toEqual([53, 57, 60, 64]);
    expect(V.midi).toEqual([53, 57, 59, 64]);
    expect(I.midi).toEqual([52, 55, 59, 62]);
  });
});

describe('보이스리딩: 전 12키 × 메이저/마이너 × A/B', () => {
  /**
   * 기준은 **이동 성부의 개수가 아니라 성부당 거리**다.
   * 마이너 V(7♭9♭13) → i(m6)는 네 성부가 다 내려간다 — 그게 마이너 해결의 소리다.
   * 긴장이 풀리는 느낌은 "안 움직이는 음이 있다"가 아니라 "다 같이 한두 반음씩 내려간다"에서 온다.
   */
  it('인접 코드 간 성부당 이동이 2반음 이하 (pc 기준)', () => {
    const pcDistance = (a: number, b: number) => {
      const d = (((b - a) % 12) + 12) % 12;
      return Math.min(d, 12 - d);
    };
    for (let keyPc = 0; keyPc < 12; keyPc++) {
      for (const type of TYPES) {
        for (const form of FORMS) {
          const chords = buildProgression(keyPc, type, form);
          for (let i = 1; i < chords.length; i++) {
            const label = `${keyName(keyPc)} ${type} ${form} chord ${i}`;
            const dists = chords[i].midi.map((n, j) => pcDistance(chords[i - 1].midi[j], n));
            expect(Math.max(...dists), label).toBeLessThanOrEqual(2);
            expect(Math.max(...dists), label).toBeGreaterThan(0); // 같은 코드가 이어지지는 않는다
          }
        }
      }
    }
  });

  // MIDI 기준 — 재생용 배치가 실제로 부드럽게 이어지는지 검증
  it('placeProgression: 성부당 이동 ≤ 2반음, 손 범위 안, 첫 코드는 canonical', () => {
    for (let keyPc = 0; keyPc < 12; keyPc++) {
      for (const type of TYPES) {
        for (const form of FORMS) {
          const placed = placeProgression(keyPc, type, form);
          const slot0 = PROGRESSIONS[type][0];
          expect(placed[0]).toEqual(
            placeVoicing((keyPc + slot0.rootOffset) % 12, getVoicing(slot0.quality, form)),
          );
          for (let i = 1; i < placed.length; i++) {
            const diffs = placed[i].map((n, j) => Math.abs(n - placed[i - 1][j]));
            const label = `${keyName(keyPc)} ${type} ${form} chord ${i}`;
            expect(Math.max(...diffs), label).toBeLessThanOrEqual(2);
            expect(Math.max(...diffs), label).toBeGreaterThan(0);
            expect(Math.min(...placed[i]), label).toBeGreaterThanOrEqual(HAND_MIN);
            expect(Math.max(...placed[i]), label).toBeLessThanOrEqual(HAND_MAX);
          }
        }
      }
    }
  });
});

describe('음이름 표기', () => {
  it('루트는 문맥 무관 고정 표기 — 같은 item은 어떤 키로 출제돼도 같은 심볼', () => {
    // 스펙 §3의 고정 배열 — 진행 토닉 기준 철자 로직을 쓰지 않는다
    expect(ROOT_NAMES).toEqual(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
    // pc 1은 항상 C#, pc 3은 항상 Eb (진행 토닉과 무관)
    expect(buildProgression(1, 'major', 'A')[2].rootName).toBe('C#'); // C# major의 I
    expect(buildProgression(11, 'major', 'A')[0].rootName).toBe('C#'); // B major의 ii
    expect(buildProgression(6, 'minor', 'A')[1].rootName).toBe('C#'); // F# minor의 V
    expect(keyName(1)).toBe('C#');
    expect(keyName(8)).toBe('Ab');
  });

  it('보이싱 음은 루트 기준 도수 철자', () => {
    expect(spellInterval('Eb', 'b3', 3)).toBe('Gb');
    expect(spellInterval('G', 'b9', 13)).toBe('Ab');
    expect(spellInterval('B', 'b9', 13)).toBe('C');
  });

  it('겹임시표는 홑임시표로 단순화한다', () => {
    // Ebm7b5의 b5 = Bbb → A
    expect(spellVoicing('Eb', getVoicing('m7b5', 'A'))).toEqual(['Gb', 'A', 'Db', 'Eb']);
    for (const item of allItems()) {
      for (const name of spellVoicing(ROOT_NAMES[item.rootPc], getVoicing(item.quality, item.form))) {
        expect(name, `${ROOT_NAMES[item.rootPc]} ${item.quality}`).not.toMatch(/bb|##/);
      }
    }
  });

  it('전 진행의 모든 음이름이 그 코드의 pitch class와 일치한다', () => {
    for (let keyPc = 0; keyPc < 12; keyPc++) {
      for (const type of TYPES) {
        for (const form of FORMS) {
          for (const chord of buildProgression(keyPc, type, form)) {
            chord.noteNames.forEach((name, i) => {
              expect(notePc(name)).toBe(((chord.midi[i] % 12) + 12) % 12);
            });
            // 4음의 글자가 전부 다르다 (같은 글자 중복 철자 방지)
            expect(new Set(chord.noteNames.map((n) => n[0])).size).toBe(4);
          }
        }
      }
    }
  });

  it('spellVoicing과 buildProgression의 결과가 일치', () => {
    const v = getVoicing('m7', 'A');
    expect(spellVoicing('D', v)).toEqual(['F', 'A', 'C', 'E']);
  });

  it('toGlyphs', () => {
    expect(toGlyphs('Db')).toBe('D♭');
    expect(toGlyphs('F#')).toBe('F♯');
    expect(toGlyphs('b3')).toBe('♭3');
    expect(toGlyphs('m7b5')).toBe('m7♭5');
  });
});

describe('코드 심볼 표기 2종', () => {
  it('표기 A / 표기 B (스펙 §3)', () => {
    const rows: [typeof QUALITIES[number], string, string][] = [
      ['maj7', 'Cmaj7', 'CΔ7'],
      ['m7', 'Cm7', 'C-7'],
      ['dom7', 'C7', 'C7'],
      ['m7b5', 'Cm7♭5', 'Cø7'],
      ['m6', 'Cm6', 'C-6'],
      ['dom7b9b13', 'C7♭9♭13', 'C7(♭9♭13)'],
    ];
    for (const [q, plain, alt] of rows) {
      expect(chordSymbol('C', q), q).toBe(plain);
      expect(chordSymbol('C', q, 'alt'), q).toBe(alt);
    }
    expect(chordSymbol('Db', 'm7b5', 'alt')).toBe('D♭ø7');
    expect(NOTATIONS).toEqual(['plain', 'alt']);
  });

  it('두 표기 테이블이 6 quality를 다 덮는다', () => {
    for (const q of QUALITIES) {
      expect(QUALITY_SYMBOL[q], q).toBeTruthy();
      expect(QUALITY_SYMBOL_ALT[q], q).toBeTruthy();
    }
  });
});

describe('코드 심볼 표기', () => {
  it('quality 하나당 표기 하나 — 마이너 i는 m6이라 메이저 ii와 겹치지 않는다', () => {
    expect(labels(0, 'major')).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(labels(0, 'minor')).toEqual(['Dm7♭5', 'G7♭9♭13', 'Cm6']);
    expect(labels(1, 'major')).toEqual(['E♭m7', 'A♭7', 'C♯maj7']); // 루트 고정 표기: pc1 = C♯
  });

  function labels(keyPc: number, type: ProgressionType): string[] {
    return buildProgression(keyPc, type, 'A').map((c) => chordSymbol(c.rootName, c.quality));
  }
});

describe('단일 코드 (진행 문맥 없음)', () => {
  it('buildChord는 canonical 배치를 쓴다', () => {
    for (const item of allItems()) {
      const chord = buildChord(item.rootPc, item.quality, item.form);
      expect(chord.midi).toEqual(placeVoicing(item.rootPc, getVoicing(item.quality, item.form)));
      expect(chord.rootName).toBe(ROOT_NAMES[item.rootPc]);
      expect(chord.noteNames).toHaveLength(4);
    }
  });

  it('진행 안의 코드와 심볼·음이름이 일치한다 (같은 item = 같은 표기)', () => {
    for (let keyPc = 0; keyPc < 12; keyPc++) {
      for (const type of TYPES) {
        for (const form of FORMS) {
          for (const pc of buildProgression(keyPc, type, form)) {
            const standalone = buildChord(pc.rootPc, pc.quality, form);
            expect(standalone.rootName).toBe(pc.rootName);
            expect(standalone.noteNames).toEqual(pc.noteNames);
            expect(standalone.midi).toEqual(pc.midi);
          }
        }
      }
    }
  });

  it('4도권 순서: 12루트 한 바퀴, 매 스텝 완전4도(+5반음)', () => {
    expect(new Set(FOURTHS_ORDER).size).toBe(12);
    for (let i = 1; i < FOURTHS_ORDER.length; i++) {
      expect((FOURTHS_ORDER[i - 1] + 5) % 12).toBe(FOURTHS_ORDER[i]);
    }
    // 한 바퀴 돌아 처음으로 이어진다
    expect((FOURTHS_ORDER[11] + 5) % 12).toBe(FOURTHS_ORDER[0]);
  });

  it('반음계 순서: 0..11', () => {
    expect(CHROMATIC_ORDER).toEqual([...Array(12).keys()]);
  });
});

describe('items', () => {
  it('고유 item 144개 (6 quality × 12루트 × 2폼)', () => {
    const items = allItems();
    expect(items).toHaveLength(144);
    expect(new Set(items.map(itemId)).size).toBe(144);
  });

  it('itemsOf: 한 quality × form은 12루트 정확히 한 바퀴', () => {
    for (const quality of QUALITIES) {
      for (const form of FORMS) {
        const items = itemsOf(quality, form);
        expect(items).toHaveLength(12);
        expect(items.map((i) => i.rootPc).sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
        expect(items.every((i) => i.quality === quality && i.form === form)).toBe(true);
        // allItems()의 부분집합이어야 한다 (같은 item 식별자 체계)
        const all = new Set(allItems().map(itemId));
        expect(items.every((i) => all.has(itemId(i)))).toBe(true);
      }
    }
  });

  it('itemId 왕복', () => {
    const item = { rootPc: 3, quality: 'm7b5' as const, form: 'B' as const };
    expect(parseItemId(itemId(item))).toEqual(item);
  });

  it('quality마다 문맥이 하나 — m7의 이중 문맥은 사라졌다', () => {
    expect(contextOf(2, 'm7')).toEqual({ type: 'major', keyPc: 0, roman: 'ii' });
    expect(contextOf(7, 'dom7')).toEqual({ type: 'major', keyPc: 0, roman: 'V' });
    expect(contextOf(0, 'maj7')).toEqual({ type: 'major', keyPc: 0, roman: 'I' });
    expect(contextOf(2, 'm7b5')).toEqual({ type: 'minor', keyPc: 0, roman: 'ii∅' });
    expect(contextOf(7, 'dom7b9b13')).toEqual({ type: 'minor', keyPc: 0, roman: 'V' });
    expect(contextOf(0, 'm6')).toEqual({ type: 'minor', keyPc: 0, roman: 'i' });
  });

  it('문맥의 진행에서 해당 슬롯 quality가 item quality와 일치한다', () => {
    for (const item of allItems()) {
      const ctx = contextOf(item.rootPc, item.quality);
      const slot = PROGRESSIONS[ctx.type].find((s) => s.roman === ctx.roman)!;
      expect(slot.quality).toBe(item.quality);
      expect((ctx.keyPc + slot.rootOffset) % 12).toBe(item.rootPc);
    }
  });
});
