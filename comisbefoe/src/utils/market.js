import client from "../api/client.js";
import { DISTRICTS } from "./locations.js";

export const MARKET_ROLES = ["farmer", "trader"];
export const isMarketRole = (role) => MARKET_ROLES.includes(role);

const FALLBACK_META = {
  categories: [
    { key: "cocoa", label: "Cocoa" }, { key: "coffee", label: "Coffee" }, { key: "cola", label: "Cola nut" },
    { key: "rice", label: "Rice" }, { key: "cassava", label: "Cassava & gari" },
    { key: "palm_oil", label: "Palm oil & kernels" }, { key: "groundnut", label: "Groundnut" },
    { key: "vegetables", label: "Vegetables" }, { key: "fruits", label: "Fruits" },
    { key: "grains", label: "Maize & grains" }, { key: "livestock", label: "Livestock" },
    { key: "poultry", label: "Poultry & eggs" }, { key: "fish", label: "Fish" },
    { key: "seeds_inputs", label: "Seeds & inputs" }, { key: "tools", label: "Tools & equipment" },
    { key: "other", label: "Other" },
  ],
  units: ["kg", "bag", "ton", "bushel", "piece", "head", "litre", "gallon", "crate", "bunch", "basket"],
  districts: DISTRICTS,
};

let metaPromise = null;
export function loadMarketMeta() {
  if (!metaPromise) {
    metaPromise = client.get("/market/meta").then((r) => r.data).catch(() => {
      metaPromise = null;
      return FALLBACK_META;
    });
  }
  return metaPromise;
}

export const formatNle = (v) =>
  v == null ? null : `Nle ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const PLURALS = { bunch: "bunches", head: "head", kg: "kg" };

/** "12 bags", "1 bag", "250 kg" */
export function qtyLabel(quantity, unit) {
  if (quantity == null) return "";
  const n = Number(quantity);
  const word = n === 1 ? unit : PLURALS[unit] || `${unit}s`;
  return `${n.toLocaleString()} ${word}`;
}

export const STATUS_LABEL = { sold: "Fulfilled", closed: "Closed", removed: "Removed" };

export function priceLabel(listing) {
  if (listing.price == null) return listing.kind === "wanted" ? "Make an offer" : "Price on request";
  return `${formatNle(listing.price)} / ${listing.unit}`;
}

/** Media URLs come back as "/media/..."; in production the API may live on another origin. */
export function mediaUrl(url) {
  if (!url || /^https?:/.test(url)) return url;
  const api = import.meta.env.VITE_API_URL;
  if (api && /^https?:/.test(api)) return new URL(url, api).toString();
  return url;
}

export function timeAgo(iso) {
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(then).toLocaleDateString();
}

/** Shrink photos on the phone before upload (saves mobile data): max 1280px, JPEG ~80%. */
export async function compressImage(file, maxSide = 1280, quality = 0.8) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_MB = 30;

export function videoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
}
