const IS_LABORATORY_SCOPE = new URL(self.registration.scope).pathname.startsWith('/Alfred-Laboratory/');
const CACHE_PREFIX = IS_LABORATORY_SCOPE ? 'laboratory-alfred-' : 'alfred-';
const SHELL_BUILD = '__ALFRED_SHELL_BUILD__';
const APP_CACHE = `${CACHE_PREFIX}app-shell-v3-${SHELL_BUILD}`;
const OCR_CACHE = `${CACHE_PREFIX}ocr-assets-v1`;

async function cacheAppShell() {
  const scope = new URL(self.registration.scope);
  const cache = await caches.open(APP_CACHE);
  const urls = [
    scope.href,
    new URL('index.html', scope).href,
    new URL('manifest.webmanifest', scope).href,
    new URL('apple-touch-icon-180.png', scope).href,
    new URL('icon-192.png', scope).href,
    new URL('icon-512.png', scope).href,
    new URL('icon-maskable-512.png', scope).href,
  ];

  // Only activate once the new shell and its fingerprinted entrypoints are usable.
  const response = await fetch(new Request(scope.href, { cache: 'reload' }));
  if (!response.ok) throw new Error('Não foi possível atualizar o shell.');
  const html = await response.clone().text();
  const servedBuild = html.match(/<meta name="alfred-build" content="[a-f0-9]{7} · ([a-f0-9]{16})"\s*\/>/)?.[1];
  if (servedBuild !== SHELL_BUILD) throw new Error('O HTML publicado ainda pertence a outra versão.');
  const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], scope))
    .filter((url) => url.origin === scope.origin && url.pathname.startsWith(scope.pathname + 'assets/'))
    .map((url) => url.href);
  if (!assetUrls.some((url) => url.endsWith('.js')) || !assetUrls.some((url) => url.endsWith('.css'))) {
    throw new Error('O shell não identifica os arquivos da interface.');
  }
  await cache.addAll([...new Set(assetUrls)].map((url) => new Request(url, { cache: 'reload' })));
  await cache.put(scope.href, response.clone());
  await cache.put(new URL('index.html', scope).href, response);
  await Promise.allSettled(urls.slice(2).map(async (url) => {
    const asset = await fetch(new Request(url, { cache: 'reload' }));
    if (asset.ok) await cache.put(url, asset);
  }));
}

self.addEventListener('install', (event) => {
  // Let open clients finish using their current UI before changing cache generations.
  event.waitUntil(cacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX + 'app-shell-') && key !== APP_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  const isOcrAsset = url.pathname.includes(scope.pathname + 'ocr/');
  const isAppAsset = request.mode === 'navigate' || url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.webmanifest') || /\/(?:apple-touch-icon-180|icon-192|icon-512|icon-maskable-512)\.png$/.test(url.pathname);
  if (!isOcrAsset && !isAppAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(isOcrAsset ? OCR_CACHE : APP_CACHE);
    const cached = await cache.match(request);

    if (isOcrAsset && cached) return cached;

    try {
      const response = await fetch(request.mode === 'navigate' ? request.url : request, request.mode === 'navigate' ? { cache: 'reload' } : undefined);
      // The offline navigation shell and its entrypoints are installed together.
      // A live request may be ahead of this worker during a Pages rollout.
      if (request.mode !== 'navigate' && response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const indexUrl = new URL('index.html', scope).href;
        const fallback = await cache.match(indexUrl) ?? await cache.match(scope.href);
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
