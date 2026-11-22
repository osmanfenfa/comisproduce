import { useRef, useState } from "react";
import { Camera, Trash2, X, Loader2 } from "lucide-react";
import client from "../../api/client.js";
import { useAuthStore } from "../../store/authStore.js";
import { compressImage } from "../../utils/market.js";
import UserAvatar from "./UserAvatar.jsx";

/** Change or remove the signed-in user's profile photo (every role). */
export default function ProfilePhotoModal({ isOpen, onClose }) {
  const { avatarUrl, name, role, setAvatar } = useAuthStore();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", await compressImage(file, 800, 0.85));
      const { data } = await client.post("/profile/photo", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 2 * 60 * 1000,
      });
      setAvatar(data.avatar_url);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Try another photo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await client.delete("/profile/photo");
      setAvatar(null);
      onClose();
    } catch {
      setError("Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-sm border-2 border-[#168821] rounded-t-2xl sm:rounded-2xl overflow-hidden bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#d4a000] py-2 px-4 flex items-center justify-between">
          <h2 className="text-[#0f5c18] font-black text-sm uppercase tracking-wide">Profile photo</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#0f5c18] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          <UserAvatar src={avatarUrl} name={name} role={role} size="w-28 h-28 text-4xl" className="ring-4 ring-emerald-100" />
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          <button
            disabled={busy}
            onClick={() => input.current?.click()}
            className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm py-2.5 rounded-full shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {avatarUrl ? "Change Photo" : "Add Photo"}
          </button>
          {avatarUrl && (
            <button disabled={busy} onClick={remove}
              className="w-full bg-white text-red-700 border border-red-200 font-bold text-xs py-2.5 rounded-full flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Remove photo
            </button>
          )}
          {error && <p className="text-xs text-red-700 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
