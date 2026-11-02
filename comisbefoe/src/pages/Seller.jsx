import { useState, useEffect, useRef } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  Search, Plus, User, Phone, MapPin, AlertCircle, 
  X, Check, History, Wallet, ArrowRight, UserX, UserCheck,
  Upload, Download, FileSpreadsheet
} from "lucide-react";

import { DISTRICTS as DEFAULT_DISTRICTS, sellerLocation } from "../utils/locations.js";

async function downloadBlob(url, filename) {
  const res = await client.get(url, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default function Seller() {
  const { role } = useAuthStore();
  const { sellers, loadingSellers, fetchSellers, addLocalSeller } = useAppStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerHistory, setSellerHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // New seller form state
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [section, setSection] = useState("");
  const [chiefdom, setChiefdom] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState(DEFAULT_DISTRICTS);
  const [regError, setRegError] = useState("");

  // Bulk upload state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  // Secretary loan balance cache
  const [secretaryBalances, setSecretaryBalances] = useState({});

  useEffect(() => {
    fetchSellers();
    client.get("/sellers/districts").then(({ data }) => {
      if (Array.isArray(data) && data.length) setDistricts(data);
    }).catch(() => {});
  }, []);

  // Filter sellers
  const filtered = sellers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.contact?.toLowerCase().includes(term) ||
      s.seller_id?.toLowerCase().includes(term) ||
      s.chiefdom?.toLowerCase().includes(term) ||
      s.district?.toLowerCase().includes(term) ||
      s.section?.toLowerCase().includes(term)
    );
  });

  // Handle register seller
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError("");
    setSubmitting(true);
    try {
      const { data } = await client.post("/sellers/", {
        name,
        gender,
        address,
        contact,
        section: section.trim() || null,
        chiefdom: chiefdom.trim(),
        district,
      });
      addLocalSeller(data);
      setShowRegisterModal(false);
      setName("");
      setAddress("");
      setContact("");
      setSection("");
      setChiefdom("");
      setDistrict("");
    } catch (err) {
      setRegError(err.response?.data?.detail || "Could not register seller");
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk upload: preview (dry run) first, then import
  const resetBulk = () => {
    setBulkFile(null);
    setBulkResult(null);
    setBulkError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runBulkUpload = async (file, dryRun) => {
    setBulkBusy(true);
    setBulkError("");
    try {
      const form = new FormData();
      form.append("file", file);
      // Let the browser set the multipart boundary
      const { data } = await client.post(`/sellers/bulk-upload?dry_run=${dryRun}`, form);
      setBulkResult(data);
      if (!dryRun) fetchSellers();
    } catch (err) {
      setBulkResult(null);
      setBulkError(err.response?.data?.detail || "Could not read the file. Check it and try again.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    runBulkUpload(file, true);
  };

  const handleTemplateDownload = async (format) => {
    try {
      await downloadBlob(`/sellers/bulk-template?format=${format}`, `COMIS_Seller_Import_Template.${format}`);
    } catch {
      setBulkError("Could not download the template.");
    }
  };

  // View seller details / history
  const handleSelectSeller = async (seller) => {
    setSelectedSeller(seller);
    if (role === "produce_secretary") {
      // Secretary only fetches balance-only endpoint
      try {
        const { data } = await client.get(`/sellers/${seller.id}/balance`);
        setSecretaryBalances((prev) => ({ ...prev, [seller.id]: data.outstanding_balance }));
      } catch (e) {}
    } else {
      // Manager / Admin fetches full profile history
      setLoadingHistory(true);
      try {
        const { data } = await client.get(`/sellers/${seller.id}/history`);
        setSellerHistory(data);
      } catch (e) {
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  // Deactivate / Reactivate
  const toggleSellerActive = async (seller) => {
    if (role === "produce_secretary") return;
    try {
      const endpoint = seller.is_active ? `/sellers/${seller.id}/deactivate` : `/sellers/${seller.id}/reactivate`;
      const { data } = await client.post(endpoint);
      setSelectedSeller(data);
      fetchSellers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update seller status");
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sellers Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">Register, search, and verify sellers</p>
        </div>
        <div className="flex items-center gap-2">
          {role !== "system_admin" && (
            <button
              onClick={() => { resetBulk(); setShowBulkModal(true); }}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Upload</span>
            </button>
          )}
          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Seller</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by name, phone, ID (SL-...), chiefdom or district"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-sm"
        />
      </div>

      {/* Sellers List */}
      <div className="space-y-2">
        {loadingSellers ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading sellers...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No sellers found</p>
            <p className="text-xs text-slate-400 mt-1">Tap "New Seller" to register one now.</p>
          </div>
        ) : (
          filtered.map((seller) => (
            <div
              key={seller.id}
              onClick={() => handleSelectSeller(seller)}
              className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between hover:border-emerald-600 cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-900 flex items-center justify-center font-bold text-sm">
                  {seller.name?.charAt(0) || "S"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{seller.name}</p>
                    <span className="text-[10px] bg-slate-100 font-mono text-slate-600 px-1.5 py-0.5 rounded">
                      {seller.seller_id}
                    </span>
                    {!seller.is_active && (
                      <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-medium">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{seller.contact || "No phone"}</span>
                    <span>·</span>
                    <span>
                      {seller.chiefdom || seller.district
                        ? [seller.chiefdom, seller.district].filter(Boolean).join(", ")
                        : seller.address || "—"}
                    </span>
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </div>
          ))
        )}
      </div>

      {/* =========================================================================
          REGISTER SELLER MODAL
          ========================================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Register New Seller</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regError && (
              <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Joseph Koroma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+23276123456"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address / Village</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hangha Town"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                  <select
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none bg-white"
                  >
                    <option value="" disabled>Select district</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chiefdom</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nongowa"
                    value={chiefdom}
                    onChange={(e) => setChiefdom(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hangha"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-800 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-900 transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Seller"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          BULK UPLOAD MODAL (CSV / Excel)
          ========================================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Bulk Upload Sellers</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Import many sellers at once from CSV or Excel</p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Step 1: template */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-800">1. Download the template</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Columns: Full Name, Gender, Phone Number, Address / Village, Section, Chiefdom, District.
                  Full Name, Chiefdom and District are required.
                </p>
                <div className="flex gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => handleTemplateDownload("xlsx")}
                    className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTemplateDownload("csv")}
                    className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2 rounded-xl text-xs hover:bg-white flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: choose file */}
              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1.5">2. Choose your filled file</p>
                <label className="block border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-4 text-center cursor-pointer transition">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                  <span className="block text-xs font-semibold text-slate-700 mt-1.5">
                    {bulkFile ? bulkFile.name : "Tap to select a .csv or .xlsx file"}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Up to 5,000 sellers · max 5 MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleBulkFileChosen}
                    className="hidden"
                  />
                </label>
              </div>

              {bulkError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bulkError}</span>
                </div>
              )}

              {bulkBusy && (
                <div className="text-center py-3 text-xs text-slate-400">Checking file...</div>
              )}

              {/* Step 3: preview / result */}
              {bulkResult && !bulkBusy && (
                <div className="space-y-3">
                  {!bulkResult.dry_run && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>
                        <b>{bulkResult.created}</b> seller{bulkResult.created === 1 ? "" : "s"} imported successfully.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                        {bulkResult.dry_run ? "Ready" : "Imported"}
                      </span>
                      <span className="text-lg font-black text-emerald-900">
                        {bulkResult.dry_run ? bulkResult.valid_rows : bulkResult.created}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Already exist</span>
                      <span className="text-lg font-black text-slate-800">{bulkResult.skipped_duplicates}</span>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2">
                      <span className="text-[10px] uppercase font-bold text-red-700 block">Errors</span>
                      <span className="text-lg font-black text-red-800">{bulkResult.errors.length}</span>
                    </div>
                  </div>

                  {bulkResult.dry_run && bulkResult.preview.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Preview</p>
                      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto">
                        {bulkResult.preview.map((p, idx) => (
                          <div key={idx} className="px-3 py-1.5 text-xs flex justify-between gap-2">
                            <span className="font-semibold text-slate-800 truncate">{p.name}</span>
                            <span className="text-slate-500 text-right shrink-0">
                              {[p.chiefdom, p.district].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>
                      {bulkResult.valid_rows > bulkResult.preview.length && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          + {bulkResult.valid_rows - bulkResult.preview.length} more
                        </p>
                      )}
                    </div>
                  )}

                  {bulkResult.errors.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-1">
                        Rows that will be skipped
                      </p>
                      <div className="border border-red-200 bg-red-50/40 rounded-xl divide-y divide-red-100 max-h-40 overflow-y-auto">
                        {bulkResult.errors.map((err) => (
                          <div key={err.row} className="px-3 py-1.5 text-[11px]">
                            <span className="font-bold text-red-800">Row {err.row}</span>
                            {err.name && <span className="text-slate-700"> · {err.name}</span>}
                            <span className="block text-red-700">{err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  {bulkResult && !bulkResult.dry_run ? "Done" : "Cancel"}
                </button>
                {bulkResult?.dry_run && (
                  <button
                    type="button"
                    disabled={bulkBusy || bulkResult.valid_rows === 0}
                    onClick={() => runBulkUpload(bulkFile, false)}
                    className="flex-1 bg-emerald-800 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-900 transition disabled:opacity-50"
                  >
                    Import {bulkResult.valid_rows} Seller{bulkResult.valid_rows === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SELLER PROFILE / DETAILS DRAWER
          ========================================================================= */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{selectedSeller.name}</h2>
                  <span className="text-xs bg-slate-100 font-mono text-slate-700 px-2 py-0.5 rounded">
                    {selectedSeller.seller_id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Registered: {new Date(selectedSeller.date_registered).toLocaleDateString("en-GB")}
                </p>
              </div>
              <button
                onClick={() => { setSelectedSeller(null); setSellerHistory(null); }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Info Cards */}
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-slate-400">Phone</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedSeller.contact}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-slate-400">Address</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedSeller.address}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl col-span-2">
                  <p className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Section / Chiefdom / District
                  </p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {sellerLocation(selectedSeller) || "Not recorded"}
                  </p>
                </div>
              </div>

              {/* Outstanding Loan Balance (Prominent for both Secretary & Manager) */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-amber-700" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                      Outstanding Loan Balance
                    </p>
                    <p className="text-2xl font-black text-amber-900 mt-0.5">
                      Nle{" "}
                      {role === "produce_secretary"
                        ? (secretaryBalances[selectedSeller.id] ?? "...")
                        : (sellerHistory?.outstanding_loan_balance ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                {role === "produce_secretary" && (
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-1 rounded-md font-semibold">
                    Read Only
                  </span>
                )}
              </div>

              {/* MANAGER / ADMIN FULL AGGREGATES */}
              {role !== "produce_secretary" && (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Lifetime Produce Delivered
                      </p>
                      <p className="text-xl font-black text-emerald-900 mt-0.5">
                        Nle {(sellerHistory?.total_produce_value || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Transaction summaries */}
                  {loadingHistory ? (
                    <div className="text-center py-4 text-xs text-slate-400">Loading purchase history...</div>
                  ) : sellerHistory ? (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Transactions</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {[
                          ...(sellerHistory.cocoa_transactions || []).map((t) => ({ ...t, type: "Cocoa" })),
                          ...(sellerHistory.coffee_transactions || []).map((t) => ({ ...t, type: "Coffee" })),
                          ...(sellerHistory.cola_transactions || []).map((t) => ({ ...t, type: "Cola" })),
                        ].length === 0 ? (
                          <p className="text-xs text-slate-400">No transactions recorded yet.</p>
                        ) : (
                          [
                            ...(sellerHistory.cocoa_transactions || []).map((t) => ({ ...t, type: "Cocoa" })),
                            ...(sellerHistory.coffee_transactions || []).map((t) => ({ ...t, type: "Coffee" })),
                            ...(sellerHistory.cola_transactions || []).map((t) => ({ ...t, type: "Cola" })),
                          ]
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((txn, idx) => (
                              <div key={idx} className="bg-slate-50 p-2.5 rounded-xl text-xs flex justify-between">
                                <div>
                                  <span className="font-bold text-slate-800">{txn.type}</span>
                                  <span className="text-slate-400 ml-2">{txn.date}</span>
                                  <span className="text-slate-600 block">{txn.weight_kg} kg</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-emerald-700">Nle {txn.total_price}</span>
                                  <span className="block text-[10px] uppercase font-semibold text-slate-400">
                                    {txn.status}
                                  </span>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Deactivation action (Manager / Admin only) */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => toggleSellerActive(selectedSeller)}
                      className={`text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1.5 transition ${
                        selectedSeller.is_active
                          ? "text-red-700 bg-red-50 hover:bg-red-100"
                          : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      }`}
                    >
                      {selectedSeller.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>{selectedSeller.is_active ? "Deactivate Seller" : "Reactivate Seller"}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
