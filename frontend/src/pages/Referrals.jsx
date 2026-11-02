import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AccessDenied from "../components/AccessDenied";
import {
  getReferrals,
  createReferral,
  updateReferral,
  getLearners,
  getStaff,
  getCurrentUser,
} from "../services/api";
import {
  REFERRAL_CREATE_ROLES,
  REFERRAL_MANAGE_ROLES,
  hasAnyRole,
  isForbidden,
} from "../constants/roles";
import { defaultFollowUpDate } from "../utils/dates";
import { PlusCircle, Play, CheckCircle, ClipboardList } from "lucide-react";

// FR12: the Register Teacher creates a referral; the server sets it Open
// and unassigned, so the form has no Assign To.
const emptyForm = () => ({
  learner: "",
  reason: "Attendance",
  urgency: "High",
  follow_up_date: defaultFollowUpDate(),
  notes: "",
});

export default function Referrals() {
  const user = getCurrentUser();
  // FR12: create and view only. FR13: status and assignment controls.
  const canCreate = hasAnyRole(user, REFERRAL_CREATE_ROLES);
  const canManage = hasAnyRole(user, REFERRAL_MANAGE_ROLES);

  const [referrals, setReferrals] = useState([]);
  const [learners, setLearners] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const refRes = await getReferrals();
      setReferrals(refRes.data);
      if (canCreate) {
        const learnerRes = await getLearners();
        setLearners(learnerRes.data);
      }
      if (canManage) {
        // FR13: only Grade Head / Wellness Office may list assignable
        // staff. A 403 here leaves the dropdown empty instead of failing
        // the page.
        try {
          const staffRes = await getStaff();
          setUsers(staffRes.data);
        } catch (err) {
          if (err.response?.status === 403) { setUsers([]); } else { throw err; }
        }
      }
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.learner || !form.follow_up_date) {
      setError("Please fill in all required fields");
      return;
    }
    try {
      await createReferral(form);
      setSuccess("Referral submitted successfully!");
      setError("");
      setForm(emptyForm());
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to create referral. Please try again.",
      );
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

  const handleAssign = async (id, assignedTo) => {
    try {
      const res = await updateReferral(id, { assigned_to: assignedTo || null });
      setReferrals(referrals.map((r) => (r.id === id ? res.data : r)));
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
  if (forbidden) return <AccessDenied />;

  const columns = [
    "Learner",
    "Reason",
    "Urgency",
    canManage ? "Assign to" : "Assigned To",
    "Follow-up",
    "Status",
  ];
  if (canManage) columns.push("Action");

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
          <div
            style={{
              ...styles.grid,
              ...(canCreate ? {} : { gridTemplateColumns: "1fr" }),
            }}
          >
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
                  {canCreate
                    ? "No referrals yet. Create one using the form on the right."
                    : "No referrals in your scope."}
                </div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {columns.map((h) => (
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
                          <td style={styles.td}>
                            {canManage ? (
                              <select
                                style={styles.inputXs}
                                aria-label="Assign to"
                                value={ref.assigned_to || ""}
                                onChange={(e) =>
                                  handleAssign(ref.id, e.target.value)
                                }
                              >
                                <option value="">Unassigned</option>
                                {/* Keep the current assignee selectable even if no longer listed as staff. */}
                                {ref.assigned_to &&
                                  !users.some((u) => u.id === ref.assigned_to) && (
                                    <option value={ref.assigned_to}>
                                      {ref.assigned_to_name}
                                    </option>
                                  )}
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.full_name} ({u.role})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              ref.assigned_to_name || "Unassigned"
                            )}
                          </td>
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
                          {canManage && (
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
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Create Referral Form (FR12: Register Teacher only) */}
            {canCreate && (
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
              <div style={styles.safetyNotice}>
                Do not type details about a learner who has attempted or
                talked about suicide. Tell the Wellness Office in person
                instead.
              </div>
              <textarea
                style={styles.textarea}
                placeholder="Additional context about this learner's situation..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <div style={styles.hint}>
                The Grade Head or Wellness Office assigns the case.
              </div>

              <button style={styles.btnPrimary} onClick={handleSubmit}>
                Submit Referral
              </button>
            </div>
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
  safetyNotice: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#d97706",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    marginBottom: "8px",
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
  inputXs: {
    padding: "4px 6px",
    border: "1px solid #e5e7eb",
    borderRadius: "5px",
    fontSize: "11px",
    background: "#fff",
    maxWidth: "170px",
  },
  hint: {
    fontSize: "11px",
    color: "#6b7280",
    margin: "4px 0 12px",
  },
};
