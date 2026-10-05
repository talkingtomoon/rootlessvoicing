import { useCallback, useState } from 'react';

/**
 * 따라 치기 — 정답을 공개한 뒤 그 보이싱을 한 번 직접 눌러보는 단계.
 * **채점이 아니다.** 틀린 음은 그냥 무시하고(소리만 난다) 맞는 음만 세어 나간다.
 * 손이 그 모양을 한 번 거치고 다음 문제로 가게 하는 것이 전부다.
 *
 * 아래 성부부터 차례로 — 순서가 폼(A/B)을 가르므로 따라 칠 때도 같은 순서로 간다.
 */
export function useEcho(expected: number[], byPitchClass = false) {
  const [done, setDone] = useState(0);

  const press = useCallback(
    (midi: number): boolean => {
      const want = expected[done];
      if (want === undefined) return false;
      const hit = byPitchClass ? ((midi % 12) + 12) % 12 === ((want % 12) + 12) % 12 : midi === want;
      if (hit) setDone((d) => d + 1);
      return hit;
    },
    [expected, done, byPitchClass],
  );

  const reset = useCallback(() => setDone(0), []);

  return { done, total: expected.length, complete: done >= expected.length, press, reset };
}
