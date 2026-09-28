// service-worker.js
// Simple cache-first strategy for the app shell; falls back to network.
const CACHE_NAME = "sports-platform-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./fixtures.html",
  "./live.html",
  "./umpire.html",
  "./admin.html",
  "./manifest.json",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/sport-themes.css",
  "./js/app.js",
  "./js/config/sports.config.js",
  "./js/core/store.js",
  "./js/core/models.js",
  "./js/core/auth.js",
  "./js/core/sync.js",
  "./js/core/utils.js",
  "./js/scoring/scoring.engine.js",
  "./js/scoring/racquet.scorer.js",
  "./js/scoring/cue.scorer.js",
  "./js/scoring/cricket.scorer.js",
  "./js/scoring/chess.scorer.js",
  "./js/scoring/swimming.scorer.js",
  "./js/ui/filters.js",
  "./js/ui/render.fixtures.js",
  "./js/ui/render.live.js",
  "./js/ui/render.umpire.js",
  "./js/ui/render.admin.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
