import { useState, useEffect } from "react";
import {
  GraduationCap,
  UserRound,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  FileText,
  ShieldCheck
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import "../styles/auth.css";
import { imagePath } from "../../../shared/utils/imagePath";
import { apiUrl } from "../../../shared/utils/api";

const legalContent = {
  terms: {
    title: "Terms of Service",
    icon: FileText,
    sections: [
      {
        heading: "1. Introduction",
        content:
          "Welcome to Findr, a campus community platform designed for students of the University of San Carlos. By creating an account and using Findr, you agree to follow these Terms of Service."
      },
      {
        heading: "2. Account Registration",
        content:
          "Users must provide accurate information when registering using their official student ID. You are responsible for maintaining the confidentiality of your login credentials and for activities conducted through your account."
      },
      {
        heading: "3. Marketplace Guidelines",
        content:
          "Users may post items for sale or browse listings from other members of the campus community. All listings must accurately describe the item being offered. Fraudulent listings, misleading descriptions, and prohibited items are not permitted."
      },
      {
        heading: "4. Lost and Found",
        content:
          "The Lost and Found feature allows users to report missing or recovered belongings. Reports must contain truthful information. Users must not falsely claim ownership of items."
      },
      {
        heading: "5. Tambayan Room Information",
        content:
          "Findr may display information about available campus rooms. Room availability is provided for informational purposes only and does not constitute an official reservation."
      },
      {
        heading: "6. Acceptable Use",
        content:
          "Users must treat other members respectfully. Harassment, discrimination, threats, spam, and fraudulent activities are prohibited."
      },
      {
        heading: "7. User-Generated Content",
        content:
          "Users are responsible for the information, images, and other materials they submit. Findr may remove content that violates these terms."
      },
      {
        heading: "8. Platform Availability",
        content:
          "Findr is provided as a campus community platform. Features may be updated, temporarily unavailable, or modified as the system develops."
      },
      {
        heading: "9. Account Restrictions",
        content:
          "Accounts that violate these terms may be restricted or suspended, subject to the platform's applicable moderation procedures."
      },
      {
        heading: "10. Changes to These Terms",
        content:
          "These Terms of Service may be updated as Findr develops. Updated terms will be posted on the platform, and significant changes may be communicated via email or an in-app notice."
      }
    ]
  },
  privacy: {
    title: "Privacy Policy",
    icon: ShieldCheck,
    sections: [
      {
        heading: "1. Introduction",
        content:
          "Findr values the privacy of its users. This Privacy Policy describes the personal information that the platform may collect, how it may be used, and the measures intended to protect it."
      },
      {
        heading: "2. Information We Collect",
        content:
          "When you register using your Student ID, Findr derives your official email address (@usc.edu.ph) and collects your full name and credentials."
      },
      {
        heading: "3. How We Use Your Information",
        content:
          "Information may be used to create and manage accounts, authenticate users, display submitted content, and support communication between users."
      },
      {
        heading: "4. Password and Account Security",
        content:
          "Findr uses appropriate safeguards to protect account information, including secure password hashing (bcrypt), access restrictions, and encrypted HTTPS connections."
      },
      {
        heading: "5. Information Shared With Other Users",
        content:
          "Information included in public listings or reports may be visible to other Findr users. When you submit a Lost & Found claim or Marketplace request, your name and @usc.edu.ph email may be shared with the post owner to coordinate item handover."
      },
      {
        heading: "6. Data Storage and Retention",
        content:
          "Personal information should be retained only for as long as necessary for legitimate platform purposes in accordance with university guidelines."
      },
      {
        heading: "7. Third-Party Services",
        content:
          "If Findr uses third-party hosting or email services, those services may process information necessary to deliver verification links and claim or request notifications."
      },
      {
        heading: "8. Your Privacy Rights",
        content:
          "Users may request access, correction, or deletion of their personal information, subject to applicable law."
      },
      {
        heading: "9. Data Privacy Act of 2012",
        content:
          "Findr handles personal information in accordance with Republic Act No. 10173, also known as the Data Privacy Act of 2012."
      },
      {
        heading: "10. Policy Updates",
        content:
          "This Privacy Policy may be revised when Findr introduces new features or changes its data processing practices."
      }
    ]
  }
};

function LegalModal({ type, onClose }) {
  useEffect(() => {
    if (!type) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [type, onClose]);

  if (!type) return null;

  const content = legalContent[type];
  const Icon = content.icon;

  return (
    <div
      className="legal-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
      >
        <div className="legal-modal-header">
          <div className="legal-modal-heading">
            <div className="legal-modal-icon">
              <Icon size={20} />
            </div>

            <div>
              <span>FINDR PLATFORM</span>
              <h2 id="legal-modal-title">{content.title}</h2>
            </div>
          </div>

          <button
            type="button"
            className="legal-modal-close"
            onClick={onClose}
            aria-label="Close popup"
          >
            <X size={19} />
          </button>
        </div>

        <div className="legal-modal-content">
          <p className="legal-modal-intro">
            Please review the following information before
            creating your Findr account.
          </p>

          {content.sections.map((section) => (
            <div
              className="legal-modal-section"
              key={section.heading}
            >
              <h3>{section.heading}</h3>
              <p>{section.content}</p>
            </div>
          ))}
        </div>

        <div className="legal-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="legal-modal-done"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    studentId: "",
    name: "",
    password: "",
    confirmPassword: "",
    agree: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (
      !form.studentId.trim() ||
      !form.name.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (!/^\d+$/.test(form.studentId.trim())) {
      setError("Please enter a valid numeric Student ID.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!form.agree) {
      setError(
        "Please agree to the Terms of Service and Privacy Policy."
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          student_id: form.studentId.trim(),
          full_name: form.name.trim(),
          password: form.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      alert(data.message || "Registration successful!");
      navigate("/login");

    } catch (err) {
      setError(err.message || "Unable to connect to the server. Please ensure the backend is running.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthLayout>
        <div className="auth-form-header">
          <span className="auth-welcome">
            <GraduationCap size={17} />
            JOIN THE CAROLINIAN COMMUNITY
          </span>

          <h2>
            Sign up for Findr<span>.</span>
          </h2>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="signup-studentid">
              Student ID
            </label>

            <div className="auth-input-wrapper">
              <GraduationCap size={18} />

              <input
                id="signup-studentid"
                type="text"
                placeholder="Enter your Student ID"
                value={form.studentId}
                onChange={(event) =>
                  updateField("studentId", event.target.value)
                }
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-name">
              Full name
            </label>

            <div className="auth-input-wrapper">
              <UserRound size={18} />

              <input
                id="signup-name"
                type="text"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-password">
              Password
            </label>

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password (min. 8 characters)"
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
              />

              <button
                type="button"
                className="auth-eye-button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <Eye size={18} />
                ) : (
                  <EyeOff size={18} />
                )}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-confirm">
              Confirm password
            </label>

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                id="signup-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(event) =>
                  updateField(
                    "confirmPassword",
                    event.target.value
                  )
                }
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="auth-eye-button"
                onClick={() =>
                  setShowConfirm(!showConfirm)
                }
                aria-label={
                  showConfirm
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirm ? (
                  <Eye size={18} />
                ) : (
                  <EyeOff size={18} />
                )}
              </button>
            </div>
          </div>

          <label className="auth-checkbox auth-agreement">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(event) =>
                updateField("agree", event.target.checked)
              }
            />

            <span>
              I agree to Findr's{" "}
              <button
                type="button"
                className="auth-legal-link"
                onClick={() => setActiveModal("terms")}
              >
                Terms of Service
              </button>
              {" "}and{" "}
              <button
                type="button"
                className="auth-legal-link"
                onClick={() => setActiveModal("privacy")}
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
          >
            {submitting ? "Creating Account..." : "Create Account"}
            {!submitting && <ArrowRight size={17} />}
          </button>

          <p className="auth-bottom-text">
            Already have an account?{" "}
            <Link to="/login">Login</Link>
          </p>
        </form>
      </AuthLayout>

      <LegalModal
        type={activeModal}
        onClose={() => setActiveModal(null)}
      />
    </>
  );
}

export default Signup;