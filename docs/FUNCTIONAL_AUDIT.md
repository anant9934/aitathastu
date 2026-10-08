# AI TATHASTU — MASTER FUNCTIONAL AUDIT

**Audit Date**: October 2026  
**Target Scope**: AI/ML Student Experience  
**Repository State**: AI Tathastu Core + Exact Screen Prototype Layer  
**Language Rule**: English Only throughout entire product UI

---

## 1. Executive Summary & Baseline Results

| Check | Command Run | Result | Details |
|---|---|---|---|
| **Unit & Integration Tests** | `npm test` | **PASS (80/80)** | 5 test suites (`domain`, `auth-persistence`, `verification-readiness`, `integrations`, `onboarding-v2`). |
| **Linting** | `npm run lint` | **PASS (0 errors, 0 warnings)** | Clean ESLint 9 + Next.js config across `app`, `components`, `lib`. |
| **TypeScript Compilation** | `npx tsc --noEmit` | **PASS (0 errors)** | Full strict type-check verified. |
| **Database Migrations** | `npm run db:migrate` | **PASS** | PGlite/PostgreSQL migrations run idempotently on startup. |
| **Production Build** | `npm run build` | **Verified** | Next.js 15 App Router compilation verified. |

---

## 2. Capability Audit Matrix

| Feature | Current UI | Current Backend | Database | Real / Partial / Mock | Problems | Reuse? | Action Required | Priority |
|---|---|---|---|---|---|---|---|---|
| **Landing** | `Screen1Landing.tsx` | N/A (Static marketing) | None | Real UI | CTAs previously led to static screen navigator | Yes | Wire "Start your journey" to `/onboarding` and Sign in to `/sign-in` | P0 |
| **Auth** | `/sign-in`, `/sign-up`, cookie sessions | `lib/auth/session.ts`, `lib/auth/server-session.ts`, `lib/auth/password.ts` | `users`, `sessions` | **REAL** | UI prototype bypassed real session cookies | Yes | Connect onboarding & workspace to current authenticated user | P0 |
| **EORA** | `Screen2EoraIntro.tsx`, `components/eora-guide.tsx` | Rule-based guide & dialogs | `userPreferences` (`eoraDismissed`) | Partial | EORA prompt had hardcoded static name "Rahul Sharma" | Yes | Parameterize with real student name, dynamic context | P0 |
| **Onboarding** | `components/exact-screens/Screen1..11` & `components/onboarding-v2/` | `lib/services/onboarding-v2-service.ts`, `/api/onboarding-v2` | `onboarding_drafts`, `evidence_items`, `journey_events` | Partial (UI prototype vs Real service) | Prototype screens used local state and static demo defaults; real `onboarding-v2-service` exists but wasn't wired to exact screens | Yes | Wire exact-screens to `/api/onboarding-v2` draft persistence and completion | P0 |
| **Role Selection** | `Screen3ChooseRole.tsx` | `lib/onboarding-v2.ts` validation (`role === "student"`) | `roles`, `membership_roles` | Real (Student only) | Other roles (Faculty, Mentor, Alumni, Org) are prototypes | Yes | Enforce AI/ML Student first; mark other roles as "Coming later" | P0 |
| **Basic Profile** | `Screen4AcademicDetails.tsx` | `lib/repositories/person-repository.ts` | `persons`, `person_profiles` | Partial | Defaulted to "Rahul Sharma, Lovely Professional University"; lacked graduation cohort | Yes | Collect real student name, degree, institution, and `expectedGraduationYear` | P0 |
| **Resume Upload** | `Screen5ResumeUpload.tsx` | `app/api/resume/extract/route.ts`, `lib/resume-suggestions.ts` | None (Direct stream extraction) | **REAL** | Prototype screen simulated 100% upload progress without calling real extraction API | Yes | Connect real file upload to `/api/resume/extract`, populate unverified claims | P0 |
| **Digital Footprints** | `Screen6DigitalFootprints.tsx` | `lib/services/onboarding-v2-service.ts` (`allowedProfileUrl`) | `evidence_items` | Partial | Only stored profile URLs as strings without connector abstractions | Yes | Introduce connector policy registry; connect GitHub real OAuth/read client | P1 |
| **GitHub** | `Screen6DigitalFootprints.tsx`, `Screen10GitHubProjects.tsx` | URL validation in `allowedProfileUrl` | `evidence_items` (as self-reported) | Partial | No real GitHub API / GitHub App client; repository card in Screen 10 was hardcoded | Yes | Build `lib/connectors/github/client.ts` & `mapper.ts` for real repository & technology discovery | P1 |
| **LinkedIn** | `Screen6DigitalFootprints.tsx` | URL validation | `evidence_items` | Real (Profile Reference Only) | Scraping forbidden by policy | Yes | Keep as verified profile URL reference; no automated scraping | P1 |
| **LeetCode** | `Screen6DigitalFootprints.tsx` | URL validation | `evidence_items` | Real (Reference Only) | No automated stats | Yes | Build connector abstraction; mark stats unavailable until signed API | P4 |
| **HackerRank** | `Screen6DigitalFootprints.tsx` | URL validation | `evidence_items` | Real (Reference Only) | No automated stats | Yes | Connector abstraction; reference link only | P4 |
| **HackerEarth** | `Screen6DigitalFootprints.tsx` | URL validation | `evidence_items` | Real (Reference Only) | No automated stats | Yes | Connector abstraction; reference link only | P4 |
| **CodeChef** | `Screen6DigitalFootprints.tsx` | URL validation | `evidence_items` | Real (Reference Only) | No automated stats | Yes | Connector abstraction; reference link only | P4 |
| **Skills** | `Screen9SkillsMap.tsx`, `components/student/student-profile-view.tsx` | `lib/domain/evidence.ts`, `lib/domain/gaps.ts` | `evidence_items` | Partial | Screen 9 displayed static percentage circles ("Python 92%", "LLMs 85%") | Yes | Replace fake percentages with real states: `Unknown`, `Claimed`, `Some evidence`, `Demonstrated`, `Verified` | P0 |
| **Skill Detail** | In `Screen9SkillsMap.tsx` / drawers | `lib/domain/evidence.ts`, `components/student/evidence-drawer.tsx` | `evidence_items` | Partial | Lacked dedicated functional modal explaining evidence provenance | Yes | Connect to real evidence items and Why Tathastu Thinks This explanation | P2 |
| **Projects** | `Screen10GitHubProjects.tsx`, `components/student/student-profile-view.tsx` | `lib/services/onboarding-v2-service.ts` | `evidence_items` | Partial | Screen 10 had hardcoded "ai-tathastu-core", "neural-search-rag" cards | Yes | Populate from real GitHub discovery or manual entries with personal contribution claims | P1 |
| **Project Detail** | In `Screen10GitHubProjects.tsx` | `lib/services/onboarding-v2-service.ts` | `evidence_items` | Partial | Did not enforce explicit contribution options (Backend, ML, Dataset, etc.) | Yes | Add structured contribution selector (`Machine Learning`, `Backend`, `Frontend`, etc.) | P1 |
| **Achievements** | Screen 8 mentions / Student Home | `lib/domain/evidence.ts` (`category: "other"`) | `evidence_items` | Partial | No dedicated achievement entity table | Yes | Support certifications, awards, hackathons via `evidence_items` with source & verification status | P4 |
| **Goal** | Screen 11, `components/student/goal-card.tsx` | `lib/domain/goal.ts`, `lib/repositories/goal-repository.ts` | `goals` | **REAL** | Prototype hardcoded "AI / ML Engineer" | Yes | Allow choosing from AI/ML student templates or custom goal | P0 |
| **Journey** | `components/student/journey-rail.tsx` | `lib/domain/journey.ts`, `lib/repositories/journey-repository.ts` | `journey_events` | **REAL** | UI prototype in Screen 12 had static mock journey items | Yes | Wire real `journey_events` to Student Dashboard | P0 |
| **Evidence** | `components/student/recent-evidence.tsx` | `lib/domain/evidence.ts`, `lib/repositories/evidence-repository.ts` | `evidence_items` | **REAL** | Exact screen 12 had static 85% readiness and hardcoded evidence count | Yes | Wire `getEvidenceByPersonId` and summarize evidence by trust level | P0 |
| **Verification** | `components/student/request-verification-modal.tsx`, `/faculty` | `lib/services/verification-service.ts`, `lib/repositories/verification-repository.ts` | `verification_requests`, `verification_decisions` | **REAL** | Prototype UI did not expose verification action button | Yes | Expose verification requests on self-reported/extracted evidence items | P2 |
| **Readiness** | `components/student/readiness-card.tsx` | `lib/domain/readiness.ts` | `readiness_policies`, dynamic computation | **REAL** | Screen 12 showed fake "85% Profile Readiness" circle | Yes | Gate readiness behind defensible verification policy; show "Score unavailable until verified evidence exists" | P0 |
| **Learning Path** | In Screen 12 dashboard | `lib/domain/recommendations.ts` | None (Deterministic derivation) | Partial | Prototype showed static "Advanced RAG Pipelines" card | Yes | Implement AI/ML Roadmap Engine v1 (`lib/domain/roadmap.ts`) | P3 |
| **Recommendations** | `components/student/next-action-card.tsx` | `lib/domain/recommendations.ts` | `action_states` | **REAL** | Exact screen 12 had static cards | Yes | Wire real `generateRecommendations` and cap at 3 primary actions | P0 |
| **Search** | `components/student/workspace-search-modal.tsx` | In-memory search in workspace context | None | Real in workspace | Not present in exact screen 12 | Yes | Keep search modal in student dashboard | P3 |
| **Events** | Screen 12 mentions | None | None | Mock | Hardcoded Hackathon references | Yes | Add events foundation and schema types | P4 |
| **Communities** | Screen 12 mentions | None | None | Mock | Hardcoded club references | Yes | Add community types; no social feed yet | P4 |
| **Network / People** | Screen 12 mentions | None | None | Mock | Hardcoded "Priya Patel", "Dr. A. Verma" | Yes | Add network query dimensions (skills, cohort, location) | P4 |
| **Opportunities** | Screen 12 mentions | None | None | Mock | Fake "28 opportunities found" | Yes | Show real opportunities or empty state; no fake numbers | P4 |
| **Internships / Placement**| Screen 12 mentions | None | None | Mock | Static internship indicators | Yes | Support placement status enum (`preparing`, `eligible`, `actively_applying`, etc.) | P4 |
| **ERIS** | `lib/domain/integrations.ts`, `/api/integrations/eris/events` | `lib/services/integration-processor-service.ts` | `integration_events`, `assessment_attempts`, `assessment_results` | **REAL** | Prototype screen 12 didn't display assessment results | Yes | Connect assessment results into Person 360 and evidence ledger | P2 |
| **MentorMaze** | `lib/domain/integrations.ts`, `/api/integrations/ai-interview/events` | `lib/services/integration-processor-service.ts` | `integration_events`, `interview_sessions`, `interview_dimension_results` | **REAL** | Prototype screen 12 didn't display interview results | Yes | Connect interview dimension results into Person 360 as session-specific evidence | P2 |
| **Study LPU** | Concept | None | None | Mock/Design | No contract defined | Yes | Define first-party integration contract | P4 |
| **Padho Code** | Concept | None | None | Mock/Design | No contract defined | Yes | Define first-party integration contract | P4 |
| **Notifications** | Screen 12 bell icon | In-memory alerts | None | Mock | Static red dot | Yes | Basic notifications from journey events and action states | P3 |
| **Data / Privacy** | Screen 6 consent toggles | `lib/services/onboarding-v2-service.ts` | `evidence_items.whyItMatters` | Partial | Defaulted to public in UI copy | Yes | Sensitive data defaults to private; student owns visibility | P0 |
| **LLM Intelligence** | None (All deterministic) | `lib/resume-suggestions.ts` (Regex parser) | None | Partial | Prototype lacked provider abstraction; pure regex parser | Yes | Implement `lib/intelligence/` router with provider adapters & prompt injection firewall | P2 |
| **BYOK** | None | None | None | Missing | Architecture needed | Yes | Design BYOK architecture; store key in local vault / browser only | P3 |
| **Real-time Sync** | None | None | None | Missing | No webhooks or polling | Yes | Add GitHub webhook signature verification handler | P2 |

---

## 3. Code Classification (A–F)

### Category A — Real and Reusable (Production-Ready Backend & Domain Logic)
- `lib/db/schema.ts`, `lib/db/index.ts`, `lib/db/migration-sql.ts`, `lib/db/seed.ts` (Full Drizzle ORM + PGlite/Postgres support)
- `lib/auth/session.ts`, `lib/auth/server-session.ts`, `lib/auth/password.ts`, `lib/auth/rbac.ts` (Bcrypt, cookie sessions, RBAC)
- `lib/domain/evidence.ts` (Strict evidence categorization, self-reported vs unverified vs verified, provenance)
- `lib/domain/readiness.ts` (Defensible readiness scoring with publication gates and arithmetic explanation)
- `lib/domain/gaps.ts` (Deterministic gap evaluator)
- `lib/domain/recommendations.ts` (Explainable Next Action generation, capped at 3 actions)
- `lib/domain/integrations.ts`, `lib/services/integration-processor-service.ts` (Signed HMAC-authenticated ERIS and AI Interview ingestion)
- `lib/repositories/*` (All 8 repositories: user, person, goal, evidence, journey, action, verification, integration)
- `lib/services/verification-service.ts` (Verifier workflows, decision recording, immutable audit trail)
- `lib/services/person-360-service.ts` (Person 360 aggregate query)
- `app/api/resume/extract/route.ts` (Magic-byte validation, PDF & DOCX text extraction)

### Category B — Real But Needs Integration (Needs Wiring to New UI)
- `lib/services/onboarding-v2-service.ts` (Persists drafts and creates initial evidence items, but was decoupled from `components/exact-screens`)
- `components/student/student-context.tsx` (`WorkspaceProvider` holding live state, not utilized by `Screen12StudentDashboard`)
- `lib/resume-suggestions.ts` (Extracts skills and projects, needs to feed into `Screen7AiAnalysis` and `Screen9SkillsMap`)
- `components/student/request-verification-modal.tsx`, `evidence-drawer.tsx`, `readiness-explanation-modal.tsx` (Complete functional modals, need hooks from the new dashboard)

### Category C — Prototype UI Only (Visually Finished Screens Needing Data Binding)
- `components/exact-screens/Screen1Landing.tsx` (Hardcoded CTA links)
- `components/exact-screens/Screen2EoraIntro.tsx` (Pre-filled "Rahul Sharma")
- `components/exact-screens/Screen3ChooseRole.tsx` (Has role buttons without coming soon badges)
- `components/exact-screens/Screen4AcademicDetails.tsx` (Hardcoded LPU CSE defaults)
- `components/exact-screens/Screen5ResumeUpload.tsx` (Fake upload progress bar without calling API)
- `components/exact-screens/Screen6DigitalFootprints.tsx` (URL inputs not saving to connector state)
- `components/exact-screens/Screen7AiAnalysis.tsx` (Simulated timer without real payload analysis)
- `components/exact-screens/Screen8ProfileInsights.tsx` (Hardcoded "Strong Project Foundation 88%")
- `components/exact-screens/Screen9SkillsMap.tsx` (Hardcoded "Python 92%", "LLMs 85%")
- `components/exact-screens/Screen10GitHubProjects.tsx` (Hardcoded project cards)
- `components/exact-screens/Screen11OnboardingComplete.tsx` (Static completion card)
- `components/exact-screens/Screen12StudentDashboard.tsx` (Completely static dashboard with fake stats)

### Category D — Mock Data / Fake Logic (Must Be Removed From Authenticated Routes)
- Rahul Sharma fixture in `ExactScreensContainer.tsx`
- Static 85% readiness score in `Screen12StudentDashboard.tsx`
- 28 opportunities fake counter in `Screen12StudentDashboard.tsx`
- Fake recommendation cards with hardcoded click handlers in `Screen12StudentDashboard.tsx`
- Simulated AI analysis delay in `Screen7AiAnalysis.tsx`

### Category E — Deprecated / Duplicate Components
- `components/onboarding/onboarding-container.tsx` (Old Phase 2 onboarding wizard, superseded by exact-screens and onboarding-v2)
- `app/onboarding-flow.css` (Partially redundant with `app/exact-screens.css`)

### Category F — Security or Privacy Risks Identified
- Defaulting profile data to public visibility without explicit user consent
- Direct ingestion of unverified third-party claims into verified skills (violates Core Tathastu Trust Principle)
- Potential LLM prompt injection if external repository README text is fed raw into model system prompts
- Lack of rate-limiting or least-privilege scoping on external connectors

---

## 4. Key Decisions for Functionalization Phase A–E Execution

1. **Student Context & Cohort**:
   - Add `expectedGraduationYear` to `personProfiles` in database schema.
   - Restrict initial live experience strictly to AI/ML Students.
2. **Remove Static Rahul**:
   - Bind `/onboarding` and `/student` to current session, database person, and onboarding draft.
   - Confine static demo fixtures strictly to `/screens` (the 12-screen reference gallery).
3. **Data Acquisition Architecture**:
   - Create `lib/connectors/registry.ts`, `lib/connectors/github/client.ts`, and `lib/acquisition/acquisition-service.ts`.
   - Never scrape LinkedIn or coding platforms; store verified URLs or approved API data only.
4. **Intelligence Layer**:
   - Create `lib/intelligence/` with model provider adapters (Gemini, Groq, OpenRouter, Cerebras, Mistral, SambaNova).
   - Strict deterministic fallback when no LLM keys are configured.
   - Context firewall strips PII (phone, emails, private scores) before sending prompts.
   - Treat external content (READMEs, resume text) as untrusted data.
5. **Personalized Roadmap Engine v1**:
   - Compute roadmap from Goal + Evidence + Gap + Prerequisite graph.
   - Skip demonstrated prerequisites (e.g. skip beginner Python if already evidenced).

---

## 5. Phase F Functionalization Baseline & Live Verification Audit

**Phase F Audit Date**: October 2026  
**Commit & Workspace Scope**: Full App (`aitathastu`), 36 DB tables on Neon PostgreSQL, Next.js 15 App Router  
**Verification Pass**: 307 tests across 58 test suites (`npm test`: 307 PASS, 0 FAIL)  
**Typecheck**: `tsc --noEmit` (0 errors)  
**Production Build**: `next build` (66 static/dynamic routes compiled, 0 errors)  

### 5.1 Route-to-Service-to-Database Dependency Map

```
/api/health ─────────────────────────► System probe (uptime, status) ────────► No DB dependency
/api/ready ──────────────────────────► neon-http driver ────────────────────► SELECT to_regclass('organizations')
/api/auth/sign-in, sign-up ──────────► session.ts, password.ts ─────────────► users, sessions, persons
/api/student/dashboard ──────────────► personalization-engine.ts ──────────► persons, personProfiles, goals, evidenceItems, projects
/api/student/projects ───────────────► project-repository.ts ──────────────► projects, evidenceItems, aiAuditLogs
/api/student/goal ───────────────────► goal-repository.ts ─────────────────► goals, readinessPolicies
/api/student/readiness ──────────────► readiness.ts ───────────────────────► readinessPolicies, evidenceItems
/api/student/feedback ───────────────► feedback handler ───────────────────► userPreferences, journeyEvents
/api/eora/chat ──────────────────────► rag-engine.ts, router.ts, executor ──► CANONICAL_AIML_KB, aiAuditLogs, session context
/api/integrations/github/webhook ────► hmac-validator, job queue ──────────► integrationEvents, evidenceItems
/api/integrations/[app]/events ──────► integration-processor-service.ts ───► assessmentResults, interviewSessions
```

### 5.2 Functional Classification of Visible Platform Features

| Visible Feature | Functional Status | Backend Service | Data Lineage | External Dependency State |
|---|---|---|---|---|
| **Student Auth & Session Isolation** | **Fully functional with real persisted data** | `lib/auth/session.ts` | Remote Neon PostgreSQL (`users`, `sessions`) | Tested live against Neon |
| **Student Dashboard (5-Section Scroll)** | **Fully functional with real persisted data** | `personalization-engine.ts` | Person 360, Drizzle ORM | Tested live in browser & suites |
| **All 96 Personalization Configurations** | **Fully functional with real persisted data** | `personalization-engine.ts` | 6 modes x 16 role/goal variants | Tested in `personalization-engine-96-configs.test.ts` |
| **Target Role Taxonomy & Prerequisites** | **Fully functional with real persisted data** | `aiml-role-taxonomy.ts` | Deterministic graph | Zero mock leakage verified |
| **Project CRUD & SSRF Defense** | **Fully functional with real persisted data** | `project-repository.ts` | Neon DB `projects` | Private IP filtering verified |
| **Readiness Policy Gate Enforcement** | **Fully functional with real persisted data** | `readiness.ts` | Gate requires >=60% verified coverage | Zero hallucinated scores verified |
| **EORA Conversational Assistant** | **Fully functional (Deterministic + RAG)** | `rag-engine.ts`, `router.ts` | 16-domain canonical KB | Live RAG + streaming response verified |
| **Safe Tool Execution Framework** | **Fully functional with user gate** | `tool-executor.ts` | Requires student confirmation | Arbitrary SQL/code blocked |
| **Background Job Queue** | **Fully functional with idempotency** | `lib/jobs/queue.ts` | Memory/Postgres queue | Bounded retry + stuck monitor |
| **GitHub App / Public Metadata Fetch** | **Implemented contract; credential blocked** | `connectors/github/client.ts` | OAuth / Personal token | BLOCKED: Awaiting production app credentials |
| **Study LPU Learning Activity** | **Implemented contract; independent app** | `integrations/study-lpu/` | Signed HMAC events | DISABLED: Awaiting independent producer deployment |
| **Padho Code Coding Practice** | **Implemented contract; independent app** | `integrations/padho-code/` | Signed HMAC events | DISABLED: Awaiting independent producer deployment |
| **ERIS Institutional Verification** | **Implemented contract; independent app** | `integrations/eris/` | Signed HMAC events | DISABLED: Awaiting independent producer deployment |
| **MentorMaze Mock Interview** | **Implemented contract; independent app** | `integrations/mentormaze/` | Signed HMAC events | DISABLED: Awaiting independent producer deployment |
| **LLM Third-Party Provider APIs** | **Functional with simulated/fallback provider** | `providers/registry.ts` | Deterministic rule engine active | BLOCKED: Awaiting provider API keys in staging |

