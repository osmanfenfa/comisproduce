import { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, X, Trash2 } from "lucide-react";
import {
  getPendingPurchases, flushSyncQueue, clearPendingPurchase, retryPendingPurchase,
} from "../../offline/syncQueue.js";
import client from "../../api/client.js";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showFailed, setShowFailed] = useState(false);

  const waiting = items.filter((i) => i.status !== "failed");
  const failed = items.filter((i) => i.status === "failed");

  const checkPending = useCallback(async () => {
    try {
      setItems(await getPendingPurchases());
    } catch {
      /* IndexedDB unavailable (private mode) */
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const res = await flushSyncQueue(client);
      await checkPending();
      if (res.synced > 0) {
        setSyncMessage(`Synced ${res.synced} offline purchase(s)`);
        setTimeout(() => setSyncMessage(""), 4000);
      }
    } catch {
      /* stays queued; retried on the next reconnect */
    } finally {
      setSyncing(false);
    }
  }, [checkPending]);

  useEffect(() => {
    checkPending().then(() => handleSync());
    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Poll: picks up newly queued items, and retries when the phone wrongly reports "online"
    const interval = setInterval(() => {
      checkPending();
      if (navigator.onLine) handleSync();
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkPending, handleSync]);

  const retryItem = async (id) => {
    await retryPendingPurchase(id);
    await checkPending();
    handleSync();
  };

  const discardItem = async (id) => {
    if (!window.confirm("Discard this offline purchase? It will not be recorded.")) return;
    await clearPendingPurchase(id);
    checkPending();
  };

  if (isOnline && items.length === 0 && !syncMessage) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 shadow-sm">
      <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-amber-200" />
              <span>
                Offline Mode — purchases are saved on this phone
                {waiting.length > 0 && ` (${waiting.length} waiting)`}
              </span>
            </>
          ) : syncMessage ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{syncMessage}</span>
            </>
          ) : (
            <span>{waiting.length} offline purchase(s) waiting to send</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {failed.length > 0 && (
            <button
              onClick={() => setShowFailed((v) => !v)}
              className="bg-red-700/80 hover:bg-red-700 text-white px-2 py-1 rounded flex items-center gap-1 transition"
            >
              <AlertTriangle className="w-3 h-3" />
              {failed.length} need attention
            </button>
          )}
          {isOnline && waiting.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sending..." : "Send Now"}
            </button>
          )}
        </div>
      </div>

      {showFailed && failed.length > 0 && (
        <div className="bg-white border-b border-red-200 px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-red-800">Offline purchases the server did not accept</p>
            <button onClick={() => setShowFailed(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {failed.map((item) => (
            <div key={item.id} className="border border-red-100 bg-red-50/50 rounded-xl p-2.5 text-xs flex items-start justify-between gap-2">
              <div>
                <span className="font-bold uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                  {item.commodity}
                </span>
                <span className="ml-1.5 text-slate-700">
                  {item.payload.weight_kg} kg · {item.payload.date}
                  {item.payload.random_seller_name && ` · ${item.payload.random_seller_name}`}
                </span>
                <p className="text-red-700 mt-1">{item.error}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => retryItem(item.id)}
                  className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 px-2 py-1 rounded-lg hover:bg-slate-50"
                >
                  Retry
                </button>
                <button
                  onClick={() => discardItem(item.id)}
                  aria-label="Discard"
                  className="text-red-700 bg-white border border-red-200 px-1.5 py-1 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
