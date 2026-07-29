import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Form } from '../engine/types';
import { itemsOf } from '../engine/items';
import { selectItems, type ProgressStore } from '../state/progress';
import { enabledItems, enabledTypes, type Settings } from '../state/settings';
import { QUALITIES } from '../engine/voicings';
import { QUALITY_SYMBOL } from '../engine/format';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { DrillRunner } from '../components/DrillRunner';
import { Seg } from '../components/Seg';
import { SESSION_SIZES } from '../session/session';
import {
  loadLastForm,
  loadLastMemorizeMode,
  loadLastQuality,
  loadLastSessionSize,
  saveLastForm,
  saveLastMemorizeMode,
  saveLastQuality,
  saveLastSessionSize,
} from '../state/prefs';

export type MemorizeMode = 'all' | 'type';

type Props = {
  store: ProgressStore;
  onFinish: (firstTry: Record<string, boolean>) => void;
  settings: Settings;
};

/**
 * 테스트. 두 갈래 모두 같은 보관함 루프(DrillRunner)를 쓰고, 어떤 item을 낼지만 다르다.
 * - 전체: Leitner 우선순위로 N장 (간격 지난 것 → 신규 → 단계 낮은 순)
 * - 타입별: quality × form 하나의 12루트 한 바퀴 (선정 규칙을 건너뛰는 직접 지정)
 */
export function MemorizeView({ store, onFinish, settings }: Props) {
  const [mode, setMode] = useState<MemorizeMode>(loadLastMemorizeMode);
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(loadLastSessionSize);
  const [quality, setQuality] = useState(loadLastQuality);
  const [form, setForm] = useState<Form>(loadLastForm);

  // '전체'가 뽑는 풀은 설정(진행·폼)이 정한다. '타입별'은 직접 지정이라 설정을 타지 않는다.
  const pool = useMemo(() => enabledItems(settings), [settings]);
  const types = useMemo(() => enabledTypes(settings), [settings]);

  // 초반에는 신규 상한 때문에 N보다 적게 뽑힌다 — 크기별로 실제 몇 장 나올지 미리 보여준다
  const counts = useMemo(() => {
    const m: Record<number, number> = {};
    for (const size of SESSION_SIZES) {
      m[size] = selectItems(store, pool, size, Math.random).length;
    }
    return m;
  }, [store, pool]);
  const anyCapped = SESSION_SIZES.some((size) => counts[size] < size);

  const start = useCallback((size: number) => {
    saveLastSessionSize(size);
    setN(size);
    setRunning(true);
  }, []);

  // 시작 화면도 키보드만으로: 1~4 = 세션 크기, Enter = 마지막 크기 / 타입별 시작
  useEffect(() => {
    if (running) return;
    const h = (e: KeyboardEvent) => {
      if (mode === 'type') {
        if (e.key === 'Enter') {
          e.preventDefault();
          setRunning(true);
        }
        return;
      }
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        start(SESSION_SIZES[idx]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        start(n);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [running, mode, n, start]);

  if (running) {
    return (
      <DrillRunner
        draw={
          mode === 'all'
            ? () => selectItems(store, pool, n, Math.random)
            : () => itemsOf(quality, form)
        }
        allowedTypes={types}
        onExit={() => setRunning(false)}
        onFinish={onFinish}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 py-10">
      <Seg
        options={['all', 'type'] as MemorizeMode[]}
        labels={['전체', '타입별']}
        value={mode}
        onChange={(m) => {
          setMode(m);
          saveLastMemorizeMode(m);
        }}
      />

      {mode === 'all' ? (
        <>
          <div className="text-center">
            <div className="text-xs tracking-widest text-muted">120개에서 랜덤</div>
            <h2 className="mt-1 font-display text-3xl text-ivory">몇 장 돌릴까</h2>
          </div>
          <div className="flex gap-3">
            {SESSION_SIZES.map((size, i) => (
              <button
                key={size}
                onClick={() => start(size)}
                title={`단축키 ${i + 1}`}
                className={`flex h-20 w-20 flex-col items-center justify-center rounded-xl border font-display text-2xl transition-colors ${
                  size === n
                    ? 'border-brass bg-surface text-ivory'
                    : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
                }`}
              >
                {size}
                {counts[size] < size && (
                  <span className="font-body text-[11px] text-muted">→ {counts[size]}장</span>
                )}
              </button>
            ))}
          </div>
          <p className="max-w-sm text-center text-sm text-muted">
            {anyCapped
              ? '신규는 한 세션에 6장까지만 섞는다 — 세션을 거듭하면 늘어난다'
              : '한 세션은 뽑은 카드가 보관함까지 다 비면 끝난다'}
          </p>
        </>
      ) : (
        <>
          <div className="text-center">
            <div className="text-xs tracking-widest text-muted">12키 한 바퀴</div>
            <h2 className="mt-1 font-display text-3xl text-ivory">뭘 굳힐까</h2>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuality(q);
                  saveLastQuality(q);
                }}
                className={`rounded-xl border px-5 py-3 font-display text-xl transition-colors ${
                  q === quality
                    ? 'border-brass bg-surface text-ivory'
                    : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
                }`}
              >
                {toGlyphs(QUALITY_SYMBOL[q])}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(['A', 'B'] as Form[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setForm(f);
                  saveLastForm(f);
                }}
                className={`rounded-lg border px-6 py-2 transition-colors ${
                  f === form
                    ? 'border-brass bg-surface text-ivory'
                    : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
                }`}
              >
                {f}형
              </button>
            ))}
          </div>

          {/* 이번에 낼 12장 미리보기 */}
          <div className="flex max-w-lg flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-muted">
            {ROOT_NAMES.map((name) => (
              <span key={name}>{toGlyphs(name + QUALITY_SYMBOL[quality])}</span>
            ))}
          </div>

          <button
            onClick={() => setRunning(true)}
            className="rounded-full border border-brass px-8 py-3 font-display text-xl text-ivory hover:bg-surface"
          >
            12장 시작 <kbd className="font-body text-sm text-muted">Enter</kbd>
          </button>
        </>
      )}
    </div>
  );
}
