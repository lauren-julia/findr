import { useEffect, useMemo, useState } from "react";
import { MapPin, CalendarDays, Search, PackageCheck } from "lucide-react";
import LostFoundHeader from "../components/LostFoundHeader";
import Pagination from "../../../shared/components/Pagination";
import { apiUrl } from "../../../shared/utils/api";
import { formatEventDate, resolveLfImage } from "../utils/lostFoundHelpers";
import "../styles/lost-found-pages.css";

const PAGE_SIZE = 6;
const STATUS_FILTERS = ["All", "Active", "Returned"];

export default function LostFoundMyPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function loadMyPosts() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(apiUrl("/api/lost-found/my-items"), {
          credentials: "include"
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load your posts.");
        }
        if (!active) return;

        setPosts(
          (data || []).map((row) => ({
            id: row.lf_item_id,
            title: row.item_name,
            type: row.post_type,
            category: row.category_name,
            campus: row.campus_code,
            location: row.location || "Campus area",
            date: formatEventDate(row.date_event),
            description: row.description,
            status: row.status,
            activeClaimCount: Number(row.active_claim_count || 0),
            hasApprovedReturn: Boolean(row.has_approved_return),
            image: resolveLfImage(row.image_url)
          }))
        );
      } catch (err) {
        if (active) setError(err.message || "Unable to load your posts.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMyPosts();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => ({
    All: posts.length,
    Active: posts.filter((p) => p.status === "Active").length,
    Returned: posts.filter((p) => p.status === "Returned").length
  }), [posts]);

  const filtered = posts.filter((post) => {
    const matchesStatus = statusFilter === "All" || post.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [post.title, post.category, post.campus, post.location]
        .some((value) => value.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleMarkReturned = async (postId) => {
    setUpdatingId(postId);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/lost-found/items/${postId}/return`), {
        method: "PATCH",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark item as returned.");
      }
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, status: "Returned", activeClaimCount: 0 }
            : post
        )
      );
    } catch (err) {
      setError(err.message || "Unable to mark item as returned.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="lf-page">
      <LostFoundHeader />

      <div className="lf-section-heading">
        <div>
          <h2>My Posts</h2>
          <p>
            Manage the Lost & Found posts you created. Mark an item as returned if it was resolved outside Findr.
          </p>
        </div>
      </div>

      <div className="lf-requests-toolbar">
        <div className="lf-request-filters">
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

        <div className="lf-request-search-tools">
          <div className="lf-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search your posts..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {error && <p className="lf-form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="lf-empty">Loading your posts...</p>
      ) : filtered.length === 0 ? (
        <p className="lf-empty">
          {posts.length === 0 ? "You haven't posted anything yet." : "No matching posts found."}
        </p>
      ) : (
        <>
          <div className="lf-items-grid">
            {paginated.map((post) => (
              <article className="lf-item-card lf-my-post-card" key={post.id}>
                <div className="lf-item-image">
                  <img src={post.image} alt={post.title} />
                  <span className={`lf-item-badge ${post.type.toLowerCase()}`}>
                    {post.type}
                  </span>
                  {post.status === "Active" ? (
                    <button
                      type="button"
                      className={`lf-mark-returned-btn ${post.hasApprovedReturn ? "in-progress" : ""}`}
                      disabled={updatingId === post.id || post.hasApprovedReturn}
                      title={
                        post.hasApprovedReturn
                          ? "Complete this return from View Claims"
                          : "Mark as returned externally"
                      }
                      onClick={() => handleMarkReturned(post.id)}
                    >
                      <PackageCheck size={13} />
                      {post.hasApprovedReturn
                        ? "Return in progress"
                        : updatingId === post.id
                          ? "Updating..."
                          : "Mark as Returned"}
                    </button>
                  ) : (
                    <span className="lf-my-post-status-pill">
                      {post.status}
                    </span>
                  )}
                </div>

                <div className="lf-item-info">
                  <span className="lf-item-category">{post.category}</span>
                  <h3>{post.title}</h3>
                  <p><MapPin size={14} /> {post.location}, {post.campus}</p>
                  <p><CalendarDays size={14} /> {post.type === "Found" ? "Found" : "Last seen"} {post.date}</p>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </main>
  );
}
