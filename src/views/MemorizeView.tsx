import { useCallback, useEffect, useMemo, useState } from 'react';
import { allItems, contextsFor, itemId, type Item } from '../engine/items';
import { gradeAttempt } from '../engine/grading';
import { toGlyphs } from '../engine/spelling';
import { buildProgression, PROGRESSIONS } from '../engine/progressions';
import { chordSymbol, keyLabel } from '../engine/format';
import { playChord, playNote } from '../audio/audio';
import { Keyboard, type KeyHighlight } from '../components/Keyboard';
import {
  answerCurrent,
  createSession,
  drawSessionItems,
  remaining,
  SESSION_SIZES,
  summarize,
  type Session,
} from '../session/session';
import { loadLastSessionSize, saveLastSessionSize } from '../state/prefs';

/** 문제 상태: 입력 중 → (정답 보기) 자가채점 대기 → 채점 완료 */
type QuizPhase = 'input' | 'reveal' | 'graded';

function itemLabel(item: Item): string {
  return `${chordSymbol(contextRootName(item), item.quality)} ${item.form}형`;
}

function contextRootName(item: Item): string {
  // 문맥 없는 표시(종료 화면)용 루트 철자: 첫 문맥 기준
  const ctx = contextsFor(item.rootPc, item.quality)[0];
  const slotIdx = PROGRESSIONS[ctx.type].findIndex((s) => s.roman === ctx.roman);
  return buildProgression(ctx.keyPc, ctx.type, item.form)[slotIdx].rootName;
}

export function MemorizeView() {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<QuizPhase>('input');
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [userNotes, setUserNotes] = useState<number[]>([]);
  const [lastN, setLastN] = useState(loadLastSessionSize);

  // 현재 카드의 문맥 코드: 심볼·canonical 배치·도수·음이름
  const chord = useMemo(() => {
    const card = session?.current;
    if (!card) return null;
    const slotIdx = PROGRESSIONS[card.ctx.type].findIndex((s) => s.roman === card.ctx.roman);
    return buildProgression(card.ctx.keyPc, card.ctx.type, card.item.form)[slotIdx];
  }, [session?.current]);

  function start(n: number) {
    saveLastSessionSize(n);
    setLastN(n);
    const items = drawSessionItems(allItems(), n, Math.random);
    setSession(createSession(items, Date.now(), Math.random));
    setPhase('input');
    setLastCorrect(null);
    setUserNotes([]);
  }

  const reveal = useCallback(() => {
    if (!chord) return;
    setPhase('reveal');
    playChord(chord.midi);
  }, [chord]);

  const grade = useCallback(
    (correct: boolean) => {
      setLastCorrect(correct);
      setPhase('graded');
    },
    [],
  );

  const next = useCallback(() => {
    if (!session || lastCorrect === null) return;
    setSession(answerCurrent(session, lastCorrect));
    setPhase('input');
    setLastCorrect(null);
    setUserNotes([]);
  }, [session, lastCorrect]);

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
    if (!session?.current) return;
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

  // ── 시작 화면 ───────────────────────────────────────────
  if (!session) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-16">
        <div className="text-center">
          <div className="text-xs tracking-widest text-muted">암기 세션</div>
          <h2 className="mt-1 font-display text-3xl text-ivory">몇 장 돌릴까</h2>
        </div>
        <div className="flex gap-3">
          {SESSION_SIZES.map((n) => (
            <button
              key={n}
              onClick={() => start(n)}
              className={`h-20 w-20 rounded-xl border font-display text-2xl transition-colors ${
                n === lastN
                  ? 'border-brass bg-surface text-ivory'
                  : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">한 세션은 뽑은 카드가 보관함까지 다 비면 끝난다</p>
      </div>
    );
  }

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
              {min > 0 ? `${min}분 ` : ''}{sec}초
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
                const item = session ? findItem(id) : null;
                return (
                  <div key={id} className="text-ivory-dim">
                    {item ? itemLabel(item) : id} · {count}회
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <button
          onClick={() => start(lastN)}
          className="rounded-full border border-brass px-6 py-2.5 text-ivory hover:bg-surface"
        >
          한 판 더
        </button>
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
          ? userNotes
              .filter((m) => !chord!.midi.includes(m))
              .map((midi) => ({ midi, kind: 'user' as const }))
          : []),
      ]
    : userNotes.map((midi) => ({ midi, kind: 'user' as const }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-2xl text-ivory">
          남은 카드 <span className="text-brass">{remaining(session)}</span>
        </div>
        <button onClick={() => setSession(null)} className="text-sm text-muted hover:text-ivory-dim">
          나가기
        </button>
      </div>

      <div className="text-center">
        <div className="text-xs tracking-widest text-muted">
          {keyLabel(card.ctx.keyPc, card.ctx.type)} · {card.ctx.roman}
        </div>
        <div className="mt-1 flex items-baseline justify-center gap-3">
          <span className="font-display text-6xl text-ivory">
            {chordSymbol(chord!.rootName, card.item.quality)}
          </span>
          <span className="rounded-md border border-line px-2 py-0.5 text-sm text-ivory-dim">
            {card.item.form}형
          </span>
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
            <span className="text-sm text-ivory-dim">
              {lastCorrect ? '정답' : '보관함에 넣었어'}
            </span>
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

function findItem(id: string): Item | null {
  return allItems().find((it) => itemId(it) === id) ?? null;
}
