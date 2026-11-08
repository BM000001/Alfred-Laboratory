const APP_CACHE = 'alfred-app-shell-v1';
const OCR_CACHE = 'alfred-ocr-assets-v1';

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

  let html = '';
  try {
    const response = await fetch(scope.href);
    if (response.ok) {
      await cache.put(scope.href, response.clone());
      html = await response.clone().text();
    }
  } catch {
    // The shell cache may be populated by the current page's first load instead.
  }

  const indexUrl = new URL('index.html', scope).href;
  try {
    const response = await fetch(indexUrl);
    if (response.ok) {
      await cache.put(indexUrl, response.clone());
      if (!html) html = await response.clone().text();
    }
  } catch {
    // GitHub Pages may serve the root URL without exposing index.html directly.
  }

  const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], scope).href)
    .filter((url) => {
      const parsed = new URL(url);
      return parsed.origin === scope.origin && parsed.pathname.startsWith(scope.pathname) &&
        (parsed.pathname.includes('/assets/') || parsed.pathname.endsWith('.webmanifest'));
    });

  await Promise.all([...new Set([...urls, ...assetUrls])].map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    } catch {
      // One optional icon or asset must not prevent installation of the worker.
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await cacheAppShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('alfred-') && ![APP_CACHE, OCR_CACHE].includes(key))
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
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
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
