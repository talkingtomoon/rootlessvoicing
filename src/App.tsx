import { useEffect } from 'react';
import { ExploreView } from './views/ExploreView';
import { initAudio, unlockAudio } from './audio/audio';

export default function App() {
  useEffect(() => {
    void initAudio(); // 샘플 버퍼 미리 다운로드 (첫 클릭 렉 방지)
    const unlock = () => void unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <div className="min-h-screen">
      <ExploreView />
    </div>
  );
}
