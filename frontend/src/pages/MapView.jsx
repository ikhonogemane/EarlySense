import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import Sidebar from "../components/Sidebar";
import AccessDenied from "../components/AccessDenied";
import { getLearners } from "../services/api";
import { isForbidden } from "../constants/roles";
import "leaflet/dist/leaflet.css";

// Kimberley Boys High School, Jubilee Street, Labram (OpenStreetMap way 465798397)
const KBHS_POSITION_OSM = [-28.7492013, 24.7698827];
const SCHOOL_POSITION = KBHS_POSITION_OSM;

// Coordinates from OpenStreetMap (Nominatim). "Kimberley" is last so a
// home_town such as "Galeshewe, Kimberley" matches the suburb first.
const TOWN_COORDS = {
  Galeshewe: [-28.723657, 24.7473964],
  Roodepan: [-28.6648059, 24.7168903],
  Homevale: [-28.6970686, 24.7320414],
  Platfontein: [-28.7063157, 24.6454247],
  Greenpoint: [-28.7749574, 24.7689887],
  Beaconsfield: [-28.7515345, 24.7884106],
  "Hadison Park": [-28.7539295, 24.7419397],
  Floors: [-28.7181022, 24.7652032],
  Kimberley: [-28.73833, 24.76389],
};

// Stable offset from the learner id (golden-angle spiral), so a dot keeps
// its place when the page redraws or a filter changes.
const idOffset = (id, spread) => {
  const n = Math.abs(Number(id)) || 0;
  const angle = n * 2.399963;
  const radius = spread * Math.sqrt(((n % 50) + 1) / 50);
  return [radius * Math.sin(angle), radius * Math.cos(angle)];
};

const getRiskColor = (level) => {
  if (level === "High") return "#dc2626";
  if (level === "Medium") return "#f59e0b";
  if (level === "Low") return "#16a34a";
  return "#6b7280";
};

export default function MapView() {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetchLearners();
  }, []);

  const fetchLearners = async () => {
    try {
      const res = await getLearners();
      setLearners(res.data);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const mappedLearners = learners
    .filter((l) => filter === "All" || l.risk_level === filter)
    .map((l) => {
      const townKey = Object.keys(TOWN_COORDS).find((t) =>
        l.home_town?.toLowerCase().includes(t.toLowerCase()),
      );
      const base = townKey ? TOWN_COORDS[townKey] : SCHOOL_POSITION;
      const [dLat, dLng] = idOffset(l.id, townKey ? 0.005 : 0.1);
      const coords = [base[0] + dLat, base[1] + dLng];
      return { ...l, coords };
    });

  const counts = {
    High: learners.filter((l) => l.risk_level === "High").length,
    Medium: learners.filter((l) => l.risk_level === "Medium").length,
    Low: learners.filter((l) => l.risk_level === "Low").length,
  };

  if (loading) return <div style={styles.loadingPage}>Loading map...</div>;
  if (forbidden) return <AccessDenied />;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>Geographic Risk Map</div>
          <span style={styles.topbarSub}>
            Learner home locations colour-coded by dropout risk
          </span>
        </div>

        <div style={styles.content}>
          {/* Stats + Filter */}
          <div style={styles.controlRow}>
            <div style={styles.statsRow}>
              <div
                style={{
                  ...styles.statChip,
                  background: "#fef2f2",
                  color: "#dc2626",
                }}
              >
                <span style={styles.statNum}>{counts.High}</span> High Risk
              </div>
              <div
                style={{
                  ...styles.statChip,
                  background: "#fffbeb",
                  color: "#d97706",
                }}
              >
                <span style={styles.statNum}>{counts.Medium}</span> Medium Risk
              </div>
              <div
                style={{
                  ...styles.statChip,
                  background: "#f0fdf4",
                  color: "#16a34a",
                }}
              >
                <span style={styles.statNum}>{counts.Low}</span> Low Risk
              </div>
              <div
                style={{
                  ...styles.statChip,
                  background: "#f3f4f6",
                  color: "#6b7280",
                }}
              >
                <span style={styles.statNum}>{learners.length}</span> Total
              </div>
            </div>
            <div style={styles.filterRow}>
              {["All", "High", "Medium", "Low"].map((f) => (
                <button
                  key={f}
                  style={{
                    ...styles.filterBtn,
                    ...(filter === f ? styles.filterBtnActive : {}),
                  }}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Map */}
          <div style={styles.mapCard}>
            <MapContainer
              center={SCHOOL_POSITION}
              zoom={11}
              style={{ height: "520px", width: "100%", borderRadius: "10px" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* School */}
              <CircleMarker
                center={SCHOOL_POSITION}
                radius={12}
                pathOptions={{
                  color: "#0f1923",
                  fillColor: "#0f1923",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>Kimberley Boys High School</strong>
                  <br />
                  {learners.length} enrolled learners
                </Popup>
              </CircleMarker>

              {/* Learners */}
              {mappedLearners.map((learner) => (
                <CircleMarker
                  key={learner.id}
                  center={learner.coords}
                  radius={7}
                  pathOptions={{
                    color: getRiskColor(learner.risk_level),
                    fillColor: getRiskColor(learner.risk_level),
                    fillOpacity: 0.8,
                    weight: 1.5,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: "160px" }}>
                      <strong>
                        {learner.first_name} {learner.surname}
                      </strong>
                      <br />
                      Grade {learner.grade} — {learner.class_group}
                      <br />
                      Home: {learner.home_town}
                      <br />
                      Distance: {learner.distance_km} km
                      <br />
                      <span
                        style={{
                          color: getRiskColor(learner.risk_level),
                          fontWeight: "bold",
                        }}
                      >
                        {learner.risk_level || "Unassessed"} Risk
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            {/* Legend */}
            <div style={styles.legend}>
              <div style={styles.legendTitle}>Legend</div>
              {[
                { color: "#dc2626", label: "High Risk" },
                { color: "#f59e0b", label: "Medium Risk" },
                { color: "#16a34a", label: "Low Risk" },
                { color: "#0f1923", label: "School" },
              ].map((item) => (
                <div key={item.label} style={styles.legendItem}>
                  <div
                    style={{ ...styles.legendDot, background: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distance Analysis */}
          <div style={styles.distanceCard}>
            <div style={styles.cardTitle}>Distance from School Analysis</div>
            <div style={styles.distanceGrid}>
              {[
                {
                  range: "0–5 km",
                  count: learners.filter((l) => l.distance_km <= 5).length,
                  color: "#16a34a",
                },
                {
                  range: "5–10 km",
                  count: learners.filter(
                    (l) => l.distance_km > 5 && l.distance_km <= 10,
                  ).length,
                  color: "#6366f1",
                },
                {
                  range: "10–15 km",
                  count: learners.filter(
                    (l) => l.distance_km > 10 && l.distance_km <= 15,
                  ).length,
                  color: "#f59e0b",
                },
                {
                  range: "15+ km",
                  count: learners.filter((l) => l.distance_km > 15).length,
                  color: "#dc2626",
                },
              ].map((item) => (
                <div key={item.range} style={styles.distanceTile}>
                  <div style={{ ...styles.distanceNum, color: item.color }}>
                    {item.count}
                  </div>
                  <div style={styles.distanceLabel}>{item.range}</div>
                  <div style={styles.distanceSub}>learners</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "Arial, sans-serif",
  },
  main: {
    marginLeft: "220px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
  },
  topbar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 28px",
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topbarTitle: { fontSize: "16px", fontWeight: "bold", color: "#111827" },
  topbarSub: { fontSize: "12px", color: "#9ca3af" },
  content: { flex: 1, padding: "24px 28px" },
  controlRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px",
  },
  statsRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  statChip: {
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  statNum: { fontSize: "18px", fontWeight: "bold" },
  filterRow: { display: "flex", gap: "8px" },
  filterBtn: {
    padding: "7px 16px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer",
  },
  filterBtnActive: {
    background: "#0f1923",
    borderColor: "#0f1923",
    color: "#fff",
  },
  mapCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
    position: "relative",
  },
  legend: {
    position: "absolute",
    bottom: "100px",
    right: "40px",
    background: "rgba(255,255,255,0.95)",
    borderRadius: "10px",
    padding: "12px 16px",
    border: "1px solid #e5e7eb",
    zIndex: 1000,
  },
  legendTitle: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: "8px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#374151",
    marginBottom: "4px",
  },
  legendDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  distanceCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "16px",
  },
  distanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px",
  },
  distanceTile: {
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "16px",
    textAlign: "center",
    border: "1px solid #e5e7eb",
  },
  distanceNum: {
    fontSize: "28px",
    fontWeight: "bold",
    lineHeight: 1,
    marginBottom: "4px",
  },
  distanceLabel: { fontSize: "13px", fontWeight: "bold", color: "#374151" },
  distanceSub: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" },
};
