import { useEffect, useMemo, useState } from "react";
import { Search, Mail, CalendarDays, Trash2, Tag, MapPin } from "lucide-react";
import AdminLayout from "../layouts/AdminLayout";
import { apiUrl } from "../../../shared/utils/api";
import { resolveMarketImage } from "../../marketplace/utils/marketplaceHelpers";

const TYPE_FILTERS = [
  { value: "all", label: "All listings" },
  { value: "marketplace", label: "Marketplace" },
  { value: "lost-found", label: "Lost & Found" }
];
const PAGE_SIZE = 10;

const typeLabel = (type) => (type === "marketplace" ? "Marketplace" : "Lost & Found");
const rowKey = (listing) => `${listing.type}-${listing.id}`;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export default function AdminListings() {
  const [listings, setListings] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/listings"), { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load listings.");
        if (active) setListings(json.listings || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const typeFiltered = useMemo(
    () => listings.filter((l) => typeFilter === "all" || l.type === typeFilter),
    [listings, typeFilter]
  );

  const statusOptions = useMemo(
    () => ["All statuses", ...Array.from(new Set(typeFiltered.map((l) => l.status)))],
    [typeFiltered]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return typeFiltered
      .filter((l) => statusFilter === "All statuses" || l.status === statusFilter)
      .filter(
        (l) =>
          !query ||
          `${l.title} ${l.owner_name} ${l.owner_email} ${l.category_name}`
            .toLowerCase()
            .includes(query)
      );
  }, [typeFiltered, statusFilter, search]);

  const counts = useMemo(
    () => ({
      all: listings.length,
      marketplace: listings.filter((l) => l.type === "marketplace").length,
      "lost-found": listings.filter((l) => l.type === "lost-found").length
    }),
    [listings]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = filtered.find((l) => rowKey(l) === selectedKey) || paginated[0];

  const removeListing = async () => {
    if (!selected || removing) return;

    setError("");
    setNotice("");
    setRemoving(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/listings/${selected.type}/${selected.id}`), {
        method: "DELETE",
        credentials: "include"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove listing.");

      setListings((prev) =>
        prev.map((l) => (rowKey(l) === rowKey(selected) ? { ...l, status: "Removed" } : l))
      );
      setNotice(`"${selected.title}" was removed.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AdminLayout
      title="Listing Moderation"
      subtitle="Review every Marketplace and Lost & Found post, and remove content that breaks the guidelines."
    >
      {error && (
        <p className="create-form-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ marginBottom: 16, color: "#086322", fontSize: 13, fontWeight: 600 }}>
          {notice}
        </p>
      )}

      <div className="adm-toolbar">
        <div className="adm-filters">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={typeFilter === t.value ? "active" : ""}
              onClick={() => {
                setTypeFilter(t.value);
                setStatusFilter("All statuses");
                setPage(1);
              }}
            >
              {t.label} ({counts[t.value]})
            </button>
          ))}
        </div>

        <div className="adm-search-tools">
          <div className="adm-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search title, owner, category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="adm-layout">
        <div className="adm-table-card">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Type</th>
                <th>Status</th>
                <th>Posted</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((l) => (
                <tr
                  key={rowKey(l)}
                  className={selected && rowKey(selected) === rowKey(l) ? "selected" : ""}
                  onClick={() => setSelectedKey(rowKey(l))}
                >
                  <td>
                    <div className="adm-cell-user">
                      <img className="adm-listing-thumb" src={resolveMarketImage(l.image_url)} alt="" />
                      <div>
                        <strong>{l.title}</strong>
                        <small>{l.owner_name}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="adm-type-chip">{typeLabel(l.type)}</span></td>
                  <td>
                    <span className={`adm-status ${l.status.toLowerCase()}`}>{l.status}</span>
                  </td>
                  <td>{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading ? (
            <div className="adm-empty">Loading listings...</div>
          ) : (
            filtered.length === 0 && (
              <div className="adm-empty">
                {listings.length === 0 ? "No listings have been posted yet." : "No matching listings found."}
              </div>
            )
          )}

          <div className="adm-list-footer">
            <span>Showing {paginated.length} of {filtered.length} listings</span>
            <div className="adm-pagination">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
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
            <h3>Listing details</h3>
            {selected && (
              <span className={`adm-status ${selected.status.toLowerCase()}`}>{selected.status}</span>
            )}
          </div>

          {selected ? (
            <div className="adm-details-body">
              <img
                className="adm-listing-preview"
                src={resolveMarketImage(selected.image_url)}
                alt={selected.title}
              />

              <div className="adm-profile">
                <div>
                  <strong>{selected.title}</strong>
                  <small>
                    {typeLabel(selected.type)}
                    {selected.post_type ? ` · ${selected.post_type} report` : ""}
                  </small>
                </div>
              </div>

              <div className="adm-contact">
                <Tag size={15} />
                {selected.category_name}
                {selected.price !== null && ` · ₱${Number(selected.price).toLocaleString()} · ${selected.item_condition}`}
              </div>
              <div className="adm-contact"><MapPin size={15} /> {selected.campus_name || selected.campus_code}</div>
              <div className="adm-contact"><Mail size={15} /> {selected.owner_name} ({selected.owner_email})</div>
              <div className="adm-contact">
                <CalendarDays size={15} /> Posted {formatDate(selected.created_at)}
              </div>

              {selected.description && (
                <p className="adm-help" style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>
              )}

              {selected.status !== "Removed" && (
                <div className="adm-actions">
                  <button
                    type="button"
                    className="adm-danger"
                    disabled={removing}
                    onClick={removeListing}
                  >
                    <Trash2 size={15} />
                    {removing ? "Removing..." : "Remove listing"}
                  </button>
                </div>
              )}

              <p className="adm-help">
                Removed listings are hidden from every public feed and from other users.
                The record is kept for auditing.
              </p>
            </div>
          ) : (
            <div className="adm-empty">Select a listing to view its details.</div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
