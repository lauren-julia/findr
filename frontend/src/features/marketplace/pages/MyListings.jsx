import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapPin, Clock3, Search, PackageCheck } from "lucide-react";
import MarketplaceHeader from "../components/MarketplaceHeader";
import Toast from "../components/Toast";
import Pagination from "../../../shared/components/Pagination";
import { apiUrl } from "../../../shared/utils/api";
import { mapMarketItem } from "../utils/marketplaceHelpers";
import "../styles/marketplace-requests.css";

const PAGE_SIZE = 8;
const STATUS_FILTERS = ["All", "Available", "Sold"];

export default function MyListings() {
  const location = useLocation();
  const navigate = useNavigate();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (location.state?.toast) {
      setToast({ message: location.state.toast, type: "success" });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/marketplace/my-items"), {
          credentials: "include"
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load your listings.");
        if (active) setListings((data || []).map(mapMarketItem));
      } catch (err) {
        if (active) setError(err.message || "Unable to load your listings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      All: listings.length,
      Available: listings.filter((l) => l.status === "Available").length,
      Sold: listings.filter((l) => l.status === "Sold").length
    }),
    [listings]
  );

  const filtered = listings.filter((listing) => {
    const matchesStatus = statusFilter === "All" || listing.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [listing.name, listing.category, listing.campus]
        .some((value) => String(value).toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleMarkSold = async (listing) => {
    setUpdatingId(listing.id);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/marketplace/items/${listing.id}/sold`), {
        method: "PATCH",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark listing as sold.");

      setListings((previous) =>
        previous.map((entry) =>
          entry.id === listing.id
            ? { ...entry, status: "Sold", pendingRequestCount: 0 }
            : entry
        )
      );
      setToast({ message: `"${listing.name}" was marked as Sold.`, type: "success" });
    } catch (err) {
      setError(err.message || "Unable to mark listing as sold.");
      setToast({ message: err.message || "Unable to mark listing as sold.", type: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <main className="marketplace marketplace-requests-page">
      <MarketplaceHeader />

      <div className="mpr-section-heading">
        <h2>My Listings</h2>
        <p>
          Manage the items you are selling. Mark a listing as Sold once it has changed hands.
        </p>
      </div>

      <div className="mpr-toolbar">
        <div className="mpr-filters">
          {STATUS_FILTERS.map((status) => (
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

        <div className="mpr-search-tools">
          <div className="mpr-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search your listings..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {error && <p className="mpr-form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="mk-empty">Loading your listings...</p>
      ) : filtered.length === 0 ? (
        <p className="mk-empty">
          {listings.length === 0
            ? "You haven't posted anything yet."
            : "No listings match your filters."}
        </p>
      ) : (
        <>
          <div className="product-grid">
            {paginated.map((listing) => (
              <article
                className={`product-card mk-my-card ${listing.status === "Sold" ? "is-sold" : ""}`}
                key={listing.id}
              >
                <div className="product-image">
                  <img src={listing.image} alt={listing.name} />
                  <span className="condition-badge">● {listing.condition}</span>
                  {listing.status === "Available" ? (
                    <button
                      type="button"
                      className="mk-mark-sold-btn"
                      disabled={updatingId === listing.id}
                      onClick={() => handleMarkSold(listing)}
                    >
                      <PackageCheck size={13} />
                      {updatingId === listing.id ? "Updating..." : "Mark as Sold"}
                    </button>
                  ) : (
                    <span className={`mk-badge ${listing.status.toLowerCase()}`}>
                      {listing.status}
                    </span>
                  )}
                </div>

                <div className="product-info">
                  <div className="product-meta">
                    <span>{listing.category}</span>
                    <strong>₱{listing.price.toLocaleString()}</strong>
                  </div>
                  <h3>{listing.name}</h3>
                  <p className="card-icon-line"><MapPin size={13} /> {listing.campus}</p>
                  <p className="card-icon-line"><Clock3 size={13} /> {listing.posted}</p>
                </div>
              </article>
            ))}
          </div>

          {filtered.length > PAGE_SIZE && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </main>
  );
}
