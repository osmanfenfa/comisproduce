import { Link } from "react-router-dom";
import { MapPin, PlayCircle, ImageOff, BadgeCheck, Store, Heart, MessageCircle } from "lucide-react";
import { priceLabel, qtyLabel, mediaUrl, timeAgo, STATUS_LABEL } from "../../utils/market.js";

/** Compact grid card (used on "My activity"). The main market uses the feed post. */
export default function ListingCard({ listing }) {
  const cover = listing.media.find((m) => m.kind === "photo");
  const hasVideo = listing.media.some((m) => m.kind === "video");
  return (
    <Link
      to={`/market/listing/${listing.id}`}
      className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs hover:shadow-md transition flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        {cover ? (
          <img src={mediaUrl(cover.url)} alt={listing.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="w-8 h-8" />
          </div>
        )}
        <span
          className={`absolute top-1.5 left-1.5 text-[9px] font-black uppercase px-1.5 py-px rounded ${
            listing.kind === "wanted" ? "bg-[#d4a000] text-white" : "bg-[#168821] text-white"
          }`}
        >
          {listing.kind === "wanted" ? "Wanted" : "For sale"}
        </span>
        {hasVideo && <PlayCircle className="absolute top-2 right-2 w-5 h-5 text-white drop-shadow" />}
        {listing.status !== "active" && (
          <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900/80 text-white">
            {STATUS_LABEL[listing.status] || listing.status}
          </span>
        )}
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-0.5">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#b38600]">{listing.category_label}</p>
        <p className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">{listing.title}</p>
        <p className="text-[11px] font-black text-[#0f5c18] mt-0.5">{priceLabel(listing)}</p>
        {listing.quantity != null && (
          <p className="text-[11px] text-slate-500">{qtyLabel(listing.quantity, listing.unit)}</p>
        )}
        <div className="mt-auto pt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            {listing.district}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{listing.like_count}</span>
            <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{listing.comment_count}</span>
            <span>{timeAgo(listing.created_at)}</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
          {["produce_manager", "produce_secretary"].includes(listing.owner.role) ? <Store className="w-3 h-3 shrink-0" /> : null}
          <span className="truncate">{listing.owner.business_name || listing.owner.name}</span>
          {listing.owner.verified && <BadgeCheck className="w-3 h-3 text-[#168821] shrink-0" />}
        </p>
      </div>
    </Link>
  );
}
