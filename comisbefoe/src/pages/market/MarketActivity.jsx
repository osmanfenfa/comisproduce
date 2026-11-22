import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Phone, Check, X, Scale, Banknote, User, Sparkles } from "lucide-react";
import client from "../../api/client.js";
import { formatNle, qtyLabel, timeAgo } from "../../utils/market.js";
import ListingCard from "../../components/market/ListingCard.jsx";
import CountBadge from "../../components/shared/CountBadge.jsx";
import { Banner, Card, PillTabs, PrimaryButton, SecondaryButton } from "../../components/market/ProduceUI.jsx";
import { useNotificationStore } from "../../store/notificationStore.js";

const STATUS_STYLE = {
  pending: "bg-white text-[#b38600]",
  accepted: "bg-[#168821] text-white",
  declined: "bg-red-600 text-white",
  cancelled: "bg-slate-600 text-white",
};

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-slate-100 last:border-b-0">
      <div className="w-7 h-7 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <span className="text-xs font-bold text-slate-900 min-w-0">{value}</span>
    </div>
  );
}

function OfferCard({ offer, box, onAction, busy }) {
  const other = box === "received" ? offer.from_user : offer.listing_owner;
  const total = offer.quantity != null && offer.price != null ? offer.quantity * offer.price : null;
  return (
    <Card
      title={offer.listing_title}
      right={
        <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-px rounded ${STATUS_STYLE[offer.status]}`}>
          {offer.status}
        </span>
      }
      bodyClassName="p-3.5 space-y-2"
    >
      <div>
        <Row icon={User} label={box === "received" ? "From" : "To"}
          value={`${other.business_name || other.name}${other.district ? ` · ${other.district}` : ""}`} />
        {offer.quantity != null && <Row icon={Scale} label="Quantity" value={qtyLabel(offer.quantity, offer.unit)} />}
        {offer.price != null && (
          <Row icon={Banknote} label="Price" value={
            <>{formatNle(offer.price)} / {offer.unit}{total != null && <span className="text-[#0f5c18]"> = {formatNle(total)}</span>}</>
          } />
        )}
      </div>
      {offer.message && <p className="text-[13px] text-slate-700 px-1">“{offer.message}”</p>}
      <p className="text-[10px] text-slate-400 px-1">
        {timeAgo(offer.created_at)} ·{" "}
        <Link to={`/market/listing/${offer.listing_id}`} className="font-bold text-[#168821] hover:underline">View post</Link>
      </p>

      {offer.counterpart_phone && (
        <a
          href={`tel:${offer.counterpart_phone}`}
          className="flex items-center justify-center gap-1.5 bg-[#168821] text-white font-black text-sm rounded-full py-2.5 shadow-sm"
        >
          <Phone className="w-4 h-4" /> Call {other.name}: {offer.counterpart_phone}
        </a>
      )}

      {offer.status === "pending" && box === "received" && (
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton tone="red" disabled={busy} onClick={() => onAction(offer, "decline")}>
            <X className="w-3.5 h-3.5" /> Decline
          </SecondaryButton>
          <PrimaryButton disabled={busy} className="text-xs" onClick={() => onAction(offer, "accept")}>
            <Check className="w-3.5 h-3.5" /> Accept
          </PrimaryButton>
        </div>
      )}
      {offer.status === "pending" && box === "sent" && (
        <SecondaryButton disabled={busy} onClick={() => onAction(offer, "cancel")}>Cancel offer</SecondaryButton>
      )}
    </Card>
  );
}

export default function MarketActivity() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "listings";
  const [listings, setListings] = useState(null);
  const [offers, setOffers] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [busy, setBusy] = useState(false);
  const { offersReceived, offerUpdates, matches, refresh, markUpdatesSeen, markMatchesSeen } = useNotificationStore();

  // Opening "Offers sent" means the accept/decline answers have been seen
  useEffect(() => {
    if (tab === "sent") markUpdatesSeen();
  }, [tab, markUpdatesSeen]);

  useEffect(() => {
    if (tab === "matches") {
      // Load first (so "new" marks show), then clear the badge
      client.get("/market/alerts")
        .then(({ data }) => setAlerts(data))
        .catch(() => setAlerts([]))
        .finally(() => markMatchesSeen());
    } else if (tab === "listings") {
      client.get("/market/my-listings").then(({ data }) => setListings(data)).catch(() => setListings([]));
    } else {
      client.get("/market/offers", { params: { box: tab } }).then(({ data }) => setOffers(data)).catch(() => setOffers([]));
    }
  }, [tab, markMatchesSeen]);

  const act = async (offer, action) => {
    if (action === "accept" && !window.confirm("Accept this offer? You and the other person will see each other's phone numbers.")) return;
    setBusy(true);
    try {
      const { data } = await client.post(`/market/offers/${offer.id}/${action}`);
      setOffers((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      refresh();
    } catch (err) {
      window.alert(err.response?.data?.detail || "Could not update the offer.");
    } finally {
      setBusy(false);
    }
  };

  const empty = (text) => (
    <Card bodyClassName="p-8 text-center text-xs text-slate-500">{text}</Card>
  );

  return (
    <div className="space-y-3 pb-20">
      <Banner>My Activity</Banner>
      <PillTabs
        tabs={[
          ["listings", "My Listings"],
          ["received", <>Offers Received <CountBadge count={offersReceived} className="ml-1 inline-block align-middle" /></>],
          ["sent", <>Offers Sent <CountBadge count={offerUpdates} className="ml-1 inline-block align-middle" /></>],
          ["matches", <>For You <CountBadge count={matches} className="ml-1 inline-block align-middle" /></>],
        ]}
        value={tab}
        onChange={(k) => { setOffers(null); setAlerts(null); setParams({ tab: k }); }}
      />

      {tab === "matches" ? (
        alerts === null ? (
          <div className="text-center py-10 text-xs text-slate-400">Loading...</div>
        ) : alerts.length === 0 ? (
          empty("No new matches yet. When someone posts what you buy or sell, it will show here.")
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {alerts.map((a) => (
              <div key={a.id} className="space-y-1">
                <p className="text-[10px] font-bold text-[#168821] flex items-center gap-1 px-1 truncate">
                  <Sparkles className="w-3 h-3 shrink-0" /> {a.reason} · {timeAgo(a.created_at)}
                  {!a.seen && <span className="ml-auto shrink-0 bg-[#d4a000] text-[#0f5c18] text-[9px] font-black px-1.5 rounded-full">NEW</span>}
                </p>
                <ListingCard listing={a.listing} />
              </div>
            ))}
          </div>
        )
      ) : tab === "listings" ? (
        listings === null ? (
          <div className="text-center py-10 text-xs text-slate-400">Loading...</div>
        ) : listings.length === 0 ? (
          empty(<>You haven't posted anything yet. <Link to="/market/new" className="font-bold text-[#168821] underline">Post now</Link></>)
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {listings.map((l) => (
              <div key={l.id} className="relative">
                <ListingCard listing={l} />
                {l.pending_offers > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#d4a000] text-[#0f5c18] text-[10px] font-black px-1.5 py-0.5 rounded-full shadow">
                    {l.pending_offers} offer{l.pending_offers > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      ) : offers === null ? (
        <div className="text-center py-10 text-xs text-slate-400">Loading...</div>
      ) : offers.length === 0 ? (
        empty("No offers yet.")
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {offers.map((o) => <OfferCard key={o.id} offer={o} box={tab} onAction={act} busy={busy} />)}
        </div>
      )}
    </div>
  );
}
