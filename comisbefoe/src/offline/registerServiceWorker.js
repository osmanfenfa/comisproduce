/**
 * Registers public/sw.js in production builds so the app opens without signal.
 * Skipped in `npm run dev`, where a service worker would serve stale code.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  });
}

/** Called on logout: drop cached API data so the next user of the device can't see it. */
export function clearOfflineApiCache() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" });
  } catch {
    /* no service worker — nothing cached */
  }
}
