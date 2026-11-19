import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, LockKeyhole, Eye, EyeOff, ArrowRight } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import "../styles/auth.css";
import { apiUrl } from "../../../shared/utils/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing or invalid reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to reset password.");
        return;
      }

      const idQuery = data.studentId ? `&studentId=${encodeURIComponent(data.studentId)}` : "";
      navigate(`/login?reset=1${idQuery}`, { replace: true });
    } catch {
      setError("Unable to connect to the server. Please ensure the backend is running.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-form-header">
        <span className="auth-welcome">
          <GraduationCap size={17} />
          ACCOUNT RECOVERY
        </span>

        <h2>
          Reset Password<span>.</span>
        </h2>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="reset-password">New Password</label>

          <div className="auth-input-wrapper">
            <LockKeyhole size={18} />
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
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

        <div className="auth-field">
          <label htmlFor="reset-confirm">Confirm Password</label>

          <div className="auth-input-wrapper">
            <LockKeyhole size={18} />
            <input
              id="reset-confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="auth-eye-button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Resetting Password..." : "Reset Password"}
          {!submitting && <ArrowRight size={17} />}
        </button>

        <p className="auth-bottom-text">
          Back to <Link to="/login">Login</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
