import { create } from "zustand";
import client from "../api/client.js";

export const useAppStore = create((set, get) => ({
  prices: {
    cocoa_price_per_kg: 40.0,
    coffee_price_per_kg: 30.0,
    cola_price_per_kg: 20.0,
    standard_moisture_percent: 7.0,
  },
  sellers: [],
  loadingSellers: false,
  settingsLoaded: false,

  fetchSettings: async () => {
    try {
      const { data } = await client.get("/settings/");
      set({ prices: data, settingsLoaded: true });
    } catch (err) {
      console.warn("Could not load remote settings, using defaults", err);
    }
  },

  fetchSellers: async () => {
    set({ loadingSellers: true });
    try {
      const { data } = await client.get("/sellers/");
      set({ sellers: data, loadingSellers: false });
    } catch {
      set({ loadingSellers: false });
    }
  },

  addLocalSeller: (seller) => {
    set((state) => ({
      sellers: [seller, ...state.sellers],
    }));
  },
}));
