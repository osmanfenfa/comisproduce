import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Camera, Video, X, Loader2, LayoutGrid, Type, Scale, Package, Banknote, MapPin, Landmark,
  CalendarDays, FileText,
} from "lucide-react";
import {
  Card, PillTabs, PillInput, PillSelect, PillTextArea, PrimaryButton, SecondaryButton,
} from "../../components/market/ProduceUI.jsx";
import client from "../../api/client.js";
import {
  loadMarketMeta, compressImage, videoDuration, mediaUrl, MAX_VIDEO_SECONDS, MAX_VIDEO_MB,
} from "../../utils/market.js";

const MAX_PHOTOS = 6;
const today = () => new Date().toISOString().split("T")[0];

export default function MarketPost() {
  const { id } = useParams();            // present when editing
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);

  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState(searchParams.get("kind") === "wanted" ? "wanted" : "sell");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(true);
  const [district, setDistrict] = useState("");
  const [chiefdom, setChiefdom] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");

  // Existing media (editing) and newly picked files
  const [existing, setExisting] = useState([]);
  const [photos, setPhotos] = useState([]);   // File[]
  const [video, setVideo] = useState(null);   // File | null
  const photoInput = useRef(null);
  const videoInput = useRef(null);

  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMarketMeta().then(setMeta);
    if (id) {
      client.get(`/market/listings/${id}`).then(({ data }) => {
        setKind(data.kind);
        setCategory(data.category);
        setTitle(data.title);
        setDescription(data.description || "");
        setQuantity(data.quantity ?? "");
        setUnit(data.unit);
        setPrice(data.price ?? "");
        setNegotiable(data.negotiable);
        setDistrict(data.district);
        setChiefdom(data.chiefdom || "");
        setAvailableFrom(data.available_from || "");
        setExisting(data.media);
      });
    } else {
      client.get("/market/me").then(({ data }) => {
        if (data.district) setDistrict(data.district);
        if (data.chiefdom) setChiefdom(data.chiefdom);
      }).catch(() => {});
    }
  }, [id]);

  const existingPhotos = existing.filter((m) => m.kind === "photo").length;
  const existingVideo = existing.some((m) => m.kind === "video");
  const photoSlots = MAX_PHOTOS - existingPhotos - photos.length;

  const pickPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, photoSlots));
    e.target.value = "";
    setPhotos((prev) => [...prev, ...files]);
  };

  const pickVideo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video is too large. Keep it under ${MAX_VIDEO_MB} MB (about 1 minute at 720p).`);
      return;
    }
    const seconds = await videoDuration(file);
    if (seconds && seconds > MAX_VIDEO_SECONDS + 1) {
      setError(`Video is ${Math.round(seconds)}s long. Keep it under ${MAX_VIDEO_SECONDS} seconds.`);
      return;
    }
    setVideo(file);
  };

  const removeExisting = async (media) => {
    await client.delete(`/market/listings/${id}/media/${media.id}`);
    setExisting((prev) => prev.filter((m) => m.id !== media.id));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = {
      kind, category, title: title.trim(), description: description.trim() || null,
      quantity: quantity === "" ? null : Number(quantity), unit,
      price: price === "" ? null : Number(price), negotiable,
      district, chiefdom: chiefdom.trim() || null, available_from: availableFrom || null,
    };
    try {
      const { data } = id ? await client.put(`/market/listings/${id}`, body) : await client.post("/market/listings", body);
      const uploads = [...photos.map((f) => ["photo", f]), ...(video ? [["video", video]] : [])];
      let failed = 0;
      let reason = "";
      for (let i = 0; i < uploads.length; i++) {
        const [kindOf, file] = uploads[i];
        setProgress(`Uploading ${kindOf} ${i + 1} of ${uploads.length}...`);
        try {
          const ready = kindOf === "photo" ? await compressImage(file) : file;
          const form = new FormData();
          form.append("file", ready);
          await client.post(`/market/listings/${data.id}/media`, form, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 5 * 60 * 1000,
          });
        } catch (err) {
          failed++;
          reason = err.response?.data?.detail || reason;
        }
      }
      setProgress("");
      if (failed) {
        window.alert(`${failed} file(s) could not be uploaded.${reason ? `

${reason}` : ""}

Open the listing and use Edit to try again.`);
      }
      navigate(`/market/listing/${data.id}`, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? "Check the highlighted fields and try again." : detail || "Could not save the listing.");
    } finally {
      setSaving(false);
      setProgress("");
    }
  };

  const tip = "text-[11px] text-slate-500 px-3 -mt-1";

  return (
    <div className="space-y-3 pb-20 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-xs font-semibold text-[#168821] flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <PillTabs
        tabs={[["sell", "I'm selling"], ["wanted", "I want to buy"]]}
        value={kind}
        onChange={setKind}
      />

      <Card title={id ? "Edit listing" : kind === "sell" ? "Post produce for sale" : "Post what you want to buy"}>
        <form onSubmit={submit} className="space-y-2.5">
          <PillSelect icon={LayoutGrid} required value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>Category</option>
            {meta?.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </PillSelect>

          <PillInput icon={Type} required minLength={3} maxLength={120} value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "sell" ? "Title, e.g. Dry cocoa beans, grade 1" : "Title, e.g. Need 2 tons of palm kernels"} />

          <div className="grid grid-cols-2 gap-2">
            <PillInput icon={Scale} type="number" min="0" step="any" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
            <PillSelect icon={Package} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {(meta?.units || ["kg"]).map((u) => <option key={u} value={u}>{u}</option>)}
            </PillSelect>
          </div>

          <PillInput icon={Banknote} type="number" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder={`Price per ${unit} (Nle), leave empty if open`} />

          <label className="flex items-center gap-2 px-3 text-xs font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-400 text-[#168821] focus:ring-[#168821]" />
            Price is negotiable
          </label>

          <div className="grid grid-cols-2 gap-2">
            <PillSelect icon={MapPin} required value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="" disabled>District</option>
              {meta?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </PillSelect>
            <PillInput icon={Landmark} value={chiefdom} onChange={(e) => setChiefdom(e.target.value)} placeholder="Chiefdom" />
          </div>

          <PillInput icon={CalendarDays} type="date" min={today()} value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)} aria-label={kind === "sell" ? "Available from" : "Needed by"} />
          <p className={tip}>{kind === "sell" ? "Available from" : "Needed by"} (optional)</p>

          <PillTextArea icon={FileText} rows={4} maxLength={2000} value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description: quality, moisture, packing, delivery... (optional)" />

          {/* Media */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-[#0f5c18] px-1">
              Photos (up to {MAX_PHOTOS}) and one short video (max {MAX_VIDEO_SECONDS}s)
            </p>
            {(existing.length > 0 || photos.length > 0 || video) && (
              <div className="flex flex-wrap gap-2">
                {existing.map((m) => (
                  <div key={m.id} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#168821] bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    {m.kind === "photo" ? <img src={mediaUrl(m.url)} alt="" className="w-full h-full object-cover" /> : "▶ Video"}
                    <button type="button" onClick={() => removeExisting(m)} aria-label="Remove"
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                {photos.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#168821] bg-slate-200">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label="Remove"
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                {video && (
                  <div className="relative w-20 h-20 rounded-xl border-2 border-[#168821] bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center text-center p-1">
                    ▶ {video.name.slice(0, 14)}
                    <button type="button" onClick={() => setVideo(null)} aria-label="Remove"
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <SecondaryButton type="button" disabled={photoSlots <= 0} onClick={() => photoInput.current?.click()}>
                <Camera className="w-4 h-4 text-[#168821]" /> Add photos
              </SecondaryButton>
              <SecondaryButton type="button" tone="gold" disabled={!!video || existingVideo} onClick={() => videoInput.current?.click()}>
                <Video className="w-4 h-4" /> Add video
              </SecondaryButton>
            </div>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pickPhotos} />
            <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={pickVideo} />
            <p className="text-[11px] text-slate-400 px-1">Photos are shrunk on your phone before upload to save data.</p>
          </div>

          {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">{error}</div>}

          <PrimaryButton disabled={saving} className="mt-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {progress || (saving ? "Saving..." : id ? "Save Changes" : "Post Listing")}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
