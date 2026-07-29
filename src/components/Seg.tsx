/** 작은 세그먼티드 토글 — 탐색 모드의 보조 선택에 쓴다 */
export function Seg<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: T[];
  labels: string[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-felt-deep p-1">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-md px-3 py-1.5 text-sm ${
            value === opt ? 'bg-surface text-ivory' : 'text-muted hover:text-ivory-dim'
          }`}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}
