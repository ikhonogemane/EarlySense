# To do, in order

1. **Gap analysis** (now). Output: `docs/gap-analysis.md`. No code changes.
2. **NEXT: script analysis 404.** Found while testing on 14 October 2026.
3. Fixes from the gap analysis, one change at a time.

## 2. Script analysis 404 (Groq model not found)

- Request: `POST /api/analyse-script/` as an Educator (Thandi Sithole), with a script, question paper and memo PDF (Physical Sciences, Grade 12, Test2, learner_id 922).
- Error: `NotFoundError 404 model_not_found: The model llama-3.3-70b-versatile does not exist or you do not have access to it.`
- Where: `backend/core/views.py`, line 1331, `analyse_script`, call `client.chat.completions.create(...)` using the Groq SDK.
- Not a code bug in the request. The Groq account behind `GROQ_API_KEY` cannot use that model name (retired, renamed, or not enabled for the key or project).

What to do:
1. List the models the key can use (Groq SDK `client.models.list()`), choose a current one, and test with a short prompt.
2. Move the model name into settings (NFR28), not hard-coded in the view.
3. Catch Groq API errors in the view and return a clear message to the screen instead of a Django 500 page.
4. Check the model can read what we send. Scanned or handwritten PDFs need a model that accepts images, or text extraction first.

## Also seen in the same test run (for the gap analysis)

- `DEBUG = True` and `CORS_ALLOW_ALL_ORIGINS = True` (NFR20, NFR25 expect HTTPS, restricted origins).
- `DEFAULT_FROM_EMAIL` is still the placeholder `your-actual-gmail@gmail.com` while the SMTP user is `earlysense.alerts@gmail.com`.
- Script analysis runs inside the web request (NFR06 wants a background job) and the Educator can run it, with no sign of the AI consent check (NFR23, FR03).
- `ALLOWED_HOSTS = ['*']`, no logging configured, no session or token timeout setting visible (FR01, NFR15).
