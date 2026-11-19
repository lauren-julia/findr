import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  MailWarning,
  Building2,
  Database,
  ClipboardList,
  ArrowRight
} from "lucide-react";
import AdminLayout from "../layouts/AdminLayout";
import { apiUrl } from "../../../shared/utils/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/stats"), { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load dashboard.");
        if (active) setData(json);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const userCounts = data?.users || { total: 0, active: 0, inactive: 0, suspended: 0 };
  const ref = data?.reference || { campuses: 0, buildings: 0, rooms: 0, schedules: 0, categories: 0 };
  const recentUsers = data?.recentUsers || [];

  const stats = [
    { label: "Total students", value: Number(userCounts.total) || 0, subtitle: "Registered accounts", icon: Users },
    { label: "Active", value: Number(userCounts.active) || 0, subtitle: "Can log in", icon: UserCheck },
    { label: "Unverified", value: Number(userCounts.inactive) || 0, subtitle: "Awaiting email verification", icon: MailWarning },
    { label: "Deactivated", value: Number(userCounts.suspended) || 0, subtitle: "Blocked from the platform", icon: UserX }
  ];

  const referenceCounts = [
    { label: "Campuses", value: Number(ref.campuses) || 0 },
    { label: "Buildings", value: Number(ref.buildings) || 0 },
    { label: "Rooms", value: Number(ref.rooms) || 0 },
    { label: "Class schedules", value: Number(ref.schedules) || 0 },
    { label: "Categories", value: Number(ref.categories) || 0 }
  ];

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Overview of student accounts and system reference data."
    >
      {error && (
        <p className="create-form-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className="adm-summary-grid">
        {stats.map(({ label, value, subtitle, icon: Icon }) => (
          <div className="adm-summary-card" key={label}>
            <span className="adm-summary-icon">
              <Icon size={19} />
            </span>
            <div>
              <div className="adm-summary-title">
                <strong>{loading ? "—" : value}</strong>
                <span>{label}</span>
              </div>
              <small>{subtitle}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-two-col">
        <section className="adm-card">
          <div className="adm-card-header">
            <h3>Recent registrations</h3>
            <Link to="/admin/users" className="adm-link">
              Manage users <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="adm-empty">Loading recent registrations...</div>
          ) : recentUsers.length === 0 ? (
            <div className="adm-empty">No student accounts registered yet.</div>
          ) : (
            <ul className="adm-list">
              {recentUsers.map((u) => (
                <li key={u.user_id}>
                  <div className="adm-avatar">
                    {u.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="adm-list-main">
                    <strong>{u.full_name}</strong>
                    <small>{u.student_id}</small>
                  </div>
                  <span className={`adm-status ${u.account_status.toLowerCase()}`}>
                    {u.account_status}
                  </span>
                  <small className="adm-muted">{formatDate(u.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card">
          <div className="adm-card-header">
            <h3>Reference data</h3>
            <Link to="/admin/system" className="adm-link">
              System management <ArrowRight size={13} />
            </Link>
          </div>

          <ul className="adm-list">
            {referenceCounts.map(({ label, value }) => (
              <li key={label}>
                <span className="adm-summary-icon small">
                  <Building2 size={14} />
                </span>
                <div className="adm-list-main">
                  <strong>{label}</strong>
                </div>
                <strong className="adm-count">{loading ? "—" : value}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="adm-quick-actions">
        <Link to="/admin/users" className="adm-quick">
          <Users size={18} />
          <div>
            <strong>User management</strong>
            <small>View student accounts and deactivate misuse.</small>
          </div>
        </Link>
        <Link to="/admin/listings" className="adm-quick">
          <ClipboardList size={18} />
          <div>
            <strong>Listing moderation</strong>
            <small>Review and remove Marketplace and Lost &amp; Found posts.</small>
          </div>
        </Link>
        <Link to="/admin/system" className="adm-quick">
          <Database size={18} />
          <div>
            <strong>System management</strong>
            <small>Add or edit campuses, buildings, rooms, schedules, categories.</small>
          </div>
        </Link>
      </div>
    </AdminLayout>
  );
}
