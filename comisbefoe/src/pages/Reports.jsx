import { useState, useEffect } from "react";
import client from "../api/client.js";
import { useAuthStore } from "../store/authStore.js";
import { useAppStore } from "../store/appStore.js";
import { 
  FileBarChart, Download, FileText, Table, 
  Calendar, Filter, Users, DollarSign, Scale
} from "lucide-react";

export default function Reports() {
  const { role } = useAuthStore();
  const { sellers, fetchSellers } = useAppStore();

  const [activeReport, setActiveReport] = useState("produce"); // 'produce' | 'loans' | 'statement'

  // Produce report state & filters
  const [commodity, setCommodity] = useState("");
  const [status, setStatus] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [produceData, setProduceData] = useState(null);
  const [loadingProduce, setLoadingProduce] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Loans report state
  const [loanStatus, setLoanStatus] = useState("");
  const [loansData, setLoansData] = useState(null);
  const [loadingLoans, setLoadingLoans] = useState(false);

  // Seller statement state
  const [statementSellerId, setStatementSellerId] = useState("");
  const [statementData, setStatementData] = useState(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  useEffect(() => {
    fetchSellers();
    loadProduceReport();
  }, []);

  const loadProduceReport = async () => {
    setLoadingProduce(true);
    try {
      const params = {};
      if (commodity) params.commodity = commodity;
      if (status) params.status = status;
      if (sellerId) params.seller_id = sellerId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const { data } = await client.get("/reports/produce", { params });
      setProduceData(data);
    } catch (err) {
      console.error("Failed to load produce report", err);
    } finally {
      setLoadingProduce(false);
    }
  };

  const loadLoansReport = async () => {
    setLoadingLoans(true);
    try {
      const params = {};
      if (loanStatus) params.status = loanStatus;
      const { data } = await client.get("/reports/loans", { params });
      setLoansData(data);
    } catch (err) {
      console.error("Failed to load loans report", err);
    } finally {
      setLoadingLoans(false);
    }
  };

  const loadSellerStatement = async (sId) => {
    setStatementSellerId(sId);
    if (!sId) {
      setStatementData(null);
      return;
    }
    setLoadingStatement(true);
    try {
      const { data } = await client.get(`/reports/seller/${sId}`);
      setStatementData(data);
    } catch (err) {
      console.error("Failed to load seller statement", err);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = { format };
      if (commodity) params.commodity = commodity;
      if (status) params.status = status;
      if (sellerId) params.seller_id = sellerId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await client.get("/reports/produce/export", {
        params,
        responseType: "blob",
      });

      const filename = `COMIS_Produce_Report_${new Date().toISOString().split("T")[0]}.${format === "pdf" ? "pdf" : "xlsx"}`;
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to export report.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-emerald-800" />
          <span>Operational Reports & Export</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Produce volume aggregation, loan exposures, and seller statements
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => { setActiveReport("produce"); loadProduceReport(); }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeReport === "produce" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Produce Intake
        </button>

        {(role === "produce_manager" || role === "system_admin") && (
          <button
            onClick={() => { setActiveReport("loans"); loadLoansReport(); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              activeReport === "loans" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Loan Recovery
          </button>
        )}

        {(role === "produce_manager" || role === "system_admin") && (
          <button
            onClick={() => setActiveReport("statement")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              activeReport === "statement" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Seller Statement
          </button>
        )}
      </div>

      {/* =========================================================================
          TAB 1: PRODUCE INTAKE REPORT
          ========================================================================= */}
      {activeReport === "produce" && (
        <div className="space-y-4">
          {/* Filters Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Parameters
              </span>
              <button
                onClick={loadProduceReport}
                className="text-xs font-semibold text-emerald-800 hover:underline"
              >
                Apply Filters
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Commodity</label>
                <select
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 focus:outline-none"
                >
                  <option value="">All Commodities</option>
                  <option value="cocoa">Cocoa</option>
                  <option value="coffee">Coffee</option>
                  <option value="cola">Cola Nut</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="finalized">Finalized</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Export Action Buttons (Manager/Admin only) */}
          {(role === "produce_manager" || role === "system_admin") && (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                className="flex-1 bg-red-800 hover:bg-red-900 text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Official PDF</span>
              </button>

              <button
                onClick={() => handleExport("excel")}
                disabled={exporting}
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Export Excel Spreadsheet</span>
              </button>
            </div>
          )}

          {/* KPI Summary Cards */}
          {produceData && (
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm text-center">
                <span className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold block">Transactions</span>
                <span className="text-base sm:text-xl font-black text-slate-900">{produceData.count}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm text-center">
                <span className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold block">Volume</span>
                <span className="text-base sm:text-xl font-black text-emerald-800">{produceData.total_weight_kg} kg</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm text-center">
                <span className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold block">Value</span>
                <span className="text-base sm:text-xl font-black text-slate-900">Nle {produceData.total_value_nle?.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Transactions List */}
          {loadingProduce ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading produce report...</div>
          ) : !produceData || produceData.transactions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No transactions match the selected filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {produceData.transactions.map((t) => {
                const sellerObj = sellers.find((s) => s.id === t.seller_id);
                return (
                  <div
                    key={t.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 text-xs flex justify-between items-center shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {t.commodity}
                        </span>
                        <span className="font-bold text-slate-900">
                          {t.seller_name || sellerObj?.name || "Seller"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {t.date} · {t.weight_kg} kg @ Nle {t.price_per_kg}/kg
                      </p>
                      {(t.seller_chiefdom || t.seller_district) && (
                        <p className="text-[11px] text-slate-500">
                          {[t.seller_chiefdom, t.seller_district].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block text-sm">
                        Nle {t.total_price?.toLocaleString()}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          t.status === "finalized"
                            ? "text-emerald-700"
                            : t.status === "rejected"
                            ? "text-red-700"
                            : "text-amber-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: LOAN RECOVERY REPORT
          ========================================================================= */}
      {activeReport === "loans" && (
        <div className="space-y-4">
          <div className="flex gap-2 text-xs">
            {["", "active", "overdue", "cleared"].map((st) => (
              <button
                key={st}
                onClick={() => { setLoanStatus(st); loadLoansReport(); }}
                className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition ${
                  loanStatus === st ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "" ? "All Statuses" : st}
              </button>
            ))}
          </div>

          {loansData && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm text-center">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Disbursed</span>
                <span className="text-lg font-black text-slate-900">Nle {loansData.total_loaned?.toLocaleString()}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm text-center">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Outstanding Balance</span>
                <span className="text-lg font-black text-amber-700">Nle {loansData.total_outstanding?.toLocaleString()}</span>
              </div>
            </div>
          )}

          {loadingLoans ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading loan analysis...</div>
          ) : !loansData || loansData.loans.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              No loans found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loansData.loans.map((l) => {
                const sellerObj = sellers.find((s) => s.id === l.seller_id);
                return (
                  <div
                    key={l.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 text-xs flex justify-between items-center shadow-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{sellerObj?.name || "Seller"}</span>
                      <p className="text-[11px] text-slate-400">
                        {l.date} {l.due_date && `· Due: ${l.due_date}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-amber-800 block text-sm">
                        Nle {l.balance?.toLocaleString()} due
                      </span>
                      <span className="text-[10px] text-slate-400">
                        of Nle {l.loan_taken?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: SELLER STATEMENT
          ========================================================================= */}
      {activeReport === "statement" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Seller for Full Account Ledger
            </label>
            <select
              value={statementSellerId}
              onChange={(e) => loadSellerStatement(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
            >
              <option value="">-- Choose seller --</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.seller_id}) — {s.contact}
                </option>
              ))}
            </select>
          </div>

          {loadingStatement ? (
            <div className="text-center py-10 text-xs text-slate-400">Loading statement...</div>
          ) : !statementData ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400">
              Select a seller above to generate their statement.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 text-center shadow-sm">
                  <span className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold block">Lifetime Produce Sold</span>
                  <span className="text-base sm:text-xl font-black text-emerald-800">
                    Nle {statementData.total_produce_value?.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 text-center shadow-sm">
                  <span className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold block">Current Debt Balance</span>
                  <span className="text-base sm:text-xl font-black text-amber-800">
                    Nle {statementData.total_outstanding_loans?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Receipts Issued */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Official Receipts Issued ({statementData.receipts?.length || 0})
                </h4>
                {statementData.receipts?.length === 0 ? (
                  <p className="text-xs text-slate-400">No receipts issued yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                    {statementData.receipts.map((r) => (
                      <div key={r.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                        <span className="font-mono font-bold text-emerald-800">{r.receipt_number}</span>
                        <span className="font-bold text-slate-900">Nle {r.net_amount_paid}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

