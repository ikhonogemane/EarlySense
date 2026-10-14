# EarlySense requirements (source of truth)

Copied from the Final Document, Phase 2, Section 2 and Section 3.3.1. Client: Kimberley Boys High School (947 learners, 26 subjects, 221 class groups). Interview with Mr Moilwa, 1 September 2026.

Priorities: **P1** pilot (risk dashboard chain, referrals, user access and audit), **P2** script analysis, E73 sign-off, reports, **P3** geographic view (deferred).

## Roles (six actors)

Register Teacher, Subject Teacher, Grade Head, School Clerk, Wellness Office, System Administrator. A user can hold more than one role, each limited to a grade or class where needed, and gets the combined permissions of all their roles (NFR18). The System Administrator never sees learner data (NFR19).

- **Register Teacher**: mark attendance, log incident, create referral, view learner profile (own class), generate reports.
- **Subject Teacher**: mark attendance, log incident, upload scripts, view script analysis and feedback, record parent and learner sign-off, generate reports (only classes they teach).
- **Grade Head**: view risk dashboard (own grade), view learner profile (own grade), manage referrals, override risk classification, generate reports.
- **School Clerk**: import SASAMS data, view risk dashboard (whole school), view learner profile (any learner), generate reports.
- **Wellness Office**: manage referrals, override risk classification, view learner profile (any learner), generate reports.
- **System Administrator**: manage users and roles, view audit log, record AI consent, generate reports (users and audit only). No learner data.

Sign-in applies to every actor and is not drawn as a use case.

## Functional requirements

| ID | Feature | Actor(s) | Description | Pri. | Source |
|---|---|---|---|---|---|
| FR01 | Sign in and sign out | All six actors | Users sign in with a username and password, are signed out after 30 minutes of inactivity, and can reset a password by email. After sign-in the menu shows only the functions their roles allow. | P1 | Phase 1, 2.4 |
| FR02 | Manage users and roles | System Administrator | Create, edit and deactivate users. Assign one or more roles to a user, each limited to a grade or class where needed. This actor cannot see learner data. | P1 | Phase 1, 2.4, 2.5 |
| FR03 | Audit log and AI consent records | System Administrator | View and filter the audit log (who, what, when). Record AI consent: date of headmaster consent, Mr Moilwa's sign-off and its date. Script analysis stays blocked until an active consent record exists. | P1 | Phase 1, 2.1, 2.3 |
| FR04 | Import SASAMS data | School Clerk | Upload CSV exports of learners, attendance and marks. The system validates each row, saves valid rows, rejects invalid rows with an error report, and keeps an import history. There is no live link to SASAMS. | P1 | Phase 1, 2.2, 2.3 |
| FR05 | Mark attendance | Register Teacher, Subject Teacher | Capture the morning register and each period register for own classes. Correct a mark with the change recorded. One record per learner, date and session. | P1 | Phase 1, 2.2 |
| FR06 | Log incident | Register Teacher, Subject Teacher | Log a behavioural incident once (learner, date, type, description). It is visible at once to authorised roles and is not captured a second time by the clerk. | P1 | Phase 1, 2.2 |
| FR07 | View learner profile | Register Teacher (own class), Grade Head (own grade), Wellness Office, School Clerk | One page per learner showing attendance, marks, incidents, current and past risk level with contributing factors, and referrals with their status. The Register Teacher uses this page, not the school dashboard, for the class. | P1 | Phase 1, 2.3, 2.4 |
| FR08 | Predict learner risk | System (scheduled) | Every night and after each import, classify each learner as Low, Medium or High risk with a confidence and the contributing factors, using a Random Forest. Simple rules (3 or more absent days, a 15% mark drop, 3 or more incidents in a term) also raise a flag. Results below 70% confidence are marked 'needs human review'. | P1 | Phase 1, 2.1, 2.3 |
| FR09 | View risk dashboard | Grade Head, School Clerk | A summary and list of learners by risk level, filterable by grade, class and level, with a link to each profile. The Grade Head sees own grade, the School Clerk sees the whole school. | P1 | Phase 1, 2.1, 2.4 |
| FR10 | Send alerts | System; Register Teacher, Grade Head | When a learner becomes High risk or a rule is met, create an in-app alert, send an email and a push notification to the learner's Register Teacher, and send an in-app alert and push notification to the Grade Head. Record whether each alert was read. | P1 | Phase 1, 2.1, 2.3 |
| FR11 | Override risk classification | Grade Head, Wellness Office | Change a learner's risk level with a written reason. The original level is kept and the override is audited. | P1 | Phase 1, 2.3 |
| FR12 | Create referral | Register Teacher | Refer a learner with a reason category (for example persistent tiredness, poor hygiene, withdrawal from peers, hunger, absenteeism, other), an urgency and a note. The referral starts as Open and the Grade Head is notified. The screen warns staff not to type suicide-related details. | P1 | Phase 1, 2.1, 2.2 |
| FR13 | Manage referrals | Grade Head, Wellness Office | See the referral queue, accept and assign a case, set the status (Open, In Progress, Resolved), add dated notes and a follow-up date, and record an SBST or external outcome. Every change is kept as history. A case with no update for 7 days is flagged Stalled. The Register Teacher sees the status of their own referrals. | P1 | Phase 1, 2.1, 2.2, 2.3 |
| FR14 | Upload scripts | Subject Teacher | Upload scanned scripts (PDF or images) for the pilot subject, link each to a learner and assessment, and tag each sub-question to its Annual Teaching Plan (ATP) topic. The typed question paper and per-sub-question memo are held with the assessment. | P2 | Phase 1, 2.2, 2.3 |
| FR15 | Analyse scripts with AI | System; Subject Teacher | After the consent check, replace learner names with reference codes and send the script to the third-party AI service to read the handwriting and analyse each sub-question. The teacher reviews the result with its confidence, accepts or corrects it, and then sees individual question-level feedback for the learner. | P2 | Phase 1, 2.3, 2.5 |
| FR16 | Record parent and learner sign-off | Subject Teacher | Record that the learner and the parent have seen the individual feedback (who and when). Show E73/2026 completion by subject and class. | P2 | Phase 1, 2.1, 2.3 |
| FR17 | Generate reports | All six actors, each limited to own area | Create reports for the role's own area (attendance, risk summary, referral status and age, E73 completion, import history, user and audit summary for the System Administrator), saved and downloadable as PDF or Excel. | P2 | Phase 1, 2.4 |
| FR18 | Show geographic view | Grade Head, Wellness Office | Show learners' home areas on a map (Leaflet) with their risk level, to see travel distance. Deferred, not in the pilot. Needs home address data, which still has to be confirmed with the school. | P3 | Phase 1, 2.1 |


## Use cases to requirements (Table 7)

| Use case | Actors | Requirement | Priority |
|---|---|---|---|
| Mark attendance | Register Teacher, Subject Teacher | FR05 | P1 |
| Log incident | Register Teacher, Subject Teacher | FR06 | P1 |
| Create referral | Register Teacher | FR12 | P1 |
| Manage referrals | Grade Head, Wellness Office | FR13 | P1 |
| View learner profile | Register Teacher, Grade Head, Wellness Office, School Clerk | FR07 | P1 |
| View risk dashboard | Grade Head, School Clerk | FR09 | P1 |
| Override risk classification | Grade Head, Wellness Office | FR11 | P1 |
| Import SASAMS data | School Clerk | FR04 | P1 |
| Manage users and roles | System Administrator | FR02 | P1 |
| View audit log | System Administrator | FR03 | P1 |
| Record AI consent | System Administrator | FR03 | P1 |
| Upload scripts | Subject Teacher | FR14 | P2 |
| View script analysis and feedback | Subject Teacher | FR15 | P2 |
| Record parent and learner sign-off | Subject Teacher | FR16 | P2 |
| Generate reports | All six actors | FR17 | P2 |


## Non-functional requirements

### Performance

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR01 | The risk dashboard shall load within 3 seconds for a Grade Head viewing a full grade (up to 215 learners, the largest current grade). | Phase 1, 2.1, 2.3 | Design target |
| NFR02 | A SASAMS CSV import of up to 2,000 learner records shall be validated and saved within 60 seconds, and a full risk prediction run for all learners shall finish within 60 seconds. | Phase 1, 2.2, 2.3 | Design target |
| NFR03 | Analysis of one scanned script shall be returned to the teacher within 5 minutes of the job starting, not counting time spent waiting for the AI service when it is unavailable. | Phase 1, 2.3 | Design target |
| NFR04 | Any report shall be generated within 15 seconds. | Phase 1, 2.4 | Design target |
| NFR05 | The system shall support 50 signed-in users at the same time without slowing down, including the first week of Term 3 when E73/2026 review takes place. | Phase 1, 2.1, 2.3 | Client-stated peak, design target figure |
| NFR06 | Prediction, import, script analysis, report generation and alert sending shall run as background jobs so a user's screen is never blocked, and the user shall be able to see the job status. | Phase 1, 2.3 | Design target |

### Reliability

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR07 | AI-assisted script analysis shall have an error rate of no more than 5%, measured against teacher-verified marking of a sample of the school's own marked scripts before go-live. If the rate is higher, the feature stays in pilot and is not relied on. | Phase 1, 2.3 | Client-stated |
| NFR08 | Every AI result (risk level or script analysis) shall show its confidence. Results below 70% confidence shall be marked 'needs human review', and no script analysis shall become final until a teacher accepts or corrects it. | Phase 1, 2.3, 2.5 | Design target (from the client's 5% limit) |
| NFR09 | Imports shall reject invalid rows with an error report that names the row and the reason. Valid rows shall be saved in one transaction, and importing the same file again shall not create duplicate records. | Phase 1, 2.2 | Design target |
| NFR10 | A failed background job shall be retried automatically up to 3 times. The failure and job status shall be recorded and visible to the System Administrator without exposing learner data. | Phase 1, 2.3 | Design target |
| NFR11 | The database shall be backed up every night and a restore shall be tested at least once per term, so that no more than 24 hours of data can be lost. | Phase 1, 2.3 | Design target |

### Availability

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR12 | The system shall be available 99% of the time between 07:00 and 17:00 on school days, when registers, incidents and dashboards are used. | Phase 1, 2.2 | Design target |
| NFR13 | If the AI, email or push service is down, the rest of the system shall keep working: script jobs shall queue and retry, and alerts shall still appear inside the application. | Phase 1, 2.3 | Design target |
| NFR14 | Planned maintenance shall be done outside school hours and not in the first week of a term. After a failure, service shall be restored within 4 hours on a school day. | Phase 1, 2.1 | Design target |

### Security and privacy

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR15 | Every user shall sign in before reaching any function. Sessions shall use short-lived tokens, passwords shall be stored only as salted bcrypt hashes, and an account shall lock for 15 minutes after 5 failed sign-ins. | Phase 1, 2.4 | Design target |
| NFR16 | Access control shall be enforced on the server by one central permission layer used by every endpoint. Anything not explicitly allowed is denied. Hiding a button on screen is never the only protection. | Phase 1, 2.3, 2.4 | Design target |
| NFR17 | Access shall follow the roles in Phase 1, 2.4. A Register Teacher sees only their own class, a Grade Head only their own grade, and a Subject Teacher only the classes they teach. The School Clerk and Wellness Office can open any learner's profile. | Phase 1, 2.3, 2.4 | Client-stated |
| NFR18 | A user may hold more than one role (for example a teacher who is also a Grade Head), each role limited to a grade or class where needed. The user receives the combined permissions of all their roles. | Phase 1, 2.4, 2.5 | Phase 1 decision |
| NFR19 | The System Administrator shall have no access to learner data. The role manages users, roles and consent records and views the audit log only. | Phase 1, 2.4 | Phase 1 decision |
| NFR20 | All traffic shall use HTTPS with HSTS, and the database and uploaded script files shall be encrypted at rest. | Phase 1, 2.3 | Design target |
| NFR21 | An audit log shall record who signed in, viewed a learner profile, changed or overrode a record, imported or exported data, and changed roles or consent. Users cannot edit the log and it shall be kept for at least 12 months. | Phase 1, 2.3 | Design target |
| NFR22 | The system shall never permanently store sensitive information about a learner who has attempted or expressed intent to commit suicide. No field shall exist for it, and referral and incident screens shall warn staff not to type such details. | Phase 1, 2.3 | Client-stated |
| NFR23 | No learner data shall be sent to a third-party AI service until a consent record exists (headmaster consent, then Mr Moilwa's signed sign-off). Learner names shall be replaced by reference codes before anything is sent. | Phase 1, 2.1, 2.2, 2.3 | Client-stated consent chain, reference codes are a design measure |
| NFR24 | Learner data shall be handled in line with the Protection of Personal Information Act 4 of 2013 (POPIA): collect only what is needed, use it only for learner support and compliance, and keep it for a retention period agreed with the school. | Not in Phase 1 | Legal requirement, to be confirmed with the school |
| NFR25 | The system shall defend against common web attacks (OWASP Top 10): inputs validated, database queries parameterised, cross-origin requests limited to the school's own web address, uploads limited by type and size, and sign-in attempts rate-limited. | Phase 1, 2.3 | Design target |

### Maintainability

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR26 | The code shall be divided into the ten application modules in Section 3.2, each with a clear interface, so that one module can be changed without rewriting the others. | Phase 1, 2.5 | Design target |
| NFR27 | Day-to-day support shall be possible for ICT interns. A technical handover guide, an administrator guide and a step-by-step runbook (restart, restore, add a user) shall be delivered. | Phase 1, 2.5 | Client-stated |
| NFR28 | Values that may change (70% confidence level, 7-day stalled-referral limit, alert and risk rules) shall be held in settings, not written into the code. | Phase 1, 2.3 | Design target |
| NFR29 | Automated tests shall cover permission rules, import validation, risk rules and the referral status flow, and shall run before every release. | Phase 1, 2.3 | Design target |

### Portability

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR30 | The system shall be packaged in Docker containers on Ubuntu 22.04 so that it can move between a school server and a low-cost cloud host by changing configuration only. | Phase 1, 2.3 | Design target |
| NFR31 | The system shall work in current versions of Chrome, Edge, Firefox and Safari on school computers and staff phones, with a responsive layout and nothing to install. Push alerts shall use a browser service worker. | Phase 1, 2.1 | Design target |
| NFR32 | Data shall leave the system in open formats (CSV, PDF, Excel) so the school is not locked in. SASAMS data shall enter only as CSV files. | Phase 1, 2.3 | Design target |

### Usability, cost and scope

| ID | Requirement | Source | Basis |
|---|---|---|---|
| NFR33 | The system shall remove double-handling: each fact (attendance, incident, referral) is entered once in EarlySense, and a teacher shall be able to take a register of up to 30 learners in under 2 minutes. | Phase 1, 2.2, 2.3 | Client-stated need, 2 minutes is a design target |
| NFR34 | Hosting for the pilot shall use free or low-cost services, and any recurring cost shall be itemised so it can be motivated to the School Governing Body before 2027. | Phase 1, 2.3 | Client-stated |
| NFR35 | The design shall handle 947 learners, 26 subjects and 221 class groups with headroom to 2,000 learners. The pilot shall be switchable to one grade, and one subject for script analysis, by configuration. | Phase 1, 2.3 | Client-stated scale, 2,000 is a design target |

## Design targets (to be confirmed with Mr Moilwa)

| Target | Value | Requirement |
|---|---|---|
| Availability, 07:00 to 17:00 on school days | 99% | NFR12 |
| Concurrent signed-in users | 50 | NFR05 |
| Dashboard load time | 3 seconds | NFR01 |
| Import and full prediction run | 60 seconds each | NFR02 |
| Script analysis per script | 5 minutes | NFR03 |
| Report generation | 15 seconds | NFR04 |
| Confidence threshold for human review | 70% | NFR08, FR08 |
| Stalled referral | No update for 7 days | FR13 |
| Risk rules | 3 or more absent days, 15% mark drop, 3 or more incidents in a term | FR08 |
| Audit log retention | 12 months | NFR21 |
| Sign-in lock and session timeout | 15 minutes after 5 failures, 30 minutes idle | NFR15, FR01 |
| Learner headroom | 2,000 | NFR35 |


## Open items (do not guess, flag in the gap analysis)

- How marks are captured day to day after a script is marked. Marks enter by SASAMS CSV import first (FR04).
- Whether SBST ever logs in. Treated as outside the system, with the Wellness Office recording its outcome.
- Internet access and scanning facilities at the school.
- Learners' home address data for FR18, and the POPIA retention period (NFR24).
