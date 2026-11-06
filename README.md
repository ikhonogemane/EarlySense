# EarlySense: AI-Driven Learner Retention System

EarlySense helps a secondary school find learners at risk of dropping out early, and keeps track of the support they are given. It was built for Kimberley Boys High School as the final project for NPRJ740 at Sol Plaatje University (Advanced Diploma in ICT).

**Author:** Ikho Nogemane (202301434)
**Lecturer:** Dr Silas Verkijika
**Submitted version:** tag `v1.0.1`. The full design, testing and evaluation are in the Final Report.

The system runs locally. It is not deployed.

## What it does

- **Import:** a School Clerk imports learners, attendance and marks from SA-SAMS CSV files. Bad rows are rejected with a row number and a reason, and re-importing a file does not create duplicates.
- **Risk scoring:** a Random Forest model (scikit-learn) gives every learner a risk level (Low, Medium or High) from attendance, marks, incidents and home circumstances. Scoring runs after each CSV import of attendance or marks.
- **Alerts:** when a learner's level changes to Medium or High, an alert and an email go to the in-scope Register Teacher, Subject Teacher and Grade Head.
- **Referrals:** a Register Teacher refers a learner, and the Grade Head or Wellness Office manages the case from Open to In Progress to Resolved.
- **AI script analysis:** a Subject Teacher uploads a handwritten script, the question paper and the memo. Gemini reads the handwriting, Groq marks it against the memo and diagnoses each error, and the result can be downloaded as a PDF.
- **Reports and audit:** PDF or CSV reports, and a read-only audit log for the System Administrator.
- **Access control:** six roles (School Clerk, Register Teacher, Subject Teacher, Grade Head, Wellness Office, System Administrator), enforced on the server. Each role only sees the learners in its scope.

## Technology

| Part | Technology |
|---|---|
| Front end | React 19, Vite 8 |
| Back end | Django 6.0, Django REST Framework 3.17, SimpleJWT 5.5 |
| Database | PostgreSQL 18 |
| Risk model | scikit-learn 1.9 (Random Forest) |
| AI services | Gemini (handwriting), Groq (analysis), called from the server |
| Other | Gmail SMTP (alert email), ReportLab (PDF) |

## Repository layout

```
backend/    Django API: core/models.py, views.py, permissions.py, ml_engine.py, tests.py
frontend/   React web application (src/pages, src/services)
docs/       Requirements, data model and architecture notes
```

## Set up and run

You need Git, Python 3.12 or later, Node.js 22 and PostgreSQL 18. The steps below use Windows PowerShell.

```powershell
git clone https://github.com/ikhonogemane/EarlySense.git
cd EarlySense

# create the database once
psql -U postgres -c "CREATE DATABASE earlysense_db;"

# back end
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt
copy .env.example .env
```

Open `backend\.env`, remove the leading `#` from the lines you need and fill in the values (at least `SECRET_KEY` and the database settings). The email and AI keys are optional, and the rest of the system works without them.

```powershell
python manage.py migrate
python manage.py createsuperuser
python create_demo_users.py     # creates the six demo users
python seed_data.py             # optional: 11 sample learners (deletes existing learners first)
python manage.py runserver      # API at http://127.0.0.1:8000/api/
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev                     # open http://localhost:5173 in Chrome or Edge
```

## Demo accounts

Created by `create_demo_users.py`. All use the password `Demo@2026!`. They hold no real data and exist only on the database where the script is run.

| Username | Role | Scope |
|---|---|---|
| demo_admin | System Administrator | Whole school |
| demo_clerk | School Clerk | Whole school |
| demo_register | Register Teacher | Class 9B |
| demo_subject | Subject Teacher | Class 10A |
| demo_gradehead | Grade Head | Grade 9 |
| demo_wellness | Wellness Office | Whole school |

Five failed sign-ins lock an account for 15 minutes. Running `create_demo_users.py` again clears a lockout. Do not edit `demo_gradehead` on the User Management screen, because that screen would remove its Grade Head role.

## Tests

```powershell
cd backend
python manage.py test core
```

The 110 automated tests passed on 6 November 2026 (821 seconds). They use a temporary database and do not change `earlysense_db`.

## Known limitations

The main ones are listed here. The full list is in Section 3.4 of the Final Report.

- The risk model is trained on synthetic data, so its accuracy on real learners is not measured.
- AI script analysis sends the script image to Gemini, has no consent step, and its accuracy has not been measured. It needs an internet connection.
- Saving attendance in the app does not rescore learners. Scores change after the next CSV import.
- The User Management screen cannot assign the Grade Head role.

## About the data

This is a student project. All learner names and records in the demonstration data are synthetic. The 500-learner dataset used in the report was loaded through the Upload Data screen from a CSV file kept outside this repository.
