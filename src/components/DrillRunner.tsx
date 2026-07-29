import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allItems, itemId, type Item } from '../engine/items';
import { gradeAttempt } from '../engine/grading';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { buildProgression, PROGRESSIONS } from '../engine/progressions';
import { chordSymbol, keyLabel } from '../engine/format';
import { playChord, playNote } from '../audio/audio';
import { Keyboard, type KeyHighlight } from './Keyboard';
import { answerCurrent, createSession, remaining, summarize, type Session } from '../session/session';

/** 문제 상태: 입력 중 → (정답 보기) 자가채점 대기 → 채점 완료 */
type QuizPhase = 'input' | 'reveal' | 'graded';

type Props = {
  /** 이번 세션에 낼 item 목록을 뽑는다. '한 판 더'에서 다시 호출된다. */
  draw: () => Item[];
  /** 나가기 / 세션 종료 후 시작 화면으로 */
  onExit: () => void;
  /** 세션이 끝났을 때 item별 첫 시도 결과를 넘긴다 (Leitner 갱신용). 세션당 한 번만 호출된다. */
  onFinish?: (firstTry: Record<string, boolean>) => void;
};

function itemLabel(item: Item): string {
  return `${chordSymbol(ROOT_NAMES[item.rootPc], item.quality)} ${item.form}형`;
}

function findItem(id: string): Item | null {
  return allItems().find((it) => itemId(it) === id) ?? null;
}

/**
 * 보관함 루프 실행부 — 암기/타입별 모드가 공유한다.
 * 어떤 item을 낼지는 draw()가 정하고, 여기서는 출제·채점·집계만 한다.
 */
export function DrillRunner({ draw, onExit, onFinish }: Props) {
  const [session, setSession] = useState<Session>(() =>
    createSession(draw(), Date.now(), Math.random),
  );
  const [phase, setPhase] = useState<QuizPhase>('input');
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [userNotes, setUserNotes] = useState<number[]>([]);

  // 현재 카드의 코드: 심볼·canonical 배치·도수·음이름 (루트 철자는 문맥 무관 고정)
  const chord = useMemo(() => {
    const card = session.current;
    if (!card) return null;
    const slotIdx = PROGRESSIONS[card.ctx.type].findIndex((s) => s.roman === card.ctx.roman);
    return buildProgression(card.ctx.keyPc, card.ctx.type, card.item.form)[slotIdx];
  }, [session.current]);

  // 세션이 끝나면 진도를 한 번만 기록한다 (StrictMode 이중 실행 방지용 ref 가드)
  const recorded = useRef<Session | null>(null);
  useEffect(() => {
    if (session.current || recorded.current === session) return;
    recorded.current = session;
    onFinish?.(session.firstTry);
  }, [session, onFinish]);

  function restart() {
    setSession(createSession(draw(), Date.now(), Math.random));
    setPhase('input');
    setLastCorrect(null);
    setUserNotes([]);
  }

  const reveal = useCallback(() => {
    if (!chord) return;
    setPhase('reveal');
    playChord(chord.midi);
  }, [chord]);

  const grade = useCallback((correct: boolean) => {
    setLastCorrect(correct);
    setPhase('graded');
  }, []);

  const next = useCallback(() => {
    if (lastCorrect === null) return;
    setSession((s) => answerCurrent(s, lastCorrect));
    setPhase('input');
    setLastCorrect(null);
    setUserNotes([]);
  }, [lastCorrect]);

  function pressKey(midi: number) {
    playNote(midi);
    if (phase !== 'input' || !chord) return;
    const notes = userNotes.includes(midi)
      ? userNotes.filter((m) => m !== midi)
      : [...userNotes, midi];
    setUserNotes(notes);
    if (notes.length === 4) {
      // 경로 A: 4음 채워지면 자동 채점 + 정답 공개
      const ok = gradeAttempt(notes, chord.midi);
      playChord(chord.midi);
      setLastCorrect(ok);
      setPhase('graded');
    }
  }

  // Space=정답 보기, 1/2=자가채점, Enter=다음
  useEffect(() => {
    if (!session.current) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ' && phase === 'input') {
        e.preventDefault();
        reveal();
      } else if (phase === 'reveal' && (e.key === '1' || e.key === '2')) {
        e.preventDefault();
        grade(e.key === '1');
      } else if (phase === 'graded' && e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [session, phase, reveal, grade, next]);

  // ── 종료 화면 ───────────────────────────────────────────
  if (!session.current) {
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
        {sum.topMisses.length > 0 && (
          <div className="text-center">
            <div className="text-xs tracking-widest text-muted">많이 틀린 항목</div>
            <div className="mt-2 flex flex-col gap-1">
              {sum.topMisses.map(({ id, count }) => {
                const item = findItem(id);
                return (
                  <div key={id} className="text-ivory-dim">
                    {item ? itemLabel(item) : id} · {count}회
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={restart}
            className="rounded-full border border-brass px-6 py-2.5 text-ivory hover:bg-surface"
          >
            한 판 더
          </button>
          <button
            onClick={onExit}
            className="rounded-full border border-line px-6 py-2.5 text-ivory-dim hover:border-muted"
          >
            바꾸기
          </button>
        </div>
      </div>
    );
  }

  // ── 퀴즈 화면 ───────────────────────────────────────────
  const card = session.current;
  const revealed = phase !== 'input';

  const highlights: KeyHighlight[] = revealed
    ? [
        ...chord!.midi.map((midi, i) => ({
          midi,
          label: chord!.degrees[i],
          kind: 'answer' as const,
        })),
        // 오답이면 사용자가 누른 음을 다른 색으로 겹쳐 보여준다
        ...(lastCorrect !== true
          ? userNotes.filter((m) => !chord!.midi.includes(m)).map((midi) => ({ midi, kind: 'user' as const }))
          : []),
      ]
    : userNotes.map((midi) => ({ midi, kind: 'user' as const }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-2xl text-ivory">
          남은 카드 <span className="text-brass">{remaining(session)}</span>
        </div>
        <button onClick={onExit} className="text-sm text-muted hover:text-ivory-dim">
          나가기
        </button>
      </div>

      {/* 문제 화면은 코드 심볼 + 폼만. 문맥(키·도수)은 정답 공개 후에만 사후 정보로 보여준다. */}
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-3">
          <span className="font-display text-6xl text-ivory">
            {chordSymbol(chord!.rootName, card.item.quality)}
          </span>
          <span className="rounded-md border border-line px-2 py-0.5 text-sm text-ivory-dim">
            {card.item.form}형
          </span>
        </div>
        <div className="mt-2 min-h-4 text-xs tracking-widest text-muted">
          {revealed ? `${keyLabel(card.ctx.keyPc, card.ctx.type)} · ${card.ctx.roman}` : ''}
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-center gap-3">
        {phase === 'input' && (
          <>
            <span className="text-sm text-muted">건반에서 4음 · {userNotes.length}/4</span>
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
              onClick={() => grade(true)}
              className="rounded-full border border-brass px-4 py-2 text-sm text-ivory hover:bg-surface"
            >
              맞혔음 <kbd className="text-muted">1</kbd>
            </button>
            <button
              onClick={() => grade(false)}
              className="rounded-full border border-line px-4 py-2 text-sm text-ivory-dim hover:border-muted"
            >
              틀렸음 <kbd className="text-muted">2</kbd>
            </button>
          </>
        )}
        {phase === 'graded' && (
          <>
            <span className="text-sm text-ivory-dim">{lastCorrect ? '정답' : '보관함에 넣었어'}</span>
            <button
              onClick={next}
              className="rounded-full border border-brass px-4 py-2 text-sm text-ivory hover:bg-surface"
            >
              다음 <kbd className="text-muted">Enter</kbd>
            </button>
          </>
        )}
      </div>

      <Keyboard highlights={highlights} onKeyPress={pressKey} />

      {revealed && (
        <div className="text-center text-sm text-muted">
          {chord!.noteNames.map(toGlyphs).join(' · ')}
        </div>
      )}
    </div>
  );
}
