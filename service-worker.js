/*
 * FL!T 2026 service worker.
 * Provides an offline shell for the app UI. All data calls (API_URL) hit the
 * network directly and are intentionally NOT cached here, so schedule,
 * travel, hotel, notifications, polls, etc. are always fetched fresh — the
 * app's own window.appCache handles in-session caching/refresh.
 */

const CACHE_NAME = 'flit2026-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls (Google Apps Script) — always go to network.
  if (url.hostname.indexOf('script.google.com') !== -1) {
    return;
  }

  // Only handle same-origin GET requests for the app shell; everything else
  // (fonts, OneSignal SDK, etc.) passes straight through to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
