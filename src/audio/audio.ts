import * as Tone from 'tone';

/**
 * Salamander 피아노 샘플러 + 조용한 폴백.
 * - 앱 마운트 시 initAudio()로 버퍼 다운로드를 미리 시작 (제스처 불필요)
 * - 첫 포인터 제스처에서 unlockAudio()로 AudioContext 시작
 * - 로드 실패 또는 3초 초과 시 PolySynth로 폴백, 경고 없음
 */

const SAMPLE_URLS: Record<string, string> = {
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
};

type Instrument = Tone.Sampler | Tone.PolySynth;

let sampler: Tone.Sampler | null = null;
let fallback: Tone.PolySynth | null = null;
let loadPromise: Promise<void> | null = null;

function makeFallback(): Tone.PolySynth {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.15, release: 1.2 },
  }).toDestination();
  synth.volume.value = -8;
  return synth;
}

export function initAudio(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const candidate = new Tone.Sampler({
      urls: SAMPLE_URLS,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1.2,
    }).toDestination();
    try {
      await Promise.race([
        Tone.loaded(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      sampler = candidate;
    } catch {
      candidate.dispose();
    }
  })();
  return loadPromise;
}

/** 디버그/테스트용: Salamander 샘플러가 실제 로드됐는지 (false면 폴백 신스 사용 중) */
export function isSamplerReady(): boolean {
  return sampler !== null;
}

export async function unlockAudio(): Promise<void> {
  await Tone.start();
  void initAudio();
}

function current(): Instrument {
  if (sampler) return sampler;
  if (!fallback) fallback = makeFallback();
  return fallback;
}

function toNotes(midi: number[]): string[] {
  return midi.map((m) => Tone.Frequency(m, 'midi').toNote());
}

export function playNote(midi: number, duration = 0.8): void {
  current().triggerAttackRelease(toNotes([midi]), duration);
}

export function playChord(midi: number[], duration = 1.5): void {
  current().triggerAttackRelease(toNotes(midi), duration);
}

/** 세 코드 순차 재생. 오디오는 정밀 스케줄, UI 동기화는 반환된 ms 오프셋으로. */
export function playChordSequence(chords: number[][], gapSec = 1.0): number[] {
  const inst = current();
  const now = Tone.now();
  chords.forEach((midi, i) => {
    const dur = i === chords.length - 1 ? gapSec * 2 : gapSec * 0.95;
    inst.triggerAttackRelease(toNotes(midi), dur, now + i * gapSec);
  });
  return chords.map((_, i) => i * gapSec * 1000);
}
