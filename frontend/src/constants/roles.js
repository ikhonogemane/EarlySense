// ─── ROLES (FR01, FR02, NFR17, NFR18) ────────────────────
// The six role names exactly as /auth/me/ returns them in user.roles.
// This is the one place the frontend names roles and decides which pages
// each role may open. The server still enforces every rule (NFR16); this
// only decides what the menu and route guards show.
export const ROLES = {
  REGISTER_TEACHER: "Register Teacher",
  SUBJECT_TEACHER: "Subject Teacher",
  GRADE_HEAD: "Grade Head",
  SCHOOL_CLERK: "School Clerk",
  WELLNESS_OFFICE: "Wellness Office",
  SYSTEM_ADMINISTRATOR: "System Administrator",
};

const {
  REGISTER_TEACHER,
  SUBJECT_TEACHER,
  GRADE_HEAD,
  SCHOOL_CLERK,
  WELLNESS_OFFICE,
  SYSTEM_ADMINISTRATOR,
} = ROLES;

// Which roles may open each page (route guard and sidebar link).
export const PAGE_ROLES = {
  dashboard: [GRADE_HEAD, SCHOOL_CLERK],
  myClass: [REGISTER_TEACHER],
  learners: [REGISTER_TEACHER, GRADE_HEAD, SCHOOL_CLERK, WELLNESS_OFFICE],
  map: [REGISTER_TEACHER, GRADE_HEAD, SCHOOL_CLERK, WELLNESS_OFFICE],
  alerts: [REGISTER_TEACHER, SUBJECT_TEACHER, GRADE_HEAD],
  referrals: [REGISTER_TEACHER, GRADE_HEAD, WELLNESS_OFFICE],
  attendance: [REGISTER_TEACHER, SUBJECT_TEACHER],
  upload: [SCHOOL_CLERK],
  reports: [REGISTER_TEACHER, GRADE_HEAD, SCHOOL_CLERK, WELLNESS_OFFICE],
  scriptAnalysis: [SUBJECT_TEACHER],
  users: [SYSTEM_ADMINISTRATOR],
  auditLog: [SYSTEM_ADMINISTRATOR],
};

// Referrals: the Register Teacher creates (FR12); Grade Head and Wellness
// Office change status and assignment (FR13).
export const REFERRAL_CREATE_ROLES = [REGISTER_TEACHER];
export const REFERRAL_MANAGE_ROLES = [GRADE_HEAD, WELLNESS_OFFICE];

// Where "/" sends a user, first match wins for users with several roles.
export const HOME_BY_ROLE = [
  [GRADE_HEAD, "/dashboard"],
  [WELLNESS_OFFICE, "/referrals"],
  [SCHOOL_CLERK, "/dashboard"],
  [REGISTER_TEACHER, "/my-class"],
  [SUBJECT_TEACHER, "/attendance"],
  [SYSTEM_ADMINISTRATOR, "/users"],
];

export function getUserRoles(user) {
  return Array.isArray(user?.roles) ? user.roles : [];
}

// NFR18: a user gets the combined access of every role they hold.
export function hasAnyRole(user, allowedRoles) {
  const held = getUserRoles(user);
  return allowedRoles.some((role) => held.includes(role));
}

export function getHomePath(user) {
  const match = HOME_BY_ROLE.find(([role]) => hasAnyRole(user, [role]));
  return match ? match[1] : null;
}

export function isForbidden(err) {
  return err?.response?.status === 403;
}
