import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.js";
import { 
  LogOut, Settings, Users, FileBarChart, 
  Receipt, ShieldCheck, User as UserIcon, KeyRound, Store, Truck, Wallet, Camera
} from "lucide-react";
import ChangePasswordModal from "../shared/ChangePasswordModal.jsx";
import CountBadge from "../shared/CountBadge.jsx";
import UserAvatar from "../shared/UserAvatar.jsx";
import ProfilePhotoModal from "../shared/ProfilePhotoModal.jsx";
import { useNotificationStore } from "../../store/notificationStore.js";

export default function TopHeader() {
  const { role, name, stationName, produceName, logout, avatarUrl } = useAuthStore();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const notifications = useNotificationStore((s) => s.total);
  const navigate = useNavigate();
  const location = useLocation();

  if (!role) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Farmers & traders: simple market header (no station branding or station shortcuts)
  if (role === "farmer" || role === "trader") {
    const marketLinks = [["/market", "Market"], ["/market/new", "Post"], ["/market/activity", "My activity"], ["/market/me", "Me"]];
    return (
      <header className="bg-white text-slate-800 sticky top-0 z-40 border-b border-slate-100 shadow-2xs">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[#168821] font-black text-lg leading-none tracking-tight">COMIS Market</h1>
            <p className="text-[#d4a000] font-bold text-xs mt-0.5 truncate">
              {name || "Member"} · {role === "farmer" ? "Farmer" : "Trader"}
            </p>
          </div>
          <nav className="hidden md:flex items-center gap-1.5">
            {marketLinks.map(([to, label]) => (
              <Link key={to} to={to}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition inline-flex items-center gap-1 ${
                  location.pathname === to ? "bg-[#168821] text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                }`}>
                {label}
                {to === "/market/activity" && <CountBadge count={notifications} />}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={() => setPhotoOpen(true)} aria-label="Profile photo" title="Profile photo"
              className="rounded-full cursor-pointer ring-2 ring-transparent hover:ring-emerald-200">
              <UserAvatar src={avatarUrl} name={name} role={role} size="w-8 h-8 text-sm" />
            </button>
            <button type="button" onClick={() => setChangePasswordOpen(true)} aria-label="Change password" title="Change password"
              className="p-2 rounded-full text-amber-700 hover:bg-amber-50 cursor-pointer">
              <KeyRound className="w-4.5 h-4.5" />
            </button>
            <button type="button" onClick={handleLogout} aria-label="Logout" title="Logout"
              className="p-2 rounded-full text-[#d32f2f] hover:bg-red-50 cursor-pointer">
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
        <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
        <ProfilePhotoModal isOpen={photoOpen} onClose={() => setPhotoOpen(false)} />
      </header>
    );
  }

  const isSystemAdmin = role === "system_admin";
  const isManager = role === "produce_manager";
  const isSecretary = role === "produce_secretary";

  const displayName = produceName || "Confidence Produce";
  const displayRole = isSystemAdmin
    ? "Admin"
    : isManager
    ? "Manager"
    : isSecretary && stationName && stationName !== produceName
    ? `Secretary • ${stationName}`
    : "Secretary";

  return (
    <header className="bg-white text-slate-800 sticky top-0 z-40 border-b border-slate-100 shadow-2xs">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        
        {/* Left branding & identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            {isSystemAdmin ? (
              <>
                <h1 className="text-[#168821] font-black text-lg sm:text-xl leading-none tracking-tight">
                  COMIS
                </h1>
                <p className="text-[#d4a000] font-bold text-xs sm:text-sm leading-tight mt-0.5">
                  Admin
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[#168821] font-bold text-sm sm:text-base leading-tight truncate">
                  {displayName}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[#d4a000] font-bold text-xs sm:text-sm">
                    {displayRole}
                  </span>

                  {/* Contextual Action Pill Button (Mockup Exact Match) */}
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("open-supply-modal"))}
                      className="hidden md:inline-block px-2.5 py-0.5 rounded-md bg-[#168821] text-white font-bold text-[11px] hover:bg-[#126e1a] shadow-xs active:scale-95 transition cursor-pointer"
                    >
                      SUPPLY
                    </button>
                  )}
                  {isManager && location.pathname === "/" && (
                    <Link
                      to="/loan"
                      className="hidden md:inline-block px-2.5 py-0.5 rounded-md border border-[#d4a000] text-[#d4a000] font-bold text-[11px] hover:bg-amber-50 active:scale-95 transition"
                    >
                      LOAN
                    </Link>
                  )}
                  {(isManager || isSecretary) && location.pathname === "/loan" && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("open-loan-payment"))}
                      className="inline-block px-2.5 py-1 rounded-full bg-[#168821] text-white font-bold text-[11px] hover:bg-[#126e1a] shadow-xs active:scale-95 transition cursor-pointer"
                    >
                      Enter Loan Payment
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Middle: Desktop Navigation Links (hidden on mobile, shown on md+) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
          {isSystemAdmin ? (
            <>
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Overview
              </Link>
              <Link
                to="/users"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/users"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Users & Approvals
              </Link>
              <Link
                to="/audit-logs"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/audit-logs"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Audit Logs
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Home
              </Link>
              <Link
                to="/users"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/users"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Staff / Sellers
              </Link>
              <Link
                to="/cocoa"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/cocoa"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Cocoa
              </Link>
              <Link
                to="/coffee"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/coffee"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Coffee
              </Link>
              <Link
                to="/cola"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/cola"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Cola
              </Link>
              <Link
                to="/loan"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/loan"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Loans
              </Link>
              <Link
                to="/receipts"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/receipts"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Receipts
              </Link>
              <Link
                to="/reports"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  location.pathname === "/reports"
                    ? "bg-[#168821] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Reports
              </Link>
              {(isManager || isSecretary) && (
                <Link
                  to="/market"
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    location.pathname.startsWith("/market")
                      ? "bg-[#d4a000] text-white shadow-xs"
                      : "text-[#b38600] hover:bg-amber-50"
                  }`}
                >
                  Market
                  <CountBadge count={notifications} className="ml-1 inline-block" />
                </Link>
              )}
            </>
          )}
        </nav>

        {/* Right profile / user icon */}
        <div className="relative shrink-0">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="p-1.5 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition focus:outline-none cursor-pointer"
            aria-label="User Profile"
          >
            {/* Profile photo (or icon) with the green online dot */}
            <div className="relative">
              {avatarUrl ? (
                <UserAvatar src={avatarUrl} name={name} role={role} size="w-8 h-8 text-sm" />
              ) : (
                <UserIcon className="w-7 h-7 text-slate-700 stroke-[1.8]" />
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-[#168821] rounded-full" />
              </div>
            </div>
          </button>

          {/* Profile Popover matching user mockup photo media_1788721640851.png */}
          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-xl border-2 border-[#168821] p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex justify-between items-start gap-2">
                  <button type="button" onClick={() => { setProfileOpen(false); setPhotoOpen(true); }}
                    aria-label="Change profile photo" className="relative shrink-0 cursor-pointer">
                    <UserAvatar src={avatarUrl} name={name} role={role} size="w-12 h-12 text-lg" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#168821] text-white flex items-center justify-center ring-2 ring-white">
                      <Camera className="w-3 h-3" />
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    {/* User Full Name */}
                    <p className="font-bold text-base text-[#0f5c18] leading-tight">
                      {name || "User"}
                    </p>
                    {/* Station / Company Name */}
                    <p className="font-bold text-xs text-[#d4a000] mt-1 leading-tight">
                      {displayName}
                    </p>
                    {/* Role */}
                    <p className="font-semibold text-xs text-[#0f5c18] mt-1">
                      {displayRole}
                    </p>
                  </div>

                  {/* Edit Profile Link (System Admin & Produce Manager only) */}
                  {(isManager || isSystemAdmin) && (
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="text-[#168821] hover:text-[#0f5c18] font-bold text-xs hover:underline cursor-pointer transition pt-5"
                    >
                      Edit Profile
                    </Link>
                  )}
                </div>

                {/* Quick Navigation / Settings in Profile Popover */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                  {!isSystemAdmin && (
                    <>
                      <Link
                        to="/receipts"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#168821] transition"
                      >
                        <Receipt className="w-4 h-4 text-emerald-700" />
                        <span>Receipts & Verification</span>
                      </Link>

                      <Link
                        to="/reports"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#168821] transition"
                      >
                        <FileBarChart className="w-4 h-4 text-emerald-700" />
                        <span>Reports & Analytics</span>
                      </Link>
                    </>
                  )}

                  {isManager && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          // The supply form lives on the Home page: go there first if needed
                          const open = () => window.dispatchEvent(new CustomEvent("open-supply-modal"));
                          if (location.pathname === "/") open();
                          else {
                            navigate("/");
                            setTimeout(open, 150);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#168821] transition cursor-pointer text-left"
                      >
                        <Truck className="w-4 h-4 text-emerald-700" />
                        <span>Supply</span>
                      </button>

                      <Link
                        to="/loan"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-[#b38600] transition"
                      >
                        <Wallet className="w-4 h-4 text-[#d4a000]" />
                        <span>Loans</span>
                      </Link>
                    </>
                  )}

                  {(isManager || isSecretary || isSystemAdmin) && (
                    <Link
                      to={isSystemAdmin ? "/market/moderation" : "/market"}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-[#b38600] transition"
                    >
                      <Store className="w-4 h-4 text-[#d4a000]" />
                      <span>{isSystemAdmin ? "Market Moderation" : "COMIS Market"}</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setPhotoOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#168821] transition cursor-pointer text-left"
                  >
                    <Camera className="w-4 h-4 text-emerald-700" />
                    <span>Profile Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setChangePasswordOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition cursor-pointer text-left"
                  >
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>Change Password</span>
                  </button>
                </div>

                {/* Bottom Logout Row */}
                <div className="mt-2 pt-2.5 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-[#d32f2f] hover:text-red-700 font-bold text-sm transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 stroke-[2.5]" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      {/* On mobile, Receipts / Reports / Supply / Loans / Password live in the profile dropdown */}

      <ProfilePhotoModal isOpen={photoOpen} onClose={() => setPhotoOpen(false)} />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </header>
  );
}

