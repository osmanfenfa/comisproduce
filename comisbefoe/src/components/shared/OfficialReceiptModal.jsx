import { Printer } from "lucide-react";
import { useReceiptPrinter } from "../../hooks/useReceiptPrinter.jsx";

export default function OfficialReceiptModal({ receipt, onClose }) {
  const { printReceipts, printSheet } = useReceiptPrinter();
  if (!receipt) return null;

  const sellerLocation = [receipt.seller_section, receipt.seller_chiefdom, receipt.seller_district]
    .filter(Boolean)
    .join(", ");

  const isMoistureCommodity = receipt.transaction_type === "cocoa";

  // Use Produce business name or station name. Zero COMIS platform branding.
  const businessName =
    receipt.business_name || receipt.station_name || "PRODUCE BUYING STATION";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto border border-slate-300">
        
        {printSheet}

        {/* On-screen voucher; printing uses the compact slip in ReceiptPrintSheet */}
        <div
          className="bg-white text-slate-900 border-2 border-dashed border-slate-400 p-4 sm:p-5 rounded-xl space-y-3 font-sans text-xs"
        >
          {/* Top Voucher Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b-2 border-slate-900 pb-2.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                OFFICIAL CASH PURCHASE VOUCHER · BUYING SLIP
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                {businessName}
              </h2>
              {(receipt.business_address || receipt.business_phone) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-600 mt-0.5">
                  {receipt.business_address && <span>{receipt.business_address}</span>}
                  {receipt.business_address && receipt.business_phone && <span>•</span>}
                  {receipt.business_phone && <span>Tel: {receipt.business_phone}</span>}
                </div>
              )}
            </div>

            <div className="sm:text-right bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center border sm:border-0 border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 sm:block">Voucher No:</span>
                <span className="font-mono text-sm sm:text-base font-black text-slate-900 ml-2 sm:ml-0">
                  {receipt.receipt_number}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 sm:mt-0.5">
                <span>Date: </span>
                <span className="font-semibold text-slate-700">
                  {new Date(receipt.issued_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Column Landscape Bank-Slip Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            
            {/* COLUMN 1: VENDOR / SELLER ACCOUNT DETAILS */}
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/60 flex flex-col justify-between space-y-2">
              <div>
                <div className="border-b border-slate-200 pb-1 mb-2 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    1. Payee / Seller Info
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-800 uppercase">
                    {receipt.is_random_seller ? "Walk-in" : "Registered"}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Seller Name:</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {receipt.seller_name || "Walk-in Seller"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Contact Number:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {receipt.seller_contact || "N/A"}
                    </span>
                  </div>
                  {receipt.seller_code && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Member Account ID:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {receipt.seller_code}
                      </span>
                    </div>
                  )}
                  {sellerLocation && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Section / Chiefdom / District:</span>
                      <span className="font-medium text-slate-700">{sellerLocation}</span>
                    </div>
                  )}
                  {receipt.station_name && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Buying Station:</span>
                      <span className="font-medium text-slate-700">
                        {receipt.station_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[9px] text-slate-400">
                Produce Buying Station Cash Disbursement
              </div>
            </div>

            {/* COLUMN 2: COMMODITY SPECIFICATIONS & WEIGHTS */}
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/60 flex flex-col justify-between space-y-2">
              <div>
                <div className="border-b border-slate-200 pb-1 mb-2 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    2. Produce Particulars
                  </span>
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-slate-900 text-white uppercase tracking-wider">
                    {receipt.transaction_type}
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                    <span className="text-slate-600">Total Bags:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {receipt.bags ?? 1}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                    <span className="text-slate-600">Scale Gross Weight:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {receipt.weight_kg != null ? `${receipt.weight_kg} kg` : "—"}
                    </span>
                  </div>

                  {isMoistureCommodity && (
                    <>
                      <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                        <span className="text-slate-600">Moisture Content:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {receipt.water_percent != null ? `${receipt.water_percent}%` : "—"}{" "}
                          <span className="text-[9px] text-slate-400 font-normal">
                            (std {receipt.standard_percent || 7}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                        <span className="text-slate-600">Water Deduction:</span>
                        <span className="font-mono font-bold text-red-600">
                          {receipt.moisture_deduction_kg > 0
                            ? `-${receipt.moisture_deduction_kg} kg`
                            : "0.0 kg"}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                    <span className="text-slate-600 font-medium">Net Payable Weight:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {receipt.net_weight_kg != null ? `${receipt.net_weight_kg} kg` : `${receipt.weight_kg} kg`}
                    </span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600">Price per kg:</span>
                    <span className="font-mono font-bold text-slate-900">
                      Nle {receipt.price_per_kg != null ? receipt.price_per_kg : "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[9px] text-slate-400">
                Verified against buying scale standards
              </div>
            </div>

            {/* COLUMN 3: FINANCIAL SETTLEMENT & SIGNATURES */}
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/60 flex flex-col justify-between space-y-2">
              <div>
                <div className="border-b border-slate-200 pb-1 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    3. Cash Settlement
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600">Gross Payable:</span>
                    <span className="font-mono font-bold text-slate-900">
                      Nle {receipt.gross_amount?.toLocaleString()}
                    </span>
                  </div>

                  {receipt.loan_deduction > 0 && (
                    <div className="flex justify-between py-0.5 text-red-600">
                      <span>Loan Settled:</span>
                      <span className="font-mono font-bold">
                        -Nle {receipt.loan_deduction?.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Net Cash Paid Highlight Box */}
                  <div className="border-2 border-slate-900 bg-white p-2 rounded-lg mt-1 text-center">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                      NET CASH PAID TO SELLER
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                      Nle {receipt.net_amount_paid?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Teller & Seller Sign-Off Lines */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 text-[9px] text-slate-700">
                <div className="flex justify-between items-center">
                  <span>Recorded: {receipt.recorded_by_name || "Secretary"}</span>
                  <span className="text-slate-400 font-mono">Sign: ____________</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Authorized: {receipt.issued_by_name || "Manager"}</span>
                  <span className="text-slate-400 font-mono">Sign: ____________</span>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Security Perforation Line */}
          <div className="pt-2 text-center text-[9px] text-slate-400 border-t border-dashed border-slate-300">
            • Valid Official Receipt Voucher ·
          </div>

        </div>

        {/* Modal Action Buttons (Hidden when printing) */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => printReceipts([receipt])}
            className="flex-1 bg-slate-900 hover:bg-black text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt (¼ A4)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
