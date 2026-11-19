import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import ProductCard from "../components/ProductCard";
import MarketplaceHeader from "../components/MarketplaceHeader";
import ListingModal from "../components/ListingModal";
import Toast from "../components/Toast";
import Pagination from "../../../shared/components/Pagination";
import { apiUrl } from "../../../shared/utils/api";
import { mapMarketItem } from "../utils/marketplaceHelpers";

const PAGE_SIZE = 8;

export default function Marketplace() {
  const location = useLocation();
  const navigate = useNavigate();

  const [meta, setMeta] = useState({ categories: [], campuses: [], conditions: [] });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [campus, setCampus] = useState("All");
  const [category, setCategory] = useState("All Items");
  const [condition, setCondition] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (location.state?.toast) {
      setToast({ message: location.state.toast, type: "success" });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    let active = true;
    fetch(apiUrl("/api/marketplace/meta"))
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setMeta({
            categories: data.categories || [],
            campuses: data.campuses || [],
            conditions: data.conditions || []
          });
        }
      })
      .catch(() => {
        if (active) setError("Unable to load marketplace filters.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (campus !== "All") params.set("campus", campus);
    if (category !== "All Items") params.set("category", category);
    if (condition !== "All") params.set("condition", condition);
    if (minPrice !== "") params.set("minPrice", minPrice);
    if (maxPrice !== "") params.set("maxPrice", maxPrice);

    setLoading(true);
    fetch(apiUrl(`/api/marketplace/items?${params}`), {
      credentials: "include",
      signal: controller.signal
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load marketplace listings.");
        return data;
      })
      .then((data) => {
        setError("");
        setItems((data.items || []).map(mapMarketItem));
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.page && data.page !== page) setPage(data.page);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        setError(err.message || "Unable to load marketplace listings.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [page, debouncedSearch, campus, category, condition, minPrice, maxPrice]);

  const categoryTabs = useMemo(
    () => ["All Items", ...meta.categories.map((c) => c.category_name)],
    [meta.categories]
  );

  const filtersActive =
    campus !== "All" || condition !== "All" || minPrice !== "" || maxPrice !== "" || category !== "All Items" || search !== "";

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCampus("All");
    setCategory("All Items");
    setCondition("All");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <main className="marketplace">
      <section className="hero marketplace-hero">
        <MarketplaceHeader />

        <div className="search-bar">
          <Search className="search-icon" size={20} />

          <input
            type="text"
            placeholder="Search textbooks, lab gear, calculators, notes..."
            aria-label="Search listings"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            aria-label="Filter by campus"
            value={campus}
            onChange={(e) => updateFilter(setCampus)(e.target.value)}
          >
            <option value="All">All Campuses</option>
            {meta.campuses.map((c) => (
              <option key={c.campus_id} value={c.campus_code}>{c.campus_code}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="listings">
        <div className="listings-header">
          <div className="listing-title">
            <h2>Active Listings</h2>

            <span>
              • {total} {total === 1 ? "item" : "items"} available
            </span>
          </div>

          <div className="mk-filter-row">
            <label>
              Category
              <select
                className="mk-filter-category"
                aria-label="Filter by category"
                value={category}
                onChange={(e) => updateFilter(setCategory)(e.target.value)}
              >
                {categoryTabs.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Condition
              <select
                className="mk-filter-condition"
                aria-label="Filter by condition"
                value={condition}
                onChange={(e) => updateFilter(setCondition)(e.target.value)}
              >
                <option value="All">Any condition</option>
                {meta.conditions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label>
              Price (₱)
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Min"
                aria-label="Minimum price"
                value={minPrice}
                onChange={(e) => updateFilter(setMinPrice)(e.target.value)}
              />
              –
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="Max"
                aria-label="Maximum price"
                value={maxPrice}
                onChange={(e) => updateFilter(setMaxPrice)(e.target.value)}
              />
            </label>

            <button
              type="button"
              className={`mk-clear-filters ${filtersActive ? "" : "is-hidden"}`}
              tabIndex={filtersActive ? 0 : -1}
              aria-hidden={!filtersActive}
              onClick={resetFilters}
            >
              Clear filters
            </button>
          </div>
        </div>

        {loading && items.length === 0 && <p className="mk-message">Loading listings...</p>}
        {error && !loading && <p className="mk-message error" role="alert">{error}</p>}

        {!error && items.length > 0 && (
          <div className="product-grid" aria-busy={loading}>
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => setSelectedItem(product)}
              />
            ))}
          </div>
        )}

        {!error && items.length > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        {!loading && !error && items.length === 0 && (
          <p className="mk-empty">
            {filtersActive ? "No matching listings found." : "No listings were posted yet."}
          </p>
        )}
      </section>

      <ListingModal
        item={selectedItem}
        kind="marketplace"
        onClose={() => setSelectedItem(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </main>
  );
}
