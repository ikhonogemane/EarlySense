# EarlySense architecture

From the Final Document, Phase 2, Section 3.2.

## Pattern

Layered client-server, three layers, plus a block for background processing.

- **Presentation:** React single-page app built with Vite. Menus change with the user's roles. A service worker receives push alerts. No business rules and no permissions of its own (NFR16).
- **Application:** Django REST Framework API over HTTPS and JSON. Checks the JWT, calls the central permission layer, applies business rules, reads and writes data.
- **Data:** PostgreSQL with JSONB for variable fields (contributing factors, analysis results, report parameters). Encrypted file store for scripts and generated reports. Model store for the trained Random Forest file.
- **Background:** Scheduled jobs (nightly risk recalculation, stalled-referral check, nightly backup) and API requests put tasks on a Redis queue. Celery workers run them. Only workers talk to the AI, email and push services.
- **External services:** SASAMS (CSV upload only, no live link), a third-party AI service, an email service, a push notification service.

## Ten modules (NFR26)

| Module | Responsibility | Requirements |
|---|---|---|
| Users, roles and audit | Sign-in, JWT, users, many-to-many roles with grade and class scope, central permission layer, audit log, AI consent records | FR01, FR02, FR03; NFR15 to NFR21 |
| Data import (SASAMS CSV) | Validate and save CSV exports of learners, classes, attendance, marks; error report; import history | FR04; NFR02, NFR09 |
| Attendance and marks | Registers per day and per period, assessments and marks, class and learner records | FR05; NFR33 |
| Incidents | Single capture of incidents, scoped by role | FR06 |
| Risk prediction | Feature building, Random Forest scoring, rule checks, confidence, overrides, learner profile and dashboard queries | FR07, FR08, FR09, FR11; NFR01, NFR08 |
| Referrals and interventions | Referral creation, queue, status with history, notes, stalled check, SBST outcome | FR12, FR13 |
| Script upload and analysis | Script and assessment storage, consent gate, name replacement, AI calls, teacher review | FR14, FR15; NFR03, NFR07, NFR23 |
| Alerts and notifications | In-app alerts, email, push, read status | FR10; NFR13 |
| Reports | Role-scoped reports as PDF or Excel | FR17; NFR04 |
| E73 sign-off tracking | Parent and learner sign-off, completion by subject and class | FR16 |

## Key design decisions

1. One central permission layer on every endpoint. Anything not explicitly allowed is denied. The System Administrator is kept away from learner data.
2. Slow work in the background so screens stay quick and the system survives an AI, email or push outage.
3. AI calls only from workers, after a consent check and after learner names are replaced by reference codes.
4. SASAMS by CSV only.
5. Relational core, few JSONB fields, unique constraints so re-imports cannot duplicate.
6. Docker containers (Ubuntu 22.04) so the build runs on a school server or a low-cost cloud host.
7. The dashboard reads the latest saved risk per learner instead of recalculating.

## External data flows (context diagram)

| External entity | Data sent to EarlySense | Data sent by EarlySense |
|---|---|---|
| Register Teacher | Registers, incidents, referrals | Alerts, risk level, referral status |
| Subject Teacher | Attendance, incidents, marks, scripts | Script feedback, sign-off status |
| Grade Head | Referral updates, risk overrides | Risk dashboard, alerts |
| School Clerk | SASAMS CSV files, report requests | Import results, reports |
| Wellness Office | Referral updates, outcomes, overrides | Referral queue, learner profiles |
| System Administrator | User and role changes, AI consent records | Audit log |
| SASAMS | CSV exports of learners, attendance, marks (uploaded by the School Clerk) | Nothing. EarlySense never writes to SASAMS |
| Third-party AI service | Transcription and analysis of scripts (with confidence) | Scripts, question papers and memos, with learner names replaced by reference codes |
| Email service | None | Alert emails |
| Push notification service | None | Push alerts |
