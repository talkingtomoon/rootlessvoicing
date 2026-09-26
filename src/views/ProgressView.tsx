import { useState } from 'react';
import { allItems } from '../engine/items';
import { Heatmap, HeatmapLegend } from '../components/Heatmap';
import { levelOf, mergeSummary, type ProgressStore } from '../state/progress';
import { parsePasted, progressLink } from '../state/progressCode';

function learnedCount(store: ProgressStore): number {
  return allItems().filter((it) => levelOf(store, it) !== null).length;
}

type Props = {
  store: ProgressStore;
  /** 주소로 실려온 진도 — 사용자가 확인해야 적용된다 */
  incoming: ProgressStore | null;
  onAcceptIncoming: () => void;
  /** 합치기 — 항목별로 높은 단계를 쓰고 더 밀린 날짜를 쓴다 */
  onMergeIncoming: () => void;
  onDismissIncoming: () => void;
  /** 붙여넣기로 읽은 진도 — 확인 절차는 incoming과 같다 */
  onPasted: (store: ProgressStore) => void;
};

/** 진도 대시보드 — 히트맵 두 장이 전부다. 그래프 없음. */
export function ProgressView({
  store,
  incoming,
  onAcceptIncoming,
  onMergeIncoming,
  onDismissIncoming,
  onPasted,
}: Props) {
  const [copied, setCopied] = useState(false);
  /** 클립보드가 막힌 환경(권한 거부 등)에서 직접 집어갈 수 있게 링크를 드러낸다 */
  const [shownLink, setShownLink] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState(false);

  function tryPaste(text: string) {
    if (!text.trim()) return;
    const parsed = parsePasted(text);
    if (!parsed) {
      setPasteError(true);
      return;
    }
    setPasteError(false);
    setPasting(false);
    onPasted(parsed);
  }

  async function copyLink() {
    const link = progressLink(store);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setShownLink(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShownLink(link);
    }
  }

  const merge = incoming ? mergeSummary(store, incoming) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
      {/* 가져오기 확인 — 덮어쓰기 전에 양쪽을 보여준다 */}
      {incoming && merge && (
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
          <div className="mt-3 flex flex-wrap gap-2">
            {/* 기본은 합치기 — 덮어쓰기는 이 기기 진도를 버리는 것이라 옆에 둔다 */}
            <button
              onClick={onMergeIncoming}
              className="rounded-full border border-brass px-4 py-1.5 text-sm text-ivory hover:bg-surface"
            >
              합치기 (학습 {merge.total}/120
              {merge.added > 0 ? ` · +${merge.added}개` : ''}
              {merge.raised > 0 ? ` · ${merge.raised}개 단계↑` : ''})
            </button>
            <button
              onClick={onAcceptIncoming}
              className="rounded-full border border-line px-4 py-1.5 text-sm text-ivory-dim hover:border-muted"
            >
              덮어쓰기
            </button>
            <button
              onClick={onDismissIncoming}
              className="rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:text-ivory-dim"
            >
              그대로 두기
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            합치기는 항목마다 더 높은 단계를 쓰고, 복습은 더 밀린 쪽에 맞춘다. 연습 시간 기록은 기기별로 남는다.
          </p>
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

      <div className="flex w-full max-w-md flex-col items-center gap-1.5">
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="rounded-full border border-line px-5 py-2 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
          >
            {copied ? '복사했어' : '진도 링크 복사'}
          </button>
          <button
            onClick={() => {
              setPasting((v) => !v);
              setPasteError(false);
            }}
            className="rounded-full border border-line px-5 py-2 text-sm text-ivory-dim hover:border-brass hover:text-ivory"
          >
            링크 붙여넣기
          </button>
        </div>
        <span className="text-[11px] text-muted">다른 기기에서 그 링크를 열면 진도가 옮겨간다</span>

        {/* 출처가 다른 링크(로컬 → 배포본)는 클릭으로 못 옮기니 붙여넣기로 받는다 */}
        {pasting && (
          <input
            autoFocus
            placeholder="진도 링크나 코드를 붙여넣어라"
            onPaste={(e) => tryPaste(e.clipboardData.getData('text'))}
            onChange={(e) => tryPaste(e.currentTarget.value)}
            className="mt-1 w-full rounded-md border border-line bg-felt-deep px-2 py-1.5 text-[11px] text-ivory-dim"
            aria-label="진도 링크 붙여넣기"
          />
        )}
        {pasteError && <span className="text-[11px] text-muted">읽을 수 없는 코드다</span>}
        {shownLink && (
          <input
            readOnly
            value={shownLink}
            onFocus={(e) => e.currentTarget.select()}
            ref={(el) => el?.select()}
            className="mt-1 w-full max-w-md rounded-md border border-line bg-felt-deep px-2 py-1 text-[11px] text-ivory-dim"
            aria-label="진도 링크"
          />
        )}
      </div>
    </div>
  );
}
