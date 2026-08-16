import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import {
  getLearners,
  analyseScript,
  downloadScriptAnalysisPDF,
} from "../services/api";
import {
  Upload,
  Brain,
  FileText,
  BookOpen,
  ClipboardList,
  Loader,
  CheckCircle,
  Download,
  AlertTriangle,
  BarChart3,
  AlertCircle,
  Target,
  Lightbulb,
  GraduationCap,
  ClipboardCheck,
  MessageSquare,
  ListChecks,
} from "lucide-react";

export default function ScriptAnalysis() {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [learnerSearch, setLearnerSearch] = useState("");
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    learner_id: "",
    subject: "",
    assessment_name: "",
    script: null,
    question_paper: null,
    memo: null,
  });

  const loadingSteps = [
    "Reading question paper...",
    "Analysing marking memo...",
    "Comparing learner responses...",
    "Identifying error patterns...",
    "Generating intervention plan...",
  ];

  useEffect(() => {
    fetchLearners();
  }, []);

  useEffect(() => {
    let interval;
    if (analysing) {
      interval = setInterval(() => {
        setStep((s) => (s + 1) % loadingSteps.length);
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [analysing]);

  const fetchLearners = async () => {
    try {
      const res = await getLearners();
      setLearners(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLearners = learners.filter(
    (l) =>
      `${l.first_name} ${l.surname}`
        .toLowerCase()
        .includes(learnerSearch.toLowerCase()) ||
      l.class_group?.toLowerCase().includes(learnerSearch.toLowerCase()),
  );

  const handleFileChange = (field, file) => {
    if (file && file.type === "application/pdf") {
      setForm({ ...form, [field]: file });
      setError("");
    } else {
      setError(`Please upload a PDF file for ${field.replace("_", " ")}`);
    }
  };

  const allFilesUploaded = form.script && form.question_paper && form.memo;
  const formComplete =
    form.learner_id && form.subject && form.assessment_name && allFilesUploaded;

  const handleAnalyse = async () => {
    if (!formComplete) {
      setError("Please complete all fields and upload all three PDF documents");
      return;
    }
    setAnalysing(true);
    setError("");
    setResult(null);
    setStep(0);
    try {
      const formData = new FormData();
      formData.append("learner_id", form.learner_id);
      formData.append("subject", form.subject);
      formData.append("assessment_name", form.assessment_name);
      formData.append("script", form.script);
      formData.append("question_paper", form.question_paper);
      formData.append("memo", form.memo);
      const data = await analyseScript(formData);
      setResult(data.data);
    } catch (err) {
      setError("Analysis failed. Please check your files and try again.");
      console.error(err);
    } finally {
      setAnalysing(false);
    }
  };

  const parseAnalysis = (text) => {
    const sections = [];
    const parts = text.split(/^## /m).filter(Boolean);
    parts.forEach((part) => {
      const lines = part.split("\n");
      const title = lines[0].replace(/^\d+\.\s*/, "").trim();
      const content = lines.slice(1).join("\n").trim();
      sections.push({ title, content });
    });
    return sections;
  };

  // Renders **bold** and *italic* spans as real inline formatting instead
  // of stripping the markers.
  const renderInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\*[^*]+\*)/g).filter(Boolean);
    return parts.map((part, idx) => {
      if (/^\*\*(.*)\*\*$/.test(part)) {
        return (
          <strong key={idx} style={styles.strong}>
            {part.slice(2, -2).trim()}
          </strong>
        );
      }
      if (/^\*(.*)\*$/.test(part)) {
        return (
          <em key={idx} style={styles.em}>
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Converts Unicode vulgar fractions (½ ⅓ ⅔ ...) and superscript/subscript
  // fraction notation (³⁄₅) into plain "3/5" text. Many fonts don't ship
  // glyphs for these characters, which is why they were showing as black
  // "tofu" boxes instead of rendering.
  const normalizeFractions = (text) => {
    const vulgarMap = {
      "½": "1/2",
      "⅓": "1/3",
      "⅔": "2/3",
      "¼": "1/4",
      "¾": "3/4",
      "⅕": "1/5",
      "⅖": "2/5",
      "⅗": "3/5",
      "⅘": "4/5",
      "⅙": "1/6",
      "⅚": "5/6",
      "⅐": "1/7",
      "⅛": "1/8",
      "⅜": "3/8",
      "⅝": "5/8",
      "⅞": "7/8",
      "⅑": "1/9",
      "⅒": "1/10",
    };
    const superMap = {
      "⁰": "0",
      "¹": "1",
      "²": "2",
      "³": "3",
      "⁴": "4",
      "⁵": "5",
      "⁶": "6",
      "⁷": "7",
      "⁸": "8",
      "⁹": "9",
    };
    const subMap = {
      "₀": "0",
      "₁": "1",
      "₂": "2",
      "₃": "3",
      "₄": "4",
      "₅": "5",
      "₆": "6",
      "₇": "7",
      "₈": "8",
      "₉": "9",
    };
    let out = text;
    // superscript digits + fraction slash (U+2044) + subscript digits, e.g. "³⁄₅"
    out = out.replace(
      /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\u2044([₀₁₂₃₄₅₆₇₈₉]+)/g,
      (m, num, den) => {
        const n = num
          .split("")
          .map((c) => superMap[c] || c)
          .join("");
        const d = den
          .split("")
          .map((c) => subMap[c] || c)
          .join("");
        return `${n}/${d}`;
      },
    );
    // vulgar fraction characters — add a space first if glued directly onto
    // a preceding digit (mixed number like "2½"), so it reads "2 1/2" not "21/2"
    out = out.replace(
      /(\d)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])/g,
      (m, digit, frac) =>
        (digit ? digit + " " : "") + (vulgarMap[frac] || frac),
    );
    // any remaining stray super/subscript digits
    out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => superMap[c] || c);
    out = out.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => subMap[c] || c);
    // catch-all: a bare fraction slash (U+2044) between ordinary digits,
    // e.g. "1⁄3" — just make it a normal slash
    out = out.replace(/\u2044/g, "/");
    // Final safety net: strip ANY other character from the Unicode "Number
    // Forms" block (fractions, roman numerals, etc.) we haven't explicitly
    // mapped above, plus any Private-Use-Area characters. Fonts never ship
    // glyphs for these, so leaving them in always risks a black tofu box —
    // better to drop the glyph than show a broken square.
    out = out.replace(/[\u2150-\u218F]/g, "");
    out = out.replace(/[\uE000-\uF8FF]/g, "");
    out = out.replace(/[\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu, "");
    // The Unicode replacement character (U+FFFD) and neighbors — shown when
    // a byte sequence couldn't be decoded at all (e.g. an exotic fraction
    // glyph mangled upstream before it ever reached this code). There's no
    // way to recover the original value, so just drop the placeholder
    // instead of showing a broken box.
    out = out.replace(/[\uFFF0-\uFFFF]/g, "");
    return out;
  };

  // Splits a chunk of text into a leading description plus any
  // "Error: ..." / "Why: ..." labeled segments, so each can be rendered on
  // its own line instead of running on inline.
  const splitLabeledSegments = (text) => {
    const regex = /\*{0,2}(What went wrong|Error|Why)\*{0,2}:\s*/gi;
    const segments = [];
    let lastIndex = 0;
    let lastLabel = null;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const chunk = text.slice(lastIndex, match.index).trim();
      if (chunk) segments.push({ label: lastLabel, text: chunk });
      lastLabel = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
      lastIndex = regex.lastIndex;
    }
    const finalChunk = text.slice(lastIndex).trim();
    if (finalChunk) segments.push({ label: lastLabel, text: finalChunk });
    return segments;
  };

  const renderContent = (content) => {
    const lines = normalizeFractions(content).split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 6 }} />;

      // Markdown sub-headings, e.g. "### Root Cause"
      if (/^#{2,4}\s+/.test(trimmed)) {
        const text = trimmed.replace(/^#{2,4}\s+/, "").replace(/\*\*/g, "");
        return (
          <div key={i} style={styles.subHeading}>
            {text}
          </div>
        );
      }

      // A standalone bold line acting as a label, e.g. "**Root cause:**"
      if (/^\*\*(.+)\*\*:?$/.test(trimmed)) {
        const text = trimmed.replace(/^\*\*(.+?)\*\*:?$/, "$1");
        return (
          <div key={i} style={styles.inlineLabel}>
            {text}
          </div>
        );
      }

      // Numbered list: "1. text" or "1) text"
      const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)/);
      if (numbered) {
        let body = numbered[2];
        let badge = numbered[1];

        // If the AI already embedded its own question reference near the
        // start (optionally inside a bold span that may extend further,
        // e.g. "**2.1 Calculate: 3/4 + 2/3**: ..." or plain "**1.1**: ..."),
        // pull out just the number as the badge and remove only the digits
        // themselves — leaving any ** markers exactly where they were, so
        // bold pairing stays balanced no matter how far the span extends.
        const refMatch = body.match(/^(\*{0,2})(\d+\.\d+)/);
        if (refMatch) {
          badge = refMatch[2];
          body = refMatch[1] + body.slice(refMatch[0].length);
          // collapse a now-empty bold pair left behind, e.g. "**1.1**" → "****"
          body = body.replace(/^\*\*\*\*/, "");
          // tidy a stray leading colon/space left behind
          body = body.replace(/^[:.]\s*/, "");
          body = body.replace(/^\s+/, "");
        }

        const segments = splitLabeledSegments(body);

        return (
          <div key={i} style={styles.numberedItem}>
            <span style={styles.numberBadge}>{badge}</span>
            <div style={{ flex: 1 }}>
              {segments.map((seg, si) =>
                seg.label ? (
                  <div key={si} style={styles.labeledLine}>
                    <span
                      style={{
                        ...styles.labelTag,
                        color:
                          seg.label === "Error" ||
                          seg.label.toLowerCase().includes("wrong")
                            ? "#A13D30"
                            : "#0F6B5C",
                      }}
                    >
                      {seg.label}:
                    </span>{" "}
                    {renderInline(seg.text)}
                  </div>
                ) : (
                  <div key={si} style={styles.descLine}>
                    {renderInline(seg.text)}
                  </div>
                ),
              )}
            </div>
          </div>
        );
      }

      // Bullets (including nested / indented ones)
      if (/^[-*•]\s+/.test(trimmed)) {
        const text = trimmed.replace(/^[-*•]\s+/, "");
        const nested = line.startsWith("  ") || line.startsWith("\t");
        return (
          <div
            key={i}
            style={{
              ...styles.bullet,
              marginLeft: nested ? 18 : 0,
            }}
          >
            <div style={styles.bulletDash} />
            <span>{renderInline(text)}</span>
          </div>
        );
      }

      return (
        <p key={i} style={styles.para}>
          {renderInline(trimmed)}
        </p>
      );
    });
  };

  // Ordered on purpose: this mirrors the real sequence the AI writes the
  // report in, so numbering here communicates something true (reading order),
  // not decoration.
  const sectionMeta = [
    { match: "performance summary", Icon: BarChart3, num: "01" },
    { match: "mark breakdown", Icon: ListChecks, num: "02" },
    { match: "what the learner got right", Icon: CheckCircle, num: "03" },
    { match: "what the learner got wrong", Icon: AlertCircle, num: "04" },
    { match: "conceptual notes", Icon: Target, num: "05" },
    { match: "recommendations", Icon: Lightbulb, num: "06" },
    { match: "teaching strategies", Icon: GraduationCap, num: "07" },
    { match: "two-week plan", Icon: ClipboardCheck, num: "08" },
    { match: "message to the learner", Icon: MessageSquare, num: "09" },
    { match: "message to learner", Icon: MessageSquare, num: "09" },
  ];

  const getSectionMeta = (title, index) => {
    const found = sectionMeta.find((s) =>
      title.toLowerCase().includes(s.match),
    );
    return (
      found || {
        Icon: FileText,
        num: String(index + 1).padStart(2, "0"),
      }
    );
  };

  if (loading) return <div style={styles.loadingPage}>Loading...</div>;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <div>
            <div style={styles.topbarTitle}>AI Script Analysis</div>
            <div style={styles.topbarSub}>
              Upload a question paper, marking memo and learner script to
              generate a personalised intervention report
            </div>
          </div>
          <div style={styles.aiBadge}>
            <Brain size={13} style={{ marginRight: 6 }} strokeWidth={1.75} />
            Groq LLaMA 70B
          </div>
        </div>

        <div style={styles.content}>
          <div style={styles.layout}>
            {/* ── Left Panel: Upload Form ── */}
            <div style={styles.leftPanel}>
              {/* Progress indicators */}
              <div style={styles.progressRow}>
                {[
                  { label: "Learner", done: !!form.learner_id },
                  {
                    label: "Subject",
                    done: !!form.subject && !!form.assessment_name,
                  },
                  { label: "Documents", done: allFilesUploaded },
                ].map((s, i) => (
                  <div key={i} style={styles.progressItem}>
                    <div
                      style={{
                        ...styles.progressMark,
                        borderColor: s.done ? "#0F6B5C" : "#D7D4CB",
                        color: s.done ? "#0F6B5C" : "#B4B0A5",
                      }}
                    >
                      {s.done ? <CheckCircle size={11} /> : i + 1}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: s.done ? "#0F6B5C" : "#8C8A80",
                        fontWeight: s.done ? 600 : 400,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitle}>
                  <Upload
                    size={14}
                    style={{ marginRight: 8, color: "#0F6B5C" }}
                    strokeWidth={1.75}
                  />
                  Upload documents
                </div>

                {error && (
                  <div style={styles.errorBox}>
                    <AlertTriangle
                      size={14}
                      style={{ marginRight: 6, flexShrink: 0 }}
                    />
                    {error}
                  </div>
                )}

                {/* Learner Search */}
                <label style={styles.label}>Learner</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Search by name or class..."
                  value={learnerSearch}
                  onChange={(e) => {
                    setLearnerSearch(e.target.value);
                    setForm({ ...form, learner_id: "" });
                  }}
                />
                {learnerSearch &&
                  !form.learner_id &&
                  filteredLearners.length > 0 && (
                    <div style={styles.dropdown}>
                      {filteredLearners.slice(0, 6).map((l) => (
                        <div
                          key={l.id}
                          style={styles.dropdownItem}
                          onClick={() => {
                            setForm({ ...form, learner_id: l.id });
                            setLearnerSearch(
                              `${l.first_name} ${l.surname} — Grade ${l.grade} ${l.class_group}`,
                            );
                          }}
                        >
                          <div style={styles.dropdownMonogram}>
                            {l.first_name[0]}
                            {l.surname[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {l.first_name} {l.surname}
                            </div>
                            <div style={{ fontSize: 11, color: "#8C8A80" }}>
                              Grade {l.grade} — {l.class_group}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                {form.learner_id && (
                  <div style={styles.selectedTag}>
                    <CheckCircle
                      size={13}
                      color="#0F6B5C"
                      style={{ marginRight: 6, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1 }}>{learnerSearch}</span>
                    <button
                      style={styles.clearBtn}
                      onClick={() => {
                        setForm({ ...form, learner_id: "" });
                        setLearnerSearch("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Subject */}
                <label style={styles.label}>Subject</label>
                <select
                  style={styles.input}
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                >
                  <option value="">Select subject...</option>
                  {[
                    "Mathematics",
                    "English",
                    "Life Sciences",
                    "Geography",
                    "Physical Sciences",
                    "History",
                    "Accounting",
                    "Business Studies",
                    "Economics",
                    "Life Orientation",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Assessment */}
                <label style={styles.label}>Assessment name</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g. Term 2 Test, June Exam"
                  value={form.assessment_name}
                  onChange={(e) =>
                    setForm({ ...form, assessment_name: e.target.value })
                  }
                />

                {/* File Uploads */}
                <div style={styles.filesSection}>
                  {[
                    {
                      field: "question_paper",
                      icon: <BookOpen size={16} strokeWidth={1.75} />,
                      label: "Question paper",
                      value: form.question_paper,
                    },
                    {
                      field: "memo",
                      icon: <ClipboardList size={16} strokeWidth={1.75} />,
                      label: "Marking memo",
                      value: form.memo,
                    },
                    {
                      field: "script",
                      icon: <FileText size={16} strokeWidth={1.75} />,
                      label: "Learner script",
                      value: form.script,
                    },
                  ].map(({ field, icon, label, value }) => (
                    <label
                      key={field}
                      style={{
                        ...styles.fileZone,
                        borderColor: value ? "#0F6B5C" : "#D7D4CB",
                        background: value ? "#F0F5F2" : "#FBFAF7",
                      }}
                    >
                      <input
                        type="file"
                        accept=".pdf"
                        style={{ display: "none" }}
                        onChange={(e) =>
                          handleFileChange(field, e.target.files[0])
                        }
                      />
                      <span style={{ color: value ? "#0F6B5C" : "#8C8A80" }}>
                        {icon}
                      </span>
                      <div style={{ flex: 1, marginLeft: 10 }}>
                        <div style={styles.fileLabel}>{label}</div>
                        <div
                          style={{
                            fontSize: 12,
                            color: value ? "#0F6B5C" : "#B4B0A5",
                            marginTop: 2,
                          }}
                        >
                          {value ? value.name : "PDF · click to upload"}
                        </div>
                      </div>
                      {value && (
                        <CheckCircle
                          size={15}
                          color="#0F6B5C"
                          strokeWidth={1.75}
                        />
                      )}
                    </label>
                  ))}
                </div>

                <button
                  style={{
                    ...styles.analyseBtn,
                    opacity: formComplete && !analysing ? 1 : 0.45,
                    cursor:
                      formComplete && !analysing ? "pointer" : "not-allowed",
                  }}
                  onClick={handleAnalyse}
                  disabled={!formComplete || analysing}
                >
                  {analysing ? (
                    <>
                      <Loader size={14} style={{ marginRight: 8 }} />
                      Analysing
                    </>
                  ) : (
                    <>
                      <Brain
                        size={14}
                        style={{ marginRight: 8 }}
                        strokeWidth={1.75}
                      />
                      Generate analysis
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── Right Panel: Results ── */}
            <div style={styles.rightPanel}>
              {/* Empty state */}
              {!result && !analysing && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyMark}>
                    <Brain size={26} color="#0F6B5C" strokeWidth={1.5} />
                  </div>
                  <div style={styles.emptyTitle}>No report generated yet</div>
                  <div style={styles.emptySub}>
                    Complete the form and upload three PDF documents. The report
                    will compare the learner's answers against the memo and
                    produce a numbered set of findings.
                  </div>
                  <div style={styles.featureList}>
                    {[
                      "Identifies specific question errors",
                      "Detects conceptual gaps",
                      "Suggests teaching strategies",
                      "Writes a two-week support plan",
                      "Drafts a message for the learner",
                    ].map((f, i) => (
                      <div key={i} style={styles.featureItem}>
                        <span style={styles.featureNum}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading state */}
              {analysing && (
                <div style={styles.loadingState}>
                  <div style={styles.loadingMark}>
                    <Brain size={24} color="#0F6B5C" strokeWidth={1.5} />
                  </div>
                  <div style={styles.loadingTitle}>Preparing the report</div>
                  <div style={styles.loadingStep}>{loadingSteps[step]}</div>
                  <div style={styles.loadingTrack}>
                    <div
                      style={{
                        ...styles.loadingFill,
                        width: `${((step + 1) / loadingSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div>
                  {/* Result header */}
                  <div style={styles.resultHeader}>
                    <div style={styles.resultMonogram}>
                      {result.learner
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.resultName}>{result.learner}</div>
                      <div style={styles.resultMeta}>
                        {result.subject} · {result.assessment}
                      </div>
                    </div>
                    <button
                      style={styles.downloadBtn}
                      onClick={async () => {
                        try {
                          const res = await downloadScriptAnalysisPDF({
                            learner: result.learner,
                            subject: result.subject,
                            assessment: result.assessment,
                            analysis: result.analysis,
                          });
                          const blob = new Blob([res.data], {
                            type: "application/pdf",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${result.learner}_${result.subject}_analysis.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error(err);
                          alert(
                            "Could not generate the PDF. Please try again.",
                          );
                        }
                      }}
                    >
                      <Download
                        size={13}
                        style={{ marginRight: 5 }}
                        strokeWidth={1.75}
                      />
                      Download PDF
                    </button>
                  </div>

                  {/* Analysis sections */}
                  <div style={styles.sectionsGrid}>
                    {parseAnalysis(result.analysis).map((section, i) => {
                      const { Icon, num } = getSectionMeta(section.title, i);
                      return (
                        <div key={i} style={styles.sectionCard}>
                          <div style={styles.sectionHeader}>
                            <span style={styles.sectionNum}>{num}</span>
                            <Icon
                              size={15}
                              color="#0F6B5C"
                              strokeWidth={1.75}
                              style={{ marginRight: 8 }}
                            />
                            <div style={styles.sectionTitle}>
                              {section.title}
                            </div>
                          </div>
                          <div style={styles.sectionBody}>
                            {renderContent(section.content)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
    background: "#F6F5F1",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
    color: "#8C8A80",
  },
  topbar: {
    background: "#FFFFFF",
    borderBottom: "1px solid #E3E1DA",
    padding: "0 28px",
    minHeight: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topbarTitle: {
    fontFamily: "Georgia, 'Iowan Old Style', serif",
    fontSize: "19px",
    fontWeight: 700,
    color: "#1C2321",
    letterSpacing: "-0.2px",
  },
  topbarSub: {
    fontSize: "12px",
    color: "#8C8A80",
    marginTop: 2,
    maxWidth: "500px",
  },
  aiBadge: {
    border: "1px solid #D7E5E0",
    background: "#F0F5F2",
    color: "#0F6B5C",
    borderRadius: "4px",
    padding: "6px 12px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.3px",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  content: { flex: 1, padding: "24px 28px", overflowY: "auto" },
  layout: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "20px",
    alignItems: "start",
    minWidth: 0,
  },
  leftPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
  progressRow: {
    display: "flex",
    gap: "8px",
    background: "#FFFFFF",
    borderRadius: "8px",
    padding: "14px 16px",
    border: "1px solid #E3E1DA",
  },
  progressItem: { display: "flex", alignItems: "center", gap: "7px", flex: 1 },
  progressMark: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "1.5px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 700,
    flexShrink: 0,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: "8px",
    padding: "20px",
    border: "1px solid #E3E1DA",
  },
  cardTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#1C2321",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  label: {
    display: "block",
    fontSize: "10px",
    fontWeight: 700,
    color: "#8C8A80",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    marginBottom: "5px",
    marginTop: "14px",
  },
  input: {
    width: "100%",
    background: "#FBFAF7",
    border: "1px solid #E3E1DA",
    borderRadius: "6px",
    padding: "9px 12px",
    fontSize: "13px",
    color: "#1C2321",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  dropdown: {
    background: "#FFFFFF",
    border: "1px solid #E3E1DA",
    borderRadius: "6px",
    boxShadow: "0 6px 16px rgba(28,35,33,0.08)",
    marginTop: "4px",
    overflow: "hidden",
    zIndex: 100,
    position: "relative",
  },
  dropdownItem: {
    padding: "10px 14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderBottom: "1px solid #F1F0EB",
  },
  dropdownMonogram: {
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    background: "#1C2321",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 700,
    flexShrink: 0,
  },
  selectedTag: {
    background: "#F0F5F2",
    border: "1px solid #D7E5E0",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    color: "#0F6B5C",
    fontWeight: 600,
    marginTop: "6px",
    display: "flex",
    alignItems: "center",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#0F6B5C",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 700,
    padding: "0 4px",
    textDecoration: "underline",
  },
  filesSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
  },
  fileZone: {
    display: "flex",
    alignItems: "center",
    border: "1.5px dashed",
    borderRadius: "6px",
    padding: "11px 14px",
    cursor: "pointer",
  },
  fileLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#6B7270",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  analyseBtn: {
    width: "100%",
    background: "#0F6B5C",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.2px",
    cursor: "pointer",
    marginTop: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    background: "#FBEEEC",
    border: "1px solid #E3B3AC",
    borderRadius: "6px",
    padding: "10px 14px",
    fontSize: "12px",
    color: "#A13D30",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
  },
  rightPanel: {
    background: "#FFFFFF",
    borderRadius: "8px",
    border: "1px solid #E3E1DA",
    minHeight: "600px",
    overflow: "hidden",
    minWidth: 0,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px 40px",
    gap: "14px",
    textAlign: "center",
  },
  emptyMark: {
    width: "56px",
    height: "56px",
    background: "#F0F5F2",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "Georgia, 'Iowan Old Style', serif",
    fontSize: "17px",
    fontWeight: 700,
    color: "#1C2321",
  },
  emptySub: {
    fontSize: "13px",
    color: "#8C8A80",
    maxWidth: "320px",
    lineHeight: "1.7",
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    alignItems: "flex-start",
    marginTop: "10px",
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    fontSize: "13px",
    color: "#374039",
  },
  featureNum: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#0F6B5C",
    marginRight: "10px",
    fontVariantNumeric: "tabular-nums",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "84px 40px",
    gap: "14px",
  },
  loadingMark: {
    width: "56px",
    height: "56px",
    background: "#F0F5F2",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "pulse 2s infinite",
  },
  loadingTitle: {
    fontFamily: "Georgia, 'Iowan Old Style', serif",
    fontSize: "16px",
    fontWeight: 700,
    color: "#1C2321",
  },
  loadingStep: { fontSize: "12px", color: "#8C8A80", height: "18px" },
  loadingTrack: {
    width: "200px",
    height: "3px",
    background: "#EDEBE4",
    borderRadius: "2px",
    overflow: "hidden",
    marginTop: "6px",
  },
  loadingFill: {
    height: "100%",
    background: "#0F6B5C",
    borderRadius: "2px",
    transition: "width 0.4s ease",
  },
  resultHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 24px",
    borderBottom: "1px solid #E3E1DA",
    background: "#FBFAF7",
  },
  resultMonogram: {
    width: "38px",
    height: "38px",
    background: "#1C2321",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: 700,
    color: "#FFFFFF",
    flexShrink: 0,
  },
  resultName: {
    fontFamily: "Georgia, 'Iowan Old Style', serif",
    fontSize: "16px",
    fontWeight: 700,
    color: "#1C2321",
  },
  resultMeta: { fontSize: "12px", color: "#8C8A80", marginTop: "2px" },
  downloadBtn: {
    background: "#FFFFFF",
    color: "#1C2321",
    border: "1px solid #D7D4CB",
    borderRadius: "6px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  sectionsGrid: {
    padding: "22px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    maxHeight: "680px",
    overflowY: "auto",
  },
  sectionCard: {
    padding: "16px 0",
    borderBottom: "1px solid #EDEBE4",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: "10px",
  },
  sectionNum: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#B4B0A5",
    marginRight: "10px",
    fontVariantNumeric: "tabular-nums",
    minWidth: "16px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#1C2321",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  sectionBody: {
    fontSize: "13px",
    color: "#374039",
    lineHeight: "1.7",
    paddingLeft: "26px",
    wordBreak: "break-word",
  },
  bullet: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "6px",
  },
  bulletDash: {
    width: "8px",
    height: "1.5px",
    background: "#0F6B5C",
    marginTop: "9px",
    flexShrink: 0,
  },
  para: { margin: "0 0 8px 0" },
  subHeading: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#0F6B5C",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: "12px",
    marginBottom: "6px",
  },
  inlineLabel: {
    fontWeight: 700,
    color: "#1C2321",
    fontSize: "13px",
    marginTop: "10px",
    marginBottom: "3px",
  },
  numberedItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "6px",
  },
  numberBadge: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#0F6B5C",
    minWidth: "26px",
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
  descLine: {
    marginBottom: "4px",
  },
  labeledLine: {
    marginTop: "3px",
    marginBottom: "3px",
  },
  labelTag: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  strong: { fontWeight: 700, color: "#1C2321" },
  em: { fontStyle: "italic", color: "#374039" },
};
