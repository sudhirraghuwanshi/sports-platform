// service-worker.js
// Network-first for HTML/navigation (always fresh), stale-while-revalidate for other assets.
// Bump CACHE_NAME on every deploy so old caches are dropped automatically.
const CACHE_NAME = "sports-platform-v15";
const APP_SHELL = [
  "./",
  "./index.html",
  "./fixtures.html",
  "./live.html",
  "./umpire.html",
  "./admin.html",
  "./register.html",
  "./manifest.json",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/sport-themes.css",
  "./js/app.js",
  "./js/config/sports.config.js",
  "./js/config/firebase.config.js",
  "./js/core/store.js",
  "./js/core/models.js",
  "./js/core/auth.js",
  "./js/core/sync.js",
  "./js/core/utils.js",
  "./js/core/bracket.js",
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
  "./js/ui/render.admin.js",
  "./js/ui/render.register.js",
  "./js/ui/matchModal.js"
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

  // Never intercept cross-origin requests (Firebase, CDN imports, etc.) —
  // let the browser handle those directly so realtime sync isn't disrupted.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Navigation (HTML page loads) — always try network first so users get the
  // latest deployed markup/JS; fall back to cache only if offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  // JavaScript modules — network-first, same as navigation. These files
  // drive all app logic (scoring, sync, etc.), so a visitor must never run
  // a stale cached copy after a deploy; only fall back to cache if offline.
  if (event.request.destination === "script" || event.request.url.endsWith(".js")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Other assets (css/icons) — stale-while-revalidate: serve cached copy
  // instantly but refresh the cache in the background for next time.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
