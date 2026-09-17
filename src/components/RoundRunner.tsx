import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { itemId, type Item, type ItemId } from '../engine/items';
import type { ProgressionType } from '../engine/types';
import { buildChord } from '../engine/chord';
import { chordSymbol, keyLabel } from '../engine/format';
import { gradeSequence, stackAscending } from '../engine/grading';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { playChord, playNote } from '../audio/audio';
import { answerCurrent, createSession, remaining, type Session } from '../session/session';
import { FAST_MS } from '../session/daily';
import type { InputMode } from '../state/prefs';
import { Keyboard, type KeyHighlight } from './Keyboard';
import { LinkLines } from './LinkLines';

/** 판 하나의 결과 — 오늘 요약과 진도 갱신에 쓴다 */
export type RoundResult = {
  session: Session;
  /** 카드별 첫 시도 반응 시간(ms) */
  firstMs: Record<ItemId, number>;
};

type Props = {
  items: Item[];
  allowedTypes: ProgressionType[];
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
export function RoundRunner({ items, allowedTypes, mode, freshIds, onFinish, onRemaining }: Props) {
  const [session, setSession] = useState<Session>(() =>
    createSession(items, Date.now(), Math.random, allowedTypes),
  );
  type Phase = 'input' | 'reveal' | 'graded';
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
  }, [result]);

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
      setResult({ correct, slow: correct && ms > FAST_MS.tap, ms });
      setPhase('graded');
    }
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
      setResult({ correct: false, slow: false, ms });
      setPhase('graded');
    } else {
      setResult({ correct: false, slow: false, ms });
      setPhase('reveal');
    }
  }

  /** piano 자가채점: 채점과 동시에 다음 카드로 */
  function selfGrade(g: 'wrong' | 'slow' | 'fast') {
    if (phase !== 'reveal') return;
    setSession((s) => answerCurrent(s, g !== 'wrong', g === 'slow'));
    shownAt.current = performance.now();
    setPhase('input');
    setResult(null);
  }

  /** tap 오답 정정: 알고 있었는데 잘못 누름 → 맞음으로 넘기되 느림 취급(단계 유지) */
  function markMistap() {
    if (phase !== 'graded' || !result || result.correct) return;
    setResult({ ...result, correct: true, slow: true });
    setCorrected(true);
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
      } else if (phase === 'graded' && e.key === '1') {
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

  let verdict = '';
  let verdictClass = 'text-ivory-dim';
  if (phase === 'graded' && result) {
    if (corrected) verdict = '맞음으로 넘김';
    else if (!result.correct) {
      verdict = pcs.length === 4 ? '아니야' : '이렇게';
      verdictClass = 'text-crimson';
    } else if (result.slow) verdict = `맞음 · ${secs}초 · 한 번 더`;
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
          <span className="font-display text-7xl text-ivory">
            {chordSymbol(ROOT_NAMES[card.item.rootPc], card.item.quality)}
          </span>
          <span className="rounded-md border border-line px-2 py-0.5 text-base text-ivory-dim">{card.item.form}형</span>
        </div>
        <div className="mt-2 h-4 text-xs tracking-widest text-muted">
          {revealed ? `${keyLabel(card.ctx.keyPc, card.ctx.type)} · ${card.ctx.roman}` : ''}
        </div>
      </div>

      {/* 정답 — 공개 뒤에만. 입력 중엔 자리를 비워 건반이 화면 안에 들어오게 */}
      <div className="flex flex-col gap-3">
        {revealed && (
          <>
            <Keyboard from={48} to={71} highlights={answerHl} paged={false} />
            <div className="text-center text-sm text-ivory-dim">
              {chord.noteNames.map(toGlyphs).join('  ')}
              {phase === 'graded' && result && !result.correct && pcs.length === 4 && (
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
            {!result.correct && pcs.length === 4 ? (
              <button onClick={markMistap} className="rounded-2xl border border-line py-4 text-ivory-dim active:bg-surface">
                잘못 누름
              </button>
            ) : (
              <div />
            )}
            <button onClick={next} className="rounded-2xl bg-brass py-4 font-display text-xl text-felt-deep active:opacity-80">
              다음
            </button>
          </div>
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
