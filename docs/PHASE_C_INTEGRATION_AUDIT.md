# Phase C Integration Audit

## Baseline
- **Tests**: 136 / 136 passing
- **Date**: 2026-10-07

---

## What Already Exists

### 1. Integration Infrastructure (Phase B — FULLY BUILT)

#### `lib/db/schema.ts`
All integration tables already exist:
- `integrationCredentials` — producer auth with hashed key + org binding
- `integrationIdentityLinks` — `organizationId + producer + externalSubjectId → personId`
- `integrationEvents` — idempotency + processing status record
- `assessmentAttempts` — ERIS assessment data
- `assessmentTopicResults` — per-topic scores
- `assessmentResults` — overall score
- `interviewSessions` — AI interview session
- `interviewDimensionResults` — per-dimension scores
- `events` + `eventParticipants` — ecosystem events schema (Phase B)
- `externalConnections` — includes `study_lpu`, `padho_code`, `mentormaze`, `eris`

#### `lib/domain/integrations.ts`
Producer types: `"eris" | "ai_interview"` (ERIS + MentorMaze)

Functions:
- `validateErisPayload()` — schema + version validation
- `validateAiInterviewPayload()` — schema + prohibited dimension check
- `isDisallowedInterviewDimension()` — filters emotion/facial/personality
- `mapErisTopicToEvidence()` — deterministic evidence mapping
- `mapInterviewDimensionToEvidence()` — session-specific interview evidence

Missing from domain:
- `study_lpu` and `padho_code` as producer types
- `LearningActivity` type
- `CodingPracticeActivity` type
- Deterministic skill mapping for Padho Code topics
- Handoff token types

#### `lib/services/integration-processor-service.ts`
- `processErisEvent()` — full pipeline: auth → validate → idempotency → identity → record → evidence → journey
- `processAiInterviewEvent()` — same pipeline for AI interviews

Missing:
- `processStudyLpuEvent()`
- `processPadhoCodeEvent()`
- `processMentorMazeEvent()` (currently mapped to ai_interview)

#### `lib/repositories/integration-repository.ts`
- `createIntegrationCredential()` — key hashing, org binding
- `createIdentityLink()` / `getIdentityLink()` — identity resolution
- `getIntegrationEventByProducerAndExternalId()` — idempotency check
- `recordIntegrationEvent()` / `updateIntegrationEventStatus()`
- `recordAssessmentAttempt()` / `recordInterviewSession()`
- `getStudentAssessments()` / `getStudentInterviews()`

Missing:
- `recordLearningActivity()`
- `recordCodingPracticeActivity()`
- `getLearningActivitiesByPersonId()`
- `getCodingActivitiesByPersonId()`

#### `lib/connectors/registry.ts`
Policies for ALL producers already defined:
- `study_lpu` — `signed_server`, `self_reported`
- `padho_code` — `signed_server`, `self_reported`
- `eris` — `signed_server`, `institution_verified`
- `mentormaze` — `signed_server`, `unverified`

#### `app/api/integrations/eris/` and `app/api/integrations/ai-interview/`
HTTP route endpoints already exist (need inspection)

#### `app/api/student/connections/`
Connections API already lists: `github`, `resume`, `linkedin`, `eris`, `mentormaze`, `padho_code`, `study_lpu`

### 2. Intelligence Layer (Phase B)
- `lib/domain/gaps.ts` — `evaluateGaps()` with keyword-based dimension matching
- `lib/domain/readiness.ts` — `calculateReadiness()`, `READINESS_POLICIES`, dimension strength
- `lib/domain/recommendations.ts` — `computeNextActions()`, `generateMLRecommendations()`
- `lib/domain/roadmap.ts` — `generatePersonalizedRoadmap()` with ERIS/MentorMaze/StudyLPU/PadhoCode action types already named

### 3. Journey System (Phase B)
- `lib/domain/journey.ts` — `JourneyEventType` includes `eris_assessment_completed`, `ai_interview_completed`
- `lib/repositories/journey-repository.ts` — `createJourneyEventRecord()`

### 4. Person Graph (Phase B)
- `lib/domain/person-graph.ts` — `buildPersonGraph()` reads evidence, projects, connections
- Missing: `learningSummary`, `practiceSummary`, `assessmentSummary`, `interviewSummary`, `recentActivities`

### 5. Student UI (Phase B)
- `/student/connections` — shows all ecosystem apps with status
- `/student/roadmap` — shows personalized roadmap
- `/student/skills` — shows skill graph

---

## What Needs to Be Built in Phase C

### New DB Tables Required
1. `learning_activities` — Study LPU normalized records
2. `coding_practice_activities` — Padho Code normalized records

### New Domain / Domain Extensions
1. `lib/domain/integrations.ts` — Add Study LPU + Padho Code types, skill mapping
2. `lib/domain/ecosystem.ts` — `StudentActivity` unified model, `ContinueWhereYouLeftOff`, `LearningMonitor`
3. `lib/domain/handoff.ts` — `AppHandoffToken` design
4. `lib/domain/journey.ts` — Add new journey event types for Study LPU / Padho Code / MentorMaze
5. `lib/domain/meaningful-change.ts` — `MeaningfulChange` detection

### New Service Functions
1. `processStudyLpuEvent()` in integration-processor-service
2. `processPadhoCodeEvent()` in integration-processor-service
3. `processMentorMazeEvent()` (upgrade from ai_interview)

### New Repository Functions
- Learning activity CRUD
- Coding practice activity CRUD
- Activity summary queries

### API Routes
1. `app/api/integrations/study-lpu/route.ts`
2. `app/api/integrations/padho-code/route.ts`
3. `app/api/integrations/mentormaze/route.ts`
4. `app/api/student/activity/route.ts` — unified activity feed
5. `app/api/student/handoff/route.ts` — signed handoff token

### Person Graph Extension
- `learningSummary`, `practiceSummary`, `assessmentSummary`, `interviewSummary`
- `recentActivities` (lightweight)

### UI Updates
- Student Home: `Continue Where You Left Off`, `Current Picture`, `What Matters Now` (max 3)
- Connections page: Update identity link status for all ecosystem apps

### Developer Demo Scripts
1. `scripts/demo-study-lpu-event.ts`
2. `scripts/demo-padho-code-event.ts`
3. `scripts/demo-mentormaze-event.ts`

### Tests (34 new)
- Study LPU: 5 tests
- Padho Code: 5 tests
- ERIS: 7 more specific tests
- MentorMaze: 5 tests
- Closed loop: 12 tests

---

## What Must NOT Be Created
- Any "verified" competence from Study LPU completions
- Any "verified" competence from Padho Code practice
- Any emotion/facial/personality dimensions in MentorMaze
- Any permanent trait labels from interview evidence
- Cross-organization evidence attribution
- LLM-decided evidence verification status
