import { useState } from "react";
import { X, ShieldCheck, FileText, ScrollText, CheckCircle } from "lucide-react";

export default function LegalModal({ isOpen, initialTab = "terms", onClose, onAgree }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 my-auto border-2 border-[#168821] max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                COMIS Legal & Governance
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Official Email: <a href="mailto:comisworldproduce@gmail.com" className="text-emerald-700 font-bold hover:underline">comisworldproduce@gmail.com</a>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-xs font-bold shrink-0 gap-2">
          <button
            onClick={() => setActiveTab("terms")}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === "terms"
                ? "border-[#168821] text-[#168821]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab("agreement")}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === "agreement"
                ? "border-[#168821] text-[#168821]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ScrollText className="w-4 h-4" />
            User Agreement
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === "privacy"
                ? "border-[#168821] text-[#168821]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Privacy Policy
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="overflow-y-auto pr-1 text-xs text-slate-700 space-y-4 flex-1">
          {activeTab === "terms" && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <h4 className="font-extrabold text-[#0f5c18] text-sm mb-1">Terms of Service Overview</h4>
                
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">1. Acceptance of Terms</h5>
                <p className="leading-relaxed">
                  These Terms of Service ("Terms") constitute a legally binding agreement between <strong>COMIS</strong> and the produce-buying business registering a Produce Business account. By registering, accessing, or using COMIS, you agree to be bound by these Terms.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">2. Produce Business Accounts & Multi-Station Scope</h5>
                <p className="leading-relaxed">
                  A Produce Business account may oversee multiple stations. Produce Managers hold administrative accountability for station activity and Produce Secretary sub-accounts. Registration remains in a pending state until approved by a System Admin.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">3. Produce Purchases, Pricing & Receipts</h5>
                <p className="leading-relaxed">
                  COMIS automates moisture deduction and weight calculations for Cocoa, Coffee, and Cola Nut. Receipts issued are permanent audit records. Falsification of weights, prices, or seller deductions is strictly prohibited.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">4. Support & Notices</h5>
                <p className="leading-relaxed">
                  Official contact and legal notices must be submitted via email to: <a href="mailto:comisworldproduce@gmail.com" className="font-bold text-emerald-700">comisworldproduce@gmail.com</a>.
                </p>
              </div>
            </div>
          )}

          {activeTab === "agreement" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <h4 className="font-extrabold text-amber-900 text-sm mb-1">Individual User Agreement</h4>
                
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">1. Purpose and Scope</h5>
                <p className="leading-relaxed">
                  This Agreement applies to all individual users authorized to log into the COMIS platform. Access is role-restricted based on system permissions.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">2. Credential Security & Responsibility</h5>
                <p className="leading-relaxed">
                  You are solely responsible for maintaining the confidentiality of your login credentials. Sharing accounts between staff or operating under another user's identity is strictly prohibited and subject to audit logs.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">3. In-Person Verification & Approval Chain</h5>
                <p className="leading-relaxed">
                  Produce Secretaries record transactions; Produce Managers must deliberately review and approve transactions in person at the station before receipts are generated and disbursements occur.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">4. Contact & Disputes</h5>
                <p className="leading-relaxed">
                  For account recovery, security concerns, or questions, reach our compliance team at <a href="mailto:comisworldproduce@gmail.com" className="font-bold text-emerald-700">comisworldproduce@gmail.com</a>.
                </p>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <h4 className="font-extrabold text-blue-900 text-sm mb-1">COMIS Privacy Policy</h4>
                
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">1. Information We Collect</h5>
                <p className="leading-relaxed">
                  We collect account credentials (name, contact phone/email, produce business name), operational data (produce transaction weights, moisture tests, loan balances, receipt numbers), and audit logs to ensure transparent financial transactions.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">2. Data Storage</h5>
                <p className="leading-relaxed">
                  COMIS stores your data on secure cloud servers. An internet connection is needed to record and view data; the app does not keep copies of your records on the device.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 mb-1">3. Data Security & Contact</h5>
                <p className="leading-relaxed">
                  We implemented data security to ensure your data is safe. For privacy requests or questions, contact our Data Protection Officer at: <a href="mailto:comisworldproduce@gmail.com" className="font-bold text-emerald-700">comisworldproduce@gmail.com</a>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t shrink-0">
          <span className="text-[11px] text-slate-400">
            Official SaaS Support: <span className="font-semibold text-slate-600">comisworldproduce@gmail.com</span>
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Close
            </button>
            {onAgree && (
              <button
                onClick={() => {
                  onAgree();
                  onClose();
                }}
                className="flex-1 sm:flex-none px-5 py-2 bg-[#168821] hover:bg-[#116e19] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle className="w-4 h-4" />
                Agree & Continue
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
