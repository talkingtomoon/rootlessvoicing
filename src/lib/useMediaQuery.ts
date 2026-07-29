import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    // change 이벤트가 안 오는 환경(일부 리사이즈 경로)이 있어 resize도 같이 본다
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [query]);

  return matches;
}

/** 모바일 세로 — 건반이 한 옥타브씩 페이징되는 기준 */
export const NARROW = '(max-width: 640px)';
