import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, MapPin, X, Plus } from "lucide-react";
import LostFoundHeader from "../components/LostFoundHeader";
import { apiUrl } from "../../../shared/utils/api";
import "../styles/lost-found-pages.css";

export default function CreateLostFound() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const photoRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [campuses, setCampuses] = useState([]);

  const [form, setForm] = useState({
    type: "Found",
    title: "",
    categoryId: "",
    date: "",
    campusId: "",
    location: "",
    description: "",
    agree: false
  });

  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(apiUrl("/api/lost-found/meta"))
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const cats = data.categories || [];
        const camps = data.campuses || [];
        setCategories(cats);
        setCampuses(camps);
        if (camps.length > 0) {
          setForm((prev) => ({
            ...prev,
            campusId: prev.campusId || String(camps[0].campus_id)
          }));
        }
      })
      .catch(() => {
        if (active) setError("Unable to load categories and campuses.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);

  useEffect(() => {
    return () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview);
    };
  }, []);

  const update = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const setSelectedPhoto = (files) => {
    const file = Array.from(files || [])
      .filter((f) => ["image/jpeg", "image/png"].includes(f.type))
      .find((f) => f.size <= 5 * 1024 * 1024);

    if (!file) {
      if (files && files.length > 0) {
        setError("Please select a JPG or PNG image up to 5 MB.");
      }
      return;
    }

    setError("");
    setPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.preview);
      return {
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file)
      };
    });
  };

  const removePhoto = () => {
    setPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.preview);
      return null;
    });
  };

  const publish = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.title.trim() || !form.categoryId || !form.campusId || !form.date ||
        !form.location.trim() || !form.description.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    if (!form.agree) {
      setError("Please confirm that the information is accurate.");
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("post_type", form.type);
      body.append("item_name", form.title.trim());
      body.append("category_id", form.categoryId);
      body.append("campus_id", form.campusId);
      body.append("location", form.location.trim());
      body.append("date_event", form.date);
      body.append("description", form.description.trim());
      if (photo?.file) {
        body.append("image", photo.file);
      }

      const res = await fetch(apiUrl("/api/lost-found/items"), {
        method: "POST",
        credentials: "include",
        body
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to publish post.");
        setSubmitting(false);
        return;
      }

      navigate("/lost-and-found");
    } catch {
      setError("Network error while publishing post.");
      setSubmitting(false);
    }
  };

  return (
    <main className="lf-page">
      <LostFoundHeader />

      <div className="lf-section-heading">
        <div>
          <h2>Make Post</h2>
          <p>Lost it or found it? Help a fellow Carolinian bring it home.</p>
        </div>
        <span>* Required fields</span>
      </div>

      <form onSubmit={publish}>
        <div className="lf-create-layout">
          <div className="lf-panel">
            <h3>Tell us about the item</h3>
            <p className="lf-panel-subtitle">
              Share enough to help, but keep unique identifying details private.
            </p>

            <label className="lf-label">Report type *</label>
            <div className="lf-type-grid">
              {["Lost", "Found"].map((type) => (
                <button
                  type="button"
                  key={type}
                  className={`lf-type-option ${form.type === type ? "selected" : ""}`}
                  onClick={() => update("type", type)}
                >
                  <span className="lf-radio-indicator" />
                  <span>
                    <strong>{type}</strong>
                    <small>
                      {type === "Lost"
                        ? "I'm looking for my item"
                        : "I found someone's item"}
                    </small>
                  </span>
                </button>
              ))}
            </div>

            <div className="lf-field">
              <label htmlFor="lf-title">Item name *</label>
              <input
                id="lf-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Hydro Flask (Yellow)"
                required
              />
            </div>

            <div className="lf-field-grid">
              <div className="lf-field">
                <label htmlFor="lf-category">Category *</label>
                <select
                  id="lf-category"
                  value={form.categoryId}
                  onChange={(e) => update("categoryId", e.target.value)}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lf-field">
                <label htmlFor="lf-date">
                  Date {form.type === "Found" ? "found" : "lost"} *
                </label>
                <input
                  id="lf-date"
                  type="date"
                  max={new Date().toLocaleDateString("en-CA")}
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                  required
                />
              </div>

              <div className="lf-field">
                <label htmlFor="lf-campus">Campus *</label>
                <select
                  id="lf-campus"
                  value={form.campusId}
                  onChange={(e) => update("campusId", e.target.value)}
                  required
                >
                  {campuses.map((camp) => (
                    <option key={camp.campus_id} value={camp.campus_id}>
                      {camp.campus_code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lf-field">
                <label htmlFor="lf-location">
                  Location {form.type === "Found" ? "found" : "last seen"} *
                </label>
                <div className="lf-input-icon">
                  <input
                    id="lf-location"
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    placeholder="e.g. Basketball Court"
                    required
                  />
                  <MapPin size={15} />
                </div>
              </div>
            </div>

            <div className="lf-field">
              <label htmlFor="lf-description">Description *</label>
              <textarea
                id="lf-description"
                rows={4}
                maxLength={1000}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe the item and where it was lost or found..."
                required
              />
            </div>
          </div>

          <aside className="lf-panel lf-photo-panel">
            <h3>Add photo</h3>
            <p className="lf-panel-subtitle">A clear photo makes a match easier.</p>

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(event) => {
                setSelectedPhoto(event.target.files);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              className="lf-upload-area"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setSelectedPhoto(event.dataTransfer.files);
              }}
            >
              <ImagePlus size={23} />
              <strong>Drag a photo here or browse files</strong>
              <span>JPG or PNG · Up to 5 MB</span>
            </button>

            <div className="lf-photo-list">
              {photo && (
                <div className="lf-photo-entry">
                  <img src={photo.preview} alt={photo.file.name} />
                  <div>
                    <strong>{photo.file.name}</strong>
                    <span>Cover photo</span>
                    <button type="button" onClick={removePhoto}>
                      Remove
                    </button>
                  </div>
                  <button
                    type="button"
                    className="lf-remove-photo"
                    onClick={removePhoto}
                    aria-label="Remove photo"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>

            <p className="lf-photo-count">
              {photo ? "1/1 photo added" : "0/1 photo added"} · Photo is optional
            </p>
          </aside>
        </div>

        <div className="lf-publish-bar">
          <label>
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) => update("agree", e.target.checked)}
            />
            I confirm these details are accurate and respect the owner's privacy.
          </label>

          <div className="lf-publish-actions">
            <button type="button" className="lf-cancel" onClick={() => navigate("/lost-and-found")}>
              Cancel
            </button>
            <button type="submit" className="lf-primary-button" disabled={submitting}>
              <Plus size={16} />
              {submitting ? "Publishing..." : "Publish Post"}
            </button>
          </div>
        </div>

        {error && <p className="lf-form-error" role="alert">{error}</p>}
      </form>
    </main>
  );
}
