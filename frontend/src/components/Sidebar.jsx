import { useNavigate, useLocation } from "react-router-dom";
import { logout, getCurrentUser } from "../services/api";
import { ROLES } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Bell,
  Upload,
  ClipboardList,
  FileText,
  UserCog,
  ScrollText,
  CalendarCheck,
  LogOut,
  Map,
  Brain,
} from "lucide-react";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const role = user?.role;

  const getNavItems = () => {
    if (role === ROLES.EDUCATOR)
      return [
        {
          path: "/",
          icon: <LayoutDashboard size={16} />,
          label: "My Dashboard",
        },
        {
          path: "/attendance",
          icon: <CalendarCheck size={16} />,
          label: "Mark Attendance",
        },
        { path: "/upload", icon: <Upload size={16} />, label: "Upload Data" },
        { path: "/alerts", icon: <Bell size={16} />, label: "Alerts" },
        {
          path: "/referrals",
          icon: <ClipboardList size={16} />,
          label: "Referrals",
        },
        {
          path: "/script-analysis",
          icon: <Brain size={16} />,
          label: "AI Script Analysis",
        },
      ];

    if (role === ROLES.LST_MEMBER)
      return [
        { path: "/", icon: <ClipboardList size={16} />, label: "My Referrals" },
        { path: "/alerts", icon: <Bell size={16} />, label: "Alerts" },
      ];

    if (role === ROLES.SCHOOL_ADMIN)
      return [
        { path: "/", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
        {
          path: "/learners",
          icon: <Users size={16} />,
          label: "Learner Profiles",
        },

        { path: "/alerts", icon: <Bell size={16} />, label: "Alerts" },
        { path: "/upload", icon: <Upload size={16} />, label: "Upload CSV" },
        {
          path: "/referrals",
          icon: <ClipboardList size={16} />,
          label: "Referrals",
        },
        { path: "/reports", icon: <FileText size={16} />, label: "Reports" },
        { path: "/map", icon: <Map size={16} />, label: "Risk Map" },
      ];

    if (role === ROLES.SYSTEM_ADMIN)
      return [
        {
          path: "/users",
          icon: <UserCog size={16} />,
          label: "User Management",
        },
        {
          path: "/audit-log",
          icon: <ScrollText size={16} />,
          label: "Audit Log",
        },
      ];

    return [];
  };

  const navItems = getNavItems();

  const getRoleLabel = () => {
    if (role === ROLES.EDUCATOR) return "Educator";
    if (role === ROLES.SCHOOL_ADMIN) return "School Administrator";
    if (role === ROLES.SYSTEM_ADMIN) return "System Administrator";
    if (role === ROLES.LST_MEMBER) return "LST Member";
    return role;
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        <div style={styles.logoText}>EarlySense</div>
        <div style={styles.logoSub}>Learner Retention System</div>
      </div>

      <nav style={styles.nav}>
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <div
              key={item.path}
              style={{
                ...styles.navItem,
                ...(active ? styles.navItemActive : {}),
              }}
              onClick={() => navigate(item.path)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>

      <div style={styles.bottom}>
        <div style={styles.userInfo}>
          <div style={styles.userAvatar}>
            {user?.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <div style={styles.userName}>{user?.full_name}</div>
            <div style={styles.userRole}>{getRoleLabel()}</div>
          </div>
        </div>
        <div style={styles.navItem} onClick={logout}>
          <span style={styles.navIcon}>
            <LogOut size={16} />
          </span>
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: "220px",
    background: "#0f1923",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 100,
  },
  logo: {
    padding: "20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoText: {
    fontFamily: "serif",
    fontSize: "20px",
    color: "#fff",
    fontWeight: "bold",
  },
  logoSub: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginTop: "2px",
  },
  nav: {
    padding: "16px 0",
    flex: 1,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 20px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.55)",
    cursor: "pointer",
    borderLeft: "3px solid transparent",
    transition: "all 0.15s",
  },
  navItemActive: {
    color: "#fff",
    background: "rgba(220,38,38,0.12)",
    borderLeft: "3px solid #dc2626",
  },
  navIcon: {
    width: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bottom: {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    paddingTop: "8px",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  userAvatar: {
    width: "32px",
    height: "32px",
    background: "linear-gradient(135deg,#dc2626,#991b1b)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "bold",
    color: "#fff",
    flexShrink: 0,
  },
  userName: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#fff",
  },
  userRole: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.35)",
  },
};
