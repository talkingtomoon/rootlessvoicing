import { useState } from 'react';
import { allItems } from '../engine/items';
import { DrillRunner } from '../components/DrillRunner';
import { drawSessionItems, SESSION_SIZES } from '../session/session';
import { loadLastSessionSize, saveLastSessionSize } from '../state/prefs';

/** 전체 120개에서 N장 뽑아 도는 모드. 출제는 완전 랜덤 — 진행 단위로 묶지 않는다. */
export function MemorizeView() {
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(loadLastSessionSize);

  if (running) {
    return (
      <DrillRunner
        draw={() => drawSessionItems(allItems(), n, Math.random)}
        onExit={() => setRunning(false)}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-16">
      <div className="text-center">
        <div className="text-xs tracking-widest text-muted">암기 세션</div>
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
    </div>
  );
}
