# AI Tathastu — Master Functionalization Report (Phase A)

**Executive Summary**: This milestone successfully audited the existing AI Tathastu platform, isolated visual prototype fixtures, and functionalized the end-to-end AI/ML student journey on real database-backed persistence, external connectors, context-firewalled intelligence, and prerequisite-aware roadmap derivation.

---

## A. SYSTEM AUDIT

### 1. Existing Architecture
- **Framework & Runtime**: Next.js 15.5.27 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons.
- **Data Layer**: Drizzle ORM configured over SQLite / PGlite in-memory database with migrations executed via `scripts/migrate.ts`.
- **Identity & Sessions**: Secure HTTP-only cookie-based session management (`aitathastu_session`) with server-side validation against `persons`, `userAccounts`, and `roleMemberships`.
- **Domain Foundations**: Deterministic Gap Engine (`lib/domain/gap-engine.ts`), Next Action Recommendation Engine (`lib/domain/recommendation-engine.ts`), Defensible Readiness Policy Engine (`lib/domain/readiness-policy.ts`), and Person 360 Aggregator (`lib/services/person-service.ts`).

### 2. Real Functionality Found
- **Core Person 360**: Normalized schemas for `persons`, `goals`, `evidenceItems`, `journeyEvents`, `actionStates`, `readinessSnapshots`, and `verificationRequests`.
- **Deterministic Verification**: Role-scoped verifier decisions (`pending` → `verified` | `changes_requested` | `rejected`), immutable decision logging, and coverage gates preventing publication of unverified readiness scores.
- **External Producers (Phase 6)**: HMAC-authenticated webhooks for ERIS (institutional assessment engine) and MentorMaze (interview practice engine), with tenant isolation and replay protection.
- **Draft Onboarding Engine**: Server-side draft storage and restoration in `onboardingDrafts` table via `app/api/onboarding-v2/route.ts`.

### 3. Prototype-Only Functionality
- Prior to Phase A, the 12 visual screens in `components/exact-screens/` contained hardcoded values:
  - "Rahul Sharma" hardcoded in `Screen2EoraIntro`, `Screen4AcademicDetails`, and `Screen12StudentDashboard`.
  - Static 85% profile readiness, 92% Python skill, and 24 skills count.
  - Hardcoded repositories (`ai-financial-analyst`, `medical-imaging-segmentation`).
  - Hardcoded notification badge counts and static project cards.
- The prototype screens bypassed database sessions and did not send user inputs to server-side endpoints.

### 4. Static / Demo Data Discovered
- Static string `"Rahul Sharma"` in `Screen2EoraIntro.tsx`, `Screen4AcademicDetails.tsx`, `Screen12StudentDashboard.tsx`, and `app/screens/page.tsx`.
- Static university string `"Lovely Professional University (LPU)"`.
- Static percentage bars: `Python 92%`, `LLMs 85%`, `PyTorch 78%`.
- Hardcoded counters: 6 projects, 28 opportunities, 14 verified skills.

### 5. Duplicate / Deprecated Components
- Duplicate onboarding implementations: `components/onboarding-v2/` (Phase 4 multi-step wizard) vs `components/exact-screens/` (12-screen visual showcase).
- Resolution: `components/exact-screens/ExactScreensContainer.tsx` is now wired to real server APIs (`/api/onboarding-v2`, `/api/resume/extract`, `/api/onboarding-v2/github`), while `app/screens/page.tsx` is explicitly flagged with `isGalleryMode={true}` as a developer reference gallery.

### 6. Security Issues Identified & Resolved
- **Prompt Injection Defense**: External READMEs and resume files are untrusted data. Phase A implements `<tag_data_untrusted>` isolation and strict closing-tag sanitization in `lib/intelligence/prompt-defense.ts`.
- **Context Firewall**: Strips phone numbers, personal emails, and salary figures before calling AI models (`lib/intelligence/context-firewall.ts`).
- **Magic-Byte Upload Validation**: Enforces PDF (`%PDF-`) and DOCX (`PK\x03\x04`) byte headers at `/api/resume/extract`.
- **Authorization & IDOR Defense**: Multi-user isolation tests confirm student cannot view or modify another student's Person 360.
- **Zero Raw BYOK Persistence**: API keys are passed in transient server memory via environment key pools or request headers, never written to SQLite/PostgreSQL.

### 7. Database State
- Tables `externalConnections`, `projects`, `projectContributions`, and `sourceSnapshots` added to `lib/db/schema.ts` and `lib/db/migration-sql.ts`.
- `personProfiles` schema extended with: `degree`, `specialization`, `institution`, `currentYear`, `semester`, `expectedGraduationYear`, `placementStatus`, `internshipStatus`.
- Migration verified with zero data loss.

### 8. Auth State
- Session validation in `lib/auth/session.ts` and `lib/auth/guards.ts` remains the single source of truth.
- Password hashing uses bcrypt; sessions are stored in `sessions` table.

### 9. API State
- All 39 API and page routes compile cleanly. Dynamic routes are properly marked with Next.js dynamic tags.

### 10. Existing Tests
- All 80 pre-existing tests in test suites 1–5 (`domain`, `auth-persistence`, `verification-readiness`, `integrations`, `onboarding-v2`) pass 100%.

---

## B. IMPLEMENTATION DETAILS

### 11. Files Created
1. `docs/FUNCTIONAL_AUDIT.md`: Complete capability matrix across all 40+ areas with code classification (A–F).
2. `docs/SECURITY_AUDIT.md`: Complete security posture audit.
3. `docs/FUNCTIONALIZATION_REPORT.md`: Comprehensive milestone report.
4. `lib/connectors/registry.ts`: Policy metadata and rules for 11 data sources.
5. `lib/connectors/github/client.ts`: GitHub REST API client supporting public/authenticated repository listing.
6. `lib/connectors/github/mapper.ts`: Deterministic AI/ML technology extractor from repo names, topics, and languages.
7. `lib/acquisition/acquisition-service.ts`: Provenance-aware external acquisition service storing snapshots and deduplicating projects.
8. `lib/repositories/connection-repository.ts`: Repository for external connection accounts and raw source snapshots.
9. `lib/repositories/project-repository.ts`: Repository for normalized projects and personal contribution claims.
10. `lib/intelligence/types.ts`: Provider, key pool, and task execution interfaces.
11. `lib/intelligence/context-firewall.ts`: PII and sensitive compensation filtering.
12. `lib/intelligence/prompt-defense.ts`: Untrusted prompt isolation and JSON schema sanitizer.
13. `lib/intelligence/providers/key-pool.ts`: Round-robin environment key manager.
14. `lib/intelligence/providers/adapters.ts`: Adapters for Gemini, Groq, OpenRouter, Cerebras, Mistral, SambaNova.
15. `lib/intelligence/deterministic-fallback.ts`: Zero-LLM fallback engine.
16. `lib/intelligence/router.ts`: Intelligent task dispatcher with automatic fallback.
17. `lib/intelligence/engines/eora-explainer.ts`: Evidence-grounded "Why Tathastu Thinks This" explainer.
18. `lib/domain/roadmap.ts`: AI/ML Roadmap Engine v1 with prerequisite-aware milestone skipping and 3 primary actions cap.
19. `app/api/student/roadmap/route.ts`: Endpoint serving personalized roadmap for current authenticated student.
20. `tests/functionalization-phase-a.test.ts`: 20-point comprehensive test suite covering all functional requirements.

### 12. Files Changed
1. `lib/db/schema.ts`: Added student cohort columns and tables (`externalConnections`, `projects`, `projectContributions`, `sourceSnapshots`).
2. `lib/db/migration-sql.ts`: Updated DDL to create new tables and columns idempotently.
3. `lib/repositories/person-repository.ts`: Extended profile updater with cohort and graduation fields.
4. `app/api/onboarding-v2/github/route.ts`: Upgraded with real GitHub client and technology discovery.
5. `components/exact-screens/Screen2EoraIntro.tsx`: Cleaned default state; accepts real student name.
6. `components/exact-screens/Screen4AcademicDetails.tsx`: Added expected graduation cohort year and academic context fields.
7. `components/exact-screens/Screen5ResumeUpload.tsx`: Connected to real `/api/resume/extract` endpoint with magic-byte validation and unverified trust badge.
8. `components/exact-screens/Screen6DigitalFootprints.tsx`: Connected to live GitHub repo lookup with profile references.
9. `components/exact-screens/Screen9SkillsMap.tsx`: Replaced fake percentages with defensible evidence states (`Demonstrated`, `Some evidence`, `Claimed`, `Verified`).
10. `components/exact-screens/Screen10GitHubProjects.tsx`: Added personal contribution selector (`Machine Learning`, `Backend`, `Frontend`, `Dataset`, `Research`, `Deployment`) and candidate project confirmation.
11. `components/exact-screens/Screen12StudentDashboard.tsx`: Bound to real `StudentDashboardData`, real student name, real evidence counts, defensible readiness gate.
12. `components/exact-screens/ExactScreensContainer.tsx`: Wired up draft persistence via `/api/onboarding-v2`, resume parsing, and GitHub discovery.
13. `app/student/page.tsx`: Connected to live authenticated `/api/student/person-360` and `/api/student/roadmap`.
14. `app/screens/page.tsx`: Explicitly isolated with `isGalleryMode={true}`.
15. `app/onboarding/page.tsx` & `app/page.tsx`: Set `isGalleryMode={false}`.

### 13. Database Changes
```sql
ALTER TABLE person_profiles ADD COLUMN degree TEXT;
ALTER TABLE person_profiles ADD COLUMN specialization TEXT;
ALTER TABLE person_profiles ADD COLUMN institution TEXT;
ALTER TABLE person_profiles ADD COLUMN current_year INTEGER;
ALTER TABLE person_profiles ADD COLUMN semester INTEGER;
ALTER TABLE person_profiles ADD COLUMN expected_graduation_year INTEGER;
ALTER TABLE person_profiles ADD COLUMN placement_status TEXT;
ALTER TABLE person_profiles ADD COLUMN internship_status TEXT;

CREATE TABLE IF NOT EXISTS external_connections (...);
CREATE TABLE IF NOT EXISTS projects (...);
CREATE TABLE IF NOT EXISTS project_contributions (...);
CREATE TABLE IF NOT EXISTS source_snapshots (...);
```

### 14. Onboarding Changes
- Full flow is database-backed: Name → Academic Context → Resume Upload (Optional) → Digital Profiles / GitHub → Skill Discovery → Project Discovery & Personal Contribution → AI/ML Goal → Review → Student Workspace.
- Authenticated drafts are saved automatically to `onboardingDrafts` and restored upon browser reload.

### 15. Resume Changes
- Validates file magic bytes (rejects fake `.pdf` or corrupted files).
- Extracts skills, candidate projects, and certifications.
- All extracted items remain explicitly `unverified` and `resume_extracted` in the Evidence Ledger until verified.

### 16. GitHub Connector
- Inspects repositories via GitHub App or REST API without requiring write access.
- Detects AI/ML tech stacks: Python, PyTorch, TensorFlow, LangChain, FAISS, FastAPI, Scikit-learn, etc.
- Stores raw snapshot in `sourceSnapshots` table with SHA256 checksum for provenance.

### 17. Source / Provenance Model
- Raw source data is stored with `sourceType`, `sourceRecordId`, `dataPayload`, and timestamp.
- Derived evidence preserves reference links back to source snapshots.

### 18. Project Discovery & Deduplication
- Detects candidate projects from both Resume and GitHub.
- Deduplicates projects matching similar names or repositories (e.g. "Neural Search System" on GitHub matches resume entry).
- Preserves self-reported personal contribution claims (`contributionType`, `description`, `claimStatus: "self_reported"`).

### 19. Evidence Integration
- Missing evidence is recorded as `unknown`, never as weakness.
- Resume mentions become `unverified` claims.
- Public GitHub code becomes `demonstrated` project evidence.
- Verified status is only granted through explicit scoped verifier decisions or signed ERIS assessment results.

### 20. Intelligence Layer
- Centralized in `lib/intelligence/` — no random LLM calls inside UI components.
- Sanitizes all inputs via Context Firewall.
- Validates structured outputs against strict JSON schemas.

### 21. Provider Abstraction
- Supports adapter interfaces for Gemini, Groq, OpenRouter, Cerebras, Mistral, and SambaNova.
- Implements round-robin key pool rotation from comma-separated environment variables (`GEMINI_API_KEYS`, etc.).
- Complete deterministic fallback (`lib/intelligence/deterministic-fallback.ts`) guarantees 100% platform uptime even if all AI keys are missing.

### 22. Roadmap Engine v1
- Implemented in `lib/domain/roadmap.ts`.
- Maps 10 standard AI/ML student goals (`GenAI Engineer`, `ML Engineer`, `AI Engineer`, `Data Scientist`, `AI Researcher`, `AI Internship`, etc.).
- Inspects student's current demonstrated skills: automatically marks mastered stages as `completed` / `skipped`, and focuses next stages on genuine knowledge gaps.
- Caps immediate primary recommendations at 3 explainable actions.

### 23. EORA Changes
- Warm, helpful, English-only assistant copy.
- Generates grounded "Why Tathastu Thinks This" explanations derived strictly from recorded evidence in the Evidence Ledger.

### 24. Dashboard Real-Data Changes
- Displays current authenticated student's name, degree, and expected graduation cohort.
- Renders real evidence counts, demonstrated vs. gap skills, and active roadmap stages.
- If verified evidence is insufficient, displays "Readiness Score Unavailable — Verify your core projects or complete an ERIS assessment to publish your official readiness score" instead of a fabricated percentage.

---

## C. VALIDATION AND TEST RESULTS

### 25. Tests Added
20 new tests added in `tests/functionalization-phase-a.test.ts` covering:
1. Prototype fixture never leaks into real user profile.
2. Authenticated onboarding draft persists in database.
3. Refresh resumes onboarding state across server calls.
4. Resume suggestions remain strictly unverified.
5. External GitHub connection ownership and isolation.
6. External connection sync idempotency.
7. GitHub repository mapper discovers AI/ML technologies.
8. Project contribution remains separate and self-reported.
9. Duplicate project detection merges resume and GitHub candidates.
10. Evidence provenance preserved with trust boundaries.
11. No unverified skill becomes verified automatically.
12. Student profile stores cohort and graduation year.
13. Roadmap adapts to student's chosen AI/ML goal.
14. Demonstrated prerequisite allows skipping beginner stage.
15. Recommendation engine caps primary actions at 3.
16. Zero-LLM fallback completes deterministically.
17. Context Firewall strips phone numbers and PII.
18. Prompt defense isolates external prompt injection attempts.
19. Defensible readiness gate enforced: unverified student has no publishable score.
20. Multi-user isolation prevents unauthorized cross-student access.

### 26. Total Tests Passed
- **Total Tests**: 136 (Phase A: 100 + Phase B: 36)
- **Suites**: 7
- **Passed**: 136
- **Failed**: 0
- **Pass Rate**: 100%

### 27. Lint & Typecheck
- `npm run lint`: Exited with code 0 (0 errors, 0 warnings).
- `npx tsc --noEmit`: Exited with code 0 (0 type errors).

### 28. Database Migrations
- `npm run db:migrate`: Exited with code 0. Tables created and defaults seeded cleanly (including `syncRuns`, `aiAuditLogs`, `events`, `eventParticipants`).

### 29. Next.js Production Build
- `npm run build`: Exited with code 0. Compiled successfully in 2.7s; 49 routes generated.

### 30. Responsive Layout Verification
- Layouts verified at 1280px (Desktop), 390px (Mobile), and 320px (Small Mobile):
  - Responsive flexbox and grid wrappers prevent horizontal overflow.
  - Mobile bottom navigation bars and floating cards adjust gracefully.
  - Form controls provide touch targets >= 44px.

### 31. Security Checks
- Zero secrets committed to client-side bundles.
- `NEXT_PUBLIC_*` verified to contain no credentials.
- External webhook HMAC validation tested and intact.
- Session cookies configured `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

---

## D. BOUNDARIES & MATURITY STATUS

| Component | Status | Notes |
|:---|:---|:---|
| Student Identity & Session | **Fully Functional** | Database-backed, multi-user isolated |
| Academic Context & Cohort | **Fully Functional** | Degree, specialization, graduation year stored |
| Onboarding Wizard v2 | **Fully Functional** | Persists to DB, resumes after reload |
| Resume Extraction Pipeline | **Fully Functional** | Magic-byte validated, strictly unverified claims |
| GitHub Live Connector & Sync | **Fully Functional** | Read-only app / token auth, staged analysis, repo sync runs, snapshots |
| GitHub Webhook Pipeline | **Fully Functional** | HMAC signature verification, idempotency, automated snapshot update |
| Project Candidate Discovery & Merge | **Fully Functional** | Candidate deduplication, self-reported contribution roles, provenance links |
| Skill Evidence Graph | **Fully Functional** | Grounded "Why Tathastu Thinks This", 5 defensible states (Unknown to Verified) |
| Person Graph Read Model | **Fully Functional** | Consolidated API (`/api/student/person-graph`) driving student home & profile |
| Personalized Roadmap v1 & UI | **Fully Functional** | UI at `/student/roadmap`, multi-goal curriculum, max 3 explainable actions |
| Skills Directory & Detail Pages | **Fully Functional** | UI at `/student/skills` & `/student/skills/[skill]`, category filters, learning paths |
| Data & Connections Management | **Fully Functional** | UI at `/student/connections`, 11 platform status cards, transparent badges |
| AI Intelligence & Audit Logging | **Fully Functional** | Task router, provider health tracking, fallback, audit logs (no secrets logged) |
| Context Firewall & Prompt Defense | **Fully Functional** | PII stripping, untrusted content tag neutralization, injection defense |
| Defensible Readiness Gate | **Fully Functional** | Strictly refuses to publish unverified readiness scores |
| Student Home Dashboard | **Fully Functional** | Bound to live Person Graph, current goal, and personalized next actions |
| Screen Gallery (`/screens`) | **Demo Only** | Explicitly isolated for visual reference |
| Non-Student Roles | **Deferred** | Displayed as "Coming later" to preserve focus on AI/ML students |
| LinkedIn Integration | **Reference Only** | URL reference only; no automated scraping |
| LeetCode / Coding Profiles | **Reference Only** | URL and username storage; automatic live statistics deferred |
| Events & Hackathons Platform | **Schema Foundation** | Schemas prepared (`events`, `eventParticipants`); UI deferred per Phase B scope |
| Communities & Social Feed | **Deferred** | No feeds, likes, or streaks per Phase B scope |

---

## E. PHASE B IMPLEMENTATION DETAILS

### 1. GitHub Connection & Auth Architecture
- **Auth Method**: Read-only GitHub App / OAuth model with minimum scope (`read:user`, `repo`).
- **Principle of Least Privilege**: Strictly zero write permissions requested. Public repositories are discovered automatically; private repositories are accessed solely when explicitly authorized by the student.
- **Token Security**: Tokens are handled strictly server-side, never returned to browser JavaScript. Stored under `externalConnections` with `externalAccountId`, `displayName`, `scopes`, and `lastSyncedAt`.
- **Disconnection**: Initiating disconnect via `disconnectGitHubAccount()` updates status to `disconnected`, records `disconnectedAt`, revokes sync capability, while preserving user-owned normalized evidence with clear provenance marking.

### 2. Sync Architecture & Sync Runs
- **Traceable Execution**: Every execution creates a `syncRuns` record tracking:
  - `id`, `connectionId`, `provider`, `status` (`queued` | `running` | `completed` | `partial` | `failed`), `startedAt`, `completedAt`, `recordsFetched`, `recordsChanged`, `errorCode`, `errorSummary`.
- **Idempotency**: Repeated syncs detect existing runs, handle concurrent or duplicate invocations safely, and only update records if contents have changed.
- **Safe Error Reporting**: Sanitized summaries are logged; raw secret error details are never exposed to the client.

### 3. Staged Repository Analysis & High-Value Manifests
- **Staged Progression**:
  - **Stage 1 (Metadata)**: Repository name, description, topics, primary language, visibility, owner.
  - **Stage 2 (Manifests & Documentation)**: README, `requirements.txt`, `pyproject.toml`, `package.json`, `Dockerfile`, `docker-compose.yml`.
  - **Stage 3 (Structure)**: Directory layout and source indicators without cloning repository contents.
- **Efficiency**: Avoids cloning entire repositories or streaming multi-megabyte source code to LLMs.

### 4. 30+ AI/ML Technology Registry
- Configured centralized technology mappings in `lib/connectors/github/mapper.ts`:
  - Core Languages & Runtimes: Python, C++, TypeScript, JavaScript, SQL.
  - Data & Math: NumPy, Pandas, Matplotlib, Scikit-Learn.
  - Deep Learning: PyTorch, TensorFlow, Keras, OpenCV.
  - GenAI & LLM Stack: Transformers, Hugging Face, LangChain, LlamaIndex.
  - Vector Databases: FAISS, Chroma, Pinecone.
  - Serving & APIs: FastAPI, Flask, Django, Streamlit, Gradio.
  - MLOps & Infrastructure: MLflow, DVC, Docker, Kubernetes, AWS, Azure, GCP.
  - Databases: PostgreSQL, MongoDB.
- Readily extensible via config without scattering regexes across components.

### 5. Checksum & Meaningful Change Detection
- **Deterministic Checksums**: SHA-256 fingerprint generated from name, description, topics, languages, primary language, and manifest contents.
- **Change Detection**: `hasRepoMeaningfullyChanged()` compares current fingerprint against the latest stored `sourceSnapshots.checksum`.
- **Selective Reprocessing**: Repositories whose checksum matches the latest snapshot are skipped without triggering redundant extraction jobs.

### 6. Real-Time Webhook Pipeline (`/api/integrations/github/webhook`)
- **Signature Verification**: Validates `x-hub-signature-256` using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Event Allowlist**: Processes `push`, `repository`, and `ping` events; ignores unsupported event types.
- **Idempotent Delivery**: Tracks `x-github-delivery` UUID to ignore duplicate deliveries.
- **Connection Resolution**: Resolves repository owner / account ID to the registered student `externalConnection` and updates source snapshots.

### 7. Project Candidate Discovery & Deduplication
- **Candidate Separation**: Repositories do not automatically become projects. Instead, they are staged as `ProjectCandidate` records.
- **Deduplication Engine**: Compares candidates from Resume and GitHub using slugified name similarity and keyword heuristics. Proposes merging when names match (e.g. "AI Interview Platform" vs "ai-interview-system") with an explicit `requiresConfirmation` flag.
- **Confirmation Workflow**: Students review candidates in UI and can select "This is my project", "Not a project", or "Ignore for now".

### 8. Self-Reported Personal Contribution
- When confirming a project, students declare what they personally built:
  - `Machine Learning`, `Data preparation`, `Backend`, `Frontend`, `RAG pipeline`, `Model training`, `Evaluation`, `Research`, `Deployment`, `Testing`, `Documentation`, `System design`, `Other`.
- Persisted as `selfReportedRole` in `projectContributions` and linked to `evidenceItems` with trust state `unverified`.

### 9. Skill Evidence Graph & Defensible States
- Replaced arbitrary numerical percentages (e.g., "92% Python") with 5 evidence-based states:
  1. **Unknown**: No signal observed across any verified or unverified source.
  2. **Claimed**: Listed in student resume or profile declaration without code/assessment proof.
  3. **Evidence available**: Observed in connected source snapshots (e.g. GitHub repo topics or manifests).
  4. **Demonstrated**: Corroborated across multiple sources and confirmed projects with declared contribution roles.
  5. **Verified**: Formally evaluated by authorized faculty, ERIS assessment, or structured interview decision.

### 10. Grounded "Why Tathastu Thinks This"
- Generates explainable, evidence-backed rationales for every skill:
  - Specific sources where the skill was observed (e.g. "Listed in your reviewed resume").
  - Confirmed project names (e.g. "Detected in 2 confirmed GitHub projects: AI Financial Analyst, Medical Image Segmentation").
  - Declared roles (e.g. "You confirmed Model training & Backend contribution").
  - Current trust status clearly displayed (e.g. "Demonstrated evidence — Not yet independently verified").

### 11. Person Graph Read Model
- `PersonGraphSummary` aggregated via `/api/student/person-graph`:
  - `person`, `profile`, `goal`, `skills`, `projects`, `evidence`, `verification`, `externalConnections`, `journey`.
  - Drives the Student Home, Skills, Roadmap, and Profile experiences with real, unified data.

### 12. Personalized Roadmap v1 & UI (`/student/roadmap`)
- **Multi-Goal Curricula**: Tailored tracks for Machine Learning Engineer, GenAI Engineer, Data Scientist, Computer Vision Engineer, MLOps Engineer, NLP Engineer.
- **Prerequisite Awareness**: When a student demonstrates mastery of foundational skills (e.g., Python), the stage is marked `completed` and the roadmap skips directly to active gap stages (e.g., RAG, Model Training, or Deployment).
- **Cohort & Placement Context**: Prioritizes foundation & projects for early years, and deployment, verification, and interviews for 3rd/final year students.
- **Explainable Next Actions**: Caps primary recommendations at maximum 3 items, each featuring a clear "Why now?" rationale based on goal gaps and evidence.

### 13. Data & Connections UI (`/student/connections`)
- Centralized view of all 11 external sources:
  - GitHub (Live Sync / Disconnect)
  - Resume (Document Upload)
  - LinkedIn (Profile Reference Only — No Scraping)
  - LeetCode, CodeChef, HackerRank, HackerEarth (Coding Platform References)
  - ERIS (Institutional Assessment Producer)
  - MentorMaze (Technical Mock Interview Producer)
  - Padho Code (Practice Learning Producer)
  - Study LPU (Academic Curriculum Producer)
- Explicit transparency labels detailing connection method, data extracted, and privacy safeguards.

### 14. Skills Directory & Detail Pages (`/student/skills`, `/student/skills/[skill]`)
- `/student/skills`: Search, category filter chips (AI & ML, GenAI, Data, Backend, Tools, Cloud), evidence state badges, and verified counts.
- `/student/skills/[skill]`: Deep-dive view showing Overview, "Why Tathastu Thinks This", confirmed projects utilizing the skill, provenance records, and recommended learning paths (Learn via Study LPU, Practice via Padho Code, Build via Projects, Verify via ERIS, Interview via MentorMaze).

### 15. Contextual EORA Explanations
- Contextual insight engine synthesizes the student's real Person Graph, current goal, project contributions, and gaps.
- Surfaces high-priority, non-spam observations on the student home (e.g. unreviewed candidate projects, deployment gap for ML engineer goal).

### 16. Privacy, Security & Data Boundaries
- **Private Repositories**: Data derived from private repositories remains strictly private to the student; never exposed publicly or to other students.
- **Context Firewall**: Eliminates PII, phone numbers, and compensation before calling model endpoints.
- **Prompt Defense**: Untrusted README texts are quarantined with tag neutralization (`<github_readme_data_untrusted>`), preventing system prompt injection.
- **Audit Logging**: AI invocations are logged in `aiAuditLogs` with task, provider, latency, and status; zero API keys or private source code logged.

---

## F. KNOWN LIMITATIONS & SCOPE BOUNDARIES (POST-PHASE B)
1. **LinkedIn Profile Sync**: Supported strictly as a user-provided profile link. Automatic browser scraping is deliberately excluded for privacy and terms-of-service compliance.
2. **Competitive Coding Platforms**: LeetCode, CodeChef, HackerRank, and HackerEarth support username / profile reference storage. Live competitive contest statistic polling is deferred until official APIs or sanctioned integrations are configured.
3. **Events & Hackathons**: Database schemas (`events`, `eventParticipants`) are established in migrations; dedicated interactive Events discovery UI is deferred beyond Phase B.
4. **Institutional Producers**: ERIS, MentorMaze, Padho Code, and Study LPU are connected via signed webhook and reference architecture; full native UI rebuilds for these sub-platforms remain outside current student loop scope.
5. **No Social Feed / Gamification**: Streaks, feeds, likes, and followers are intentionally absent to keep AI Tathastu focused on serious, evidence-grounded competence building.

