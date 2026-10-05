import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { itemId, type Item, type ItemId } from '../engine/items';
import { buildChord } from '../engine/chord';
import { chordSymbol, FULL_ADDS_INFO, keyLabel } from '../engine/format';
import { gradeSequence, stackAscending } from '../engine/grading';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { playChord, playNote } from '../audio/audio';
import { answerCurrent, createSession, remaining, type Session } from '../session/session';
import { FAST_MS } from '../session/daily';
import type { InputMode } from '../state/prefs';
import { Keyboard, type KeyHighlight } from './Keyboard';
import { LinkLines } from './LinkLines';
import { useEcho } from '../lib/useEcho';

/** 판 하나의 결과 — 오늘 요약과 진도 갱신에 쓴다 */
export type RoundResult = {
  session: Session;
  /** 카드별 첫 시도 반응 시간(ms) */
  firstMs: Record<ItemId, number>;
};

type Props = {
  items: Item[];
  mode: InputMode;
  /** 이번 판에 처음 배운 item — 카드에 '새' 표시 */
  freshIds: ItemId[];
  onFinish: (r: RoundResult) => void;
  /** 판 위쪽 틀에 남은 카드 수를 알려준다 */
  onRemaining: (n: number) => void;
};

/**
 * 판 하나 = 보관함 루프(session.ts) 한 번. 폰 세로 한 손 조작 기준 화면.
 *
 * 입력 두 갈래:
 * - tap: 한 옥타브 건반에 아래 성부부터 차례로 네 번. 네 번째에서 자동 채점.
 *   맞았어도 FAST_MS.tap보다 오래 걸렸으면 "느림" — 한 번 더 나오고 단계는 안 오른다.
 * - piano: 실제 피아노로 치고 정답 보기 → 틀림 / 느림 / 바로 셋 중 하나.
 *
 * 문제 화면엔 심볼+폼만. 키·도수 문맥과 연결 힌트는 정답 공개 뒤에만.
 * 암기 탭의 DrillRunner와 따로 둔 이유: 입력(순서 입력·3단 자가채점)과 속도 판정이 달라서다.
 * 출제 루프 자체는 session.ts를 그대로 공유한다.
 */
export function RoundRunner({ items, mode, freshIds, onFinish, onRemaining }: Props) {
  const [session, setSession] = useState<Session>(() =>
    createSession(items, Date.now(), Math.random),
  );
  /**
   * input → (reveal) → graded → [echo] → 다음 카드.
   * echo = 따라 치기. **못 맞힌 카드에만 붙인다** — 방금 제 손으로 맞게 친 카드는 다시 칠 이유가 없다.
   */
  type Phase = 'input' | 'reveal' | 'graded' | 'echo';
  const [phase, setPhase] = useState<Phase>('input');
  const [pcs, setPcs] = useState<number[]>([]);
  const pcsRef = useRef<number[]>([]);
  /** 채점 결과 (정정 반영) */
  const [result, setResult] = useState<{ correct: boolean; slow: boolean; ms: number } | null>(null);
  const [corrected, setCorrected] = useState(false);
  const shownAt = useRef(performance.now());
  const firstMs = useRef<Record<ItemId, number>>({});

  const card = session.current;
  const chord = useMemo(
    () => (card ? buildChord(card.item.rootPc, card.item.quality, card.item.form) : null),
    [card],
  );
  // 따라 치기 — 화면 건반은 pitch class로 받는다 (입력과 같은 한 옥타브 패드)
  const echo = useEcho(chord?.midi ?? [], true);

  useEffect(() => {
    onRemaining(remaining(session));
  }, [session, onRemaining]);

  // 카드를 넘길 때마다(next·selfGrade) 시간을 새로 잰다 — 같은 카드가 연달아 나와도 리셋되게.
  // 앱을 내렸다 올리면 그 사이 시간은 빼준다.
  useEffect(() => {
    let hiddenAt = 0;
    const h = () => {
      if (document.visibilityState === 'hidden') hiddenAt = performance.now();
      else if (hiddenAt) shownAt.current += performance.now() - hiddenAt;
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  // 판이 끝나면 한 번만 알린다
  const reported = useRef(false);
  useEffect(() => {
    if (session.current || reported.current) return;
    reported.current = true;
    onFinish({ session, firstMs: firstMs.current });
  }, [session, onFinish]);

  const elapsed = () => performance.now() - shownAt.current;

  const recordMs = (ms: number) => {
    if (!card) return;
    const id = itemId(card.item);
    if (!(id in session.firstTry) && !(id in firstMs.current)) firstMs.current[id] = ms;
  };

  const next = useCallback(() => {
    if (!result) return;
    setSession((s) => answerCurrent(s, result.correct, result.slow));
    shownAt.current = performance.now();
    setPhase('input');
    setPcs([]);
    pcsRef.current = [];
    setResult(null);
    setCorrected(false);
    echo.reset();
  }, [result, echo]);

  /** 못 맞힌 카드는 정답을 보고 한 번 따라 친 뒤에 넘어간다 */
  const afterGrade = useCallback((r: { correct: boolean; slow: boolean; ms: number }) => {
    setResult(r);
    setPhase(r.correct ? 'graded' : 'echo');
  }, []);

  // 따라 치기가 끝나면 바로 다음 문제
  useEffect(() => {
    if (phase !== 'echo' || !echo.complete) return;
    const t = setTimeout(next, 250);
    return () => clearTimeout(t);
  }, [phase, echo.complete, next]);

  // 맞히면 잠깐 정답을 보여주고 저절로 넘어간다 — 리듬이 끊기지 않게. 틀리면 직접 넘긴다.
  useEffect(() => {
    if (phase !== 'graded' || !result?.correct || corrected || mode !== 'tap') return;
    const t = setTimeout(next, result.slow ? 1600 : 900);
    return () => clearTimeout(t);
  }, [phase, result, corrected, mode, next]);

  function tapKey(midi: number) {
    if (phase !== 'input' || !chord) {
      playNote(midi);
      return;
    }
    const pc = midi % 12;
    const prev = pcsRef.current;
    let seq: number[];
    if (prev[prev.length - 1] === pc) seq = prev.slice(0, -1); // 마지막 음을 다시 누르면 취소
    else if (prev.includes(pc)) return; // 보이싱에 같은 음은 두 번 없다
    else seq = [...prev, pc];
    pcsRef.current = seq;
    setPcs(seq);
    if (seq.length > prev.length) playNote(stackAscending(seq)[seq.length - 1]);
    if (seq.length === 4) {
      const ms = elapsed();
      const correct = gradeSequence(seq, chord.midi);
      recordMs(ms);
      playChord(chord.midi);
      afterGrade({ correct, slow: correct && ms > FAST_MS.tap, ms });
    }
  }

  /** 따라 치기 중의 건반 입력 — 맞는 음만 세고 틀린 음은 소리만 난다 */
  function echoKey(midi: number) {
    playNote(chord ? stackAscending([midi % 12], chord.midi[0] - (chord.midi[0] % 12))[0] : midi);
    echo.press(midi);
  }

  function backspace() {
    if (phase !== 'input') return;
    const seq = pcsRef.current.slice(0, -1);
    pcsRef.current = seq;
    setPcs(seq);
  }

  /** tap: 모르겠음 / piano: 정답 보기 */
  function reveal() {
    if (phase !== 'input' || !chord) return;
    const ms = elapsed();
    recordMs(ms);
    playChord(chord.midi);
    if (mode === 'tap') {
      afterGrade({ correct: false, slow: false, ms }); // 모르겠음도 따라 치기로 간다
    } else {
      setResult({ correct: false, slow: false, ms });
      setPhase('reveal');
    }
  }

  /**
   * piano 자가채점. 맞힌 건 바로 다음 카드로, 틀린 건 따라 치기를 거친다.
   * 피아노로 치는 사람은 실제 건반에서 따라 치므로 화면에서는 버튼 하나로 끝낸다.
   */
  function selfGrade(g: 'wrong' | 'slow' | 'fast') {
    if (phase !== 'reveal') return;
    if (g === 'wrong') {
      setResult({ correct: false, slow: false, ms: result?.ms ?? 0 });
      setPhase('echo');
      return;
    }
    setSession((s) => answerCurrent(s, true, g === 'slow'));
    shownAt.current = performance.now();
    setPhase('input');
    setResult(null);
  }

  /**
   * tap 오답 정정: 알고 있었는데 잘못 누름 → 맞음으로 넘기되 느림 취급(단계 유지).
   * 알고 있었다면 따라 칠 것도 없으니 그대로 다음 카드로 간다.
   */
  function markMistap() {
    if (phase !== 'echo' || !result || result.correct) return;
    setSession((s) => answerCurrent(s, true, true));
    shownAt.current = performance.now();
    setPhase('input');
    setPcs([]);
    pcsRef.current = [];
    setResult(null);
    setCorrected(false);
    echo.reset();
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (phase === 'input' && e.key === ' ') {
        e.preventDefault();
        reveal();
      } else if (phase === 'input' && e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (phase === 'reveal' && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        selfGrade(e.key === '1' ? 'wrong' : e.key === '2' ? 'slow' : 'fast');
      } else if (phase === 'graded' && e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (phase === 'echo' && e.key === 'Enter') {
        // 키보드만 쓰는 사람은 실제 건반에서 따라 치고 Enter (화면 건반을 누를 손이 없다)
        e.preventDefault();
        next();
      } else if (phase === 'echo' && e.key === '1') {
        e.preventDefault();
        markMistap();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!card || !chord) return null;

  const revealed = phase !== 'input';
  const isFresh = freshIds.includes(itemId(card.item));
  const answerHl: KeyHighlight[] = chord.midi.map((midi, i) => ({ midi, label: chord.degrees[i], kind: 'answer' }));
  const inputHl: KeyHighlight[] = pcs.map((pc, i) => ({ midi: 48 + pc, label: String(i + 1), kind: 'user' }));
  const secs = result ? (result.ms / 1000).toFixed(1) : '';

  // 따라 치기: 정답 건반은 실제 음높이로, 입력 패드는 한 옥타브로 접어서
  const echoHl: KeyHighlight[] = chord.midi.map((midi, i) => ({
    midi,
    label: String(i + 1),
    kind: i < echo.done ? ('user' as const) : ('answer' as const),
  }));
  const echoPadHl: KeyHighlight[] = chord.midi.map((midi, i) => ({
    midi: 48 + (midi % 12),
    label: String(i + 1),
    kind: i < echo.done ? ('user' as const) : ('answer' as const),
  }));

  let verdict = '';
  let verdictClass = 'text-ivory-dim';
  if (phase === 'echo') {
    verdict = `따라 치기 · ${echo.done}/${echo.total}`;
    verdictClass = 'text-crimson';
  } else if (phase === 'graded' && result) {
    if (corrected) verdict = '맞음으로 넘김';
    else if (result.slow) verdict = `맞음 · ${secs}초 · 한 번 더`;
    else {
      verdict = `바로 · ${secs}초`;
      verdictClass = 'text-brass';
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* 문제: 심볼 + 폼만 */}
      <div className="flex min-h-36 flex-col items-center justify-center text-center">
        <div className="h-4 text-[11px] tracking-widest text-brass">{isFresh && !revealed ? '새 코드' : ''}</div>
        <div className="flex items-baseline gap-3">
          {/* 풀 때는 악보에서 만나는 간략 표기, 정답을 열면 명시 표기로 바뀐다 */}
          <span className="font-display text-7xl text-ivory">
            {chordSymbol(ROOT_NAMES[card.item.rootPc], card.item.quality, revealed ? 'full' : 'quiz')}
          </span>
          <span className="rounded-md border border-line px-2 py-0.5 text-base text-ivory-dim">{card.item.form}형</span>
        </div>
        <div className="mt-2 h-4 text-xs tracking-widest text-muted">
          {revealed ? `${keyLabel(card.ctx.keyPc, card.ctx.type)} · ${card.ctx.roman}` : ''}
        </div>
        {/* 7♭9♭13: 문제 표기에 없는 음이 보이싱에 들어간다 — 정답에서 짚어준다 */}
        <div className="h-4 text-[11px] text-brass">
          {revealed && FULL_ADDS_INFO.includes(card.item.quality)
            ? `${chordSymbol(ROOT_NAMES[card.item.rootPc], card.item.quality, 'quiz')}로 나와도 ♭13을 넣는다`
            : ''}
        </div>
      </div>

      {/* 정답 — 공개 뒤에만. 입력 중엔 자리를 비워 건반이 화면 안에 들어오게 */}
      <div className="flex flex-col gap-3">
        {revealed && (
          <>
            <Keyboard from={48} to={71} highlights={phase === 'echo' ? echoHl : answerHl} paged={false} />
            <div className="text-center text-sm text-ivory-dim">
              {chord.noteNames.map(toGlyphs).join('  ')}
              {phase === 'echo' && result && !result.correct && pcs.length === 4 && (
                <span className="text-muted">
                  {'  ·  누른 순서 '}
                  {pcs.map((pc) => toGlyphs(ROOT_NAMES[pc])).join(' ')}
                </span>
              )}
            </div>
            {(phase === 'reveal' || (result && (!result.correct || corrected || result.slow))) && (
              <div className="flex justify-center">
                <LinkLines item={card.item} ctx={card.ctx} />
              </div>
            )}
          </>
        )}
      </div>

      <div className={`my-2 h-5 text-center text-sm ${verdictClass}`}>{verdict}</div>

      {/* 입력 영역 — 엄지가 닿는 아래쪽 */}
      <div className="mt-auto flex flex-col gap-2">
        {mode === 'tap' && phase === 'input' && (
          <>
            <Keyboard from={48} to={59} highlights={inputHl} onKeyPress={tapKey} paged={false} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={reveal}
                className="rounded-2xl border border-line py-3.5 text-ivory-dim active:bg-surface"
              >
                모르겠음
              </button>
              <button
                onClick={backspace}
                disabled={pcs.length === 0}
                aria-label="한 음 지우기"
                className="rounded-2xl border border-line px-6 py-3.5 text-ivory-dim active:bg-surface disabled:opacity-30"
              >
                ⌫
              </button>
            </div>
            <div className="text-center text-[11px] text-muted">아래 음부터 차례로 · {pcs.length}/4</div>
          </>
        )}

        {mode === 'tap' && phase === 'graded' && result && (
          <div className="grid grid-cols-2 gap-2">
            <div />
            <button onClick={next} className="rounded-2xl bg-brass py-4 font-display text-xl text-felt-deep active:opacity-80">
              다음
            </button>
          </div>
        )}

        {/* 따라 치기 — 공개된 정답을 손으로 한 번 거치고 간다. 채점이 아니다 */}
        {mode === 'tap' && phase === 'echo' && (
          <>
            <Keyboard from={48} to={59} highlights={echoPadHl} onKeyPress={echoKey} paged={false} />
            {result && !result.correct && pcs.length === 4 && (
              <button
                onClick={markMistap}
                className="rounded-2xl border border-line py-3.5 text-ivory-dim active:bg-surface"
              >
                잘못 누름 · 알고 있었음
              </button>
            )}
            <div className="text-center text-[11px] text-muted">정답을 아래 음부터 차례로 · {echo.done}/4</div>
          </>
        )}

        {mode === 'piano' && phase === 'echo' && (
          <button
            onClick={next}
            className="h-32 rounded-3xl bg-brass text-lg font-display text-felt-deep active:opacity-80"
          >
            정답을 한 번 치고 · 다음
          </button>
        )}

        {mode === 'piano' && phase === 'input' && (
          <button
            onClick={reveal}
            className="h-40 rounded-3xl border border-line bg-felt-deep text-lg text-ivory-dim active:bg-surface"
          >
            피아노로 치고 · 정답 보기
          </button>
        )}

        {mode === 'piano' && phase === 'reveal' && (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => selfGrade('wrong')} className="rounded-2xl border border-crimson py-5 text-ivory active:bg-surface">
              틀림
            </button>
            <button onClick={() => selfGrade('slow')} className="rounded-2xl border border-line py-5 text-ivory-dim active:bg-surface">
              느림
            </button>
            <button onClick={() => selfGrade('fast')} className="rounded-2xl bg-brass py-5 font-display text-lg text-felt-deep active:opacity-80">
              바로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
