import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import AccessDenied from "../components/AccessDenied";
import { getReports, generateReport } from "../services/api";
import { isForbidden } from "../constants/roles";
import {
  AlertOctagon,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  Loader,
  CheckCircle,
} from "lucide-react";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [reportType, setReportType] = useState("");
  const [term, setTerm] = useState("Term 2 — 2026");
  const [grade, setGrade] = useState("All Grades");
  const [format, setFormat] = useState("PDF");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await getReports();
      setReports(res.data);
    } catch (err) {
      if (isForbidden(err)) setForbidden(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

const handleGenerate = async (fmt) => {
  if (!reportType) {
    alert('Please select a report type first');
    return;
  }
  setGenerating(true);
  try {
    await generateReport(reportType, fmt, grade === 'All Grades (8–12)' ? '' : grade.replace('Grade ', ''));
    setSuccess(`${fmt.toUpperCase()} report downloaded successfully!`);
    setTimeout(() => setSuccess(''), 3000);
    fetchReports();
  } catch (err) {
    console.error('Report generation failed:', err);
  } finally {
    setGenerating(false);
  }
};

  const reportTypes = [
    {
      id: "at_risk",
      icon: <AlertOctagon size={28} color="#dc2626" />,
      iconBg: "#fef2f2",
      title: "At-Risk Learner Report",
      desc: "Full list of High and Medium risk learners with scores and current intervention status.",
    },
    {
      id: "attendance",
      icon: <CalendarClock size={28} color="#f59e0b" />,
      iconBg: "#fffbeb",
      title: "Attendance Summary Report",
      desc: "Term attendance by grade, class and learner. Includes absenteeism trends and chronic absence cases.",
    },
    {
      id: "intervention",
      icon: <ClipboardList size={28} color="#6366f1" />,
      iconBg: "#f5f3ff",
      title: "Intervention Outcomes Report",
      desc: "Summary of all referrals, their status, assigned LST members and resolution outcomes.",
    },
  ];

  if (loading) return <div style={styles.loadingPage}>Loading reports...</div>;
  if (forbidden) return <AccessDenied />;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>Report Generation</div>
          <span style={styles.topbarSub}>
            Generate PDF and Excel reports for management and district officials
          </span>
        </div>

        <div style={styles.content}>
          {/* Report Type Cards */}
          <div style={styles.reportGrid}>
            {reportTypes.map((r) => (
              <div
                key={r.id}
                style={{
                  ...styles.reportCard,
                  border:
                    reportType === r.id
                      ? "2px solid #6366f1"
                      : "1px solid #e5e7eb",
                  boxShadow:
                    reportType === r.id
                      ? "0 4px 12px rgba(99,102,241,0.15)"
                      : "none",
                }}
                onClick={() => setReportType(r.id)}
              >
                <div style={{ ...styles.reportIconWrap, background: r.iconBg }}>
                  {r.icon}
                </div>
                <div style={styles.reportTitle}>{r.title}</div>
                <div style={styles.reportDesc}>{r.desc}</div>
                <div style={styles.formatRow}>
                  <span style={styles.formatBadgePdf}>PDF</span>
                  <span style={styles.formatBadgeExcel}>Excel</span>
                </div>
                {reportType === r.id && (
                  <div style={styles.selectedLabel}>
                    <CheckCircle
                      size={12}
                      style={{ marginRight: 4, verticalAlign: "middle" }}
                    />
                    Selected
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Config Card */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>
              <FileText
                size={16}
                style={{
                  marginRight: 8,
                  verticalAlign: "middle",
                  color: "#6b7280",
                }}
              />
              Configure & Generate
              {reportType &&
                `: ${reportTypes.find((r) => r.id === reportType)?.title}`}
            </div>

            {success && <div style={styles.successBox}>{success}</div>}

            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Term</label>
                <select
                  style={styles.input}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                >
                  <option>Term 2 — 2026</option>
                  <option>Term 1 — 2026</option>
                  <option>Term 4 — 2025</option>
                  <option>Term 3 — 2025</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Grade Filter</label>
                <select
                  style={styles.input}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <option>All Grades (8–12)</option>
                  <option>Grade 8</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                  <option>Grade 11</option>
                  <option>Grade 12</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Output Format</label>
                <select
                  style={styles.input}
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="pdf">PDF — Formatted report</option>
                  <option value="csv">CSV — Data spreadsheet</option>
                </select>
              </div>
            </div>

            <div style={styles.btnRow}>
              <button
                style={{
                  ...styles.btnPdf,
                  opacity: generating ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
                onClick={() => handleGenerate("pdf")}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader size={14} /> Generating...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Download PDF
                  </>
                )}
              </button>
              <button
                style={{
                  ...styles.btnCsv,
                  opacity: generating ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
                onClick={() => handleGenerate("csv")}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader size={14} /> Generating...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Download CSV
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recent Reports */}
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
              Recently Generated Reports
            </div>
            {reports.length === 0 ? (
              <div style={styles.emptyState}>
                No reports generated yet. Select a report type above and click
                Generate.
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[
                      "Report Name",
                      "Generated By",
                      "Date",
                      "Format",
                      "Download",
                    ].map((h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.report_type}</td>
                      <td style={styles.td}>{r.generated_by}</td>
                      <td style={styles.td}>
                        {new Date(r.generated_at).toLocaleDateString()}
                      </td>
                      <td style={styles.td}>
                        {JSON.parse(r.parameters || "{}").format || "PDF"}
                      </td>
                      <td style={styles.td}>
                        <button
                          style={{
                            ...styles.btnSm,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Download size={11} />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
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
  reportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  reportCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    cursor: "pointer",
    transition: "all 0.15s",
    position: "relative",
  },
  reportIconWrap: {
    width: "52px",
    height: "52px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "14px",
  },
  reportTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "6px",
  },
  reportDesc: {
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: "1.5",
    marginBottom: "14px",
  },
  formatRow: { display: "flex", gap: "6px" },
  formatBadgePdf: {
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "bold",
    background: "#fef2f2",
    color: "#dc2626",
  },
  formatBadgeExcel: {
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "bold",
    background: "#f0fdf4",
    color: "#16a34a",
  },
  selectedLabel: {
    position: "absolute",
    top: "12px",
    right: "12px",
    fontSize: "11px",
    fontWeight: "bold",
    color: "#6366f1",
    display: "flex",
    alignItems: "center",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "14px",
    marginBottom: "16px",
  },
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
  btnRow: { display: "flex", gap: "12px" },
  btnPdf: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px 24px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnCsv: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px 24px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#16a34a",
    marginBottom: "16px",
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
    lineHeight: "1.6",
  },
};
