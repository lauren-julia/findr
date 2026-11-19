import { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import RoomModal from "../components/RoomModal";
import Pagination from "../../../shared/components/Pagination";
import "../styles/room-modal.css";
import { imagePath } from "../../../shared/utils/imagePath";
import { apiUrl } from "../../../shared/utils/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PAGE_SIZE = 6;

function resolveBuildingImage(value) {
  if (!value) return imagePath("lawrence-bunzel.jpg");
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/api/")) return apiUrl(value);
  return imagePath(value);
}

function RoomCard({ room, onClick }) {
  return (
    <article
      className="listing-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="listing-image">
        <img
          src={resolveBuildingImage(room.image_url)}
          alt={room.building_name}
        />
      </div>

      <div className="listing-info">
        <span className="listing-category">
          {room.building_name}
        </span>

        <h3>{room.room_code}</h3>

        <p className="listing-detail">
          <Clock3 size={14} />
          Vacant: {room.vacantFrom} – {room.vacantUntil}
        </p>
      </div>
    </article>
  );
}

export default function Tambayan() {
  const [rooms, setRooms] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [serverTime, setServerTime] = useState(null);
  const [selectedCampus, setSelectedCampus] = useState("All");
  const [selectedBuilding, setSelectedBuilding] = useState("All");
  const [customDay, setCustomDay] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRooms = useCallback(async ({ day = "", time = "" } = {}) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (day) params.set("day", day);
      if (time) params.set("time", time);

      const query = params.toString();
      const res = await fetch(apiUrl(`/api/tambayan/rooms${query ? `?${query}` : ""}`));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load vacant rooms.");

      setRooms(json.rooms || []);
      setCampuses(json.campuses || []);
      setBuildings(json.buildings || []);
      setServerTime(json.serverTime || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms({ day: customDay, time: customTime });
  }, [fetchRooms, customDay, customTime]);

  const visibleBuildings = buildings.filter(
    (b) => selectedCampus === "All" || b.campus_id === Number(selectedCampus)
  );

  const filteredRooms = rooms.filter((room) => {
    const matchesCampus =
      selectedCampus === "All" || room.campus_id === Number(selectedCampus);
    const matchesBuilding =
      selectedBuilding === "All" || room.building_id === Number(selectedBuilding);
    return matchesCampus && matchesBuilding;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRooms = filteredRooms.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleCampusChange = (campusId) => {
    setSelectedCampus(campusId);
    setSelectedBuilding("All");
    setPage(1);
  };

  const openRoomModal = (room) => {
    setSelectedRoom({
      ...room,
      building: room.building_name,
      room: room.room_code,
      image: resolveBuildingImage(room.image_url),
      time: `${room.vacantFrom} – ${room.vacantUntil}`,
      date: serverTime?.dateLabel || "Today",
      asOf: serverTime?.isCustom
        ? `Checked for ${serverTime.timeLabel}`
        : serverTime?.timeLabel
          ? `As of ${serverTime.timeLabel}`
          : "Live schedule"
    });
  };

  const closeRoomModal = () => {
    setSelectedRoom(null);
  };

  const isSunday = serverTime?.dayOfWeek === "Sunday";
  const isOutsideClassHours = Boolean(serverTime?.isOutsideClassHours);

  return (
    <main className="listing-page tambayan-page">
      <section className="listing-hero tambayan-hero">
        <h1>
          Find a vacant room to <span>Tambay.</span>
        </h1>

        <h2>
          {serverTime
            ? `Available rooms for ${serverTime.dateLabel}, ${serverTime.timeLabel}`
            : "Checking live room availability..."}
        </h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 30
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span>Day</span>
            <select
              value={customDay}
              onChange={(e) => {
                setCustomDay(e.target.value);
                setPage(1);
              }}
              style={{ height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid #dcd7ce", background: "#fff" }}
            >
              <option value="">Today</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span>Time</span>
            <input
              type="time"
              min="07:30"
              max="21:00"
              value={customTime}
              onChange={(e) => {
                setCustomTime(e.target.value);
                setPage(1);
              }}
              style={{ height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid #dcd7ce", background: "#fff" }}
            />
          </label>
        </div>

        {isSunday && (
          <p style={{ marginTop: 14, color: "#111", fontSize: 13, fontWeight: 600 }}>
            Note: Today is Sunday — room availability is unsure since it is not a regular school day.
          </p>
        )}
      </section>

      <section className="listing-section">
        <div className="listing-section-header">
          <h2>{serverTime?.isCustom ? "Available Rooms" : "Available Rooms Now"}</h2>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <div className="listing-filters">
              <button
                type="button"
                className={selectedCampus === "All" ? "selected" : ""}
                onClick={() => handleCampusChange("All")}
              >
                All Campuses
              </button>
              {campuses.map((c) => (
                <button
                  key={c.campus_id}
                  type="button"
                  className={selectedCampus === String(c.campus_id) ? "selected" : ""}
                  onClick={() => handleCampusChange(String(c.campus_id))}
                >
                  {c.campus_code}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by building"
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setPage(1);
              }}
              style={{
                height: 38,
                padding: "0 12px",
                borderRadius: 20,
                border: "1px solid #dcd7ce",
                background: "#fff",
                fontSize: 13,
                fontWeight: 600
              }}
            >
              <option value="All">All Buildings</option>
              {visibleBuildings.map((building) => (
                <option key={building.building_id} value={String(building.building_id)}>
                  {building.building_code} — {building.building_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="listing-empty" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="listing-empty">Loading available rooms...</div>
        ) : (
          <>
            <div className="listing-grid three-columns">
              {paginatedRooms.map((room) => (
                <RoomCard
                  key={room.room_id}
                  room={room}
                  onClick={() => openRoomModal(room)}
                />
              ))}
            </div>

            {filteredRooms.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}

            {!error && filteredRooms.length === 0 && (
              <div className="listing-empty">
                {isOutsideClassHours
                  ? "No rooms available — it's currently outside class hours (7:30 AM – 9:00 PM)."
                  : "No available rooms found for this selection."}
              </div>
            )}
          </>
        )}
      </section>

      <RoomModal
        room={selectedRoom}
        onClose={closeRoomModal}
      />
    </main>
  );
}
