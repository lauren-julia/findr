import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, MapPin, Clock3, CalendarDays } from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";
import { apiUrl } from "../../../shared/utils/api";
import "../styles/listing-modal.css";

export default function ListingModal({ item, kind, onClose }) {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNote("");
    setError("");
    setSubmitting(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [item, onClose]);

  if (!item) return null;

  const isMarketplace = kind === "marketplace";
  const title = isMarketplace ? item.name : item.title;
  const action = isMarketplace ? "Request to Buy" : item.type === "Found" ? "This Is Mine" : "I Found This";
  const isOwnPost = user && item.user_id && Number(user.user_id) === Number(item.user_id);
  const isSold = isMarketplace && item.status && item.status !== "Available";

  const handleRequest = async () => {
    if (!isLoggedIn) {
      navigate("/login", {
        state: { from: isMarketplace ? `/marketplace/${item.id}` : `/lost-and-found/${item.id}` }
      });
      return;
    }

    if (isMarketplace) {
      setError("");
      setSubmitting(true);
      try {
        const res = await fetch(apiUrl(`/api/marketplace/items/${item.id}/requests`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to submit buy request.");
          setSubmitting(false);
          return;
        }
        onClose();
        navigate("/marketplace/requests", {
          state: {
            tab: "outgoing",
            toast: "Buy request sent. The seller has been notified by email."
          }
        });
      } catch {
        setError("Network error while submitting request.");
        setSubmitting(false);
      }
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/lost-found/items/${item.id}/claims`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: note.trim() || null })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit claim.");
        setSubmitting(false);
        return;
      }
      onClose();
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
    <div className="listing-modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="listing-modal" role="dialog" aria-modal="true" aria-labelledby="listing-modal-title">
        <button type="button" className="listing-modal-close" onClick={onClose} aria-label="Close listing details">
          <X size={20} />
        </button>
        <div className="listing-modal-photo">
          <img src={item.image} alt={title} />
        </div>
        <div className="listing-modal-content">
          <span className="listing-modal-category">{item.category}</span>
          <h2 id="listing-modal-title">{title}</h2>
          {isMarketplace ? (
            <>
              <strong className="listing-modal-price">₱{item.price.toLocaleString()}</strong>
              <span className="listing-modal-condition">{item.condition}</span>
            </>
          ) : (
            <span className={`listing-modal-status ${item.type.toLowerCase()}`}>{item.type} report</span>
          )}
          <div className="listing-modal-meta">
            {isMarketplace ? (
              <>
                <p><MapPin size={17} /> {item.campus}</p>
                <p><Clock3 size={17} /> {item.posted}</p>
              </>
            ) : (
              <>
                <p><MapPin size={17} /> {item.location ? `${item.location}, ${item.campus}` : item.campus}</p>
                <p><CalendarDays size={17} /> {item.type === "Found" ? "Found" : "Last seen"} {item.date}</p>
              </>
            )}
          </div>

          {item.description && (
            <p className="listing-modal-description">{item.description}</p>
          )}

          {!isMarketplace && isLoggedIn && !isOwnPost && (
            <textarea
              className="listing-modal-textarea"
              rows={2}
              maxLength={255}
              placeholder={
                item.type === "Found"
                  ? "Optional: share identifying details to verify ownership..."
                  : "Optional: share where/when you found it..."
              }
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}

          {error && <p className="listing-modal-error" role="alert">{error}</p>}

          <button
            type="button"
            className="listing-modal-action"
            onClick={handleRequest}
            disabled={submitting || isOwnPost || isSold}
          >
            {isOwnPost
              ? isMarketplace ? "Your Listing" : "Your Post"
              : isSold
                ? "Sold"
                : submitting ? "Submitting..." : action}
          </button>
          {(isMarketplace || isOwnPost || !isLoggedIn) && (
            <p className="listing-modal-note">
              {!isLoggedIn
                ? isMarketplace
                  ? "Log in with your USC email to submit a request."
                  : "Log in with your USC email to submit a claim."
                : isOwnPost
                  ? isMarketplace
                    ? "This is your listing. Review buyers in View Requests."
                    : "You posted this item. View incoming claims in View Requests."
                  : isSold
                    ? "This item has already been sold."
                    : "The seller will be emailed your name and USC email. Payment and meet-up are arranged directly with them."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
