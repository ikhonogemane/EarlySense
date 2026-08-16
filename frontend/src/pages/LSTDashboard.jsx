import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getReferrals, updateReferral, getCurrentUser } from "../services/api";

export default function LSTDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const res = await getReferrals();
      // Only show referrals assigned to this user
      const mine = res.data.filter(
        (r) =>
          r.assigned_to === user?.id || r.assigned_to_name === user?.full_name,
      );
      setReferrals(mine);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, newStatus) => {
    try {
      await updateReferral(id, {
        status: newStatus,
        resolution_notes: notes[id] || "",
        learner: referrals.find((r) => r.id === id)?.learner,
        referred_by: referrals.find((r) => r.id === id)?.referred_by,
        assigned_to: referrals.find((r) => r.id === id)?.assigned_to,
        reason: referrals.find((r) => r.id === id)?.reason,
        urgency: referrals.find((r) => r.id === id)?.urgency,
        follow_up_date: referrals.find((r) => r.id === id)?.follow_up_date,
      });
      setReferrals(
        referrals.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
      );
    } catch (err) {
      console.error("Update failed:", err.response?.data);
      alert("Failed to update referral. Please try again.");
    }
  };

  const getStatusColor = (status) => {
    if (status === "Open") return { color: "#dc2626", bg: "#fef2f2" };
    if (status === "In_Progress") return { color: "#d97706", bg: "#fffbeb" };
    return { color: "#16a34a", bg: "#f0fdf4" };
  };

  const getUrgencyColor = (urgency) => {
    if (urgency === "High") return "#dc2626";
    if (urgency === "Medium") return "#d97706";
    return "#16a34a";
  };

  if (loading)
    return <div style={styles.loadingPage}>Loading your referrals...</div>;

  const open = referrals.filter((r) => r.status === "Open");
  const inProgress = referrals.filter((r) => r.status === "In_Progress");
  const resolved = referrals.filter((r) => r.status === "Resolved");

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
            <div style={styles.topbarSub}>LST Member Dashboard</div>
          </div>
        </div>

        <div style={styles.content}>
          {/* Stats Row */}
          <div style={styles.statsRow}>
            <div style={{ ...styles.statCard, borderTop: "3px solid #dc2626" }}>
              <div style={styles.statLabel}>Open Referrals</div>
              <div style={{ ...styles.statValue, color: "#dc2626" }}>
                {open.length}
              </div>
              <div style={styles.statSub}>Awaiting action</div>
            </div>
            <div style={{ ...styles.statCard, borderTop: "3px solid #f59e0b" }}>
              <div style={styles.statLabel}>In Progress</div>
              <div style={{ ...styles.statValue, color: "#d97706" }}>
                {inProgress.length}
              </div>
              <div style={styles.statSub}>Currently handling</div>
            </div>
            <div style={{ ...styles.statCard, borderTop: "3px solid #22c55e" }}>
              <div style={styles.statLabel}>Resolved</div>
              <div style={{ ...styles.statValue, color: "#16a34a" }}>
                {resolved.length}
              </div>
              <div style={styles.statSub}>Completed cases</div>
            </div>
          </div>

          {/* Referrals List */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              My Assigned Referrals ({referrals.length})
            </div>

            {referrals.length === 0 ? (
              <div style={styles.emptyState}>
                No referrals assigned to you yet.
              </div>
            ) : (
              referrals.map((ref) => {
                const sc = getStatusColor(ref.status);
                return (
                  <div
                    key={ref.id}
                    style={{
                      ...styles.refCard,
                      borderLeft: `4px solid ${getUrgencyColor(ref.urgency)}`,
                    }}
                  >
                    <div style={styles.refHeader}>
                      <div>
                        <div style={styles.refName}>{ref.learner_name}</div>
                        <div style={styles.refMeta}>
                          <span>Reason: {ref.reason}</span>
                          <span>Follow-up: {ref.follow_up_date}</span>
                          <span>Referred by: {ref.referred_by_name}</span>
                        </div>
                        {ref.notes && (
                          <div style={styles.refNotes}>"{ref.notes}"</div>
                        )}
                        {ref.risk_level && (
                          <div style={styles.riskSummary}>
                            <span
                              style={{
                                ...styles.riskTag,
                                color:
                                  ref.risk_level === "High"
                                    ? "#dc2626"
                                    : ref.risk_level === "Medium"
                                      ? "#d97706"
                                      : "#16a34a",
                                background:
                                  ref.risk_level === "High"
                                    ? "#fef2f2"
                                    : ref.risk_level === "Medium"
                                      ? "#fffbeb"
                                      : "#f0fdf4",
                              }}
                            >
                              {ref.risk_level} Risk
                            </span>
                            {ref.risk_score && (
                              <span style={styles.riskScore}>
                                Score: {ref.risk_score}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={styles.refRight}>
                        <span
                          style={{
                            ...styles.badge,
                            color: sc.color,
                            background: sc.bg,
                          }}
                        >
                          {ref.status.replace("_", " ")}
                        </span>
                        <button
                          style={styles.viewBtn}
                          onClick={() => navigate(`/learners/${ref.learner}`)}
                        >
                          View Profile
                        </button>
                      </div>
                    </div>

                    {/* Resolution notes input */}
                    {ref.status !== "Resolved" && (
                      <div style={styles.resolutionArea}>
                        <textarea
                          style={styles.textarea}
                          placeholder="Add resolution notes..."
                          value={notes[ref.id] || ""}
                          onChange={(e) =>
                            setNotes({
                              ...notes,
                              [ref.id]: e.target.value,
                            })
                          }
                        />
                        <div style={styles.actionBtns}>
                          {ref.status === "Open" && (
                            <button
                              style={styles.btnStart}
                              onClick={() =>
                                handleUpdate(ref.id, "In_Progress")
                              }
                            >
                              Start Working
                            </button>
                          )}
                          {ref.status === "In_Progress" && (
                            <button
                              style={styles.btnResolve}
                              onClick={() => handleUpdate(ref.id, "Resolved")}
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {ref.status === "Resolved" && ref.resolution_notes && (
                      <div style={styles.resolvedNote}>
                        Resolution: {ref.resolution_notes}
                      </div>
                    )}
                  </div>
                );
              })
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
  statLabel: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#9ca3af",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "bold",
    lineHeight: 1,
    marginBottom: "4px",
  },
  statSub: { fontSize: "12px", color: "#9ca3af" },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "20px",
  },
  refCard: {
    background: "#f9fafb",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "14px",
    border: "1px solid #e5e7eb",
  },
  refHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  refName: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "6px",
  },
  refMeta: {
    display: "flex",
    gap: "16px",
    fontSize: "12px",
    color: "#6b7280",
    flexWrap: "wrap",
  },
  refNotes: {
    fontSize: "12px",
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: "6px",
  },
  refRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
    flexShrink: 0,
  },
  badge: {
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
    display: "inline-block",
  },
  viewBtn: {
    background: "#0f1923",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  resolutionArea: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid #e5e7eb",
  },
  textarea: {
    width: "100%",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
    boxSizing: "border-box",
    height: "70px",
    resize: "none",
    marginBottom: "8px",
  },
  actionBtns: { display: "flex", gap: "8px" },
  btnStart: {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnResolve: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  resolvedNote: {
    marginTop: "10px",
    fontSize: "12px",
    color: "#16a34a",
    background: "#f0fdf4",
    padding: "8px 12px",
    borderRadius: "6px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#9ca3af",
    fontSize: "14px",
  },
};
