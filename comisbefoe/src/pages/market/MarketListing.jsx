import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, BadgeCheck, Flag, Pencil, Trash2, CheckCircle2, Scale, Clock, Banknote,
  MessageSquare, HandCoins,
} from "lucide-react";
import {
  Card, Modal, PillInput, PillTextArea, PrimaryButton, SecondaryButton,
} from "../../components/market/ProduceUI.jsx";
import client from "../../api/client.js";
import { useAuthStore } from "../../store/authStore.js";
import { priceLabel, qtyLabel, mediaUrl, timeAgo, formatNle, STATUS_LABEL } from "../../utils/market.js";
import { PostActions, Comments } from "../../components/market/FeedPost.jsx";
import UserAvatar from "../../components/shared/UserAvatar.jsx";

const ROLE_LABEL = { farmer: "Farmer", trader: "Trader", produce_manager: "Buying station", produce_secretary: "Buying station" };

export default function MarketListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const [showOffer, setShowOffer] = useState(false);
  const [offerQty, setOfferQty] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = () =>
    client
      .get(`/market/listings/${id}`)
      .then(({ data }) => setListing(data))
      .catch((err) => setError(err.response?.data?.detail || "Listing not found."));

  useEffect(() => {
    load();
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3">
        <Link to="/market" className="text-xs font-semibold text-[#168821] flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to market
        </Link>
        <div className="border-2 border-[#168821] rounded-2xl bg-white p-8 text-center text-sm text-slate-600">{error}</div>
      </div>
    );
  }
  if (!listing) return <div className="text-center py-10 text-xs text-slate-400">Loading...</div>;

  const media = listing.media;
  const current = media[active];
  const isWanted = listing.kind === "wanted";
  const canTrade = role !== "system_admin" && !listing.is_mine && listing.status === "active";

  const run = async (fn, okMessage) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      if (okMessage) setNotice(okMessage);
      await load();
    } catch (err) {
      setNotice(err.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitOffer = (e) => {
    e.preventDefault();
    run(async () => {
      await client.post(`/market/listings/${listing.id}/offers`, {
        quantity: offerQty ? Number(offerQty) : null,
        price: offerPrice ? Number(offerPrice) : null,
        message: offerMsg.trim() || null,
      });
      setShowOffer(false);
    }, "Offer sent. You'll see the seller's phone number here once they accept.");
  };

  // Icon + value only; the label is kept for screen readers and long-press tooltips
  const info = (Icon, label, value) => (
    <span title={label} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 whitespace-nowrap">
      <Icon className="w-3.5 h-3.5 text-[#168821] shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );

  const longDescription = (listing.description || "").length > 220;

  return (
    <div className="space-y-3 pb-20 max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-xs font-semibold text-[#168821] flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Details: plain, no card */}
      <section className="px-1 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-black uppercase tracking-wide">
          <span className={`px-1.5 py-px rounded text-white ${isWanted ? "bg-[#d4a000]" : "bg-[#168821]"}`}>
            {isWanted ? "Wanted" : "For sale"}
          </span>
          <span className="text-[#b38600]">{listing.category_label}</span>
          {listing.status !== "active" && (
            <span className={`px-1.5 py-px rounded text-white ${listing.status === "sold" ? "bg-[#0f5c18]" : "bg-slate-700"}`}>
              {STATUS_LABEL[listing.status] || listing.status}
            </span>
          )}
        </div>
        <h1 className="text-[15px] font-bold text-slate-900 leading-snug">{listing.title}</h1>
        <p className="text-sm font-black text-[#0f5c18]">
          {priceLabel(listing)}
          {listing.negotiable && listing.price != null && (
            <span className="ml-1.5 text-[11px] font-medium text-slate-400">· negotiable</span>
          )}
        </p>
        <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {listing.quantity != null && info(Scale, "Quantity", qtyLabel(listing.quantity, listing.unit))}
          {info(MapPin, "Location", [listing.chiefdom, listing.district].filter(Boolean).join(", "))}
          {listing.available_from && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 whitespace-nowrap">
              <span className="text-slate-500 font-medium">{isWanted ? "Needed by" : "Available from"}</span>
              {listing.available_from}
            </span>
          )}
          {info(Clock, "Posted", timeAgo(listing.created_at))}
        </div>
        {listing.description && (
          <>
            <p className={`text-[13px] text-slate-700 whitespace-pre-line break-words pt-1 ${
              longDescription && !showFullDescription ? "line-clamp-4" : ""}`}>
              {listing.description}
            </p>
            {longDescription && !showFullDescription && (
              <button onClick={() => setShowFullDescription(true)}
                className="text-xs font-semibold text-slate-500 hover:text-[#168821] cursor-pointer">
                ...see more
              </button>
            )}
          </>
        )}

        <div className="flex items-center gap-2 pt-2">
          <UserAvatar src={listing.owner.avatar_url} name={listing.owner.business_name || listing.owner.name}
            role={listing.owner.role} size="w-8 h-8 text-xs" />
          <div className="min-w-0 leading-tight">
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
              {listing.owner.business_name || listing.owner.name}
              {listing.owner.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#168821]" title="Verified" />}
            </p>
            <p className="text-[10px] text-slate-500">
              {ROLE_LABEL[listing.owner.role] || "Member"}{listing.owner.district ? ` · ${listing.owner.district}` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* Photo/video and the conversation about it, in one card (like a feed post) */}
      <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
        {/* Gallery */}
        <div className="bg-black aspect-[4/3] flex items-center justify-center">
          {!current ? (
            <span className="text-xs text-slate-400">No photos</span>
          ) : current.kind === "video" ? (
            <video src={mediaUrl(current.url)} controls playsInline preload="metadata" className="w-full h-full object-contain" />
          ) : (
            <img src={mediaUrl(current.url)} alt={listing.title} className="w-full h-full object-contain" />
          )}
        </div>
        {media.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2.5">
            {media.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setActive(i)}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 ${
                  i === active ? "border-[#168821]" : "border-slate-200"
                } bg-slate-200 text-[10px] font-bold text-slate-600 cursor-pointer`}
              >
                {m.kind === "video" ? "▶ Video" : <img src={mediaUrl(m.url)} alt="" className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        )}

        {listing.status !== "removed" && (
          <div className="mt-1">
            <PostActions post={listing} onChange={setListing} onCommentClick={() => document.getElementById("comment-box")?.focus()} />
            <div id="comments">
              <Comments post={listing} onCountChange={(n) => setListing((l) => ({ ...l, comment_count: n }))} />
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">{notice}</div>
      )}

      {/* Actions */}
      {listing.is_mine ? (
        <Card title="Your listing" bodyClassName="p-3 space-y-2.5">
          <Link to="/market/activity?tab=received"
            className="block text-center text-xs font-bold text-[#168821] underline">
            {listing.pending_offers || 0} pending offer(s): view in My activity
          </Link>
          <div className="grid grid-cols-3 gap-2">
            <SecondaryButton onClick={() => navigate(`/market/edit/${listing.id}`)}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </SecondaryButton>
            {listing.status === "active" ? (
              <PrimaryButton
                disabled={busy}
                className="text-xs"
                onClick={() => run(() => client.post(`/market/listings/${listing.id}/status`, { status: "sold" }),
                  "Marked as fulfilled. It stays in the feed; new offers are closed.")}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
              </PrimaryButton>
            ) : listing.status !== "removed" ? (
              <PrimaryButton
                disabled={busy}
                className="text-xs"
                onClick={() => run(() => client.post(`/market/listings/${listing.id}/status`, { status: "active" }), "Listing is live again.")}
              >
                Reopen
              </PrimaryButton>
            ) : <span />}
            <SecondaryButton
              tone="red"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Delete this listing and its photos?")) return;
                await client.delete(`/market/listings/${listing.id}`);
                navigate("/market/activity");
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </SecondaryButton>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {canTrade && !["pending", "accepted"].includes(listing.my_offer_status) && (
            <PrimaryButton onClick={() => setShowOffer(true)}>
              <HandCoins className="w-4 h-4" /> {isWanted ? "Offer to Supply" : "Make an Offer"}
            </PrimaryButton>
          )}
          {listing.my_offer_status && (
            <Link
              to="/market/activity?tab=sent"
              className="block text-center text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-full py-2.5"
            >
              Your offer: <span className="uppercase font-black text-[#168821]">{listing.my_offer_status}</span> · view in My activity
            </Link>
          )}
          {role !== "system_admin" && (
            <button
              onClick={() => setShowReport(true)}
              className="w-full text-[11px] text-slate-500 flex items-center justify-center gap-1 py-1.5 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" /> Report this listing
            </button>
          )}
        </div>
      )}

      {role === "system_admin" && listing.status !== "removed" && (
        <PrimaryButton
          disabled={busy}
          className="bg-red-600 hover:bg-red-700"
          onClick={() => run(() => client.post(`/market/admin/listings/${listing.id}/remove`), "Listing removed.")}
        >
          Remove listing (moderation)
        </PrimaryButton>
      )}

      {/* Offer form */}
      {showOffer && (
        <Modal title={isWanted ? "Offer to supply" : "Make an offer"} onClose={() => setShowOffer(false)}>
          <form onSubmit={submitOffer} className="space-y-2.5">
            <p className="text-xs text-slate-600 text-center">
              Asking: <b className="text-[#0f5c18]">{priceLabel(listing)}</b>
              {listing.quantity != null && ` · ${qtyLabel(listing.quantity, listing.unit)} available`}
            </p>
            <PillInput icon={Scale} type="number" min="0" step="any" value={offerQty}
              onChange={(e) => setOfferQty(e.target.value)} placeholder={`Quantity (${listing.unit})`} />
            <PillInput icon={Banknote} type="number" min="0" step="0.01" value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)} placeholder={`Your price per ${listing.unit} (Nle)`} />
            {offerQty && offerPrice && (
              <p className="text-xs text-slate-700 text-center">
                Total: <b className="text-[#0f5c18]">{formatNle(Number(offerQty) * Number(offerPrice))}</b>
              </p>
            )}
            <PillTextArea icon={MessageSquare} rows={3} maxLength={500} value={offerMsg}
              onChange={(e) => setOfferMsg(e.target.value)} placeholder="Message, e.g. when and where you can collect" />
            <p className="text-[11px] text-slate-500 px-2">
              Your phone number is shared with the other side only if they accept. Payment is agreed between you.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <SecondaryButton type="button" onClick={() => setShowOffer(false)}>Cancel</SecondaryButton>
              <PrimaryButton disabled={busy}>{busy ? "Sending..." : "Send Offer"}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Report form */}
      {showReport && (
        <Modal title="Report listing" onClose={() => setShowReport(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await client.post(`/market/listings/${listing.id}/report`, { reason: reportReason });
                setShowReport(false);
                setReportReason("");
              }, "Thank you. A moderator will review this listing.");
            }}
            className="space-y-2.5"
          >
            <PillTextArea icon={Flag} required minLength={5} rows={3} value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What's wrong? e.g. fake photos, scam, prohibited item" />
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton type="button" onClick={() => setShowReport(false)}>Cancel</SecondaryButton>
              <PrimaryButton disabled={busy} className="bg-red-600 hover:bg-red-700">Send Report</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
