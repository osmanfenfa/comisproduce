import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { calculateDirectPrice } from "../utils/pricing.js";
import { queueOfflinePurchase, newClientRef, isNetworkError } from "../offline/syncQueue.js";
import { 
  ShoppingBag, CheckCircle, AlertCircle, Clock, 
  X, Check, Printer, FileText, ChevronDown, User, UserPlus
} from "lucide-react";
import OfficialReceiptModal from "../components/shared/OfficialReceiptModal.jsx";

export default function Coffee() {
  const { role } = useAuthStore();
  const isSecretary = role === "produce_secretary";
  const canReview = isSecretary || role === "produce_manager" || role === "system_admin";
  const { sellers, prices, fetchSellers, fetchSettings } = useAppStore();

  // Purchase form
  const [sellerMode, setSellerMode] = useState("registered"); // 'registered' | 'random'
  const [sellerId, setSellerId] = useState("");
  const [randomName, setRandomName] = useState("");
  const [randomContact, setRandomContact] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weightKg, setWeightKg] = useState("");
  const [bags, setBags] = useState("1");
  const [pricePerKg, setPricePerKg] = useState("");

  const [sellerBalance, setSellerBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });

  // Manager review list
  const [pendingList, setPendingList] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Modals for Manager Actions
  const [rejectModalTxn, setRejectModalTxn] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptModalData, setReceiptModalData] = useState(null);
  const [loanDeductionInput, setLoanDeductionInput] = useState(0);

  useEffect(() => {
    fetchSellers();
    fetchSettings();
    if (canReview) {
      loadPendingPurchases();
    }
  }, [role]);

  useEffect(() => {
    if (prices?.coffee_price_per_kg && !pricePerKg) {
      setPricePerKg(prices.coffee_price_per_kg.toString());
    }
  }, [prices]);

  const loadPendingPurchases = async () => {
    setLoadingPending(true);
    try {
      // Secretaries review their own station's purchases until they sync them to the Manager
      const query = isSecretary ? "?status=pending&unsynced_only=true" : "?status=pending";
      const { data } = await client.get(`/coffee/${query}`);
      setPendingList(data);
    } catch (err) {
      console.error("Could not load pending coffee transactions", err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Seller balance fetch
  const handleSellerChange = async (sId) => {
    setSellerId(sId);
    if (!sId) {
      setSellerBalance(null);
      return;
    }
    try {
      const { data } = await client.get(`/sellers/${sId}/balance`);
      setSellerBalance(data.outstanding_balance);
    } catch (e) {
      setSellerBalance(0);
    }
  };

  // Live calculation
  const weight = parseFloat(weightKg) || 0;
  const price = parseFloat(pricePerKg) || 0;

  const calculation = (weight > 0 && price > 0)
    ? calculateDirectPrice(weight, price)
    : null;

  // Submit Purchase
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage({ type: "", text: "" });

    if (sellerMode === "registered" && !sellerId) {
      setFormMessage({
        type: "error",
        text: "Please select a registered seller.",
      });
      return;
    }

    if (sellerMode === "random") {
      if (!randomName.trim()) {
        setFormMessage({
          type: "error",
          text: "Please enter the random seller's name.",
        });
        return;
      }
      if (!randomContact.trim()) {
        setFormMessage({
          type: "error",
          text: "Please enter the random seller's contact number.",
        });
        return;
      }
    }

    const payload = {
      seller_id: sellerMode === "registered" ? sellerId : null,
      random_seller_name: sellerMode === "random" ? randomName.trim() : null,
      random_seller_contact: sellerMode === "random" ? randomContact.trim() : null,
      date,
      weight_kg: weight,
      bags: parseInt(bags, 10) || 1,
      price_per_kg: price,
    };

    // Device-generated reference: if the connection drops mid-request and the purchase is
    // re-sent from the offline queue, the server records it only once.
    payload.client_ref = newClientRef();

    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await queueOfflinePurchase("coffee", payload);
        setFormMessage({
          type: "success",
          text: "Offline: Purchase saved to local queue! It will sync when connected.",
        });
      } else {
        await client.post("/coffee/", payload);
        setFormMessage({
          type: "success",
          text: isSecretary
            ? "Purchase recorded as PENDING. Approve and issue the receipt below, then sync at the end of the day."
            : "Purchase recorded successfully as PENDING for review!",
        });
        if (canReview) {
          loadPendingPurchases();
        }
        if (sellerMode === "random") {
          fetchSellers();
        }
      }
      // Reset
      setWeightKg("");
      setBags("1");
      if (sellerMode === "random") {
        setRandomName("");
        setRandomContact("");
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // Weak signal: the phone thought it was online but the server never answered
        await queueOfflinePurchase("coffee", payload);
        setFormMessage({
          type: "success",
          text: "No connection: purchase saved on this phone. It will sync automatically when back online.",
        });
        setWeightKg("");
      } else {
        setFormMessage({
          type: "error",
          text: err.response?.data?.detail || "Failed to record purchase.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Manager Approve
  const handleApprove = async (txnId) => {
    try {
      await client.post(`/coffee/${txnId}/approve`);
      loadPendingPurchases();
    } catch (err) {
      alert(err.response?.data?.detail || "Approval failed");
    }
  };

  // Manager Reject
  const handleConfirmReject = async () => {
    if (!rejectModalTxn) return;
    try {
      await client.post(`/coffee/${rejectModalTxn.id}/reject`, {
        reason: rejectReason || "Correction needed",
      });
      setRejectModalTxn(null);
      setRejectReason("");
      loadPendingPurchases();
    } catch (err) {
      alert(err.response?.data?.detail || "Rejection failed");
    }
  };

  // Manager Issue Receipt
  const handleIssueReceipt = async (txn) => {
    try {
      const deduction = parseFloat(loanDeductionInput) || 0;
      const { data } = await client.post(`/coffee/${txn.id}/issue-receipt?loan_deduction=${deduction}`);
      setReceiptModalData(data);
      setLoanDeductionInput(0);
      loadPendingPurchases();
    } catch (err) {
      alert(err.response?.data?.detail || "Receipt issuance failed");
    }
  };

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">☕</span>
          <h1 className="text-xl font-bold text-slate-900">Coffee Purchasing</h1>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Flat weight pricing · Direct calculation without moisture deduction
        </p>
      </div>

      {formMessage.text && (
        <div
          className={`p-3 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
            formMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {formMessage.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{formMessage.text}</span>
        </div>
      )}

      {/* Main Grid: 1 col on mobile; 2 cols on desktop when Manager review queue is present */}
      <div className={`grid grid-cols-1 ${role !== 'produce_secretary' ? 'lg:grid-cols-12' : 'max-w-xl mx-auto'} gap-6 items-start`}>
        <div className={role !== 'produce_secretary' ? 'lg:col-span-6' : ''}>
          {/* Buying Form Card */}
          <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#d4a000] py-2 px-4 text-center">
              <h2 className="text-[#0f5c18] font-black text-sm sm:text-base tracking-wide uppercase">
                Coffee Intake Form
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
        {/* Seller Mode & Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Seller
            </label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => { setSellerMode("registered"); setRandomName(""); setRandomContact(""); }}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  sellerMode === "registered"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Registered
              </button>
              <button
                type="button"
                onClick={() => { setSellerMode("random"); setSellerId(""); setSellerBalance(null); }}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  sellerMode === "random"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Random / Walk-in
              </button>
            </div>
          </div>

          {sellerMode === "registered" ? (
            <select
              required
              value={sellerId}
              onChange={(e) => handleSellerChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none font-semibold"
            >
              <option value="">-- Choose registered seller --</option>
              {sellers.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.seller_id}) {s.contact ? `— ${s.contact}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                  Random / Walk-in Seller
                </span>
                <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                  Quick Intake
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Seller Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abu Mansaray"
                    value={randomName}
                    onChange={(e) => setRandomName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +232 77 123456"
                    value={randomContact}
                    onChange={(e) => setRandomContact(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                The seller name and contact number will be recorded on the official receipt and saved to station records.
              </p>
            </div>
          )}
        </div>

        {/* Loan balance alert banner */}
        {sellerBalance !== null && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <span className="text-xs text-amber-800 font-semibold">Seller Outstanding Debt:</span>
            <span className="text-sm font-black text-amber-900">Nle {sellerBalance.toLocaleString()}</span>
          </div>
        )}

        {/* Date & Bags */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Number of Bags</label>
            <input
              type="number"
              min="1"
              required
              placeholder="e.g. 1"
              value={bags}
              onChange={(e) => setBags(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Scale Weight & Price/kg (No Water % for Coffee) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Scale Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              required
              placeholder="e.g. 40.0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Price per kg (Nle)</label>
            <input
              type="number"
              step="0.5"
              required
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Live Calculation Preview Card */}
        {calculation !== null && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Payable Weight:</span>
              <span className="font-semibold text-slate-900">{weight} kg</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Price per kg:</span>
              <span className="font-semibold text-slate-900">Nle {price}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-emerald-950 pt-2 border-t border-emerald-200">
              <span>Total Payable Amount:</span>
              <span className="text-base text-emerald-800">Nle {calculation.toLocaleString()}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm sm:text-base py-2.5 rounded-full shadow-sm active:scale-98 transition flex items-center justify-center cursor-pointer disabled:opacity-50 mt-2"
        >
          {submitting ? "Processing..." : "Submit Purchase for Review"}
        </button>
        </form>
          </div>
        </div>

      {/* =========================================================================
          REVIEW QUEUE (Manager, or Secretary before the end-of-day sync)
          ========================================================================= */}
      {(canReview) && (
        <div className="lg:col-span-6">
          <div className="border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="bg-[#d4a000] py-2 px-4 flex items-center justify-between">
              <h2 className="text-[#0f5c18] font-black text-sm uppercase tracking-wide">
                Pending Review Queue ({pendingList.length})
              </h2>
              <button
                onClick={loadPendingPurchases}
                className="text-[11px] text-[#0f5c18] font-bold underline hover:text-black cursor-pointer"
              >
                Refresh
              </button>
            </div>

            <div className="p-3 space-y-3">
            {loadingPending ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading pending transactions...</div>
            ) : pendingList.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No pending purchases waiting for review.
              </div>
            ) : (
              pendingList.map((txn) => {
                const sellerObj = sellers.find((s) => s.id === txn.seller_id);
                return (
                  <div
                    key={txn.id}
                    className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">
                            {txn.seller_name || sellerObj?.name || "Seller"}
                          </p>
                          {txn.is_random_seller || sellerObj?.is_random ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Walk-in / Random
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-slate-500">
                              ({txn.seller_code || sellerObj?.seller_id})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {txn.seller_contact || sellerObj?.contact ? (
                            <span className="font-mono font-semibold text-slate-600">
                              {txn.seller_contact || sellerObj?.contact} ·{" "}
                            </span>
                          ) : null}
                          {txn.date} · Recorded by Secretary
                        </p>
                      </div>
                      <span className="text-base font-black text-emerald-800">Nle {txn.total_price}</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400">Bags</p>
                        <p className="font-bold text-slate-700">{txn.bags ?? 1}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Weight</p>
                        <p className="font-bold text-slate-700">{txn.weight_kg} kg</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Price/kg</p>
                        <p className="font-bold text-emerald-700">Nle {txn.price_per_kg}</p>
                      </div>
                    </div>

                    {/* Manager Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setRejectModalTxn(txn); setRejectReason(""); }}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleApprove(txn.id)}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => handleIssueReceipt(txn)}
                        className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* =========================================================================
          REJECT REASON MODAL
          ========================================================================= */}
      {rejectModalTxn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-900 text-sm">Reject Coffee Transaction</h3>
            <p className="text-xs text-slate-500">
              Please enter the specific reason for rejecting this purchase. The Secretary will be notified to correct and resubmit it.
            </p>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Water moisture re-test required on sample B; scale recalibration"
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-red-600 focus:outline-none"
            />
            <div className="flex gap-2">
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

      {/* =========================================================================
          OFFICIAL PRODUCE RECEIPT MODAL (Produce Account, Seller, Item Details)
          ========================================================================= */}
      <OfficialReceiptModal
        receipt={receiptModalData}
        onClose={() => setReceiptModalData(null)}
      />
    </div>
  );
}
