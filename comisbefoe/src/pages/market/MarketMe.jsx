import { useEffect, useState } from "react";
import {
  BadgeCheck, ShieldAlert, Wallet, Store, KeyRound, User, Building2, MapPin, Landmark, Phone, Check, Clock3,
  IdCard, Camera, Hash,
} from "lucide-react";
import client from "../../api/client.js";
import { useAuthStore } from "../../store/authStore.js";
import { loadMarketMeta, formatNle, compressImage } from "../../utils/market.js";
import { Banner, Card, PillInput, PillSelect, PrimaryButton, SecondaryButton } from "../../components/market/ProduceUI.jsx";
import UserAvatar from "../../components/shared/UserAvatar.jsx";
import ProfilePhotoModal from "../../components/shared/ProfilePhotoModal.jsx";

function PhoneVerification({ profile, onVerified }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/market/me/verify-phone/send");
      setSent(true);
      setMsg(data.message);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await client.post("/market/me/verify-phone/confirm", { code });
      onVerified();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Wrong code.");
    } finally {
      setBusy(false);
    }
  };

  if (profile.phone_verified) {
    return <StepDone n={1} text={`Phone number verified (${profile.phone})`} />;
  }
  return (
    <div className="space-y-2">
      <StepTitle n={1} text="Verify your phone number" />
      <p className="text-xs text-slate-600 px-1">We'll send a 6-digit code to <b>{profile.phone}</b>.</p>
      {!sent ? (
        <PrimaryButton disabled={busy} onClick={send}>Send Code</PrimaryButton>
      ) : (
        <form onSubmit={confirm} className="space-y-2">
          <PillInput icon={KeyRound} inputMode="numeric" maxLength={6} required value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" />
          <PrimaryButton disabled={busy || code.length !== 6}>Verify</PrimaryButton>
        </form>
      )}
      {msg && <p className="text-xs text-slate-700 text-center">{msg}</p>}
    </div>
  );
}

function StepTitle({ n, text }) {
  return (
    <p className="text-xs font-black text-[#0f5c18] uppercase tracking-wide flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-[#d4a000] text-[#0f5c18] flex items-center justify-center text-[10px]">{n}</span>
      {text}
    </p>
  );
}

function StepDone({ n, text }) {
  return (
    <p className="text-xs font-bold text-[#0f5c18] flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-[#168821] text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>
      <span className="sr-only">Step {n}: </span>{text}
    </p>
  );
}

const DOC_LABEL = { nin: "National ID card (NIN)", passport: "Passport" };

/** Step 2: photo of the National ID or passport; the system reads the number, the member confirms it. */
function IdVerification({ profile, onChange }) {
  const [docType, setDocType] = useState(profile.id_doc_type || "nin");
  const [file, setFile] = useState(null);
  const [read, setRead] = useState(null);        // result of the upload
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const status = profile.id_status;

  if (status === "verified") {
    return <StepDone n={2} text={`${DOC_LABEL[profile.id_doc_type] || "ID"} verified (${profile.id_doc_number})`} />;
  }
  if (status === "pending") {
    return (
      <div className="space-y-1">
        <StepTitle n={2} text="ID document" />
        <p className="text-xs text-slate-700 px-1 flex items-center gap-1.5">
          <Clock3 className="w-4 h-4 text-[#d4a000]" />
          {DOC_LABEL[profile.id_doc_type]} <b>{profile.id_doc_number}</b> is being reviewed. We'll mark you verified once it's approved.
        </p>
      </div>
    );
  }

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("doc_type", docType);
      form.append("file", await compressImage(file, 2000, 0.9));
      const { data } = await client.post("/market/me/id-document", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 2 * 60 * 1000,
      });
      setRead(data);
      setNumber(data.number_read || "");
      if (!data.number_read) {
        setMsg("We couldn't read the number from the photo. Type it exactly as it appears on the document.");
      }
    } catch (err) {
      setMsg(err.response?.data?.detail || "Upload failed. Try a clearer photo.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await client.post("/market/me/id-document/confirm", { doc_number: number });
      onChange();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not submit. Check the number.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <StepTitle n={2} text="Upload your National ID or passport" />
      {status === "rejected" && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2">
          Your last document was not accepted: {profile.id_reject_reason}. Please upload it again.
        </p>
      )}

      {!read ? (
        <form onSubmit={upload} className="space-y-2">
          <PillSelect icon={IdCard} value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="nin">National ID card (NIN)</option>
            <option value="passport">Passport</option>
          </PillSelect>
          <label className="flex items-center gap-2.5 border border-dashed border-slate-500 rounded-2xl px-3 py-3 cursor-pointer hover:border-[#168821]">
            <span className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0">
              <Camera className="w-4 h-4" />
            </span>
            <span className="text-xs text-slate-700 min-w-0 truncate">
              {file ? file.name : `Take or choose a clear photo of your ${docType === "nin" ? "ID card (front)" : "passport photo page"}`}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <p className="text-[11px] text-slate-500 px-1">
            Lay it flat, in good light, with all four corners showing. Only admins can see this photo.
          </p>
          <PrimaryButton disabled={busy || !file}>{busy ? "Reading the document..." : "Upload & Read Number"}</PrimaryButton>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-2">
          {read.number_read && (
            <p className="text-xs text-slate-700 px-1">
              We read this {read.doc_type === "nin" ? "NIN" : "passport number"} from your photo. Check it and correct it if needed:
            </p>
          )}
          <PillInput icon={Hash} required minLength={5} maxLength={20} value={number}
            onChange={(e) => setNumber(e.target.value.toUpperCase())}
            placeholder={read.doc_type === "nin" ? "NIN" : "Passport number"} />
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton type="button" onClick={() => { setRead(null); setFile(null); setMsg(""); }}>
              Retake photo
            </SecondaryButton>
            <PrimaryButton disabled={busy || number.trim().length < 5}>Submit</PrimaryButton>
          </div>
        </form>
      )}
      {msg && <p className="text-xs text-slate-700 text-center">{msg}</p>}
    </div>
  );
}

function Verification({ profile, onChange }) {
  if (profile.verified) {
    return (
      <Card bodyClassName="p-3">
        <p className="text-xs font-bold text-[#0f5c18] flex items-center justify-center gap-1.5">
          <BadgeCheck className="w-4 h-4" /> Verified member: phone and {DOC_LABEL[profile.id_doc_type] || "ID"} confirmed
        </p>
      </Card>
    );
  }
  return (
    <Card title="Get verified" bodyClassName="p-4 space-y-4">
      <p className="text-xs text-slate-700 flex gap-2">
        <ShieldAlert className="w-4 h-4 text-[#d4a000] shrink-0" />
        <span>
          Verified members get a green badge buyers trust. You need both steps: your phone number and a photo of
          your National ID or passport.
        </span>
      </p>
      <PhoneVerification profile={profile} onVerified={onChange} />
      <IdVerification profile={profile} onChange={onChange} />
    </Card>
  );
}

function StationRecords() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/farmer/records").then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Could not load your records."));
  }, []);

  if (error) return <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>;
  if (!data) return <div className="text-center py-6 text-xs text-slate-400">Loading your station records...</div>;
  if (!data.linked_stations.length) {
    return (
      <Card bodyClassName="p-5 text-center text-xs text-slate-500">
        No buying station has registered you with this phone number yet. When you sell to a station using COMIS,
        your receipts and loans will appear here.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 flex items-center gap-1.5 px-1">
        <Store className="w-4 h-4 text-[#168821]" /> Linked to: <b className="text-slate-900">{data.linked_stations.join(", ")}</b>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Card title="Total received" bodyClassName="p-3 text-center">
          <p className="text-lg font-black text-[#0f5c18]">{formatNle(data.total_sold)}</p>
        </Card>
        <Card title="Loan balance" bodyClassName="p-3 text-center">
          <p className="text-lg font-black text-[#b38600] flex items-center justify-center gap-1">
            <Wallet className="w-4 h-4" /> {formatNle(data.total_owed)}
          </p>
        </Card>
      </div>

      {data.prices.length > 0 && (
        <Card title="Today's prices (per kg)" bodyClassName="p-3 divide-y divide-slate-100">
          {data.prices.map((p) => (
            <div key={p.station} className="py-2 text-xs">
              <p className="font-bold text-slate-900">{p.station}</p>
              <p className="text-slate-600">
                Cocoa {formatNle(p.cocoa_price_per_kg)} · Coffee {formatNle(p.coffee_price_per_kg)} · Cola {formatNle(p.cola_price_per_kg)}
              </p>
            </div>
          ))}
        </Card>
      )}

      <Card title={`Receipts (${data.receipts.length})`} bodyClassName="p-3 divide-y divide-slate-100">
        {data.receipts.length === 0 && <p className="text-xs text-slate-400 py-2">No receipts yet.</p>}
        {data.receipts.map((r) => (
          <div key={r.id} className="py-2 text-xs flex justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono font-bold text-[#168821]">{r.receipt_number}</p>
              <p className="text-slate-500 truncate">
                {r.business_name || r.station_name} · {new Date(r.issued_at).toLocaleDateString()} · <span className="uppercase">{r.transaction_type}</span>
              </p>
              <p className="text-slate-600">
                {r.net_weight_kg ?? r.weight_kg} kg net
                {r.moisture_deduction_kg > 0 && ` (−${r.moisture_deduction_kg} kg moisture)`} @ {formatNle(r.price_per_kg)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-[#0f5c18]">{formatNle(r.net_amount_paid)}</p>
              {r.loan_deduction > 0 && <p className="text-red-600">−{formatNle(r.loan_deduction)} loan</p>}
            </div>
          </div>
        ))}
      </Card>

      {data.loans.length > 0 && (
        <Card title="Loans" bodyClassName="p-3 divide-y divide-slate-100">
          {data.loans.map((l) => (
            <div key={l.id} className="py-2 text-xs flex justify-between">
              <div>
                <p className="font-bold text-slate-900">{l.station}</p>
                <p className="text-slate-500">Taken {l.date}{l.due_date ? ` · due ${l.due_date}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-900">{formatNle(l.balance)}</p>
                <p className="uppercase text-[10px] font-bold text-[#b38600]">{l.status}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export default function MarketMe() {
  const { role, updateProfile, avatarUrl } = useAuthStore();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState("");

  const load = () => client.get("/market/me").then(({ data }) => {
    setProfile(data);
    setForm({ name: data.name, district: data.district || "", chiefdom: data.chiefdom || "", business_name: data.business_name || "" });
  });

  useEffect(() => {
    load();
    loadMarketMeta().then(setMeta);
  }, []);

  if (!profile) return <div className="text-center py-10 text-xs text-slate-400">Loading...</div>;

  const save = async (e) => {
    e.preventDefault();
    setSaved("");
    try {
      const body = { name: form.name, district: form.district, chiefdom: form.chiefdom || null };
      if (role === "trader") body.business_name = form.business_name || null;
      const { data } = await client.put("/market/me", body);
      setProfile(data);
      updateProfile({ name: data.name, produceName: data.business_name || data.name });
      setSaved("Profile saved.");
    } catch (err) {
      setSaved(err.response?.data?.detail || "Could not save.");
    }
  };

  return (
    <div className="space-y-3 pb-20 max-w-xl mx-auto">
      <Banner>My Profile</Banner>
      <ProfilePhotoModal isOpen={photoOpen} onClose={() => setPhotoOpen(false)} />

      <Card bodyClassName="p-4 flex items-center gap-3">
        <button type="button" onClick={() => setPhotoOpen(true)} aria-label="Change profile photo"
          className="relative shrink-0 cursor-pointer">
          <UserAvatar src={avatarUrl} name={profile.name} role={role} size="w-14 h-14 text-xl" />
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#168821] text-white flex items-center justify-center ring-2 ring-white">
            <Camera className="w-3 h-3" />
          </span>
        </button>
        <div className="min-w-0">
          <p className="font-black text-[#0f5c18] flex items-center gap-1 truncate">
            {profile.name}
            {profile.verified && <BadgeCheck className="w-4 h-4 text-[#168821] shrink-0" />}
          </p>
          <p className="text-xs font-bold text-[#b38600]">{role === "farmer" ? "Farmer" : "Trader"}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.phone}</p>
        </div>
      </Card>

      <Verification profile={profile} onChange={load} />

      {role === "farmer" && (
        <section className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wide text-[#0f5c18] px-1">My buying-station records</h2>
          {profile.phone_verified ? (
            <StationRecords />
          ) : (
            <p className="text-xs text-slate-500 px-1">Verify your phone number above to see receipts and loans from stations you sell to.</p>
          )}
        </section>
      )}

      <Card title="Edit profile">
        <form onSubmit={save} className="space-y-2.5">
          <PillInput icon={User} required minLength={2} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name" />
          {role === "trader" && (
            <PillInput icon={Building2} value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Business Name (optional)" />
          )}
          <PillSelect icon={MapPin} required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
            <option value="" disabled>District</option>
            {meta?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </PillSelect>
          <PillInput icon={Landmark} value={form.chiefdom}
            onChange={(e) => setForm({ ...form, chiefdom: e.target.value })} placeholder="Chiefdom" />
          {saved && <p className="text-xs text-[#0f5c18] text-center">{saved}</p>}
          <PrimaryButton className="mt-1">Save Profile</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
