import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";
import { useNotificationStore, hasMarketNotifications } from "../store/notificationStore.js";

const EVERY_MS = 45 * 1000;

/** Keeps the My activity badge current: on page changes, every 45s, and when the app regains focus. */
export function useNotificationPolling() {
  const role = useAuthStore((s) => s.role);
  const refresh = useNotificationStore((s) => s.refresh);
  const reset = useNotificationStore((s) => s.reset);
  const { pathname } = useLocation();
  const enabled = hasMarketNotifications(role);

  useEffect(() => {
    if (!enabled) {
      reset();
      return undefined;
    }
    refresh();
    const timer = setInterval(refresh, EVERY_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh, reset]);

  useEffect(() => {
    if (enabled) refresh();
  }, [pathname, enabled, refresh]);
}
