import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { getAlerts, markAlertRead, markAllAlertsRead } from "../services/api";
import {
  AlertOctagon,
  CalendarClock,
  TrendingDown,
  ClipboardList,
  Calendar,
  Bot,
  CheckCheck,
} from "lucide-react";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  };

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    setAlerts(alerts.map((a) => ({ ...a, is_read: true })));
  };

  const filterTypes = [
    "All",
    "Attendance",
    "Performance",
    "Behavioural",
    "Risk_Level_Change",
  ];

  const filtered = alerts.filter((a) => {
    if (filter === "All") return true;
    return a.alert_type === filter;
  });

  const unread = alerts.filter((a) => !a.is_read).length;

  const getBorderColor = (type) => {
    if (type === "Risk_Level_Change") return "#dc2626";
    if (type === "Attendance") return "#f59e0b";
    if (type === "Performance") return "#6366f1";
    return "#22c55e";
  };

  const getIcon = (type) => {
    if (type === "Risk_Level_Change")
      return <AlertOctagon size={22} color="#dc2626" />;
    if (type === "Attendance")
      return <CalendarClock size={22} color="#f59e0b" />;
    if (type === "Performance")
      return <TrendingDown size={22} color="#6366f1" />;
    return <ClipboardList size={22} color="#22c55e" />;
  };

  const getIconBg = (type) => {
    if (type === "Risk_Level_Change") return "#fef2f2";
    if (type === "Attendance") return "#fffbeb";
    if (type === "Performance") return "#f5f3ff";
    return "#f0fdf4";
  };

  if (loading)
    return (
      <div style={styles.loadingPage}>
        <div>Loading alerts...</div>
      </div>
    );

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>
            Alerts & Notifications
            {unread > 0 && (
              <span style={styles.unreadBadge}>{unread} unread</span>
            )}
          </div>
          {unread > 0 && (
            <button style={styles.markAllBtn} onClick={handleMarkAllRead}>
              <CheckCheck
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Mark All as Read
            </button>
          )}
        </div>

        <div style={styles.content}>
          {/* Filters */}
          <div style={styles.filterRow}>
            {filterTypes.map((f) => (
              <button
                key={f}
                style={{
                  ...styles.filterBtn,
                  ...(filter === f ? styles.filterBtnActive : {}),
                }}
                onClick={() => setFilter(f)}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Alerts List */}
          {filtered.length === 0 ? (
            <div style={styles.emptyState}>
              No alerts found. The system will generate alerts automatically
              when learners cross risk thresholds.
            </div>
          ) : (
            filtered.map((alert) => (
              <div
                key={alert.id}
                style={{
                  ...styles.alertItem,
                  borderLeft: `4px solid ${getBorderColor(alert.alert_type)}`,
                  opacity: alert.is_read ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    ...styles.alertIconWrap,
                    background: getIconBg(alert.alert_type),
                  }}
                >
                  {getIcon(alert.alert_type)}
                </div>
                <div style={styles.alertBody}>
                  <div style={styles.alertTitle}>
                    {alert.alert_type.replace("_", " ")} — {alert.learner_name}
                  </div>
                  <div style={styles.alertMessage}>{alert.message}</div>
                  <div style={styles.alertMeta}>
                    <span style={styles.metaItem}>
                      <Calendar
                        size={11}
                        style={{ marginRight: 4, verticalAlign: "middle" }}
                      />
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                    <span style={styles.metaItem}>
                      <Bot
                        size={11}
                        style={{ marginRight: 4, verticalAlign: "middle" }}
                      />
                      AI Generated
                    </span>
                  </div>
                </div>
                <div style={styles.alertActions}>
                  {!alert.is_read && <div style={styles.unreadDot} />}
                  {!alert.is_read && (
                    <button
                      style={styles.dismissBtn}
                      onClick={() => handleMarkRead(alert.id)}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
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
  topbarTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  unreadBadge: {
    background: "#dc2626",
    color: "#fff",
    borderRadius: "10px",
    padding: "2px 8px",
    fontSize: "12px",
  },
  markAllBtn: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  content: { flex: 1, padding: "24px 28px" },
  filterRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
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
    background: "#dc2626",
    borderColor: "#dc2626",
    color: "#fff",
  },
  alertItem: {
    background: "#fff",
    borderRadius: "12px",
    padding: "18px 20px",
    border: "1px solid #e5e7eb",
    marginBottom: "12px",
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
  },
  alertIconWrap: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  alertBody: { flex: 1 },
  alertTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "4px",
  },
  alertMessage: {
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: "1.5",
    marginBottom: "8px",
  },
  alertMeta: {
    display: "flex",
    gap: "12px",
    fontSize: "11px",
    color: "#9ca3af",
  },
  metaItem: { display: "flex", alignItems: "center" },
  alertActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  unreadDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#dc2626",
  },
  dismissBtn: {
    background: "transparent",
    color: "#6b7280",
    border: "1px solid #e5e7eb",
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
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    lineHeight: "1.6",
  },
};
