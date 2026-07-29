import { useMemo, useRef, useState } from 'react';
import { toGlyphs } from '../engine/spelling';

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

/** 기본 범위 F2–C5 = 채점 허용 범위(GRADE_MIN..GRADE_MAX)와 정확히 일치시킨다 */
export function Keyboard({ from = 41, to = 72, highlights = [], onKeyPress }: Props) {
  const { keys, width } = useMemo(() => buildKeys(from, to), [from, to]);
  const [pressed, setPressed] = useState<number | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
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
  );
}
