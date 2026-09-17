import type { ChordQuality, Form, ProgressionType } from './types';
import { getVoicing } from './voicings';
import { buildProgression, placeProgression, PROGRESSIONS } from './progressions';
import { buildChord } from './chord';
import { notePc, ROOT_NAMES, toGlyphs } from './spelling';
import { chordSymbol } from './format';

/**
 * 외울 때 기대는 연결 고리. 음악 계산이라 UI가 아니라 여기서 한다.
 * - 모양: 성부 사이 반음 간격 — quality × form이 같으면 12키 모두 같다
 * - 진행 연결: ii→V, V→I에서 각 성부가 어디로 가는지 (placeProgression의 보이스리딩 그대로)
 * - 형제: 같은 루트의 m7→m7♭5, 7→7♭9 (메이저 → 마이너), 같은 코드의 A형→B형
 */

/** 성부 사이 간격(반음), 아래부터. 예: m7 A형 = [4, 3, 4] */
export function shapeGaps(quality: ChordQuality, form: Form): number[] {
  const iv = getVoicing(quality, form).intervals;
  return iv.slice(1).map((v, i) => v - iv[i]);
}

/** 맨 아래 성부의 도수 (ASCII) */
export function bottomDegree(quality: ChordQuality, form: Form): string {
  return getVoicing(quality, form).degrees[0];
}

export type VoiceMove = {
  /** 음이름 ASCII */
  from: string;
  to: string;
  /** 반음, 음수 = 내려감 */
  delta: number;
};

/** 두 코드의 성부별 이동 (같은 인덱스끼리 짝) */
function pairMoves(fromNames: string[], fromMidi: number[], toNames: string[], toMidi: number[]): VoiceMove[] {
  return fromMidi.map((m, i) => ({ from: fromNames[i], to: toNames[i], delta: toMidi[i] - m }));
}

export type LinkKind = 'prev' | 'next' | 'sibling' | 'formA';

export type Link = {
  kind: LinkKind;
  /** prev/sibling/formA: 출발 코드, next: 도착 코드 (표시용 글리프) */
  otherSymbol: string;
  /** 항상 "앞 코드 → 뒤 코드" 방향 */
  moves: VoiceMove[];
};

/**
 * 진행 안에서 slotIdx 코드와 이웃 코드의 연결.
 * prev = 앞 코드에서 이 코드로, next = 이 코드에서 다음 코드로.
 */
export function progressionLinks(keyPc: number, type: ProgressionType, form: Form, slotIdx: number): Link[] {
  const chords = buildProgression(keyPc, type, form);
  const placed = placeProgression(keyPc, type, form);
  const sym = (i: number) => chordSymbol(chords[i].rootName, chords[i].quality);
  const out: Link[] = [];
  if (slotIdx > 0) {
    const p = slotIdx - 1;
    out.push({
      kind: 'prev',
      otherSymbol: sym(p),
      moves: pairMoves(chords[p].noteNames, placed[p], chords[slotIdx].noteNames, placed[slotIdx]),
    });
  }
  if (slotIdx < PROGRESSIONS[type].length - 1) {
    const n = slotIdx + 1;
    out.push({
      kind: 'next',
      otherSymbol: sym(n),
      moves: pairMoves(chords[slotIdx].noteNames, placed[slotIdx], chords[n].noteNames, placed[n]),
    });
  }
  return out;
}

/** 마이너 코드의 메이저 짝: m7♭5 ← m7, 7♭9 ← 7 (같은 루트·같은 폼) */
const MAJOR_SIBLING: Partial<Record<ChordQuality, ChordQuality>> = { m7b5: 'm7', dom7b9: 'dom7' };

/** 같은 루트 메이저 짝에서 이 코드로 (없으면 null). 성부 인덱스끼리 짝지어 비교한다. */
export function siblingLink(rootPc: number, quality: ChordQuality, form: Form): Link | null {
  const sib = MAJOR_SIBLING[quality];
  if (!sib) return null;
  const a = buildChord(rootPc, sib, form);
  const b = buildChord(rootPc, quality, form);
  // canonical 배치가 옥타브 경계에서 갈릴 수 있어 가까운 옥타브로 맞춘다
  const shift = Math.round((a.midi[0] - b.midi[0]) / 12) * 12;
  return {
    kind: 'sibling',
    otherSymbol: chordSymbol(a.rootName, a.quality),
    moves: pairMoves(a.noteNames, a.midi, b.noteNames, b.midi.map((m) => m + shift)),
  };
}

/** B형이면 같은 코드 A형에서 온 것 — 음은 같고 위 두 음이 아래로 내려간다 */
export function formALink(rootPc: number, quality: ChordQuality, form: Form): Link | null {
  if (form !== 'B') return null;
  const a = buildChord(rootPc, quality, 'A');
  return { kind: 'formA', otherSymbol: `${chordSymbol(a.rootName, a.quality)} A형`, moves: [] };
}

/**
 * 흰건반에 붙은 임시표(E♯ B♯ C♭ F♭)는 움직임 표시에서만 건반 이름으로 바꾼다.
 * "G♭→E♯"보다 "G♭→F"가 반음 내려간 게 바로 읽힌다. 코드 구성음 표기(spellVoicing)는 그대로 둔다.
 */
function keyName(name: string): string {
  return /^(E#|B#|Cb|Fb)$/.test(name) ? ROOT_NAMES[notePc(name)] : name;
}

/** 이동한 성부만 "C→B" 형태로 (표시용 글리프) */
export function movedLabels(ms: VoiceMove[]): string[] {
  return ms
    .filter((m) => m.delta !== 0)
    .map((m) => `${toGlyphs(keyName(m.from))}→${toGlyphs(keyName(m.to))}`);
}
