/**
 * 오프라인 캐시 (지하철 등). 배포본에서만 등록된다 (main.tsx).
 * - 페이지(HTML): 네트워크 먼저 → 실패하면 캐시. 새로 배포하면 다음 실행에 바로 반영된다.
 * - 나머지(해시 붙은 JS/CSS, 폰트, 피아노 샘플): 캐시 먼저 → 없으면 받아서 저장.
 *
 * HTML은 반드시 브라우저 HTTP 캐시를 건너뛰고 받는다(`no-store`).
 * GitHub Pages가 HTML에 `max-age=600`을 붙여서, 그냥 fetch하면 배포 뒤 10분까지
 * 예전 화면이 뜬다 (아이폰 PWA에선 더 오래 남는다).
 */
const CACHE = 'rootless-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const samples = url.hostname === 'tonejs.github.io';
  if (!sameOrigin && !samples) return;

  // HTML 요청은 탐색이든 아니든 전부 네트워크 먼저 — 캐시 우선 분기로 내려보내지 마라
  const isPage =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));

  if (isPage) {
    e.respondWith(
      // req 그대로 넣지 말것: navigate 모드 Request는 cache 옵션과 같이 쓸 수 없다
      fetch(req.url, { cache: 'no-store', credentials: 'same-origin' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
