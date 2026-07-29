import type { ChordQuality, Form, Voicing } from './types';

export const QUALITIES: ChordQuality[] = ['m7', 'dom7', 'maj7', 'm7b5', 'dom7b9'];

/** A형만 소스 데이터. B형은 getVoicing에서 파생한다. */
const A_FORMS: Record<ChordQuality, { intervals: number[]; degrees: string[] }> = {
  m7: { intervals: [3, 7, 10, 14], degrees: ['b3', '5', 'b7', '9'] },
  dom7: { intervals: [10, 14, 16, 21], degrees: ['b7', '9', '3', '13'] },
  maj7: { intervals: [4, 7, 11, 14], degrees: ['3', '5', '7', '9'] },
  m7b5: { intervals: [3, 6, 10, 12], degrees: ['b3', 'b5', 'b7', '1'] },
  dom7b9: { intervals: [10, 13, 16, 19], degrees: ['b7', 'b9', '3', '5'] },
};

export function getVoicing(quality: ChordQuality, form: Form): Voicing {
  const a = A_FORMS[quality];
  if (form === 'A') {
    return { quality, form, intervals: [...a.intervals], degrees: [...a.degrees] };
  }
  // B형 = A형의 위 두 성부를 한 옥타브 내려 아래에 놓은 것.
  // 간격 표기는 루트 기준 양수를 유지하기 위해 전체를 +12 정규화한다:
  // [v1,v2,v3,v4] → [v3-12, v4-12, v1, v2] → +12 → [v3, v4, v1+12, v2+12]
  const [v1, v2, v3, v4] = a.intervals;
  const [d1, d2, d3, d4] = a.degrees;
  return {
    quality,
    form,
    intervals: [v3, v4, v1 + 12, v2 + 12],
    degrees: [d3, d4, d1, d2],
  };
}
