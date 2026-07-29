import { useCallback, useEffect, useState } from 'react';
import { ExploreView } from './views/ExploreView';
import { MemorizeView } from './views/MemorizeView';
import { ProgressView } from './views/ProgressView';
import { SettingsDrawer } from './components/SettingsDrawer';
import { initAudio, unlockAudio } from './audio/audio';
import { applyResults, loadProgress, saveProgress } from './state/progress';
import { loadSettings, saveSettings, type Settings } from './state/settings';

type Mode = 'explore' | 'memorize' | 'progress';

export default function App() {
  const [mode, setMode] = useState<Mode>('explore');
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    void initAudio(); // 샘플 버퍼 미리 다운로드 (첫 클릭 렉 방지)
    const unlock = () => void unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const recordSession = useCallback((firstTry: Record<string, boolean>) => {
    setProgress((prev) => {
      const next = applyResults(prev, firstTry);
      saveProgress(next);
      return next;
    });
  }, []);

  const changeSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  return (
    <div className="min-h-screen pb-10">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 pt-5">
        <h1 className="font-display text-xl text-ivory-dim">Rootless</h1>
        <nav className="flex rounded-lg bg-felt-deep p-1">
          {(
            [
              ['explore', '탐색'],
              ['memorize', '암기'],
              ['progress', '진도'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 text-sm ${
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

      {mode === 'explore' && <ExploreView />}
      {mode === 'memorize' && (
        <MemorizeView store={progress} onFinish={recordSession} settings={settings} />
      )}
      {mode === 'progress' && <ProgressView store={progress} />}
    </div>
  );
}
