import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore.js";

// Components & Layout
import ProtectedRoute from "./components/shared/ProtectedRoute.jsx";
import TopHeader from "./components/nav/TopHeader.jsx";
import BottomNav from "./components/nav/BottomNav.jsx";

// Pages
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Seller from "./pages/Seller.jsx";
import Cocoa from "./pages/Cocoa.jsx";
import Coffee from "./pages/Coffee.jsx";
import Cola from "./pages/Cola.jsx";
import Transactions from "./pages/Transactions.jsx";
import Loan from "./pages/Loan.jsx";
import Receipts from "./pages/Receipts.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";
import Settings from "./pages/Settings.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import TermsOfService from "./pages/TermsOfService.jsx";
import UserAgreement from "./pages/UserAgreement.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import About from "./pages/About.jsx";
import MarketHome from "./pages/market/MarketHome.jsx";
import MarketListing from "./pages/market/MarketListing.jsx";
import MarketPost from "./pages/market/MarketPost.jsx";
import MarketActivity from "./pages/market/MarketActivity.jsx";
import MarketMe from "./pages/market/MarketMe.jsx";
import MarketModeration from "./pages/market/MarketModeration.jsx";
import { isMarketRole } from "./utils/market.js";
import { useNotificationPolling } from "./hooks/useNotificationPolling.js";

const STATION_ROLES = ["produce_manager", "produce_secretary", "system_admin"];
const MARKET_VIEW = ["farmer", "trader", "produce_manager", "produce_secretary", "system_admin"];
const MARKET_TRADE = ["farmer", "trader", "produce_manager", "produce_secretary"];

/** Farmers and traders have no station dashboard: their home is the market. */
function HomeGate() {
  const role = useAuthStore((s) => s.role);
  return isMarketRole(role) ? <Navigate to="/market" replace /> : <Home />;
}

/** Station pages: market accounts are sent to the market instead of a blank/403 screen. */
function StationOnly({ children, roles = STATION_ROLES }) {
  const role = useAuthStore((s) => s.role);
  if (isMarketRole(role)) return <Navigate to="/market" replace />;
  return <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;
}

function AppLayout({ children }) {
  const { role } = useAuthStore();
  useNotificationPolling();

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
        <main className="flex-1 w-full">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-slate-50/80 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-hidden">
      <TopHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 overflow-y-auto overscroll-contain">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login initialMode="signin" />} />
          <Route path="/signup" element={<Login initialMode="signup" />} />
          <Route path="/register" element={<Login initialMode="signup" />} />

          {/* Public Legal & Informational Pages */}
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/user-agreement" element={<UserAgreement />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<About />} />

          {/* Core Dashboard / Home */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeGate />
              </ProtectedRoute>
            }
          />

          {/* Seller Registry */}
          <Route
            path="/seller"
            element={
              <StationOnly>
                <Seller />
              </StationOnly>
            }
          />

          {/* Commodity Intake Pages */}
          <Route
            path="/cocoa"
            element={
              <StationOnly>
                <Cocoa />
              </StationOnly>
            }
          />
          <Route
            path="/coffee"
            element={
              <StationOnly>
                <Coffee />
              </StationOnly>
            }
          />
          <Route
            path="/cola"
            element={
              <StationOnly>
                <Cola />
              </StationOnly>
            }
          />

          {/* Secretary Submitted Transactions */}
          <Route
            path="/transactions"
            element={
              <StationOnly>
                <Transactions />
              </StationOnly>
            }
          />

          {/* Loans Management (Manager & Admin) */}
          <Route
            path="/loan"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <Loan />
              </ProtectedRoute>
            }
          />

          {/* Receipts & Pending Verification (Manager & Secretary only) */}
          <Route
            path="/receipts"
            element={
              <ProtectedRoute roles={["produce_manager", "produce_secretary"]}>
                <Receipts />
              </ProtectedRoute>
            }
          />

          {/* Reporting & Analytics (Manager & Secretary only) */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={["produce_manager", "produce_secretary"]}>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Staff & User Management (Manager & Admin) */}
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <Users />
              </ProtectedRoute>
            }
          />

          {/* Operational Settings (Manager & Admin) */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Audit Logs (Admin & Manager) */}
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />

          {/* Edit Profile (Manager & System Admin only) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute roles={["produce_manager", "system_admin"]}>
                <EditProfile />
              </ProtectedRoute>
            }
          />

          {/* COMIS Market (farmers, traders, stations; admin moderates) */}
          <Route path="/market" element={<ProtectedRoute roles={MARKET_VIEW}><MarketHome /></ProtectedRoute>} />
          <Route path="/market/listing/:id" element={<ProtectedRoute roles={MARKET_VIEW}><MarketListing /></ProtectedRoute>} />
          <Route path="/market/new" element={<ProtectedRoute roles={MARKET_TRADE}><MarketPost /></ProtectedRoute>} />
          <Route path="/market/edit/:id" element={<ProtectedRoute roles={MARKET_TRADE}><MarketPost /></ProtectedRoute>} />
          <Route path="/market/activity" element={<ProtectedRoute roles={MARKET_TRADE}><MarketActivity /></ProtectedRoute>} />
          <Route path="/market/me" element={<ProtectedRoute roles={["farmer", "trader"]}><MarketMe /></ProtectedRoute>} />
          <Route path="/market/moderation" element={<ProtectedRoute roles={["system_admin"]}><MarketModeration /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
