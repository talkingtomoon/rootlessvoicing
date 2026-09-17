import { useEffect, useMemo, useRef, useState } from 'react';
import { toGlyphs } from '../engine/spelling';
import { NARROW, useMediaQuery } from '../lib/useMediaQuery';

export type KeyHighlight = {
  midi: number;
  /** 도수 라벨 (ASCII, 'b3' 등) — 건반 위에 표시 */
  label?: string;
  /** answer = 크림슨 펠트, user = 브라스 (Phase 3에서 오답 표시용) */
  kind?: 'answer' | 'user';
};

type Props = {
  from?: number;
  to?: number;
  highlights?: KeyHighlight[];
  onKeyPress?: (midi: number) => void;
  /** false면 좁은 화면에서도 페이징하지 않고 범위 전체를 한 번에 그린다 (짧은 범위 전용) */
  paged?: boolean;
};

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
/** 실제 건반처럼 흑건을 살짝 비대칭으로 배치 */
const BLACK_OFFSET: Record<number, number> = { 1: -4, 3: 4, 6: -5, 8: 0, 10: 5 };

const WW = 46; // 백건 폭
const WH = 184; // 백건 높이
const BW = 27; // 흑건 폭
const BH = 116; // 흑건 높이
const FELT = 7; // 건반 위 펠트 스트립 높이

type KeyGeom = { midi: number; black: boolean; x: number };

function buildKeys(from: number, to: number): { keys: KeyGeom[]; width: number } {
  const keys: KeyGeom[] = [];
  let wIdx = 0;
  for (let m = from; m <= to; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (WHITE_PCS.includes(pc)) {
      keys.push({ midi: m, black: false, x: wIdx * WW });
      wIdx++;
    } else {
      keys.push({ midi: m, black: true, x: wIdx * WW - BW / 2 + BLACK_OFFSET[pc] });
    }
  }
  return { keys, width: wIdx * WW };
}

/** 좁은 화면에서 한 번에 보여줄 반음 수 (한 옥타브 + 위 C) */
const PAGE_SPAN = 12;

/** 기본 범위 F2–C5 = 채점 허용 범위(GRADE_MIN..GRADE_MAX)와 정확히 일치시킨다 */
export function Keyboard({ from = 41, to = 72, highlights = [], onKeyPress, paged = true }: Props) {
  const [pressed, setPressed] = useState<number | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrow = useMediaQuery(NARROW) && paged;

  // 모바일 세로: 스크롤 대신 한 옥타브씩 페이징한다 (스펙 §8)
  const maxAnchor = to - PAGE_SPAN;
  const [anchor, setAnchor] = useState(() => Math.min(48, maxAnchor));

  const [lo, hi] = useMemo(() => {
    if (highlights.length === 0) return [null, null] as const;
    const ms = highlights.map((h) => h.midi);
    return [Math.min(...ms), Math.max(...ms)] as const;
  }, [highlights]);

  // 하이라이트가 바뀌었을 때만 창을 옮긴다 — 답이 안 보이는 일은 없게 하되,
  // 사용자가 직접 넘긴 페이지를 매 렌더마다 되돌리지는 않는다
  const followed = useRef('');
  useEffect(() => {
    if (!narrow || lo === null || hi === null) return;
    const key = `${lo}:${hi}`;
    if (followed.current === key) return;
    followed.current = key;
    if (lo >= anchor && hi <= anchor + PAGE_SPAN) return;
    const want = hi - lo <= PAGE_SPAN ? lo : hi - PAGE_SPAN;
    setAnchor(Math.max(from, Math.min(want, maxAnchor)));
  }, [narrow, lo, hi, anchor, from, maxAnchor]);

  const visFrom = narrow ? anchor : from;
  const visTo = narrow ? Math.min(anchor + PAGE_SPAN, to) : to;
  const { keys, width } = useMemo(() => buildKeys(visFrom, visTo), [visFrom, visTo]);

  const hlMap = new Map(highlights.map((h) => [h.midi, h]));

  function press(midi: number) {
    setPressed(midi);
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => setPressed(null), 130);
    onKeyPress?.(midi);
  }

  function keyFill(k: KeyGeom): string {
    const hl = hlMap.get(k.midi);
    if (!hl) return k.black ? 'var(--color-ebony)' : 'var(--color-ivory)';
    if (hl.kind === 'user') return 'var(--color-brass)';
    return k.black ? 'var(--color-crimson-deep)' : 'var(--color-crimson)';
  }

  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);

  const octaveLabel = `${['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][visFrom % 12]}${Math.floor(visFrom / 12) - 1}`;

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${FELT + WH + 4}`}
        className="w-full select-none"
        role="group"
        aria-label="건반"
      >
      {/* 해머 펠트 스트립 — 건반 위 빨간 띠 */}
      <rect x={0} y={0} width={width} height={FELT} fill="var(--color-crimson-deep)" />
      <rect x={0} y={FELT - 1.5} width={width} height={1.5} fill="#00000055" />

      {whites.map((k) => {
        const hl = hlMap.get(k.midi);
        return (
          <g
            key={k.midi}
            className={`piano-key ${pressed === k.midi ? 'pressed' : ''}`}
            onPointerDown={() => press(k.midi)}
          >
            <rect
              x={k.x + 0.75}
              y={FELT}
              width={WW - 1.5}
              height={WH}
              rx={3.5}
              fill={keyFill(k)}
              stroke="var(--color-felt-deep)"
              strokeWidth={1.5}
            />
            {hl?.label && (
              <>
                <circle cx={k.x + WW / 2} cy={FELT + WH - 26} r={12.5} fill="var(--color-felt-deep)" />
                <text
                  x={k.x + WW / 2}
                  y={FELT + WH - 21.5}
                  textAnchor="middle"
                  fontSize={12}
                  fontFamily="var(--font-body)"
                  fill="var(--color-ivory)"
                >
                  {toGlyphs(hl.label)}
                </text>
              </>
            )}
          </g>
        );
      })}

      {blacks.map((k) => {
        const hl = hlMap.get(k.midi);
        return (
          <g
            key={k.midi}
            className={`piano-key ${pressed === k.midi ? 'pressed' : ''}`}
            onPointerDown={() => press(k.midi)}
          >
            <rect
              x={k.x}
              y={FELT}
              width={BW}
              height={BH}
              rx={3}
              fill={keyFill(k)}
              stroke="var(--color-felt-deep)"
              strokeWidth={1.5}
            />
            {/* 에보니 윗면 하이라이트 */}
            {!hl && <rect x={k.x + 4} y={FELT + 6} width={BW - 8} height={3} rx={1.5} fill="#ffffff14" />}
            {hl?.label && (
              <>
                <circle cx={k.x + BW / 2} cy={FELT + BH - 18} r={10.5} fill="var(--color-ivory)" />
                <text
                  x={k.x + BW / 2}
                  y={FELT + BH - 14}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontFamily="var(--font-body)"
                  fill="var(--color-felt-deep)"
                >
                  {toGlyphs(hl.label)}
                </text>
              </>
            )}
          </g>
        );
      })}
      </svg>

      {/* 모바일: 스크롤 대신 한 옥타브씩 넘긴다 */}
      {narrow && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setAnchor((a) => Math.max(from, a - 12))}
            disabled={anchor <= from}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ivory-dim disabled:opacity-30"
            aria-label="한 옥타브 아래"
          >
            ‹
          </button>
          <span className="text-xs tracking-widest text-muted">{octaveLabel}부터</span>
          <button
            onClick={() => setAnchor((a) => Math.min(maxAnchor, a + 12))}
            disabled={anchor >= maxAnchor}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ivory-dim disabled:opacity-30"
            aria-label="한 옥타브 위"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
