import * as Tone from 'tone';

/**
 * Salamander 피아노 샘플러 + 조용한 폴백.
 * - 앱 마운트 시 initAudio()로 버퍼 다운로드를 미리 시작 (제스처 불필요)
 * - 첫 제스처에서 AudioContext 시작 (installAudioUnlock)
 * - 로드 실패 또는 3초 초과 시 PolySynth로 폴백, 경고 없음
 *
 * iOS에서 소리가 안 나는 원인이 셋 있어서 전부 막아둔다:
 *  1. 무음(벨) 스위치가 Web Audio까지 끈다 → navigator.audioSession.type='playback'으로 무시
 *  2. 제스처 한 번만 노려서 unlock하면 놓친다 → 캡처 단계에서 여러 제스처로 계속 시도
 *  3. 화면을 껐다 돌아오면 context가 suspended로 남는다 → 복귀 시·재생 직전에 resume
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

/** 모든 악기가 여기로 모인다 — 출력이 한 곳이라 계측·음량 조절이 한 군데서 된다 */
let master: Tone.Gain | null = null;
function output(): Tone.Gain {
  if (!master) master = new Tone.Gain(1).toDestination();
  return master;
}

/**
 * 진단용: 출력에 실제로 신호가 실리는지 RMS로 본다. 0에 가까우면 무음.
 * 첫 호출이 탭을 설치하므로 (재생 전 한 번 → 재생 → 다시 읽기) 순서로 쓴다.
 * 반드시 이 모듈 안에서 계측한다 — 밖에서 Tone을 따로 import하면 컨텍스트가 갈려 0이 나온다.
 */
let probe: Tone.Analyser | null = null;
export function outputRms(): number {
  if (!probe) {
    probe = new Tone.Analyser('waveform', 2048);
    output().connect(probe);
    return 0;
  }
  const buf = probe.getValue() as Float32Array;
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

function makeFallback(): Tone.PolySynth {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.15, release: 1.2 },
  }).connect(output());
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
    }).connect(output());
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

/**
 * iOS: 무음 스위치가 Web Audio 출력까지 끈다. 'playback'으로 선언하면 벨소리가 아니라
 * 미디어 재생으로 취급돼 스위치를 무시한다 (Safari 16.4+, 없는 브라우저는 그냥 통과).
 */
function claimPlaybackSession(): void {
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = 'playback';
  } catch {
    // 지원하지 않으면 무시
  }
}

export function audioRunning(): boolean {
  return Tone.getContext().state === 'running';
}

/** 재생 직전 호출 — suspended면 깨운다. 제스처 안에서 불리므로 iOS에서도 통한다. */
function ensureRunning(): void {
  if (audioRunning()) return;
  claimPlaybackSession();
  void Tone.getContext().resume();
}

export async function unlockAudio(): Promise<void> {
  claimPlaybackSession();
  if (!audioRunning()) await Tone.start();
  void initAudio();
}

/**
 * 제스처가 오면 오디오를 깨운다. 한 번만 노리지 않고 계속 붙여 둔다 —
 * 첫 제스처가 실패해도(로딩 중, 정책 거부) 다음 터치에서 살아난다.
 * 캡처 단계여서 건반의 onPointerDown(playNote)보다 먼저 돌아 첫 음도 들린다.
 */
export function installAudioUnlock(): () => void {
  const onGesture = () => {
    if (audioRunning()) return;
    void unlockAudio();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') ensureRunning();
  };
  const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchend', 'keydown'];
  for (const ev of events) document.addEventListener(ev, onGesture, { capture: true });
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    for (const ev of events) document.removeEventListener(ev, onGesture, { capture: true });
    document.removeEventListener('visibilitychange', onVisible);
  };
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
  ensureRunning();
  current().triggerAttackRelease(toNotes([midi]), duration);
}

export function playChord(midi: number[], duration = 1.5): void {
  ensureRunning();
  current().triggerAttackRelease(toNotes(midi), duration);
}

/** 세 코드 순차 재생. 오디오는 정밀 스케줄, UI 동기화는 반환된 ms 오프셋으로. */
export function playChordSequence(chords: number[][], gapSec = 1.0): number[] {
  ensureRunning();
  const inst = current();
  const now = Tone.now();
  chords.forEach((midi, i) => {
    const dur = i === chords.length - 1 ? gapSec * 2 : gapSec * 0.95;
    inst.triggerAttackRelease(toNotes(midi), dur, now + i * gapSec);
  });
  return chords.map((_, i) => i * gapSec * 1000);
}
