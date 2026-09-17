import { useEffect, useMemo, useState } from 'react';
import { itemId, type Item } from '../engine/items';
import { buildProgression, placeProgression } from '../engine/progressions';
import { chordSymbol, keyLabel } from '../engine/format';
import { toGlyphs } from '../engine/spelling';
import { progressionLinks, siblingLink } from '../engine/links';
import { playChord, playChordSequence } from '../audio/audio';
import type { Unit } from '../session/daily';
import { Keyboard, type KeyHighlight } from './Keyboard';
import { LinkLines } from './LinkLines';

type Props = {
  unit: Unit;
  /** 이번에 새로 배우는 item (나머지는 이미 아는 코드) */
  fresh: Item[];
  onDone: () => void;
};

/**
 * 새 유닛 소개: 한 키의 ii–V–I를 한 코드씩. 배치는 진행 문맥이라 placeProgression.
 * 앞 코드에서 움직인 성부는 브라스로 칠해서 "무엇만 바뀌는지"가 눈에 먼저 들어오게 한다.
 * (ii는 앞 코드가 없으니 마이너 ii∅만 같은 루트 m7과 달라진 음을 칠한다.)
 */
export function LessonIntro({ unit, fresh, onDone }: Props) {
  const [step, setStep] = useState(0);
  const chords = useMemo(() => buildProgression(unit.keyPc, unit.type, unit.form), [unit]);
  const placed = useMemo(() => placeProgression(unit.keyPc, unit.type, unit.form), [unit]);
  const freshIds = new Set(fresh.map(itemId));

  // 세 코드가 다 들어가는 고정 범위 — 코드를 넘겨도 건반이 흔들리지 않게
  const [from, to] = useMemo(() => {
    const all = placed.flat();
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const start = lo - (lo % 12);
    return [start, hi <= start + 23 ? start + 23 : start + 35];
  }, [placed]);

  const chord = chords[step];
  const item = unit.items[step];
  const last = step === chords.length - 1;

  useEffect(() => {
    playChord(placed[step]);
  }, [placed, step]);

  // 무엇이 바뀌었나: V·I는 앞 코드에서, 마이너 ii∅는 같은 루트 m7에서
  const changed = useMemo(() => {
    if (step > 0) {
      const [prev] = progressionLinks(unit.keyPc, unit.type, unit.form, step);
      return prev.moves.map((m) => m.delta !== 0);
    }
    const sib = siblingLink(item.rootPc, item.quality, item.form);
    return sib ? sib.moves.map((m) => m.delta !== 0) : [false, false, false, false];
  }, [unit, step, item]);

  const highlights: KeyHighlight[] = placed[step].map((midi, i) => ({
    midi,
    label: chord.degrees[i],
    kind: changed[i] ? ('user' as const) : ('answer' as const),
  }));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (last) onDone();
        else setStep((s) => s + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        playChord(placed[step]);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="flex flex-1 flex-col gap-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="text-center">
        <div className="text-xs tracking-widest text-brass">새로 배우기</div>
        <div className="mt-1 text-sm text-ivory-dim">
          {keyLabel(unit.keyPc, unit.type)} · ii–V–{unit.type === 'major' ? 'I' : 'i'} · {unit.form}형
        </div>
      </div>

      {/* 세 코드 탭 — 어디쯤인지 */}
      <div className="grid grid-cols-3 gap-2">
        {chords.map((c, i) => (
          <button
            key={c.roman}
            onClick={() => setStep(i)}
            className={`rounded-xl border px-1 py-2 text-center transition-colors ${
              i === step ? 'border-brass bg-surface' : 'border-line bg-felt-deep'
            }`}
          >
            <div className="text-[10px] tracking-widest text-muted">{c.roman}</div>
            <div className={`font-display text-lg ${i === step ? 'text-ivory' : 'text-ivory-dim'}`}>
              {chordSymbol(c.rootName, c.quality)}
            </div>
            <div className="text-[10px] text-muted">
              {freshIds.has(itemId(unit.items[i])) ? '새 코드' : '아는 코드'}
            </div>
          </button>
        ))}
      </div>

      <div className="text-center">
        <div className="font-display text-6xl text-ivory">{chordSymbol(chord.rootName, chord.quality)}</div>
        <div className="mt-2 text-base tracking-wide text-ivory-dim">
          {chord.noteNames.map(toGlyphs).join('  ')}
        </div>
      </div>

      <Keyboard from={from} to={to} highlights={highlights} paged={false} />

      <div className="flex justify-center">
        <LinkLines item={item} ctx={{ type: unit.type, keyPc: unit.keyPc, roman: chord.roman }} />
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => playChord(placed[step])}
            className="rounded-2xl border border-line py-3.5 text-ivory-dim active:bg-surface"
          >
            ▶ 듣기
          </button>
          <button
            onClick={() => playChordSequence(placed)}
            className="rounded-2xl border border-line py-3.5 text-ivory-dim active:bg-surface"
          >
            ▶ 세 코드 이어서
          </button>
        </div>
        <button
          onClick={() => (last ? onDone() : setStep(step + 1))}
          className="rounded-2xl bg-brass py-4 font-display text-xl text-felt-deep active:opacity-80"
        >
          {last ? '외우러 가기' : '다음 코드'}
        </button>
      </div>
    </div>
  );
}
