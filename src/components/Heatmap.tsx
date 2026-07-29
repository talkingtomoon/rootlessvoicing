import { Fragment } from 'react';
import type { Form } from '../engine/types';
import { QUALITIES } from '../engine/voicings';
import { QUALITY_SYMBOL } from '../engine/format';
import { ROOT_NAMES, toGlyphs } from '../engine/spelling';
import { levelOf, MAX_LEVEL, type ProgressStore } from '../state/progress';

/** 단계별 칸 색 — 농도만 올린다 (미학습은 빈 칸) */
export const LEVEL_FILL = [
  'rgba(201,169,110,0.16)',
  'rgba(201,169,110,0.34)',
  'rgba(201,169,110,0.52)',
  'rgba(201,169,110,0.72)',
  'rgba(201,169,110,0.95)',
];

function cellStyle(level: number | null) {
  if (level === null) return { background: 'transparent', borderColor: 'var(--color-line)' };
  return { background: LEVEL_FILL[level - 1], borderColor: 'transparent' };
}

/** 12루트 × 5quality 격자 한 장. 칸 색 농도 = 단계. */
export function Heatmap({ form, store }: { form: Form; store: ProgressStore }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs tracking-widest text-muted">{form}형</div>
      <div className="grid grid-cols-[2.2rem_repeat(5,1fr)] gap-1">
        <div />
        {QUALITIES.map((q) => (
          <div key={q} className="pb-0.5 text-center text-[10px] leading-tight text-muted">
            {toGlyphs(QUALITY_SYMBOL[q])}
          </div>
        ))}
        {ROOT_NAMES.map((name, rootPc) => (
          <Fragment key={rootPc}>
            <div className="pr-1 text-right text-[11px] leading-6 text-muted">{toGlyphs(name)}</div>
            {QUALITIES.map((quality) => {
              const level = levelOf(store, { rootPc, quality, form });
              return (
                <div
                  key={quality}
                  title={`${toGlyphs(name + QUALITY_SYMBOL[quality])} ${form}형 · ${
                    level === null ? '미학습' : `단계 ${level}`
                  }`}
                  className="h-6 rounded-sm border"
                  style={cellStyle(level)}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** 단계 농도 범례 */
export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted">
      <span>미학습</span>
      <div className="h-3.5 w-5 rounded-sm border border-line" />
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <div key={i} className="h-3.5 w-5 rounded-sm" style={{ background: LEVEL_FILL[i] }} />
      ))}
      <span>단계 {MAX_LEVEL}</span>
    </div>
  );
}
