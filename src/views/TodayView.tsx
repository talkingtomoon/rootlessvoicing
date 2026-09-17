import { useCallback, useEffect, useMemo, useState } from 'react';
import { itemId, type Item } from '../engine/items';
import { chordSymbol, keyLabel } from '../engine/format';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { applyResults, type ProgressStore } from '../state/progress';
import { enabledForms, enabledItems, enabledTypes, type Settings } from '../state/settings';
import {
  addSeconds,
  DAILY_GOAL_SEC,
  dayToDate,
  loadTimeLog,
  loadUnitsToday,
  saveTimeLog,
  saveUnitsToday,
  studyDay,
  weekOf,
  type TimeLog,
} from '../state/day';
import { loadInputMode, saveInputMode, type InputMode } from '../state/prefs';
import {
  curriculum,
  dueToday,
  nextUnit,
  planRound,
  shouldIntroduce,
  unitState,
  UNIT_FORMS,
  UNIT_TYPES,
  type Unit,
} from '../session/daily';
import { DailyShell } from '../components/DailyShell';
import { clock } from '../lib/clock';
import { LessonIntro } from '../components/LessonIntro';
import { RoundRunner, type RoundResult } from '../components/RoundRunner';
import { Seg } from '../components/Seg';
import { FOURTHS_ORDER } from '../engine/chord';

type Props = {
  store: ProgressStore;
  onStoreChange: (next: ProgressStore) => void;
  settings: Settings;
};

type Stage = 'home' | 'intro' | 'round' | 'break' | 'done';

type Plan = { unit: Unit | null; fresh: Item[]; items: Item[] };

/** 이번 방문 동안의 누적 — 판 사이 화면과 끝 화면에 쓴다 */
type Stats = { cards: number; firstOk: number; fast: number; ms: number[]; learned: Item[] };
const EMPTY_STATS: Stats = { cards: 0, firstOk: 0, fast: 0, ms: [], learned: [] };

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

function isIosBrowserTab(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && nav.standalone === false;
}

/**
 * 오늘의 15분. 홈 → (새 유닛 소개) → 판 → 판 사이 → … → 15분 채우면 끝 화면.
 * 판마다 바로 진도에 기록한다 — 중간에 닫아도 끝낸 판까지는 남는다.
 */
export function TodayView({ store, onStoreChange, settings }: Props) {
  const [stage, setStage] = useState<Stage>('home');
  const [day, setDay] = useState(studyDay);
  const [log, setLog] = useState<TimeLog>(loadTimeLog);
  const [mode, setMode] = useState<InputMode>(loadInputMode);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [roundNo, setRoundNo] = useState(0);
  const [left, setLeft] = useState(0);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [lastRound, setLastRound] = useState<{ n: number; ok: number; avg: number } | null>(null);
  /** 15분을 채운 뒤 "한 판 더"를 누르면 판마다 끝 화면을 다시 띄우지 않는다 */
  const [extended, setExtended] = useState(false);

  const pool = useMemo(() => enabledItems(settings), [settings]);
  const types = useMemo(() => enabledTypes(settings), [settings]);
  const units = useMemo(() => curriculum(enabledForms(settings), types), [settings, types]);

  const todaySec = log[day] ?? 0;
  const active = stage === 'intro' || stage === 'round';

  // 홈에 돌아올 때마다 학습일을 다시 본다 (자정·새벽 4시를 넘겨 켜둔 경우)
  useEffect(() => {
    if (stage === 'home') setDay(studyDay());
  }, [stage]);

  // 연습 중에만, 화면이 보일 때만 1초씩 센다
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setLog((prev) => {
        const next = addSeconds(prev, day, 1);
        saveTimeLog(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [active, day]);

  /** 다음 판을 준비한다: 들일 수 있으면 새 유닛 소개부터, 아니면 복습 판 */
  const startNext = useCallback(
    (s: ProgressStore) => {
      const unitsToday = loadUnitsToday(day);
      if (shouldIntroduce(s, pool, units, day, unitsToday)) {
        const nu = nextUnit(s, units)!;
        setPlan({ unit: nu.unit, fresh: nu.fresh, items: planRound(s, pool, day, nu.fresh) });
        setStage('intro');
      } else {
        const items = planRound(s, pool, day);
        if (items.length === 0) {
          setStage('home');
          return;
        }
        setPlan({ unit: null, fresh: [], items });
        setStage('round');
      }
      setRoundNo((n) => n + 1);
    },
    [day, pool, units],
  );

  const finishRound = useCallback(
    ({ session, firstMs }: RoundResult) => {
      if (!plan) return;
      const next = applyResults(store, session.firstTry, {
        day,
        slow: session.firstSlow,
        introduced: plan.fresh.map(itemId),
      });
      onStoreChange(next);
      // 소개만 보고 닫은 유닛은 세지 않는다 — 판을 끝내야 "들인" 것
      if (plan.fresh.length > 0) saveUnitsToday(day, loadUnitsToday(day) + 1);

      const ids = Object.keys(session.firstTry);
      const ok = ids.filter((id) => session.firstTry[id]).length;
      const fast = ids.filter((id) => session.firstTry[id] && !session.firstSlow[id]).length;
      const ms = Object.values(firstMs);
      const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
      setLastRound({ n: ids.length, ok, avg });
      setStats((st) => ({
        cards: st.cards + ids.length,
        firstOk: st.firstOk + ok,
        fast: st.fast + fast,
        ms: [...st.ms, ...ms],
        learned: [...st.learned, ...plan.fresh],
      }));
      const reached = (loadTimeLog()[day] ?? 0) >= DAILY_GOAL_SEC;
      setStage(reached && !extended ? 'done' : 'break');
    },
    [plan, store, day, onStoreChange, extended],
  );

  const close = useCallback(() => {
    setStage('home');
    setPlan(null);
  }, []);

  // 판 사이·끝 화면 키보드: Enter 계속, Esc 닫기
  useEffect(() => {
    if (stage === 'round' || stage === 'intro') {
      const h = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (stage === 'done') setExtended(true);
        startNext(store);
      } else if (e.key === 'Escape' && stage !== 'home') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [stage, store, startNext, close]);

  // ── 연습 화면 (폰 전체를 덮는다) ───────────────────────────
  if (stage === 'intro' && plan?.unit) {
    return (
      <DailyShell todaySec={todaySec} onClose={close}>
        <LessonIntro unit={plan.unit} fresh={plan.fresh} onDone={() => setStage('round')} />
      </DailyShell>
    );
  }

  if (stage === 'round' && plan) {
    return (
      <DailyShell todaySec={todaySec} onClose={close} aside={`${left}장`}>
        <RoundRunner
          key={roundNo}
          items={plan.items}
          allowedTypes={types}
          mode={mode}
          freshIds={plan.fresh.map(itemId)}
          onFinish={finishRound}
          onRemaining={setLeft}
        />
      </DailyShell>
    );
  }

  if (stage === 'break' && lastRound) {
    const remainSec = Math.max(0, DAILY_GOAL_SEC - todaySec);
    return (
      <DailyShell todaySec={todaySec} onClose={close}>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          <div>
            <div className="text-xs tracking-widest text-muted">한 판 끝</div>
            <div className="mt-2 font-display text-5xl text-ivory">
              {lastRound.ok}
              <span className="text-2xl text-muted">/{lastRound.n}</span>
            </div>
            <div className="mt-1 text-sm text-ivory-dim">
              첫 시도 정답{lastRound.avg > 0 ? ` · 평균 ${(lastRound.avg / 1000).toFixed(1)}초` : ''}
            </div>
          </div>
          <div className="text-sm text-muted">
            {remainSec > 0 ? `오늘 ${clock(remainSec)} 남음` : '오늘 15분 채움'}
          </div>
          <div className="mt-auto grid w-full grid-cols-[auto_1fr] gap-2">
            <button onClick={close} className="rounded-2xl border border-line px-6 py-4 text-ivory-dim active:bg-surface">
              그만
            </button>
            <button
              onClick={() => startNext(store)}
              className="rounded-2xl bg-brass py-4 font-display text-xl text-felt-deep active:opacity-80"
            >
              계속
            </button>
          </div>
        </div>
      </DailyShell>
    );
  }

  if (stage === 'done') {
    return (
      <DailyShell todaySec={todaySec} onClose={close}>
        <div className="flex flex-1 flex-col items-center gap-8 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          <div>
            <div className="text-xs tracking-widest text-brass">오늘 끝</div>
            <div className="mt-2 font-display text-5xl text-ivory">{Math.floor(todaySec / 60)}분</div>
          </div>
          <Week log={log} day={day} />
          <div className="grid w-full grid-cols-3 gap-2">
            <Stat label="카드" value={String(stats.cards)} />
            <Stat
              label="바로 맞힘"
              value={stats.cards ? `${Math.round((stats.fast / stats.cards) * 100)}%` : '–'}
            />
            <Stat
              label="평균 반응"
              value={stats.ms.length ? `${(stats.ms.reduce((a, b) => a + b, 0) / stats.ms.length / 1000).toFixed(1)}초` : '–'}
            />
          </div>
          {stats.learned.length > 0 && (
            <div>
              <div className="text-xs tracking-widest text-muted">오늘 배운 코드</div>
              <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 font-display text-lg text-ivory-dim">
                {stats.learned.map((it) => (
                  <span key={itemId(it)}>
                    {chordSymbol(ROOT_NAMES[it.rootPc], it.quality)}
                    <span className="font-body text-xs text-muted"> {it.form}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-auto grid w-full grid-cols-2 gap-2">
            <button
              onClick={() => {
                setExtended(true);
                startNext(store);
              }}
              className="rounded-2xl border border-line py-4 text-ivory-dim active:bg-surface"
            >
              한 판 더
            </button>
            <button onClick={close} className="rounded-2xl bg-brass py-4 font-display text-xl text-felt-deep active:opacity-80">
              닫기
            </button>
          </div>
        </div>
      </DailyShell>
    );
  }

  // ── 홈 ───────────────────────────────────────────────────
  const due = dueToday(store, pool, day).length;
  const nu = nextUnit(store, units);
  const date = dayToDate(day);
  const pct = Math.min(1, todaySec / DAILY_GOAL_SEC);
  const doneToday = todaySec >= DAILY_GOAL_SEC;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-7 px-4 py-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs tracking-widest text-muted">
            {date.getMonth() + 1}월 {date.getDate()}일 {DOW[(date.getDay() + 6) % 7]}요일
          </div>
          <div className="mt-1 font-display text-4xl text-ivory">오늘</div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl tabular-nums text-ivory">
            {Math.floor(todaySec / 60)}
            <span className="text-lg text-muted"> / 15분</span>
          </div>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-felt-deep">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct * 100}%` }} />
      </div>

      <Week log={log} day={day} />

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-felt-deep p-4">
        <Row label="복습" value={due > 0 ? `${due}장` : '없음'} />
        <Row
          label="새로"
          value={
            nu
              ? `${keyLabel(nu.unit.keyPc, nu.unit.type)} ii–V–${nu.unit.type === 'major' ? 'I' : 'i'} · ${nu.unit.form}형`
              : '코스 다 배움 — 복습만'
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => {
            setStats(EMPTY_STATS);
            setExtended(doneToday);
            startNext(store);
          }}
          className="rounded-2xl bg-brass py-5 font-display text-2xl text-felt-deep active:opacity-80"
        >
          {todaySec === 0 ? '시작' : doneToday ? '조금 더' : '이어 하기'}
        </button>
        <div className="flex items-center justify-center gap-3">
          <Seg
            options={['tap', 'piano'] as InputMode[]}
            labels={['화면 건반', '피아노']}
            value={mode}
            onChange={(m) => {
              setMode(m);
              saveInputMode(m);
            }}
          />
        </div>
        <p className="text-center text-xs text-muted">
          {mode === 'tap' ? '아래 음부터 차례로 누른다 · 늦으면 한 번 더' : '실제 피아노로 치고 정답을 본 뒤 스스로 매긴다'}
        </p>
      </div>

      <CourseMap store={store} units={units} next={nu?.unit ?? null} />

      {isIosBrowserTab() && (
        <p className="text-center text-xs text-muted">
          공유 버튼 → 홈 화면에 추가하면 앱처럼 열린다. 사파리와 홈 화면 앱은 진도를 따로 저장하니 한쪽만 쓰거나 진도 링크로 옮긴다.
        </p>
      )}

      {/* 배포 스크립트가 site-v1 태그의 옛 빌드를 ./v1/ 에 같이 올린다 */}
      <a href="./v1/" className="self-center text-xs text-muted underline-offset-4 hover:underline">
        이전 버전 (v1)
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-ivory-dim">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-felt-deep px-2 py-3">
      <div className="font-display text-2xl text-ivory">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

/** 이번 주 월~일. 채운 날은 꽉 찬 원, 조금 한 날은 채운 만큼 */
function Week({ log, day }: { log: TimeLog; day: string }) {
  return (
    <div className="grid grid-cols-7 gap-1" aria-label="이번 주 연습">
      {weekOf(day).map((d, i) => {
        const sec = log[d] ?? 0;
        const frac = Math.min(1, sec / DAILY_GOAL_SEC);
        const isToday = d === day;
        return (
          <div key={d} className="flex flex-col items-center gap-1.5">
            <span className={`text-[11px] ${isToday ? 'text-ivory' : 'text-muted'}`}>{DOW[i]}</span>
            <span
              className={`block h-7 w-7 rounded-full ${isToday ? 'ring-1 ring-ivory-dim ring-offset-2 ring-offset-felt' : ''}`}
              style={{
                background:
                  frac >= 1
                    ? 'var(--color-brass)'
                    : `conic-gradient(var(--color-brass) ${frac * 360}deg, var(--color-felt-deep) 0)`,
              }}
              title={`${Math.floor(sec / 60)}분`}
            />
          </div>
        );
      })}
    </div>
  );
}

const ROW_LABEL: Record<string, string> = {
  'A:major': 'A형 메이저',
  'A:minor': 'A형 마이너',
  'B:major': 'B형 메이저',
  'B:minor': 'B형 마이너',
};

/** 코스 지도: 폼×진행 네 줄 × 4도권 12키. 칸 = 유닛 (다 배움 / 일부 / 다음) */
function CourseMap({ store, units, next }: { store: ProgressStore; units: Unit[]; next: Unit | null }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs tracking-widest text-muted">코스</div>
      {UNIT_FORMS.flatMap((form) =>
        UNIT_TYPES.map((type) => {
          const row = FOURTHS_ORDER.map((k) => units.find((u) => u.form === form && u.type === type && u.keyPc === k));
          if (row.every((u) => !u)) return null;
          return (
            <div key={`${form}:${type}`}>
              <div className="mb-1 text-[11px] text-muted">{ROW_LABEL[`${form}:${type}`]}</div>
              <div className="grid grid-cols-12 gap-1">
                {row.map((u, i) => {
                  if (!u) return <span key={i} />;
                  const st = unitState(store, u);
                  const isNext = next === u;
                  return (
                    <span
                      key={i}
                      className={`flex h-7 items-center justify-center rounded-md text-[10px] ${
                        st === 'done'
                          ? 'bg-brass/80 text-felt-deep'
                          : st === 'partial'
                            ? 'bg-brass/30 text-ivory'
                            : isNext
                              ? 'border border-brass text-ivory'
                              : 'border border-line text-muted'
                      }`}
                    >
                      {toGlyphs(ROOT_NAMES[u.keyPc])}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
}
