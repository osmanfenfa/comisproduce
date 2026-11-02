import { create } from "zustand";
import { clearOfflineApiCache } from "../offline/registerServiceWorker.js";

const STORAGE_KEY = "comis_auth_session";

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const produce = data.produceName || data.businessName || data.stationName || "Kenema Produce";
      return {
        token: data.token || null,
        role: data.role || null,
        name: data.name || "",
        userId: data.userId || null,
        produceId: data.produceId || null,
        produceName: produce,
        stationName: data.stationName || produce,
      };
    }
  } catch (e) {
    console.error("Failed to load auth session", e);
  }
  return {
    token: null,
    role: null,
    name: "",
    userId: null,
    produceId: null,
    produceName: "Confidence Produce",
    stationName: "Main Station",
  };
}

export const useAuthStore = create((set) => ({
  ...loadInitialState(),

  login: ({ token, role, name, userId, stationName, businessName, produceName, produceId, produce_id }) => {
    const resolvedProduce = produceName || businessName || "COMIS Produce";
    const resolvedStation = stationName || resolvedProduce;
    const resolvedProduceId = produceId || produce_id || null;
    const session = {
      token,
      role,
      name: name || "Staff",
      userId,
      produceId: resolvedProduceId,
      produceName: resolvedProduce,
      stationName: resolvedStation,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save auth session", e);
    }
    set(session);
  },

  updateProfile: ({ name, stationName, produceName }) => {
    set((state) => {
      const resolved = produceName || stationName;
      const updated = {
        ...state,
        ...(name ? { name } : {}),
        ...(resolved ? { produceName: resolved, stationName: resolved } : {}),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to update auth session", e);
      }
      return updated;
    });
  },

  logout: () => {
    clearOfflineApiCache();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear auth session", e);
    }
    set({
      token: null,
      role: null,
      name: "",
      userId: null,
      produceId: null,
      produceName: "",
      stationName: "",
    });
  },
}));

