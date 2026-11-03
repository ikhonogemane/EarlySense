import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AccessDenied from "../components/AccessDenied";
import { getAuditLog } from "../services/api";
import { isForbidden } from "../constants/roles";
import { Search } from "lucide-react";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await getAuditLog();
      setLogs(res.data);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.user_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const getActionColor = (action) => {
    if (action.includes("Login")) return { color: "#16a34a", bg: "#f0fdf4" };
    if (action.includes("Upload")) return { color: "#6366f1", bg: "#f5f3ff" };
    if (action.includes("Referral")) return { color: "#d97706", bg: "#fffbeb" };
    if (action.includes("Delete")) return { color: "#dc2626", bg: "#fef2f2" };
    return { color: "#6b7280", bg: "#f3f4f6" };
  };

  if (loading)
    return <div style={styles.loadingPage}>Loading audit log...</div>;
  if (forbidden) return <AccessDenied />;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>Audit Log</div>
          <span style={styles.topbarSub}>
            {filtered.length} entries — POPIA compliance record
          </span>
        </div>

        <div style={styles.content}>
          <div style={styles.card}>
            <div style={styles.searchRow}>
              <div style={styles.searchWrap}>
                <Search size={14} style={styles.searchIcon} />
                <input
                  style={styles.searchBox}
                  placeholder="Search by action or user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={styles.emptyState}>No audit log entries found.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[
                      "User",
                      "Action",
                      "Target",
                      "IP Address",
                      "Timestamp",
                    ].map((h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const ac = getActionColor(log.action);
                    return (
                      <tr key={log.id}>
                        <td style={styles.td}>
                          <strong>{log.user_name || "System"}</strong>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              color: ac.color,
                              background: ac.bg,
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {log.target_type
                            ? log.target_id != null
                              ? `${log.target_type} #${log.target_id}`
                              : log.target_type
                            : "—"}
                        </td>
                        <td style={styles.td}>{log.ip_address || "—"}</td>
                        <td style={styles.td}>
                          {new Date(log.timestamp).toLocaleString()}
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
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
  },
  searchRow: { marginBottom: "16px" },
  searchWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
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
    width: "300px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: "10px",
    fontWeight: "bold",
    color: "#9ca3af",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    padding: "7px 12px",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
  },
  td: {
    fontSize: "12px",
    color: "#374151",
    padding: "11px 12px",
    borderBottom: "1px solid #f9fafb",
  },
  badge: {
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "bold",
    display: "inline-block",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#9ca3af",
    fontSize: "14px",
  },
};
