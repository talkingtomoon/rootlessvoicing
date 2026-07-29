import { useState } from 'react';
import { ProgressionExplorer } from './ProgressionExplorer';
import { TypeExplorer } from './TypeExplorer';
import { Seg } from '../components/Seg';
import { loadLastExploreMode, saveLastExploreMode } from '../state/prefs';

export type ExploreMode = 'progression' | 'type';

/** 사전. 진행별(ii–V–I 문맥) / 타입별(한 quality를 12루트에 걸쳐) 두 가지로 보고 듣는다. */
export function ExploreView() {
  const [mode, setMode] = useState<ExploreMode>(loadLastExploreMode);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Seg
        options={['progression', 'type'] as ExploreMode[]}
        labels={['진행별', '타입별']}
        value={mode}
        onChange={(m) => {
          setMode(m);
          saveLastExploreMode(m);
        }}
      />
      {mode === 'progression' ? <ProgressionExplorer /> : <TypeExplorer />}
    </div>
  );
}
