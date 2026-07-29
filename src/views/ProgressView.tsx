import { allItems } from '../engine/items';
import { Heatmap, HeatmapLegend } from '../components/Heatmap';
import { levelOf, type ProgressStore } from '../state/progress';

/** 진도 대시보드 — 히트맵 두 장이 전부다. 그래프 없음. */
export function ProgressView({ store }: { store: ProgressStore }) {
  const learned = allItems().filter((it) => levelOf(store, it) !== null).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
      <div className="text-center">
        <div className="text-xs tracking-widest text-muted">
          세션 {store.session}회 · 학습 {learned}/120
        </div>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-8 sm:max-w-none sm:grid-cols-2">
        <Heatmap form="A" store={store} />
        <Heatmap form="B" store={store} />
      </div>

      <HeatmapLegend />
    </div>
  );
}
