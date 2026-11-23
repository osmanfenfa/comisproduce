import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import client from "../../api/client.js";
import { timeAgo, STATUS_LABEL } from "../../utils/market.js";
import { Banner, Card, PillTabs, PrimaryButton, SecondaryButton } from "../../components/market/ProduceUI.jsx";

const DOC_LABEL = { nin: "National ID (NIN)", passport: "Passport" };

function Reports() {
  const [status, setStatus] = useState("open");
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => client.get("/market/admin/reports", { params: { status } })
    .then(({ data }) => setReports(data)).catch(() => setReports([]));

  useEffect(() => {
    load();
  }, [status]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <PillTabs
        tabs={[["open", "Open"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]]}
        value={status}
        onChange={(s) => { setReports(null); setStatus(s); }}
      />
      {reports === null ? (
        <div className="text-center py-10 text-xs text-slate-400">Loading...</div>
      ) : reports.length === 0 ? (
        <Card bodyClassName="p-8 text-center text-xs text-slate-500">No {status} reports.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reports.map((r) => (
            <Card
              key={r.id}
              title={r.listing_title}
              right={<span className="text-[10px] font-bold text-[#0f5c18] shrink-0">{timeAgo(r.created_at)}</span>}
              bodyClassName="p-3.5 space-y-2 text-xs"
            >
              <p className="text-red-800"><b>Reason:</b> {r.reason}</p>
              <p className="text-slate-500">
                Listing status: <b className="uppercase text-slate-800">{STATUS_LABEL[r.listing_status] || r.listing_status}</b>
                {" · "}
                <Link to={`/market/listing/${r.listing_id}`} className="font-bold text-[#168821] hover:underline">View post</Link>
              </p>
              {status === "open" && (
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryButton disabled={busy} onClick={() => act(() => client.post(`/market/admin/reports/${r.id}/dismiss`))}>
                    Dismiss
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={busy || r.listing_status === "removed"}
                    className="bg-red-600 hover:bg-red-700 text-xs"
                    onClick={() => act(() => client.post(`/market/admin/listings/${r.listing_id}/remove`))}
                  >
                    Remove listing
                  </PrimaryButton>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** The ID photo is private: fetched with the admin's login, shown from memory. */
function IdPhoto({ userId }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = null;
    client.get(`/market/admin/verifications/${userId}/image`, { responseType: "blob" })
      .then(({ data }) => {
        url = URL.createObjectURL(data);
        setSrc(url);
      })
      .catch(() => setFailed(true));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [userId]);

  if (failed) return <p className="text-xs text-slate-400 py-6 text-center">Photo unavailable</p>;
  if (!src) return <p className="text-xs text-slate-400 py-6 text-center">Loading photo...</p>;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt="ID document" className="w-full max-h-72 object-contain bg-slate-900 rounded-xl" />
    </a>
  );
}

function Verifications() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => client.get("/market/admin/verifications", { params: { status } })
    .then(({ data }) => setItems(data)).catch(() => setItems([]));

  useEffect(() => {
    load();
  }, [status]);

  const decide = async (v, decision) => {
    let body;
    if (decision === "reject") {
      const reason = window.prompt("Why is this document not accepted? The member will see this.", "Photo is not clear");
      if (!reason) return;
      body = { reason };
    }
    setBusy(true);
    try {
      await client.post(`/market/admin/verifications/${v.user_id}/${decision}`, body);
      await load();
    } catch (err) {
      window.alert(err.response?.data?.detail || "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <PillTabs
        tabs={[["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"]]}
        value={status}
        onChange={(s) => { setItems(null); setStatus(s); }}
      />
      {items === null ? (
        <div className="text-center py-10 text-xs text-slate-400">Loading...</div>
      ) : items.length === 0 ? (
        <Card bodyClassName="p-8 text-center text-xs text-slate-500">No {status} documents.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((v) => (
            <Card
              key={v.user_id}
              title={`${v.name} · ${v.role}`}
              right={v.submitted_at && <span className="text-[10px] font-bold text-[#0f5c18] shrink-0">{timeAgo(v.submitted_at)}</span>}
              bodyClassName="p-3.5 space-y-2.5 text-xs"
            >
              <IdPhoto userId={v.user_id} />
              <div className="space-y-1">
                <p><span className="text-slate-500">Document:</span> <b>{DOC_LABEL[v.doc_type] || v.doc_type}</b></p>
                <p>
                  <span className="text-slate-500">Number submitted:</span>{" "}
                  <b className="font-mono text-sm text-[#0f5c18]">{v.doc_number || "—"}</b>
                </p>
                <p>
                  <span className="text-slate-500">Read from photo:</span>{" "}
                  <span className="font-mono">{v.number_read || "nothing readable"}</span>
                </p>
                {v.number_edited && (
                  <p className="text-[#b38600] font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Typed or corrected by the member: compare with the photo
                  </p>
                )}
                <p>
                  <span className="text-slate-500">Phone:</span> {v.phone}{" "}
                  {v.phone_verified
                    ? <span className="text-[#168821] font-bold inline-flex items-center gap-0.5"><BadgeCheck className="w-3 h-3" />code confirmed</span>
                    : <span className="text-slate-400">(code not confirmed yet)</span>}
                </p>
                {v.reject_reason && <p className="text-red-700"><b>Rejected:</b> {v.reject_reason}</p>}
              </div>
              {status === "pending" && (
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryButton tone="red" disabled={busy} onClick={() => decide(v, "reject")}>Reject</SecondaryButton>
                  <PrimaryButton disabled={busy} className="text-xs" onClick={() => decide(v, "approve")}>Approve</PrimaryButton>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** System Admin: reported listings and member ID verification. */
function Stat({ label, value, hint }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 text-center">
      <p className="text-xl font-black text-[#0f5c18]">{value ?? "-"}</p>
      <p className="text-[11px] font-bold text-slate-700">{label}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function FeedStats() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    client.get("/market/admin/feed-stats", { params: { days } })
      .then(({ data }) => !cancelled && setStats(data))
      .catch(() => !cancelled && setStats({}));
    return () => {
      cancelled = true;
    };
  }, [days]);
  const pct = (v) => (v == null ? null : `${v}%`);
  if (!stats) return <div className="text-center py-10 text-xs text-slate-400">Loading...</div>;
  return (
    <div className="space-y-3">
      <PillTabs tabs={[[7, "7 days"], [30, "30 days"], [90, "90 days"]]} value={days} onChange={setDays} />
      <Card title="For you feed" bodyClassName="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="Offers" value={stats.offers} />
        <Stat label="From matched members" value={pct(stats.offers_from_matched_members_pct)} hint="already bought or sold that category" />
        <Stat label="Accepted (matched)" value={pct(stats.accept_rate_matched_pct)} hint={`all offers: ${pct(stats.accept_rate_all_pct) ?? "-"}`} />
        <Stat label="Alerts sent" value={stats.alerts_sent} />
        <Stat label="Alerts opened" value={pct(stats.alerts_seen_pct)} />
        <Stat label="Alerts to offer" value={pct(stats.alerts_to_offer_pct)} />
        <Stat label="Members who ticked categories" value={stats.members_with_declared_interests} />
      </Card>
      {stats.weights && (
        <Card title="Current weights" bodyClassName="p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {Object.entries(stats.weights).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#0f5c18] text-[11px] font-bold">{k}: {v}</span>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            Change them on Render with FEED_W_MATCH, FEED_W_NEARBY, FEED_W_FRESH, FEED_W_POPULAR and FEED_W_TRUSTED.
            If matched offers are accepted more often than others, raise match; if few offers come from matches, lower it.
          </p>
        </Card>
      )}
    </div>
  );
}

export default function MarketModeration() {
  const [section, setSection] = useState("verifications");
  return (
    <div className="space-y-3 pb-20">
      <Banner>Market Moderation</Banner>
      <div className="flex bg-white border-2 border-[#168821] rounded-full p-1 max-w-md mx-auto">
        {[["verifications", "ID Verifications"], ["reports", "Reported Posts"], ["feed", "Feed Stats"]].map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`flex-1 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
              section === k ? "bg-[#d4a000] text-[#0f5c18]" : "text-slate-600"}`}>
            {l}
          </button>
        ))}
      </div>
      {section === "verifications" ? <Verifications /> : section === "reports" ? <Reports /> : <FeedStats />}
    </div>
  );
}
