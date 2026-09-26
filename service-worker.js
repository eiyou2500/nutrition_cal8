// Service Worker: 最低限のオフライン対応
// バージョンを変更するとキャッシュが更新されます
// GitHub Pages repositories share an origin. Never clear another app's cache.
const CACHE_PREFIX = 'nutrition-calc:' + encodeURIComponent(self.registration.scope) + ':';
const CACHE_VERSION = CACHE_PREFIX + 'v19';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './og.png',
  './data/iv-master.json',
  './data/meal-master.json',
  './data/enteral-master.json',
  './data/ons-master.json'
];

self.addEventListener('install', (event) => {
  // インストール時に必要ファイルをキャッシュに入れる
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // 失敗しても全体が落ちないよう個別に追加
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            // キャッシュ失敗は致命的でないので無視
            return null;
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // この公開先の古いキャッシュだけを削除（従来の共有名は触らない）
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 別サイト・外部リンク・書き込みリクエストを扱わない
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) {
    return;
  }
  // ネットワーク優先、失敗時はキャッシュから
  const cachePromise = caches.open(CACHE_VERSION);
  const network = fetch(req);
  // 成功した応答だけを保存し、イベント終了前に保存を完了させる。
  event.waitUntil(network.then(async (res) => {
    if (res.ok) {
      const clone = res.clone();
      const cache = await cachePromise;
      await cache.put(req, clone);
    }
  }).catch(() => {}));
  event.respondWith(
    network
      .catch(() =>
        cachePromise.then(cache => cache.match(req)).then(hit => hit || new Response('オフラインで利用できるデータがありません。オンラインで開き直してください。', { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
      )
  );
});
