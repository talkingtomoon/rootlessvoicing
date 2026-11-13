import { describe, expect, it } from 'vitest';
import { DAYS_OF_WINE_AND_ROSES, TUNES, tuneChords } from '../tunes';
import { voiceTune } from '../tuneVoicing';
import { HAND_MIN, TOP_MAX, TOP_MIN } from '../placement';
import { QUALITIES } from '../voicings';
import { toGlyphs } from '../spelling';

const tune = DAYS_OF_WINE_AND_ROSES;
const voiced = voiceTune(tune);

describe('곡 데이터', () => {
  it('32마디, 마디마다 4박', () => {
    expect(tune.bars).toHaveLength(32);
    for (const [i, bar] of tune.bars.entries()) {
      const beats = bar.reduce((s, c) => s + c.beats, 0);
      expect(beats, `${i + 1}마디`).toBe(tune.beatsPerBar);
    }
    expect(tuneChords(tune).reduce((s, c) => s + c.beats, 0)).toBe(128);
  });

  it('모든 코드가 앱의 여섯 quality 안에 있다 (차트 표기는 label에 남는다)', () => {
    for (const c of tuneChords(tune)) {
      expect(QUALITIES, c.label).toContain(c.quality);
      expect(c.rootPc).toBeGreaterThanOrEqual(0);
      expect(c.rootPc).toBeLessThan(12);
      expect(c.label.length).toBeGreaterThan(0);
    }
    // 알터드는 7♭9♭13으로, F6는 maj7로 옮겨 적는다
    expect(tuneChords(tune).find((c) => c.label === 'D7alt')!.quality).toBe('dom7b9b13');
    expect(tuneChords(tune).find((c) => c.label === 'F6')!.quality).toBe('maj7');
  });

  it('TUNES에 등록돼 있다', () => {
    expect(TUNES.map((t) => t.id)).toContain(tune.id);
  });
});

describe('곡 보이싱 (voiceTune)', () => {
  it('엄지는 C4–C5, 전체는 손 범위 안', () => {
    for (const v of voiced) {
      const top = v.midi[v.midi.length - 1];
      expect(top, v.chord.label).toBeGreaterThanOrEqual(TOP_MIN);
      expect(top, v.chord.label).toBeLessThanOrEqual(TOP_MAX);
      expect(v.midi[0], v.chord.label).toBeGreaterThanOrEqual(HAND_MIN);
    }
  });

  it('첫 코드부터 손 이동이 작다 (성부당 5반음 이하)', () => {
    for (let i = 1; i < voiced.length; i++) {
      const d = voiced[i].midi.map((n, j) => Math.abs(n - voiced[i - 1].midi[j]));
      expect(Math.max(...d), `${voiced[i - 1].chord.label} → ${voiced[i].chord.label}`).toBeLessThanOrEqual(5);
    }
  });

  it('ii–V는 한 음만 움직인다 (Gm7 → C7, Dm7 → G7, B♭m7 → E♭7)', () => {
    const at = (label: string) => voiced.findIndex((v) => v.chord.label === label);
    const pair = (a: string, b: string) => {
      const i = voiced.findIndex((v, k) => v.chord.label === a && voiced[k + 1]?.chord.label === b);
      expect(i, `${a} → ${b}`).toBeGreaterThanOrEqual(0);
      return voiced[i + 1].moved;
    };
    expect(pair('Gm7', 'C7')).toBe(1);
    expect(pair('Dm7', 'G7')).toBe(1);
    expect(pair('B♭m7', 'E♭7')).toBe(1);
    expect(at('Em7♭5')).toBeGreaterThanOrEqual(0);
  });

  it('첫 네 코드의 보이싱 (손검산)', () => {
    const show = (i: number) => `${voiced[i].form} ${voiced[i].noteNames.map(toGlyphs).join(' ')}`;
    expect(show(0)).toBe('A A C E G'); // Fmaj7
    expect(show(1)).toBe('B G C D♭ F'); // E♭7
    expect(show(2)).toBe('B F♯ B♭ C E♭'); // D7alt
    expect(show(3)).toBe('B F♯ B C E'); // D7 — 텐션만 풀린다
  });

  it('같은 코드는 거의 같은 자리에 온다 — 두 번째 A 머리에서만 다시 잡는다', () => {
    const shapes = new Map<string, Set<string>>();
    for (const v of voiced) {
      const key = v.chord.label;
      if (!shapes.has(key)) shapes.set(key, new Set());
      shapes.get(key)!.add(`${v.form}:${v.midi.join(',')}`);
    }
    // 두 자리 이상 쓰는 코드는 둘뿐이고, 둘 다 두 자리까지만
    const multi = [...shapes].filter(([, set]) => set.size > 1).map(([label]) => label);
    expect(multi.sort()).toEqual(['E♭7', 'Fmaj7']);
    for (const [label, set] of shapes) expect(set.size, label).toBeLessThanOrEqual(2);
    // 둘째 A는 C7에서 가장 가까운 자리로 다시 잡는다
    const secondF = voiced.findIndex((v, i) => v.chord.label === 'Fmaj7' && i > 16);
    expect(voiced[secondF].form).toBe('B');
    expect(voiced[secondF].moved).toBeLessThanOrEqual(3);
  });
});
