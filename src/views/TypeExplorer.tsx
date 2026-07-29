import { useEffect, useMemo, useRef, useState } from 'react';
import type { Form } from '../engine/types';
import { buildChord, CHROMATIC_ORDER, FOURTHS_ORDER } from '../engine/chord';
import { QUALITIES } from '../engine/voicings';
import { QUALITY_SYMBOL } from '../engine/format';
import { chordSymbol } from '../engine/format';
import { toGlyphs } from '../engine/spelling';
import { playChord, playChordSequence, playNote } from '../audio/audio';
import { Keyboard, type KeyHighlight } from '../components/Keyboard';
import { Seg } from '../components/Seg';
import {
  loadLastForm,
  loadLastOrder,
  loadLastQuality,
  saveLastForm,
  saveLastOrder,
  saveLastQuality,
} from '../state/prefs';

type Order = 'fourths' | 'chromatic';

/**
 * quality × form 하나를 12루트에 걸쳐 보고 듣는 사전.
 * 진행 문맥이 없으므로 배치는 canonical(buildChord) — 암기 모드 정답과 같은 배치를 듣는다.
 */
export function TypeExplorer() {
  const [quality, setQuality] = useState(loadLastQuality);
  const [form, setForm] = useState<Form>(loadLastForm);
  const [order, setOrder] = useState<Order>(loadLastOrder);
  const [selected, setSelected] = useState(0); // 아래 roots 배열의 인덱스
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const roots = order === 'fourths' ? FOURTHS_ORDER : CHROMATIC_ORDER;
  const chords = useMemo(
    () => roots.map((pc) => buildChord(pc, quality, form)),
    [roots, quality, form],
  );

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => clearTimers, []);
  useEffect(() => {
    clearTimers();
    setSelected(0);
  }, [quality, form, order]);

  const current = chords[selected];
  const highlights: KeyHighlight[] = current.midi.map((midi, i) => ({
    midi,
    label: current.degrees[i],
    kind: 'answer',
  }));

  function selectRoot(i: number) {
    clearTimers();
    setSelected(i);
    playChord(chords[i].midi);
  }

  function playAll() {
    clearTimers();
    const offsets = playChordSequence(chords.map((c) => c.midi), 0.9);
    timers.current = offsets.map((ms, i) => setTimeout(() => setSelected(i), ms));
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Seg
          options={['A', 'B'] as Form[]}
          labels={['A형', 'B형']}
          value={form}
          onChange={(f) => {
            setForm(f);
            saveLastForm(f);
          }}
        />
        <Seg
          options={['fourths', 'chromatic'] as Order[]}
          labels={['4도권', '반음계']}
          value={order}
          onChange={(o) => {
            setOrder(o);
            saveLastOrder(o);
          }}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {QUALITIES.map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuality(q);
              saveLastQuality(q);
            }}
            className={`rounded-lg border px-4 py-2 font-display text-lg transition-colors ${
              q === quality
                ? 'border-brass bg-surface text-ivory'
                : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
            }`}
          >
            {toGlyphs(QUALITY_SYMBOL[q])}
          </button>
        ))}
      </div>

      {/* 12루트 — 클릭하면 건반에 찍히고 소리가 난다 */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {chords.map((chord, i) => (
          <button
            key={chord.rootPc}
            onClick={() => selectRoot(i)}
            className={`rounded-lg border py-3 font-display text-lg transition-colors ${
              selected === i
                ? 'border-brass bg-surface text-ivory'
                : 'border-line bg-felt-deep text-ivory-dim hover:bg-surface'
            }`}
          >
            {chordSymbol(chord.rootName, chord.quality)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={playAll}
          className="rounded-full border border-line px-4 py-2 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
        >
          ▶ 12키 이어 듣기
        </button>
        <div className="text-sm text-muted">{current.noteNames.map(toGlyphs).join(' · ')}</div>
      </div>

      <Keyboard highlights={highlights} onKeyPress={playNote} />
    </>
  );
}
