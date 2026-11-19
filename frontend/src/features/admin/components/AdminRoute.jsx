import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";

export default function AdminRoute({ children }) {
  const { isLoggedIn, user } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user?.role !== "Admin") {
    return <Navigate to="/home" replace />;
  }

  return children;
}
