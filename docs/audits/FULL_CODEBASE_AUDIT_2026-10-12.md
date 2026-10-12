# AI Tathastu — Full Codebase Audit (report only, no fixes applied)

- **Audit date:** 2026-10-12
- **Branch audited:** `main` @ `a438d02` (clean working tree). The unmerged branch `origin/feat/netlify-migration` @ `ccd637a` was also diffed because it holds all Netlify-specific code.
- **Method:** static reading of the code, git history and branch diffs. **Nothing was executed.** `node_modules` is not installed in this checkout, so `tsc`, `eslint`, `next build` and the test scripts were **not run**. Every finding below cites a file and line. Findings are tagged **CONFIRMED** (the code path proves it) or **LIKELY / VERIFY** (strong evidence, but runtime or platform confirmation is needed).
- **Finding IDs** (e.g. `OCR-1`, `SEC-4`) are used in the prioritized fix list in §10.

---

## Table of contents
1. Project overview
2. Dead code
3. Bloated / redundant code
4. Security bugs
5. Scalability issues
6. Functional / feature bugs (OCR on Netlify, draft→account merge, CV job state machine)
7. UI bugs
8. Other issues (config, deploy, docs, types)
9. Manual test results (feature checklist)
10. Prioritized fix list

---

## 1. PROJECT OVERVIEW

### 1.1 What it does
A student career and learning platform. The flow is: public ecosystem landing (`/`) → EORA-guided onboarding (`/onboarding`, about 12 screens: role → AI/ML direction → ranked purposes → CV upload/extraction → academic details → digital footprints → analysis → profile insights → skills map → GitHub projects → complete) → adaptive student workspace (`/student`) with modules (Person 360, Projects, Skills, Journey, Assessments, Interviews, Roadmap, Connections). There is also a faculty workspace (`/faculty`, `/faculty/verification`) and an EORA AI companion that floats on every page.

### 1.2 Tech stack (versions from `package-lock.json`)
| Layer | Tech |
|---|---|
| Framework | Next.js **15.5.27** (App Router), React **19.3.0**, TypeScript 5.9 |
| Styling | Tailwind CSS 4.1 plus about 8.5k lines of hand-written global CSS (`app/*.css`, `components/**/*.css`), lots of inline `style={{}}` |
| DB | PostgreSQL via Drizzle ORM 0.45.3. Three drivers in `lib/db/index.ts`: Neon HTTP (`@neondatabase/serverless`), `postgres` TCP, embedded PGlite (dev) |
| Auth | Custom: bcryptjs password hashes, opaque session tokens in the `sessions` table, cookie `tathastu_session` (`lib/auth/session.ts`). Google OIDC and GitHub OAuth routes |
| CV parsing (in-process) | `pdfjs-dist` **5.4.296** (transitive via `pdf-parse` 2.4.5, **not declared** in package.json), `@napi-rs/canvas` 0.1.80 (native), `tesseract.js` **7.0.0** + `tesseract.js-core` 7.0.0 (WASM, transitive), `mammoth` 1.13 (DOCX). Bundled model `eng.traineddata` (5.2 MB) at repo root |
| CV parsing (external) | Python FastAPI service `services/resume-extractor/` (PyMuPDF, pytesseract/Tesseract 5, OpenCV) deployed as Render Docker web service (`render.yaml`) |
| AI | Multi-provider key pool (Gemini, Groq, OpenRouter, Cerebras, Mistral, SambaNova) in `lib/intelligence/*` with deterministic fallback |
| Tests | Custom `node --import tsx scripts/*.ts` scripts (no jest/vitest). Python pytest for the extractor |

### 1.3 Architecture and folders
```
app/                     Next App Router pages + 79 API route handlers (app/api/**/route.ts)
  api/auth/*             sign-in, sign-up, sign-out, session, google/*, github/*
  api/resume/*           extract (main pipeline), preflight, upload, signed-upload, [id]/{status,retry,review,apply,export}
  api/onboarding-v2/*    draft read/write/complete, github import
  api/student/*          dashboard, person-360, projects, skills, evidence, goal, connections, footprints, ...
  api/integrations/*     partner webhooks (study-lpu, padho-code, eris, mentormaze, ai-interview, github)
  api/cron, api/debug, api/internal, api/health, api/ready
components/exact-screens Onboarding screens (Screen1..12, ExactScreensContainer = state machine)
components/student       Workspace views
components/workspace     AdaptiveWorkspace (purpose-driven dashboard)
components/eora          EORA companion
lib/db                   schema.ts (44 tables), migration-sql.ts (runtime DDL), migrations/ (stale drizzle-kit output)
lib/services             business logic (resume, github, onboarding, dashboard, ...)
lib/repositories         data access
lib/connectors           GitHub, LinkedIn, LeetCode, portfolio, research (HF/ORCID/dev.to/Kaggle/SO), coding platforms
lib/intelligence         LLM router, providers, cost control, prompt defense
lib/security             rate-limit, csrf (unused), ssrf (unused), sanitize (unused), ingestion gate, secrets audit
services/resume-extractor  Python FastAPI OCR/extraction service (Render)
scripts/                 ~60 verification/benchmark scripts
docs/                    ~80 "certification"/report markdown files
```

### 1.4 Entry points
- Web: `app/layout.tsx` (wraps everything in `EoraProvider` + `EoraFloatingCompanion`), `app/page.tsx` (landing), `app/start/page.tsx` (post-login router), `app/onboarding/page.tsx`, `app/student/layout.tsx` (server guard), `app/faculty/page.tsx`.
- Server bootstrap: `lib/db/index.ts#getDb()` lazily connects and **runs DDL at runtime** when tables are missing.
- Python service: `services/resume-extractor/app/main.py` (uvicorn, `Dockerfile`).
- Netlify (branch only): `netlify/functions/ocr-background.mts`, `netlify/functions/cleanup-stuck-syncs.mts`.

### 1.5 External services and env vars
Names in the local `.env` (values not read): `DATABASE_URL, APP_BASE_URL, NODE_ENV, DATABASE_AUTO_MIGRATE, HANDOFF_SIGNING_SECRET, SESSION_SECRET, EXTERNAL_TOKEN_ENCRYPTION_KEY, CORE_INGESTION_SECURITY_APPROVED, OCR_INTERNAL_SECRET, CRON_SECRET, GOOGLE_CLIENT_ID/SECRET, ENABLE_GITHUB_LIVE, GITHUB_CLIENT_ID/SECRET, GITHUB_WEBHOOK_SECRET, REDIS_URL, PILOT_MODE, INVITE_CODE_REQUIRED, PILOT_INVITE_CODES, ENABLE_*_LIVE, ENABLE_LLM_EORA, CORE_DISABLE_LIVE_LLM, CLOUD_AI_*, {GROQ,CEREBRAS,GEMINI,OPENROUTER,MISTRAL,SAMBANOVA}_API_KEY(S), RESUME_EXTRACTOR_URL, EXTRACTOR_API_TOKEN, NEXT_PUBLIC_RENDER_EXTRACTOR_URL`.

| Service | Env vars actually read by code | Notes |
|---|---|---|
| Postgres/Neon | `DATABASE_URL`, `DATABASE_MODE`, `DATABASE_TRANSPORT`, `DATABASE_AUTO_MIGRATE` (default **true** unless `"false"`), `PGLITE_*` | `lib/db/index.ts:30-38` |
| Session/CV ingestion gate | `CORE_INGESTION_SECURITY_APPROVED=true` **and** `SESSION_SECRET`, `HANDOFF_SIGNING_SECRET`, `GITHUB_WEBHOOK_SECRET`, `EXTERNAL_TOKEN_ENCRYPTION_KEY` each ≥32 chars | `lib/security/core-ingestion-gate.ts:7-16`. **If any one is missing in production, all CV uploads and GitHub imports return 503.** `SESSION_SECRET` is otherwise unused (sessions are opaque DB tokens) |
| Render OCR service | `RESUME_EXTRACTOR_URL` / `RESUME_EXTRACTOR_SERVICE_URL` / `NEXT_PUBLIC_RESUME_EXTRACTOR_URL`; `EXTRACTOR_API_TOKEN` / `RESUME_EXTRACTOR_SERVICE_API_KEY` / `RESUME_EXTRACTOR_SERVICE_SECRET`; `NEXT_PUBLIC_RENDER_EXTRACTOR_URL` | `lib/services/extractor-service-client.ts:104-120`, `app/api/resume/signed-upload/route.ts:26` |
| Netlify OCR background fn (branch) | `OCR_INTERNAL_SECRET`, `NETLIFY`, `NETLIFY_CONTEXT`, `URL`, `DEPLOY_URL` | branch only |
| Google OAuth | `GOOGLE_CLIENT_ID/SECRET` | redirect URI built from the request **Host** header (`lib/auth/origin.ts:11-18`) |
| GitHub | `GITHUB_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN` (**missing from .env and .env.example**, so all API calls are unauthenticated at 60 req/h) | `lib/connectors/github/client.ts:410` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `.env` defines **`REDIS_URL`**, which no code reads, so the limiter is always in-memory per instance (`lib/security/rate-limit.ts:212-224`) |
| Cron | `CRON_SECRET` | `app/api/cron/cleanup-stuck-syncs/route.ts:22` |
| LLM providers | `*_API_KEY(S)`, `CLOUD_AI_*`, `ENABLE_LLM_EORA`, `CORE_DISABLE_LIVE_LLM` | `lib/intelligence/providers/*` |
| Partner apps | `INTEGRATION_*_SECRET`, `ENABLE_*_LIVE` | |
| LinkedIn | none; reference URL only (no API; `lib/connectors/linkedin/client.ts:5-9` says so) | |

---

## 2. DEAD CODE

### 2.1 Unreferenced files (never imported by `app/`, `lib/` or `components/`). CONFIRMED by import-graph scan
| File | Notes |
|---|---|
| `components/eora/eora-avatar.tsx` | superseded by `eora-motion-avatar.tsx` |
| `components/student/student-home-view.tsx` (204 lines) | `/student` uses `AdaptiveWorkspace` instead |
| `lib/connectors/github/permissions.ts` | scripts only |
| `lib/domain/provenance.ts` | scripts only |
| `lib/eora/actions.ts` | scripts only |
| `lib/intelligence/orchestrator.ts`, `lib/intelligence/engines/eora-explainer.ts`, `lib/intelligence/tool-executor.ts`, `lib/intelligence/providers/registry.ts` | whole "orchestrator/tool executor" layer unused by runtime (chat uses `router.ts` directly) |
| `lib/jobs/queue.ts` | `BackgroundJobQueue` never used. Jobs are synchronous |
| `lib/monitoring/operational-status.ts` | unused |
| `lib/security/csrf.ts` (`verifySameOrigin`) | **never called**, so there is no CSRF/origin check anywhere (see SEC-14) |
| `lib/security/sanitize.ts`, `lib/security/ssrf.ts` | unused; the portfolio connector has its own SSRF guard |
| `lib/services/extraction-benchmark.ts` (650 lines), `lib/services/frozen-evaluation-benchmark.ts` (722 lines) | benchmark datasets compiled into `lib/`; scripts only. Move to `scripts/` |
| `lib/onboarding.ts` (v1) and `lib/domain/migrate.ts` | legacy localStorage onboarding v1, used only by the import-continuity modal |

### 2.2 Unused API routes (no caller in the UI). CONFIRMED by grep of `fetch("/api/...")`
- `app/api/resume/upload/route.ts`: stores the blob and uploads to Render; the UI never calls it.
- `app/api/resume/signed-upload/route.ts`: the direct-to-Render signed upload flow is never used.
- `app/api/resume/[id]/status/route.ts`: **no polling exists in the UI.** The "real status states" never reach the user (see FUNC-CV-1).
- `app/api/resume/[id]/retry/route.ts`: only forwards to Render.
- `app/api/resume/[id]/review/route.ts`: unused by the UI but still reachable, and exploitable (SEC-3).
- `app/api/auth/github/start` + `callback`: no UI link anywhere (`grep auth/github components app` returns nothing), so GitHub is never actually *connected* via OAuth (FUNC-FP-1).
- `app/api/student/{activity,feedback,handoff,person-graph,readiness,projects/candidates}`: no UI caller.
- `app/api/debug/extractor-config/route.ts`: debug route left in production (SEC-9).
- `app/screens/page.tsx` + `components/exact-screens/ScreensGallery.tsx`: the public mock gallery with hard-coded persona "Rahul Sharma" is shipped to production.
- `components/exact-screens/Screen12StudentDashboard.tsx` (**2,430 lines**): rendered only at `ExactScreensContainer.tsx:1179` when `currentScreen === 12`, which the real flow never reaches (finish goes to `window.location.assign("/student")` at `:351`). Gallery-only code.
- `app/verification/page.tsx` vs `app/faculty/verification/page.tsx` (the latter is a one-line re-export). One of them is redundant.

### 2.3 Unused exports / functions (declared, zero references anywhere including own file). CONFIRMED
`lib/services/extractor-service-client.ts:95` `b64UrlDecode`; `lib/services/document-parser-service.ts` `renderPdfPagesToImages`; `lib/repositories/evidence-repository.ts` `upsertEvidenceItems`; `lib/repositories/journey-repository.ts` `upsertJourneyEvents`; `lib/repositories/user-repository.ts` `findUserById`; `lib/repositories/verification-repository.ts` `getVerificationRequestsForEvidence`; `lib/repositories/integration-repository.ts` `createIntegrationCredential`, `createIdentityLink`, `getIdentityLinksByPersonId`; `lib/security/connection-token.ts` `reencryptConnectionToken`; `lib/security/production-secrets.ts` `generateSecureSecret`; `lib/security/rate-limit.ts` `setRateLimiterBackend`, `getRateLimiterBackend`, `resetRateLimits`; `lib/services/resume-extraction-service.ts` `buildDeterministicExtraction`, `groundResumeInterpretation`; `lib/onboarding-step-registry.ts` `getStepByScreenIndex`, `getScreenIndexByStepNumber`; `lib/onboarding-v2.ts` `stageConfig`, `previousStage`, `startingPicture`; `lib/acquisition/acquisition-service.ts` `deduplicateProjects`, `acquireGitHubDataForPerson`; `lib/connectors/registry.ts` (whole file's exports); `lib/domain/goal.ts` `updateGoal`, `isPresetGoal`; `lib/domain/recommendations.ts` four `generate*Recommendations`; `lib/domain/readiness.ts` `READINESS_POLICIES`, `getReadinessPolicyForGoal`, `evaluateDimensionStrength`; `lib/domain/integrations.ts` `computeContinuationActions`, `computeLearningMonitor`; `lib/domain/meaningful-change.ts` `detectMeaningfulChanges`; `lib/db/schema.ts` `eventParticipants` (table defined, never queried); `lib/intelligence/schemas.ts` five Zod schemas; `lib/intelligence/cost-control.ts` `estimateCostUsd`, `resetAiUsage`; `lib/logger.ts` `generateCorrelationId`. (Full list: run `grep -rlw <name>`. Several others such as `fetchGitHubUserRepos` are only used inside their own file and need not be exported.)

### 2.4 Unreachable / dead paths
- `lib/services/resume-person360-mapper.ts:96-97`: `verifiedCategories.has("education:institution")` / `"education:degree"` can never be true. The set is built from `` `${category}:${subject.toLowerCase()}` `` (`:66`), and `subject` is an institution *name*, never the literal string `institution`. The "skip verified fields" protection is dead code.
- `lib/services/source-processing-job-service.ts:130`: the `"retry"` status is unreachable from `/api/resume/extract` because `fail()` always passes `status: "failed"` (`app/api/resume/extract/route.ts:65`).
- `app/api/resume/extract/route.ts:121-127`: the job is reused only if `status === "running"`; there is no other path.
- `lib/services/document-parser-service.ts` (branch): `"/opt/build/repo"` candidate paths only exist at Netlify **build** time, not at function runtime.
- `app/api/integrations/{study-lpu,padho-code,mentormaze}/route.ts`: re-export the `events` POST (duplicate URL for the same handler).
- `lib/db/migrations/*.sql` + `drizzle.config.ts`: stale drizzle-kit output. It lacks 9 tables that exist in `schema.ts` (`intelligence_artifacts, person_profile_versions, resume_document_blobs, resume_documents, resume_review_history, roadmap_milestones, source_conflicts, source_processing_jobs`). Real DDL lives in `lib/db/migration-sql.ts`.

---

## 3. BLOATED / REDUNDANT CODE

| ID | Location | Problem |
|---|---|---|
| BLOAT-1 | `app/api/resume/extract/route.ts:457-700` | ~245 lines of hand-built "Schema v2" JSON with copy-pasted field objects (`value/original_value/confidence/.../history`). Needs one `field(value, conf, section, snippet)` helper. The same mapping exists in reverse at `:276-338` (Render profile → candidates) |
| BLOAT-2 | `app/api/resume/extract/route.ts:231-405` vs `:408-775` | Two near-duplicate extraction pipelines (Render branch vs local branch) with different persistence. The Render branch skips the `resumeDocuments` profile update and the session-cookie attach; the local branch does both. Divergence causes bugs (FUNC-CV-5, SEC-12) |
| BLOAT-3 | `app/api/onboarding-v2/route.ts:15-74` vs `:76-134` | PUT and POST duplicate guest creation, the email/password upgrade block and cookie setting nearly line-for-line |
| BLOAT-4 | Cookie-setting boilerplate | `if (authRes.sessionCookieToSet) response.cookies.set(...)` repeated in 6+ routes; the onboarding route builds the cookie options a third way |
| BLOAT-5 | `lib/services/onboarding-v2-service.ts:202-374` | Six near-identical loops with `(x as any).field` casts calling `add(...)`; `importKey` slugging `toLowerCase().replace(/[^a-z0-9]+/g,"_")` repeated about 12 times |
| BLOAT-6 | `lib/services/document-parser-service.ts` (1,720 lines) | Four text-extraction tiers (pdf.js layout engine, zlib stream extractor, pdf-parse, OCR) plus a scale-2.5 OCR retry. pdf-parse wraps the same pdf.js. pdf.js document load happens up to 3 times per OCR'd PDF (`extractTextWithPdfJs`, `renderPdfPagesWithMetadata`, then once more per low-density page at `:1209`) |
| BLOAT-7 | Two OCR engines + two parsers | In-process Node (pdf.js + tesseract.js) **and** Python service (PyMuPDF + Tesseract) do the same job with different schemas. Plus `ExtractorServiceClient` routes ([id]/status, retry, review, export) that only work for Render-created docs |
| BLOAT-8 | Two migration systems | `lib/db/migration-sql.ts` (runtime DDL) and `lib/db/migrations/*` (drizzle-kit) disagree; `scripts/migrate.ts` re-implements `getDb()` Neon detection |
| BLOAT-9 | Three rate-limit entry points | `checkRateLimit` (sync), `checkRateLimitDistributed` (async), plus `cost-control.ts`'s own in-memory per-user quota Map |
| BLOAT-10 | `lib/security/csrf.ts`, `sanitize.ts`, `ssrf.ts` | Unused abstractions duplicated elsewhere (`connectors/portfolio/client.ts` SSRF, `intelligence/prompt-defense.ts`, `context-firewall.ts`) |
| BLOAT-11 | Giant single-line JSX | `app/faculty/page.tsx:10` (entire data-loading effect on one 900-char line), `components/exact-screens/Screen3aPriorities.tsx:23-33`, `components/workspace/AdaptiveWorkspace.tsx:58-91`, `lib/services/onboarding-v2-service.ts:85`. Unreviewable |
| BLOAT-12 | Global CSS | `app/layout.tsx:2-7` imports 6 global stylesheets (~8.5k lines total: `exact-screens.css` 2,585, `student-workspace.css` 2,216, ...) on **every** route including landing and sign-in |
| BLOAT-13 | `components/exact-screens/*` sizes | `Screen8ProfileInsights.tsx` 2,685, `Screen12StudentDashboard.tsx` 2,430, `student-projects-view.tsx` 2,214, `Screen6DigitalFootprints.tsx` 1,538, `Screen9SkillsMap.tsx` 1,478, `ExactScreensContainer.tsx` 1,245 lines. The container owns about 30 `useState`s and inline handlers for every screen |
| BLOAT-14 | `docs/` | ~80 "certification" reports (e.g. `CORE_V3_6_REAL_WORLD_CERTIFICATION_REPORT.md`) asserting PASS for flows that are currently broken. Misleading; candidates for archive |
| BLOAT-15 | `package.json` scripts | ~45 one-off `test:core-vX-Y` / `test:eora-phaseN` scripts; `npm test` runs only `scripts/test-core-v3.ts` |

---

## 4. SECURITY BUGS

### SEC-1 (CRITICAL, CONFIRMED). Cross-tenant overwrite of resume documents: the document ID is the SHA-256 of the file bytes
- `app/api/resume/extract/route.ts:188`: `const documentId = crypto.createHash("sha256").update(bytes).digest("hex");`
- `lib/storage/object-storage.ts:49-63`: blob `insert ... onConflictDoUpdate({ target: resumeDocumentBlobs.id, set: { payloadBase64, mimeType } })` does not check `personId`.
- `lib/storage/object-storage.ts:67-91`: `resumeDocuments` upsert on `id` keeps the **first uploader's** `personId`.
- `app/api/resume/extract/route.ts:702-711`: `db.update(resumeDocuments).set({ extractedProfile, metadata, status }).where(eq(resumeDocuments.id, documentId))` has **no personId filter**, and errors are swallowed with `.catch(() => null)`.
- **Scenario:** student A uploads `cv.pdf`. Student B (or an attacker who has a copy of the same file, e.g. a shared template CV) uploads the identical bytes. B's request overwrites A's `extracted_profile` row while A remains owner. B's own `/api/resume/{id}` and `/apply` then 404 because the row belongs to A, so B's import silently fails even though B saw "completed". Ownership of shared templates goes to whoever uploaded first.
- **Fix direction:** make document IDs random (UUID) and keep the sha256 only as `checksum`; scope every update by `(id, personId)`.

### SEC-2 (CRITICAL, CONFIRMED). Unlimited anonymous account + session creation (DB/CPU DoS, rate-limit bypass)
- `lib/auth/server-session.ts:38-84`: `getOrCreateOnboardingAuthContext()` creates a **user + person + profile + prefs + membership + session row and a bcrypt hash** for *every* cookieless request.
- It is called by GET routes that should be read-only: `app/api/resume/[id]/route.ts:18`, `[id]/status/route.ts:16`, `[id]/export/route.ts:16`, plus `retry`, `review`, `apply`, `upload`, `signed-upload`, `extract`, `processing-jobs` POST/PATCH, and `onboarding-v2` PUT/POST.
- Rate limiting is keyed on the new `personId` (`app/api/resume/extract/route.ts:107`), so every cookieless request gets a fresh bucket and **limits never apply to anonymous callers**.
- `curl` in a loop against `/api/resume/x/status` grows `users/persons/sessions` without bound. No guest TTL or cleanup job exists (the cron only fixes sync runs and jobs).

### SEC-3 (CRITICAL, CONFIRMED). Client can self-grant the "verifier" role on the Render extractor
- `app/api/resume/[id]/review/route.ts:31`: `const role = body.reviewer_role === "verifier" ? "verifier" : "student";`. The role comes from the **request body**. The check at `:32` only blocks `verify` when `role !== "verifier"`, which the attacker controls.
- `lib/services/extractor-service-client.ts:151-158` forwards it as `X-User-Role: verifier` with the shared service token.
- `services/resume-extractor/app/auth.py:91`: `effective_role = ... x_user_role if x_user_role in ('verifier','admin')`. The service trusts the header. `auth.py:113-117`: verifiers bypass owner checks (`check_document_access` returns early unless both org ids are set, and Next never sends `X-Org-Id`).
- **Impact:** any student (or anonymous guest, see SEC-2) can mark their own claims `independently_verified` and can review or alter **any other user's Render document** if they know its UUID. `resume_review_history` records `actor: "verifier"` (`:55`).

### SEC-4 (HIGH, CONFIRMED). Pre-account-takeover via unverified email claim in onboarding, then Google sign-in links by email
- `app/api/onboarding-v2/route.ts:32-51` (PUT) and `:93-110` (POST): a guest can set **any** unregistered email and password (≥6 chars) with no email verification.
- `app/api/auth/google/callback/route.ts:90-118`: if a user with that email exists, Google sign-in **logs into that existing account** (`userId = existingUser.id`), with no check that the account was created via Google or verified.
- **Scenario:** attacker onboards as `victim@gmail.com` with a password they know. The victim later clicks "Continue with Google" and lands in the attacker-owned account. Everything the victim enters (CV, profile) is readable by the attacker, who still has the password.
- Also: the onboarding route bypasses the pilot invite gate that `sign-up` enforces (`app/api/auth/sign-up/route.ts:249-255`), so `INVITE_CODE_REQUIRED=true` is ineffective.

### SEC-5 (HIGH, CONFIRMED). Session not rotated on guest→account upgrade or login; session tokens stored in plaintext
- `app/api/onboarding-v2/route.ts:38-48`: upgrades credentials in place and keeps the same guest session token (session fixation).
- `lib/auth/session.ts:111-120`: the raw token is stored in `sessions.token` and looked up directly (`:144`). A DB read leak equals session hijack. Store `sha256(token)` instead.
- `app/api/auth/sign-in/route.ts`: does not invalidate the existing guest session cookie or merge guest data (FUNC-OB-3).

### SEC-6 (HIGH, CONFIRMED). Rate limiting is per-instance memory; keys are spoofable
- `.env` has `REDIS_URL`, but the code reads `UPSTASH_REDIS_REST_URL/TOKEN` (`lib/security/rate-limit.ts:213-214`), so the limiter is always `MemoryRateLimiter`. On serverless (Vercel/Netlify) each instance has its own Map, so limits are effectively absent.
- `app/api/auth/sign-in/route.ts:338-339` and `sign-up:239-240`: the key is `email || x-forwarded-for`, so the attacker chooses the key. Brute force across many emails is unlimited. `x-forwarded-for` is the full comma list (spoofable prefix).
- `lib/intelligence/cost-control.ts:19`: the LLM per-user daily quota is also an in-memory Map, so it is not enforced across instances (cost exposure).

### SEC-7 (HIGH, CONFIRMED). Host-header trust in canonical origin / OAuth redirect
- `lib/auth/origin.ts:11-18`: `x-forwarded-host || host` takes precedence over `APP_BASE_URL`. Used for the OAuth `redirect_uri` and all post-login redirects (`app/api/auth/google/callback/route.ts:15`, `:149`). A forged `Host` produces redirects to attacker domains (open redirect / cache poisoning). On Netlify branch or preview deploys it also produces redirect URIs that are not registered with Google, so Google sign-in breaks on those hosts.

### SEC-8 (HIGH, CONFIRMED). Known default secret fallback for extractor tokens
- `lib/services/extractor-service-client.ts:114-120`: `|| "development-only-change-me"`. If the env var is unset in a production Next deploy, user upload tokens (`generateSignedUserToken`) are HMAC-signed with a public string. The Python service refuses that value in production (`services/resume-extractor/app/config.py:21-28`), but only if `ENVIRONMENT=production` is set there (it is in `render.yaml:21`). Next should fail closed instead.

### SEC-9 (MEDIUM, CONFIRMED). Public debug and diagnostic endpoints
- `app/api/debug/extractor-config/route.ts` is **unauthenticated**. It reveals the first 35 chars of the Render URL, whether tokens are set and whether they match, the local OCR model status, and on every call makes outbound requests to Render with `X-User-Role: admin` (`:58-66`). This is an amplification/DoS vector.
- `app/api/internal/integrations-status/route.ts:15-20`: "production requires auth", but any guest session (free, SEC-2) passes.
- `app/api/ready/route.ts:31-33`: unauthenticated. Runs `count(*)` on `users` and calls `getDb()`, which **runs DDL migrations** when tables are missing and `DATABASE_AUTO_MIGRATE` is not `"false"` (`lib/db/index.ts:38`, default **true**).
- `app/api/resume/preflight/route.ts:70-82`: unauthenticated; each call makes an 8 s outbound fetch to Render. Also lists missing secret names (`:92-104`).

### SEC-10 (MEDIUM, CONFIRMED). Shared-device data bleed via un-scoped localStorage
- Keys `ai-tathastu-onboarding-v1`, `ai-tathastu-workspace-v1`, `ai-tathastu-synced-v1`, `eora_preferences_v1` (`lib/onboarding.ts:1`, `lib/domain/workspace.ts:7`, `components/student/import-continuity-modal.tsx:8`, `lib/eora/engagement.ts:44`) are **not person-scoped** and are never cleared on sign-out.
- `components/student/import-continuity-modal.tsx:30-115` + `app/api/student/import-local/route.ts` import whatever is in localStorage into the **currently signed-in** account. On a shared lab computer, user B gets user A's legacy onboarding data and goal.

### SEC-11 (MEDIUM, CONFIRMED). Client-controlled provenance on local import
- `lib/services/import-service.ts:94-110`: only `verificationStatus === "verified"` is downgraded. `source`, `category` and any other `verificationStatus` string are accepted verbatim from the request body. A client can inject evidence with `source: "faculty"` or arbitrary categories. `:88` invents a default goal `"ML Engineer"` when none exists (fake data).

### SEC-12 (MEDIUM, CONFIRMED). Error messages leak internals
- `app/api/resume/[id]/retry/route.ts:24`, `[id]/review/route.ts:64-65`, `[id]/apply/route.ts:61`: return `err.message`, which includes Render response bodies (`extractor-service-client.ts:198,242`).
- `app/api/onboarding-v2/route.ts:71`, `app/api/student/person-360/route.ts:15-19`, `dashboard/route.ts:31-33`, verification routes, and `integrations/eris/events/route.ts:30-32` echo raw exception messages, including DB driver errors.

### SEC-13 (MEDIUM, CONFIRMED). Guest session cookie dropped on some responses
- In `app/api/resume/extract/route.ts`, only the final local-success response attaches `sessionCookieToSet` (`:767-773`). The **Render-path success** (`:364-395`) and **every `fail()`** response (`:53-84`) do not. If extract is the first call that minted a guest (no cookie), that guest is orphaned and the next call mints another person. Mitigated today because the UI calls `processing-jobs` POST first, but fragile.

### SEC-14 (LOW–MEDIUM, CONFIRMED). No CSRF/origin validation on state-changing routes
- `verifySameOrigin` (`lib/security/csrf.ts`) is unused. `SameSite=Lax` blocks most cross-site POSTs, but top-level GET side effects exist: `GET /api/resume/[id]` and `/status` create guest accounts (SEC-2), and `/api/auth/google/start` sets cookies.

### SEC-15 (LOW, CONFIRMED). Weak password policy and minor auth gaps
- Minimum 6 chars, no breach or complexity check (`sign-up/route.ts:261`, `onboarding-v2/route.ts:32`).
- Google `nonce` cookie is set (`google/start/route.ts:216`) but never verified (no id_token used). Harmless but dead.
- `sign-up` does not normalize email before the 409 check (`findUserByEmail` normalizes internally, so this is OK), but the race between check and insert relies on the DB `unique` constraint. A unique violation becomes a generic 500 (`:317-324`).

### SEC-16 (LOW, CONFIRMED). CSP allows `'unsafe-eval' 'unsafe-inline'` for scripts
- `next.config.mjs:21`. Weakens XSS defense. `connect-src 'self' https:` allows exfiltration to any https host.

### SEC-17 (INFO). Guest-draft isolation between *different* visitors: OK
- Drafts are keyed by `personId` from a 32-byte random session token (`lib/services/onboarding-v2-service.ts:11-50`, `lib/auth/session.ts:111`). One visitor **cannot** read another's draft through the API. Leak vectors are only SEC-1 (identical-file collision), SEC-4 (email squatting) and SEC-10 (shared browser localStorage).

### SEC-18 (INFO). Dependencies
- Not auditable without `npm audit` (node_modules absent). Notable: `pdfjs-dist` and `tesseract.js-core` are used directly but only present transitively (version drift risk). `@types/*`, `typescript`, `tsx` are in `dependencies` instead of `devDependencies`. Python: `requirements.txt` uses ranges only (no lock/hashes).

---

## 5. SCALABILITY ISSUES

| ID | Location | Issue |
|---|---|---|
| SCALE-1 | `lib/services/onboarding-v2-service.ts:74-441` | `completeOnboarding` runs ~10–150 sequential awaited queries (each `createEvidenceRecord` is SELECT then INSERT, `:57-87` of evidence repo). No transaction; the Neon HTTP driver cannot do interactive transactions. Partial failure leaves a half-written profile. With 30 skills, 10 projects and 20 resume claims, that is about 200 round-trips at roughly 20–60 ms each on Neon HTTP, i.e. 4–12 s, near or above serverless limits |
| SCALE-2 | `app/api/onboarding-v2/github/route.ts:118-188` | For every repo (up to 60): snapshot SELECT/INSERT, `saveProject` SELECT then UPDATE/INSERT, and per technology finding an evidence SELECT/INSERT. Hundreds of sequential round-trips inside one request. Classic N+1 |
| SCALE-3 | `lib/connectors/github/client.ts:470-481` + `:260-320` | Per import: 1 profile + 1 repo page + **6 repos × (languages + README + 8 manifest probes) = 62 sequential GitHub calls**, each with an 8 s timeout. Unauthenticated (`GITHUB_TOKEN` unset) limit is **60/hour per egress IP**, shared by all users on that serverless IP. One import can exhaust it; manifest 403s are silently swallowed (`catch {}`), so data is silently incomplete |
| SCALE-4 | `lib/storage/object-storage.ts:48` | Resume binaries stored as **base64 text in Postgres** (`resume_document_blobs.payload_base64`): 33% bloat, full-row reads, no TTL purge on the Next side |
| SCALE-5 | Unpaginated reads | `getEvidenceByPersonId`, `getProjectsByPersonId`, `getJourneyEventsByPersonId`, `getExternalConnections`, `getSourceSnapshots`, ... (`lib/repositories/*`) have no limit. `getPerson360` (`lib/services/person-360-service.ts:142-153`) runs about 8 queries **sequentially** (not `Promise.all`) and is called by dashboard, chat and context on every request. `app/api/student/projects/[id]/route.ts:32-38` loads all evidence just to filter for one project |
| SCALE-6 | Missing indexes / constraints | `evidence_items(person_id, import_key)` dedup relies on SELECT-then-INSERT without a unique index, so concurrent requests create duplicates. `projects(person_id, title)` has the same pattern (`lib/repositories/project-repository.ts:50-55`). `source_processing_jobs(person_id, status, started_at)` is not indexed for the stuck-job sweep. Only the indexes listed in `lib/db/schema.ts` exist |
| SCALE-7 | In-process OCR on request thread | `lib/services/document-parser-service.ts:1127-1275`: pdf.js load + canvas render at scale 2.0 (and a 2.5 retry) + tesseract worker creation + recognition, all inside an HTTP request. Memory heavy (2 rendered pages at 2.0 on A4 is about 1190×1684 RGBA ≈ 8 MB each, plus the 5.2 MB model and WASM heap). A fresh `createWorker` per request (`:1195`) means the model is reloaded each time |
| SCALE-8 | Python service | `services/resume-extractor/app/main.py:146-216`: `async def upload_and_extract` does **blocking** OCR (`read_document`) on the event loop, so one OCR stalls every other request on that worker, including `/health`, and Render health checks can fail and restart the box. `WORKERS=2` gives at most 2 concurrent. `store.py:21` uses `threading.RLock`, which does not protect across the 2 uvicorn **processes**. Storage is local disk (`config.py:11`) with **no persistent disk** in `render.yaml`, so documents vanish on redeploy |
| SCALE-9 | Unbounded in-memory maps | `MemoryRateLimiter.store` (`rate-limit.ts:62`, keys never evicted), `cost-control.ts:19 userDailyUsage` |
| SCALE-10 | Runtime DDL | `lib/db/index.ts:64-75`: every cold start runs `CREATE SCHEMA IF NOT EXISTS` + `to_regclass` probe; first-request latency on every cold instance |
| SCALE-11 | Guest account growth | SEC-2: no TTL or cleanup for `@onboarding.aitathastu.internal` users |
| SCALE-12 | `app/api/resume/preflight/route.ts:73-77` | Synchronous 8 s Render warm-up blocks the preflight response; the client calls preflight twice per upload (`Screen5ResumeUpload.tsx:171, :255`) |
| SCALE-13 | Hardcoded limits that disagree | Upload cap: Next extract **5 MB** (`extract/route.ts:29`), Next upload **12 MB** (`upload/route.ts:11`), signed-upload claims 12 (`:33`), Python default 12, `render.yaml` **25**, parser safety 25 (`document-parser-service.ts:131`). OCR pages: Node **2** (`:1143`), Python `MAX_PAGES` 20. GitHub: 60 repos discovered (`client.ts:436`) but the loop stops at 1 page because `repos.length < maxRepos` with `perPage = min(60,100) = 60` → exactly 1 request; the "max 3 pages" comment at `:236` is misleading, and repos beyond 60 are silently dropped while `isComplete` is computed honestly |

---

## 6. FUNCTIONAL / FEATURE BUGS

### 6.A OCR pipeline: why CV upload fails in production on Netlify

#### 6.A.1 What is actually deployed? (resolve first)
- **`main` has no Netlify configuration at all.** No `netlify.toml`, no `netlify/functions/*`, no `@netlify/plugin-nextjs`, no `/api/resume/ocr-trigger`. All of that exists **only on `origin/feat/netlify-migration`** (`git merge-base --is-ancestor ccd637a HEAD` returns false; the branch is `a438d02` + 8 commits). `main` still carries `vercel.json` (Vercel cron), `.vercelignore`, `render.yaml` and Vercel-specific code (`app/api/debug/extractor-config/route.ts:100` reads `VERCEL_GIT_COMMIT_SHA`).
- The branch's own status doc (`docs/migration/NETLIFY_FINAL_MIGRATION_STATUS.md` on that branch) says: *"Status: IN PROGRESS"*, *"PENDING PROOF: @napi-rs/canvas must load successfully on Netlify"*, *"Gate J — Browser QA: IN PROGRESS"*, *"DO NOT merge to main"*.
- **Action before any fix:** in the Netlify UI, check *Site configuration → Build & deploy → Branches* to see which branch production builds from. Then open the latest deploy's function logs. Everything below applies to both cases, and the cases are marked.

#### 6.A.2 Request path today (both branches)
`Screen5ResumeUpload.processFile` (`components/exact-screens/Screen5ResumeUpload.tsx:207-447`):
1. `GET /api/resume/preflight` (on mount `:171`, and again with a forced **3 s sleep** if Render was cold `:253-261`).
2. `POST /api/student/processing-jobs`: creates job row `status:"running"`.
3. `POST /api/resume/extract` (multipart). **All parsing and OCR happen synchronously inside this one serverless invocation** (`app/api/resume/extract/route.ts:199-205`). The client waits up to 120 s (`:252`).
4. The UI never polls status. On the branch, `ocr-trigger` + `ocr-background` exist but **nothing in the UI calls `/api/resume/ocr-trigger`** (`git grep ocr-trigger origin/feat/netlify-migration -- components app lib` returns only its own file). The background function is orphaned.

#### 6.A.3 Root-cause analysis (ranked; each is a separate defect)

**OCR-1 (CRITICAL, LIKELY: primary cause). Synchronous OCR exceeds Netlify's synchronous-function time limit.**
- Work done inside one request for a scanned PDF: pdf.js full parse (`extractTextWithPdfJs`), possibly `pdf-parse` (`:1458-1478`), then `recognizeScannedDocument` (`:1529`), which loads pdf.js **again**, renders 2 pages at scale 2.0 with `@napi-rs/canvas`, does a JS pixel loop `preprocessCanvasForOcr` (`:936-1005`), spawns a **new** tesseract.js worker, compiles the WASM core, loads the 5.2 MB `eng.traineddata`, recognizes, and **re-renders at scale 2.5 + re-recognizes** any low-density page (`:1203-1221`). OCR budget is 15 s (`extract/route.ts:204`, branch: 12 s), plus DB writes.
- On `main`, if local OCR yields <40 chars the route then calls Render with a **35 s** timeout (`extractor-service-client.ts:237`), and Render itself may be cold (Render starter instances spin down when idle; render.yaml `plan: starter`).
- Netlify synchronous functions have a hard cap that is far below this worst case (historically 10 s default and 26 s maximum; **confirm the current limit for this site's plan in the Netlify UI**). Do **not** assume `export const maxDuration = 60` (`extract/route.ts:27`) is honored by the Netlify Next.js runtime. When the cap is hit, Netlify returns a platform error (HTML/plain), not the route's JSON. The client's `parseSafeJsonResponse` then shows the generic *"Could not read this file…"*, and the server never runs `fail()`, so **the job row stays `running` forever** (see FUNC-CV-2).
- The branch "fix" `79d9886` lowers OCR to 12 s and disables Render on Netlify (`isNetlify` guard), so scanned PDFs that need more than 12 s now **fail deterministically** with `OCR_LOW_QUALITY` (422), and Render shortens to 6 s.
- **Evidence to collect:** Netlify function log lines like `Task timed out after X seconds` / `Sandbox.Timedout`, or 502/504 on `/api/resume/extract` in the browser network tab.

**OCR-2 (CRITICAL, LIKELY). Model or worker files missing from the Netlify function bundle → tesseract fails, and the failure is hidden.**
- `resolveLocalTrainedDataPath()` (`document-parser-service.ts:1097-1125`) searches `process.cwd()`, `public/`, `__dirname/../..`, `/var/task`, `/var/task/public` and requires an **exact SHA-256 match** (`:1112`). Under the Netlify Next runtime the server handler's cwd and file layout differ from Vercel's. `__dirname` inside a webpack server chunk is not the source dir. `outputFileTracingIncludes` (`next.config.mjs:28-36`) is keyed to `"/api/**/*"`, and whether the Netlify adapter honors it for its consolidated server handler must be verified.
- If not found, the function returns `{dir: cwd, checksumValid: false}` and `createWorker` is still called with `langPath: cwd`, `cacheMethod: "none"`, `gzip: false` (`:1185-1195`). tesseract then fails to read the model.
- `errorHandler: () => {}` (`:1192`) and `catch (err)` (`:1256-1266`) **swallow** the error and return `success:false`. The route then reports `OCR_LOW_QUALITY` *"We could not read the scanned pages clearly. Try a sharper scan"* (`extract/route.ts:222-228`). **That message is misleading**: the engine never ran.
- tesseract.js in Node spawns a `worker_threads` script (`tesseract.js/src/worker-script/node/index.js`) and loads `tesseract.js-core/*.wasm` by runtime path. Neither is statically traceable, and `tesseract.js-core` is not a declared dependency (`package.json`), only transitive. The branch added it plus `included_files` for the orphaned background function only (not the Next server handler).
- The branch also weakened the checksum (`resolveLocalTrainedDataPath` accepts any file >1 MB) and added `/opt/build/repo/*` paths that exist only at build time.
- **Evidence:** `GET /api/debug/extractor-config` returns `localOcrModel.checksumValid`. If `false` on Netlify, this is confirmed.

**OCR-3 (HIGH, VERIFY). `@napi-rs/canvas` native binary may not load on Netlify; failure is swallowed.**
- Requires `@napi-rs/canvas-linux-x64-gnu` in the function bundle (it is in the lockfile). The package is marked external (`next.config.mjs:26`), so it must be copied into the function. The branch doc lists this as the *only remaining technical risk*.
- `renderPdfPagesWithMetadata` wraps everything in `try {} catch {}` (`:1016-1068`) and returns `[]`. OCR then falls back to `extractEmbeddedPdfImages` (`:1160-1176`), which only finds raw JPEG/raster streams. **Vector-outlined / Canva / "print to PDF as curves" CVs and most scanned PDFs with Flate/JBIG2/CCITT images then fail** with *"neither decodable vector pages nor raster image streams"*, reported to the user as low-quality scan.

**OCR-4 (HIGH, CONFIRMED). CV ingestion gate env vars must all be present on Netlify.**
- `coreIngestionReady()` (`lib/security/core-ingestion-gate.ts:7-16`) returns `false` in production unless `CORE_INGESTION_SECURITY_APPROVED=true` **and** 4 secrets (≥32 chars) are set: `SESSION_SECRET, HANDOFF_SIGNING_SECRET, GITHUB_WEBHOOK_SECRET, EXTERNAL_TOKEN_ENCRYPTION_KEY`. Several are unrelated to CV upload. If any is missing in Netlify env, preflight returns 503 and the UI disables upload (`Screen5ResumeUpload.tsx:191,224-227`) with *"Resume upload is temporarily unavailable"*. `.env.example` does **not** list `SESSION_SECRET`. **Evidence:** `GET /api/resume/preflight` → `failureCategories`.

**OCR-5 (HIGH, LIKELY). Production DB may be missing the resume and job tables.**
- `lib/db/index.ts:66-75` only runs DDL when `organizations` is **absent**. A Neon DB initialized before `source_processing_jobs`, `resume_documents`, `resume_document_blobs` and `resume_review_history` were added will never get them at runtime, and the branch's `netlify.toml` sets `DATABASE_AUTO_MIGRATE="false"` explicitly. Symptoms: `processing-jobs` POST → 500 `JOB_CREATION_FAILED`; or extract → 500 `UNKNOWN_PROCESSING_FAILURE`. `ObjectStorageService.storeDocument` errors are swallowed (`extract/route.ts:448`). **Evidence:** run `SELECT to_regclass('public.source_processing_jobs'), to_regclass('public.resume_documents');` on the production Neon branch. Fix by running `npm run db:migrate` (which runs all `MIGRATION_SQL_STATEMENTS`).

**OCR-6 (MEDIUM, VERIFY). Request body size limit.** Netlify Functions limit request payloads (6 MB buffered; binary bodies may be base64-encoded, inflating ~33%). The 5 MB client cap (`Screen5ResumeUpload.tsx:219`) is close to that limit, so a 4.5–5 MB PDF may be rejected by the platform before the route runs.

**OCR-7 (MEDIUM, CONFIRMED). The Netlify background-function design on the branch is broken even if wired up.**
- `netlify/functions/ocr-background.mts` (branch) returns a `Response` and runs `processOcrJob(...)` **detached** (`.catch` with no `await`). In Netlify's v2 functions model the invocation ends when the handler's promise settles, so detached work is not guaranteed to run. The work must be awaited inside the handler (background functions already return 202 to the caller automatically).
- `app/api/resume/ocr-trigger/route.ts` (branch) fires `fetch(backgroundUrl)` **without awaiting** and returns, so the outbound request can be cut when the function freezes. It targets `APP_BASE_URL` (production) even from deploy previews. If `OCR_INTERNAL_SECRET` is unset it returns 202 `"QUEUED"` with `mode:"inline"`, but **nothing ever processes the job** (eternal `running`).
- The background function persists `resumeDocuments.extractedProfile = { extraction, metadata }` (a different shape from the extract route's Schema v2), **never calls `saveResumeCandidates`** (so `validateReviewedResumeClaims` at `onboarding-v2-service.ts:90` will later throw *"Resume review has no matching uploaded document"*), never checks `extraction.success`, and hardcodes `text_quality: "good"`.

**Summary for the fixer:** check, in this order: (1) which branch Netlify builds; (2) `/api/resume/preflight` (OCR-4); (3) `/api/debug/extractor-config` → `localOcrModel.checksumValid` (OCR-2); (4) Netlify function logs for timeouts (OCR-1); (5) Neon tables (OCR-5). The durable fix is architectural: move OCR out of the synchronous request (an awaited background function or a queue), persist state transitions, and have the UI poll `/api/resume/{id}/status`. Alternatively, send scanned PDFs straight to the Render service (already built for this) via the existing `signed-upload` route with client polling, and stop running tesseract.js inside Next.

### 6.B CV extraction state machine (queued / processing / review-ready / failed)

**FUNC-CV-1 (HIGH, CONFIRMED). There is no real status state machine visible to the user.**
- The UI sets `"PARSING"` right after job creation (`Screen5ResumeUpload.tsx:293`) and `"EXTRACTING"` before the fetch (`:301`). These labels are **client-side guesses**, not server state. `GET /api/resume/[id]/status` exists but is never polled.
- Server job statuses: inserted as `"running"` (`source-processing-job-service.ts:70`), while the API **response** says `"queued"` (`app/api/student/processing-jobs/route.ts:105`). `queued` is never stored. There is no `review_ready` state; "completed" is used for "candidates extracted, awaiting review".

**FUNC-CV-2 (HIGH, CONFIRMED). Jobs get stuck in `running` forever.**
- If the function is killed (timeout, OOM), no `fail()` runs. The client's `notifyJobFailed` PATCH (`:197-205`) runs only if the browser is still on the page, and is fire-and-forget.
- Recovery depends on `/api/cron/cleanup-stuck-syncs` (`recoverStuckJobs`, `source-processing-job-service.ts:199-227`), scheduled **only** in `vercel.json:5-9`. On Netlify `main` there is no scheduler. On the branch, the scheduled function exists but must call the route with `CRON_SECRET`, which `.env.example` does not list.

**FUNC-CV-3 (HIGH, CONFIRMED). Terminal states are not guarded, so "completed" and "failed" can overwrite each other.**
- `completeJob`/`failJob` (`source-processing-job-service.ts:107-145`) update unconditionally (no `WHERE status='running'`).
- **Scenario A:** the client times out at 120 s → PATCH `timed_out`; the server finishes later → `completeJob` flips it to `completed`.
- **Scenario B:** the server completes; then the client's `extractionMeta.success !== true || rows.length === 0` check (`Screen5ResumeUpload.tsx:363-372`) PATCHes the **completed** job to `failed`.
- `completeJob` also **replaces** `metadata` (`:115`).

**FUNC-CV-4 (HIGH, CONFIRMED). "Processing complete" / "Everything is saved" is reported falsely.**
- `Screen5ResumeUpload.tsx:510`: `await fetch(.../apply).catch(() => null)`. The response status is ignored, then `setProcessingState("COMPLETED")` + EORA says *"Everything is saved"* (`:513-519`) even if `/apply` returned 404/500.
- `extract/route.ts:441-448, 702-711`: blob storage and `resumeDocuments` profile update failures are swallowed, yet the job is completed (`:725-730`) and the API returns `status:"completed"`. Later `/api/resume/{id}` and `/apply` 404 (DB fallback finds no row) while the user saw success.
- `extract/route.ts:692, 697`: metadata hardcodes `text_quality: "good"` and `warnings: []`, even when `parsedDoc.ocrFailed` or warnings exist.
- `extract/route.ts:258`: Render path uses the placeholder string `"Extracted from scanned resume"` as source text when Render returned no raw text. `resumeCandidates` then validates spans against this fake text.

**FUNC-CV-5 (MEDIUM, CONFIRMED). Render path and local path persist different things.**
- Render success (`:344-395`) saves candidates and blob but **does not write `resumeDocuments.extractedProfile`** and does not attach the session cookie. `/api/resume/{id}` for a Render-OCR'd doc relies on `ExtractorServiceClient.getDocument(documentId=sha256)`, but Render knows the doc by its own UUID (`renderDocId`, `:257`, never returned or used). So EORA advice, `/apply` and `/export` all fail for OCR'd CVs.

**FUNC-CV-6 (MEDIUM, CONFIRMED). Export, retry and review are wired to the wrong backend.**
- `/api/resume/[id]/export` (`export/route.ts:22`) and `/retry` only call Render. For locally extracted CVs (sha256 IDs unknown to Render) the UI's export buttons (`Screen5ResumeUpload.tsx:987, 994`) always 500.

**FUNC-CV-7 (MEDIUM, CONFIRMED). Retry loses data and doesn't reuse the stored file.**
- Retry is "pick the file again" (`processFile` resets candidates and extraData at `:236-241` *before* the new attempt succeeds). A failed retry wipes the previous successful review on screen. The durable blob isn't reused.

**FUNC-CV-8 (MEDIUM, CONFIRMED). Unselected suggestions are still written to Person 360 ("no silent overwrite" violated).**
- The user selects claims client-side, but `/api/resume/[id]/apply` → `ResumePerson360Mapper.applyProfileToPerson360` (`lib/services/resume-person360-mapper.ts:82-230`) applies **every record whose `record_state !== "rejected"`**. Nothing marks unselected candidates `rejected`, so deselected skills and projects are still imported.
- The degree is overwritten unconditionally (`:107-112`, no comparison with the existing value). Only institution logs a conflict.
- The "skip verified" checks are dead (§2.4).

**FUNC-CV-9 (LOW, CONFIRMED). Validation mismatch.** The client accepts only PDF/DOCX ≤5 MB (`:213-221`). `/api/resume/upload` advertises TXT/RTF/JPG/PNG ≤12 MB. The extract route rejects images, so **image CVs (JPG/PNG) are unsupported** in the live flow despite OCR code supporting them (`isSupportedImageBuffer`).

### 6.C Onboarding draft → account merge

**FUNC-OB-1 (HIGH, CONFIRMED). Draft load failure overwrites saved progress.**
- `ExactScreensContainer.tsx:123-226`: if `GET /api/onboarding-v2` fails (network, 500), the `catch {}` swallows it and `finally` sets `draftLoaded=true` (`:224-225`). The persist effect (`:262-265`) then PUTs `{currentScreen: 2}` (the initial screen), **overwriting the user's saved step**.

**FUNC-OB-2 (HIGH, CONFIRMED). Duplicate guest persons on first visit (race).**
- On a cookieless first load, concurrent requests that mint guests: the draft-persist PUT (`:264`), Screen5's `processing-jobs` POST, `onboarding-v2/github`, and so on. Each cookieless request to a `getOrCreate…` route creates a separate user/person (`server-session.ts:38-84`). The comment at `app/api/student/processing-jobs/route.ts:31-32` acknowledges the "switch owners mid-onboarding" race. Two tabs or a hard refresh during the first PUT also duplicates. The orphaned person keeps the uploaded CV, so the final POST's `validateReviewedResumeClaims` throws *"Resume review has no matching uploaded document"* (`resume-review-service.ts`), and onboarding cannot complete.

**FUNC-OB-3 (HIGH, CONFIRMED). Guest data is not merged on sign-in / Google sign-in.**
- `app/api/auth/sign-in/route.ts` and `google/callback/route.ts:141-158` create a new session for the existing account and **discard** the current guest's draft, CV snapshots, jobs and projects (no merge, guest rows orphaned). A returning user who started onboarding as a guest and then signs in loses that work.

**FUNC-OB-4 (MEDIUM, CONFIRMED). `completeOnboarding` is not idempotent or atomic.**
- Not transactional (SCALE-1). It can be re-POSTed after completion (no `draft.completed` guard), re-running profile overwrites.
- `createEvidenceRecord` dedups by `importKey` and **returns the old row without updating** (`evidence-repository.ts:84-86`). Corrected values (education string, target role, goal) silently **do not update** on re-submit, because keys like `ob2_${personId}_education` are fixed.

**FUNC-OB-5 (MEDIUM, CONFIRMED). Resume upload state lost on refresh.** `resumeFileName` and candidate rows are not part of the persisted draft (`lib/onboarding-v2.ts#safeDraft` whitelist). After a reload on/after screen 5, `handleResumeNext` (`ExactScreensContainer.tsx:288-302`) treats the user as "no CV" and routes to manual academic entry.

**FUNC-OB-6 (LOW, CONFIRMED).** `request.json()` is outside `try` in `app/api/onboarding-v2/route.ts:16, 77`, so malformed JSON gives an unhandled 500. `handleFinishOnboarding` uses `alert()` (`:354`).

### 6.D Digital footprint (GitHub / LinkedIn)

**FUNC-FP-1 (HIGH, CONFIRMED). "Detection" is labelled "connection".**
- `app/api/onboarding-v2/github/route.ts:96-116` saves `external_connections.status = "connected"` for **any username typed**, with `ownershipVerified:false` only in metadata. Anyone can claim anyone's GitHub. The real OAuth connect (`/api/auth/github/*`) is not linked from the UI. EORA chat lists these as "Connected Accounts" (`app/api/eora/chat/route.ts:58`).
- LinkedIn is reference-only by design (`lib/connectors/linkedin/client.ts:5-9`). That is correct, but make sure the UI says "linked", not "connected".

**FUNC-FP-2 (HIGH, CONFIRMED). GitHub rate limit, pagination and silent partial data.** See SCALE-3 and SCALE-13. `fetchRepositoryManifestsAndReadme` swallows every error (`client.ts:271-317`). Rate-limit hits mid-inspection produce "successful" imports with empty technologies. `fetchGitHubUserRepos` returns partial `repos` with `success:false` on 403, and the intelligence wrapper discards them (`:439-453`).

**FUNC-FP-3 (MEDIUM, CONFIRMED). Duplicate projects across sources.** Dedup is exact, case-sensitive `title` equality per person (`project-repository.ts:50-55`). A resume project "Face Recognition System" and the GitHub repo `face-recognition` become two projects. A check-then-insert race exists without a unique index.

**FUNC-FP-4 (MEDIUM, CONFIRMED). Long synchronous import.** One request does 62 GitHub calls + N+1 DB writes (SCALE-2/3). It will time out on Netlify sync functions and leave the GitHub job `running`.

### 6.E Other functional bugs
- **FUNC-MISC-1 (MEDIUM, CONFIRMED).** `studentEntryPath` (`lib/student-entry.ts:7-22`): a faculty-pending user (`metadata.requestedRole==="faculty"`) visiting `/student` passes the layout guard (`app/student/layout.tsx:15` only redirects on `/onboarding`). `app/student/page.tsx:22` then client-redirects to `/faculty`. `/faculty` errors with a "Go to onboarding" link if `role !== "faculty"`, and `/onboarding` with a completed draft does `window.location.replace("/student")` (`ExactScreensContainer.tsx:156`). Not an automatic loop, but a dead-end cycle for edge states.
- **FUNC-MISC-2 (LOW, CONFIRMED).** `restoredScreen` fallback (`ExactScreensContainer.tsx:159-160`) sends any user with priorities to screen 5 even if role is faculty (faculty next is 3.7).
- **FUNC-MISC-3 (LOW, CONFIRMED).** `AdaptiveWorkspace.tsx:23`: the "research" widget links to `/student/roadmap` ("Explore roadmap"), which is the wrong module.
- **FUNC-MISC-4 (MEDIUM, CONFIRMED).** `updateUserPreferences` (`person-repository.ts:104-131`) is a read-modify-write of `metadata` (lost-update race with concurrent PATCHes).

---

## 7. UI BUGS
(Static review only; **nothing was rendered**. Widths 1280/1440/1920 were not visually verified. Items marked VERIFY need a browser pass.)

| ID | Location | Issue |
|---|---|---|
| UI-1 | `Screen5ResumeUpload.tsx:252-301` | Progress labels are fake (see FUNC-CV-1). After pressing upload the UI sleeps a hard-coded 3 s if Render was "cold" (`:260`) with no feedback. A 120 s spinner with no cancel button (abort exists, no UI) |
| UI-2 | `Screen5ResumeUpload.tsx:513-519` | Success state shown even when `/apply` failed (FUNC-CV-4) |
| UI-3 | Native dialogs | `alert()`/`confirm()` used for errors and deletes: `ExactScreensContainer.tsx:354`, `Screen5ResumeUpload.tsx:1002`, `student-project-detail-view.tsx:114,129`, `student-projects-view.tsx:648,662`, `app/student/connections/page.tsx:98`, `app/student/skills/[skill]/page.tsx:192,220,223`. Not styleable or accessible, and they block automation |
| UI-4 | Missing loading/error/empty states | `app/faculty/page.tsx:11-12` (bare text "Loading…", unstyled). `fetch(/api/resume/${id})` failures silently ignored (`Screen5ResumeUpload.tsx:396-407`). `ExactScreensContainer` draft-load failure is silent (FUNC-OB-1). Workspace "research" and "people" widgets show generic intro text with no honest empty state when data is absent (`AdaptiveWorkspace.tsx:23,33`) |
| UI-5 | Focus visibility (VERIFY) | `outline: none` without a visible replacement in `app/globals.css:275` (`.auth-input`, relies on border color only), `app/exact-screens.css:644,773,1652,2366`, `student-workspace.css:1599,1637`, `eora-companion.css:590`. Check each has a `:focus-visible` substitute |
| UI-6 | Modals | `components/student/*-modal.tsx` / drawers use `role="dialog" aria-modal` but (except `AdaptiveWorkspace`) do not trap focus or restore focus on close. Backdrop-click closes via `div onClick` (5 places) with no keyboard equivalent besides Esc (VERIFY Esc handling per modal) |
| UI-7 | `EoraFloatingCompanion` on every route | `app/layout.tsx:21-24` mounts it on landing, sign-in, the error page and `/screens`. Floating fixed-position element may overlap footer CTAs at 1280×720 (VERIFY) |
| UI-8 | Inline-style heavy layout | Most screens use inline `style` with `clamp()`. Widths: `.screen-body maxWidth:1240` (`Screen3aPriorities.tsx:25`), workspace `max-width:1380px` (`student-workspace.css:55,202`), `AdaptiveWorkspace` `maxWidth:1220`. At 1920 content is centered in ≤1380 px (fine). The 3-column purpose grid (`v4-purpose-grid`) only collapses below 700 px, so 1280 is OK. Dashboard metrics grid `repeat(6,1fr)` collapses at ≤1400 (`exact-screens.css:1959`): VERIFY 1280–1400 layout |
| UI-9 | `/screens` gallery | Publicly reachable mock with fake persona data; can confuse users and leaks unfinished UI |
| UI-10 | Sidebar "Later" items | `student-sidebar.tsx:107-112` show modules (Evidence Center, Research, Learning, Career, Settings, ...) as "coming soon". No pages exist (see §9 Core modules) |
| UI-11 | Error page | `app/error.tsx` says *"Your saved information is still available"*, which is not true when the error is a failed save |
| UI-12 | Hard-coded copy | "Step 3 of 10" (`Screen3aPriorities.tsx:24`) while the container has 12+ screens including faculty branches; step counters can disagree with the `ScreenFooter` `totalSteps` |

---

## 8. OTHER ISSUES

### 8.1 Build / deploy (Vercel → Render → Netlify leftovers)
- **DEPLOY-1 (CRITICAL).** Netlify config is not on `main` (§6.A.1). Decide: merge a corrected version of the branch, or deploy `main` with an explicit `netlify.toml`. Today the repo simultaneously contains `vercel.json` (Vercel cron + build), `.vercelignore`, `render.yaml` (Python extractor only), and a Netlify branch.
- **DEPLOY-2.** Branch `netlify.toml` uses `publish = ".next"` + `@netlify/plugin-nextjs` plugin, but the plugin is added to **dependencies** with `drizzle-kit` moved from dev to prod deps, plus `NPM_FLAGS="--include=dev"`. Conflicting approaches. `tsconfig.json` on the branch excludes all of `scripts/` and `netlify/` from typechecking.
- **DEPLOY-3.** Branch code obfuscates paths with base64 (`Buffer.from("LnBnZGF0YQ==","base64")`, `"cHVibGlj"`, the pdfjs cmaps path) to defeat file tracing. This is fragile and unreadable; it also **breaks** cmaps/standard_fonts lookup unless `included_files` copies them into the exact cwd-relative path.
- **DEPLOY-4.** Cron: `vercel.json` cron only. Netlify needs a scheduled function. The Render background worker referenced in comments (`app/api/cron/cleanup-stuck-syncs/route.ts` "Replaces the Render background worker") no longer exists.
- **DEPLOY-5.** `app/api/debug/extractor-config/route.ts:79-82, 100`: messages say "set in Vercel"; `VERCEL_GIT_COMMIT_SHA` is used. Platform-specific.
- **DEPLOY-6.** `lib/auth/origin.ts:26-32`: Vercel-only fallback `VERCEL_PROJECT_PRODUCTION_URL`, then the hard-coded `https://www.aitathastu.com`.
- **DEPLOY-7.** `next.config.mjs:37-39`: `eslint.ignoreDuringBuilds: true`, so lint never gates deploys. CI (`.github/workflows/ci.yml`) runs lint/tsc/test/build but on **Node 20**, while `@types/node` is 22 and Netlify branch pins `NODE_VERSION=20`. Align.
- **DEPLOY-8.** Two migration mechanisms (BLOAT-8) and runtime DDL enabled by default (`DATABASE_AUTO_MIGRATE` default true).
- **DEPLOY-9.** `outputFileTracingIncludes` adds the 5.2 MB model to **every** `/api/**` function (on Vercel each route is its own function, so bundle bloat).
- **DEPLOY-10.** `eng.traineddata` is committed at the root, and `.gitignore`/`.vercelignore` contain `!/eng.traineddata` exceptions. The code also looks in `public/eng.traineddata`, which does not exist (if added it would be publicly downloadable; harmless but wasteful).

### 8.2 Config / env
- `.env.example` is missing: `SESSION_SECRET` (required by the ingestion gate), `CRON_SECRET`, `OCR_INTERNAL_SECRET`, `UPSTASH_REDIS_REST_URL/TOKEN`, `GITHUB_TOKEN`, `DATABASE_MODE`, `DATABASE_TRANSPORT`, `CLOUD_AI_*`, `EXTERNAL_TOKEN_ENCRYPTION_KEY_PREVIOUS`, `ENVIRONMENT` (Python).
- `.env` sets `REDIS_URL`, which nothing reads (SEC-6).
- `.env.example` section numbering has two "4." sections. It recommends `PILOT_INVITE_CODES` with real-looking values (`TATHASTU-PILOT-2026,...`). If copied to production, those codes are public.
- Env var aliases proliferate: `RESUME_EXTRACTOR_URL | RESUME_EXTRACTOR_SERVICE_URL | NEXT_PUBLIC_RESUME_EXTRACTOR_URL | NEXT_PUBLIC_RENDER_EXTRACTOR_URL`; `EXTRACTOR_API_TOKEN | RESUME_EXTRACTOR_SERVICE_API_KEY | RESUME_EXTRACTOR_SERVICE_SECRET`.

### 8.3 Types / style
- Pervasive `any` in critical paths: `extract/route.ts:198,244-338` (`renderResult.profile.groups as Record<string, any[]>`), `onboarding-v2-service.ts:233-298` (`(edu as any)`), `ExactScreensContainer.tsx:205-216` (`(d as any).experiences`), `app/api/resume/[id]/route.ts:25`.
- Naming inconsistency: `Screen3aPriorities` lives at screen `3.5`; `Screen3bAiMlDirection` at `3.2`; fractional screen numbers as state; "V4.2/V5.0.5r/Phase 8.1" version tags in comments everywhere.
- Mixed ID schemes: `usr_${Date.now()}_${hex}`, `job_${hex}`, `crypto.randomUUID()`, sha256. Timestamp-prefixed IDs leak creation time and are only 32 bits random (`user-repository.ts:27-32`).
- `lib/services/onboarding-v2-service.ts:85` uses global `crypto.randomUUID()` without import, while `:1` imports nothing named crypto. It works on Node ≥19 but is inconsistent with the rest of the file.
- `node_modules` not installed, so **typecheck not verified**. CI claims "307 tests"; not run.

### 8.4 Docs
- `README.md:108` links `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`, **which does not exist**.
- ~80 docs claim certification PASS (BLOAT-14). No current architecture doc for the Netlify target on `main`.
- No doc for running the Python extractor locally alongside Next.

---

## 9. MANUAL TEST RESULTS (static trace; nothing executed)

Legend: **BROKEN** = code path proves failure · **WORKING** = code path is correct (still needs runtime smoke test) · **UNVERIFIED** = requires running.

### 9.1 Landing page entry
| Check | Result | Evidence |
|---|---|---|
| New user sees landing | WORKING | `app/page.tsx:9-11` renders `EcosystemLanding` |
| Returning user routed to workspace | BROKEN (not implemented) | Landing never checks the session. Returning users must click sign-in → `/start` → `studentEntryPath` (`app/start/page.tsx:12-18`) |
| No redirect loops | WORKING with an edge dead-end | `/start` → `/sign-in` when unauthenticated; `/student` layout → `/onboarding` when draft incomplete; `/onboarding` → `/student` when completed. Faculty-pending edge cycle in FUNC-MISC-1 (manual, not automatic) |

### 9.2 Onboarding account creation
| Check | Result | Evidence |
|---|---|---|
| Guest draft isolation (other visitors) | WORKING | Drafts keyed by session `personId` (SEC-17) |
| Guest draft isolation (same browser / shared device) | BROKEN | SEC-10 localStorage import |
| Identical CV across users | BROKEN | SEC-1 |
| No duplicate accounts on refresh | BROKEN | FUNC-OB-2: concurrent cookieless requests mint multiple guests |
| Email squatting / takeover | BROKEN | SEC-4 |
| Invite-code gate honored | BROKEN | Onboarding path bypasses it (SEC-4) |

### 9.3 Role / goal / purpose ranking
| Check | Result | Evidence |
|---|---|---|
| Max 3 | WORKING | Client `Screen3aPriorities.tsx:20`; server `validatePurposes` (`lib/domain/adaptive-workspace.ts:31-36`) and `writeOnboardingDraft:26-27` |
| Primary/secondary/tertiary ordering | WORKING | Arrows reorder (`:21`); `primary = selected[0]` (`:22`); server checks primary is first (`onboarding-v2-service.ts:78`) |
| Persists across refresh | WORKING (mostly) | `persistDraft({priorities, primaryPriority})` (`ExactScreensContainer.tsx:475-479`) is **not awaited**; `onNext()` runs immediately, so a fast refresh can lose it. Restore at `:202-203`. **UNVERIFIED** under failure, because the save error only shows a generic banner |

### 9.4 CV upload + extraction (**BROKEN IN PRODUCTION**)
| Check | Result | Evidence |
|---|---|---|
| File validation (type/size/magic bytes/encrypted) | WORKING | Client `:209-221`; server `extract/route.ts:146-175` |
| Native (text) PDF | WORKING locally / UNVERIFIED on Netlify | pdf.js path; depends on OCR-4/OCR-5 env and DB |
| Scanned / image PDF (OCR) | **BROKEN** on Netlify | OCR-1, OCR-2, OCR-3 (§6.A) |
| Image files (JPG/PNG) | BROKEN (unsupported) | FUNC-CV-9 |
| DOCX | WORKING (likely) | mammoth path; magic-byte check `extract/route.ts:161` requires `[Content_Types].xml` within the buffer |
| Real status states | BROKEN | FUNC-CV-1/2/3 |
| "Complete" reported truthfully | BROKEN | FUNC-CV-4 |
| Retry without data loss | BROKEN | FUNC-CV-7 |
| Export | BROKEN for local extraction | FUNC-CV-6 |

### 9.5 Academic / profile review
| Check | Result | Evidence |
|---|---|---|
| Editable suggestions | WORKING (client) | Candidate rows editable, `corrected` flag. Server validates span match (`resume-review-service.ts claimMatchesSnapshot`) |
| No silent overwrite | BROKEN | FUNC-CV-8 (unselected items applied; degree overwritten); FUNC-OB-4 (corrections don't update existing evidence) |
| Persists | PARTIAL | Reviewed claims persisted in draft (`resumeReviewed`); upload state is not (FUNC-OB-5) |

### 9.6 Digital footprint
| Check | Result | Evidence |
|---|---|---|
| Detection vs connection distinguished | BROKEN | FUNC-FP-1 |
| GitHub pagination | BROKEN (silent truncation at 60) | SCALE-13 |
| Rate-limit handling | PARTIAL | Detected for profile/repo list (`client.ts:163-168, 227-230`); swallowed for 60 deep-inspection calls (FUNC-FP-2); no token → 60/h |
| No duplicate projects | BROKEN | FUNC-FP-3 |
| Portfolio fetch SSRF-safe | WORKING | DNS-pinned public-IP guard (`lib/connectors/portfolio/client.ts:42-126`) |

### 9.7 Skills graph
| Check | Result | Evidence |
|---|---|---|
| Interactive | WORKING (client) | `Screen9SkillsMap.tsx` (SVG, 22 handlers) |
| Evidence-linked | PARTIAL | Onboarding map derives evidence client-side (`:260-352`); workspace `/student/skills` fetches `/api/student/skills` |
| Editable | PARTIAL / UNVERIFIED | Toggle selection only (`:251`); per-skill contribution editing at `/student/skills/[skill]` uses `alert()` errors |

### 9.8 Projects / launch
| Check | Result | Evidence |
|---|---|---|
| CRUD | WORKING | `app/api/student/projects/*` scoped by personId (`project-repository.ts:130-286`) |
| No duplicates | BROKEN | FUNC-FP-3 + race (SCALE-6) |
| Dashboard launch | WORKING | `handleFinishOnboarding` → `/student` (`ExactScreensContainer.tsx:351`) after POST ok |

### 9.9 Dashboard
| Check | Result | Evidence |
|---|---|---|
| Purpose-driven layout | WORKING | `composeWidgetIds` (`adaptive-workspace.ts:49-55`) |
| Real data vs honest empty states | PARTIAL | Uses `getStudentDashboardComposition`; research widget mislinks (FUNC-MISC-3); `?guest=true`/`?demo=true` returns demo data (`dashboard/route.ts:11-24`); import-local invents a goal (SEC-11) |
| Persisted layout changes | WORKING | `PATCH /api/workspace/preferences` merges metadata (`person-repository.ts:123-125`); race in FUNC-MISC-4 |

### 9.10 Core modules
| Module | Result | Evidence |
|---|---|---|
| Person 360 | WORKING | `/student/profile`, `/api/student/person-360` |
| Skills Intelligence | WORKING | `/student/skills`, `/student/skills/[skill]` |
| Evidence Center | BROKEN / missing | No page; only `evidence-drawer.tsx`; sidebar "Later" |
| Projects | WORKING | `/student/projects`, `/student/projects/[id]` |
| Career | PARTIAL | Only `/student/roadmap`; no career page |
| Research | BROKEN / missing | No page; widget mislinks to roadmap |
| Learning | PARTIAL | Roadmap only |
| ERIS | PARTIAL | `/student/assessments` displays partner events from `/api/integrations/eris/events` (live flag `ENABLE_ERIS_LIVE`) |
| EORA | PARTIAL | Chat requires LLM keys; the in-memory quota is not enforced across instances (SEC-6) |
| Settings | BROKEN / missing | No settings page (layout customization lives inside the dashboard dialog only) |

### 9.11 Returning user / session
| Check | Result | Evidence |
|---|---|---|
| Resume correct onboarding step | BROKEN under failure | FUNC-OB-1; FUNC-OB-5 for CV step |
| Data isolation between users | BROKEN | SEC-1, SEC-3, SEC-4, SEC-10 |
| Session expiry | WORKING | 7-day sessions, `gt(expiresAt, now)` in `validateSession` (`session.ts:144`). No sliding refresh; no cleanup of expired rows |
| Sign-out | WORKING (server) | Deletes the session row; does not clear localStorage (SEC-10) |
| No redirect loops | WORKING | §9.1 |

---

## 10. PRIORITIZED FIX LIST

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. Effort: **S**mall (<½ day) / **M**edium (½–2 days) / **L**arge (>2 days).

### 10.0 Netlify OCR failure: likely root cause and diagnostics before fixing
**Likely root cause:** CV OCR runs **synchronously inside the Next.js `/api/resume/extract` request**: pdf.js render via the native `@napi-rs/canvas`, then a fresh tesseract.js WASM worker loading a 5.2 MB model, then optionally a 35 s Render fallback. On Netlify this request (a) exceeds the synchronous function time limit, and/or (b) cannot find `eng.traineddata` / tesseract worker / WASM / canvas native files in the bundled server handler. Every engine error is swallowed and reported as *"scan not clear"* (OCR-1, OCR-2, OCR-3). The Netlify-specific async design exists only on an **unmerged branch**, is never called by the UI, and its background function does not await its own work (OCR-7). Secondary blockers that produce the same symptom: the ingestion-gate env vars (OCR-4) and missing resume/job tables in Neon (OCR-5).

**Diagnose in this order (≈30 min):** 1) Netlify production branch? 2) `GET /api/resume/preflight` (gate). 3) `GET /api/debug/extractor-config` → `localOcrModel.checksumValid`. 4) Netlify function logs during an upload (timeout vs error). 5) Neon `to_regclass` checks for `source_processing_jobs`, `resume_documents`.

### 10.1 Ranked list
| # | ID | Sev | Effort | Fix summary |
|---|---|---|---|---|
| 1 | OCR-1 / OCR-7 / DEPLOY-1 | C | L | Make OCR asynchronous: upload stores the blob and creates a `queued` job, then returns 202. Work runs in an **awaited** Netlify Background Function (or route scanned PDFs to the Render service via `signed-upload`). UI polls `/api/resume/{id}/status`. Merge a corrected Netlify config to `main` and remove orphaned branch code |
| 2 | OCR-2 | C | M | Ship the tesseract model, worker script and WASM explicitly in the function bundle (or load the model from a known absolute path / object storage). Fail loudly: surface `OCR_ENGINE_UNAVAILABLE` (5xx, retryable) instead of `OCR_LOW_QUALITY`; remove `errorHandler: () => {}`; restore strict checksum |
| 3 | OCR-4 / OCR-5 | C | S | Set all 5 gate env vars in Netlify (document `SESSION_SECRET` in `.env.example`). Decouple CV gate from unrelated secrets. Run `npm run db:migrate` on the production Neon branch |
| 4 | SEC-1 | C | S | Random document IDs; sha256 → `checksum` only; scope all `resumeDocuments`/blob writes by `(id, personId)`; stop swallowing update errors |
| 5 | SEC-3 | C | S | Never take role from the request body. Derive verifier from RBAC (`can(..., "student.verify_skill")`). Python: stop trusting `X-User-Role` for elevation (use a separate verifier token only); always send `X-Org-Id` |
| 6 | SEC-2 | C | M | Only mint guests on explicit onboarding start (one POST), never on GET/status/export. Rate-limit guest creation by IP; add a guest TTL purge job; key resume limits by IP + person |
| 7 | OCR-3 | H | M | Verify canvas loads on Netlify; log render errors; fallback to PyMuPDF via Render for vector PDFs |
| 8 | FUNC-CV-2 / FUNC-CV-3 | H | M | Guard transitions (`UPDATE ... WHERE status IN ('queued','running')`); persist `queued → processing → review_ready → completed/failed`; add a Netlify scheduled function for stuck-job recovery; merge metadata instead of replacing |
| 9 | FUNC-CV-4 / FUNC-CV-1 | H | S | Check `/apply` response before showing success; real server states in UI; stop hardcoding `text_quality:"good"`/`warnings:[]`; remove the "Extracted from scanned resume" placeholder |
| 10 | SEC-4 / SEC-5 | H | M | Require email verification (or a Google-only link) before attaching an email to a guest; don't auto-link Google to password accounts created without verification; rotate session on upgrade/login; hash session tokens; enforce invite gate in the onboarding route |
| 11 | FUNC-OB-1 / FUNC-OB-2 / FUNC-OB-3 | H | M | Don't persist `currentScreen` until a draft load succeeded; single guest-creation point with an awaited cookie before other calls; merge guest data into the account on sign-in/Google |
| 12 | SEC-6 | H | S | Use the Upstash REST env names (or support `REDIS_URL`); key auth limits by IP *and* email; move the LLM quota to a DB/Redis |
| 13 | SEC-7 | H | S | Prefer `APP_BASE_URL` in production; allow-list hosts for `x-forwarded-host` |
| 14 | FUNC-FP-1 / FUNC-FP-2 / SCALE-3 | H | M | Store GitHub lookups as `detected`/`reference_only` until OAuth-verified; wire the GitHub OAuth button; set `GITHUB_TOKEN`; surface rate-limit/partial status; reduce manifest probes (one tree call) |
| 15 | FUNC-CV-8 | H | S | Send selected claim IDs to `/apply` and apply only those; conflict-log degree overwrite; fix the dead verified-field checks |
| 16 | SCALE-1 / SCALE-2 / FUNC-FP-4 | H | M | Batch inserts (`INSERT ... ON CONFLICT` with unique indexes), `Promise.all` independent reads, move GitHub import to a background job |
| 17 | SEC-9 | M | S | Delete `/api/debug/extractor-config`; require admin capability for `/api/internal/*`; make `/api/ready` side-effect free; take the Render warm-up out of the unauthenticated preflight |
| 18 | SEC-8 | M | S | Fail closed when `EXTRACTOR_API_TOKEN` is missing in production |
| 19 | SEC-10 / SEC-11 | M | S | Person-scope or clear localStorage on sign-out; validate import payload enums; remove the fake "ML Engineer" default |
| 20 | FUNC-CV-5 / FUNC-CV-6 | M | M | Unify the Render and local persistence paths; store `renderDocId` mapping; make export/retry work for local docs or hide those buttons |
| 21 | FUNC-OB-4 / SCALE-6 | M | M | Unique indexes on `evidence_items(person_id, import_key)` and `projects(person_id, lower(title))`; upsert with update; completion idempotency guard |
| 22 | FUNC-FP-3 | M | S | Normalized title/repo-URL dedup across sources |
| 23 | FUNC-CV-7 | M | S | Retry from the stored blob; don't clear prior results until a new attempt succeeds |
| 24 | SCALE-8 | M | M | Python: run OCR in a threadpool (`def` endpoint or `run_in_threadpool`); add a persistent disk or object storage; cross-process locking |
| 25 | SCALE-4 / SCALE-5 / SCALE-7 | M | M | Move blobs to object storage; paginate list endpoints; parallelize `getPerson360`; reuse the tesseract worker |
| 26 | SEC-12 | M | S | Return stable error codes; log details server-side only |
| 27 | FUNC-OB-5 | M | S | Persist uploaded doc id/filename in the draft and rehydrate candidates from the snapshot |
| 28 | DEPLOY-2..10 / §8.2 | M | M | One deploy target; remove `vercel.json`/`.vercelignore` if on Netlify; drop base64 path obfuscation; declare `pdfjs-dist` and `tesseract.js-core`; complete `.env.example`; enable lint in builds; align Node versions |
| 29 | BLOAT-8 / DEPLOY-8 | M | M | Single migration system; disable runtime DDL in production by default |
| 30 | UI-1 / UI-2 / UI-3 / UI-4 | M | M | Real progress and cancel; replace `alert`/`confirm` with accessible dialogs; honest empty/error states |
| 31 | SCALE-13 | M | S | Single source of truth for upload/page limits shared by client, Next and Python |
| 32 | FUNC-MISC-1 / FUNC-MISC-2 | L | S | Faculty routing in the `/student` layout server-side; faculty restore screen |
| 33 | SEC-14 / SEC-15 / SEC-16 | L | S | Use `verifySameOrigin` on mutating routes; stronger password policy; tighten CSP |
| 34 | UI-5 / UI-6 / UI-7 / UI-8 / UI-12 | L | M | Focus-visible styles, focus traps, companion placement, step counters; browser pass at 1280/1440/1920 |
| 35 | Dead code §2 / BLOAT-1..15 | L | M | Delete unused files, routes and exports; extract helpers in the extract route; move benchmarks out of `lib/`; archive certification docs |
| 36 | Docs §8.4 / types §8.3 | L | S | Fix the README broken link; remove `any` in critical paths; write a current deploy runbook |

*End of report.*
