import { useState } from 'react';
import { allItems } from '../engine/items';
import { Heatmap, HeatmapLegend } from '../components/Heatmap';
import { levelOf, type ProgressStore } from '../state/progress';
import { progressLink } from '../state/progressCode';

function learnedCount(store: ProgressStore): number {
  return allItems().filter((it) => levelOf(store, it) !== null).length;
}

type Props = {
  store: ProgressStore;
  /** 주소로 실려온 진도 — 사용자가 확인해야 적용된다 */
  incoming: ProgressStore | null;
  onAcceptIncoming: () => void;
  onDismissIncoming: () => void;
};

/** 진도 대시보드 — 히트맵 두 장이 전부다. 그래프 없음. */
export function ProgressView({ store, incoming, onAcceptIncoming, onDismissIncoming }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const link = progressLink(store);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // 클립보드가 막힌 환경에서는 주소창에라도 남겨준다
      prompt('이 링크를 다른 기기에서 열어라', link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
      {/* 가져오기 확인 — 덮어쓰기 전에 양쪽을 보여준다 */}
      {incoming && (
        <div className="w-full rounded-xl border border-brass bg-felt-deep p-4">
          <div className="text-sm text-ivory">다른 기기의 진도를 가져올까?</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <span>
              지금 이 기기 — 세션 {store.session}회 · 학습 {learnedCount(store)}/120
            </span>
            <span className="text-ivory-dim">
              가져올 것 — 세션 {incoming.session}회 · 학습 {learnedCount(incoming)}/120
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onAcceptIncoming}
              className="rounded-full border border-brass px-4 py-1.5 text-sm text-ivory hover:bg-surface"
            >
              가져오기 (이 기기 진도는 덮어씀)
            </button>
            <button
              onClick={onDismissIncoming}
              className="rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:text-ivory-dim"
            >
              그대로 두기
            </button>
          </div>
        </div>
      )}

      <div className="text-center">
        <div className="text-xs tracking-widest text-muted">
          세션 {store.session}회 · 학습 {learnedCount(store)}/120
        </div>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-8 sm:max-w-none sm:grid-cols-2">
        <Heatmap form="A" store={store} />
        <Heatmap form="B" store={store} />
      </div>

      <HeatmapLegend />

      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={copyLink}
          className="rounded-full border border-line px-5 py-2 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
        >
          {copied ? '복사했어' : '진도 링크 복사'}
        </button>
        <span className="text-[11px] text-muted">다른 기기에서 그 링크를 열면 진도가 옮겨간다</span>
      </div>
    </div>
  );
}
