# EarlySense

AI-driven learner retention system for Kimberley Boys High School (947 learners, 26 subjects, 221 class groups). Final-year project, Sol Plaatje University. Client contact: Mr Moilwa, Deputy Head Master (interview 1 September 2026).

## Source of truth

The documentation in `docs/` is the specification. The code must match it.

- `docs/requirements.md`: roles, FR01 to FR18, NFR01 to NFR35, use cases, design targets, open items.
- `docs/data-model.md`: classes, attributes, constraints.
- `docs/architecture.md`: layers, ten modules, design decisions, external flows.

Where the code and the docs disagree, do not silently change either. List the mismatch and wait for my decision.

## Stack

Django and Django REST Framework (backend), PostgreSQL (`earlysense_db`), React with Vite (frontend), JWT authentication, scikit-learn Random Forest (`ml_model.pkl`), Recharts, Leaflet (deferred, P3), Lucide React icons, ReportLab for PDF reports. Target architecture also uses Redis and Celery for background jobs, and Docker on Ubuntu 22.04. Check which of these exist in the code before assuming.

Local: Django on 127.0.0.1:8000, React on localhost:5173.

## Rules that must not be broken

1. Six roles: Register Teacher, Subject Teacher, Grade Head, School Clerk, Wellness Office, System Administrator. Roles are many-to-many through UserRole with grade and class scope.
2. One central permission layer used by every endpoint. Deny by default. Never rely on hiding a button.
3. The System Administrator never sees learner data.
4. No field for suicide-related information anywhere.
5. No learner data goes to the AI service without an active AIConsent record, and names are replaced by reference codes first.
6. Attendance is unique on (learner, date, session). Marks are unique on (learner, assessment). Re-importing a file must not duplicate rows.
7. A risk override keeps the original level. A referral keeps its history.
8. Thresholds (70% confidence, 7-day stalled referral, risk rules) live in settings, not in code.
9. Never change roles, permissions or migrations without telling me first.

## Known issues from earlier work

- `/api/reports/generate/` returned 404 because of duplicate reportlab imports in `views.py` overwriting `generate_report`. DRF reserves the `format` query parameter: use `file_format` and set `URL_FORMAT_OVERRIDE: None`.
- The built system used four roles (Educator, School Administrator, System Administrator, LST Member) and one role per user. The docs now require six roles and many-to-many.
- Earlier gap list: Educator sees all learners instead of own class; upload responsibilities wrong (School Admin should only import class lists, teachers capture attendance and marks); System Admin can see the dashboard and learner profiles; LST referral view lacks AI risk factors; School Admin has access to Mark Attendance.
- Migration regression once wiped field data. Back up the database before any migration that changes models.

## How I want you to work

- One change at a time. Finish and test one fix before starting the next. Do not bundle changes.
- Give complete files, not partial snippets, when you edit.
- Extend my existing code style. Do not rename or restructure working code.
- Before editing, say which requirement ID the change satisfies.
- After each change, run the app or tests and tell me what you checked.
- One commit per change, with the requirement ID in the message. Work on branch `align-with-docs`.
- Keep explanations short and direct. Explain the operation, how it is used and why.
- No em dashes in any document or text you write.
