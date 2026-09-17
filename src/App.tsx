import { useCallback, useEffect, useState } from 'react';
import { ExploreView } from './views/ExploreView';
import { MemorizeView } from './views/MemorizeView';
import { ProgressView } from './views/ProgressView';
import { TodayView } from './views/TodayView';
import { studyDay } from './state/day';
import { SettingsDrawer } from './components/SettingsDrawer';
import { initAudio, installAudioUnlock } from './audio/audio';
import { applyResults, loadProgress, saveProgress, type ProgressStore } from './state/progress';
import { clearIncoming, readIncoming } from './state/progressCode';
import { loadSettings, saveSettings, type Settings } from './state/settings';

type Mode = 'today' | 'explore' | 'memorize' | 'progress';

export default function App() {
  // 진도 링크로 들어왔으면 진도 탭에서 확인부터 받는다
  const [incoming, setIncoming] = useState(readIncoming);
  const [mode, setMode] = useState<Mode>(() => (incoming ? 'progress' : 'today'));
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    void initAudio(); // 샘플 버퍼 미리 다운로드 (첫 클릭 렉 방지)
    return installAudioUnlock(); // 제스처가 오면 오디오를 깨운다 (iOS 대응)
  }, []);

  // 같은 학습일의 여러 세션은 한 세션으로 묶인다 (오늘 탭과 간격 단위를 맞춘다)
  const recordSession = useCallback((firstTry: Record<string, boolean>) => {
    setProgress((prev) => {
      const next = applyResults(prev, firstTry, { day: studyDay() });
      saveProgress(next);
      return next;
    });
  }, []);

  const replaceProgress = useCallback((next: ProgressStore) => {
    saveProgress(next);
    setProgress(next);
  }, []);

  // 이미 열어둔 창에 링크를 붙여넣으면 해시만 바뀌고 리로드는 안 된다 — 그때도 받아준다
  useEffect(() => {
    const onHash = () => {
      const inc = readIncoming();
      if (!inc) return;
      setIncoming(inc);
      setMode('progress');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 주소에 남은 코드는 즉시 지운다 — 새로고침할 때마다 다시 묻지 않게
  const acceptIncoming = useCallback(() => {
    if (!incoming) return;
    saveProgress(incoming);
    setProgress(incoming);
    setIncoming(null);
    clearIncoming();
  }, [incoming]);

  const dismissIncoming = useCallback(() => {
    setIncoming(null);
    clearIncoming();
  }, []);

  const changeSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  return (
    <div className="min-h-screen pb-10">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-xl text-ivory-dim">Rootless</h1>
        <nav className="flex rounded-lg bg-felt-deep p-1">
          {(
            [
              ['today', '오늘'],
              ['explore', '탐색'],
              ['memorize', '암기'],
              ['progress', '진도'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm sm:px-4 ${
                mode === m ? 'bg-surface text-ivory' : 'text-muted hover:text-ivory-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="pt-3">
        <SettingsDrawer settings={settings} onChange={changeSettings} />
      </div>

      {mode === 'today' && (
        <TodayView store={progress} onStoreChange={replaceProgress} settings={settings} />
      )}
      {mode === 'explore' && <ExploreView />}
      {mode === 'memorize' && (
        <MemorizeView store={progress} onFinish={recordSession} settings={settings} />
      )}
      {mode === 'progress' && (
        <ProgressView
          store={progress}
          incoming={incoming}
          onAcceptIncoming={acceptIncoming}
          onDismissIncoming={dismissIncoming}
          onPasted={setIncoming}
        />
      )}
    </div>
  );
}
