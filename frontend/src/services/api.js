import axios from "axios";

// ─── BASE URL ────────────────────────────────────────────
const API_URL = "http://127.0.0.1:8000/api";

// ─── CREATE AXIOS INSTANCE ───────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── ATTACH TOKEN TO EVERY REQUEST ───────────────────────
// This runs before every API call and adds the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── HANDLE EXPIRED TOKENS ───────────────────────────────
// If token expires, automatically get a new one
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        const res = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh,
        });
        localStorage.setItem("access_token", res.data.access);
        original.headers.Authorization = `Bearer ${res.data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// ─── AUTH ─────────────────────────────────────────────────
export const login = async (username, password) => {
  const res = await api.post("/auth/login/", { username, password });
  localStorage.setItem("access_token", res.data.access);
  localStorage.setItem("refresh_token", res.data.refresh);

  // Fetch and store the logged in user's details including role
  const userRes = await api.get("/auth/me/");
  localStorage.setItem("user", JSON.stringify(userRes.data));

  return res.data;
};

export const getCurrentUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const getUserRole = () => {
  const user = getCurrentUser();
  return user ? user.role : null;
};

export const logout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
};

// ─── DASHBOARD ───────────────────────────────────────────
export const getDashboardStats = () => api.get("/dashboard/");

// ─── LEARNERS ────────────────────────────────────────────
export const getLearners = (params) => api.get("/learners/", { params });
export const getLearner = (id) => api.get(`/learners/${id}/`);
export const createLearner = (data) => api.post("/learners/", data);
export const updateLearner = (id, data) => api.put(`/learners/${id}/`, data);

// ─── ATTENDANCE ──────────────────────────────────────────
export const getAttendance = (learner_id) =>
  api.get("/attendance/", { params: { learner_id } });

// ─── MARKS ───────────────────────────────────────────────
export const getMarks = (learner_id) =>
  api.get("/marks/", { params: { learner_id } });

// ─── INCIDENTS ───────────────────────────────────────────
export const getIncidents = (learner_id) =>
  api.get("/incidents/", { params: { learner_id } });
export const createIncident = (data) => api.post("/incidents/", data);

// ─── ALERTS ──────────────────────────────────────────────
export const getAlerts = () => api.get("/alerts/");
export const markAlertRead = (id) => api.patch(`/alerts/${id}/read/`);
export const markAllAlertsRead = () => api.post("/alerts/read-all/");

// ─── REFERRALS ───────────────────────────────────────────
export const getReferrals = (params) => api.get("/referrals/", { params });
export const createReferral = (data) => api.post("/referrals/", data);
export const updateReferral = (id, data) => api.put(`/referrals/${id}/`, data);

// ─── REPORTS ─────────────────────────────────────────────
export const getReports = () => api.get("/reports/");

export const generateReport = (type, format, grade = "") => {
  const token = localStorage.getItem("access_token");
  const gradeParam =
    grade === "All Grades (8–12)" || grade === "All Grades"
      ? ""
      : grade.replace("Grade ", "");
  const url = `http://127.0.0.1:8000/api/reports/generate/?type=${type}&file_format=${format}&grade=${gradeParam}`;

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `earlysense_${type}_report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch((err) => {
      console.error("Report download failed:", err);
      alert("Failed to generate report: " + err.message);
    });
};

// ─── CSV UPLOAD ──────────────────────────────────────────
export const uploadCSV = (file, type) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  return api.post("/upload-csv/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ─── USERS ───────────────────────────────────────────────
export const getUsers = () => api.get("/users/");
export const createUser = (data) => api.post("/users/", data);
export const updateUser = (id, data) => api.patch(`/users/${id}/`, data);

// ─── AUDIT LOG ───────────────────────────────────────────
export const getAuditLog = () => api.get("/audit-log/");

export default api;

export const markAttendance = (date, attendances) =>
  api.post("/attendance/mark/", { date, attendances });

export const analyseScript = (formData) => api.post('/analyse-script/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// ─── EDUCATOR CLASS TRENDS──────────────────────────────────────────
export const getEducatorClassTrends = () => api.get('/educator/class-trends/');

export const downloadScriptAnalysisPDF = (payload) =>
  api.post('/generate-script-pdf/', payload, { responseType: 'blob' });