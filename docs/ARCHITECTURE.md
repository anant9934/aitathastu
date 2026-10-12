# Architecture

## Components

```
Browser ──> Next.js app (Netlify functions) ──> Postgres (Neon)
                    │
                    └──> Resume extractor (FastAPI on Render): scanned-PDF OCR only
```

- **Next.js app** (`app/`, `components/`, `lib/`): UI, all API routes (`app/api/**/route.ts`),
  business logic in `lib/services`, data access in `lib/repositories`, schema in `lib/db`.
- **Resume extractor** (`services/resume-extractor/`): Python service with PyMuPDF and Tesseract.
  It's separate because OCR needs a native Tesseract binary, a 5 MB language model and tens of
  seconds of CPU, and none of that fits a serverless function (Netlify: 10 s default, 26 s max).
  It is a worker: Postgres stays the source of truth for every document.

### Code layout

| Path | What |
|---|---|
| `app/onboarding`, `components/exact-screens` | Onboarding flow. `ExactScreensContainer.tsx` is the client state machine |
| `app/student`, `components/student`, `components/workspace` | Student workspace |
| `app/faculty`, `app/verification` | Faculty workspace and verification queue |
| `lib/auth` | Sessions, guest accounts, guest merge, OAuth helpers, RBAC |
| `lib/services/resume-*` | CV pipeline (ingestion, profile building, review decisions, Person 360 import) |
| `lib/connectors` | GitHub, LinkedIn export, LeetCode, research/coding platforms |
| `lib/intelligence` | LLM router and providers, prompt defense, cost control |
| `lib/db/migration-sql.ts` | Canonical DDL (the only migrations that run) |
| `middleware.ts` | CSRF origin check for state-changing `/api` requests |
| `netlify/functions` | Scheduled daily maintenance |

## Database (high level)

All per-student data hangs off `persons` (one per `users` row):

- identity: `users`, `sessions`, `persons`, `person_profiles`, `organizations`, `organization_memberships`, `roles`/`capabilities`
- onboarding: `onboarding_drafts` (jsonb draft, merged on every write)
- evidence: `evidence_items` (unique on `(person_id, import_key)`), `verification_requests`/`verification_decisions`
- projects: `projects` (unique on `(person_id, normalized_title)`), `project_contributions`
- CV: `resume_documents` (row + extracted Schema v2 profile + review payload), `resume_document_blobs`, `resume_review_history`, `source_snapshots`
- jobs: `source_processing_jobs`, `sync_runs`
- sources: `external_connections` (status `connected` = OAuth-verified, `detected` = public data for a typed username)

Known gap: several `person_id`/`user_id` columns have no foreign key in the DDL that actually
runs (`migration-sql.ts`), even though `schema.ts` declares one. Account deletion therefore
clears those tables explicitly (`deleteAccountCompletely`).

## Auth model

- Opaque session token in the httpOnly `tathastu_session` cookie, validated against `sessions`.
- **Guests**: a first-time onboarding visitor gets a real user + person on the internal guest
  email domain. This happens in exactly one place, the first `PUT /api/onboarding-v2`, rate limited
  per client IP. Every other route requires an existing session and returns 401 otherwise.
- A guest who sets an email/password is upgraded in place. A guest who signs in (password,
  sign-up or Google) to an existing account has their progress merged into it
  (`lib/auth/guest-merge.ts`): history moves over, duplicates and single-row state keep the
  account's version, then the guest is deleted.
- Abandoned guests (> 7 days, onboarding not completed) are purged daily.
- Roles and verifier rights come from the DB (`can(personId, "student.verify_skill")`), never
  from request bodies or headers. The extractor gets privilege only from which credential is
  presented (`EXTRACTOR_API_TOKEN` = student, `EXTRACTOR_VERIFIER_TOKEN` = verifier), and
  verifier access is scoped by `X-Org-Id`.
- CSRF: `middleware.ts` rejects cross-origin POST/PUT/PATCH/DELETE to `/api` (partner webhooks and cron are exempt; they use HMAC/bearer auth).

## CV pipeline

```
 Browser                      Next.js (Netlify)                              Extractor (Render)
 ───────                      ─────────────────                              ──────────────────
 POST /api/resume/extract ──> validate type/size(4 MB)/magic bytes
                              store blob, resume_documents row (random UUID id)
                              job: queued ─────────────────────────────┐
 <── 202 { jobId, documentId }                                          │
                                                                        │
 GET /api/resume/[id]/status (every 1.5 s) ──> advanceResumeJob():      │
                              claim queued -> processing (conditional UPDATE)
                              pdf.js / mammoth text layer
                              ├─ enough text ──> extract ──> persist ──> review_ready
                              └─ scanned PDF ──> upload + start ─────────────> background OCR
                                                 stage=extract                 (Tesseract)
 GET .../status ───────────> poll extractor status ─────────────────────────> queued/processing/
                              completed: claim stage extract->persist          completed/failed
                              fetch /text + profile, extract, persist ──> review_ready
                              failed: OCR_ENGINE_UNAVAILABLE / OCR_EXTRACTION_ERROR ──> failed
 <── { status, stage, errorCode, message, result? }

 student reviews candidates (checked = confirmed, unchecked = rejected)
 POST /api/resume/[id]/apply { decisions } ──> mark records, import only confirmed into
                                               Person 360 ──> job completed
```

Design points:

- **No detached work.** Each step runs inside an awaited status request and is short.
  A serverless platform kills fire-and-forget promises once the response is sent.
- **Every status write is guarded** (`WHERE status IN (...)`), so a late client "timed out" can't
  overwrite a finished job. Job metadata is merged, never replaced.
- **Specific failures.** Every failure has a code (`OCR_SERVICE_UNREACHABLE`,
  `OCR_ENGINE_UNAVAILABLE`, `NO_CLAIMS_FOUND`, ...) and is logged server-side with its cause.
- **Retry** (`POST /api/resume/[id]/retry`) re-queues the stored blob; the browser keeps the
  previous results until a new extraction succeeds.
- **Refresh-safe.** The draft stores `resumeDocumentId`, and the status response includes the
  review payload, so a reload rebuilds the review.

## Onboarding flow

Screens: name → role → AI/ML direction → ranked purposes → CV upload/review → academic details
(only if the CV left gaps) → digital footprints → analysis/insights/skills → GitHub projects → complete.

- Each step patches the server draft (`PUT /api/onboarding-v2`, jsonb merge). Nothing is
  persisted until the initial draft load succeeds; a failed load shows a retry banner instead of
  overwriting saved progress with defaults.
- Completion (`POST /api/onboarding-v2`) writes profile, goal, evidence (deterministic import
  keys, upserted, so a retry or correction updates rather than duplicates), projects (deduped by
  normalized title or repo URL) and preferences, then marks the draft `completed` last. The Neon
  HTTP driver has no interactive transactions, so completion is designed to be safely retried.
- GitHub: a typed username imports public data as `detected`. "Connect with GitHub" (OAuth)
  upgrades it to `connected`. Imports report partial data (rate-limited/failed repos, truncated lists).
