/**
 * The produce-station look (green-bordered cards, yellow headers, pill fields with
 * a round green icon, pill tabs, rounded green buttons) for the market's
 * forms and lists. The feed keeps its own social-post layout.
 */

/** Yellow full-width title bar, as on the Home page. */
export function Banner({ children }) {
  return (
    <div className="w-full bg-[#d4a000] text-[#0f5c18] font-black text-center py-2.5 rounded-2xl tracking-wider text-sm sm:text-base uppercase shadow-xs">
      {children}
    </div>
  );
}

/** Green-bordered card with the yellow header used across the produce screens. */
export function Card({ title, right, children, className = "", bodyClassName = "p-4" }) {
  return (
    <div className={`border-2 border-[#168821] rounded-2xl overflow-hidden bg-white shadow-xs ${className}`}>
      {title && (
        <div className={`bg-[#d4a000] py-2 px-4 flex items-center gap-2 ${right ? "justify-between" : "justify-center"}`}>
          <h2 className="text-[#0f5c18] font-black text-sm tracking-wide uppercase truncate">{title}</h2>
          {right}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

const PILL = "flex items-center border border-slate-700 rounded-full overflow-hidden bg-white shadow-2xs h-11 px-1.5 focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition";
const CONTROL = "w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none pr-3 font-medium";

function IconDot({ icon: Icon }) {
  return (
    <>
      <div className="w-8 h-8 rounded-full bg-[#168821] flex items-center justify-center text-white shrink-0 ml-1">
        <Icon className="w-4 h-4" />
      </div>
      <div className="h-6 w-px bg-slate-300 mx-2.5 shrink-0" />
    </>
  );
}

export function PillInput({ icon, className = "", ...props }) {
  return (
    <div className={`${PILL} ${className}`}>
      {icon && <IconDot icon={icon} />}
      <input {...props} className={`${CONTROL} ${icon ? "" : "pl-3"}`} />
    </div>
  );
}

export function PillSelect({ icon, className = "", children, ...props }) {
  return (
    <div className={`${PILL} ${className}`}>
      {icon && <IconDot icon={icon} />}
      <select {...props} className={`${CONTROL} ${icon ? "" : "pl-3"} cursor-pointer`}>{children}</select>
    </div>
  );
}

export function PillTextArea({ icon, className = "", ...props }) {
  return (
    <div className={`flex items-start border border-slate-700 rounded-2xl overflow-hidden bg-white shadow-2xs px-1.5 py-1.5 focus-within:border-[#168821] focus-within:ring-2 focus-within:ring-[#168821]/20 transition ${className}`}>
      {icon && <IconDot icon={icon} />}
      <textarea {...props} className={`${CONTROL} py-1.5 resize-none ${icon ? "" : "pl-3"}`} />
    </div>
  );
}

/** Rounded green action button (Create User style). */
export function PrimaryButton({ className = "", children, ...props }) {
  return (
    <button
      {...props}
      className={`w-full bg-[#168821] hover:bg-[#126e1a] text-white font-black text-sm py-2.5 rounded-full shadow-sm active:scale-[0.98] transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className = "", tone = "slate", children, ...props }) {
  const tones = {
    slate: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    red: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
    gold: "bg-white text-[#b38600] border border-[#d4a000] hover:bg-amber-50",
  };
  return (
    <button
      {...props}
      className={`w-full font-bold text-xs py-2.5 rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Pill tabs like "Add Secretary / Add Seller". */
export function PillTabs({ tabs, value, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-4 sm:px-6 py-2 rounded-full font-bold text-xs sm:text-sm transition cursor-pointer ${
            value === key
              ? "bg-[#168821] text-white shadow-md"
              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet / dialog with the produce card styling. */
export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card title={title} className="rounded-b-none sm:rounded-b-2xl" bodyClassName="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
          {children}
        </Card>
      </div>
    </div>
  );
}
