/*
 * COMIS service worker — lets the app open and work at a buying station with no signal.
 *
 *   App shell (HTML, JS, CSS, icons): cached on install and on use, served when offline.
 *   API reads (GET /api/...):          network first; the last good response is shown when offline.
 *   API writes (POST/PUT/...):         never cached or replayed here. Purchases recorded offline
 *                                      go to the IndexedDB queue (src/offline/syncQueue.js).
 *
 * Bump VERSION to force every device to drop old caches.
 */
const VERSION = "v1";
const SHELL_CACHE = `comis-shell-${VERSION}`;
const API_CACHE = `comis-api-${VERSION}`;
const SHELL_URLS = ["/", "/index.html", "/manifest.json", "/comis-logo.png", "/favicon.svg"];

// Never serve these from cache: they must reflect the live session
const API_NO_CACHE = [/\/api\/v1\/auth\//, /\/api\/v1\/sync\//, /\/export/, /\/bulk-template/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_URLS.map((u) => new Request(u, { cache: "reload" }))).catch(() => {});
      // Also precache the hashed JS/CSS bundles referenced by index.html
      try {
        const html = await (await fetch("/index.html", { cache: "reload" })).text();
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await cache.addAll(assets);
      } catch {
        /* offline during install: assets get cached on first use instead */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, API_CACHE]);
      for (const key of await caches.keys()) {
        if (key.startsWith("comis-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

// The app posts this on logout so the next person on the device can't see cached data
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_API_CACHE") {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Google sign-in, fonts, etc.

  if (url.pathname.startsWith("/api/")) {
    if (API_NO_CACHE.some((re) => re.test(url.pathname))) return;
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Page loads: try the network, fall back to the cached app shell
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/index.html", response.clone());
          return response;
        } catch {
          return (await caches.match("/index.html")) || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Hashed bundles never change, so cache-first is safe; other static files too
  event.respondWith(cacheFirst(request));
});
