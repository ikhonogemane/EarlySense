import Sidebar from "./Sidebar";
import { ShieldOff } from "lucide-react";

// NFR16: shown when a route guard or the server (403) refuses a page, so
// the user gets a clear message instead of a blank or broken page.
export default function AccessDenied({ message }) {
  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.box}>
          <ShieldOff size={32} color="#dc2626" />
          <div style={styles.title}>You do not have access</div>
          <div style={styles.text}>
            {message ||
              "Your role does not allow access to this page. If you think this is wrong, contact the System Administrator."}
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
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    background: "#fff",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    padding: "32px 40px",
    maxWidth: "440px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#111827",
  },
  text: {
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: 1.5,
  },
};
