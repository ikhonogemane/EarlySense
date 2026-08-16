import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { getUsers, createUser, updateUser } from "../services/api";
import { UserPlus, Users, X } from "lucide-react";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assignModal, setAssignModal] = useState(null);
  const [assignForm, setAssignForm] = useState({
    assigned_grade: "",
    assigned_class_group: "",
  });

  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    role: "Educator",
    password: "",
    assigned_grade: "",
    assigned_class_group: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.full_name || !form.password) {
      setError("Please fill in all required fields");
      return;
    }
    try {
      await createUser(form);
      setSuccess("User account created successfully!");
      setError("");
      setForm({
        username: "",
        email: "",
        full_name: "",
        role: "Educator",
        password: "",
        assigned_grade: "",
        assigned_class_group: "",
      });
      fetchUsers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.username?.[0] ||
          err.response?.data?.email?.[0] ||
          "Failed to create user.",
      );
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setUsers(
        users.map((u) =>
          u.id === user.id ? { ...u, is_active: !u.is_active } : u,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const openAssignModal = (user) => {
    setAssignModal(user);
    setAssignForm({
      assigned_grade: user.assigned_grade || "",
      assigned_class_group: user.assigned_class_group || "",
    });
  };

  const handleAssignClass = async () => {
    if (!assignForm.assigned_grade || !assignForm.assigned_class_group) {
      setError("Please select a grade and enter a class group");
      return;
    }
    try {
      await updateUser(assignModal.id, {
        assigned_grade: parseInt(assignForm.assigned_grade),
        assigned_class_group: assignForm.assigned_class_group,
      });
      setUsers(
        users.map((u) =>
          u.id === assignModal.id
            ? {
                ...u,
                assigned_grade: parseInt(assignForm.assigned_grade),
                assigned_class_group: assignForm.assigned_class_group,
              }
            : u,
        ),
      );
      setSuccess(
        `${assignModal.full_name} assigned to Grade ${assignForm.assigned_grade} — ${assignForm.assigned_class_group}`,
      );
      setAssignModal(null);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError("Failed to assign class. Please try again.");
    }
  };

  const getRoleColor = (role) => {
    if (role === "System_Admin") return { color: "#7c3aed", bg: "#f5f3ff" };
    if (role === "School_Admin") return { color: "#dc2626", bg: "#fef2f2" };
    if (role === "LST_Member") return { color: "#16a34a", bg: "#f0fdf4" };
    return { color: "#2563eb", bg: "#eff6ff" };
  };

  const getInitials = (name) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (loading) return <div style={styles.loadingPage}>Loading users...</div>;

  return (
    <div style={styles.page}>
      <Sidebar />
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={styles.topbarTitle}>User Management</div>
          <span style={styles.topbarSub}>
            {users.filter((u) => u.is_active).length} active users
          </span>
        </div>

        <div style={styles.content}>
          {success && <div style={styles.successBanner}>{success}</div>}
          {error && <div style={styles.errorBanner}>{error}</div>}

          <div style={styles.grid}>
            {/* Users List */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>
                <Users
                  size={16}
                  style={{
                    marginRight: 8,
                    verticalAlign: "middle",
                    color: "#6b7280",
                  }}
                />
                System Users ({users.length})
              </div>

              {users.length === 0 ? (
                <div style={styles.emptyState}>No users found.</div>
              ) : (
                users.map((user) => {
                  const rc = getRoleColor(user.role);
                  return (
                    <div
                      key={user.id}
                      style={{
                        ...styles.userRow,
                        opacity: user.is_active ? 1 : 0.5,
                      }}
                    >
                      <div style={{ ...styles.avatar, background: rc.color }}>
                        {getInitials(user.full_name)}
                      </div>
                      <div style={styles.userInfo}>
                        <div style={styles.userName}>{user.full_name}</div>
                        <div style={styles.userEmail}>{user.email}</div>
                        {user.role === "Educator" &&
                          user.assigned_class_group && (
                            <div style={styles.classTag}>
                              Grade {user.assigned_grade} —{" "}
                              {user.assigned_class_group}
                            </div>
                          )}
                        {user.role === "Educator" &&
                          !user.assigned_class_group && (
                            <div style={styles.unassignedTag}>
                              No class assigned
                            </div>
                          )}
                      </div>
                      <span
                        style={{
                          ...styles.roleBadge,
                          color: rc.color,
                          background: rc.bg,
                        }}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                      <div
                        style={{
                          ...styles.statusDot,
                          background: user.is_active ? "#22c55e" : "#d1d5db",
                        }}
                      />
                      <div style={styles.actionRow}>
                        <button
                          style={{
                            ...styles.btnXs,
                            background: user.is_active ? "#fef2f2" : "#f0fdf4",
                            color: user.is_active ? "#dc2626" : "#16a34a",
                          }}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>
                        {user.role === "Educator" && (
                          <button
                            style={{
                              ...styles.btnXs,
                              background: "#eff6ff",
                              color: "#2563eb",
                            }}
                            onClick={() => openAssignModal(user)}
                          >
                            Assign Class
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create User Form */}
            <div style={styles.formCard}>
              <div style={styles.cardTitle}>
                <UserPlus
                  size={16}
                  style={{
                    marginRight: 8,
                    verticalAlign: "middle",
                    color: "#dc2626",
                  }}
                />
                Add New User
              </div>

              <label style={styles.label}>Full Name *</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. Nomsa Khumalo"
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
              />

              <label style={styles.label}>Username *</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. n.khumalo"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />

              <label style={styles.label}>Email Address *</label>
              <input
                style={styles.input}
                type="email"
                placeholder="e.g. n.khumalo@school.edu.za"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <label style={styles.label}>Assign Role *</label>
              <select
                style={styles.input}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="Educator">Educator</option>
                <option value="School_Admin">School Administrator</option>
                <option value="LST_Member">LST Member</option>
                <option value="System_Admin">System Administrator</option>
              </select>

              {form.role === "Educator" && (
                <>
                  <label style={styles.label}>Assign Grade</label>
                  <select
                    style={styles.input}
                    value={form.assigned_grade}
                    onChange={(e) =>
                      setForm({ ...form, assigned_grade: e.target.value })
                    }
                  >
                    <option value="">Select grade...</option>
                    {[8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>

                  <label style={styles.label}>Assign Class Group</label>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="e.g. 9A"
                    value={form.assigned_class_group}
                    onChange={(e) =>
                      setForm({ ...form, assigned_class_group: e.target.value })
                    }
                  />
                </>
              )}

              <label style={styles.label}>Temporary Password *</label>
              <input
                style={styles.input}
                type="password"
                placeholder="User will reset on first login"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />

              <button style={styles.btnPrimary} onClick={handleCreate}>
                Create User Account
              </button>

              <div style={styles.hint}>
                User will receive login instructions from the System
                Administrator.
              </div>
            </div>
          </div>
        </div>

        {/* Assign Class Modal */}
        {assignModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <div style={styles.modalHeader}>
                <div style={styles.modalTitle}>Assign Class</div>
                <button
                  style={styles.closeBtn}
                  onClick={() => setAssignModal(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={styles.modalSub}>
                Assigning class to <strong>{assignModal.full_name}</strong>
              </div>

              <label style={styles.label}>Grade</label>
              <select
                style={styles.input}
                value={assignForm.assigned_grade}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    assigned_grade: e.target.value,
                  })
                }
              >
                <option value="">Select grade...</option>
                {[8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Class Group</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. 9A"
                value={assignForm.assigned_class_group}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    assigned_class_group: e.target.value,
                  })
                }
              />

              <div style={styles.modalBtns}>
                <button style={styles.btnPrimary} onClick={handleAssignClass}>
                  Assign Class
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setAssignModal(null)}
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
  topbarSub: { fontSize: "12px", color: "#9ca3af" },
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: "20px",
    alignItems: "start",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
  },
  formCard: {
    background: "#fff",
    borderRadius: "14px",
    padding: "22px",
    border: "1px solid #e5e7eb",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#111827",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0",
    borderBottom: "1px solid #f9fafb",
    flexWrap: "wrap",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "bold",
    color: "#fff",
    flexShrink: 0,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: "13px", fontWeight: "bold", color: "#111827" },
  userEmail: { fontSize: "11px", color: "#9ca3af" },
  classTag: {
    fontSize: "11px",
    color: "#2563eb",
    fontWeight: "bold",
    marginTop: "2px",
  },
  unassignedTag: { fontSize: "11px", color: "#f59e0b", marginTop: "2px" },
  roleBadge: {
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  actionRow: { display: "flex", gap: "6px" },
  btnXs: {
    border: "none",
    borderRadius: "5px",
    padding: "4px 8px",
    fontSize: "11px",
    cursor: "pointer",
    fontWeight: "bold",
  },
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
  btnPrimary: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px 20px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    padding: "11px 20px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  hint: {
    textAlign: "center",
    marginTop: "12px",
    fontSize: "11px",
    color: "#9ca3af",
    lineHeight: "1.5",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#9ca3af",
    fontSize: "14px",
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
    width: "400px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  modalTitle: { fontSize: "18px", fontWeight: "bold", color: "#111827" },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6b7280",
    padding: "4px",
  },
  modalSub: { fontSize: "13px", color: "#6b7280", marginBottom: "8px" },
  modalBtns: { display: "flex", gap: "10px", marginTop: "20px" },
};
