import type { ReactNode } from 'react';
import { DAILY_GOAL_SEC } from '../state/day';
import { clock } from '../lib/clock';

type Props = {
  /** 오늘 누적 연습 시간(초) */
  todaySec: number;
  onClose: () => void;
  /** 오른쪽 위 작은 글씨 (남은 카드 등) */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * 오늘 연습 화면의 틀 — 폰 전체를 덮는다. 위: 닫기 · 오늘 15분 막대 · 보조 정보.
 * 노치·홈 인디케이터를 피해서 safe-area만큼 안쪽으로 들인다.
 */
export function DailyShell({ todaySec, onClose, aside, children }: Props) {
  const pct = Math.min(100, (todaySec / DAILY_GOAL_SEC) * 100);
  return (
    <div className="daily-shell fixed inset-0 z-40 flex flex-col overflow-y-auto bg-felt">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
        <div className="flex items-center gap-3 py-3">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-muted hover:text-ivory"
          >
            ×
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-felt-deep" aria-label="오늘 연습 시간">
            <div className="h-full rounded-full bg-brass transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="min-w-12 text-right text-xs tabular-nums text-muted">{aside ?? clock(todaySec)}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
