import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tune } from '../engine/tunes';
import { TUNES } from '../engine/tunes';
import { beatSeconds, voiceTune, type VoicedChord } from '../engine/tuneVoicing';
import { keyName, toGlyphs } from '../engine/spelling';
import { playChord, playProgression, stopAll } from '../audio/audio';
import { Keyboard, type KeyHighlight } from '../components/Keyboard';
import { Seg } from '../components/Seg';
import { getVoicing } from '../engine/voicings';

type Props = {
  /** 이 곡으로 순서대로 연습하기 */
  onPractice: (tune: Tune) => void;
};

const TEMPOS = [
  { id: 'slow', label: '느리게', bpm: 60 },
  { id: 'medium', label: '보통', bpm: 100 },
  { id: 'fast', label: '빠르게', bpm: 140 },
] as const;

type TempoId = (typeof TEMPOS)[number]['id'];

/**
 * 곡 모드 — 차트를 보고, 한 코드씩 듣고, 전체를 이어서 듣는다.
 * 폼(A/B)과 옥타브는 `voiceTune`이 보이스리딩으로 정한다 — 손으로 적지 마라.
 */
export function TuneView({ onPractice }: Props) {
  // 지금은 곡이 하나다. 늘어나면 여기 고르는 UI를 붙인다.
  const [tuneId] = useState(TUNES[0].id);
  const tune = TUNES.find((t) => t.id === tuneId) ?? TUNES[0];
  const voiced = useMemo(() => voiceTune(tune), [tune]);

  const [tempo, setTempo] = useState<TempoId>('medium');
  const bpm = TEMPOS.find((t) => t.id === tempo)!.bpm;
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    stopAll();
    setPlaying(false);
  }, [clearTimers]);

  useEffect(() => stop, [stop]);
  useEffect(() => {
    stop();
    setCursor(0);
  }, [tuneId, stop]);

  /** 전체 재생 — 오디오는 한 번에 스케줄하고, 화면 커서만 타이머로 따라간다 */
  function playAll(from = 0) {
    clearTimers();
    stopAll();
    const beat = beatSeconds(bpm);
    const rest = voiced.slice(from);
    const offsets = playProgression(rest.map((v) => ({ midi: v.midi, seconds: v.chord.beats * beat })));
    setPlaying(true);
    setCursor(from);
    offsets.forEach((ms, i) => {
      timers.current.push(setTimeout(() => setCursor(from + i), ms));
    });
    const total = rest.reduce((s, v) => s + v.chord.beats * beat, 0);
    timers.current.push(setTimeout(() => setPlaying(false), total * 1000));
  }

  function tapChord(index: number) {
    stop();
    setCursor(index);
    playChord(voiced[index].midi);
  }

  const current = voiced[cursor];
  const next = voiced[cursor + 1];
  const highlights: KeyHighlight[] = current.midi.map((midi, i) => ({
    midi,
    label: getVoicing(current.chord.quality, current.form).degrees[i],
    kind: 'answer',
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <div className="text-center">
        <h2 className="font-display text-2xl text-ivory">{tune.title}</h2>
        <div className="mt-1 text-xs tracking-widest text-muted">
          {tune.composer} · {toGlyphs(keyName(tune.keyPc))} · {tune.bars.length}마디
        </div>
      </div>

      {/* 차트 — 한 줄에 네 마디 */}
      <div className="grid grid-cols-4 gap-1">
        {tune.bars.map((barChords, barIdx) => {
          const firstIndex = tune.bars.slice(0, barIdx).reduce((n, b) => n + b.length, 0);
          const active = cursor >= firstIndex && cursor < firstIndex + barChords.length;
          return (
            <div
              key={barIdx}
              className={`flex min-h-14 flex-col justify-center gap-0.5 rounded-lg border px-1 py-1.5 ${
                active ? 'border-brass bg-surface' : 'border-line bg-felt-deep'
              }`}
            >
              {barChords.map((chord, i) => {
                const index = firstIndex + i;
                const v = voiced[index];
                const here = cursor === index;
                return (
                  <button
                    key={i}
                    onClick={() => tapChord(index)}
                    className="flex items-baseline justify-center gap-1 leading-tight"
                  >
                    <span className={`font-display text-sm ${here ? 'text-ivory' : 'text-ivory-dim'}`}>
                      {chord.label}
                    </span>
                    <span className="text-[10px] text-muted">{v.form}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 지금 코드 — 오른쪽에 다음 코드 기호만 (노래방처럼) */}
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-3">
          <span className="font-display text-3xl text-ivory">{current.chord.label}</span>
          {next && <span className="font-display text-xl text-muted">{next.chord.label}</span>}
        </div>
        <div className="mt-1 text-sm text-ivory-dim">
          {current.form}형 · {current.noteNames.map(toGlyphs).join(' ')}
          {current.moved > 0 && <span className="text-muted"> · 앞 코드에서 {current.moved}성부</span>}
        </div>
      </div>

      <Keyboard highlights={highlights} onKeyPress={() => {}} />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => (playing ? stop() : playAll(0))}
          className="rounded-full border border-brass px-6 py-2.5 text-ivory hover:bg-surface"
        >
          {playing ? '■ 멈춤' : '▶ 전체 재생'}
        </button>
        <button
          onClick={() => playAll(cursor)}
          className="rounded-full border border-line px-5 py-2.5 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
        >
          여기부터
        </button>
        <Seg
          options={TEMPOS.map((t) => t.id) as TempoId[]}
          labels={TEMPOS.map((t) => t.label)}
          value={tempo}
          onChange={(id) => {
            stop();
            setTempo(id);
          }}
        />
      </div>

      <button
        onClick={() => onPractice(tune)}
        className="self-center rounded-full bg-brass px-8 py-3 font-display text-xl text-felt-deep hover:opacity-90"
      >
        이 곡으로 연습
      </button>

      <p className="text-center text-xs text-muted">
        폼과 옥타브는 보이스리딩으로 정해진다. 차트 표기는 손으로 쓴 그대로고, 알터드는 7♭9♭13으로, F6는 maj7로 친다.
      </p>
    </div>
  );
}

/** 곡의 코드 순서를 그대로 연습 item으로 (중복은 처음 한 번만) */
export function tuneItems(tune: Tune): { rootPc: number; quality: VoicedChord['chord']['quality']; form: 'A' | 'B' }[] {
  const seen = new Set<string>();
  const out: { rootPc: number; quality: VoicedChord['chord']['quality']; form: 'A' | 'B' }[] = [];
  for (const v of voiceTune(tune)) {
    const id = `${v.chord.rootPc}:${v.chord.quality}:${v.form}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ rootPc: v.chord.rootPc, quality: v.chord.quality, form: v.form });
  }
  return out;
}
