/* B25 PWA v1: offline notice only. Never cache authenticated app data. */
const OFFLINE_CACHE = "b25-offline-notice-v1";
const OFFLINE_PATH = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_PATH))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("b25-offline-notice-") && key !== OFFLINE_CACHE)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

// Live requests remain network-only; no app shell, HTML, API, auth, guest or
// financial data is ever saved by this service worker.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const offline = await caches.match(OFFLINE_PATH, { ignoreSearch: true });
      return offline || Response.error();
    }),
  );
});
