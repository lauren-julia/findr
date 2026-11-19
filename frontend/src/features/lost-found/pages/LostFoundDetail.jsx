import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, CalendarDays } from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";
import { apiUrl } from "../../../shared/utils/api";
import { formatEventDate, resolveLfImage } from "../utils/lostFoundHelpers";
import "../../../shared/styles/listing-details.css";

export default function LostFoundDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const back = "/lost-and-found";

  useEffect(() => {
    let active = true;
    fetch(apiUrl(`/api/lost-found/items/${id}`))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Listing not found");
        return data;
      })
      .then((row) => {
        if (!active) return;
        setItem({
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
        });
      })
      .catch(() => {
        if (active) setItem(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <main className="detail-page"><p>Loading listing...</p></main>;
  if (!item) return <main className="detail-page"><h2>Listing not found</h2><Link to={back}>Back to listings</Link></main>;

  const isOwnPost = user && Number(user.user_id) === Number(item.user_id);

  const handleRequest = async () => {
    if (!isLoggedIn) {
      navigate("/login", { state: { from: `/lost-and-found/${item.id}` } });
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/lost-found/items/${item.id}/claims`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit claim.");
        setSubmitting(false);
        return;
      }
      navigate("/lost-and-found/requests", {
        state: {
          tab: "outgoing",
          toast: "Claim submitted. The poster has been notified by email."
        }
      });
    } catch {
      setError("Network error while submitting claim.");
      setSubmitting(false);
    }
  };

  return (
    <main className="detail-page">
      <Link className="detail-back" to={back}><ArrowLeft size={16} /> Back to listings</Link>
      <div className="detail-layout">
        <div className="detail-photo"><img src={item.image} alt={item.title} /></div>
        <section className="detail-info">
          <span className="detail-category">{item.category}</span>
          <h1>{item.title}</h1>
          <span className="detail-status">{item.type} report</span>
          <div className="detail-meta">
            <p><MapPin size={17} /> {item.location ? `${item.location}, ${item.campus}` : item.campus}</p>
            <p><CalendarDays size={17} /> {item.type === "Found" ? "Found" : "Last seen"} {item.date}</p>
          </div>
          {item.description && <p className="detail-note">{item.description}</p>}
          {error && <p className="detail-note" role="alert">{error}</p>}
          <button
            className="detail-request"
            type="button"
            onClick={handleRequest}
            disabled={submitting || isOwnPost}
          >
            {isOwnPost ? "Your Post" : submitting ? "Submitting..." : item.type === "Found" ? "This Is Mine" : "I Found This"}
          </button>
          {(isOwnPost || !isLoggedIn) && (
            <p className="detail-note">
              {isOwnPost
                ? "You posted this item. View incoming claims in View Claims."
                : "Log in with your USC email to submit a claim."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
