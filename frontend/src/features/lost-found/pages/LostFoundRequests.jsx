import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Clock3,
  CircleCheck,
  PackageCheck,
  CircleX,
  Search
} from "lucide-react";
import LostFoundHeader from "../components/LostFoundHeader";
import Toast from "../../marketplace/components/Toast";
import Pagination from "../../../shared/components/Pagination";
import { apiUrl } from "../../../shared/utils/api";
import {
  formatEventDate,
  formatRelativeTime,
  resolveLfImage
} from "../utils/lostFoundHelpers";
import "../styles/lost-found-pages.css";

const PAGE_SIZE = 6;
const statuses = ["All requests", "Pending", "Ready for return", "Returned", "Declined"];

export default function LostFoundRequests() {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const [scope, setScope] = useState(
    routeLocation.state?.tab === "outgoing" ? "outgoing" : "incoming"
  );
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All requests");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (routeLocation.state?.toast) {
      setToast({ message: routeLocation.state.toast, type: "success" });
      navigate(routeLocation.pathname, {
        replace: true,
        state: routeLocation.state.tab ? { tab: routeLocation.state.tab } : null
      });
    }
  }, [routeLocation.pathname, routeLocation.state, navigate]);

  useEffect(() => {
    let active = true;
    async function loadClaims() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(apiUrl("/api/lost-found/claims"), {
          credentials: "include"
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load requests.");
        }
        if (!active) return;

        const mapClaim = (row, isIncoming) => ({
          id: row.claim_id,
          itemId: row.lf_item_id,
          personName: isIncoming ? row.claimant_name : row.poster_name,
          personEmail: isIncoming ? row.claimant_email : row.poster_email,
          item: row.item_name,
          postType: row.post_type,
          claimType: row.claim_type,
          category: row.category_name,
          campus: row.campus_code,
          location: row.location || "Campus area",
          eventDate: formatEventDate(row.date_event),
          time: formatRelativeTime(row.claimed_at),
          claimedAt: new Date(row.claimed_at).getTime(),
          status: row.status,
          note: row.note || row.claim_type,
          image: resolveLfImage(row.image_url)
        });

        setIncoming((data.incoming || []).map((r) => mapClaim(r, true)));
        setOutgoing((data.outgoing || []).map((r) => mapClaim(r, false)));
      } catch (err) {
        if (active) setError(err.message || "Unable to load requests.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadClaims();
    return () => {
      active = false;
    };
  }, []);

  const requests = scope === "incoming" ? incoming : outgoing;

  const counts = useMemo(() => {
    return statuses.reduce((result, status) => {
      result[status] = status === "All requests"
        ? requests.length
        : requests.filter((request) => request.status === status).length;
      return result;
    }, {});
  }, [requests]);

  const filtered = requests
    .filter((request) => {
      const matchesStatus = statusFilter === "All requests" ||
        request.status === statusFilter;
      const matchesSearch = `${request.personName} ${request.item}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => sort === "newest" ? b.claimedAt - a.claimedAt : a.claimedAt - b.claimedAt);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selected = paginated.find((request) => request.id === selectedId) || paginated[0];

  const updateStatus = async (status) => {
    if (!selected || scope !== "incoming") return;
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/lost-found/claims/${selected.id}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update request status.");
      }
      setIncoming((previous) =>
        previous.map((request) => {
          if (request.id === selected.id) {
            return { ...request, status };
          }
          if (
            (status === "Ready for return" || status === "Returned") &&
            request.itemId === selected.itemId &&
            (request.status === "Pending" || request.status === "Ready for return")
          ) {
            return { ...request, status: "Declined" };
          }
          return request;
        })
      );
    } catch (err) {
      setError(err.message || "Unable to update request status.");
    } finally {
      setUpdating(false);
    }
  };

  const summary = [
    { status: "Pending", subtitle: "Check ownership details", icon: Clock3 },
    { status: "Ready for return", subtitle: "Arrange a safe handover", icon: CircleCheck },
    { status: "Returned", subtitle: "Back with their owner", icon: PackageCheck },
    { status: "Declined", subtitle: "Details did not match", icon: CircleX }
  ];

  return (
    <main className="lf-page">
      <LostFoundHeader />

      <div className="lf-section-heading">
        <div>
          <h2>View Claims</h2>
          <p>
            {scope === "incoming"
              ? "Review claims on your posts and help belongings get back to their owners."
              : "Track the status of claims you have submitted on other posts."}
          </p>
        </div>

        <div className="lf-scope-tabs">
          <button
            type="button"
            className={scope === "incoming" ? "active" : ""}
            onClick={() => {
              setScope("incoming");
              setStatusFilter("All requests");
              setSelectedId(null);
              setPage(1);
            }}
          >
            Incoming ({incoming.length})
          </button>
          <button
            type="button"
            className={scope === "outgoing" ? "active" : ""}
            onClick={() => {
              setScope("outgoing");
              setStatusFilter("All requests");
              setSelectedId(null);
              setPage(1);
            }}
          >
            My Claims ({outgoing.length})
          </button>
        </div>
      </div>

      <div className="lf-summary-grid">
        {summary.map(({ status, subtitle, icon: Icon }) => (
          <div className="lf-summary-card" key={status}>
            <span className="lf-summary-icon"><Icon size={19} /></span>
            <div>
              <strong>{counts[status]}</strong>
              <span>{status}</span>
              <small>{subtitle}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="lf-requests-toolbar">
        <div className="lf-request-filters">
          {statuses.map((status) => (
            <button
              type="button"
              key={status}
              className={statusFilter === status ? "active" : ""}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {status} ({counts[status]})
            </button>
          ))}
        </div>

        <div className="lf-request-search-tools">
          <div className="lf-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search names or items..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {error && <p className="lf-form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="lf-empty">Loading claims...</p>
      ) : filtered.length === 0 ? (
        <div className="lf-empty">
          {requests.length === 0
            ? scope === "incoming"
              ? "No claims have been made on your items yet."
              : "You have not claimed any items yet."
            : "No matching claims."}
        </div>
      ) : (
        <div className="lf-requests-layout">
          <div className="lf-request-list">
            {paginated.map((request) => (
              <button
                type="button"
                key={request.id}
                className={`lf-request-card ${selected?.id === request.id ? "selected" : ""}`}
                onClick={() => setSelectedId(request.id)}
              >
                <img
                  src={request.image}
                  alt={request.item}
                />

                <div className="lf-request-card-content">
                  <div className="lf-request-card-top">
                    <strong>{request.personName}</strong>
                    <span className={`lf-status ${request.status.toLowerCase().replaceAll(" ", "-")}`}>
                      {request.status}
                    </span>
                  </div>

                  <h3>{request.item}</h3>
                  <p>{request.time} · {request.note}</p>
                </div>
              </button>
            ))}

            <div className="lf-request-list-footer">
              Showing {paginated.length} of {filtered.length} requests
              <span>
                {scope === "incoming"
                  ? "Claims on your posts"
                  : "Claims you submitted"}
              </span>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>

          <section className="lf-request-details">
            <div className="lf-request-details-header">
              <h3>Claim details</h3>
              {selected && (
                <span className={`lf-status ${selected.status.toLowerCase().replaceAll(" ", "-")}`}>
                  {selected.status}
                </span>
              )}
            </div>

            {selected ? (
              <div className="lf-request-details-body">
                <div className="lf-request-item-section">
                  <div className="lf-request-item">
                    <img
                      src={selected.image}
                      alt={selected.item}
                    />

                    <div>
                      <span className="lf-item-category">
                        {selected.postType.toUpperCase()} · {selected.category}
                      </span>
                      <h3>{selected.item}</h3>
                      <p>{selected.location}, {selected.campus} · {selected.eventDate}</p>
                      <span className="lf-view-post">
                        {selected.claimType}
                      </span>
                    </div>
                  </div>

                  {scope === "outgoing" && selected.note && selected.note !== selected.claimType && (
                    <div className="lf-request-note-box">
                      <span className="lf-detail-label">NOTE</span>
                      <p>{selected.note}</p>
                    </div>
                  )}
                </div>

                <div className="lf-request-claimant">
                  <span className="lf-detail-label">
                    {scope === "incoming" ? "ABOUT THE CLAIMANT" : "ABOUT THE POSTER"}
                  </span>

                  <div className="lf-claimant-row">
                    <span className="lf-avatar">
                      {selected.personName.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                    </span>

                    <div>
                      <strong>{selected.personName}</strong>
                      <p>{selected.personEmail}</p>
                    </div>
                  </div>

                  {scope === "incoming" && selected.note && selected.note !== selected.claimType && (
                    <div className="lf-request-note-box">
                      <span className="lf-detail-label">NOTE</span>
                      <p>{selected.note}</p>
                    </div>
                  )}
                </div>

                {scope === "incoming" && selected.status === "Pending" && (
                  <div className="lf-request-actions">
                    <button
                      type="button"
                      className="lf-decline"
                      disabled={updating}
                      onClick={() => updateStatus("Declined")}
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      className="lf-primary-button"
                      disabled={updating}
                      onClick={() => updateStatus("Ready for return")}
                    >
                      <CircleCheck size={16} />
                      Approve return
                    </button>
                  </div>
                )}

                {scope === "incoming" && selected.status === "Ready for return" && (
                  <div className="lf-request-actions">
                    <button
                      type="button"
                      className="lf-primary-button"
                      disabled={updating}
                      onClick={() => updateStatus("Returned")}
                    >
                      <PackageCheck size={16} />
                      Mark as returned
                    </button>
                  </div>
                )}

                {(selected.status === "Pending" || selected.status === "Ready for return") && (
                  <p className="lf-request-help">
                    {scope === "incoming"
                      ? "Approve only when the details match. Then arrange a public campus handover and mark the item Returned after it reaches its owner."
                      : "Contact the poster via their USC email once your claim is Ready for return to arrange a campus handover."}
                  </p>
                )}
              </div>
            ) : (
              <p className="lf-empty">Select a request to view its details.</p>
            )}
          </section>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </main>
  );
}
