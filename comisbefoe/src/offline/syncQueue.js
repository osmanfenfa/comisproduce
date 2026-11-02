/**
 * Offline queue for purchases, stored in IndexedDB (via `idb`).
 *
 * - A purchase that can't reach the server (no signal, or the request times out) is
 *   saved on the phone with a device-generated client_ref.
 * - The queue is sent automatically when the connection returns. The server treats
 *   a repeated client_ref as the same purchase, so a retry never double-records.
 * - Items belong to the user who recorded them and are only sent with that user's login.
 * - If the server rejects an item (e.g. invalid data), it is parked as "failed" with the
 *   reason instead of being retried forever; the user can retry or discard it.
 */
import { openDB } from "idb";
import { useAuthStore } from "../store/authStore.js";

const DB_NAME = "comis_offline_db";
const DB_VERSION = 1;

export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pending_purchases")) {
        db.createObjectStore("pending_purchases", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached_sellers")) {
        db.createObjectStore("cached_sellers", { keyPath: "id" });
      }
    },
  });
}

export function newClientRef() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** True when the request never got an answer from the server (offline / timeout / DNS). */
export function isNetworkError(err) {
  return !err?.response;
}

export async function queueOfflinePurchase(commodity, payload) {
  const db = await getDb();
  return db.add("pending_purchases", {
    commodity,
    payload: { ...payload, client_ref: payload.client_ref || newClientRef() },
    user_id: useAuthStore.getState().userId || null,
    status: "pending",
    error: null,
    queued_at: new Date().toISOString(),
  });
}

/** Items recorded by the current user (other users' items wait for them to log in). */
export async function getPendingPurchases() {
  const db = await getDb();
  const userId = useAuthStore.getState().userId || null;
  const all = await db.getAll("pending_purchases");
  return all.filter((item) => !item.user_id || item.user_id === userId);
}

export async function clearPendingPurchase(id) {
  const db = await getDb();
  return db.delete("pending_purchases", id);
}

export async function retryPendingPurchase(id) {
  const db = await getDb();
  const item = await db.get("pending_purchases", id);
  if (item) await db.put("pending_purchases", { ...item, status: "pending", error: null });
}

export async function cacheSellers(sellers) {
  if (!sellers || !sellers.length) return;
  const db = await getDb();
  const tx = db.transaction("cached_sellers", "readwrite");
  for (const seller of sellers) {
    await tx.store.put(seller);
  }
  await tx.done;
}

export async function getCachedSellers() {
  const db = await getDb();
  return db.getAll("cached_sellers");
}

let flushing = null;

/** Send queued purchases in the order they were recorded. Safe to call repeatedly. */
export function flushSyncQueue(apiClient) {
  if (flushing) return flushing;
  flushing = (async () => {
    const results = { synced: 0, failed: 0, waiting: 0 };
    if (!useAuthStore.getState().token) return results;
    const db = await getDb();
    const items = (await getPendingPurchases())
      .filter((i) => i.status !== "failed")
      .sort((a, b) => a.id - b.id);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const payload = { ...item.payload, client_ref: item.payload.client_ref || newClientRef() };
        await apiClient.post(`/${item.commodity}/`, payload);
        await db.delete("pending_purchases", item.id);
        results.synced++;
      } catch (err) {
        const status = err.response?.status;
        if (isNetworkError(err) || status >= 500 || status === 401 || status === 429) {
          // Connection or server problem: stop and try again later, keeping the order
          results.waiting = items.length - i;
          break;
        }
        // The server looked at it and said no: park it with the reason
        const detail = err.response?.data?.detail;
        await db.put("pending_purchases", {
          ...item,
          status: "failed",
          error: typeof detail === "string" ? detail : `Rejected by server (${status})`,
        });
        results.failed++;
      }
    }
    return results;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
