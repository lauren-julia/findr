import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Clock3,
  CircleCheck,
  CircleX,
  Ban,
  Search
} from "lucide-react";
import MarketplaceHeader from "../components/MarketplaceHeader";
import Toast from "../components/Toast";
import Pagination from "../../../shared/components/Pagination";
import { apiUrl } from "../../../shared/utils/api";
import { formatRelativeTime } from "../../lost-found/utils/lostFoundHelpers";
import { formatPrice, resolveMarketImage } from "../utils/marketplaceHelpers";
import "../styles/marketplace-requests.css";

const PAGE_SIZE = 6;
const statuses = ["All requests", "Pending", "Confirmed", "Declined", "Cancelled"];

const formatCampusName = (code, name) => {
  if (code === "TC") return "Talamban";
  if (code === "DC") return "Downtown";
  return name || code;
};

const formatPostedDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const mapRequest = (row, isIncoming) => ({
  id: row.request_id,
  itemId: row.m_item_id,
  personName: isIncoming ? row.buyer_name : row.seller_name,
  personEmail: isIncoming ? row.buyer_email : row.seller_email,
  item: row.item_name,
  category: row.category_name,
  condition: row.condition,
  price: Number(row.price),
  campus: formatCampusName(row.campus_code, row.campus_name),
  itemDate: formatPostedDate(row.item_created_at || row.requested_at),
  itemStatus: row.item_status,
  time: formatRelativeTime(row.requested_at),
  requestedAt: new Date(row.requested_at).getTime(),
  status: row.status,
  image: resolveMarketImage(row.image_url)
});

const initials = (name) =>
  String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

export default function MarketplaceRequests() {
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
  const [filter, setFilter] = useState("All requests");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (routeLocation.state?.toast) {
      setToast({ message: routeLocation.state.toast, type: "success" });
      navigate(routeLocation.pathname, {
        replace: true,
        state: routeLocation.state.tab ? { tab: routeLocation.state.tab } : null
      });
    }
  }, [routeLocation.state, routeLocation.pathname, navigate]);

  const loadRequests = useCallback(async () => {
    const res = await fetch(apiUrl("/api/marketplace/requests"), {
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load requests.");
    }
    setIncoming((data.incoming || []).map((row) => mapRequest(row, true)));
    setOutgoing((data.outgoing || []).map((row) => mapRequest(row, false)));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadRequests();
      } catch (err) {
        if (active) setError(err.message || "Unable to load requests.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadRequests]);

  const requests = scope === "incoming" ? incoming : outgoing;

  const counts = useMemo(() => {
    return statuses.reduce((result, status) => {
      result[status] =
        status === "All requests"
          ? requests.length
          : requests.filter((request) => request.status === status).length;
      return result;
    }, {});
  }, [requests]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests
      .filter((request) => {
        const matchesStatus = filter === "All requests" || request.status === filter;
        const matchesSearch = `${request.personName} ${request.item}`
          .toLowerCase()
          .includes(query);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) =>
        sort === "newest" ? b.requestedAt - a.requestedAt : a.requestedAt - b.requestedAt
      );
  }, [requests, filter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selected =
    paginated.find((request) => request.id === selectedId) || paginated[0];

  const switchScope = (nextScope) => {
    setScope(nextScope);
    setFilter("All requests");
    setSelectedId(null);
    setPage(1);
  };

  const updateStatus = async (status) => {
    if (!selected || updating) return;

    setUpdating(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/marketplace/requests/${selected.id}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update request.");
      }

      await loadRequests();

      const messages = {
        Confirmed: "Request confirmed. The listing is now marked as Sold.",
        Declined: "Request declined.",
        Cancelled: "Your request was cancelled."
      };
      setToast({ message: messages[status], type: "success" });
    } catch (err) {
      setError(err.message || "Unable to update request.");
      setToast({ message: err.message || "Unable to update request.", type: "error" });
      loadRequests().catch(() => {});
    } finally {
      setUpdating(false);
    }
  };

  const summary = [
    {
      status: "Pending",
      subtitle: scope === "incoming" ? "Awaiting your response" : "Awaiting the seller",
      icon: Clock3
    },
    { status: "Confirmed", subtitle: "Ready for a meet-up", icon: CircleCheck },
    { status: "Declined", subtitle: "No further action needed", icon: CircleX },
    { status: "Cancelled", subtitle: "Withdrawn by the buyer", icon: Ban }
  ];

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <main className="marketplace marketplace-requests-page">
      <MarketplaceHeader />

      <div className="mpr-section-heading with-tabs">
        <div>
          <h2>View Requests</h2>
          <p>
            {scope === "incoming"
              ? "Your items, their next chapter. Review and respond to interested Carolinians."
              : "Track the buy requests you have sent to other sellers."}
          </p>
        </div>

        <div className="mpr-scope-tabs">
          <button
            type="button"
            className={scope === "incoming" ? "active" : ""}
            onClick={() => switchScope("incoming")}
          >
            Incoming ({incoming.length})
          </button>
          <button
            type="button"
            className={scope === "outgoing" ? "active" : ""}
            onClick={() => switchScope("outgoing")}
          >
            My Requests ({outgoing.length})
          </button>
        </div>
      </div>

      <div className="mpr-summary-grid">
        {summary.map(({ status, subtitle, icon: Icon }) => (
          <div className="mpr-summary-card" key={status}>
            <span className="mpr-summary-icon">
              <Icon size={19} />
            </span>

            <div>
              <div className="mpr-summary-title">
                <strong>{counts[status]}</strong>
                <span>{status}</span>
              </div>

              <small>{subtitle}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="mpr-toolbar">
        <div className="mpr-filters">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={filter === status ? "active" : ""}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
            >
              {status} ({counts[status]})
            </button>
          ))}
        </div>

        <div className="mpr-search-tools">
          <div className="mpr-search">
            <Search size={15} />
            <input
              type="search"
              placeholder={scope === "incoming" ? "Search buyers or items..." : "Search sellers or items..."}
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

      {error && <p className="mpr-form-error" role="alert">{error}</p>}

      {loading ? (
        <div className="mpr-empty">Loading requests...</div>
      ) : filtered.length === 0 ? (
        <div className="mpr-empty">
          {requests.length === 0
            ? scope === "incoming"
              ? "No buy requests on your listings yet."
              : "You haven't sent any buy requests yet."
            : "No matching requests."}
        </div>
      ) : (
        <div className="mpr-layout">
          <div className="mpr-request-list">
            {paginated.map((request) => (
              <button
                key={request.id}
                type="button"
                className={`mpr-request-card ${
                  selected?.id === request.id ? "selected" : ""
                }`}
                onClick={() => setSelectedId(request.id)}
              >
                <img src={request.image} alt={request.item} />

                <div className="mpr-request-card-content">
                  <div className="mpr-request-card-top">
                    <strong>{request.personName}</strong>

                    <span className={`mpr-status ${request.status.toLowerCase()}`}>
                      {request.status}
                    </span>
                  </div>

                  <div className="mpr-request-item-row">
                    <h3>{request.item}</h3>
                    <strong>{formatPrice(request.price)}</strong>
                  </div>

                  <p>{request.time}</p>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="mpr-empty">
                {requests.length === 0
                  ? scope === "incoming"
                    ? "No one has requested your listings yet."
                    : "You haven't sent any buy requests yet."
                  : "No matching requests found."}
              </div>
            )}

            <div className="mpr-list-footer">
              <span>
                Showing {paginated.length} of {filtered.length} requests
              </span>
              <span>
                {scope === "incoming" ? "For your listings only" : "Requests you submitted"}
              </span>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>

          <section className="mpr-details">
            <div className="mpr-details-header">
              <h3>Request details</h3>

              {selected && (
                <span className={`mpr-status ${selected.status.toLowerCase()}`}>
                  {selected.status}
                </span>
              )}
            </div>

            {selected ? (
              <div className="mpr-details-body">
                <div className="mpr-item-info">
                  <img src={selected.image} alt={selected.item} />

                  <div className="mpr-item-description">
                    <span className="mpr-item-category">
                      {selected.category} · {selected.condition}
                    </span>

                    <h3>{selected.item}</h3>

                    <p className="mpr-item-meta">
                      {selected.campus}{selected.itemDate ? ` · ${selected.itemDate}` : ""}
                    </p>

                    <strong className="mpr-item-price">
                      {formatPrice(selected.price)}
                    </strong>
                  </div>
                </div>

                <div className="mpr-buyer-section">
                  <span className="mpr-detail-label">
                    {scope === "incoming" ? "ABOUT THE BUYER" : "ABOUT THE SELLER"}
                  </span>

                  <div className="mpr-buyer-row">
                    <div className="mpr-avatar">{initials(selected.personName)}</div>

                    <div className="mpr-buyer-name">
                      <strong>{selected.personName}</strong>
                      <p>{selected.personEmail}</p>
                    </div>
                  </div>
                </div>

                {scope === "incoming" && selected.status === "Pending" && (
                  <div className="mpr-actions">
                    <button
                      type="button"
                      className="mpr-decline"
                      disabled={updating}
                      onClick={() => updateStatus("Declined")}
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      className="mpr-accept"
                      disabled={updating}
                      onClick={() => updateStatus("Confirmed")}
                    >
                      <CircleCheck size={16} />
                      Confirm request
                    </button>
                  </div>
                )}

                {scope === "outgoing" && selected.status === "Pending" && (
                  <div className="mpr-actions">
                    <button
                      type="button"
                      className="mpr-decline"
                      disabled={updating}
                      onClick={() => updateStatus("Cancelled")}
                    >
                      Cancel request
                    </button>
                  </div>
                )}

                {selected.status === "Pending" && (
                  <p className="mpr-help">
                    {scope === "incoming"
                      ? "Confirming marks the item as Sold. Payment and meet-up are arranged directly with the buyer through their USC email."
                      : "The seller has been emailed your request. You can cancel it any time while it is still pending."}
                  </p>
                )}
              </div>
            ) : (
              <div className="mpr-empty">
                Select a request to view its details.
              </div>
            )}
          </section>
        </div>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </main>
  );
}
