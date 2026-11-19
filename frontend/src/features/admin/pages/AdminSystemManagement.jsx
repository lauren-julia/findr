import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import AdminLayout from "../layouts/AdminLayout";
import { apiUrl } from "../../../shared/utils/api";
import { imagePath } from "../../../shared/utils/imagePath";

const PAGE_SIZE = 10;

const ENTITIES = {
  campuses: {
    label: "Campuses",
    singular: "campus",
    idKey: "campus_id",
    fields: [
      { key: "campus_code", label: "Campus code", placeholder: "e.g. TC" },
      { key: "campus_name", label: "Campus name", placeholder: "e.g. Talamban Campus" }
    ]
  },
  buildings: {
    label: "Buildings",
    singular: "building",
    idKey: "building_id",
    fields: [
      { key: "campus_id", label: "Campus", type: "select", ref: "campuses", refLabel: "campus_name" },
      { key: "building_code", label: "Building code", placeholder: "e.g. LB" },
      { key: "building_name", label: "Building name", placeholder: "e.g. Lawrence Bunzel Building" },
      { key: "image_url", label: "Image", type: "file", accept: "image/jpeg,image/png" }
    ]
  },
  rooms: {
    label: "Rooms",
    singular: "room",
    idKey: "room_id",
    fields: [
      { key: "building_id", label: "Building", type: "select", ref: "buildings", refLabel: "building_name" },
      { key: "room_code", label: "Room code", placeholder: "e.g. LB101" }
    ]
  },
  schedules: {
    label: "Class Schedules",
    singular: "schedule",
    idKey: "schedule_id",
    fields: [
      { key: "room_id", label: "Room", type: "select", ref: "rooms", refLabel: "room_code" },
      {
        key: "day_of_week",
        label: "Day",
        type: "select",
        options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      },
      { key: "start_time", label: "Start time", type: "time" },
      { key: "end_time", label: "End time", type: "time" }
    ]
  },
  categories: {
    label: "Categories",
    singular: "category",
    idKey: "category_id",
    fields: [
      { key: "category_name", label: "Category name", placeholder: "e.g. Textbooks & References" },
      {
        key: "module_type",
        label: "Used in",
        type: "select",
        options: ["Marketplace", "Lost_Found", "Both"]
      }
    ]
  }
};

const EMPTY_DATA = {
  campuses: [],
  buildings: [],
  rooms: [],
  schedules: [],
  categories: []
};

function formatTime(value) {
  return typeof value === "string" ? value.slice(0, 5) : value;
}

function resolveBuildingImage(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/api/")) return apiUrl(value);
  return imagePath(value);
}

export default function AdminSystemManagement() {
  const [data, setData] = useState(EMPTY_DATA);
  const [entity, setEntity] = useState("campuses");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [scheduleCampusId, setScheduleCampusId] = useState("");
  const [scheduleBuildingId, setScheduleBuildingId] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/system"), { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load reference data.");
        if (active) {
          setData({
            campuses: json.campuses || [],
            buildings: json.buildings || [],
            rooms: json.rooms || [],
            schedules: json.schedules || [],
            categories: json.categories || []
          });
        }
      } catch (err) {
        if (active) setBannerError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const config = ENTITIES[entity];
  const rows = data[entity];

  const refText = (field, value) => {
    if (field.type === "file") return value || "";
    if (field.type === "time") return formatTime(value);
    if (!field.ref) return value;
    const refRow = data[field.ref].find(
      (r) => r[ENTITIES[field.ref].idKey] === Number(value)
    );
    return refRow ? refRow[field.refLabel] : "—";
  };

  const visibleRows = rows.filter((row) =>
    config.fields
      .filter((f) => f.type !== "file")
      .map((f) => String(refText(f, row[f.key])))
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = visibleRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const switchEntity = (key) => {
    setEntity(key);
    setSearch("");
    setPage(1);
    setEditing(null);
    setImageFile(null);
    setBannerError("");
    setError("");
  };

  const openForm = (row) => {
    setEditing(row || "new");
    setImageFile(null);
    setRoomFilter("");
    if (row) {
      const normalized = { ...row };
      config.fields.forEach((f) => {
        if (f.type === "time") normalized[f.key] = formatTime(row[f.key]);
      });
      setForm(normalized);
      if (entity === "schedules") {
        const roomRow = data.rooms.find((r) => r.room_id === Number(row.room_id));
        const buildingRow = roomRow
          ? data.buildings.find((b) => b.building_id === Number(roomRow.building_id))
          : null;
        setScheduleBuildingId(roomRow ? String(roomRow.building_id) : "");
        setScheduleCampusId(buildingRow ? String(buildingRow.campus_id) : "");
      } else {
        setScheduleCampusId("");
        setScheduleBuildingId("");
      }
    } else {
      setForm({});
      setScheduleCampusId("");
      setScheduleBuildingId("");
    }
    setBannerError("");
    setError("");
  };

  const closeForm = () => {
    setEditing(null);
    setImageFile(null);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const missing = config.fields.find((f) => {
      if (f.type === "file") {
        return !imageFile && !form[f.key];
      }
      return !String(form[f.key] ?? "").trim();
    });
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    if (entity === "schedules" && formatTime(form.start_time) >= formatTime(form.end_time)) {
      setError("End time must be later than start time.");
      return;
    }

    setSaving(true);
    setError("");
    setBannerError("");
    try {
      const isNew = editing === "new";
      const url = isNew
        ? apiUrl(`/api/admin/system/${entity}`)
        : apiUrl(`/api/admin/system/${entity}/${editing[config.idKey]}`);

      let fetchOptions;
      if (entity === "buildings") {
        const body = new FormData();
        body.append("campus_id", String(Number(form.campus_id)));
        body.append("building_code", String(form.building_code).trim());
        body.append("building_name", String(form.building_name).trim());
        if (imageFile) {
          body.append("image", imageFile);
        }
        fetchOptions = {
          method: isNew ? "POST" : "PUT",
          credentials: "include",
          body
        };
      } else {
        const payload = {};
        config.fields.forEach((f) => {
          payload[f.key] = f.ref ? Number(form[f.key]) : String(form[f.key]).trim();
        });
        fetchOptions = {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        };
      }

      const res = await fetch(url, fetchOptions);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save record.");

      setData((prev) => ({
        ...prev,
        [entity]: isNew
          ? [...prev[entity], json.record]
          : prev[entity].map((r) =>
              r[config.idKey] === editing[config.idKey] ? json.record : r
            )
      }));
      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (saving) return;
    const id = row[config.idKey];
    const confirmed = window.confirm(`Delete this ${config.singular} (ID ${id})?`);
    if (!confirmed) return;

    setSaving(true);
    setBannerError("");
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/admin/system/${entity}/${id}`), {
        method: "DELETE",
        credentials: "include"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete record.");

      setData((prev) => ({
        ...prev,
        [entity]: prev[entity].filter((r) => r[config.idKey] !== id)
      }));
      if (editing && editing !== "new" && editing[config.idKey] === id) {
        closeForm();
      }
    } catch (err) {
      setBannerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (field) => {
    if (field.type === "file") {
      const existingSrc = previewUrl || resolveBuildingImage(form[field.key]);
      return (
        <div>
          <input
            type="file"
            accept={field.accept}
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
          {existingSrc && (
            <img
              src={existingSrc}
              alt="Building preview"
              className="adm-image-preview"
            />
          )}
        </div>
      );
    }

    const value = form[field.key] ?? "";
    const onChange = (e) => setForm((p) => ({ ...p, [field.key]: e.target.value }));

    if (entity === "schedules" && field.key === "room_id") {
      const filteredBuildings = data.buildings.filter(
        (b) => !scheduleCampusId || b.campus_id === Number(scheduleCampusId)
      );
      const allowedBuildingIds = new Set(filteredBuildings.map((b) => b.building_id));
      const filteredRooms = data.rooms
        .filter((r) =>
          scheduleBuildingId
            ? r.building_id === Number(scheduleBuildingId)
            : allowedBuildingIds.has(r.building_id)
        )
        .filter((r) => r.room_code.toLowerCase().includes(roomFilter.toLowerCase()));

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 600 }}>Filters</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <select
              aria-label="Filter by campus"
              value={scheduleCampusId}
              onChange={(e) => {
                setScheduleCampusId(e.target.value);
                setScheduleBuildingId("");
                setForm((p) => ({ ...p, room_id: "" }));
              }}
            >
              <option value="">All campuses</option>
              {data.campuses.map((c) => (
                <option key={c.campus_id} value={c.campus_id}>
                  {c.campus_code}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by building"
              value={scheduleBuildingId}
              onChange={(e) => {
                setScheduleBuildingId(e.target.value);
                setForm((p) => ({ ...p, room_id: "" }));
              }}
            >
              <option value="">All buildings</option>
              {filteredBuildings.map((b) => (
                <option key={b.building_id} value={b.building_id}>
                  {b.building_code} — {b.building_name}
                </option>
              ))}
            </select>

            <input
              type="search"
              aria-label="Search room code"
              placeholder="Room code..."
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            />
          </div>

          <select value={value} onChange={onChange}>
            <option value="">Select room ({filteredRooms.length} matching)</option>
            {filteredRooms.map((r) => (
              <option key={r.room_id} value={r.room_id}>
                {r.room_code}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === "select") {
      const options = field.ref
        ? data[field.ref].map((r) => ({
            value: r[ENTITIES[field.ref].idKey],
            label: r[field.refLabel]
          }))
        : field.options.map((o) => ({ value: o, label: o.replace("_", " & ") }));

      return (
        <select value={value} onChange={onChange}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type || "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={onChange}
      />
    );
  };

  return (
    <AdminLayout
      title="System Management"
      subtitle="Maintain the reference data used across Marketplace, Lost & Found, and the Vacant Room Finder."
    >
      {bannerError && (
        <p className="create-form-error" role="alert" style={{ marginBottom: 16 }}>
          {bannerError}
        </p>
      )}

      <div className="adm-toolbar">
        <div className="adm-filters">
          {Object.entries(ENTITIES).map(([key, c]) => (
            <button
              key={key}
              type="button"
              className={entity === key ? "active" : ""}
              onClick={() => switchEntity(key)}
            >
              {c.label} ({data[key].length})
            </button>
          ))}
        </div>

        <div className="adm-search-tools">
          <div className="adm-search">
            <Search size={15} />
            <input
              type="search"
              placeholder={`Search ${config.label.toLowerCase()}...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button type="button" className="adm-primary" onClick={() => openForm(null)}>
            <Plus size={15} />
            Add {config.singular}
          </button>
        </div>
      </div>

      <div className={`adm-layout ${editing ? "" : "single"}`}>
        <div className="adm-table-card">
          <table className="adm-table">
            <thead>
              <tr>
                <th>ID</th>
                {config.fields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr
                  key={row[config.idKey]}
                  className={
                    editing !== "new" && editing?.[config.idKey] === row[config.idKey]
                      ? "selected"
                      : ""
                  }
                >
                  <td>{row[config.idKey]}</td>
                  {config.fields.map((f) => (
                    <td key={f.key}>
                      {f.type === "file" ? (
                        row[f.key] ? (
                          <img
                            src={resolveBuildingImage(row[f.key])}
                            alt={row.building_name || "Building"}
                            className="adm-thumb"
                          />
                        ) : (
                          "—"
                        )
                      ) : (
                        refText(f, row[f.key])
                      )}
                    </td>
                  ))}
                  <td className="adm-row-actions">
                    <button
                      type="button"
                      className="adm-icon-btn"
                      onClick={() => openForm(row)}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="adm-icon-btn danger"
                      onClick={() => handleDelete(row)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading ? (
            <div className="adm-empty">Loading {config.label.toLowerCase()}...</div>
          ) : (
            visibleRows.length === 0 && (
              <div className="adm-empty">No records found.</div>
            )
          )}

          <div className="adm-list-footer">
            <span>
              Showing {paginatedRows.length} of {visibleRows.length} records
            </span>
            <div className="adm-pagination">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {editing && (
          <section className="adm-card adm-details">
            <div className="adm-card-header">
              <h3>
                {editing === "new" ? "Add" : "Edit"} {config.singular}
              </h3>
              <button type="button" className="adm-icon-btn" onClick={closeForm} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <form className="adm-details-body" onSubmit={handleSubmit} noValidate>
              {config.fields.map((f) => (
                <div className="create-field" key={f.key}>
                  <label>{f.label}</label>
                  {renderInput(f)}
                </div>
              ))}

              {error && <p className="create-form-error" role="alert">{error}</p>}

              <div className="adm-actions">
                <button type="button" className="adm-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="adm-primary" disabled={saving}>
                  {saving ? "Saving..." : editing === "new" ? "Add record" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
