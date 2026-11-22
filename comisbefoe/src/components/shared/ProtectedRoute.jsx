import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.js";

/** Wrap any route element: <ProtectedRoute roles={["produce_manager","system_admin"]}><Loan /></ProtectedRoute>
 * This is a UX convenience only - the real enforcement is server-side (see permissions.py). */
export default function ProtectedRoute({ children, roles }) {
  const role = useAuthStore((s) => s.role);
  if (!role) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) {
    // "/" sends farmers/traders on to the market, so this never loops
    return <Navigate to={role === "farmer" || role === "trader" ? "/market" : "/"} replace />;
  }
  return children;
}
