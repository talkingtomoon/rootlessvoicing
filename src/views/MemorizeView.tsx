import { useState } from 'react';
import type { Form } from '../engine/types';
import { allItems, itemsOf } from '../engine/items';
import { QUALITIES } from '../engine/voicings';
import { QUALITY_SYMBOL } from '../engine/format';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { DrillRunner } from '../components/DrillRunner';
import { Seg } from '../components/Seg';
import { drawSessionItems, SESSION_SIZES } from '../session/session';
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

/**
 * 테스트. 두 갈래 모두 같은 보관함 루프(DrillRunner)를 쓰고, 어떤 item을 낼지만 다르다.
 * - 전체: 120개에서 N장 랜덤 (진행 단위로 묶지 않는다)
 * - 타입별: quality × form 하나의 12루트 한 바퀴
 */
export function MemorizeView() {
  const [mode, setMode] = useState<MemorizeMode>(loadLastMemorizeMode);
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(loadLastSessionSize);
  const [quality, setQuality] = useState(loadLastQuality);
  const [form, setForm] = useState<Form>(loadLastForm);

  if (running) {
    return (
      <DrillRunner
        draw={
          mode === 'all'
            ? () => drawSessionItems(allItems(), n, Math.random)
            : () => itemsOf(quality, form)
        }
        onExit={() => setRunning(false)}
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
            {SESSION_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => {
                  saveLastSessionSize(size);
                  setN(size);
                  setRunning(true);
                }}
                className={`h-20 w-20 rounded-xl border font-display text-2xl transition-colors ${
                  size === n
                    ? 'border-brass bg-surface text-ivory'
                    : 'border-line bg-felt-deep text-ivory-dim hover:border-muted'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">한 세션은 뽑은 카드가 보관함까지 다 비면 끝난다</p>
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
            12장 시작
          </button>
        </>
      )}
    </div>
  );
}
