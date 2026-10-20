import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AccessDenied from "../components/AccessDenied";
import { getDashboardStats, getLearners, getCurrentUser } from "../services/api";
import {
  ROLES,
  PAGE_ROLES,
  hasAnyRole,
  isForbidden,
} from "../constants/roles";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import {
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Bell,
  Search,
  Upload,
} from "lucide-react";

const COLORS = {
  High: "#dc2626",
  Medium: "#f59e0b",
  Low: "#22c55e",
  total: "#6366f1",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  // FR04: only the School Clerk imports data. FR10: alerts page roles.
  const isClerk = hasAnyRole(user, [ROLES.SCHOOL_CLERK]);
  const canOpenAlerts = hasAnyRole(user, PAGE_ROLES.alerts);
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState({
    total_learners: 0,
    high_risk: 0,
    medium_risk: 0,
    low_risk: 0,
    unread_alerts: 0,
  });
  const [learners, setLearners] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, learnersRes] = await Promise.all([
        getDashboardStats(),
        getLearners(),
      ]);
      console.log("Stats:", statsRes.data);
      console.log("Learners count:", learnersRes.data.length);
      setStats(statsRes.data);
      setLearners(learnersRes.data);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      console.error(err);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: "High Risk", value: stats.high_risk, color: COLORS.High },
    { name: "Medium Risk", value: stats.medium_risk, color: COLORS.Medium },
    { name: "Low Risk", value: stats.low_risk, color: COLORS.Low },
  ].filter((d) => d.value > 0);

  const gradeData = [8, 9, 10, 11, 12]
    .map((g) => {
      const gl = learners.filter((l) => l.grade === g);
      return {
        grade: `Gr ${g}`,
        total: gl.length,
        high: gl.filter((l) => l.risk_level === "High").length,
        medium: gl.filter((l) => l.risk_level === "Medium").length,
        low: gl.filter((l) => l.risk_level === "Low").length,
      };
    })
    .filter((d) => d.total > 0);

  const trendData = [
    { month: "Jan", high: 2, medium: 4, low: 8 },
    { month: "Feb", high: 3, medium: 5, low: 7 },
    { month: "Mar", high: 4, medium: 4, low: 6 },
    { month: "Apr", high: 3, medium: 6, low: 5 },
    {
      month: "May",
      high: stats.high_risk,
      medium: stats.medium_risk,
      low: stats.low_risk,
    },
  ];

  const distanceData = [
    {
      range: "0-5 km",
      count: learners.filter((l) => l.distance_km <= 5).length,
    },
    {
      range: "5-10 km",
      count: learners.filter((l) => l.distance_km > 5 && l.distance_km <= 10)
        .length,
    },
    {
      range: "10-15 km",
      count: learners.filter((l) => l.distance_km > 10 && l.distance_km <= 15)
        .length,
    },
    {
      range: "15+ km",
      count: learners.filter((l) => l.distance_km > 15).length,
    },
  ].filter((d) => d.count > 0);

  const filtered = learners.filter((l) =>
    `${l.first_name} ${l.surname}`.toLowerCase().includes(search.toLowerCase()),
  );

  const getRiskColor = (level) => {
    if (level === "High") return { color: "#dc2626", bg: "#fef2f2" };
    if (level === "Medium") return { color: "#d97706", bg: "#fffbeb" };
    if (level === "Low") return { color: "#16a34a", bg: "#f0fdf4" };
    return { color: "#6b7280", bg: "#f3f4f6" };
  };

  if (loading)
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingText}>Loading EarlySense...</div>
      </div>
    );
  if (forbidden) return <AccessDenied />;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>
            School Dashboard: Kimberley Boys High School
          </div>
          <div style={styles.topbarRight}>
            <span style={styles.termLabel}>Term 2, 2026</span>
            {stats.unread_alerts > 0 && (
              <span
                style={{
                  ...styles.alertBadge,
                  ...(canOpenAlerts ? {} : { cursor: "default" }),
                }}
                onClick={canOpenAlerts ? () => navigate("/alerts") : undefined}
              >
                <Bell
                  size={14}
                  style={{ marginRight: 4, verticalAlign: "middle" }}
                />
                {stats.unread_alerts} alerts
              </span>
            )}
            {isClerk && (
            <button
              style={styles.uploadBtn}
              onClick={() => navigate("/upload")}
            >
              <Upload
                size={13}
                style={{ marginRight: 5, verticalAlign: "middle" }}
              />
              Upload CSV
            </button>
            )}
          </div>
        </div>

        <div style={styles.content}>
          {/* Stats Row */}
          <div style={styles.statsRow}>
            <StatCard
              label="Total Learners"
              value={stats.total_learners}
              sub="Grades 8–12"
              color="#6366f1"
              icon={<GraduationCap size={20} />}
            />
            <StatCard
              label="Low Risk"
              value={stats.low_risk}
              sub="On track"
              color="#22c55e"
              icon={<ShieldCheck size={20} />}
            />
            <StatCard
              label="Medium Risk"
              value={stats.medium_risk}
              sub="Monitor closely"
              color="#f59e0b"
              icon={<AlertTriangle size={20} />}
            />
            <StatCard
              label="High Risk"
              value={stats.high_risk}
              sub="Urgent attention"
              color="#dc2626"
              icon={<AlertOctagon size={20} />}
            />
          </div>

          {/* Charts Row 1 */}
          <div style={styles.chartsRow}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Risk Distribution</div>
              <div style={styles.chartSub}>Current term overview</div>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.noData}>No risk data yet</div>
              )}
            </div>

            <div style={styles.chartCardWide}>
              <div style={styles.chartTitle}>Risk by Grade</div>
              <div style={styles.chartSub}>
                Learners at each risk level per grade
              </div>
              {gradeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={gradeData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="high"
                      name="High Risk"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="medium"
                      name="Medium Risk"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="low"
                      name="Low Risk"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.noData}>No grade data yet</div>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div style={styles.chartsRow}>
            <div style={styles.chartCardWide}>
              <div style={styles.chartTitle}>Risk Trend Over Time</div>
              <div style={styles.chartSub}>Monthly risk level changes</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={trendData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="high"
                    name="High Risk"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="medium"
                    name="Medium Risk"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="low"
                    name="Low Risk"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>Distance from School</div>
              <div style={styles.chartSub}>Learner home distance breakdown</div>
              {distanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={distanceData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Learners"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.noData}>No distance data yet</div>
              )}
            </div>
          </div>

          {/* Learners Table */}
          <div style={styles.tableCard}>
            <div style={styles.tableHeader}>
              <div style={styles.cardTitle}>All Learners</div>
              <div style={styles.searchWrap}>
                <Search size={14} style={styles.searchIcon} />
                <input
                  style={styles.searchBox}
                  placeholder="Search learners..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {filtered.length === 0 ? (
              <div style={styles.emptyState}>
                {learners.length === 0
                  ? isClerk
                    ? "No learners yet. Upload a CSV to get started."
                    : "No learners in your scope."
                  : "No learners match your search."}
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Learner Name", "Grade", "Risk Level", "Action"].map(
                      (h) => (
                        <th key={h} style={styles.th}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((learner) => {
                    const rc = getRiskColor(learner.risk_level);
                    return (
                      <tr key={learner.id}>
                        <td style={styles.td}>
                          <strong>
                            {learner.first_name} {learner.surname}
                          </strong>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.gradeChip}>
                            Grade {learner.grade}
                          </span>
                        </td>
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

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `3px solid ${color}` }}>
      <div style={styles.statHeader}>
        <div style={styles.statLabel}>{label}</div>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statSub}>{sub}</div>
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
    background: "#f0f2f5",
  },
  loadingText: { fontSize: "18px", color: "#6b7280" },
  topbar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 28px",
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  topbarTitle: { fontSize: "16px", fontWeight: "bold", color: "#111827" },
  topbarRight: { display: "flex", alignItems: "center", gap: "16px" },
  termLabel: { fontSize: "12px", color: "#9ca3af" },
  alertBadge: {
    fontSize: "13px",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
  },
  uploadBtn: {
    background: "#0f1923",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  content: { flex: 1, padding: "24px 28px", overflowY: "auto" },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "20px",
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
    fontSize: "36px",
    fontWeight: "bold",
    lineHeight: 1,
    marginBottom: "4px",
  },
  statSub: { fontSize: "12px", color: "#9ca3af" },
  chartsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.6fr",
    gap: "16px",
    marginBottom: "20px",
  },
  chartCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  chartCardWide: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  chartTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "2px",
  },
  chartSub: { fontSize: "11px", color: "#9ca3af", marginBottom: "12px" },
  noData: {
    textAlign: "center",
    padding: "40px",
    color: "#9ca3af",
    fontSize: "13px",
  },
  tableCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  cardTitle: { fontSize: "15px", fontWeight: "bold", color: "#111827" },
  searchWrap: { position: "relative", display: "flex", alignItems: "center" },
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
    padding: "7px 12px 7px 30px",
    fontSize: "12px",
    color: "#374151",
    width: "200px",
    outline: "none",
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
    padding: "11px 12px",
    borderBottom: "1px solid #f9fafb",
  },
  riskBadge: {
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
    display: "inline-block",
  },
  gradeChip: {
    background: "#f3f4f6",
    color: "#374151",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
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
    padding: "40px",
    color: "#9ca3af",
    fontSize: "14px",
  },
};
