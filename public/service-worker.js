// public/service-worker.js
const CACHE_NAME = "fintrack-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/favicon.ico",
  // Add assets you want cached (css, js bundles, icons)
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (ev) => {
  // Network-first for API/JSON, cache-first for static
  ev.respondWith(
    caches.match(ev.request).then((cached) => {
      if (cached) return cached;
      return fetch(ev.request)
        .then((res) => {
          // optionally cache new requests
          return res;
        })
        .catch(() => {
          // offline fallback: you can return a custom offline page here
          return caches.match("/");
        });
    })
  );
});
