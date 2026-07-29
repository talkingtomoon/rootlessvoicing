import { useEffect, useMemo, useRef, useState } from 'react';
import type { Form, ProgressionType } from '../engine/types';
import { buildProgression, placeProgression } from '../engine/progressions';
import { MAJOR_KEYS, MINOR_KEYS, toGlyphs } from '../engine/spelling';
import { chordSymbol, keyLabel } from '../engine/format';
import { playChord, playChordSequence, playNote } from '../audio/audio';
import { Keyboard, type KeyHighlight } from '../components/Keyboard';

function Seg<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: T[];
  labels: string[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-felt-deep p-1">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-md px-3 py-1.5 text-sm ${
            value === opt ? 'bg-surface text-ivory' : 'text-muted hover:text-ivory-dim'
          }`}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

export function ExploreView() {
  const [type, setType] = useState<ProgressionType>('major');
  const [form, setForm] = useState<Form>('A');
  const [keyPc, setKeyPc] = useState(0);
  const [selected, setSelected] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const chords = useMemo(() => buildProgression(keyPc, type, form), [keyPc, type, form]);
  // 탐색은 항상 진행 문맥 — 개별 클릭·연속 재생 모두 placeProgression 배치
  const placed = useMemo(() => placeProgression(keyPc, type, form), [keyPc, type, form]);

  const keyNames = type === 'major' ? MAJOR_KEYS : MINOR_KEYS;

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => clearTimers, []);
  useEffect(() => {
    clearTimers();
    setSelected(0);
  }, [keyPc, type, form]);

  const highlights: KeyHighlight[] = placed[selected].map((midi, i) => ({
    midi,
    label: chords[selected].degrees[i],
    kind: 'answer',
  }));

  function selectChord(i: number) {
    clearTimers();
    setSelected(i);
    playChord(placed[i]);
  }

  function playAll() {
    clearTimers();
    const offsets = playChordSequence(placed);
    timers.current = offsets.map((ms, i) => setTimeout(() => setSelected(i), ms));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-end gap-2">
        <Seg
          options={['major', 'minor'] as ProgressionType[]}
          labels={['Major ii–V–I', 'Minor ii–V–i']}
          value={type}
          onChange={setType}
        />
        <Seg options={['A', 'B'] as Form[]} labels={['A형', 'B형']} value={form} onChange={setForm} />
      </header>

      <div className="flex flex-wrap gap-1.5">
        {keyNames.map((name, pc) => (
          <button
            key={pc}
            onClick={() => setKeyPc(pc)}
            className={`min-w-11 rounded-md border px-2 py-1.5 text-sm ${
              keyPc === pc
                ? 'border-crimson bg-crimson text-ivory'
                : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
            }`}
          >
            {toGlyphs(name)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {chords.map((chord, i) => (
          <button
            key={chord.roman}
            onClick={() => selectChord(i)}
            className={`rounded-xl border p-4 text-center transition-colors ${
              selected === i
                ? 'border-brass bg-surface'
                : 'border-line bg-felt-deep hover:bg-surface'
            }`}
          >
            <div className="text-xs tracking-widest text-muted">
              {keyLabel(keyPc, type)} · {chord.roman}
            </div>
            <div className="mt-1 font-display text-3xl text-ivory sm:text-4xl">
              {chordSymbol(chord.rootName, chord.quality)}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={playAll}
          className="rounded-full border border-line px-4 py-2 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
        >
          ▶ 세 코드 이어 듣기
        </button>
        <div className="text-sm text-muted">
          {chords[selected].noteNames.map(toGlyphs).join(' · ')}
        </div>
      </div>

      <Keyboard highlights={highlights} onKeyPress={playNote} />
    </div>
  );
}
