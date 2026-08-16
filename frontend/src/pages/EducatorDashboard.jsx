import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
  getLearners,
  getAlerts,
  createIncident,
  getCurrentUser,
  getEducatorClassTrends,
} from "../services/api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Bell, FilePlus, Users, AlertOctagon } from "lucide-react";

export default function EducatorDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [learners, setLearners] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trends, setTrends] = useState({
    attendance_trend: [],
    mark_trend: [],
    incident_breakdown: [],
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState("");

  const [incForm, setIncForm] = useState({
    learner: "",
    incident_type: "Truancy",
    description: "",
    severity: "Medium",
    incident_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lRes, aRes, tRes] = await Promise.all([
        getLearners(),
        getAlerts(),
        getEducatorClassTrends(),
      ]);
      setLearners(lRes.data);
      setAlerts(aRes.data.filter((a) => !a.is_read).slice(0, 5));
      setTrends(tRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogIncident = async () => {
    if (!incForm.learner || !incForm.description) {
      alert("Please fill in all fields");
      return;
    }
    try {
      await createIncident(incForm);
      setSuccess("Incident logged successfully!");
      setShowForm(false);
      setIncForm({
        learner: "",
        incident_type: "Truancy",
        description: "",
        severity: "Medium",
        incident_date: new Date().toISOString().split("T")[0],
      });
      setTimeout(() => setSuccess(""), 3000);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getRiskColor = (level) => {
    if (level === "High") return { color: "#dc2626", bg: "#fef2f2" };
    if (level === "Medium") return { color: "#d97706", bg: "#fffbeb" };
    if (level === "Low") return { color: "#16a34a", bg: "#f0fdf4" };
    return { color: "#6b7280", bg: "#f3f4f6" };
  };

  if (loading) return <div style={styles.loadingPage}>Loading...</div>;

  const atRisk = learners.filter(
    (l) => l.risk_level === "High" || l.risk_level === "Medium",
  );

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div>
            <div style={styles.topbarTitle}>
              Welcome, {user?.full_name?.split(" ")[0]}
            </div>
            <div style={styles.topbarSub}>Educator Dashboard</div>
          </div>
          <button style={styles.incidentBtn} onClick={() => setShowForm(true)}>
            <FilePlus
              size={15}
              style={{ marginRight: 6, verticalAlign: "middle" }}
            />
            Log Incident
          </button>
        </div>

        <div style={styles.content}>
          {success && <div style={styles.successBanner}>{success}</div>}

          {/* Stats Row */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <div style={styles.statLabel}>My Learners</div>
                <Users size={20} color="#0F6B5C" />
              </div>
              <div style={{ ...styles.statValue, color: "#0F6B5C" }}>
                {learners.length}
              </div>
              <div style={styles.statSub}>Total enrolled</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <div style={styles.statLabel}>At Risk</div>
                <AlertOctagon size={20} color="#dc2626" />
              </div>
              <div style={{ ...styles.statValue, color: "#dc2626" }}>
                {atRisk.length}
              </div>
              <div style={styles.statSub}>Need attention</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <div style={styles.statLabel}>Unread Alerts</div>
                <Bell size={20} color="#f59e0b" />
              </div>
              <div style={{ ...styles.statValue, color: "#f59e0b" }}>
                {alerts.length}
              </div>
              <div style={styles.statSub}>New notifications</div>
            </div>
          </div>

          {/* Charts Row 1: Risk Distribution + Attendance Trend */}
          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Risk Distribution</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "High Risk",
                        value: learners.filter((l) => l.risk_level === "High")
                          .length,
                        color: "#dc2626",
                      },
                      {
                        name: "Medium Risk",
                        value: learners.filter((l) => l.risk_level === "Medium")
                          .length,
                        color: "#f59e0b",
                      },
                      {
                        name: "Low Risk",
                        value: learners.filter((l) => l.risk_level === "Low")
                          .length,
                        color: "#22c55e",
                      },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                  >
                    {[
                      { color: "#dc2626" },
                      { color: "#f59e0b" },
                      { color: "#22c55e" },
                    ].map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Class Attendance Trend</div>
              {trends.attendance_trend.length === 0 ? (
                <div style={styles.chartEmpty}>
                  No attendance data logged yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={trends.attendance_trend}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="Attendance"
                      stroke="#0F6B5C"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts Row 2: Mark Trend + Incidents by Type */}
          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Average Mark Trend</div>
              {trends.mark_trend.length === 0 ? (
                <div style={styles.chartEmpty}>No marks captured yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={trends.mark_trend}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line
                      type="monotone"
                      dataKey="average"
                      name="Class Average"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Incidents by Type</div>
              {trends.incident_breakdown.length === 0 ? (
                <div style={styles.chartEmpty}>
                  No incidents logged for this class.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={trends.incident_breakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="type"
                      tick={{ fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Incidents"
                      fill="#dc2626"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={styles.grid}>
            {/* At Risk Learners */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Learners Requiring Attention</div>
              {atRisk.length === 0 ? (
                <div style={styles.emptyState}>
                  No learners at risk currently.
                </div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {["Learner", "Grade", "Risk Level", "Action"].map((h) => (
                        <th key={h} style={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {atRisk.map((l) => {
                      const rc = getRiskColor(l.risk_level);
                      return (
                        <tr key={l.id}>
                          <td style={styles.td}>
                            <strong>
                              {l.first_name} {l.surname}
                            </strong>
                          </td>
                          <td style={styles.td}>Grade {l.grade}</td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                color: rc.color,
                                background: rc.bg,
                              }}
                            >
                              {l.risk_level}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <button
                              style={styles.btnSm}
                              onClick={() => navigate(`/learners/${l.id}`)}
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

            {/* Recent Alerts */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Recent Alerts</div>
              {alerts.length === 0 ? (
                <div style={styles.emptyState}>No new alerts.</div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} style={styles.alertItem}>
                    <div style={styles.alertIconWrap}>
                      <Bell size={16} color="#f59e0b" />
                    </div>
                    <div>
                      <div style={styles.alertTitle}>{alert.learner_name}</div>
                      <div style={styles.alertMsg}>
                        {alert.message.slice(0, 80)}...
                      </div>
                      <div style={styles.alertDate}>
                        {new Date(alert.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <button
                style={styles.viewAllBtn}
                onClick={() => navigate("/alerts")}
              >
                View All Alerts
              </button>
            </div>
          </div>
        </div>

        {/* Log Incident Modal */}
        {showForm && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={styles.modalTitle}>Log Behavioural Incident</div>

              <label style={styles.label}>Learner</label>
              <select
                style={styles.input}
                value={incForm.learner}
                onChange={(e) =>
                  setIncForm({ ...incForm, learner: e.target.value })
                }
              >
                <option value="">Select learner...</option>
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.first_name} {l.surname} - Grade {l.grade}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Incident Type</label>
              <select
                style={styles.input}
                value={incForm.incident_type}
                onChange={(e) =>
                  setIncForm({ ...incForm, incident_type: e.target.value })
                }
              >
                <option value="Truancy">Truancy</option>
                <option value="Disruptive Behaviour">
                  Disruptive Behaviour
                </option>
                <option value="Late Arrival">Late Arrival</option>
                <option value="Aggressive Behaviour">
                  Aggressive Behaviour
                </option>
                <option value="Misconduct">Misconduct</option>
              </select>

              <label style={styles.label}>Severity</label>
              <select
                style={styles.input}
                value={incForm.severity}
                onChange={(e) =>
                  setIncForm({ ...incForm, severity: e.target.value })
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <label style={styles.label}>Date</label>
              <input
                style={styles.input}
                type="date"
                value={incForm.incident_date}
                onChange={(e) =>
                  setIncForm({ ...incForm, incident_date: e.target.value })
                }
              />

              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                placeholder="Describe what happened..."
                value={incForm.description}
                onChange={(e) =>
                  setIncForm({ ...incForm, description: e.target.value })
                }
              />

              <div style={styles.modalBtns}>
                <button style={styles.btnPrimary} onClick={handleLogIncident}>
                  Log Incident
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
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
  incidentBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  content: { flex: 1, padding: "24px 28px" },
  successBanner: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "13px",
    color: "#16a34a",
    marginBottom: "16px",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  statHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#9ca3af",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "bold",
    lineHeight: 1,
    marginBottom: "4px",
  },
  statSub: { fontSize: "12px", color: "#9ca3af" },
  chartsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  chartCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  chartTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "12px",
  },
  chartEmpty: {
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "13px",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr",
    gap: "16px",
    marginTop: "4px",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "16px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: "10px",
    fontWeight: "bold",
    color: "#9ca3af",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    padding: "7px 10px",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
  },
  td: {
    fontSize: "13px",
    color: "#374151",
    padding: "10px",
    borderBottom: "1px solid #f9fafb",
    verticalAlign: "middle",
  },
  badge: {
    padding: "3px 8px",
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
  alertItem: {
    display: "flex",
    gap: "10px",
    padding: "10px 0",
    borderBottom: "1px solid #f9fafb",
    alignItems: "flex-start",
  },
  alertIconWrap: {
    width: "32px",
    height: "32px",
    background: "#fffbeb",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  alertTitle: { fontSize: "13px", fontWeight: "bold", color: "#111827" },
  alertMsg: { fontSize: "12px", color: "#6b7280", marginTop: "2px" },
  alertDate: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" },
  viewAllBtn: {
    marginTop: "12px",
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
  },
  emptyState: {
    textAlign: "center",
    padding: "30px",
    color: "#9ca3af",
    fontSize: "13px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    width: "440px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "20px",
  },
  modalBtns: { display: "flex", gap: "10px", marginTop: "16px" },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "bold",
    color: "#6b7280",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    marginBottom: "6px",
    marginTop: "14px",
  },
  input: {
    width: "100%",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
    boxSizing: "border-box",
    height: "80px",
    resize: "none",
  },
  btnPrimary: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};