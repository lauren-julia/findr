import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, X, Plus } from "lucide-react";
import MarketplaceHeader from "../components/MarketplaceHeader";
import { apiUrl } from "../../../shared/utils/api";
import { prepareListingPhoto } from "../utils/marketplaceHelpers";

const MAX_TITLE_LENGTH = 100;

export default function CreateListing() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const photoRef = useRef(null);
  const submittingRef = useRef(false);

  const [meta, setMeta] = useState({ categories: [], campuses: [], conditions: [] });

  const [form, setForm] = useState({
    title: "",
    categoryId: "",
    condition: "",
    price: "",
    description: "",
    campusId: "",
    agree: false
  });

  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(apiUrl("/api/marketplace/meta"))
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setMeta({
          categories: data.categories || [],
          campuses: data.campuses || [],
          conditions: data.conditions || []
        });
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

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const selectPhoto = async (files) => {
    const file = Array.from(files || [])[0];
    if (!file) return;

    setError("");
    setProcessingPhoto(true);
    try {
      const prepared = await prepareListingPhoto(file);
      setPhoto((previous) => {
        if (previous) URL.revokeObjectURL(previous.preview);
        return {
          id: crypto.randomUUID(),
          file: prepared,
          preview: URL.createObjectURL(prepared)
        };
      });
    } catch (err) {
      setError(err.message || "Please upload a JPG or PNG image.");
    } finally {
      setProcessingPhoto(false);
    }
  };

  const removePhoto = () => {
    setPhoto((previous) => {
      if (previous) URL.revokeObjectURL(previous.preview);
      return null;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError("");

    if (
      !form.title.trim() ||
      !form.categoryId ||
      !form.condition ||
      form.price === "" ||
      !form.description.trim() ||
      !form.campusId
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim()) || Number(form.price) < 0) {
      setError("Please enter a valid price (0 or more, up to two decimals).");
      return;
    }

    if (!photo?.file) {
      setError("Please add a photo of your item.");
      return;
    }

    if (!form.agree) {
      setError("Please confirm that your listing details are accurate.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("item_name", form.title.trim());
      body.append("category_id", form.categoryId);
      body.append("campus_id", form.campusId);
      body.append("condition", form.condition);
      body.append("price", form.price.trim());
      body.append("description", form.description.trim());
      body.append("image", photo.file);

      const res = await fetch(apiUrl("/api/marketplace/items"), {
        method: "POST",
        credentials: "include",
        body
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to publish listing.");
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      navigate("/marketplace", {
        state: { toast: "Listing published. It is now visible in the marketplace." }
      });
    } catch {
      setError("Network error while publishing listing.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="create-listing-page">
      <MarketplaceHeader />

      <div className="create-heading">
        <div>
          <h2>Create Listing</h2>
          <p>
            Turn what you no longer need into another Carolinian's
            next essential.
          </p>
        </div>

        <span>* Required fields</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="create-layout">
          <div className="create-main-card">
            <h3>Tell us about your item</h3>

            <p className="create-section-subtitle">
              A clear title and honest details help students find
              the right fit.
            </p>

            <div className="create-field">
              <label htmlFor="listing-title">
                Listing title *
              </label>

              <input
                id="listing-title"
                type="text"
                maxLength={MAX_TITLE_LENGTH}
                placeholder="e.g. Organic Chemistry Book"
                value={form.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                required
              />
            </div>

            <div className="create-form-row">
              <div className="create-field">
                <label htmlFor="listing-category">
                  Category *
                </label>

                <select
                  id="listing-category"
                  value={form.categoryId}
                  onChange={(event) =>
                    updateField("categoryId", event.target.value)
                  }
                  required
                >
                  <option value="">Select a category</option>

                  {meta.categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="create-field">
                <label htmlFor="listing-condition">
                  Condition *
                </label>

                <select
                  id="listing-condition"
                  value={form.condition}
                  onChange={(event) =>
                    updateField("condition", event.target.value)
                  }
                  required
                >
                  <option value="">Select item condition</option>

                  {meta.conditions.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="create-field">
              <label htmlFor="listing-price">
                Price (PHP) *
              </label>

              <input
                id="listing-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="₱ 0.00"
                value={form.price}
                onChange={(event) =>
                  updateField("price", event.target.value)
                }
                required
              />
            </div>

            <div className="create-field">
              <label htmlFor="listing-description">
                Description *
              </label>

              <textarea
                id="listing-description"
                rows={5}
                maxLength={1000}
                placeholder="Describe the item's condition, edition or size, what's included, and any signs of wear."
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                required
              />

              <div className="create-character-count">
                {form.description.length} / 1000
              </div>
            </div>

            <div className="create-field">
              <label htmlFor="listing-campus">
                Meet-up Campus *
              </label>

              <select
                id="listing-campus"
                value={form.campusId}
                onChange={(event) =>
                  updateField("campusId", event.target.value)
                }
                required
              >
                <option value="">Select campus</option>
                {meta.campuses.map((campus) => (
                  <option key={campus.campus_id} value={campus.campus_id}>
                    {campus.campus_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <aside className="create-sidebar">
            <div className="create-photo-card">
              <h3>Add photo *</h3>

              <p className="create-section-subtitle">
                Show your item clearly in good light.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={(event) => {
                  selectPhoto(event.target.files);
                  event.target.value = "";
                }}
              />

              <button
                type="button"
                className="upload-area"
                disabled={processingPhoto}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  selectPhoto(event.dataTransfer.files);
                }}
              >
                <ImagePlus size={24} />

                <strong>
                  {processingPhoto
                    ? "Optimizing photo..."
                    : "Drag a photo here or browse files"}
                </strong>

                <span>
                  JPG or PNG · Compressed to under 2 MB
                </span>
              </button>

              {photo && (
                <div className="create-photo-preview-list">
                  <div
                    className="create-photo-preview"
                    key={photo.id}
                  >
                    <img
                      src={photo.preview}
                      alt={photo.file.name}
                    />

                    <div className="create-photo-details">
                      <strong>{photo.file.name}</strong>

                      <span>
                        Cover photo · {(photo.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>

                    <button
                      type="button"
                      className="create-remove-photo"
                      onClick={removePhoto}
                      aria-label="Remove photo"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className="create-photo-footer">
                <span>{photo ? "1 / 1 photo added" : "0 / 1 photo added"}</span>
                <span>Photo is required</span>
              </div>
            </div>
          </aside>
        </div>

        <div className="create-bottom-bar">
          <label className="create-agreement">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(event) =>
                updateField("agree", event.target.checked)
              }
            />

            <span>
              I confirm my item details are accurate and agree
              to the marketplace guidelines.
            </span>
          </label>

          <div className="create-actions">
            <button
              type="button"
              className="cancel-listing-btn"
              onClick={() => navigate("/marketplace")}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="publish-listing-btn"
              disabled={submitting || processingPhoto}
            >
              <Plus size={16} />
              {submitting ? "Publishing..." : "Publish Listing"}
            </button>
          </div>
        </div>

        {error && (
          <p className="create-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
