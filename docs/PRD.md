# Orvelo v2: Product Requirements Document

| | |
|---|---|
| Status | Live in production, v2 hardening |
| Last updated | 2026-11-27 |
| Product | Orvelo (web) |
| Tagline | Your whole semester, in one orbit. |
| Audience of this doc | Engineering, design, and anyone joining the project |

## 1. Problem

AKTU engineering students study from scattered sources: Drive links, scanned notes, old PYQs, and a
syllabus PDF per branch and year. General chatbots do not know the AKTU syllabus, invent subject codes and
credits, and cannot point to the source. Grade rules (SGPA, CGPA, percentage) are easy to get wrong by hand.

## 2. Goal

One place where an AKTU student can find material for their exact branch and semester, ask questions
that are answered from the official syllabus and indexed notes, practice, plan exams, and track grades.

### Success metrics

| Metric | Target |
|---|---|
| Onboarding completion (login to profile saved) | 70% or more |
| Weekly active students who use at least one AI feature | 40% or more |
| Ask your Syllabus answers marked grounded (with sources) | 90% or more |
| AI request error rate (5xx, not counting 429) | under 2% |
| p95 time to first streamed token on `/api/ask` | under 3 s |

### Non-goals (v2)

- Native mobile app (a Kotlin app is planned separately).
- Payments or paid tiers.
- Universities other than AKTU.
- Real-time collaboration between students.

## 3. Users

| User | Need |
|---|---|
| Student (primary) | Material for their semester, quick doubt help, exam plan, grade tracking |
| Admin | Add resources, index documents, review student uploads, see usage |
| Guest | Understand the product and sign in |

## 4. Features and requirements

Priority: **P0** must work for launch, **P1** important, **P2** nice to have.

### 4.1 Auth and onboarding (P0)

- Sign in with Google (Passport). Session is an HttpOnly HS256 JWT cookie, 7 days.
- Admin login with username and password, and admin role by email allow-list (`ADMIN_EMAILS`).
- Guests can only open public pages (`/`, `/login`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`).
- After login, a student must finish onboarding before the dashboard.
- Onboarding can parse an AKTU One View result PDF to fill branch, semester, batch, and past SGPAs.
- Redirect targets (`next`) must be local paths only. No open redirects.

### 4.2 Dashboard (P0)

- Shows profile, saved plans, quizzes, doubts, and progress.
- Saved items can be deleted and checklist progress saved.

### 4.3 Ask your Syllabus (P0)

- Student picks branch and year. The official syllabus PDF is indexed on first use.
- Answers stream token by token and list the source pages.
- If the syllabus is not indexed yet, return `409` with status, not a made-up answer.
- Questions that mention a subject code that is not indexed are rejected before any LLM call.

### 4.4 Vac, the study agent (P0)

- Chat agent with tools: syllabus lookup, material search, SGPA and CGPA tools, quiz, study plan,
  resources, university info, progress, page navigation, and long-term memory (remember, forget).
- Students can see, edit, pin, and delete what Vac remembers (max 50 memories).
- Students can turn off chat history in settings.

### 4.5 Doubt solver (P1)

- Text and/or photo of a question. Returns a worked answer.

### 4.6 Quiz (P1)

- Generate 3 to 15 MCQs for a subject and unit, at easy, medium, or hard.
- Submit gives a score, explanations, and weak topics. Attempts are saved.

### 4.7 Study planner (P0)

- Input: subjects with exam dates and confidence, weekday and weekend hours, off days.
- A deterministic scheduler decides minutes per subject per day. AI only writes topics.
- Hard rules: never exceed the hours for a day, never schedule a subject on or after its exam,
  final revision the day before each exam, at most 3 subjects a day.
- Tasks can be marked done or skipped, and the rest of the plan can be re-planned.
- If the AI fails, the plan still saves with built-in topics.

### 4.8 Grades (P0)

- SGPA from marks and credits using the AKTU scale (A+ 10 down to F 0).
- CGPA as the average of semester SGPAs. Percentage = (CGPA - 0.75) x 10.
- Required SGPA per remaining semester to hit a target CGPA.

### 4.9 Resources and uploads (P1)

- Browse notes, PYQs, lectures by year, semester, branch, and search.
- Save resources. Global search from the command palette.
- Students upload PDFs or images (with consent). Text is extracted, then the upload waits for admin review.
  Approved uploads are indexed for RAG.

### 4.10 Admin (P1)

- Stats, resource CRUD, document indexing, upload review, syllabus indexing.

### 4.11 Account and privacy (P0)

- Export all my data as JSON. Delete my account (confirm by typing the email). Clear chat history.

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Every API checks the session itself. Admin APIs check role. Secrets only on the server. Zod on every input. |
| Abuse | Per-user rate limits on all AI and write routes (see OpenAPI `x-rate-limit`). |
| Errors | All APIs return `{ error }` JSON. Internal errors are never shown to the user. |
| Resilience | LLM provider falls back (NVIDIA to Gemini). OCR falls back when the ML service is down. |
| Performance | AI routes stream where answers are long. Max function duration 60 s (300 s for indexing). |
| Accessibility | WCAG 2.1 AA colors in both themes (see `docs/color-palette.md`). All actions reachable by keyboard. |
| Privacy | Data export and delete available to every student. No third-party trackers. |

## 6. Architecture (short)

- Next.js 16 App Router on Vercel. Route handlers in `src/app/api`. Auth guard in `src/proxy.ts`.
- Supabase Postgres for all data (server-side secret key, queries scoped by user id in code).
- Pinecone for vectors. Embeddings from NVIDIA (default) or Gemini, one namespace per provider.
- LangChain for the agent and model wrappers.
- Separate FastAPI ML service for OCR, PDF text, and indexing.

Full API contract: [`docs/openapi.yaml`](openapi.yaml).

## 7. Release and quality

- CI on every push and PR: typecheck, unit tests, AKTU parser check, production build.
- CD: merge to `main` deploys to Vercel production after CI passes.
- Unit tests cover grades, session, auth guard, rate limits, API errors, scheduler, and helpers.

## 8. Known risks and open items

| Risk | Impact | Plan |
|---|---|---|
| Rate limiter is in-memory per instance | Limits are looser across many Vercel instances | Move to a shared store (Redis / Upstash) |
| LLM free-tier quotas | 429s at peak | Provider fallback exists; add queue or paid tier if usage grows |
| API routes have no integration tests | Regressions in DB queries reach prod | Add tests against a Supabase branch or local stack |
| Syllabus PDF format changes | Parser and indexing break | Fixture-based parser check in CI |
