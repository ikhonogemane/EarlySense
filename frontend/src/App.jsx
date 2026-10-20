import MarkAttendance from "./pages/MarkAttendance";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EducatorDashboard from "./pages/EducatorDashboard";
import LearnerList from "./pages/LearnerList";
import LearnerProfile from "./pages/LearnerProfile";
import Alerts from "./pages/Alerts";
import UploadCSV from "./pages/UploadCSV";
import Referrals from "./pages/Referrals";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import AuditLog from "./pages/AuditLog";
import MapView from "./pages/MapView";
import ScriptAnalysis from './pages/ScriptAnalysis';
import AccessDenied from "./components/AccessDenied";
import { PAGE_ROLES, hasAnyRole, getHomePath } from "./constants/roles";

const getStoredUser = () => JSON.parse(localStorage.getItem("user") || "{}");

// ─── PROTECTED ROUTE ─────────────────────────────────────
// FR01, NFR18: allowed if the user holds ANY of allowedRoles. The server
// enforces the same rules (NFR16); this only stops the page opening.
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" />;

  if (allowedRoles && !hasAnyRole(getStoredUser(), allowedRoles)) {
    return <AccessDenied />;
  }
  return children;
};

// ─── ROLE BASED HOME ─────────────────────────────────────
// Landing page for users with several roles, first match wins: Grade
// Head, Wellness Office, School Clerk, Register Teacher, Subject Teacher,
// System Administrator.
const RoleHome = () => {
  const home = getHomePath(getStoredUser());
  if (home) return <Navigate to={home} replace />;
  return (
    <AccessDenied message="Your account has no roles assigned. Sign out and sign in again, or contact the System Administrator." />
  );
};

const guarded = (allowedRoles, page) => (
  <ProtectedRoute allowedRoles={allowedRoles}>{page}</ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Role-based home */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleHome />
            </ProtectedRoute>
          }
        />

        <Route path="/dashboard" element={guarded(PAGE_ROLES.dashboard, <Dashboard />)} />
        <Route path="/my-class" element={guarded(PAGE_ROLES.myClass, <EducatorDashboard />)} />
        <Route path="/learners" element={guarded(PAGE_ROLES.learners, <LearnerList />)} />
        <Route path="/learners/:id" element={guarded(PAGE_ROLES.learners, <LearnerProfile />)} />
        <Route path="/map" element={guarded(PAGE_ROLES.map, <MapView />)} />
        <Route path="/alerts" element={guarded(PAGE_ROLES.alerts, <Alerts />)} />
        <Route path="/referrals" element={guarded(PAGE_ROLES.referrals, <Referrals />)} />
        <Route path="/attendance" element={guarded(PAGE_ROLES.attendance, <MarkAttendance />)} />
        <Route path="/upload" element={guarded(PAGE_ROLES.upload, <UploadCSV />)} />
        <Route path="/reports" element={guarded(PAGE_ROLES.reports, <Reports />)} />
        <Route path="/script-analysis" element={guarded(PAGE_ROLES.scriptAnalysis, <ScriptAnalysis />)} />
        <Route path="/users" element={guarded(PAGE_ROLES.users, <UserManagement />)} />
        <Route path="/audit-log" element={guarded(PAGE_ROLES.auditLog, <AuditLog />)} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
