import { create } from "zustand";
import client from "../api/client.js";

const MARKET_MEMBERS = ["farmer", "trader", "produce_manager", "produce_secretary"];

/**
 * My activity badge: offers waiting for my answer + answers to my offers I haven't seen
 * + new posts that match what I need or sell ("matches").
 * Refreshed by polling (see useNotificationPolling) and right after offer actions.
 */
export const useNotificationStore = create((set) => ({
  offersReceived: 0,
  offerUpdates: 0,
  matches: 0,
  total: 0,

  refresh: async () => {
    try {
      const { data } = await client.get("/market/notifications");
      set({
        offersReceived: data.offers_received,
        offerUpdates: data.offer_updates,
        matches: data.matches || 0,
        total: data.total,
      });
    } catch {
      /* offline or logged out: keep the last numbers */
    }
  },

  markUpdatesSeen: async () => {
    set((s) => ({ offerUpdates: 0, total: s.offersReceived + s.matches }));
    try {
      await client.post("/market/notifications/seen-updates");
    } catch {
      /* will be retried next time the tab opens */
    }
  },

  markMatchesSeen: async () => {
    set((s) => ({ matches: 0, total: s.offersReceived + s.offerUpdates }));
    try {
      await client.post("/market/alerts/seen");
    } catch {
      /* will be retried next time the tab opens */
    }
  },

  reset: () => set({ offersReceived: 0, offerUpdates: 0, matches: 0, total: 0 }),
}));

export const hasMarketNotifications = (role) => MARKET_MEMBERS.includes(role);
