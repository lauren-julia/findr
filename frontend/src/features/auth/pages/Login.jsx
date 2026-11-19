import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  GraduationCap,
  User,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";
import { apiUrl } from "../../../shared/utils/api";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [studentId, setStudentId] = useState(
    () => searchParams.get("studentId") || localStorage.getItem("findr-remembered-id") || ""
  );
  const isVerified = searchParams.get("verified") === "1";
  const isReset = searchParams.get("reset") === "1";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem("findr-remembered-id")));
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedStudentId = studentId.trim();

    if (!trimmedStudentId || !password) {
      setError("Please enter your Student ID and password.");
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ studentId: trimmedStudentId, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to log in.");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("findr-remembered-id", trimmedStudentId);
      } else {
        localStorage.removeItem("findr-remembered-id");
      }

      login(data.user, rememberMe);

      const defaultPath = data.user?.role === "Admin" ? "/admin" : "/home";
      const destination = location.state?.from || defaultPath;
      navigate(destination, { replace: true });

    } catch (err) {
      console.error("Network error during login:", err);
      setError("Unable to connect to the server. Please try again later.");
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form-header">
        <span className="auth-welcome">
          <GraduationCap size={17} />
          WELCOME BACK, CAROLINIAN
        </span>

        <h2>
          Login to Findr<span>.</span>
        </h2>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        {(isVerified || isReset) && (
          <p
            role="status"
            style={{
              margin: "0 0 14px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#eaf5ec",
              border: "1px solid #bfe3c8",
              color: "#086322",
              fontSize: "13px",
              fontWeight: 600
            }}
          >
            {isReset
              ? "Password updated! Please log in with your new password."
              : "Email verified! Enter your password to log in."}
          </p>
        )}

        <div className="auth-field">
          <label htmlFor="login-student-id">
            Student ID
          </label>

          <div className="auth-input-wrapper">
            <User size={18} />

            <input
              id="login-student-id"
              type="text"
              placeholder="Enter your Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="login-password">
            Password
          </label>

          <div className="auth-input-wrapper">
            <LockKeyhole size={18} />

            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="auth-eye-button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        <div className="auth-form-options">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>

          <Link to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="auth-submit">
          Login
          <ArrowRight size={17} />
        </button>

        <p className="auth-bottom-text">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Login;