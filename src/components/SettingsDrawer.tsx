import { useState } from 'react';
import type { Settings } from '../state/settings';

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
};

function Check({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
        on
          ? 'border-brass bg-surface text-ivory'
          : 'border-line bg-felt-deep text-muted hover:border-muted'
      }`}
    >
      {label}
    </button>
  );
}

/** 접힌 서랍 하나. 진행과 폼만 — 여기에 더 넣지 마라 (스펙 §7). */
export function SettingsDrawer({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);

  // 마지막 하나는 끌 수 없다 — 뽑을 게 없어지는 상태를 만들지 않는다
  function toggle(key: keyof Settings, pair: keyof Settings) {
    if (settings[key] && !settings[pair]) return;
    onChange({ ...settings, [key]: !settings[key] });
  }

  return (
    <div className="mx-auto max-w-3xl px-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs tracking-widest text-muted hover:text-ivory-dim"
      >
        설정 {open ? '−' : '+'}
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-felt-deep p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-widest text-muted">진행</span>
            <Check on={settings.major} label="메이저" onToggle={() => toggle('major', 'minor')} />
            <Check on={settings.minor} label="마이너" onToggle={() => toggle('minor', 'major')} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-widest text-muted">폼</span>
            <Check on={settings.A} label="A형" onToggle={() => toggle('A', 'B')} />
            <Check on={settings.B} label="B형" onToggle={() => toggle('B', 'A')} />
          </div>
        </div>
      )}
    </div>
  );
}
