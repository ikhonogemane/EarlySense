import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { uploadCSV } from "../services/api";
import { isForbidden } from "../constants/roles";
import {
  FolderOpen,
  CheckCircle,
  PartyPopper,
  Loader,
  AlertTriangle,
  Check,
} from "lucide-react";

export default function UploadCSV() {
  // FR04: the School Clerk imports learners, attendance and marks.
  const [uploadType, setUploadType] = useState("learners");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith(".csv")) {
      setFile(selected);
      setError("");
      setResult(null);
      setStep(2);
    } else {
      setError("Please select a valid CSV file");
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }
    setLoading(true);
    setError("");
    setStep(3);
    try {
      const res = await uploadCSV(file, uploadType);
      setResult(res.data);
      setStep(4);
    } catch (err) {
      setError(
        isForbidden(err)
          ? "You do not have access to upload data."
          : err.response?.data?.error || "Upload failed. Please try again.",
      );
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError("");
    setStep(1);
  };

  const steps = ["Select File", "Validate", "Import", "Score & Alert"];

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>Upload CSV Data</div>
          <span style={styles.topbarSub}>
            Import SA-SAMS attendance and mark exports
          </span>
        </div>

        <div style={styles.content}>
          {/* Step Indicator */}
          <div style={styles.stepRow}>
            {steps.map((s, i) => (
              <div key={s} style={styles.stepGroup}>
                <div style={styles.stepItem}>
                  <div
                    style={{
                      ...styles.stepNum,
                      background: i + 1 <= step ? "#6366f1" : "#e5e7eb",
                      color: i + 1 <= step ? "#fff" : "#9ca3af",
                    }}
                  >
                    {i + 1 < step ? <Check size={13} /> : i + 1}
                  </div>
                  <div
                    style={{
                      ...styles.stepLabel,
                      color: i + 1 <= step ? "#374151" : "#9ca3af",
                      fontWeight: i + 1 === step ? "bold" : "normal",
                    }}
                  >
                    {s}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      ...styles.stepLine,
                      background: i + 1 < step ? "#6366f1" : "#e5e7eb",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Main Card */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Import Learner Data</div>
            <div style={styles.cardSub}>
              Upload CSV files exported from SA-SAMS or manually created. The
              system will validate, import, and trigger AI risk scoring
              automatically.
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            {/* Step 1 — Select File */}
            {step === 1 && (
              <div>
                <div style={styles.uploadTypeRow}>
                  <label style={styles.label}>Upload Type</label>
                  <select
                    style={styles.select}
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                  >
                    <option value="learners">Learner Class List</option>
                    <option value="attendance">Attendance Data</option>
                    <option value="marks">Marks / Assessment Data</option>
                  </select>
                </div>

                <label style={styles.uploadZone}>
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <div style={styles.uploadIconWrap}>
                    <FolderOpen size={40} color="#6366f1" />
                  </div>
                  <div style={styles.uploadText}>
                    Click to select your CSV file
                  </div>
                  <div style={styles.uploadHint}>
                    Only .csv files are accepted
                  </div>
                </label>
              </div>
            )}

            {/* Step 2 — File Selected */}
            {step === 2 && file && (
              <div>
                <div style={styles.successBox}>
                  <CheckCircle
                    size={22}
                    color="#16a34a"
                    style={{ flexShrink: 0 }}
                  />
                  <div>
                    <div style={styles.successTitle}>
                      File selected — {file.name}
                    </div>
                    <div style={styles.successSub}>
                      Size: {(file.size / 1024).toFixed(1)} KB · Type:{" "}
                      {uploadType}
                    </div>
                  </div>
                </div>
                <div style={styles.btnRow}>
                  <button style={styles.btnPrimary} onClick={handleUpload}>
                    Validate & Import Data
                  </button>
                  <button style={styles.btnSecondary} onClick={handleReset}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Loading */}
            {step === 3 && loading && (
              <div style={styles.loadingBox}>
                <div style={styles.loadingIconWrap}>
                  <Loader size={40} color="#6366f1" />
                </div>
                <div style={styles.loadingText}>
                  Validating and importing data...
                </div>
                <div style={styles.loadingSub}>
                  AI risk scoring will run automatically after import
                </div>
              </div>
            )}

            {/* Step 4 — Results */}
            {step === 4 && result && (
              <div>
                <div style={styles.successBox}>
                  <PartyPopper
                    size={22}
                    color="#16a34a"
                    style={{ flexShrink: 0 }}
                  />
                  <div>
                    <div style={styles.successTitle}>Import Complete!</div>
                    <div style={styles.successSub}>{result.message}</div>
                  </div>
                </div>

                <div style={styles.resultGrid}>
                  <div style={styles.resultTile}>
                    <div style={{ ...styles.resultNum, color: "#6366f1" }}>
                      {result.imported}
                    </div>
                    <div style={styles.resultLabel}>Records Imported</div>
                  </div>
                  <div style={styles.resultTile}>
                    <div style={{ ...styles.resultNum, color: "#f59e0b" }}>
                      {result.duplicates}
                    </div>
                    <div style={styles.resultLabel}>Duplicates Skipped</div>
                  </div>
                  <div style={styles.resultTile}>
                    <div
                      style={{
                        ...styles.resultNum,
                        color: result.errors.length > 0 ? "#dc2626" : "#22c55e",
                      }}
                    >
                      {result.errors.length}
                    </div>
                    <div style={styles.resultLabel}>Errors</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div style={styles.errorList}>
                    <div style={styles.errorListTitle}>Errors:</div>
                    {result.errors.slice(0, 10).map((e, i) => (
                      <div key={i} style={styles.errorListItem}>
                        <AlertTriangle
                          size={11}
                          style={{ marginRight: 5, verticalAlign: "middle" }}
                        />
                        {e}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div style={styles.errorListItem}>
                        ...and {result.errors.length - 10} more
                      </div>
                    )}
                  </div>
                )}

                <button style={styles.btnPrimary} onClick={handleReset}>
                  Upload Another File
                </button>
              </div>
            )}
          </div>

          {/* CSV Format Guide */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Expected CSV Format</div>
            <div style={styles.codeBlock}>
              {uploadType === "learners" && (
                <>
                  learner_id, first_name, surname, grade, class_group, gender,
                  date_of_birth, enrolled_date, home_town, distance_km,
                  guardian_name, guardian_phone, income_index
                  <br />
                  0001, Amahle, Dube, 9, 9A, Female, 2011-03-12, 2023-01-15,
                  Kuruman, 3.5, Dube Amahle, 0721234501, 2
                </>
              )}
              {uploadType === "attendance" && (
                <>
                  learner_id, date, present
                  <br />
                  0001, 2026-04-07, 1<br />
                  0002, 2026-04-07, 0
                </>
              )}
              {uploadType === "marks" && (
                <>
                  learner_id, subject, assessment_type, mark, max_mark, term,
                  assessment_date
                  <br />
                  0001, Mathematics, Test, 72, 100, 2, 2026-04-15
                  <br />
                  0002, Mathematics, Test, 65, 100, 2, 2026-04-15
                </>
              )}
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
  stepRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "24px",
    background: "#fff",
    borderRadius: "14px",
    padding: "20px 28px",
    border: "1px solid #e5e7eb",
  },
  stepGroup: { display: "flex", alignItems: "center", flex: 1 },
  stepItem: { display: "flex", alignItems: "center", gap: "8px" },
  stepNum: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "bold",
    flexShrink: 0,
  },
  stepLabel: { fontSize: "13px" },
  stepLine: { flex: 1, height: "2px", margin: "0 12px" },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "24px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "6px",
  },
  cardSub: {
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "24px",
    lineHeight: "1.5",
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
  uploadTypeRow: { marginBottom: "16px" },
  select: {
    width: "100%",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#374151",
    outline: "none",
  },
  classInfo: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#1d4ed8",
    marginBottom: "16px",
  },
  uploadZone: {
    display: "block",
    border: "2px dashed #d1d5db",
    borderRadius: "12px",
    padding: "48px",
    textAlign: "center",
    background: "#f9fafb",
    cursor: "pointer",
  },
  uploadIconWrap: { marginBottom: "12px" },
  uploadText: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#374151",
    marginBottom: "4px",
  },
  uploadHint: { fontSize: "12px", color: "#9ca3af" },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "13px",
    color: "#dc2626",
    marginBottom: "16px",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  successTitle: { fontSize: "14px", fontWeight: "bold", color: "#166534" },
  successSub: { fontSize: "12px", color: "#4ade80", marginTop: "2px" },
  btnRow: { display: "flex", gap: "12px" },
  btnPrimary: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px 24px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "11px 24px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  loadingBox: { textAlign: "center", padding: "40px" },
  loadingIconWrap: { marginBottom: "12px" },
  loadingText: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#374151",
    marginBottom: "6px",
  },
  loadingSub: { fontSize: "13px", color: "#9ca3af" },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "14px",
    marginBottom: "20px",
  },
  resultTile: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "16px",
    textAlign: "center",
  },
  resultNum: { fontSize: "28px", fontWeight: "bold", marginBottom: "4px" },
  resultLabel: { fontSize: "11px", color: "#9ca3af" },
  errorList: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "16px",
  },
  errorListTitle: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: "8px",
  },
  errorListItem: {
    fontSize: "12px",
    color: "#dc2626",
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
  },
  codeBlock: {
    background: "#0f1923",
    borderRadius: "8px",
    padding: "16px",
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#a3e635",
    lineHeight: "1.8",
  },
};
