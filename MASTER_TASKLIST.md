# AI TATHASTU — MASTER REBUILD TASK LIST

> **Status Tracking Convention & Working Rule:**
> This document is the single source of truth for the AI Tathastu rebuild. As work progresses in future sessions, tasks must be checked off (`- [x]`) **only when accompanied by a one-line note detailing concrete verification evidence** (e.g. passing unit/integration test command, verified network log, Playwright snapshot, or database assertion) — never marked done on claim alone. Do not create competing task lists or status documents elsewhere in the repository.

---

## AUDIT & LEGACY RESOLUTION RECONCILIATION

### Bug Inventory Coverage Matrix from `scratch/audit/AUDIT.md`
- **BUG #1 (BLOCKING)** — *EORA Tour Speech Cloud "Next" Button Fails to Advance Screen 2*: Covered in **Phase 1, Task 1.4.1** & **Phase 2, Task 2.1.8**.
- **BUG #2 (DEGRADING)** — *Onboarding Draft Restoration Drops Graduation Year on Screen 4*: Covered in **Phase 2, Task 2.1.9**.
- **BUG #3 (DEGRADING)** — *GitHub OAuth Callback Uses Hardcoded Production Vercel Origin on Localhost*: Covered in **Phase 1, Task 1.5.4**.
- **BUG #4 (DEGRADING)** — *Floating EORA Panel Disconnected from Real Grounded RAG Chat API*: Covered in **Phase 1, Task 1.4.3** & **Phase 1, Task 1.4.4**.
- **BUG #5 (COSMETIC)** — *"Research" Module Is an Adaptive Workspace Link Rather Than Dedicated Route*: Superseded by the **Phase 3 Full UI Rebuild** (cosmetic and visual flaws in the legacy UI are replaced by the new architecture and are not individually tracked).

---

## PHASE 1 — Core Data, Extraction, and Backend Intelligence

### 1.1 Resume Parsing Quality & Document Pipeline
- [ ] **1.1.1 Two-column and layout-aware reading order reconstruction**
  - **Context/Current State**: Partial implementation exists in `lib/resume/layout.ts` (tested offline via `scripts/verify-resume-pipeline.ts` for two-column ordering and bullet normalization). Must be connected end-to-end to document ingestion.
  - **Work Required**: Ensure `lib/resume/layout.ts` and `lib/resume/document-text.ts` correctly process bounding boxes, font heights, and column boundaries extracted from both native text PDFs and scanned documents. Right-aligned dates and locations must remain discrete cells separated by delimiter bars rather than concatenated into job or project titles.
  - **Files**: `lib/resume/layout.ts`, `lib/resume/document-text.ts`, `lib/services/resume-extraction-service.ts`
  - **Done Criteria**: Layout parser outputs single-stream reading order where sidebars, headers, experience blocks, and right-aligned dates retain strict semantic separation; verified via test suite `npm run test:resume-pipeline`.

- [ ] **1.1.2 Schema-constrained LLM resume structuring via IntelligenceRouter multi-provider pool**
  - **Context/Current State**: `lib/resume/schema.ts` defines `ResumeExtractionSchema` and `RESUME_EXTRACTION_JSON_SCHEMA`. `lib/resume/structure.ts` currently executes a direct Groq-only API call, completely bypassing `lib/intelligence/router.ts`.
  - **Work Required**:
    - Refactor `structureResumeText` in `lib/resume/structure.ts` to route requests exclusively through `IntelligenceRouter` (`lib/intelligence/router.ts`).
    - Integrate the full configured multi-provider pool: Groq, Mistral, Cerebras, Gemini, OpenRouter, and SambaNova (2 API keys each per `CLOUD_AI_PROVIDER_ORDER`).
    - Enforce strict JSON schema mode (`json_schema` / `responseSchema` with `strict: true`) on all providers in the pool that natively support it (Groq, Gemini, OpenRouter).
    - Explicit capability gating: For providers in the pool lacking native strict JSON schema enforcement (e.g. specific Cerebras, Mistral, or SambaNova endpoints), either filter them out of the resume structuring task in `IntelligenceRouter` or implement an immediate Zod parse-and-retry validation step with structured repair prompts. Do not assume uniform schema-enforcement capabilities across all 6 providers.
    - Nullable fields must be handled explicitly without crashing Zod parsing. Prevent hallucinated dates, fabricated metrics, or omitted link domains.
  - **Files**: `lib/resume/schema.ts`, `lib/resume/structure.ts`, `lib/services/resume-extraction-service.ts`, `lib/intelligence/router.ts`, `lib/intelligence/providers/adapters.ts`
  - **Done Criteria**: Resume structuring routes through `IntelligenceRouter`; disabling or rate-limiting Groq automatically falls back to Gemini/OpenRouter with valid `ResumeExtraction` conforming strictly to schema; Zod validation passes without stripping keys.

- [ ] **1.1.3 Grounding validation and anti-hallucination guard**
  - **Context/Current State**: `sanitizeResumeExtraction` in `lib/services/resume-extraction-service.ts` cleans glyphs and normalizes URLs. `toInterpretation` checks token existence.
  - **Work Required**: Enforce exact or fuzzy character substring verification against the normalized raw resume text for all extracted skills, degree names, company names, and project repositories. Any extracted token not grounded in the source text must either be discarded or flagged with `provenance: "inferred"` rather than `"verified"`.
  - **Files**: `lib/services/resume-extraction-service.ts`, `lib/services/extraction-validator.ts`
  - **Done Criteria**: Automated tests assert that injecting fictitious technologies into LLM mock outputs results in rejection by `sanitizeResumeExtraction` and grounding checks.

- [ ] **1.1.4 Scanned PDF OCR pipeline and Render extractor synchronization**
  - **Context/Current State**: Python microservice exists in `services/resume-extractor/` (FastAPI + PyMuPDF + Tesseract/Pillow) deployed to Render via `render.yaml`. Client wrapper is `lib/services/extractor-service-client.ts`.
  - **Work Required**: Align Python extractor output schemas (`services/resume-extractor/app/schema.py`) with the Next.js `lib/resume/schema.ts` format. Implement layout-aware bounding box extraction in `services/resume-extractor/app/document.py` when PyMuPDF encounters image-only or low-text PDF pages. Ensure healthcheck probe and authorization token (`EXTRACTOR_API_TOKEN`) handle Render cold starts gracefully.
  - **Files**: `services/resume-extractor/app/main.py`, `services/resume-extractor/app/document.py`, `services/resume-extractor/app/schema.py`, `lib/services/extractor-service-client.ts`, `lib/services/resume-ingestion-service.ts`
  - **Done Criteria**: A scanned image PDF uploaded to `/api/resume/extract` invokes OCR on Render, returns structured blocks with bounding coordinates, and resolves in `resume_documents` within 30s.

- [ ] **1.1.5 End-to-end integration and persistence in `resume_documents`**
  - **Context/Current State**: Ingestion route `app/api/resume/extract/route.ts` creates document rows and job records.
  - **Work Required**: Persist canonical extraction results in `resume_documents.extractedProfile` and populate initial candidates in `onboarding_drafts`. Verify document lifecycle transitions: `uploaded` → `queued` → `processing` → `completed` (or `partial` / `failed`).
  - **Files**: `app/api/resume/extract/route.ts`, `app/api/resume/[id]/status/route.ts`, `lib/services/resume-ingestion-service.ts`, `lib/db/schema.ts`
  - **Done Criteria**: Uploading a PDF via `POST /api/resume/extract` returns `jobId` and `documentId`; subsequent polling to `/api/resume/[id]/status` returns status `review_ready` with structured profile and candidate claims.

---

### 1.2 Data Provenance and Source Precedence Architecture
- [ ] **1.2.1 Deterministic source precedence hierarchy**
  - **Context/Current State**: `evidence_items`, `projects`, and `person_profiles` store source references, but precedence is applied ad-hoc across services.
  - **Work Required**: Formalize global source precedence order: `resume` > `github` > `other_external` (`linkedin`, `leetcode`, `hackerrank`, `kaggle`, `scholar`) > `manual`. When aggregating profile fields (e.g. graduation year, institution, core skills), the highest-precedence source provides the primary default, while preserving all conflicting values in `source_conflicts`.
  - **Files**: `lib/services/cross-source-fusion-service.ts`, `lib/repositories/evidence-repository.ts`, `lib/repositories/project-repository.ts`
  - **Done Criteria**: Integration test verifies that when conflicting graduation years or institution names are supplied by GitHub, LinkedIn, and Resume, the Resume value is selected by default, and a conflict entry is logged in `source_conflicts`.

- [ ] **1.2.2 Full provenance metadata tracking across evidence and projects**
  - **Context/Current State**: `evidence_items` has `source`, `sourceReference`, `importKey`, and `interpretation`. `projects` has `sources` array and `normalizedTitle`.
  - **Work Required**: Ensure every recorded evidence item, project attribute, and skill claim contains complete provenance metadata: `{ source: string, sourceReference: string, observedAt: string, confidenceScore: number, importKey: string, editable: boolean }`. Provide explicit repository methods to update, override, or delete data on a per-source basis without affecting data from other sources.
  - **Files**: `lib/repositories/evidence-repository.ts`, `lib/repositories/project-repository.ts`, `lib/repositories/connection-repository.ts`, `lib/db/schema.ts`
  - **Done Criteria**: Database inspection confirms all rows in `evidence_items` and `projects` contain non-null `source` and `sourceReference`; per-source deletion removes only records matching that source.

- [ ] **1.2.3 Cross-source project deduplication and normalization**
  - **Context/Current State**: Unique index `uq_projects_person_normalized_title` exists on `projects(personId, normalizedTitle)`.
  - **Work Required**: Expand `normalizeProjectTitle` in `lib/repositories/project-repository.ts` to intelligently merge identical projects discovered across Resume, GitHub repositories, and manual entry (matching on repository URLs, sanitized title strings, and demo links). Merging must append to `projects.sources` (e.g. `['resume', 'github']`) rather than creating duplicate records or throwing unique constraint violations.
  - **Files**: `lib/repositories/project-repository.ts`, `lib/connectors/github/mapper.ts`, `lib/services/cross-source-fusion-service.ts`
  - **Done Criteria**: Syncing a GitHub repo with title "Pathified" when a resume project titled "Pathified (AI Career App)" already exists links the GitHub metadata (stars, repo URL) to the existing project row without constraint violations.

- [ ] **1.2.4 Multi-source concurrent write serialization & row-level locking**
  - **Dependency Note**: Must run alongside Task 1.2.2 and Task 1.6.6; coordinates concurrent writes to the same tables.
  - **Context/Current State**: In `lib/services/onboarding-v2-service.ts`, `writeOnboardingDraft` executes a shallow merge: `draft: sql`${onboardingDrafts.draft} || ${JSON.stringify(patch)}::jsonb``. When multiple async scrapers (GitHub, LinkedIn, Scholar) complete simultaneously while the student is actively typing, shallow JSONB merges clobber concurrent array mutations (`skills`, `projects`, `discoveredResumeProfiles`). Furthermore, concurrent scraper writes to `projects` and `evidence_items` risk unique constraint race conditions.
  - **Work Required**:
    - Implement row-level serialization (`FOR UPDATE` transaction lock on `onboarding_drafts`) during draft mutations.
    - Deep-merge nested arrays by deduplicating identifiers rather than blind replacement.
    - Ensure all concurrent entity writes to `projects` and `evidence_items` utilize transactional `ON CONFLICT DO UPDATE` upserts.
  - **Files**: `lib/services/onboarding-v2-service.ts`, `lib/repositories/evidence-repository.ts`, `lib/repositories/project-repository.ts`
  - **Done Criteria**: Concurrently firing 5 simulated scraper completion payloads while simultaneously issuing client autosave PUT requests results in 100% data retention in `onboarding_drafts` and zero unique constraint crashes.

---

### 1.3 Skills Evidence Traceability & Confidence Scoring
- [ ] **1.3.1 Verifiable evidence-based confidence scoring engine**
  - **Context/Current State**: Skills currently report heuristic counts or static tiers (e.g. 4/4/4/8 in `AUDIT.md`).
  - **Work Required**: Replace static heuristics with a deterministic scoring formula calculated from verifiable evidence traces:
    - *Tier 1 (1.0 / Verified)*: Verified by authorized faculty review (`verificationStatus: "verified"`) or standardized assessment result (ERIS / AI Interview).
    - *Tier 2 (0.80 - 0.90 / Corroborated)*: Corroborated across 2+ distinct external sources (e.g. Resume claim + active GitHub repository using manifests/languages, or verified LeetCode/HackerRank badge).
    - *Tier 3 (0.60 - 0.75 / Evidenced)*: Observed in a single verifiable artifact (e.g. GitHub repo with commit history or resume line item with concrete project context).
    - *Tier 4 (0.30 - 0.50 / Declared)*: Self-reported during onboarding without external verification.
    - *No placeholder or fabricated numbers*.
  - **Files**: `lib/services/skill-intelligence-service.ts`, `lib/domain/evidence.ts`, `lib/domain/readiness.ts`
  - **Done Criteria**: `GET /api/student/skills` returns skills with deterministic `confidenceScore` (0.0 to 1.0) and explainable breakdown; verified by unit tests asserting score calculations across various evidence combinations.

- [ ] **1.3.2 Explainable 7 Tathastu Questions data resolution**
  - **Context/Current State**: `sevenQuestions` object structure is defined in `lib/services/skill-intelligence-service.ts`.
  - **Work Required**: Verify that every skill record dynamically populates all 7 explainability answers linking back to primary database IDs:
    1. *What is this skill?* (Canonical taxonomy definition)
    2. *Where was it observed?* (Clickable source references: file line, commit, assessment ID)
    3. *What is the verification status?* (Pending, Verified, Corroborated)
    4. *How does it relate to your goal?* (`required_core`, `recommended`, `specialization`)
    5. *What are demonstrated projects?* (Linked `projects.id`)
    6. *What are demonstrated code artifacts?* (GitHub files / manifests observed)
    7. *What is the recommended next action?* (Roadmap gap-fill link)
  - **Files**: `lib/services/skill-intelligence-service.ts`, `lib/domain/aiml-role-taxonomy.ts`
  - **Done Criteria**: API response for `GET /api/student/skills` contains non-null `sevenQuestions` for all tracked skills with genuine evidence links.

---

### 1.4 EORA Engine Separation: Zero-LLM Tour Engine vs Grounded RAG Chat
- [ ] **1.4.1 EORA Zero-LLM Rules-Based Tour Guide and Insights Engine**
  - **Context/Current State**: Tour logic is scattered between `components/eora/eora-floating-companion.tsx`, `lib/eora/page-registry.ts`, and `lib/eora/tours.ts`. BUG #1 is present here.
  - **Work Required**:
    - Cleanly isolate the deterministic tour-guide and contextual page helper into a zero-LLM engine.
    - Tour engine must read existing user data only (`lib/eora/context.ts`) without calling any LLM API.
    - **Fix BUG #1 (BLOCKING)**: Eliminate brittle DOM ID lookups (`document.getElementById("eora-onboarding-next-btn")`). Refactor `EoraFloatingCompanion` to accept explicit callback props or dispatch custom DOM events (`eora:advance-step`) that onboarding form containers listen to directly, ensuring Screen 2 and all other screens advance reliably.
  - **Files**: `components/eora/eora-floating-companion.tsx`, `components/eora/eora-speech-cloud.tsx`, `lib/eora/tours.ts`, `lib/eora/page-registry.ts`, `components/exact-screens/Screen2EoraIntro.tsx`
  - **Done Criteria**: Clicking "Next" in EORA Speech Cloud on Screen 2 and subsequent steps reliably triggers form submission and navigates to the next screen; verified via Playwright/node test without swallowing clicks.

- [ ] **1.4.2 Zero-LLM page context and hint generation**
  - **Context/Current State**: `lib/eora/context.ts` generates structured context payloads from `Person 360`.
  - **Work Required**: Ensure `GET /api/eora/context` serves role-based, deterministic guidance hints (e.g. missing skills alerts, unlinked GitHub repositories, stale sync reminders) generated via rule tables in `lib/eora/tasks.ts` with zero external LLM latency.
  - **Files**: `app/api/eora/context/route.ts`, `lib/eora/context.ts`, `lib/eora/tasks.ts`
  - **Done Criteria**: `GET /api/eora/context` responds in <50ms with actionable `suggestedHints` derived purely from database state.

- [ ] **1.4.3 Grounded RAG Chat assistant UI reconnection**
  - **Context/Current State**: **BUG #4 (DEGRADING)**: `POST /api/eora/chat` (`app/api/eora/chat/route.ts`) is a functional RAG endpoint with Groq/GPT integration, but completely orphaned from the UI companion, which uses a hardcoded dialogue state table.
  - **Work Required**:
    - Build a clean conversational drawer/modal interface wired directly to `POST /api/eora/chat`.
    - Support real streaming or fast async responses with user query input, loading indicator, and error boundary.
    - Render markdown response formatting, structured citation cards (`referencedSources`), and executable action buttons (`proposedAction`).
    - Resolve BUG #4 by removing the legacy static dialogue lookup for user free-form queries.
  - **Files**: `app/api/eora/chat/route.ts`, `components/eora/eora-floating-companion.tsx`, new chat drawer component
  - **Done Criteria**: Submitting a natural-language question in the UI fires `POST /api/eora/chat`, displays streaming or complete response with source citations and actionable buttons within 3-5 seconds.

- [ ] **1.4.4 RAG prompt defense, rate limiting, and quota enforcement**
  - **Context/Current State**: `sanitizeTextForPrompt` and `wrapUntrustedContent` exist in `lib/intelligence/prompt-defense.ts`. `checkAiQuota` exists in `lib/intelligence/cost-control.ts`.
  - **Work Required**: Ensure all user queries and external profile data (GitHub READMEs, LinkedIn bios) injected into `POST /api/eora/chat` system prompts are sanitized against prompt injection. Enforce per-user token rate limits (10 req/min, daily quota) via `lib/intelligence/cost-control.ts`.
  - **Files**: `app/api/eora/chat/route.ts`, `lib/intelligence/prompt-defense.ts`, `lib/intelligence/cost-control.ts`
  - **Done Criteria**: Attempted prompt injections are neutralized; exceeding token quota returns clean HTTP 429 with explanatory user-facing message.

---

### 1.5 GitHub Scraping Depth, Speed & Batching
- [ ] **1.5.1 Batched GraphQL repository and language acquisition**
  - **Context/Current State**: `lib/connectors/github/client.ts` executes sequential REST calls to `/users/{username}/repos`, `/languages`, `/readme`, and 8 candidate manifest files per repository, triggering rate limits and serverless request timeouts.
  - **Work Required**: Migrate repository discovery and deep metadata inspection to a single batched GitHub GraphQL v4 query (`https://api.github.com/graphql`). Fetch repository names, descriptions, URLs, stargazers, forks, primary languages, language byte breakdowns, topics, and target manifest file contents (`HEAD:package.json`, `HEAD:requirements.txt`, `HEAD:pyproject.toml`, `HEAD:Dockerfile`) in a single network round-trip.
  - **Files**: `lib/connectors/github/client.ts`, `lib/connectors/github/graphql-queries.ts`, `lib/services/github-sync-service.ts`
  - **Done Criteria**: Syncing an account with 20 repositories completes in under 3 seconds using at most 2 GraphQL queries instead of 60+ individual REST requests.

- [ ] **1.5.2 Incremental synchronization and checksum caching (Settled 6h TTL)**
  - **Context/Current State**: `calculateProjectChecksum` in `lib/connectors/github/client.ts` computes SHA-256 hashes of repo states.
  - **Work Required**:
    - Lock in settled caching policy: GitHub repositories are cached with a **6-hour TTL** or updated on-demand via explicit user "Sync Now" action.
    - **Strict Policy**: Page navigation must NEVER trigger a blocking live scrape against GitHub; all views serve persisted database records from `projects` and `source_snapshots`.
    - Use repository `pushed_at` timestamps and checksum comparison against `source_snapshots` table. If repository content has not changed since the last sync run, skip re-parsing manifests and technology detection.
  - **Files**: `lib/services/github-sync-service.ts`, `lib/connectors/github/client.ts`, `lib/repositories/connection-repository.ts`
  - **Done Criteria**: Consecutive sync requests on unchanged repositories return `recordsChanged: 0` without re-processing manifests or updating database rows; page navigation executes in <50ms with zero live GitHub API queries.

- [ ] **1.5.3 Partial-failure isolation and rate-limit backoff**
  - **Context/Current State**: Basic try/catch blocks exist in `github-sync-service.ts`.
  - **Work Required**: Isolate per-repository extraction failures. If deep inspection of one repository fails (e.g. malformed JSON or binary blob), capture error in `sync_runs` and continue processing remaining repositories. Honor GitHub `X-RateLimit-Reset` headers with circuit-breaking.
  - **Files**: `lib/services/github-sync-service.ts`, `lib/connectors/github/client.ts`
  - **Done Criteria**: Sync run completes with status `partial` and returns all valid repositories when one malformed repository causes a parse error.

- [ ] **1.5.4 Fix BUG #3 (DEGRADING) — Localhost GitHub OAuth redirect origin**
  - **Context/Current State**: In `app/api/auth/github/start/route.ts`, `getCanonicalOrigin(req)` prioritizes `process.env.APP_BASE_URL` (`https://tathastuai.vercel.app`) over the request host header, redirecting local developers to production.
  - **Work Required**: Update `getCanonicalOrigin` in `app/api/auth/github/start/route.ts` to inspect incoming `Host` and `X-Forwarded-Host` headers when in development or non-production environments (`NODE_ENV !== "production"` or host starts with `localhost`), generating accurate `http://localhost:3000/api/auth/github/callback` redirects.
  - **Files**: `app/api/auth/github/start/route.ts`, `lib/auth/origin.ts`
  - **Done Criteria**: Initiating GitHub OAuth on localhost targets `http://localhost:3000/api/auth/github/callback`; verified via curl/browser network request.

---

### 1.6 New Digital Footprint Integrations
- [ ] **1.6.1 Fully Optional LinkedIn Scraper Integration via `joeyism/linkedin_scraper` & Credential Encryption**
  - **Context/Current State**: `lib/connectors/linkedin/client.ts` is currently reference-linking and manual CSV export only.
  - **Work Required**:
    - **Fully Optional Integration**: The entire LinkedIn connection must be completely OPTIONAL throughout onboarding and profile. No onboarding step, profile completeness score, or downstream feature may require it.
    - **UI Guidance**: Copy must clearly frame LinkedIn connection as "recommended, not required" to enhance collaboration matching and professional networking signal, with an unambiguous "Skip / I'll do this later" action.
    - **Architecture & Deployment**: Implement a dedicated scraper worker endpoint on the Docker-based Render service (`services/resume-extractor/`) where Python, Selenium, Headless Chromium, and `linkedin_scraper` run.
    - **Credential Encryption-at-Rest**: Ingest user credentials using the EXACT SAME AES-256-GCM pattern from `lib/security/connection-token.ts`. Passwords must be encrypted immediately using `EXTERNAL_TOKEN_ENCRYPTION_KEY` and AAD bound to `personId`. Raw plaintext passwords must NEVER be saved to the database or written to logs.
    - **Real-Time OTP Relay Architecture**: If Selenium encounters a LinkedIn verification challenge (SMS OTP or email PIN), the worker pauses execution in a waiting state for up to 60s, signals Next.js via polling/SSE (`CHALLENGE_REQUIRED`), prompts the user in a UI modal, and relays the submitted OTP code back to the session to complete authentication.
    - **Safety & Settled Cooldown**: Enforce a settled **minimum 14-day re-scrape cooldown** to protect student accounts from bot detection. Page views must NEVER trigger live LinkedIn scraping.
  - **Files**: `services/resume-extractor/app/linkedin.py`, `services/resume-extractor/requirements.txt`, `services/resume-extractor/Dockerfile`, `lib/connectors/linkedin/client.ts`, `lib/security/connection-token.ts`, `lib/services/digital-source-import-orchestrator.ts`
  - **Done Criteria**: Submitting encrypted credentials triggers headless scraper on Render; if challenged, 60s OTP relay accepts verification code and extracts profile; skipping LinkedIn leaves onboarding at 100% completion with zero penalties; passwords verified encrypted in PostgreSQL.

- [ ] **1.6.2 Verified ID-Only Google Scholar / Semantic Scholar Integration (No Name Matching)**
  - **Context/Current State**: No Google Scholar connector exists (only ORCID in `lib/connectors/research-and-dev/client.ts`).
  - **Settled Policy & Architecture**:
    - **Zero Name-Guessing Fallback**: To eliminate false-positive attribution of someone else's research, academic paper ingestion runs ONLY when the user explicitly provides a verified **ORCID iD** or **Semantic Scholar Author ID**. Name + institution guessing is strictly prohibited.
    - **Fully Optional Field**: The UI collects ORCID or Semantic Scholar Author ID as an explicit, optional profile field. If unprovided, publication ingestion simply does not run.
    - **Implementation**: Query Semantic Scholar API (`https://api.semanticscholar.org/graph/v1/author/{author_id}/papers`) and OpenAlex API by verified ID, extracting paper titles, publication years, venues, co-authors, citation counts, and live DOI links into `evidence_items`.
    - **Settled TTL**: Cache results for **7 days**. Page views serve persisted database records only.
  - **Files**: `lib/connectors/research-and-dev/scholar-client.ts`, `lib/connectors/research-and-dev/client.ts`, `lib/services/digital-source-import-orchestrator.ts`
  - **Done Criteria**: Ingesting a verified Semantic Scholar Author ID or ORCID fetches published papers, citations, and DOIs into `evidence_items` with `source: "scholar"`; omitting an author ID executes zero external queries and records no false-positive papers.

- [ ] **1.6.3 Kaggle Public Profile & Artifact Extractor (Settled 24h TTL)**
  - **Context/Current State**: `fetchKaggleProfile` in `lib/connectors/research-and-dev/client.ts` is a synchronous stub accepting manual entries.
  - **Work Required**:
    - Implement asynchronous Kaggle extractor querying user profile summary, tier/rank (Grandmaster, Master, Expert), competition medals, notebook upvotes, and public dataset contributions via public web endpoints with fallback to user-supplied Kaggle API key (encrypted via `EXTERNAL_TOKEN_ENCRYPTION_KEY`).
    - Map datasets and notebooks directly into `projects` and `evidence_items`.
    - Lock in settled **24-hour cache TTL**. Page navigation serves cached database rows only.
  - **Files**: `lib/connectors/research-and-dev/client.ts`, `lib/connectors/research-and-dev/kaggle-client.ts`, `lib/services/digital-source-import-orchestrator.ts`
  - **Done Criteria**: Providing a valid Kaggle username fetches public tier, competition count, and public notebooks, populating candidate project rows with `source: "kaggle"`; cached for 24h.

- [ ] **1.6.4 LeetCode GraphQL Connector Hardening & Caching (Settled 24h TTL)**
  - **Context/Current State**: Basic GraphQL client exists in `lib/connectors/leetcode/client.ts`.
  - **Work Required**:
    - Expand query to capture global ranking, contest rating, and badge list in addition to solved counts (Easy/Medium/Hard).
    - Lock in settled **24-hour cache TTL** in Redis / `source_snapshots` to prevent IP rate-limiting. Page views never trigger live GraphQL queries.
    - Transform solved thresholds into competency evidence items (e.g. "LeetCode 200+ Problems Solved: Data Structures & Algorithms").
    - Implement failure isolation: if LeetCode GraphQL times out or returns HTTP 429, fall back to cached snapshot or link-only reference without failing overall sync.
  - **Files**: `lib/connectors/leetcode/client.ts`, `lib/services/coding-profile-intelligence-service.ts`
  - **Done Criteria**: Querying a LeetCode handle returns problem breakdown and contest rating; repeated requests within 24 hours are served from cache; timeout fails gracefully without blocking other sources.

- [ ] **1.6.5 HackerRank Public REST Extractor & Badge Ingestion (Settled 24h TTL)**
  - **Context/Current State**: `fetchHackerRankProfile` in `lib/connectors/coding-platforms/client.ts` fetches public badges.
  - **Work Required**:
    - Query HackerRank public endpoints: `https://www.hackerrank.com/rest/hackers/{username}/badges` and `/scores_elo`.
    - Ingest earned stars and domain badges (e.g. "Problem Solving: 5 Stars", "Python: 5 Stars") into `evidence_items` and map to `person_skills`.
    - Lock in settled **24-hour cache TTL** and timeout protection (5-second timeout). Page views serve persisted database records only.
  - **Files**: `lib/connectors/coding-platforms/client.ts`, `lib/services/coding-profile-intelligence-service.ts`
  - **Done Criteria**: Ingesting a HackerRank handle parses stars and badges into verified domain skills; network errors are caught and isolated; cached for 24h.

- [ ] **1.6.6 Scraper Failure Isolation, Settled TTLs & Non-Blocking Policy**
  - **Context/Current State**: `digital-source-import-orchestrator.ts` runs sequential source imports.
  - **Work Required**:
    - Wrap all external scrapers (LinkedIn, Scholar, Kaggle, LeetCode, HackerRank, GitHub) in `Promise.allSettled` with independent error boundaries. Failure of any single external platform must NEVER block other platforms or abort the overall user sync.
    - **Lock in settled refresh TTLs**: GitHub (6h / on-demand), LeetCode/HackerRank (24h), Kaggle (24h), Scholar/OpenAlex (7d), LinkedIn (14d cooldown).
    - **Strict Policy**: Page navigation must NEVER trigger a blocking live scrape; all screens serve persisted database snapshots; live syncs run only via explicit user action ("Sync Now") or background cron.
    - Record individual sync statuses in `sync_runs`.
  - **Files**: `lib/services/digital-source-import-orchestrator.ts`, `lib/repositories/connection-repository.ts`
  - **Done Criteria**: Simulating an offline external endpoint during a multi-source sync succeeds for all other sources and logs the failed provider without HTTP 500 error; all page loads execute instantly from cache.

- [ ] **1.6.7 LinkedIn Credential Purge & Scraper Session Invalidation on Disconnect**
  - **Dependency Note**: Must run after Task 1.6.1; provides complete security lifecycle for stored encrypted credentials.
  - **Context/Current State**: `disconnectConnection` in `lib/repositories/connection-repository.ts` sets `status: "disconnected"` and `disconnectedAt: new Date()`, leaving encrypted credentials intact in `metadata.encryptedAccessToken`.
  - **Work Required**: When a student disconnects their LinkedIn account from onboarding or `/student/connections`, actively overwrite and nullify `metadata.encryptedPassword` and `metadata.sessionCookies` in PostgreSQL. Send an invalidation request to the Render scraper service to terminate any persistent browser session or cached Selenium profile.
  - **Files**: `lib/services/github-sync-service.ts`, `lib/repositories/connection-repository.ts`, `services/resume-extractor/app/linkedin.py`
  - **Done Criteria**: Inspecting PostgreSQL database after clicking "Disconnect LinkedIn" confirms `metadata.encryptedPassword` is completely deleted (`undefined`/`null`), not merely marked disconnected.

- [ ] **1.6.8 LinkedIn Scraper Account Protection, OTP Relay & Checkpoint Circuit-Breaker**
  - **Dependency Note**: Must run after Task 1.6.1; defends student LinkedIn accounts against automated anti-bot suspension.
  - **Context/Current State**: Headless Selenium scrapers hitting LinkedIn login pages from cloud IP pools (Render/AWS) frequently trigger automated security checkpoints (CAPTCHA, email verification PIN, or account verification). Repeated automated attempts will lock or ban the student's personal account.
  - **Work Required**:
    - Strictly cap automated login attempts to **1 attempt per 24 hours per account**.
    - Build real-time OTP relay modal: When Selenium encounters a checkpoint challenge (SMS OTP or email PIN), the server pauses the session for up to **60 seconds**, signals Next.js (`CHALLENGE_REQUIRED`), prompts the user in the UI for the SMS/email code, and relays it back to the session within the bounded 60s window.
    - Fully optional handling: The modal must provide a clear "Cancel / Skip LinkedIn" action so students can dismiss the challenge without any penalty or impact on onboarding completion.
    - If a hard CAPTCHA or temporary account hold is encountered, abort immediately without retrying, log the checkpoint, and notify the user safely.
  - **Files**: `services/resume-extractor/app/linkedin.py`, `lib/connectors/linkedin/client.ts`, `components/auth/OtpRelayModal.tsx`
  - **Done Criteria**: When LinkedIn issues an OTP challenge, the scraper pauses up to 60s, prompts in UI modal, relays the code back to the session, and completes extraction; dismissing the modal skips LinkedIn with zero penalty; on CAPTCHA, halts immediately after 1 attempt.

---

### 1.7 Cost Control & Rate-Limit Infrastructure
- [ ] **1.7.1 Distributed Token Quota & Cost Control via Upstash Redis**
  - **Dependency Note**: Must run before deploying LLM call sites in Tasks 1.1.2, 1.4.3, and 2.5.2; coordinates cost limits across distributed serverless instances.
  - **Context/Current State**: `lib/intelligence/cost-control.ts` uses an in-memory `new Map<string, UserUsage>()` (`userDailyUsage`). In Vercel serverless environments, in-memory Maps are wiped on cold starts and never shared across concurrent lambda instances, allowing users to exceed `CLOUD_AI_GLOBAL_DAILY_LIMIT` and `MAX_DAILY_TOKENS_PER_USER`.
  - **Work Required**:
    - Migrate token quota tracking in `lib/intelligence/cost-control.ts` to atomic Upstash Redis counters (`INCRBY` / `EXPIRE`) with key pattern `ai:usage:${personId}:${date}` and global tracker `ai:usage:global:${date}`.
    - Enforce quota checks in all LLM call sites (Resume Structuring, Project Enhancement, EORA RAG chat).
    - Provide graceful deterministic fallbacks when quotas are exhausted.
  - **Files**: `lib/intelligence/cost-control.ts`, `lib/cache/redis.ts`, `lib/resume/structure.ts`, `app/api/eora/chat/route.ts`
  - **Done Criteria**: Concurrent simulated requests across multiple processes increment shared Redis token totals; hitting limit rejects subsequent calls with HTTP 429 across all serverless instances.

- [ ] **1.7.2 External Connector Circuit Breaker & Settled Rate-Limit Registry**
  - **Dependency Note**: Coordinates across all scrapers in Tasks 1.5 and 1.6 to prevent external IP blacklisting.
  - **Context/Current State**: Rate-limit handling is currently fragmented across connector files (GitHub checks headers, LeetCode catches 429, HackerRank has 5s timeout, Scholar has no tracking).
  - **Work Required**:
    - Build a unified external API rate-limit and circuit breaker registry in `lib/connectors/rate-limiter.ts`.
    - Track requests and enforce provider limits: GitHub (5000/hr auth), Semantic Scholar (100 req/5min without key), LeetCode (20 req/min), HackerRank (30 req/min).
    - Enforce settled refresh TTLs across all external connectors: GitHub (6h / on-demand), LeetCode/HackerRank (24h), Kaggle (24h), Scholar/OpenAlex (7d), LinkedIn (14d minimum cooldown).
    - Enforce strict policy: Page navigation must NEVER trigger a blocking live scrape against any external provider; all pages serve cached/persisted DB snapshots; live syncs run exclusively via explicit user action (e.g. "Refresh my data" / "Sync Now" button) or background cron.
    - If an external provider returns HTTP 429 or times out 3 times consecutively, trip the circuit breaker for 5 minutes and immediately serve cached database snapshots.
  - **Files**: `lib/connectors/rate-limiter.ts`, `lib/connectors/github/client.ts`, `lib/connectors/leetcode/client.ts`, `lib/connectors/research-and-dev/scholar-client.ts`
  - **Done Criteria**: Receiving HTTP 429 from LeetCode or Scholar trips provider circuit breaker; subsequent queries return cached fallback immediately without issuing network calls during cooldown; all page loads execute instantly without blocking live scrapes.

---

### 1.8 Rebuild-Order Isolation & Headless Verification
- [ ] **1.8.1 Headless backend test harness for Phase 1 & 2 contracts**
  - **Dependency Note**: Prerequisite for Phase 3 UI teardown; ensures all data pipelines and API contracts are certified via CLI test scripts independent of frontend React components.
  - **Context/Current State**: Many existing tests in `scratch/audit/` rely on browser automation against the legacy frontend screens (`ExactScreensContainer.tsx`). Once Phase 3 deletes the legacy UI layer, those verification scripts will break.
  - **Work Required**: Create standalone CLI test scripts (`scripts/verify-phase1-backend.ts` and `scripts/verify-phase2-contracts.ts`) executed via `node --import tsx --test`. Test scripts must exercise the API routes, repositories, scrapers, and database mutations directly via HTTP/DB calls without touching React components.
  - **Files**: `scripts/verify-phase1-backend.ts`, `scripts/verify-phase2-contracts.ts`, `package.json`
  - **Done Criteria**: Running `npm run test:backend-contracts` passes 100% of Phase 1 and Phase 2 assertions with zero browser or UI component dependencies.

---

## PHASE 2 — Onboarding Rebuild, Editable Data Everywhere, Dashboard, Project Ledger

### 2.1 Full Onboarding UX Rebuild ("Confirm & Edit What We Found")
- [ ] **2.1.1 Elimination of legacy "Big Goal / Timeline" questions**
  - **Context/Current State**: Screens 3a and 3b in `components/exact-screens/` ask "What is your big goal?" and "When do you want to work toward it?".
  - **Work Required**: Remove the "big goal / timeline" prompt entirely from onboarding flow and schema. Focus onboarding upfront purely on Role Selection (Student, Professional, Switcher), AI/ML Direction (GenAI, ML, Research), and Purpose Ranking (Jobs, Projects, Learning).
  - **Files**: `components/exact-screens/Screen3aPriorities.tsx`, `components/exact-screens/Screen3bAiMlDirection.tsx`, `components/exact-screens/ExactScreensContainer.tsx`, `lib/onboarding-v2.ts`
  - **Done Criteria**: Navigating through onboarding advances directly from Role/Direction to Resume Upload/Review without displaying the legacy timeline/big-goal screen.

- [ ] **2.1.2 OCR pre-filling core philosophy implementation**
  - **Context/Current State**: Partial skip-ahead logic was drafted in `lib/onboarding-resume-coverage.ts`.
  - **Work Required**: Re-architect onboarding controller so that resume extraction runs immediately upon document drop. If confidence is high, all subsequent sections (Academic, Profile, Experience, Skills, Projects, External Links) are pre-populated with extracted values. Onboarding becomes a unified review and confirmation experience rather than an empty question-and-answer flow. Manual entry is presented as a clean fallback option when no resume is uploaded.
  - **Files**: `components/exact-screens/ExactScreensContainer.tsx`, `lib/onboarding-resume-coverage.ts`, `lib/services/onboarding-v2-service.ts`
  - **Done Criteria**: Uploading a comprehensive CV pre-fills Name, University, Degree, Grad Year, GitHub URL, LinkedIn, Skills, and Projects across all draft models.

- [ ] **2.1.3 Real animated full-page processing state (reusable)**
  - **Context/Current State**: `components/exact-screens/ProcessingActivity.tsx` and Screen 7 use simulated timer delays (`setTimeout`) to fake AI analysis progress.
  - **Work Required**: Replace fake timer animations with a real, animated full-page processing state driven by actual backend job polling (`GET /api/resume/[id]/status?jobId=...` checking `source_processing_jobs` status: `acquire` → `extract` → `validate` → `review`). Expose this component as a reusable utility for any flow awaiting backend asynchronous workers.
  - **Files**: `components/exact-screens/ProcessingActivity.tsx`, `components/exact-screens/Screen7AiAnalysis.tsx`, `components/ui/ProcessingOverlay.tsx`
  - **Done Criteria**: The processing animation reflects real server processing stages; transitions to completion immediately when the server returns `review_ready`, without artificial pauses.

- [ ] **2.1.4 Review screen with field-level inline editing across all sections**
  - **Context/Current State**: `Screen5ResumeUpload.tsx` has basic accept/reject candidate checkboxes.
  - **Work Required**: Build a comprehensive, unified review screen supporting full field-level inline editing across every section:
    - *Education*: Institution, Degree, Specialization, Grad Year, GPA (edit value, accept, reject, add new).
    - *Experience*: Company, Role, Dates, Description bullets (edit value, accept, reject, add new).
    - *Projects*: Title, Description, Tech Stack, Repo/Demo URLs (edit value, accept, reject, add new).
    - *Skills*: Categorized skill chips (edit name, toggle accept/reject, add custom skill).
    - *Links*: Discovered profiles (edit URL, verify, remove, add new).
  - **Files**: `components/exact-screens/Screen5ResumeUpload.tsx`, `components/exact-screens/Screen8ProfileInsights.tsx`, `components/exact-screens/Screen9SkillsMap.tsx`
  - **Done Criteria**: User can modify any extracted text field directly in place before accepting; changes persist to `onboardingDrafts` and are reflected in final database mutations upon completion.

- [ ] **2.1.5 Per-source provenance controls (Show / Hide / Delete per source)**
  - **Context/Current State**: Sources are mixed without individual filtering in review screens.
  - **Work Required**: Provide clear source badges (`Resume`, `GitHub`, `LinkedIn`) on every review candidate. Add per-source bulk controls (e.g. "Accept all from Resume", "Exclude GitHub forks", "Delete LinkedIn imports").
  - **Files**: `components/exact-screens/Screen5ResumeUpload.tsx`, `components/exact-screens/Screen8ProfileInsights.tsx`
  - **Done Criteria**: Toggling a source filter shows/hides associated items; bulk actions apply strictly to candidate items matching that source badge.

- [ ] **2.1.6 Optional LinkedIn credential entry consent, copy guidance & 60s OTP relay UI**
  - **Context/Current State**: No credential entry modal exists in onboarding.
  - **Work Required**:
    - Build a secure consent and disclosure step for LinkedIn integration during onboarding.
    - **Optional Guidance**: Prominently frame LinkedIn as **"recommended, not required"**, explaining the benefit (strengthens team collaboration and professional networking signals) while providing an unambiguous "Skip / I'll do this later" button. Connecting LinkedIn must never be required to achieve 100% onboarding completion.
    - Explicit disclosure stating passwords are encrypted using AES-256-GCM authenticated encryption and never stored in plaintext.
    - User consent checkbox required prior to input activation.
    - Password input with secure masked entry.
    - Support real-time 60-second OTP challenge modal if LinkedIn triggers an SMS or email verification code.
  - **Files**: `components/exact-screens/Screen6DigitalFootprints.tsx`, `components/auth/LinkedInCredentialModal.tsx`, `components/auth/OtpRelayModal.tsx`
  - **Done Criteria**: Credential form cannot be submitted without checking mandatory consent; skipping LinkedIn advances onboarding with 100% completion; if challenge triggered, 60s modal accepts verification code.

- [ ] **2.1.7 Onboarding completion idempotency and transaction integrity**
  - **Context/Current State**: `POST /api/onboarding/complete` (or `POST /api/onboarding-v2`) finalizes the onboarding transaction.
  - **Work Required**: Ensure onboarding completion is strictly idempotent. Repeated submissions must not duplicate rows in `evidence_items`, `projects`, or `person_skills`. Wrap all insertions and `users.onboarding_completed = true` updates in a PostgreSQL transaction.
  - **Files**: `app/api/onboarding-v2/route.ts`, `lib/services/onboarding-v2-service.ts`
  - **Done Criteria**: Submitting completion multiple times consecutively returns `200 OK` with identical row counts in `evidence_items` and `projects`.

- [ ] **2.1.8 Fix BUG #1 (BLOCKING) — Onboarding container EORA tour click handler**
  - **Context/Current State**: In `Screen2EoraIntro.tsx`, the submit button lacks the selector targeted by `EoraFloatingCompanion`, causing the tour "Next" button click to be silently swallowed.
  - **Work Required**: Wire `Screen2EoraIntro.tsx` and all subsequent onboarding step forms with standard accessible submit handlers and attach the required ID (`eora-onboarding-next-btn`) or provide an explicit `onNext` prop to the companion controller.
  - **Files**: `components/exact-screens/Screen2EoraIntro.tsx`, `components/eora/eora-floating-companion.tsx`
  - **Done Criteria**: Clicking the "Next" button in the EORA Speech Cloud successfully validates the name field and advances the onboarding flow to Screen 3.

- [ ] **2.1.9 Fix BUG #2 (DEGRADING) — Graduation year draft schema restoration mismatch**
  - **Context/Current State**: In `ExactScreensContainer.tsx`, restoring an abandoned draft drops graduation year because the draft stores `"year": "3rd Year"` while the component expects numeric `expectedGraduationYear`.
  - **Work Required**: Harmonize the draft serialization and rehydration logic in `ExactScreensContainer.tsx` and `app/api/onboarding-v2/route.ts`. Parse string representations (e.g. `"3rd Year"`, `"2027"`) into both display year strings and numeric graduation years, ensuring `#field-gradyear` is populated accurately upon returning to Screen 4.
  - **Files**: `components/exact-screens/ExactScreensContainer.tsx`, `components/exact-screens/Screen4AcademicDetails.tsx`, `app/api/onboarding-v2/route.ts`
  - **Done Criteria**: Logging in as partially onboarded user `test-partial@example.com` restores Screen 4 with `#field-gradyear` displaying `"3rd Year"` / `2027` without dropping the value.

- [ ] **2.1.10 Multi-source non-blocking timeout guard & status aggregation**
  - **Dependency Note**: Depends on Task 1.6.6; ensures onboarding review screen does not hang when 1-2 external sources fail or time out.
  - **Context/Current State**: With multiple data sources running, waiting for all sources sequentially or unconditionally causes the onboarding processing state to hang for 30-60s if any single third-party platform experiences latency.
  - **Work Required**:
    - Implement a strict 8-second timeout per external scraper in the onboarding aggregation pipeline.
    - If primary sources (Resume + GitHub) complete, immediately transition the UI to the Review Screen while background sources finish or time out.
    - Render a "Source Ingestion Summary" banner at the top of the Review Screen displaying real-time badges: e.g. `Resume: 14 claims ✓`, `GitHub: 6 repos ✓`, `LinkedIn: Skipped / Timed out ℹ`, `Scholar: ORCID unprovided (skipped) ℹ`.
  - **Files**: `components/exact-screens/ProcessingActivity.tsx`, `components/exact-screens/Screen5ResumeUpload.tsx`, `lib/services/digital-source-import-orchestrator.ts`
  - **Done Criteria**: Simulating a slow external scraper transitions the onboarding UI to the Review Screen within 8s, rendering extracted Resume/GitHub claims alongside an inline status indicator.

---

### 2.2 "Editable Everywhere" Architecture
- [ ] **2.2.1 In-place editing on Student Dashboard Overview (`/student`)**
  - **Context/Current State**: Dashboard cards are currently display-only.
  - **Work Required**: Implement inline edit triggers on dashboard widgets (Active Target Role, Priority Rankings, Key Goals). Clicking an edit trigger opens an inline editor or modal that updates `user_preferences` or `goals` and instantly triggers optimistic UI re-composition without full page reload.
  - **Files**: `app/student/page.tsx`, `components/workspace/AdaptiveWorkspace.tsx`, `app/api/workspace/preferences/route.ts`
  - **Done Criteria**: Changing the active target role or priority ranking on `/student` updates the database and immediately re-sorts and re-renders workspace modules.

- [ ] **2.2.2 In-place editing on Person 360 Profile (`/student/profile`)**
  - **Context/Current State**: Profile page displays contact info, academic details, and headline.
  - **Work Required**: Allow students to edit their headline, bio, academic details (institution, degree, specialization, graduation year), and placement status directly on `/student/profile`. Edits must update `person_profiles` and create a revision snapshot in `person_profile_versions`.
  - **Files**: `app/student/profile/page.tsx`, `app/api/student/person-360/route.ts`, `lib/services/person-360-service.ts`
  - **Done Criteria**: Modifying academic year on `/student/profile` saves changes via API, creates a version row in `person_profile_versions`, and updates the displayed profile card.

- [ ] **2.2.3 In-place editing on Skills Map (`/student/skills`)**
  - **Context/Current State**: Skills are listed with detail modals, but students cannot delete or add skills directly from the view.
  - **Work Required**: Add capabilities to: (1) Add a new skill with self-reported provenance, (2) Remove or hide an irrelevant skill, (3) Update self-assessed proficiency. All mutations must write directly to `evidence_items` and recompute the readiness score.
  - **Files**: `app/student/skills/page.tsx`, `app/api/student/skills/route.ts`, `lib/services/skill-intelligence-service.ts`
  - **Done Criteria**: Adding a custom skill "FastAPI" renders the new skill immediately, records it in `evidence_items` with `source: "student_reported"`, and updates the total tracked count.

- [ ] **2.2.4 In-place editing on Project Ledger (`/student/projects`)**
  - **Context/Current State**: Project list displays confirmed projects with limited edit options.
  - **Work Required**: Provide in-place editing for project title, summary, technologies, demo URL, and repository URL. Include delete/archive action and a "Add New Project" modal.
  - **Files**: `app/student/projects/page.tsx`, `app/api/student/projects/route.ts`, `lib/repositories/project-repository.ts`
  - **Done Criteria**: Editing project technologies from the project card updates `projects.technologies` in PostgreSQL and updates the UI instantly.

- [ ] **2.2.5 Full in-place connections management page (`/student/connections`)**
  - **Dependency Note**: Extends the "editable everywhere" philosophy to the connections screen audited in AUDIT.md Module 9.
  - **Context/Current State**: `/student/connections` displays basic status cards for GitHub, Portfolio, and LinkedIn. Does not support LeetCode, HackerRank, Scholar (ORCID/Semantic Scholar ID), or Kaggle.
  - **Work Required**: Rebuild `/student/connections` to manage all supported integrations:
    - Display connection state badges (`Connected`, `Syncing`, `Needs Re-auth`, `Reference Only`, `Disconnected`).
    - Display last synced timestamp and records imported count per source.
    - Provide inline actions: "Sync Now" (triggers async sync), "Edit Handle/ID", and "Disconnect" (with full credential purge).
    - Explicitly state all third-party platforms (LinkedIn, ORCID, LeetCode, etc.) are optional.
  - **Files**: `app/student/connections/page.tsx`, `app/api/student/connections/route.ts`, `lib/services/digital-footprint-registry.ts`
  - **Done Criteria**: Navigating to `/student/connections` displays all platforms; clicking "Sync Now" triggers background sync with visual progress; clicking "Disconnect" purges credentials and updates status to disconnected.

---

### 2.3 Purpose-Driven Adaptive Dashboard
- [ ] **2.3.1 Genuine layout reshaping based on ranked priorities (not just card reordering)**
  - **Context/Current State**: `composePersonalizedDashboard` in `lib/domain/personalization-engine.ts` currently reorders cards into 5 standard sections based on interest configuration.
  - **Work Required**: Extend dashboard composition so that the entire layout structure, hero presentation, and primary metrics genuinely reshape based on the student's #1 ranked priority:
    - *Jobs/Internships (#1)*: Hero displays verified readiness meter, job application evidence packager, target role skill gap analysis, and upcoming recruitment milestones.
    - *Projects/Portfolio (#1)*: Hero showcases active project workbench, GitHub commit recency, architecture highlights, and deployed demo health checks.
    - *Learning/Foundations (#1)*: Hero features adaptive curriculum roadmap, prerequisite graph, diagnostic assessment invitations, and concept mastery badges.
  - **Files**: `lib/domain/personalization-engine.ts`, `lib/services/dashboard-service.ts`, `components/workspace/AdaptiveWorkspace.tsx`
  - **Done Criteria**: Switching primary priority between `jobs`, `projects`, and `learning` generates distinct layouts with custom hero widgets and specialized primary CTAs.

- [ ] **2.3.2 Priority-weighted digital footprint data presentation**
  - **Context/Current State**: Connected accounts are listed in a generic sidebar widget.
  - **Work Required**: Dynamically highlight and weight digital footprint modules based on student priorities:
    - *Collaboration / Teamwork focus*: Surface LinkedIn recommendations (if optionally connected), team project contributions, and pull request activity.
    - *Research focus*: Surface Google Scholar citation metrics, ORCID publications, and Kaggle dataset notebooks prominently (if author ID provided).
    - *Learning / Practice focus*: Surface LeetCode contest rankings, HackerRank badges, and GitHub code volume.
  - **Files**: `lib/domain/personalization-engine.ts`, `components/workspace/AdaptiveWorkspace.tsx`
  - **Done Criteria**: A student with research priority sees ORCID/Scholar publications as the top evidence card; a student with learning priority sees LeetCode/GitHub stats as the top evidence card.

---

### 2.4 Flagship Skills Intelligence Map
- [ ] **2.4.1 Interactive node-graph visualization of skills, evidence, and target goal**
  - **Context/Current State**: Legacy `/student/skills` uses category lists and a Canvas bubble diagram with overlap and clipping bugs.
  - **Work Required**: Build a flagship interactive node-graph visualization:
    - Central target goal node (e.g. "Generative AI Engineer").
    - Radial clusters for taxonomy categories (Core Required, AI/ML, Backend & Systems, Cloud & Tools).
    - Visual edges connecting skills directly to supporting evidence nodes (GitHub repository, Resume bullet, Faculty verification, ERIS assessment).
    - Color-coded node statuses: Verified (Emerald), Corroborated (Cyan), Evidenced (Purple), Gap (Dashed/Gray).
    - Smooth zoom, pan, and search filtering.
  - **Files**: `app/student/skills/page.tsx`, `components/skills/SkillsIntelligenceGraph.tsx`, `components/skills/SkillNodeDetailDrawer.tsx`
  - **Done Criteria**: Graph renders without node label collisions across desktop and mobile; clicking a node smoothly highlights connected evidence edges and opens the 7 Tathastu Questions detail drawer.

---

### 2.5 Project Evidence Ledger Page (`/student/projects`)
- [ ] **2.5.1 Multi-source project ingestion and selection ledger**
  - **Context/Current State**: `/student/projects` lists confirmed projects but lacks unified multi-source ingestion controls.
  - **Work Required**: Build a comprehensive Project Evidence Ledger page displaying all discovered projects from GitHub, Resume, Kaggle, and manual entries. Every project card must feature an inclusion toggle ("Include in verified portfolio / application pack").
  - **Files**: `app/student/projects/page.tsx`, `components/projects/ProjectLedgerCard.tsx`, `lib/repositories/project-repository.ts`
  - **Done Criteria**: Students can view all candidate projects from all sources, toggle selection status, and filter by source or technology stack.

- [ ] **2.5.2 On-demand LLM project description synthesis (cost-controlled)**
  - **Context/Current State**: Raw GitHub READMEs or short resume snippets serve as project descriptions.
  - **Work Required**: Add an on-demand "Enhance with AI" action on project cards. To control token costs, invoke LLM synthesis (`lib/intelligence/router.ts`) ONLY for student-selected projects upon explicit button click, never in bulk background loops. Generate a structured 3-sentence engineering summary: Problem Solved, Technical Architecture, and Concrete Impact.
  - **Files**: `app/api/student/projects/[id]/enhance/route.ts`, `lib/intelligence/router.ts`, `lib/intelligence/cost-control.ts`
  - **Done Criteria**: Clicking "Enhance with AI" generates a structured engineering summary within token quota limits and saves it to `projects.summary`.

- [ ] **2.5.3 Hero screenshots for deployed projects with clean fallback**
  - **Context/Current State**: Project cards display generic placeholder icons.
  - **Work Required**: For projects with a valid `demoUrl`, capture or serve a preview screenshot. If no URL is provided or capture fails, render an elegant, technology-branded SVG illustration with primary language badges.
  - **Files**: `components/projects/ProjectPreviewImage.tsx`, `lib/services/project-preview-service.ts`
  - **Done Criteria**: Projects with live demo links render site screenshots; non-deployed projects render clean SVG technology banners.

- [ ] **2.5.4 Selectable metadata chips (Stars, Forks, Languages, Role)**
  - **Context/Current State**: Metadata is fixed in text strings.
  - **Work Required**: Allow students to select which metadata items to highlight on public badges (e.g. Star count, Fork count, Specific tech stack tags, Personal contribution role).
  - **Files**: `components/projects/ProjectLedgerCard.tsx`, `lib/db/schema.ts`
  - **Done Criteria**: Student selections update `projects.metadata` and are reflected on the exported project evidence card.

- [ ] **2.5.5 Verified ID-driven research & academic publications ledger**
  - **Dependency Note**: Depends on verified author ID ingestion in Task 1.6.2; provides Phase 2 consumer view for academic publications.
  - **Context/Current State**: Phase 1 ingests peer-reviewed publications and DOIs via verified ORCID iD or Semantic Scholar author ID, but there is no dedicated UI ledger card or filter to view, curate, or feature research publications.
  - **Work Required**:
    - Add a "Research & Publications" view tab inside `/student/projects` and a dedicated section on `/student/profile`.
    - Render publication cards displaying paper title, publication year, journal/conference venue, co-authors, citation count, and live DOI hyperlink.
    - If user has not provided an ORCID iD or Semantic Scholar author ID, display a clean optional prompt to connect their author ID, with zero fabricated or name-guessed entries.
    - Allow students to toggle which publications appear on their verified portfolio pack and edit manual citations.
  - **Files**: `app/student/projects/page.tsx`, `app/student/profile/page.tsx`, `components/projects/PublicationCard.tsx`
  - **Done Criteria**: Ingested Scholar/ORCID publications render with DOI links and citation counts; students without author IDs see an optional connect prompt without false-positive papers.

---

### 2.6 Performance, Response Caching & Backend Cleanup
- [ ] **2.6.1 Server-side API response caching with Upstash Redis**
  - **Context/Current State**: Slow composite endpoints (`/api/student/dashboard`, `/api/student/skills`, `/api/student/person-360`) perform multiple database and ORM queries on every request.
  - **Work Required**: Implement server-side caching using Upstash Redis (`@upstash/redis` or existing Redis client) with deterministic cache keys (`student:dash:${personId}`, `student:skills:${personId}`) and a 120-second TTL. Invalidate cache on mutations (profile edit, skill addition, project sync).
  - **Files**: `app/api/student/dashboard/route.ts`, `app/api/student/skills/route.ts`, `app/api/student/person-360/route.ts`, `lib/cache/redis.ts`
  - **Done Criteria**: Response latency for `/api/student/dashboard` drops from >400ms to <40ms on cached requests.

- [ ] **2.6.2 Fix detached-promise audit-log calls in `lib/intelligence/router.ts`**
  - **Context/Current State**: `lib/intelligence/router.ts` lines 93, 104, 122, and 137 execute unawaited audit logging via `void this.logAudit(...)`. In Vercel serverless functions, background promises without execution context can be frozen or terminated before completing, causing dropped logs.
  - **Work Required**: Replace `void this.logAudit(...)` with awaited execution or use Next.js server lifecycle utilities (`waitUntil()` / execution context) to guarantee audit logs are persisted to `ai_audit_logs` before serverless invocation terminates.
  - **Files**: `lib/intelligence/router.ts`
  - **Done Criteria**: Every completed LLM or fallback request reliably records an entry in table `ai_audit_logs` without dropping records during concurrent requests.

- [ ] **2.6.3 Strict authentication gating for `/student/**` & elimination of live guest dashboard routes**
  - **Context/Current State**: `getDemoDashboardComposition` in `lib/services/dashboard-service.ts` serves mock student data when `isGuest` is true in `app/api/student/dashboard/route.ts`.
  - **Settled Policy & Work Required**:
    - **No `/demo` route & No Guest Dashboard Mode**: Do not create or expose a `/demo` route. Strictly forbid any guest-mode dashboard at `/student` or any route under `/student/**` for unauthenticated requests — all such requests must redirect to `/sign-in`.
    - **Strict API Gating**: All API routes under `/api/student/**` must return `HTTP 401 Unauthorized` for unauthenticated requests. Completely eliminate the `isGuest` / `demo=true` execution branches from `app/api/student/dashboard/route.ts`.
    - **Marketing Landing Page Asset Isolation**: Sample/mock dashboard data is allowed ONLY embedded directly on the public marketing landing page (`/`) as a self-contained visual asset (not a live route that renders dashboard-shaped data). This is strictly a landing-page marketing/content asset, not a functional preview mode, and must not share code paths with the real authenticated dashboard beyond potentially reusing visual presentation components for consistency.
    - **Delete or Repurpose `getDemoDashboardComposition`**: Remove `getDemoDashboardComposition` from the live student dashboard service (`lib/services/dashboard-service.ts`) — delete it if landing page mock data is static/hardcoded, or isolate it solely for static landing page visual rendering.
  - **Files**: `middleware.ts`, `app/api/student/dashboard/route.ts`, `lib/services/dashboard-service.ts`, `app/student/page.tsx`
  - **Done Criteria**: Unauthenticated requests to `/student` redirect to `/sign-in`; unauthenticated requests to `/api/student/dashboard` return 401; zero guest/demo personas exist on live student routes; `getDemoDashboardComposition` removed from live dashboard service.

- [ ] **2.6.4 PostgreSQL Foreign Key and Referential Cleanup**
  - **Context/Current State**: In `lib/db/schema.ts`, `aiAuditLogs.personId` is unreferenced. Redundant routes exist (`POST /api/student/projects/confirm`).
  - **Work Required**:
    - Add foreign key reference to `aiAuditLogs.personId` pointing to `persons.id` with `onDelete: "set null"`.
    - Audit all 44 tables in `scratch/audit/schema-snapshot.sql` to verify cascade delete behaviors.
    - Remove orphaned/redundant route handler `app/api/student/projects/confirm/route.ts` (superseded by onboarding draft and project repository).
  - **Files**: `lib/db/schema.ts`, `drizzle.config.ts`, `app/api/student/projects/confirm/route.ts`
  - **Done Criteria**: `npm run db:migrate` applies updated constraints cleanly; foreign keys verified in Neon PostgreSQL schema introspection.

- [ ] **2.6.5 Comprehensive Account Deletion & GDPR/PII Purge Service**
  - **Dependency Note**: Depends on all Phase 1-2 tables; fixes data leaks in `guest-cleanup-service.ts`.
  - **Context/Current State**: In `lib/services/guest-cleanup-service.ts`, `deleteAccountCompletely` leaves behind rows in 13 tables: `resume_documents`, `resume_document_blobs` (raw resume PDFs!), `resume_review_history`, `projects`, `project_contributions`, `external_connections` (with encrypted OAuth tokens!), `source_snapshots`, `sync_runs`, `roadmap_milestones`, `person_profile_versions`, `source_conflicts`, `intelligence_artifacts`, and `onboarding_drafts`.
  - **Work Required**:
    - Update `deleteAccountCompletely` to purge all 13 orphaned tables in a single transaction.
    - Specifically ensure all resume PDF blobs (`resume_document_blobs`) and encrypted connection tokens (`external_connections`) are permanently wiped.
    - Provide a verified `POST /api/student/account/delete` endpoint allowing students to delete their accounts and exercise their right to be forgotten.
  - **Files**: `lib/services/guest-cleanup-service.ts`, `app/api/student/account/delete/route.ts`
  - **Done Criteria**: Calling `deleteAccountCompletely(userId)` leaves exactly 0 rows across all 44 tables in Neon PostgreSQL for that user/person.

---

## PHASE 3 — Full UI Rebuild

*(Note: The entire existing component layer in `components/exact-screens/`, `components/workspace/`, and legacy dashboard widgets will be deleted and rebuilt from scratch. Backend API routes, repositories, and domain services remain fully intact. Visual styling, motion, and color decisions will adhere to design tokens and specialized Claude design skills.)*

### 3.1 Design Architecture & Information Structure
- [ ] **3.1.1 Legacy component teardown and foundation setup**
  - **Context/Current State**: Legacy monolithic screens reside in `components/exact-screens/` and `components/workspace/`.
  - **Work Required**: Safely retire legacy UI component code while preserving all API endpoints, repositories, database schemas, and connectors. Set up a clean, modular component directory structure: `components/ui/`, `components/layout/`, `components/onboarding/`, `components/dashboard/`, `components/skills/`, `components/projects/`.
  - **Files**: `components/**`, `app/**`
  - **Done Criteria**: Legacy component files removed; project builds cleanly with zero orphan component import errors.

- [ ] **3.1.2 Information architecture & multi-section single-scroll layout**
  - **Context/Current State**: Extracted from design reference screenshots.
  - **Work Required**: Implement the verified information architecture:
    - Multi-section single-scroll page layout with sticky jump-nav and active section observer.
    - Clear visual groupings: Hero/Readiness Overview, Priority 1 Deep Dive, Priority 2 Projects Workbench, Priority 3 Learning & Roadmap, Verified Footprints Ledger.
    - Dual bubble + bar skill representation: high-level competency cards paired with granular evidence progress bars.
  - **Files**: `components/layout/DashboardLayout.tsx`, `components/layout/JumpNav.tsx`, `components/dashboard/**`
  - **Done Criteria**: Page scrolls smoothly with sticky jump-nav updating active pill based on scroll position; all section groupings rendered according to spec.

- [ ] **3.1.3 Single-scroll modular section adapters for Roadmap, Journey, and Assessment Evidence**
  - **Dependency Note**: Rebuilds audited modules 5, 6, 7, 8 from AUDIT.md into the new single-scroll information architecture.
  - **Context/Current State**: Modules for Roadmap (`/student/roadmap`), Journey (`/student/journey`), Assessments (`/student/assessments`), and Interviews (`/student/interviews`) exist as disparate pages in the legacy UI.
  - **Work Required**: Build responsive section adapters that embed these workflows seamlessly into the single-scroll layout (with expandable drawers or sub-views):
    - *Roadmap Adapter*: Prerequisite timeline with completed vs upcoming milestone actions.
    - *Journey Timeline Adapter*: Chronological milestone cards (CV uploaded, skill verified, project connected).
    - *Assessments & Interviews Adapter*: Evaluated coding challenge scores and interview rubric ratings with evidence badges.
  - **Files**: `components/dashboard/RoadmapSection.tsx`, `components/dashboard/JourneySection.tsx`, `components/dashboard/AssessmentSection.tsx`
  - **Done Criteria**: All 4 modules are accessible and interactive within the new dashboard architecture without layout fragmentation.

---

### 3.2 Error Boundaries, 404 & Feedback Systems
- [ ] **3.2.1 Custom Brand 404 Not Found Page**
  - **Context/Current State**: Currently returns standard unstyled Next.js 404 page (`AUDIT.md` Section 6A).
  - **Work Required**: Create custom `app/not-found.tsx` matching the brand design system (slate void `#0A0A0F`, violet accents, Space Grotesk heading, navigation back to workspace or landing page).
  - **Files**: `app/not-found.tsx`
  - **Done Criteria**: Requesting `/non-existent-route` displays the custom branded 404 page with functional return navigation.

- [ ] **3.2.2 Fix UI Error Boundary (`app/error.tsx`)**
  - **Context/Current State**: Currently displays `"Your saved information is still available"` even during catastrophic save or network failures.
  - **Work Required**: Update `app/error.tsx` to provide truthful, contextual error reporting:
    - Distinguish between read failures (data temporarily unavailable) and mutation/save failures (save was not completed).
    - Provide actionable recovery buttons ("Try Again" triggering `reset()`, "Check Status", "Return to Overview").
    - Never display raw stack traces, SQL errors, or misleading safety claims.
  - **Files**: `app/error.tsx`
  - **Done Criteria**: Triggering client errors renders honest error category messaging and recovery actions.

- [ ] **3.2.3 App-wide Toast and Modal Alert System**
  - **Context/Current State**: Legacy code uses raw browser `alert()` and `confirm()` dialogs and occasionally leaks server exception strings.
  - **Work Required**: Implement an accessible toast notification system (`Sonner` or custom brand toast) and accessible confirmation dialogs. Replace all occurrences of window `alert()` and `confirm()` with non-blocking toast notifications and confirmation modals.
  - **Files**: `components/ui/Toast.tsx`, `components/ui/ConfirmDialog.tsx`
  - **Done Criteria**: Zero `alert(` or `confirm(` calls remain in client bundle; actions show smooth, animated toast notifications.

---

### 3.3 Systematic Loading, Empty & Error States
- [ ] **3.3.1 Systematic loading skeletons per screen**
  - **Context/Current State**: Pages currently show generic spinning loaders or flash blank content.
  - **Work Required**: Build bespoke pulse/shimmer loading skeleton layouts matching the exact geometry of every dashboard module (`/student`, `/student/profile`, `/student/skills`, `/student/projects`, `/student/roadmap`, `/student/connections`).
  - **Files**: `components/ui/Skeleton.tsx`, `app/student/**/loading.tsx`
  - **Done Criteria**: Navigating between screens displays matching skeleton loaders without layout shift before content hydrates.

- [ ] **3.3.2 Expressive empty states across all screens**
  - **Context/Current State**: Empty screens show blank tables or cryptic "No data" text.
  - **Work Required**: Design and implement helpful, inspiring empty states with primary action triggers for every module (e.g. "No projects linked yet — Connect GitHub or Add Manually", "No skills verified yet — Complete onboarding review or upload resume").
  - **Files**: `components/ui/EmptyState.tsx`, `app/student/**`
  - **Done Criteria**: Fresh test account `test-new@example.com` visiting any module sees contextual empty states with actionable CTA buttons.

---

### 3.4 Accessibility & Responsive Breakpoint Verification
- [ ] **3.4.1 Comprehensive Accessibility Pass (WCAG 2.1 AA)**
  - **Context/Current State**: Several custom inputs lack visible focus indicators or keyboard traps.
  - **Work Required**:
    - Ensure all interactive elements have visible, high-contrast `:focus-visible` outline rings (`--border-glow: rgba(124, 58, 237, 0.5)`).
    - Implement accessible focus trapping inside all modals and slide-out drawers.
    - Ensure correct ARIA roles and labels (`aria-expanded`, `aria-label`, `role="dialog"`, `role="tab"`).
    - Validate color contrast across text and surfaces meets 4.5:1 ratio.
  - **Files**: `components/**`, `app/globals.css`
  - **Done Criteria**: Full keyboard navigation audit passes: all controls can be reached and activated via Tab, Enter, Space, and dismissed with Escape.

- [ ] **3.4.2 Responsive Layout & Breakpoint Verification**
  - **Context/Current State**: Certain screens experience element clipping on sub-1280px viewports.
  - **Work Required**:
    - Test and optimize layout at target breakpoints: Desktop Wide (1920px), Standard Desktop (1440px), Laptop (1280px), Tablet (768px-1024px), Mobile (375px-430px).
    - Implement mobile-responsive navigation (collapsible drawer or mobile bottom bar replacing desktop sidebar).
    - Ensure data tables and node graphs adapt or provide horizontal touch scrolling on mobile.
  - **Files**: `components/layout/Navbar.tsx`, `components/layout/Sidebar.tsx`, `app/globals.css`
  - **Done Criteria**: Automated viewport tests at 375px, 768px, 1280px, 1440px, and 1920px confirm zero horizontal overflow or broken layouts.

---

## PHASE 4 — Bug Catchall

*(This section is initially empty. It will be populated with bugs or regressions discovered during the execution of Phases 1–3 that fall outside the immediate scope of ongoing tasks.)*

*No entries yet.*
