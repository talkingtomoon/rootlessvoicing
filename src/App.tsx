import { useEffect, useState } from 'react';
import { ExploreView } from './views/ExploreView';
import { MemorizeView } from './views/MemorizeView';
import { TypeDrillView } from './views/TypeDrillView';
import { initAudio, unlockAudio } from './audio/audio';

type Mode = 'explore' | 'memorize' | 'type';

export default function App() {
  const [mode, setMode] = useState<Mode>('explore');

  useEffect(() => {
    void initAudio(); // 샘플 버퍼 미리 다운로드 (첫 클릭 렉 방지)
    const unlock = () => void unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-6">
        <h1 className="font-display text-xl text-ivory-dim">Rootless</h1>
        <nav className="flex rounded-lg bg-felt-deep p-1">
          {(
            [
              ['explore', '탐색'],
              ['memorize', '암기'],
              ['type', '타입별'],
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
      {mode === 'explore' && <ExploreView />}
      {mode === 'memorize' && <MemorizeView />}
      {mode === 'type' && <TypeDrillView />}
    </div>
  );
}
