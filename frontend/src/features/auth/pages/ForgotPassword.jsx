import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, User, ArrowRight } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import "../styles/auth.css";
import { apiUrl } from "../../../shared/utils/api";

export default function ForgotPassword() {
  const [studentId, setStudentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const trimmed = studentId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      setError("Please enter a valid numeric Student ID.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: trimmed })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to process request.");
        return;
      }
      setMessage(data.message);
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
          Forgot Password<span>.</span>
        </h2>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        {message && (
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
            {message}
          </p>
        )}

        <div className="auth-field">
          <label htmlFor="forgot-student-id">Student ID</label>

          <div className="auth-input-wrapper">
            <User size={18} />
            <input
              id="forgot-student-id"
              type="text"
              placeholder="Enter your Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Sending Reset Link..." : "Send Reset Link"}
          {!submitting && <ArrowRight size={17} />}
        </button>

        <p className="auth-bottom-text">
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
