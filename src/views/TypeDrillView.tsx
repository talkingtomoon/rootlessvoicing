import { useState } from 'react';
import type { Form } from '../engine/types';
import { itemsOf } from '../engine/items';
import { QUALITIES } from '../engine/voicings';
import { QUALITY_SYMBOL } from '../engine/format';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { DrillRunner } from '../components/DrillRunner';
import { loadLastForm, loadLastQuality, saveLastForm, saveLastQuality } from '../state/prefs';

/** quality × form 하나를 골라 그 12루트만 도는 모드. 한 종류를 12키에 걸쳐 굳힐 때 쓴다. */
export function TypeDrillView() {
  const [running, setRunning] = useState(false);
  const [quality, setQuality] = useState(loadLastQuality);
  const [form, setForm] = useState<Form>(loadLastForm);

  if (running) {
    return <DrillRunner draw={() => itemsOf(quality, form)} onExit={() => setRunning(false)} />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 py-12">
      <div className="text-center">
        <div className="text-xs tracking-widest text-muted">타입별 · 12키 한 바퀴</div>
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

      {/* 이번에 낼 12장 미리보기 — 무엇을 도는지 눈으로 확인하고 시작 */}
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
    </div>
  );
}
