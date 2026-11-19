import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, CalendarDays } from "lucide-react";
import LostFoundHeader from "../components/LostFoundHeader";
import Pagination from "../../../shared/components/Pagination";
import ListingModal from "../../marketplace/components/ListingModal";
import { useAuth } from "../../auth/context/AuthContext";
import { apiUrl } from "../../../shared/utils/api";
import { formatEventDate, resolveLfImage } from "../utils/lostFoundHelpers";
import "../styles/lost-found-pages.css";

const PAGE_SIZE = 6;

export default function LostAndFound() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [campus, setCampus] = useState("All");
  const [category, setCategory] = useState("All Items");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [metaRes, itemsRes] = await Promise.all([
          fetch(apiUrl("/api/lost-found/meta")),
          fetch(apiUrl("/api/lost-found/items"))
        ]);
        if (!metaRes.ok || !itemsRes.ok) {
          throw new Error("Failed to load Lost & Found listings.");
        }
        const metaData = await metaRes.json();
        const itemsData = await itemsRes.json();
        if (!active) return;

        setCategories(metaData.categories || []);
        setCampuses(metaData.campuses || []);
        setItems(
          (itemsData || []).map((row) => ({
            id: row.lf_item_id,
            user_id: row.user_id,
            title: row.item_name,
            type: row.post_type,
            category: row.category_name,
            campus: row.campus_code,
            location: row.location || "Campus area",
            date: formatEventDate(row.date_event),
            description: row.description,
            image: resolveLfImage(row.image_url)
          }))
        );
      } catch (err) {
        if (active) setError(err.message || "Unable to load Lost & Found listings.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const categoryTabs = useMemo(
    () => ["All Items", ...categories.map((c) => c.category_name)],
    [categories]
  );

  const filtered = items.filter((item) => {
    if (user && Number(item.user_id) === Number(user.user_id)) return false;
    const matchesType = typeFilter === "All" || item.type === typeFilter;
    const matchesCategory = category === "All Items" || item.category === category;
    const matchesCampus = campus === "All" || item.campus === campus;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [item.title, item.category, item.campus, item.location, item.description || ""]
        .some((value) => value.toLowerCase().includes(query));

    return matchesType && matchesCategory && matchesCampus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <main className="marketplace">
      <section className="hero marketplace-hero">
        <LostFoundHeader />

        <div className="search-bar">
          <Search className="search-icon" size={20} />

          <input
            type="text"
            placeholder="Search lost or found items, locations..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Types</option>
            <option value="Lost">Lost</option>
            <option value="Found">Found</option>
          </select>

          <select
            aria-label="Filter by campus"
            value={campus}
            onChange={(event) => {
              setCampus(event.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Campuses</option>
            {campuses.map((c) => (
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
              • {filtered.length} items reported
            </span>
          </div>

          <div className="category-tabs">
            {categoryTabs.map((cat) => (
              <button
                key={cat}
                type="button"
                className={category === cat ? "selected" : ""}
                onClick={() => {
                  setCategory(cat);
                  setPage(1);
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="lf-empty">Loading listings...</p>}
        {error && !loading && <p className="lf-empty" role="alert">{error}</p>}

        {!loading && !error && (
          <>
            <div className="lf-items-grid">
              {paginated.map((item) => (
                <article
                  className="lf-item-card lf-item-card-clickable"
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="lf-item-image">
                    <img
                      src={item.image}
                      alt={item.title}
                    />
                    <span className={`lf-item-badge ${item.type.toLowerCase()}`}>
                      {item.type}
                    </span>
                  </div>

                  <div className="lf-item-info">
                    <span className="lf-item-category">{item.category}</span>
                    <h3>{item.title}</h3>
                    <p><MapPin size={14} /> {item.location}, {item.campus}</p>
                    <p><CalendarDays size={14} /> {item.type === "Found" ? "Found" : "Last seen"} {item.date}</p>
                  </div>
                </article>
              ))}
            </div>

            {filtered.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}

            {filtered.length === 0 && (
              <p className="lf-empty">
                {items.length === 0 ? "No items were posted yet." : "No matching items found."}
              </p>
            )}
          </>
        )}
      </section>

      <ListingModal
        item={selectedItem}
        kind="lost-found"
        onClose={() => setSelectedItem(null)}
      />
    </main>
  );
}
