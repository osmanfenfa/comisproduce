import { useEffect, useState } from "react";
import { Check, ShoppingBasket, Sprout, Loader2 } from "lucide-react";
import client from "../../api/client.js";
import { loadMarketMeta } from "../../utils/market.js";
import { PrimaryButton } from "./ProduceUI.jsx";

function Chips({ categories, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const on = selected.includes(c.key);
        return (
          <button key={c.key} type="button" onClick={() => onToggle(c.key)} aria-pressed={on}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
              on ? "bg-[#168821] border-[#168821] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}>
            {on && <Check className="w-3 h-3" />}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "What do you buy / sell?" — the ticked categories put matching posts first in the
 * For you feed and send an alert when someone posts one.
 * `onLoaded(data)` reports the saved picks (the feed uses it to decide whether to ask).
 */
export default function InterestPicker({ onSaved, onLoaded, showLearned = false, saveLabel = "Save" }) {
  const [categories, setCategories] = useState([]);
  const [buys, setBuys] = useState([]);
  const [sells, setSells] = useState([]);
  const [learned, setLearned] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadMarketMeta(), client.get("/market/me/interests")])
      .then(([meta, { data }]) => {
        if (cancelled) return;
        setCategories(meta?.categories || []);
        setBuys(data.buys);
        setSells(data.sells);
        setLearned(data.learned);
        onLoaded?.(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  const toggle = (list, setList) => (key) =>
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await client.put("/market/me/interests", { buys, sells });
      setLearned(data.learned);
      setMessage("Saved. Your feed now shows these first.");
      onSaved?.(data);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (!categories.length) return <div className="text-center py-4 text-xs text-slate-400">Loading...</div>;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-black text-[#0f5c18] flex items-center gap-1.5">
          <ShoppingBasket className="w-4 h-4 text-[#d4a000]" /> What do you buy?
        </p>
        <Chips categories={categories} selected={buys} onToggle={toggle(buys, setBuys)} />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-black text-[#0f5c18] flex items-center gap-1.5">
          <Sprout className="w-4 h-4 text-[#168821]" /> What do you sell?
        </p>
        <Chips categories={categories} selected={sells} onToggle={toggle(sells, setSells)} />
      </div>

      {showLearned && learned.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Learned from your activity</p>
          <div className="flex flex-wrap gap-1.5">
            {learned.slice(0, 8).map((i) => (
              <span key={`${i.category}-${i.side}`}
                className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#0f5c18] text-[10px] font-bold">
                {i.side === "needs" ? "Buys" : "Sells"} {i.label} · {i.strength}%
              </span>
            ))}
          </div>
        </div>
      )}

      {message && <p className="text-xs text-[#0f5c18] text-center">{message}</p>}
      <PrimaryButton type="button" disabled={busy} onClick={save}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} {saveLabel}
      </PrimaryButton>
    </div>
  );
}
