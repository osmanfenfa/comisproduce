/** Small red notification count (1, 2, 3 ... 9+). Renders nothing for 0. */
export default function CountBadge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span
      className={`min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black leading-[17px] text-center shadow-sm ring-2 ring-white ${className}`}
      aria-label={`${count} new`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
