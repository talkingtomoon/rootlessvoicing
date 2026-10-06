import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item } from '../engine/items';
import { degreeMidis, degreeNoteNames, degreeSteps } from '../engine/degrees';
import { chordSymbol } from '../engine/format';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { playChord, playNote } from '../audio/audio';
import { answerCurrent, createSession, remaining, summarize, type Session } from '../session/session';
import { Keyboard, type KeyHighlight } from './Keyboard';
import { useEcho } from '../lib/useEcho';

/** 도수 드릴 입력 건반 — 한 옥타브. 9는 2도 자리, 13은 6도 자리에 찍는다. */
const PAD_FROM = 48;
const PAD_TO = 59;

type Props = {
  /** 이번 세션에 낼 item 목록 (form은 쓰지 않는다 — 도수는 폼과 무관하다) */
  draw: () => Item[];
  onExit: () => void;
  /** 받은 순서 그대로 낼까 (키 순서 '4도 순환') */
  keepOrder?: boolean;
  /** 오늘 탭 안에 넣을 때 — 바깥 틀(DailyShell)이 머리말과 판 사이 화면을 맡는다 */
  embedded?: boolean;
  /** 판이 끝났을 때 (도수 진도 기록용) */
  onFinish?: (session: Session) => void;
  /** 남은 카드 수를 바깥 틀에 알린다 */
  onRemaining?: (n: number) => void;
};

type Phase = 'input' | 'reveal' | 'graded' | 'echo';

/**
 * 도수 드릴 — 코드 심볼을 보고 구성음을 루트부터 차례로 찍는다.
 * 보관함 루프·따라 치기·자가채점은 보이싱 모드와 같고, 다른 건 입력뿐이다:
 * **순서가 틀리면 그 자리에서 알려준다**(마지막까지 기다리지 않는다).
 *
 * 진도(Leitner)에는 기록하지 않는다 — 보이싱 앞에 두는 층이고,
 * 진도 링크 포맷(144 item)을 흔들지 않기 위해서다.
 */
export function DegreeRunner({ draw, onExit, keepOrder = false, embedded = false, onFinish, onRemaining }: Props) {
  const [session, setSession] = useState<Session>(() => createSession(draw(), Date.now(), Math.random, keepOrder));
  const [phase, setPhase] = useState<Phase>('input');
  /** 지금까지 맞게 찍은 개수 */
  const [filled, setFilled] = useState(0);
  const filledRef = useRef(0);
  /** 틀리게 찍은 pitch class (그 자리에서 알려준다) */
  const [wrongPc, setWrongPc] = useState<number | null>(null);

  const card = session.current;
  const item = card?.item;
  const steps = item ? degreeSteps(item.quality) : [];
  const names = item ? degreeNoteNames(item.rootPc, item.quality) : [];
  const pcs = item ? steps.map((s) => (item.rootPc + s.semitone) % 12) : [];
  /** 도수 순서대로의 실제 음높이 — 누를 때 이 소리가 난다 (위로 쌓인다) */
  const midis = item ? degreeMidis(item.rootPc, item.quality, PAD_FROM) : [];
  const echo = useEcho(pcs, true);

  /**
   * 그 자리의 소리. 맞는 자리를 눌렀으면 쌓아 올린 음높이로,
   * 아니면 한 옥타브 안의 그 음으로 들려준다.
   */
  const sound = useCallback(
    (pc: number, index: number) => {
      const want = pcs[index];
      playNote(want === pc && midis[index] !== undefined ? midis[index] : PAD_FROM + pc);
    },
    [pcs, midis],
  );

  useEffect(() => {
    onRemaining?.(remaining(session));
  }, [session, onRemaining]);

  // 판이 끝나면 한 번만 알린다 (StrictMode 이중 실행 방지용 ref 가드)
  const reported = useRef<Session | null>(null);
  useEffect(() => {
    if (session.current || reported.current === session) return;
    reported.current = session;
    onFinish?.(session);
  }, [session, onFinish]);

  const reset = useCallback(() => {
    setPhase('input');
    setFilled(0);
    filledRef.current = 0;
    setWrongPc(null);
    echo.reset();
  }, [echo]);

  const next = useCallback(
    (correct: boolean) => {
      setSession((s) => answerCurrent(s, correct));
      reset();
    },
    [reset],
  );

  // 따라 치기가 끝나면 바로 다음 문제
  useEffect(() => {
    if (phase !== 'echo' || !echo.complete) return;
    const t = setTimeout(() => next(false), 250);
    return () => clearTimeout(t);
  }, [phase, echo.complete, next]);

  function reveal() {
    if (phase !== 'input' || !item) return;
    playChord(midis);
    setPhase('reveal');
  }

  function press(midi: number) {
    const pc = ((midi % 12) + 12) % 12;
    if (phase === 'echo') {
      sound(pc, echo.done);
      echo.press(pc);
      return;
    }
    if (phase !== 'input' || !item) {
      playNote(PAD_FROM + pc);
      return;
    }
    sound(pc, filledRef.current);
    if (pc === pcs[filledRef.current]) {
      const n = filledRef.current + 1;
      filledRef.current = n;
      setFilled(n);
      if (n === pcs.length) setPhase('graded'); // 끝까지 순서대로 맞혔다
      return;
    }
    // 순서가 틀리면 그 자리에서 — 정답을 보여주고 따라 치기로
    setWrongPc(pc);
    setPhase('echo');
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (!session.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setSession(createSession(draw(), Date.now(), Math.random, keepOrder));
          reset();
        }
      } else if (phase === 'input' && e.key === ' ') {
        e.preventDefault();
        reveal();
      } else if (phase === 'reveal' && (e.key === '1' || e.key === '2')) {
        e.preventDefault();
        if (e.key === '1') next(true);
        else setPhase('echo');
      } else if (phase === 'graded' && e.key === 'Enter') {
        e.preventDefault();
        next(true);
      } else if (phase === 'echo' && e.key === 'Enter') {
        e.preventDefault();
        next(false);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ── 종료 화면 ───────────────────────────────────────────
  // 오늘 탭 안에서는 바깥(TodayView)이 판 사이 화면을 맡는다
  if (embedded && (!card || !item)) return null;

  if (!card || !item) {
    const sum = summarize(session, Date.now());
    const min = Math.floor(sum.elapsedMs / 60000);
    const sec = Math.round((sum.elapsedMs % 60000) / 1000);
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-16">
        <h2 className="font-display text-3xl text-ivory">끝</h2>
        <div className="flex gap-10 text-center">
          <div>
            <div className="text-xs tracking-widest text-muted">소요 시간</div>
            <div className="mt-1 font-display text-2xl text-ivory">
              {min > 0 ? `${min}분 ` : ''}
              {sec}초
            </div>
          </div>
          <div>
            <div className="text-xs tracking-widest text-muted">첫 시도 정답</div>
            <div className="mt-1 font-display text-2xl text-ivory">
              {sum.firstTryCorrect}/{sum.total}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSession(createSession(draw(), Date.now(), Math.random, keepOrder));
              reset();
            }}
            className="rounded-full border border-brass px-6 py-2.5 text-ivory hover:bg-surface"
          >
            한 판 더 <kbd className="text-muted">Enter</kbd>
          </button>
          <button
            onClick={onExit}
            className="rounded-full border border-line px-6 py-2.5 text-ivory-dim hover:border-muted"
          >
            바꾸기 <kbd className="text-muted">Esc</kbd>
          </button>
        </div>
      </div>
    );
  }

  const revealed = phase !== 'input';
  const showAll = phase === 'reveal' || phase === 'echo';
  const done = phase === 'echo' ? echo.done : phase === 'graded' ? pcs.length : filled;

  // 입력 중에는 이미 찍은 음만 보여준다 (남은 음을 띄우면 답을 알려주는 꼴).
  // 정답 공개·따라 치기에서는 전부 도수 라벨과 함께 보여준다.
  const highlights: KeyHighlight[] = [
    ...pcs.map((pc, i) => ({
      midi: PAD_FROM + pc,
      label: showAll || i < done ? toGlyphs(steps[i].degree) : undefined,
      kind: i < done ? ('user' as const) : ('answer' as const),
    })),
    ...(wrongPc !== null && !pcs.includes(wrongPc)
      ? [{ midi: PAD_FROM + wrongPc, kind: 'user' as const }]
      : []),
  ].filter((h) => showAll || h.kind === 'user');

  return (
    <div
      className={
        embedded
          ? 'flex flex-1 flex-col gap-5 pb-[max(1rem,env(safe-area-inset-bottom))]'
          : 'mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6'
      }
    >
      {!embedded && (
        <div className="flex items-baseline justify-between">
          <div className="font-display text-2xl text-ivory">
            남은 카드 <span className="text-brass">{remaining(session)}</span>
          </div>
          <button onClick={onExit} className="text-sm text-muted hover:text-ivory-dim">
            나가기 <kbd>Esc</kbd>
          </button>
        </div>
      )}

      <div className="text-center">
        {embedded && <div className="mb-1 text-[11px] tracking-widest text-brass">도수</div>}
        <span className="font-display text-6xl text-ivory">
          {chordSymbol(ROOT_NAMES[item.rootPc], item.quality, revealed ? 'full' : 'quiz')}
        </span>
      </div>

      {/* 찍을 칸 — quality마다 칸 수가 다르다 (m7♭5는 넷) */}
      <div className="flex justify-center gap-2">
        {steps.map((step, i) => {
          const filledHere = i < done;
          return (
            <div
              key={step.degree}
              className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border ${
                filledHere ? 'border-brass bg-surface' : 'border-line bg-felt-deep'
              }`}
            >
              {/* 도수는 미리 적어둔다 — "무엇을 누를지"가 아니라 "그 도수가 어디인지"를 익히는 모드다 */}
              <span className={`font-display text-xl ${filledHere ? 'text-ivory' : 'text-ivory-dim'}`}>
                {toGlyphs(step.degree)}
              </span>
              <span className={`text-[11px] ${filledHere ? 'text-brass' : 'text-muted'}`}>
                {filledHere || showAll ? toGlyphs(names[i]) : '·'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-11 items-center justify-center gap-3">
        {phase === 'input' && (
          <>
            <span className="text-sm text-muted">
              루트부터 차례로 · {filled}/{pcs.length}
            </span>
            <button
              onClick={reveal}
              className="rounded-full border border-line px-4 py-2 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
            >
              정답 보기 <kbd className="text-muted">Space</kbd>
            </button>
          </>
        )}
        {phase === 'reveal' && (
          <>
            <button
              onClick={() => next(true)}
              className="rounded-full border border-brass px-4 py-2 text-sm text-ivory hover:bg-surface"
            >
              맞혔음 <kbd className="text-muted">1</kbd>
            </button>
            <button
              onClick={() => setPhase('echo')}
              className="rounded-full border border-line px-4 py-2 text-sm text-ivory-dim hover:border-muted"
            >
              틀렸음 <kbd className="text-muted">2</kbd>
            </button>
          </>
        )}
        {phase === 'echo' && (
          <>
            <span className="text-sm text-crimson">
              {wrongPc !== null ? `${toGlyphs(ROOT_NAMES[wrongPc])}는 아니야` : '보관함에 넣었어'}
            </span>
            <span className="text-sm text-muted">
              따라 치기 · {echo.done}/{pcs.length}
            </span>
            <button
              onClick={() => next(false)}
              className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-ivory-dim"
            >
              피아노로 쳤음 <kbd>Enter</kbd>
            </button>
          </>
        )}
        {phase === 'graded' && (
          <>
            <span className="text-sm text-ivory-dim">정답</span>
            <button
              onClick={() => next(true)}
              className="rounded-full border border-brass px-4 py-2 text-sm text-ivory hover:bg-surface"
            >
              다음 <kbd className="text-muted">Enter</kbd>
            </button>
          </>
        )}
      </div>

      <div className={embedded ? 'mt-auto' : ''}>
        <Keyboard from={PAD_FROM} to={PAD_TO} highlights={highlights} onKeyPress={press} paged={false} guide={false} />
      </div>
    </div>
  );
}
