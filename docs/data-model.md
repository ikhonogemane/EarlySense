# EarlySense data model (logical level)

From class diagrams 1 to 4 in the Final Document, Phase 2, Section 3.3.4. Keys, indexes and delete rules are finalised in Phase 3. All `...By` and `...Id` fields marked FK User point to User.

## Rules that must hold in the code

- Roles are many-to-many: User, UserRole, Role. UserRole has gradeScope and classScope (both nullable) and UNIQUE (userId, roleId, gradeScope, classScope). One person can be a Register Teacher and a Grade Head (NFR18).
- RiskAssessment keeps the original level, who overrode it and why. An override never erases the model's result (FR11, NFR08).
- A Referral keeps its history. Every change is a ReferralUpdate with fromStatus, toStatus, note, updatedBy, updatedAt. ReferralUpdate cannot exist without its Referral (composition).
- Re-imports cannot duplicate: AttendanceRecord UNIQUE (learnerId, date, session), MarkRecord UNIQUE (learnerId, assessmentId) (NFR09).
- No field for suicide-related information exists anywhere (NFR22).
- A Script has at most one ScriptAnalysis and at most one SignOff (both unique on scriptId).

## Diagram 1: learner records, attendance, incidents, risk and alerts (FR05 to FR10)

| Class | Attributes |
|---|---|
| SchoolClass | id, name, grade, registerTeacherId (FK User) |
| Learner | id, learnerNumber (unique), firstName, lastName, grade, classId (FK), enrolmentStatus, schoolId (FK); getProfile() |
| AttendanceRecord | id, learnerId (FK), date, session (morning / period 1..n), status, capturedBy (FK User); UNIQUE (learnerId, date, session) |
| Incident | id, learnerId (FK), date, type, description, loggedBy (FK User) |
| RiskAssessment | id, learnerId (FK), riskLevel (Low / Medium / High), confidence (decimal), contributingFactors (JSONB), modelVersion, calculatedAt, originalLevel, overriddenBy (FK User), overrideReason; calculate(), override(user, reason) |
| Alert | id, learnerId (FK), alertType, message, recipientId (FK User), channel (in-app / email / push), sentAt, readAt |

Relations: SchoolClass 1 to 0..* Learner. Learner 1 to 0..* AttendanceRecord, Incident, RiskAssessment, Alert.

## Diagram 2: referrals (FR12, FR13)

| Class | Attributes |
|---|---|
| Referral | id, learnerId (FK), createdBy (FK User), reasonCategory, urgency, status (Open / In Progress / Resolved), assignedTo (FK User), followUpDate, resolutionNotes; updateStatus(newStatus, note), isStalled() |
| ReferralUpdate | id, referralId (FK), fromStatus, toStatus, note, updatedBy (FK User), updatedAt |

Relations: Learner 1 to 0..* Referral. Referral 1 composed of 1..* ReferralUpdate.
Stalled is a flag set by a scheduled check: an Open case not accepted, or an In Progress case with no update, for 7 days. A new update clears it. A Resolved case can be reopened with a reason.

## Diagram 3: assessments, marks, scripts, analysis, sign-off (FR14 to FR16)

| Class | Attributes |
|---|---|
| Subject | id, name |
| Assessment | id, subjectId (FK), classId (FK), title, date, totalMarks, atpTopic |
| MarkRecord | id, learnerId (FK), assessmentId (FK), mark (decimal); UNIQUE (learnerId, assessmentId) |
| Script | id, learnerId (FK), assessmentId (FK), filePath, uploadedBy (FK User), uploadedAt |
| ScriptAnalysis | id, scriptId (FK, unique), status, confidence, results (JSONB), reviewedBy (FK User), reviewedAt; analyse(), review(user, corrections) |
| SignOff | id, scriptId (FK, unique), learnerSigned (bool), parentSigned (bool), recordedBy (FK User), recordedAt |

Script analysis job states: Queued, Blocked (no consent), Analysing, Awaiting teacher review (results under 70% flagged), Failed (auto retry up to 3 times), then Accepted or Corrected by the teacher.

## Diagram 4: users, roles, audit, consent, import, reports (FR01 to FR04, FR17)

| Class | Attributes |
|---|---|
| User | id, username (unique), email, passwordHash (bcrypt), isActive, failedLogins, lockedUntil, lastLogin; login(), hasPermission(action, scope) |
| Role | id, name (Register Teacher / Subject Teacher / Grade Head / School Clerk / Wellness Office / System Administrator) |
| UserRole | id, userId (FK), roleId (FK), gradeScope (nullable), classScope (nullable); UNIQUE (userId, roleId, gradeScope, classScope) |
| AuditLog | id, userId (FK), action, entityType, entityId, details (JSONB), timestamp |
| AIConsent | id, headmasterName, headmasterConsentDate, signedOffBy, signedOffDate, enabledBy (FK User), enabledAt, isActive; isEnabled() |
| ImportBatch | id, fileName, uploadedBy (FK User), status, rowsImported, rowsRejected, errorReport (JSONB), createdAt; validate(), commit() |
| Report | id, reportType, parameters (JSONB), format (PDF / Excel), generatedBy (FK User), generatedAt, filePath; generate() |
