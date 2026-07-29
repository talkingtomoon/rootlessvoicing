import { describe, expect, it } from 'vitest';
import { getVoicing, QUALITIES } from '../voicings';
import { placeVoicing, LOWEST_MIN, LOWEST_MAX } from '../placement';
import { buildProgression, placeProgression, PROGRESSIONS } from '../progressions';
import { keyName, notePc, spellInterval, spellVoicing, toGlyphs, ROOT_NAMES } from '../spelling';
import { allItems, contextsFor, itemId, itemsOf, parseItemId } from '../items';
import { chordSymbol } from '../format';
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
    dom7b9: { intervals: [16, 19, 22, 25], degrees: ['3', '5', 'b7', 'b9'] },
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
  it('G7b9 = F Ab B D', () => {
    expect(chords[1].rootName).toBe('G');
    expect(chords[1].noteNames).toEqual(['F', 'Ab', 'B', 'D']);
  });
  it('Cm9 = Eb G Bb D', () => {
    expect(chords[2].rootName).toBe('C');
    expect(chords[2].noteNames).toEqual(['Eb', 'G', 'Bb', 'D']);
  });
});

describe('검산: C minor B형', () => {
  const chords = buildProgression(0, 'minor', 'B');

  it('Dm7b5 = C D F Ab', () => {
    expect(chords[0].noteNames).toEqual(['C', 'D', 'F', 'Ab']);
  });
  it('G7b9 = B D F Ab', () => {
    expect(chords[1].noteNames).toEqual(['B', 'D', 'F', 'Ab']);
  });
  it('Cm9 = Bb D Eb G', () => {
    expect(chords[2].noteNames).toEqual(['Bb', 'D', 'Eb', 'G']);
  });
});

describe('옥타브 배치 (canonical)', () => {
  it('전 120개 item: 최저음이 MIDI 48–59, 4음 순증가', () => {
    for (const item of allItems()) {
      const midi = placeVoicing(item.rootPc, getVoicing(item.quality, item.form));
      expect(midi).toHaveLength(4);
      expect(midi[0]).toBeGreaterThanOrEqual(LOWEST_MIN);
      expect(midi[0]).toBeLessThanOrEqual(LOWEST_MAX);
      for (let i = 1; i < 4; i++) expect(midi[i]).toBeGreaterThan(midi[i - 1]);
    }
  });

  it('C major A형의 canonical 배치는 F3 A3 C4 E4 / F3 A3 B3 E4 / E3 G3 B3 D4', () => {
    const [ii, V, I] = buildProgression(0, 'major', 'A');
    expect(ii.midi).toEqual([53, 57, 60, 64]);
    expect(V.midi).toEqual([53, 57, 59, 64]);
    expect(I.midi).toEqual([52, 55, 59, 62]);
  });
});

describe('보이스리딩: 전 12키 × 메이저/마이너 × A/B', () => {
  // pitch class 기준 — 간격 테이블 자체의 보이스리딩 검증
  it('인접 코드 간 움직이는 성부(pc 기준)가 1~3개', () => {
    for (let keyPc = 0; keyPc < 12; keyPc++) {
      for (const type of TYPES) {
        for (const form of FORMS) {
          const chords = buildProgression(keyPc, type, form);
          for (let i = 1; i < chords.length; i++) {
            const prev = new Set(chords[i - 1].midi.map((n) => n % 12));
            const moved = chords[i].midi.filter((n) => !prev.has(n % 12)).length;
            expect(moved, `${keyName(keyPc)} ${type} ${form} chord ${i}`).toBeGreaterThanOrEqual(1);
            expect(moved, `${keyName(keyPc)} ${type} ${form} chord ${i}`).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });

  // MIDI 기준 — 재생용 배치가 실제로 부드럽게 이어지는지 검증
  it('placeProgression: 움직이는 성부 1~3개, 성부당 이동 ≤ 2반음, 첫 코드는 canonical', () => {
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
            const moved = diffs.filter((d) => d > 0).length;
            const label = `${keyName(keyPc)} ${type} ${form} chord ${i}`;
            expect(moved, label).toBeGreaterThanOrEqual(1);
            expect(moved, label).toBeLessThanOrEqual(3);
            expect(Math.max(...diffs), label).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

describe('음이름 표기', () => {
  it('루트는 문맥 무관 고정 표기 — 같은 item은 어떤 키로 출제돼도 같은 심볼', () => {
    expect(ROOT_NAMES).toHaveLength(12);
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

describe('코드 심볼 표기', () => {
  it('마이너 i도 메이저 ii와 같은 m7 표기 (같은 보이싱 = 같은 라벨)', () => {
    expect(labels(0, 'major')).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(labels(0, 'minor')).toEqual(['Dm7♭5', 'G7♭9', 'Cm7']);
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
  it('고유 item 120개', () => {
    const items = allItems();
    expect(items).toHaveLength(120);
    expect(new Set(items.map(itemId)).size).toBe(120);
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

  it('m7만 문맥이 두 개 (메이저 ii / 마이너 i) — 의도된 동작', () => {
    expect(contextsFor(2, 'm7')).toEqual([
      { type: 'major', keyPc: 0, roman: 'ii' },
      { type: 'minor', keyPc: 2, roman: 'i' },
    ]);
    expect(contextsFor(7, 'dom7')).toEqual([{ type: 'major', keyPc: 0, roman: 'V' }]);
    expect(contextsFor(0, 'maj7')).toEqual([{ type: 'major', keyPc: 0, roman: 'I' }]);
    expect(contextsFor(2, 'm7b5')).toEqual([{ type: 'minor', keyPc: 0, roman: 'ii∅' }]);
    expect(contextsFor(7, 'dom7b9')).toEqual([{ type: 'minor', keyPc: 0, roman: 'V' }]);
  });

  it('문맥의 진행에서 해당 슬롯 quality가 item quality와 일치한다', () => {
    for (const item of allItems()) {
      for (const ctx of contextsFor(item.rootPc, item.quality)) {
        const slot = PROGRESSIONS[ctx.type].find((s) => s.roman === ctx.roman)!;
        expect(slot.quality).toBe(item.quality);
        expect((ctx.keyPc + slot.rootOffset) % 12).toBe(item.rootPc);
      }
    }
  });
});
