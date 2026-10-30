import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../lib/api";

export default function ProtectedRoute({ role, children }) {
  const user = getCurrentUser();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
