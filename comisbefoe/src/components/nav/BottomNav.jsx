import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.js";
import { Home, RotateCcw, LogOut, UserPlus } from "lucide-react";

// Illustrated commodity icons
function CocoaPodIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      {/* Cocoa pod silhouette with ridges */}
      <path
        d="M24 6C16 12 12 22 13 32C14 38 18 42 24 44C30 42 34 38 35 32C36 22 32 12 24 6Z"
        fill="#fbf5ee"
        stroke="#d08b58"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M24 6V44" stroke="#d08b58" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 12C17 18 17 28 20 38" stroke="#d08b58" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M29 12C31 18 31 28 28 38" stroke="#d08b58" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 4V6" stroke="#487822" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CoffeeBeanIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      {/* Roasted Coffee Bean */}
      <ellipse
        cx="24"
        cy="24"
        rx="14"
        ry="18"
        transform="rotate(-25 24 24)"
        fill="#f7ede2"
        stroke="#c47a46"
        strokeWidth="2.5"
      />
      <path
        d="M17 11C21 16 23 20 22 25C21 29 25 33 30 37"
        stroke="#c47a46"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ColaNutIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      {/* Three clustered cola nut lobes */}
      <ellipse cx="20" cy="28" rx="9" ry="11" transform="rotate(-35 20 28)" fill="#d46b7a" stroke="#8a2034" strokeWidth="1.8" />
      <ellipse cx="30" cy="27" rx="8" ry="12" transform="rotate(35 30 27)" fill="#b8455a" stroke="#8a2034" strokeWidth="1.8" />
      <ellipse cx="25" cy="18" rx="8" ry="10" fill="#e07d8d" stroke="#8a2034" strokeWidth="1.8" />
      <path d="M21 26C24 27 27 27 29 25" stroke="#ffe3e8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// Compact, icon-only tab (X/Twitter style): full-height tap target, small icon,
// active tab shown by a brighter icon and a short marker underneath.
function TabIcon({ active, children }) {
  return (
    <span className="relative flex items-center justify-center h-full w-full">
      <span className={`transition-opacity ${active ? "opacity-100" : "opacity-70"}`}>{children}</span>
      <span
        className={`absolute bottom-1 h-[3px] w-4 rounded-full bg-[#e5a900] transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}

function Tab({ to, label, end = false, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className="flex-1 h-full focus:outline-none active:scale-95 transition-transform"
    >
      {({ isActive }) => <TabIcon active={isActive}>{children(isActive)}</TabIcon>}
    </NavLink>
  );
}

const BAR =
  "md:hidden shrink-0 w-full z-40 bg-[#168821] border-t border-emerald-700/70 select-none pb-[env(safe-area-inset-bottom)]";
const ROW = "w-full max-w-lg mx-auto h-12 flex items-stretch";
const LUCIDE = (active) => `w-[22px] h-[22px] text-white ${active ? "stroke-[2.6]" : "stroke-2"}`;

export default function BottomNav() {
  const { role, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!role) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // SYSTEM ADMIN: Home | Audit/Logs | Logout
  if (role === "system_admin") {
    return (
      <nav className={BAR}>
        <div className={ROW}>
          <Tab to="/" end label="Home">{(a) => <Home className={LUCIDE(a)} />}</Tab>
          <Tab to="/audit-logs" label="Audit logs">{(a) => <RotateCcw className={LUCIDE(a)} />}</Tab>
          <button
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
            className="flex-1 h-full flex items-center justify-center opacity-70 hover:opacity-100 active:scale-95 transition cursor-pointer"
          >
            <LogOut className="w-[22px] h-[22px] text-white" />
          </button>
        </div>
      </nav>
    );
  }

  // PRODUCE MANAGER & SECRETARY: Home | Users | Cocoa | Coffee | Cola
  return (
    <nav className={BAR}>
      <div className={ROW}>
        <Tab to="/" end label="Home">{(a) => <Home className={LUCIDE(a)} />}</Tab>
        <Tab to="/users" label="Users & sellers">{(a) => <UserPlus className={LUCIDE(a)} />}</Tab>
        <Tab to="/cocoa" label="Cocoa">{() => <CocoaPodIcon className="w-[22px] h-[22px]" />}</Tab>
        <Tab to="/coffee" label="Coffee">{() => <CoffeeBeanIcon className="w-[22px] h-[22px]" />}</Tab>
        <Tab to="/cola" label="Cola">{() => <ColaNutIcon className="w-[22px] h-[22px]" />}</Tab>
      </div>
    </nav>
  );
}
