import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  Receipt as ReceiptIcon, Printer, Search, Filter, 
  Check, X, FileText, CheckSquare, Square, UploadCloud, Clock
} from "lucide-react";
import OfficialReceiptModal from "../components/shared/OfficialReceiptModal.jsx";
import { useReceiptPrinter } from "../hooks/useReceiptPrinter.jsx";
import PayoutMethodPicker from "../components/shared/PayoutMethodPicker.jsx";

export default function Receipts() {
  const { role } = useAuthStore();
  // Managers review synced purchases; a Secretary reviews their station's purchases until the
  // end-of-day sync hands them to the Manager. The API enforces the same rule.
  const isSecretary = role === "produce_secretary";
  const canReviewTxn = (txn) => !isSecretary || !txn.synced_at;
  const { sellers, fetchSellers } = useAppStore();

  const [activeTab, setActiveTab] = useState("issued"); // 'issued' | 'pending'
  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // Filters for issued receipts
  const [typeFilter, setTypeFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pending reviews
  const [pendingTxns, setPendingTxns] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [rejectModalTxn, setRejectModalTxn] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptPrepTxn, setReceiptPrepTxn] = useState(null);
  const [loanDeductionInput, setLoanDeductionInput] = useState(0);

  // Bulk printing (4 receipts per A4 page)
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { printReceipts, printSheet } = useReceiptPrinter();

  // End-of-day sync (Secretary) / station sync status (Manager)
  const [syncSummary, setSyncSummary] = useState(null);
  const [stationStatus, setStationStatus] = useState([]);
  const [loadingSync, setLoadingSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    fetchSellers();
    loadReceipts();
    loadPending();
    loadSync();
  }, []);

  const loadSync = async () => {
    if (role !== "produce_secretary" && role !== "produce_manager") return;
    setLoadingSync(true);
    try {
      if (role === "produce_secretary") {
        const { data } = await client.get("/sync/summary");
        setSyncSummary(data);
      } else {
        const { data } = await client.get("/sync/status");
        setStationStatus(data);
      }
    } catch (err) {
      console.error("Failed to load sync information", err);
    } finally {
      setLoadingSync(false);
    }
  };

  const handleSync = async () => {
    if (!syncSummary?.purchases) return;
    const warning = syncSummary.not_receipted > 0
      ? `\n\n${syncSummary.not_receipted} purchase(s) have no receipt yet and will go to the Manager for review.`
      : "";
    if (!window.confirm(`Sync ${syncSummary.purchases} purchase(s) to the Manager? You won't be able to change them afterwards.${warning}`)) {
      return;
    }
    setSyncing(true);
    setSyncMessage("");
    try {
      const { data } = await client.post("/sync/");
      setSyncMessage(`Synced ${data.synced_purchases} purchase(s) and ${data.synced_receipts} receipt(s) to the Manager.`);
      loadSync();
      loadPending();
      loadReceipts();
    } catch (err) {
      setSyncMessage(err.response?.data?.detail || "Sync failed. Check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  };

  const unsyncedAtStations = stationStatus.reduce((n, s) => n + s.unsynced_purchases, 0);
  const formatNle = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  // API timestamps are UTC without a zone suffix
  const asLocal = (ts) => new Date(ts.endsWith("Z") ? ts : `${ts}Z`).toLocaleString();

  const loadReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const { data } = await client.get("/receipts/");
      setReceipts(data);
    } catch (err) {
      console.error("Failed to load receipts", err);
    } finally {
      setLoadingReceipts(false);
    }
  };

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const [cPending, cApproved, cofPending, cofApproved, colPending, colApproved] = await Promise.all([
        client.get("/cocoa/?status=pending"),
        client.get("/cocoa/?status=approved"),
        client.get("/coffee/?status=pending"),
        client.get("/coffee/?status=approved"),
        client.get("/cola/?status=pending"),
        client.get("/cola/?status=approved"),
      ]);
      const cocoa = [...(cPending.data || []), ...(cApproved.data || [])].map((t) => ({ ...t, commodity: "cocoa" }));
      const coffee = [...(cofPending.data || []), ...(cofApproved.data || [])].map((t) => ({ ...t, commodity: "coffee" }));
      const cola = [...(colPending.data || []), ...(colApproved.data || [])].map((t) => ({ ...t, commodity: "cola" }));
      const combined = [...cocoa, ...coffee, ...cola].sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      setPendingTxns(combined);
    } catch (err) {
      console.error("Failed to load review queue", err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApprove = async (txn) => {
    try {
      await client.post(`/${txn.commodity}/${txn.id}/approve`);
      loadPending();
    } catch (err) {
      alert(err.response?.data?.detail || "Approval failed");
    }
  };

  const handleApproveAndIssue = async (txn) => {
    try {
      if (txn.status === "pending") {
        await client.post(`/${txn.commodity}/${txn.id}/approve`);
      }
      await openReceiptPrep({ ...txn, status: "approved" });
    } catch (err) {
      alert(err.response?.data?.detail || "Approval failed");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalTxn) return;
    try {
      await client.post(`/${rejectModalTxn.commodity}/${rejectModalTxn.id}/reject`, {
        reason: rejectReason || "Correction required",
      });
      setRejectModalTxn(null);
      setRejectReason("");
      loadPending();
    } catch (err) {
      alert(err.response?.data?.detail || "Rejection failed");
    }
  };

  const openReceiptPrep = async (txn) => {
    setReceiptPrepTxn(txn);
    setLoanDeductionInput(0);
    if (!txn.seller_id) {
      setReceiptPrepTxn({ ...txn, sellerDebt: 0 });
      return;
    }
    try {
      const { data } = await client.get(`/sellers/${txn.seller_id}/balance`);
      setReceiptPrepTxn({ ...txn, sellerDebt: data.outstanding_balance });
    } catch {
      setReceiptPrepTxn({ ...txn, sellerDebt: 0 });
    }
  };

  const handleConfirmIssueReceipt = async () => {
    if (!receiptPrepTxn) return;
    try {
      const deduction = parseFloat(loanDeductionInput) || 0;
      const { data } = await client.post(
        `/${receiptPrepTxn.commodity}/${receiptPrepTxn.id}/issue-receipt?loan_deduction=${deduction}`
      );
      setReceiptPrepTxn(null);
      setSelectedReceipt(data);
      loadPending();
      loadReceipts();
    } catch (err) {
      alert(err.response?.data?.detail || "Receipt issuance failed");
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    if (typeFilter !== "all" && r.transaction_type !== typeFilter) return false;
    if (sellerFilter && r.seller_id !== sellerFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = r.receipt_number?.toLowerCase().includes(q);
      const sellerMatch = r.seller_name?.toLowerCase().includes(q) || r.seller_code?.toLowerCase().includes(q) || r.seller_contact?.toLowerCase().includes(q);
      if (!numMatch && !sellerMatch) return false;
    }
    return true;
  });

  const allShownSelected =
    filteredReceipts.length > 0 && filteredReceipts.every((r) => selectedIds.has(r.id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllShown = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allShownSelected) filteredReceipts.forEach((r) => next.delete(r.id));
      else filteredReceipts.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const selectedReceipts = receipts.filter((r) => selectedIds.has(r.id));
  const receiptsToPrint = selectedReceipts.length > 0 ? selectedReceipts : filteredReceipts;
  const pagesToPrint = Math.ceil(receiptsToPrint.length / 4);

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-emerald-800" />
            <span>Receipts & Verification</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Official station purchase certificates & co-located review queue
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("issued")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === "issued" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Issued Receipts ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === "pending" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Pending & Approved</span>
          {pendingTxns.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {pendingTxns.length}
            </span>
          )}
        </button>
        {(role === "produce_secretary" || role === "produce_manager") && (
          <button
            onClick={() => { setActiveTab("sync"); loadSync(); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === "sync" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{role === "produce_secretary" ? "Daily Sync" : "Stations"}</span>
            {role === "produce_secretary" && syncSummary?.purchases > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {syncSummary.purchases}
              </span>
            )}
            {role === "produce_manager" && unsyncedAtStations > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {unsyncedAtStations}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TAB 3: END-OF-DAY SYNC (Secretary) */}
      {activeTab === "sync" && role === "produce_secretary" && (
        <div className="space-y-3">
          {syncMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              {syncMessage}
            </div>
          )}

          {loadingSync && !syncSummary ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading station activity...</div>
          ) : !syncSummary || syncSummary.purchases === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <UploadCloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Everything is synced</p>
              <p className="text-xs text-slate-400 mt-1">
                {syncSummary?.last_synced_at
                  ? `Last synced ${asLocal(syncSummary.last_synced_at)}`
                  : "New purchases you record will appear here until you sync them."}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Review station activity</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    The Manager sees these purchases only after you sync. Once synced, only the Manager can change them.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Purchases", syncSummary.purchases, "text-slate-900"],
                    ["Weight", `${syncSummary.total_weight_kg} kg`, "text-emerald-800"],
                    ["Value", `Nle ${formatNle(syncSummary.total_value)}`, "text-slate-900"],
                    ["Receipts", syncSummary.receipts_issued, "text-slate-900"],
                    ["Cash Paid", `Nle ${formatNle(syncSummary.cash_paid)}`, "text-slate-900"],
                    ["Loans Deducted", `Nle ${formatNle(syncSummary.loan_deductions)}`, "text-red-700"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{label}</span>
                      <span className={`text-sm sm:text-base font-black ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {syncSummary.not_receipted > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    {syncSummary.not_receipted} purchase(s) have no receipt yet. Issue receipts first, or sync them
                    as they are and the Manager will review them.
                  </div>
                )}

                <button
                  type="button"
                  disabled={syncing}
                  onClick={handleSync}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{syncing ? "Syncing..." : `Sync ${syncSummary.purchases} purchase(s) to Manager`}</span>
                </button>
              </div>

              <div className="space-y-2">
                {syncSummary.items.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-3 text-xs flex justify-between items-center shadow-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {item.commodity}
                        </span>
                        <span className="font-bold text-slate-900">{item.seller_name || "Seller"}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.date} · {item.weight_kg} kg · {item.bags ?? 1} bag(s)
                        {item.receipt_number && <> · <span className="font-mono">{item.receipt_number}</span></>}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block text-sm">Nle {formatNle(item.total_price)}</span>
                      <span className={`text-[10px] font-bold uppercase ${
                        item.status === "finalized" ? "text-emerald-700" : item.status === "rejected" ? "text-red-700" : "text-amber-700"
                      }`}>
                        {item.status === "finalized" ? "Receipted" : item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: STATION SYNC STATUS (Manager) */}
      {activeTab === "sync" && role === "produce_manager" && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">
            Station purchases appear in your reports and receipts after the secretary's end-of-day sync.
          </p>
          {loadingSync && stationStatus.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading stations...</div>
          ) : stationStatus.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No secretaries yet. Add one under Users.
            </div>
          ) : (
            stationStatus.map((st) => (
              <div key={st.secretary_id} className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-sm font-bold text-slate-900">{st.station_name || "Station"}</p>
                  <p className="text-[11px] text-slate-500">{st.secretary_name}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {st.last_synced_at ? `Last sync ${asLocal(st.last_synced_at)}` : "Never synced"}
                  </p>
                </div>
                {st.unsynced_purchases > 0 ? (
                  <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold px-2.5 py-1 rounded-full">
                    {st.unsynced_purchases} waiting to sync
                  </span>
                ) : (
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Up to date
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 1: ISSUED RECEIPTS */}
      {activeTab === "issued" && (
        <div className="space-y-3">
          {/* Search & Commodity Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by receipt # or seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex gap-1 overflow-x-auto text-xs flex-1 no-scrollbar">
                {["all", "cocoa", "coffee", "cola"].map((typ) => (
                  <button
                    key={typ}
                    onClick={() => setTypeFilter(typ)}
                    className={`px-3 py-1.5 rounded-xl font-semibold capitalize whitespace-nowrap transition ${
                      typeFilter === typ
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {typ === "all" ? "All Commodities" : typ}
                  </button>
                ))}
              </div>

              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-700 focus:outline-none"
              >
                <option value="">All Sellers</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.seller_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk print toolbar */}
          {!loadingReceipts && filteredReceipts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-wrap items-center gap-2 shadow-xs">
              <button
                type="button"
                onClick={toggleSelectAllShown}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                {allShownSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>{allShownSelected ? "Unselect all" : `Select all (${filteredReceipts.length})`}</span>
              </button>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-xl transition cursor-pointer"
                >
                  Clear ({selectedIds.size})
                </button>
              )}

              <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">
                4 receipts per A4 page · {pagesToPrint} page{pagesToPrint === 1 ? "" : "s"}
              </span>

              <button
                type="button"
                onClick={() => printReceipts(receiptsToPrint)}
                className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer ml-auto sm:ml-0"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {selectedReceipts.length > 0
                    ? `Print ${selectedReceipts.length} selected`
                    : `Print all ${filteredReceipts.length} shown`}
                </span>
              </button>
            </div>
          )}

          {/* Receipts list */}
          {loadingReceipts ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading receipts...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No receipts found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredReceipts.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReceipt(r)}
                  className={`bg-white border rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition space-y-2 flex flex-col justify-between ${
                    selectedIds.has(r.id) ? "border-emerald-600 ring-2 ring-emerald-600/20" : "border-slate-200 hover:border-emerald-500"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={selectedIds.has(r.id) ? "Unselect receipt" : "Select receipt for printing"}
                          onClick={(e) => { e.stopPropagation(); toggleSelected(r.id); }}
                          className="p-0.5 -ml-0.5 rounded-md hover:bg-slate-100 cursor-pointer"
                        >
                          {selectedIds.has(r.id) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {r.receipt_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <p className="text-sm font-bold text-slate-900">
                          {r.seller_name || "Seller"}
                        </p>
                        {r.is_random_seller ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            Walk-in
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-500">({r.seller_code})</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(r.issued_at).toLocaleString()} · {r.station_name || "Station"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 block">
                        Nle {r.net_amount_paid?.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        {r.transaction_type}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl flex justify-between text-xs text-slate-600">
                    <span>Gross: Nle {r.gross_amount}</span>
                    <span className="text-red-600">Loan Ded: -Nle {r.loan_deduction}</span>
                    <span className="font-bold text-emerald-800">Net: Nle {r.net_amount_paid}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING APPROVAL QUEUE */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          {loadingPending ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading pending reviews...</div>
          ) : pendingTxns.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No transactions currently waiting for manager review.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {pendingTxns.map((txn) => {
                const sellerObj = sellers.find((s) => s.id === txn.seller_id);
                const isApproved = txn.status === "approved";
                return (
                  <div
                    key={txn.id}
                    className={`rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between transition ${
                      isApproved
                        ? "bg-emerald-50/25 border-2 border-emerald-400"
                        : "bg-white border border-amber-200"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase bg-slate-900 text-white px-2 py-0.5 rounded-md">
                              {txn.commodity}
                            </span>
                            {isApproved ? (
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md">
                                ✓ Ready to Print
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                                Pending Review
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-900">
                              {txn.seller_name || sellerObj?.name || "Seller"}
                            </span>
                            {txn.is_random_seller || sellerObj?.is_random ? (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                Walk-in
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-slate-400">
                                ({txn.seller_code || sellerObj?.seller_id})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            {txn.date} · Weight: <span className="font-bold text-slate-800">{txn.weight_kg} kg</span> @ Nle {txn.price_per_kg}/kg
                          </p>
                          {txn.water_percent != null && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Moisture: {txn.water_percent}% · Net Wt: {txn.net_weight_kg || txn.weight_kg} kg
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900 block">
                            Nle {txn.total_price}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isApproved ? "Approved Total" : "Gross Payable"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      {!canReviewTxn(txn) ? (
                        <p className="text-[11px] text-slate-500 text-center py-1">
                          Synced — awaiting Manager review
                        </p>
                      ) : isApproved ? (
                        <button
                          onClick={() => openReceiptPrep(txn)}
                          className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Issue & Print Official Receipt</span>
                        </button>
                      ) : (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setRejectModalTxn(txn); setRejectReason(""); }}
                            className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-2.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>

                          <button
                            onClick={() => handleApprove(txn)}
                            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => handleApproveAndIssue(txn)}
                            className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Approve & Issue</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ISSUE RECEIPT PREP MODAL
          ========================================================================= */}
      {receiptPrepTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Issue Receipt & Settle</h3>
            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Amount:</span>
                <span className="text-slate-500">Gross Payable:</span>
                <span className="font-bold text-slate-900">Nle {receiptPrepTxn.total_price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Seller Outstanding Debt:</span>
                <span className="font-bold text-amber-700">Nle {receiptPrepTxn.sellerDebt || 0}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Loan Deduction Amount (Nle)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={Math.min(receiptPrepTxn.total_price, receiptPrepTxn.sellerDebt || receiptPrepTxn.total_price)}
                value={loanDeductionInput}
                onChange={(e) => setLoanDeductionInput(e.target.value)}
                placeholder="0"
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Net cash to hand seller: Nle {Math.max(0, receiptPrepTxn.total_price - (parseFloat(loanDeductionInput) || 0)).toFixed(2)}
              </p>
            </div>

            <PayoutMethodPicker />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setReceiptPrepTxn(null)}
                className="flex-1 border border-slate-300 py-2.5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIssueReceipt}
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white py-2.5 rounded-xl text-xs font-semibold shadow-sm"
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs"
              >
                Issue Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REJECT MODAL
          ========================================================================= */}
      {rejectModalTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Reject Purchase</h3>
            <p className="text-xs text-slate-500">Provide a reason for the Secretary to correct:</p>
            <textarea
              rows={3}
              required
              placeholder="e.g. Moisture re-test required; weight adjustment needed"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRejectModalTxn(null)}
                className="flex-1 border border-slate-300 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-semibold"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Teller Landscape Official Receipt Modal */}
      {printSheet}

      <OfficialReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
