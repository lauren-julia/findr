import { useEffect, useMemo, useState } from "react";
import { Search, Mail, CalendarDays, Ban, RotateCcw } from "lucide-react";
import AdminLayout from "../layouts/AdminLayout";
import { apiUrl } from "../../../shared/utils/api";

const statuses = ["All users", "Active", "Inactive", "Suspended"];
const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("All users");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/users"), { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load users.");
        if (active) {
          setUsers(json.users || []);
          if (json.users?.length > 0) {
            setSelectedId(json.users[0].user_id);
          }
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = useMemo(
    () =>
      statuses.reduce((acc, s) => {
        acc[s] =
          s === "All users"
            ? users.length
            : users.filter((u) => u.account_status === s).length;
        return acc;
      }, {}),
    [users]
  );

  const filtered = useMemo(
    () =>
      users
        .filter((u) => filter === "All users" || u.account_status === filter)
        .filter((u) =>
          `${u.full_name} ${u.student_id} ${u.email}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort((a, b) =>
          sort === "newest" ? b.user_id - a.user_id : a.user_id - b.user_id
        ),
    [users, filter, search, sort]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selected =
    filtered.find((u) => u.user_id === selectedId) || paginated[0];

  const setStatus = async (status) => {
    if (!selected || saving) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${selected.user_id}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update account status.");

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === selected.user_id
            ? { ...u, account_status: json.account_status }
            : u
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="User Management"
      subtitle="View registered student accounts and deactivate accounts that misuse the platform."
    >
      {error && (
        <p className="create-form-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className="adm-toolbar">
        <div className="adm-filters">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              className={filter === s ? "active" : ""}
              onClick={() => {
                setFilter(s);
                setPage(1);
              }}
            >
              {s} ({counts[s]})
            </button>
          ))}
        </div>

        <div className="adm-search-tools">
          <div className="adm-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search name, ID, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="adm-layout">
        <div className="adm-table-card">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u) => (
                <tr
                  key={u.user_id}
                  className={selected?.user_id === u.user_id ? "selected" : ""}
                  onClick={() => setSelectedId(u.user_id)}
                >
                  <td>
                    <div className="adm-cell-user">
                      <div className="adm-avatar">
                        {u.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <strong>{u.full_name}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{u.student_id}</td>
                  <td>
                    <span className={`adm-status ${u.account_status.toLowerCase()}`}>
                      {u.account_status}
                    </span>
                  </td>
                  <td>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading ? (
            <div className="adm-empty">Loading student accounts...</div>
          ) : (
            filtered.length === 0 && (
              <div className="adm-empty">
                {users.length === 0 ? "No student accounts yet." : "No matching users found."}
              </div>
            )
          )}

          <div className="adm-list-footer">
            <span>
              Showing {paginated.length} of {filtered.length} students
            </span>
            <div className="adm-pagination">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <section className="adm-card adm-details">
          <div className="adm-card-header">
            <h3>Account details</h3>
            {selected && (
              <span className={`adm-status ${selected.account_status.toLowerCase()}`}>
                {selected.account_status}
              </span>
            )}
          </div>

          {selected ? (
            <div className="adm-details-body">
              <div className="adm-profile">
                <div className="adm-avatar large">
                  {selected.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <strong>{selected.full_name}</strong>
                  <small>{selected.student_id}</small>
                </div>
              </div>

              <div className="adm-contact">
                <Mail size={15} /> {selected.email}
              </div>
              <div className="adm-contact">
                <CalendarDays size={15} /> Registered {formatDate(selected.created_at)}
              </div>

              <div className="adm-actions">
                {selected.account_status === "Active" ? (
                  <button
                    type="button"
                    className="adm-danger"
                    disabled={saving}
                    onClick={() => setStatus("Suspended")}
                  >
                    <Ban size={15} />
                    {saving ? "Updating..." : "Deactivate account"}
                  </button>
                ) : selected.account_status === "Suspended" ? (
                  <button
                    type="button"
                    className="adm-primary"
                    disabled={saving}
                    onClick={() => setStatus("Active")}
                  >
                    <RotateCcw size={15} />
                    {saving ? "Updating..." : "Reactivate account"}
                  </button>
                ) : (
                  <span className="adm-help">Pending email verification.</span>
                )}
              </div>

              <p className="adm-help">
                Deactivated users cannot log in or start new transactions.
                Their posts and transactions are hidden from other users while deactivated,
                and existing records stay in the database.
              </p>
            </div>
          ) : (
            <div className="adm-empty">Select a user to view their details.</div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
