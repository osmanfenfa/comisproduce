import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Image as ImageIcon, Video, Megaphone, Bookmark, Handshake, SlidersHorizontal } from "lucide-react";
import client from "../../api/client.js";
import { useAuthStore } from "../../store/authStore.js";
import { loadMarketMeta } from "../../utils/market.js";
import FeedPost, { Avatar } from "../../components/market/FeedPost.jsx";
import CountBadge from "../../components/shared/CountBadge.jsx";
import { useNotificationStore } from "../../store/notificationStore.js";

const ROLE_LABEL = { farmer: "Farmer", trader: "Trader", produce_manager: "Buying station", produce_secretary: "Buying station", system_admin: "Admin" };
const TABS = [["all", "All"], ["sell", "For sale"], ["wanted", "Wanted"], ["saved", "Saved"]];

export default function MarketHome() {
  const { role, name, produceName, avatarUrl } = useAuthStore();
  const canPost = role !== "system_admin";
  const notifications = useNotificationStore((s) => s.total);
  const me = { name: role === "produce_manager" || role === "produce_secretary" ? produceName : name, role, avatar_url: avatarUrl };

  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMarketMeta().then(setMeta);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = { page };
    if (tab === "sell" || tab === "wanted") params.kind = tab;
    if (tab === "saved") params.saved = true;
    if (category) params.category = category;
    if (district) params.district = district;
    if (query) params.q = query;
    client
      .get("/market/listings", { params })
      .then(({ data }) => {
        if (cancelled) return;
        setPosts((prev) => (page === 1 ? data : [...prev, ...data]));
        setHasMore(data.length === 20);
        setError("");
      })
      .catch(() => !cancelled && setError("Could not load the market. Check your connection."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, category, district, query, page]);

  // Any filter change restarts the feed from the top
  const restart = (fn) => (value) => {
    setLoading(true);
    setPage(1);
    fn(value);
  };

  const categoryLabel = meta?.categories.find((c) => c.key === category)?.label;

  return (
    <div className="pb-20 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_240px] gap-3 lg:gap-5 items-start">
      {/* LEFT: profile card (desktop) */}
      <aside className="hidden lg:block sticky top-3 space-y-3">
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="h-14 bg-[#d4a000]" />
          <div className="px-4 pb-4 -mt-7 text-center">
            <div className="flex justify-center"><div className="ring-4 ring-white rounded-full"><Avatar person={me} size="w-14 h-14 text-xl" /></div></div>
            <p className="font-bold text-slate-900 mt-1.5 truncate">{me.name || "Member"}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[role]}</p>
          </div>
          {canPost && (
            <div className="border-t border-slate-100 text-xs font-semibold text-slate-700">
              <Link to="/market/activity" className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50"><Handshake className="w-4 h-4 text-[#168821]" /> My activity & offers <CountBadge count={notifications} className="ml-auto" /></Link>
              <button onClick={() => restart(setTab)("saved")} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 cursor-pointer"><Bookmark className="w-4 h-4 text-[#d4a000]" /> Saved posts</button>
            </div>
          )}
        </div>
      </aside>

      {/* CENTER: composer + feed */}
      <main className="space-y-3 min-w-0">
        <div className="w-full bg-[#d4a000] text-[#0f5c18] font-black text-center py-2 rounded-2xl tracking-wider text-sm uppercase shadow-xs">
          COMIS Market
        </div>
        {canPost && (
          <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs p-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar person={me} size="w-9 h-9 text-sm" />
              <Link to="/market/new"
                className="flex-1 border border-slate-400 rounded-full px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                Start a post: sell produce or ask to buy
              </Link>
            </div>
            <div className="flex justify-around mt-1.5 text-[11px] font-semibold text-slate-600">
              <Link to="/market/new" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100"><ImageIcon className="w-4.5 h-4.5 text-sky-600" /> Photo</Link>
              <Link to="/market/new" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100"><Video className="w-4.5 h-4.5 text-[#168821]" /> Video</Link>
              <Link to="/market/new?kind=wanted" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100"><Megaphone className="w-4.5 h-4.5 text-[#d4a000]" /> Wanted</Link>
            </div>
          </div>
        )}

        {/* Tabs + search */}
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {TABS.filter(([k]) => canPost || k !== "saved").map(([k, label]) => (
              <button key={k} onClick={() => restart(setTab)(k)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                  tab === k ? "bg-[#168821] border-[#168821] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}>
                {label}
              </button>
            ))}
            <button onClick={() => setShowFilters((v) => !v)} aria-label="Filters"
              className={`ml-auto shrink-0 p-2 rounded-full border cursor-pointer ${showFilters || category || district ? "border-[#168821] text-[#168821]" : "border-slate-300 text-slate-500"}`}>
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); restart(setQuery)(q.trim()); }} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rice, goats, fertilizer..."
              className="w-full bg-slate-100 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
          </form>
          {showFilters && (
            <div className="flex gap-2">
              <select value={category} onChange={(e) => restart(setCategory)(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs text-slate-700 focus:outline-none">
                <option value="">All categories</option>
                {meta?.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={district} onChange={(e) => restart(setDistrict)(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs text-slate-700 focus:outline-none">
                <option value="">All districts</option>
                {meta?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {(categoryLabel || district || query) && (
            <p className="text-[11px] text-slate-500 px-1">
              Showing {[categoryLabel, district, query && `"${query}"`].filter(Boolean).join(" · ")}{" "}
              <button onClick={() => { setQ(""); restart(() => { setCategory(""); setDistrict(""); setQuery(""); })(); }}
                className="font-bold text-[#168821] underline cursor-pointer">clear</button>
            </p>
          )}
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

        {loading && posts.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">Loading feed...</div>
        ) : posts.length === 0 ? (
          <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">{tab === "saved" ? "No saved posts yet" : "Nothing here yet"}</p>
            <p className="text-xs text-slate-400 mt-1">
              {tab === "saved" ? "Tap Save on any post to keep it here." : canPost ? "Be the first: start a post above." : "No posts match these filters."}
            </p>
          </div>
        ) : (
          <>
            {posts.map((p) => <FeedPost key={p.id} post={p} />)}
            {hasMore && (
              <button onClick={() => setPage((n) => n + 1)}
                className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-bold py-2.5 rounded-2xl text-xs shadow-xs cursor-pointer">
                Show more posts
              </button>
            )}
          </>
        )}
      </main>

      {/* RIGHT: categories (desktop) */}
      <aside className="hidden lg:block sticky top-3">
        <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="bg-[#d4a000] text-[#0f5c18] font-black text-xs px-4 py-1.5 uppercase tracking-wide">Browse by category</div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {meta?.categories.map((c) => (
              <button key={c.key} onClick={() => restart(setCategory)(category === c.key ? "" : c.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                  category === c.key ? "bg-[#168821] border-[#168821] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
