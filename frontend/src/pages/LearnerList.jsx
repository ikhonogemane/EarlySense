import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getLearners } from "../services/api";
import { Search, X } from "lucide-react";

export default function LearnerList() {
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [risk, setRisk] = useState("");

  useEffect(() => {
    fetchLearners();
  }, [grade]);

  const fetchLearners = async () => {
    try {
      const params = {};
      if (grade) params.grade = grade;
      const res = await getLearners(params);
      setLearners(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = learners.filter((l) => {
    const matchSearch = `${l.first_name} ${l.surname}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchRisk = risk ? l.risk_level === risk : true;
    return matchSearch && matchRisk;
  });

  const getRiskColor = (level) => {
    if (level === "High") return { color: "#dc2626", bg: "#fef2f2" };
    if (level === "Medium") return { color: "#d97706", bg: "#fffbeb" };
    if (level === "Low") return { color: "#16a34a", bg: "#f0fdf4" };
    return { color: "#6b7280", bg: "#f3f4f6" };
  };

  if (loading) return <div style={styles.loadingPage}>Loading learners...</div>;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>Learner Profiles</div>
          <span style={styles.topbarSub}>{filtered.length} learners found</span>
        </div>

        <div style={styles.content}>
          {/* Filters */}
          <div style={styles.filterCard}>
            <div style={styles.searchWrap}>
              <Search size={14} style={styles.searchIcon} />
              <input
                style={styles.searchBox}
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              style={styles.select}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">All Grades</option>
              {[8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
            <select
              style={styles.select}
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
            >
              <option value="">All Risk Levels</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
              <option value="Unassessed">Unassessed</option>
            </select>
            <button
              style={styles.clearBtn}
              onClick={() => {
                setSearch("");
                setGrade("");
                setRisk("");
              }}
            >
              <X
                size={13}
                style={{ marginRight: 4, verticalAlign: "middle" }}
              />
              Clear Filters
            </button>
          </div>

          {/* Table */}
          <div style={styles.tableCard}>
            {filtered.length === 0 ? (
              <div style={styles.emptyState}>
                {learners.length === 0
                  ? "No learners in the system yet. Upload a CSV to add learners."
                  : "No learners match your filters."}
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[
                      "Learner Name",
                      "Grade",
                      "Class",
                      "Home Town",
                      "Distance",
                      "Risk Level",
                      "Action",
                    ].map((h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((learner) => {
                    const rc = getRiskColor(learner.risk_level);
                    return (
                      <tr key={learner.id}>
                        <td style={styles.td}>
                          <div style={styles.learnerName}>
                            <div style={styles.avatar}>
                              {learner.first_name[0]}
                              {learner.surname[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: "bold" }}>
                                {learner.first_name} {learner.surname}
                              </div>
                              <div style={styles.learnerSub}>
                                {learner.gender}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.gradeChip}>
                            Grade {learner.grade}
                          </span>
                        </td>
                        <td style={styles.td}>{learner.class_group}</td>
                        <td style={styles.td}>{learner.home_town}</td>
                        <td style={styles.td}>{learner.distance_km} km</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.riskBadge,
                              color: rc.color,
                              background: rc.bg,
                            }}
                          >
                            {learner.risk_level || "Unassessed"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            style={styles.btnSm}
                            onClick={() => navigate(`/learners/${learner.id}`)}
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
  filterCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "16px 20px",
    border: "1px solid #e5e7eb",
    marginBottom: "16px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  searchWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: "200px",
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    color: "#9ca3af",
    pointerEvents: "none",
  },
  searchBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "8px 12px 8px 30px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
    width: "100%",
  },
  select: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
  },
  clearBtn: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  tableCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#9ca3af",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    padding: "8px 12px",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
  },
  td: {
    fontSize: "13px",
    color: "#374151",
    padding: "12px",
    borderBottom: "1px solid #f9fafb",
    verticalAlign: "middle",
  },
  learnerName: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#0f1923",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "bold",
    flexShrink: 0,
  },
  learnerSub: { fontSize: "11px", color: "#9ca3af" },
  gradeChip: {
    background: "#f3f4f6",
    color: "#374151",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
  },
  riskBadge: {
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
    display: "inline-block",
  },
  btnSm: {
    background: "#0f1923",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "11px",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 40px",
    color: "#9ca3af",
    fontSize: "14px",
    lineHeight: "1.6",
  },
};
