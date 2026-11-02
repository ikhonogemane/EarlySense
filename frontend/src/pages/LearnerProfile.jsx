import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AccessDenied from "../components/AccessDenied";
import {
  getLearner,
  getAttendance,
  getMarks,
  getIncidents,
  createReferral,
  getCurrentUser,
} from "../services/api";
import {
  REFERRAL_CREATE_ROLES,
  hasAnyRole,
  isForbidden,
} from "../constants/roles";
import { defaultFollowUpDate } from "../utils/dates";
import { MapPin, Phone, ClipboardPlus } from "lucide-react";

export default function LearnerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  // FR12: only a Register Teacher creates referrals; the server sets the
  // status and leaves it unassigned.
  const canRefer = hasAnyRole(getCurrentUser(), REFERRAL_CREATE_ROLES);

  const [learner, setLearner] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [refSuccess, setRefSuccess] = useState("");
  const [refError, setRefError] = useState("");

  const [refForm, setRefForm] = useState(() => ({
    reason: "Attendance",
    urgency: "High",
    follow_up_date: defaultFollowUpDate(),
    notes: "",
  }));

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    try {
      const requests = [
        getLearner(id),
        getAttendance(id),
        getMarks(id),
        getIncidents(id),
      ];

      const results = await Promise.all(requests);

      setLearner(results[0].data);
      setAttendance(results[1].data);
      setMarks(results[2].data);
      setIncidents(results[3].data);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const handleReferral = async () => {
    if (!refForm.follow_up_date) {
      setRefError("Please choose a follow-up date");
      return;
    }
    try {
      await createReferral({ ...refForm, learner: id });
      setRefSuccess("Referral submitted successfully!");
      setRefError("");
      setShowModal(false);
      setTimeout(() => setRefSuccess(""), 3000);
    } catch (err) {
      setRefError(
        err.response?.data?.error ||
          "Failed to create referral. Please try again.",
      );
    }
  };

  const attendanceRate =
    attendance.length > 0
      ? (
          (attendance.filter((a) => a.is_present).length / attendance.length) *
          100
        ).toFixed(1)
      : "N/A";

  const avgMark =
    marks.length > 0
      ? (
          marks.reduce((sum, m) => sum + parseFloat(m.mark), 0) / marks.length
        ).toFixed(1)
      : "N/A";

  const getRiskColor = (level) => {
    if (level === "High") return "#dc2626";
    if (level === "Medium") return "#d97706";
    return "#16a34a";
  };

  const marksBySubject = marks.reduce((acc, m) => {
    if (!acc[m.subject]) acc[m.subject] = [];
    acc[m.subject].push(m);
    return acc;
  }, {});

  if (loading)
    return <div style={styles.loadingPage}>Loading learner profile...</div>;
  if (forbidden) return <AccessDenied />;
  if (!learner)
    return (
      <div style={styles.loadingPage}>
        Learner not found, or not in your class or grade.
      </div>
    );

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div>
            <div style={styles.topbarTitle}>Learner Profile</div>
            <div style={styles.breadcrumb}>
              <span
                style={styles.breadcrumbLink}
                onClick={() => navigate("/learners")}
              >
                Learner Profiles
              </span>
              {" > "}
              {learner.first_name} {learner.surname}
            </div>
          </div>
        </div>

        <div style={styles.content}>
          {refSuccess && <div style={styles.successBanner}>{refSuccess}</div>}

          {/* Profile Header */}
          <div style={styles.profileHeader}>
            <div style={styles.profileAvatar}>
              {learner.first_name[0]}
              {learner.surname[0]}
            </div>
            <div style={styles.profileInfo}>
              <div style={styles.profileName}>
                {learner.first_name} {learner.surname}
              </div>
              <div style={styles.profileMeta}>
                <span>
                  Grade {learner.grade} - {learner.class_group}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <MapPin size={12} />
                  {learner.home_town} ({learner.distance_km} km)
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Phone size={12} />
                  {learner.guardian_name} — {learner.guardian_phone}
                </span>
              </div>
            </div>
            <div style={styles.profileRight}>
              {learner.risk_level && learner.risk_level !== "Unassessed" && (
                <div
                  style={{
                    ...styles.riskPill,
                    color: getRiskColor(learner.risk_level),
                    border: `1.5px solid ${getRiskColor(learner.risk_level)}`,
                    background:
                      learner.risk_level === "High"
                        ? "#fef2f2"
                        : learner.risk_level === "Medium"
                          ? "#fffbeb"
                          : "#f0fdf4",
                  }}
                >
                  {learner.risk_level} Risk
                </div>
              )}
              <div style={styles.profileActions}>
                {canRefer && (
                <button
                  style={{
                    ...styles.btnPrimary,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={() => setShowModal(true)}
                >
                  <ClipboardPlus size={14} />
                  Create Referral
                </button>
                )}
                <button
                  style={{
                    ...styles.btnSecondary,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={() => window.open(`tel:${learner.guardian_phone}`)}
                >
                  <Phone size={14} />
                  Contact Guardian
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Attendance Rate</div>
              <div
                style={{
                  ...styles.statValue,
                  color:
                    parseFloat(attendanceRate) < 70 ? "#dc2626" : "#16a34a",
                }}
              >
                {attendanceRate}
                {attendanceRate !== "N/A" ? "%" : ""}
              </div>
              <div style={styles.statSub}>
                {attendance.filter((a) => !a.is_present).length} days absent
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Average Mark</div>
              <div
                style={{
                  ...styles.statValue,
                  color: parseFloat(avgMark) < 50 ? "#dc2626" : "#16a34a",
                }}
              >
                {avgMark}
                {avgMark !== "N/A" ? "%" : ""}
              </div>
              <div style={styles.statSub}>
                Across {Object.keys(marksBySubject).length} subjects
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Incidents</div>
              <div
                style={{
                  ...styles.statValue,
                  color: incidents.length >= 3 ? "#dc2626" : "#374151",
                }}
              >
                {incidents.length}
              </div>
              <div style={styles.statSub}>This term</div>
            </div>
          </div>

          <div style={styles.grid2}>
            {/* Marks by Subject */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Subject Performance</div>
              {Object.keys(marksBySubject).length === 0 ? (
                <div style={styles.emptyState}>No marks recorded yet.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {["Subject", "Latest Mark", "Assessments", "Avg"].map(
                        (h) => (
                          <th key={h} style={styles.th}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(marksBySubject).map(
                      ([subject, subMarks]) => {
                        const avg = (
                          subMarks.reduce((s, m) => s + parseFloat(m.mark), 0) /
                          subMarks.length
                        ).toFixed(1);
                        const latest = subMarks[subMarks.length - 1];
                        return (
                          <tr key={subject}>
                            <td style={styles.td}>
                              <strong>{subject}</strong>
                            </td>
                            <td
                              style={{
                                ...styles.td,
                                color:
                                  parseFloat(latest.mark) < 50
                                    ? "#dc2626"
                                    : "#16a34a",
                                fontWeight: "bold",
                              }}
                            >
                              {latest.mark}%
                            </td>
                            <td style={styles.td}>{subMarks.length}</td>
                            <td
                              style={{
                                ...styles.td,
                                color:
                                  parseFloat(avg) < 50 ? "#dc2626" : "#374151",
                              }}
                            >
                              {avg}%
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Incidents */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Behavioural Incidents</div>
              {incidents.length === 0 ? (
                <div style={styles.emptyState}>No incidents recorded.</div>
              ) : (
                incidents.map((inc) => (
                  <div key={inc.id} style={styles.incidentItem}>
                    <div
                      style={{
                        ...styles.incDot,
                        background:
                          inc.severity === "High"
                            ? "#dc2626"
                            : inc.severity === "Medium"
                              ? "#f59e0b"
                              : "#22c55e",
                      }}
                    />
                    <div>
                      <div style={styles.incTitle}>{inc.incident_type}</div>
                      <div style={styles.incDesc}>{inc.description}</div>
                      <div style={styles.incDate}>{inc.incident_date}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Referral Modal */}
        {showModal && canRefer && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={styles.modalTitle}>Create Referral</div>
              <div style={styles.modalSub}>
                {learner.first_name} {learner.surname} — Grade {learner.grade}
              </div>

              <label style={styles.label}>Reason</label>
              <select
                style={styles.input}
                value={refForm.reason}
                onChange={(e) =>
                  setRefForm({ ...refForm, reason: e.target.value })
                }
              >
                <option value="Attendance">Chronic Absenteeism</option>
                <option value="Academic">Academic Performance Decline</option>
                <option value="Behavioural">Behavioural Incidents</option>
                <option value="Socioeconomic">Socioeconomic Concerns</option>
                <option value="Combined">Combined Risk Factors</option>
              </select>

              <label style={styles.label}>Urgency</label>
              <select
                style={styles.input}
                value={refForm.urgency}
                onChange={(e) =>
                  setRefForm({ ...refForm, urgency: e.target.value })
                }
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {refError && <div style={styles.refError}>{refError}</div>}

              <label style={styles.label}>Follow-up Date</label>
              <input
                style={styles.input}
                type="date"
                value={refForm.follow_up_date}
                onChange={(e) =>
                  setRefForm({ ...refForm, follow_up_date: e.target.value })
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
                placeholder="Additional context..."
                value={refForm.notes}
                onChange={(e) =>
                  setRefForm({ ...refForm, notes: e.target.value })
                }
              />

              <div style={styles.modalBtns}>
                <button style={styles.btnPrimary} onClick={handleReferral}>
                  Submit Referral
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setShowModal(false)}
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
  breadcrumb: { fontSize: "12px", color: "#9ca3af" },
  breadcrumbLink: { color: "#6366f1", cursor: "pointer" },
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
  profileHeader: {
    background: "#fff",
    borderRadius: "14px",
    padding: "24px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  profileAvatar: {
    width: "64px",
    height: "64px",
    background: "linear-gradient(135deg,#dc2626,#991b1b)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "bold",
    color: "#fff",
    flexShrink: 0,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "6px",
  },
  profileMeta: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    fontSize: "12px",
    color: "#6b7280",
  },
  profileRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "10px",
  },
  riskPill: {
    padding: "6px 16px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "bold",
  },
  profileActions: { display: "flex", gap: "10px" },
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
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  statLabel: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "bold",
    lineHeight: 1,
    marginBottom: "4px",
  },
  statSub: { fontSize: "12px", color: "#9ca3af", marginTop: "4px" },
  grid2: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "16px" },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "14px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: "10px",
    fontWeight: "bold",
    color: "#9ca3af",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    padding: "6px 10px",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
  },
  td: {
    fontSize: "13px",
    color: "#374151",
    padding: "9px 10px",
    borderBottom: "1px solid #f9fafb",
  },
  incidentItem: {
    display: "flex",
    gap: "10px",
    padding: "10px 0",
    borderBottom: "1px solid #f9fafb",
  },
  incDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginTop: "4px",
    flexShrink: 0,
  },
  incTitle: { fontSize: "13px", fontWeight: "bold", color: "#374151" },
  incDesc: { fontSize: "12px", color: "#6b7280", marginTop: "2px" },
  incDate: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" },
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
    marginBottom: "4px",
  },
  modalSub: { fontSize: "13px", color: "#6b7280", marginBottom: "20px" },
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
  safetyNotice: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#d97706",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    marginBottom: "8px",
  },
  refError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    marginBottom: "10px",
  },
};
