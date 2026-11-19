import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/context/AuthContext";
import { apiUrl } from "../utils/api";

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include"
      });
    } catch (err) {
      console.error("Server logout request failed:", err);
    } finally {
      logout();
      navigate("/home", { replace: true });
    }
  };

  const isAdmin = isLoggedIn && user?.role === "Admin";

  return (
    <header className="navbar">
      <Link to={isAdmin ? "/admin" : "/home"} className="logo">
        <img
          className="logo-icon"
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt=""
        />
        <div>
          <strong>Findr.</strong>
          <small>USC DCISM</small>
        </div>
      </Link>

      <nav className="nav-links">
        {/* TEMPORARY: Showing student modules to Admin */}
        <NavLink to="/home">Home</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <NavLink to="/lost-and-found">Lost & Found</NavLink>
        <NavLink to="/tambayan">Tambayan</NavLink>
        {isAdmin && (
          <>
            <NavLink to="/admin" end>Admin Dashboard</NavLink>
            <NavLink to="/admin/listings">Listings</NavLink>
            <NavLink to="/admin/users">Users</NavLink>
            <NavLink to="/admin/system">System Management</NavLink>
          </>
        )}
      </nav>

      <div className="nav-actions">
        {isLoggedIn ? (
          <>
            <span className="lf-nav-user">{user.full_name}</span>
            <button type="button" className="login-btn" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="login-btn">Login</Link>
            <Link to="/signup" className="signup-btn">Sign Up</Link>
          </>
        )}
      </div>
    </header>
  );
}