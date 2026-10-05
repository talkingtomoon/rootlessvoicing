/**
 * 오프라인 캐시 (지하철 등). 배포본에서만 등록된다 (main.tsx).
 * - 페이지(HTML): 네트워크 먼저 → 실패하면 캐시. 새로 배포하면 다음 실행에 바로 반영된다.
 * - 나머지(해시 붙은 JS/CSS, 폰트, 피아노 샘플): 캐시 먼저 → 없으면 받아서 저장.
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

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
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
