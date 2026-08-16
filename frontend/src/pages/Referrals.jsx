import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  getReferrals,
  createReferral,
  updateReferral,
  getLearners,
  getUsers,
} from "../services/api";
import { PlusCircle, Play, CheckCircle, ClipboardList } from "lucide-react";

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [learners, setLearners] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    learner: "",
    reason: "Attendance",
    urgency: "High",
    assigned_to: "",
    follow_up_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [refRes, learnerRes, userRes] = await Promise.all([
        getReferrals(),
        getLearners(),
        getUsers(),
      ]);
      setReferrals(refRes.data);
      setLearners(learnerRes.data);
      setUsers(
        userRes.data.filter(
          (u) => u.role === "LST_Member" || u.role === "School_Admin",
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.learner || !form.assigned_to || !form.follow_up_date) {
      setError("Please fill in all required fields");
      return;
    }
    try {
      await createReferral(form);
      setSuccess("Referral submitted successfully!");
      setError("");
      setForm({
        learner: "",
        reason: "Attendance",
        urgency: "High",
        assigned_to: "",
        follow_up_date: "",
        notes: "",
      });
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to create referral. Please try again.");
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateReferral(id, { status: newStatus });
      setReferrals(
        referrals.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status) => {
    if (status === "Open") return { color: "#dc2626", bg: "#fef2f2" };
    if (status === "In_Progress") return { color: "#d97706", bg: "#fffbeb" };
    return { color: "#16a34a", bg: "#f0fdf4" };
  };

  const getUrgencyColor = (urgency) => {
    if (urgency === "High") return { color: "#dc2626", bg: "#fef2f2" };
    if (urgency === "Medium") return { color: "#d97706", bg: "#fffbeb" };
    return { color: "#16a34a", bg: "#f0fdf4" };
  };

  if (loading)
    return <div style={styles.loadingPage}>Loading referrals...</div>;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>
            Referral & Intervention Management
          </div>
          <span style={styles.topbarSub}>
            {referrals.filter((r) => r.status !== "Resolved").length} active
            referrals
          </span>
        </div>

        <div style={styles.content}>
          <div style={styles.grid}>
            {/* Referrals Table */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>
                <ClipboardList
                  size={16}
                  style={{
                    marginRight: 8,
                    verticalAlign: "middle",
                    color: "#6b7280",
                  }}
                />
                Active Referrals
              </div>

              {referrals.length === 0 ? (
                <div style={styles.emptyState}>
                  No referrals yet. Create one using the form on the right.
                </div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {[
                        "Learner",
                        "Reason",
                        "Urgency",
                        "Assigned To",
                        "Follow-up",
                        "Status",
                        "Action",
                      ].map((h) => (
                        <th key={h} style={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((ref) => {
                      const sc = getStatusColor(ref.status);
                      const uc = getUrgencyColor(ref.urgency);
                      return (
                        <tr key={ref.id}>
                          <td style={styles.td}>
                            <strong>{ref.learner_name}</strong>
                          </td>
                          <td style={styles.td}>{ref.reason}</td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                color: uc.color,
                                background: uc.bg,
                              }}
                            >
                              {ref.urgency}
                            </span>
                          </td>
                          <td style={styles.td}>{ref.assigned_to_name}</td>
                          <td style={styles.td}>{ref.follow_up_date}</td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                color: sc.color,
                                background: sc.bg,
                              }}
                            >
                              {ref.status.replace("_", " ")}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {ref.status === "Open" && (
                              <button
                                style={{
                                  ...styles.btnXs,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                onClick={() =>
                                  handleStatusUpdate(ref.id, "In_Progress")
                                }
                              >
                                <Play size={10} />
                                Start
                              </button>
                            )}
                            {ref.status === "In_Progress" && (
                              <button
                                style={{
                                  ...styles.btnXs,
                                  background: "#16a34a",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                onClick={() =>
                                  handleStatusUpdate(ref.id, "Resolved")
                                }
                              >
                                <CheckCircle size={10} />
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Create Referral Form */}
            <div style={styles.formCard}>
              <div style={styles.cardTitle}>
                <PlusCircle
                  size={16}
                  style={{
                    marginRight: 8,
                    verticalAlign: "middle",
                    color: "#dc2626",
                  }}
                />
                Create New Referral
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}
              {success && <div style={styles.successBox}>{success}</div>}

              <label style={styles.label}>Learner *</label>
              <select
                style={styles.input}
                value={form.learner}
                onChange={(e) => setForm({ ...form, learner: e.target.value })}
              >
                <option value="">Select a learner...</option>
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.first_name} {l.surname} — Grade {l.grade}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Reason *</label>
              <select
                style={styles.input}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              >
                <option value="Attendance">Chronic Absenteeism</option>
                <option value="Academic">Academic Performance Decline</option>
                <option value="Behavioural">Behavioural Incidents</option>
                <option value="Socioeconomic">Socioeconomic Concerns</option>
                <option value="Combined">Combined Risk Factors</option>
              </select>

              <label style={styles.label}>Urgency *</label>
              <select
                style={styles.input}
                value={form.urgency}
                onChange={(e) => setForm({ ...form, urgency: e.target.value })}
              >
                <option value="High">High — Immediate action required</option>
                <option value="Medium">Medium — Action within the week</option>
                <option value="Low">Low — Monitor and review</option>
              </select>

              <label style={styles.label}>Assign to LST Member *</label>
              <select
                style={styles.input}
                value={form.assigned_to}
                onChange={(e) =>
                  setForm({ ...form, assigned_to: e.target.value })
                }
              >
                <option value="">Select LST member...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>

              <label style={styles.label}>Follow-up Date *</label>
              <input
                style={styles.input}
                type="date"
                value={form.follow_up_date}
                onChange={(e) =>
                  setForm({ ...form, follow_up_date: e.target.value })
                }
              />

              <label style={styles.label}>Notes</label>
              <textarea
                style={styles.textarea}
                placeholder="Additional context about this learner's situation..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <button style={styles.btnPrimary} onClick={handleSubmit}>
                Submit Referral to LST
              </button>
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: "20px",
    alignItems: "start",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
  },
  formCard: {
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
    display: "flex",
    alignItems: "center",
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
    fontSize: "12px",
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
  btnXs: {
    background: "#0f1923",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    padding: "4px 8px",
    fontSize: "11px",
    cursor: "pointer",
    fontWeight: "bold",
  },
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
    width: "100%",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "16px",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#dc2626",
    marginBottom: "12px",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#16a34a",
    marginBottom: "12px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#9ca3af",
    fontSize: "14px",
  },
};
