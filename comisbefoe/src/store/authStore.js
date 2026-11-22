import { create } from "zustand";

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
        avatarUrl: data.avatarUrl || null,
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
    avatarUrl: null,
    produceName: "Confidence Produce",
    stationName: "Main Station",
  };
}

export const useAuthStore = create((set) => ({
  ...loadInitialState(),

  login: ({ token, role, name, userId, stationName, businessName, produceName, produceId, produce_id, avatarUrl }) => {
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
      avatarUrl: avatarUrl || null,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save auth session", e);
    }
    set(session);
  },

  setAvatar: (avatarUrl) => {
    set((state) => {
      const updated = { ...state, avatarUrl: avatarUrl || null };
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...raw, avatarUrl: updated.avatarUrl }));
      } catch (e) {
        console.error("Failed to save profile photo", e);
      }
      return updated;
    });
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

