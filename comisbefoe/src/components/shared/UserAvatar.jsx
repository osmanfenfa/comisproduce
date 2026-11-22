import { useState } from "react";
import { Store } from "lucide-react";
import { mediaUrl } from "../../utils/market.js";

const STATION_ROLES = ["produce_manager", "produce_secretary"];

/** Profile photo, or a fallback: the store icon for buying stations, otherwise the first letter. */
export default function UserAvatar({ src, name, role, size = "w-11 h-11 text-base", className = "" }) {
  const [broken, setBroken] = useState(false);
  const base = `${size} rounded-full shrink-0 overflow-hidden ${className}`;

  if (src && !broken) {
    return (
      <img
        src={mediaUrl(src)}
        alt={name ? `${name}'s photo` : "Profile photo"}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${base} object-cover bg-slate-200`}
      />
    );
  }
  return (
    <div className={`${base} bg-emerald-100 text-emerald-900 flex items-center justify-center font-black`}>
      {STATION_ROLES.includes(role) ? <Store className="w-1/2 h-1/2" /> : (name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
