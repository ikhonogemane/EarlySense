import MarkAttendance from "./pages/MarkAttendance";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, ROLES } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EducatorDashboard from "./pages/EducatorDashboard";
import LSTDashboard from "./pages/LSTDashboard";
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

// ─── PROTECTED ROUTE ─────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" />;

  if (allowedRoles) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/" />;
    }
  }
  return children;
};

// ─── ROLE BASED HOME ─────────────────────────────────────
const RoleHome = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (user.role === ROLES.EDUCATOR) return <EducatorDashboard />;
  if (user.role === ROLES.LST_MEMBER) return <LSTDashboard />;
  if (user.role === ROLES.SYSTEM_ADMIN) return <Navigate to="/users" />;
  return <Dashboard />;
};

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

        {/* School Admin + System Admin only */}
        <Route
          path="/learners"
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.SCHOOL_ADMIN, ROLES.SYSTEM_ADMIN]}
            >
              <LearnerList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute
              allowedRoles={[
                ROLES.SCHOOL_ADMIN,
                ROLES.SYSTEM_ADMIN,
                ROLES.EDUCATOR,
              ]}
            >
              <UploadCSV />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.SCHOOL_ADMIN, ROLES.SYSTEM_ADMIN]}
            >
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* System Admin only */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />

        {/* All authenticated users */}
        <Route
          path="/learners/:id"
          element={
            <ProtectedRoute>
              <LearnerProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Alerts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrals"
          element={
            <ProtectedRoute>
              <Referrals />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute
              allowedRoles={[
                ROLES.EDUCATOR,
                ROLES.SCHOOL_ADMIN,
                ROLES.SYSTEM_ADMIN,
              ]}
            >
              <MarkAttendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/map"
          element={
            <ProtectedRoute
              allowedRoles={[ROLES.SCHOOL_ADMIN, ROLES.SYSTEM_ADMIN]}
            >
              <MapView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/script-analysis"
          element={
            <ProtectedRoute allowedRoles={[ROLES.EDUCATOR, ROLES.SCHOOL_ADMIN]}>
              <ScriptAnalysis />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
