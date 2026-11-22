/*
 * COMIS no longer works offline. This replaces the old offline service worker on phones
 * that installed it: it deletes its caches, uninstalls itself, and reloads the live app.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
  })());
});
