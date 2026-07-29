import type { ChordQuality, Form, NoteName, ProgressionType } from './types';
import { getVoicing } from './voicings';
import { placeVoicing } from './placement';
import { keyName, notePc, spellInterval, spellVoicing } from './spelling';

export type ProgressionSlot = {
  roman: string;
  /** 키 루트로부터의 도수 ('1', '2', '5') — 코드 루트 철자 계산용 */
  rootDegree: string;
  /** 키 루트로부터의 반음 수 */
  rootOffset: number;
  quality: ChordQuality;
};

export const PROGRESSIONS: Record<ProgressionType, ProgressionSlot[]> = {
  major: [
    { roman: 'ii', rootDegree: '2', rootOffset: 2, quality: 'm7' },
    { roman: 'V', rootDegree: '5', rootOffset: 7, quality: 'dom7' },
    { roman: 'I', rootDegree: '1', rootOffset: 0, quality: 'maj7' },
  ],
  minor: [
    { roman: 'ii∅', rootDegree: '2', rootOffset: 2, quality: 'm7b5' },
    { roman: 'V', rootDegree: '5', rootOffset: 7, quality: 'dom7b9' },
    // 마이너 i는 9음을 품지만 표기는 m7로 통일한다 (메이저 ii와 같은 라벨)
    { roman: 'i', rootDegree: '1', rootOffset: 0, quality: 'm7' },
  ],
};

export type ProgressionChord = {
  roman: string;
  quality: ChordQuality;
  form: Form;
  rootName: NoteName;
  rootPc: number;
  /** 낮은 성부부터, canonical 배치 */
  midi: number[];
  /** midi와 같은 순서의 음이름 */
  noteNames: NoteName[];
  /** midi와 같은 순서의 도수 라벨 */
  degrees: string[];
};

/** 키 이름 기준으로 ii–V–I 세 코드를 철자·canonical 배치까지 계산 */
export function buildProgression(keyPc: number, type: ProgressionType, form: Form): ProgressionChord[] {
  const key = keyName(keyPc, type);
  return PROGRESSIONS[type].map((slot) => {
    const rootName = spellInterval(key, slot.rootDegree, slot.rootOffset);
    const voicing = getVoicing(slot.quality, form);
    return {
      roman: slot.roman,
      quality: slot.quality,
      form,
      rootName,
      rootPc: notePc(rootName),
      midi: placeVoicing(notePc(rootName), voicing),
      noteNames: spellVoicing(rootName, voicing),
      degrees: [...voicing.degrees],
    };
  });
}

/**
 * 순차 재생용 배치. 첫 코드는 canonical, 이후 코드는 ±1 옥타브 후보 중
 * 직전 코드와의 총 이동량이 최소인 배치를 고른다.
 * (경계 키에서 canonical끼리는 옥타브 점프가 생길 수 있어서 재생용만 보정)
 */
export function placeProgression(keyPc: number, type: ProgressionType, form: Form): number[][] {
  const canonical = PROGRESSIONS[type].map((slot) =>
    placeVoicing((keyPc + slot.rootOffset) % 12, getVoicing(slot.quality, form)),
  );
  const placed: number[][] = [canonical[0]];
  for (let i = 1; i < canonical.length; i++) {
    const prev = placed[i - 1];
    let best = canonical[i];
    let bestCost = Infinity;
    for (const shift of [-12, 0, 12]) {
      const cand = canonical[i].map((n) => n + shift);
      const cost = cand.reduce((sum, n, j) => sum + Math.abs(n - prev[j]), 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = cand;
      }
    }
    placed.push(best);
  }
  return placed;
}
