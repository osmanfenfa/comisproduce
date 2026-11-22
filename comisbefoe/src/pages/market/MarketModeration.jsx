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
export default function MarketModeration() {
  const [section, setSection] = useState("verifications");
  return (
    <div className="space-y-3 pb-20">
      <Banner>Market Moderation</Banner>
      <div className="flex bg-white border-2 border-[#168821] rounded-full p-1 max-w-md mx-auto">
        {[["verifications", "ID Verifications"], ["reports", "Reported Posts"]].map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`flex-1 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
              section === k ? "bg-[#d4a000] text-[#0f5c18]" : "text-slate-600"}`}>
            {l}
          </button>
        ))}
      </div>
      {section === "verifications" ? <Verifications /> : <Reports />}
    </div>
  );
}
