import { Banknote, Smartphone, Lock } from "lucide-react";

/**
 * How the seller is paid. Display only for now: Cash is the only active method.
 * Orange Money is shown as "coming soon" and cannot be selected; nothing here
 * changes how receipts are issued. See beyen/app/services/payouts.py.
 */
export default function PayoutMethodPicker() {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
      <div className="grid grid-cols-2 gap-2">
        <div
          aria-checked="true"
          role="radio"
          className="border-2 border-emerald-700 bg-emerald-50 rounded-xl p-2.5 flex items-center gap-2"
        >
          <Banknote className="w-4 h-4 text-emerald-800 shrink-0" />
          <div>
            <span className="text-xs font-bold text-emerald-900 block">Cash</span>
            <span className="text-[10px] text-emerald-700">Paid at station</span>
          </div>
        </div>

        <div
          aria-checked="false"
          aria-disabled="true"
          role="radio"
          title="Orange Money payouts are not enabled yet"
          className="border border-slate-200 bg-slate-50 rounded-xl p-2.5 flex items-center gap-2 opacity-70 cursor-not-allowed select-none"
        >
          <Smartphone className="w-4 h-4 text-orange-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
              Orange Money <Lock className="w-3 h-3 text-slate-400" />
            </span>
            <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
