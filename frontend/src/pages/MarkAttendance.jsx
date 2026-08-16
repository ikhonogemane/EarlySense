import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getLearners, markAttendance, getAttendance } from "../services/api";
import { Save, CheckCircle, XCircle, UserCheck, UserX } from "lucide-react";

export default function MarkAttendance() {
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLearners();
  }, [grade]);
  useEffect(() => {
    fetchExistingAttendance();
  }, [date, learners]);

  const fetchLearners = async () => {
    try {
      const params = grade ? { grade } : {};
      const res = await getLearners(params);
      setLearners(res.data);
      const defaults = {};
      res.data.forEach((l) => {
        defaults[l.id] = true;
      });
      setAttendance(defaults);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAttendance = async () => {
    if (learners.length === 0) return;
    try {
      const existing = {};
      for (const learner of learners) {
        const res = await getAttendance(learner.id);
        const record = res.data.find((a) => a.date === date);
        if (record) existing[learner.id] = record.is_present;
      }
      if (Object.keys(existing).length > 0) {
        setAttendance((prev) => ({ ...prev, ...existing }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAttendance = (learnerId) => {
    setAttendance((prev) => ({ ...prev, [learnerId]: !prev[learnerId] }));
  };

  const markAllPresent = () => {
    const all = {};
    learners.forEach((l) => {
      all[l.id] = true;
    });
    setAttendance(all);
  };

  const markAllAbsent = () => {
    const all = {};
    learners.forEach((l) => {
      all[l.id] = false;
    });
    setAttendance(all);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const attendances = learners.map((l) => ({
        learner_id: l.id,
        is_present: attendance[l.id] !== false,
      }));
      const res = await markAttendance(date, attendances);
      setSuccess(res.data.message);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = learners.length - presentCount;

  if (loading) return <div style={styles.loadingPage}>Loading learners...</div>;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div>
            <div style={styles.topbarTitle}>Mark Attendance</div>
            <div style={styles.topbarSub}>
              {learners.length} learners · {presentCount} present ·{" "}
              {absentCount} absent
            </div>
          </div>
          <div style={styles.topbarRight}>
            <button style={styles.btnSecondary} onClick={() => navigate("/")}>
              Back to Dashboard
            </button>
            <button
              style={{
                ...styles.btnPrimary,
                opacity: saving ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={14} />
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </div>

        <div style={styles.content}>
          {success && <div style={styles.successBanner}>{success}</div>}
          {error && <div style={styles.errorBanner}>{error}</div>}

          {/* Controls */}
          <div style={styles.controlCard}>
            <div style={styles.controlLeft}>
              <div>
                <label style={styles.label}>Date</label>
                <input
                  style={styles.input}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label}>Filter by Grade</label>
                <select
                  style={styles.input}
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
              </div>
            </div>
            <div style={styles.controlRight}>
              <button
                style={{
                  ...styles.btnGreen,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={markAllPresent}
              >
                <CheckCircle size={14} />
                All Present
              </button>
              <button
                style={{
                  ...styles.btnRed,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={markAllAbsent}
              >
                <XCircle size={14} />
                All Absent
              </button>
            </div>
          </div>

          {/* Summary Bar */}
          <div style={styles.summaryBar}>
            <div style={styles.summaryItem}>
              <div style={{ ...styles.summaryNum, color: "#16a34a" }}>
                {presentCount}
              </div>
              <div style={styles.summaryLabel}>Present</div>
            </div>
            <div style={styles.summaryDivider} />
            <div style={styles.summaryItem}>
              <div style={{ ...styles.summaryNum, color: "#dc2626" }}>
                {absentCount}
              </div>
              <div style={styles.summaryLabel}>Absent</div>
            </div>
            <div style={styles.summaryDivider} />
            <div style={styles.summaryItem}>
              <div style={{ ...styles.summaryNum, color: "#6366f1" }}>
                {learners.length > 0
                  ? ((presentCount / learners.length) * 100).toFixed(0)
                  : 0}
                %
              </div>
              <div style={styles.summaryLabel}>Attendance Rate</div>
            </div>
            <div style={styles.progressWrap}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${learners.length > 0 ? (presentCount / learners.length) * 100 : 0}%`,
                    background:
                      presentCount / learners.length > 0.8
                        ? "#16a34a"
                        : presentCount / learners.length > 0.6
                          ? "#f59e0b"
                          : "#dc2626",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Learner List */}
          <div style={styles.tableCard}>
            {learners.length === 0 ? (
              <div style={styles.emptyState}>
                No learners found. Try changing the grade filter.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Learner Name</th>
                    <th style={styles.th}>Grade</th>
                    <th style={styles.th}>Class</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner) => {
                    const isPresent = attendance[learner.id] !== false;
                    return (
                      <tr
                        key={learner.id}
                        style={{
                          ...styles.row,
                          background: isPresent ? "#f0fdf4" : "#fef2f2",
                        }}
                      >
                        <td style={styles.td}>
                          <div style={styles.learnerName}>
                            <div
                              style={{
                                ...styles.avatar,
                                background: isPresent ? "#16a34a" : "#dc2626",
                              }}
                            >
                              {learner.first_name[0]}
                              {learner.surname[0]}
                            </div>
                            <strong>
                              {learner.first_name} {learner.surname}
                            </strong>
                          </div>
                        </td>
                        <td style={styles.td}>Grade {learner.grade}</td>
                        <td style={styles.td}>{learner.class_group}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              background: isPresent ? "#dcfce7" : "#fee2e2",
                              color: isPresent ? "#16a34a" : "#dc2626",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {isPresent ? (
                              <>
                                <UserCheck size={12} /> Present
                              </>
                            ) : (
                              <>
                                <UserX size={12} /> Absent
                              </>
                            )}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            style={{
                              ...styles.toggleBtn,
                              background: isPresent ? "#dc2626" : "#16a34a",
                            }}
                            onClick={() => toggleAttendance(learner.id)}
                          >
                            {isPresent ? "Mark Absent" : "Mark Present"}
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
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topbarTitle: { fontSize: "16px", fontWeight: "bold", color: "#111827" },
  topbarSub: { fontSize: "12px", color: "#9ca3af", marginTop: "2px" },
  topbarRight: { display: "flex", gap: "10px" },
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
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "13px",
    color: "#dc2626",
    marginBottom: "16px",
  },
  controlCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e5e7eb",
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  controlLeft: { display: "flex", gap: "16px", alignItems: "flex-end" },
  controlRight: { display: "flex", gap: "10px" },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "bold",
    color: "#6b7280",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  input: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
  },
  summaryBar: {
    background: "#fff",
    borderRadius: "14px",
    padding: "16px 24px",
    border: "1px solid #e5e7eb",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "24px",
  },
  summaryItem: { textAlign: "center" },
  summaryNum: { fontSize: "28px", fontWeight: "bold", lineHeight: 1 },
  summaryLabel: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" },
  summaryDivider: { width: "1px", height: "40px", background: "#e5e7eb" },
  progressWrap: { flex: 1 },
  progressBar: {
    height: "10px",
    background: "#f3f4f6",
    borderRadius: "5px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "5px",
    transition: "width 0.3s ease",
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
  row: { transition: "background 0.2s" },
  learnerName: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "bold",
    color: "#fff",
    flexShrink: 0,
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
    display: "inline-block",
  },
  toggleBtn: {
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#9ca3af",
    fontSize: "14px",
  },
  btnPrimary: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 18px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "9px 18px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnGreen: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnRed: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
