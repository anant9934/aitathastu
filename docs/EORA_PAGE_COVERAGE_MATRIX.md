# AI Tathastu — EORA Alive Phase 7
# Universal Page Intelligence (UPI): Complete Page Coverage Matrix

**Engine**: EORA Universal Page Intelligence (UPI)  
**Version**: 7.0.0  
**Verification Date**: October 10, 2026  
**Status**: 100% Comprehensive Route Audit & Contract Coverage  
**Character Lock**: Original EORA (`v1.0.0`, sky-blue hoodie, round black glasses, brown eyes)  
**Routine LLM Invocations**: 0 (Fully Deterministic, Contract-Grounded)  

---

## 1. Executive Summary & Route Inventory

EORA Universal Page Intelligence (UPI) equips EORA with deep, structured, context-aware understanding across all 16 genuine routes in the AI Tathastu Next.js App Router application.

No routes are fabricated, and no non-existent modules (e.g. hypothetical external marketplaces) are registered. For unimplemented or restricted endpoints, EORA provides honest, dignified availability and authorization guidance.

| # | Route Pattern | Page ID | Category | Auth Requirement | Guided Tour | DOM Targets Deployed | Coverage Status |
|---|---|---|---|---|---|---|---|
| 1 | `/` | `public-landing` | Public | Public / Anonymous | Yes (3 steps) | 3 | **COVERED & VERIFIED** |
| 2 | `/sign-in` | `auth-signin` | Authentication | Public | Yes (2 steps) | 2 | **COVERED & VERIFIED** |
| 3 | `/sign-up` | `auth-signup` | Registration | Public | Yes (2 steps) | 2 | **COVERED & VERIFIED** |
| 4 | `/onboarding` | `onboarding-journey` | Onboarding | Multi-step / Partial | Yes (6 steps) | 6 | **COVERED & VERIFIED** |
| 5 | `/student` | `student-home` | Workspace | Authenticated Student | Yes (4 steps) | 4 | **COVERED & VERIFIED** |
| 6 | `/student/profile` | `student-profile` | Person 360 | Authenticated Student | Yes (3 steps) | 3 | **COVERED & VERIFIED** |
| 7 | `/student/skills` | `student-skills` | Competency | Authenticated Student | Yes (3 steps) | 3 | **COVERED & VERIFIED** |
| 8 | `/student/skills/[skill]` | `student-skill-detail` | Skill Deep-Dive | Authenticated Student | Yes (3 steps) | 4 | **COVERED & VERIFIED** |
| 9 | `/student/projects` | `student-projects` | Portfolio | Authenticated Student | Yes (4 steps) | 4 | **COVERED & VERIFIED** |
| 10 | `/student/projects/[id]` | `student-project-detail` | Project Deep-Dive | Authenticated Student | Yes (3 steps) | 3 | **COVERED & VERIFIED** |
| 11 | `/student/roadmap` | `student-roadmap` | Career Trajectory | Authenticated Student | Yes (3 steps) | 3 | **COVERED & VERIFIED** |
| 12 | `/student/connections` | `student-connections` | Digital Footprint | Authenticated Student | Yes (3 steps) | 3 | **COVERED & VERIFIED** |
| 13 | `/student/journey` | `student-journey` | Milestone Timeline | Authenticated Student | Yes (2 steps) | 1 | **COVERED & VERIFIED** |
| 14 | `/student/assessments` | `student-assessments` | Diagnostic | Authenticated Student | Yes (2 steps) | 2 | **COVERED & VERIFIED** |
| 15 | `/student/interviews` | `student-interviews` | Simulation | Authenticated Student | Yes (1 step) | 1 | **COVERED & VERIFIED** |
| 16 | `/verification` | `faculty-verification` | Faculty Review | Authorized Faculty/Admin | Yes (2 steps) | 2 | **COVERED & VERIFIED** |

---

## 2. Exhaustive Page Contracts Specification

### 2.1 Route: `/` (`public-landing`)
- **Title**: AI Tathastu — Build Proof, Not Just Resumes
- **Purpose**: Showcase the AI Tathastu career acceleration platform, demonstrate verified evidence concepts, and guide visitors to begin their AI journey.
- **Main Goals**: Understand AI Tathastu's mission, explore evidence vs. self-reported claims, start onboarding.
- **Key Sections**:
  - `eora-landing-hero`: Hero introduction with value proposition and approved large EORA illustration.
  - `eora-landing-features`: Architecture features explaining verified projects, skills, and roadmap.
  - `eora-landing-cta`: Get Started call to action.
- **Guided Tour**: 3 steps (`landing-hero`, `landing-features`, `landing-cta`).
- **Data Dependencies**: None (Static SSR).
- **Permissions**: Public.

### 2.2 Route: `/sign-in` (`auth-signin`)
- **Title**: Sign In | AI Tathastu
- **Purpose**: Authenticate returning students, faculty reviewers, and institutional administrators.
- **Main Goals**: Access authenticated workspace safely, recover credentials, choose Google OAuth or institutional login.
- **Key Sections**:
  - `eora-signin-card`: Main authentication credentials form.
  - `eora-signin-oauth`: Google OAuth one-click authentication.
- **Sensitive Fields**: Passwords, OTP codes, and authentication tokens are strictly barred from EORA reading or interaction.
- **Guided Tour**: 2 steps (`signin-card`, `signin-oauth`).
- **Recovery Guidance**: Clear guidance on incorrect passwords and session expiration.

### 2.3 Route: `/sign-up` (`auth-signup`)
- **Title**: Create Account | AI Tathastu
- **Purpose**: New user account creation and initial identity registration.
- **Main Goals**: Create student account, accept terms and data privacy consent, start onboarding.
- **Key Sections**:
  - `eora-signup-card`: Email and password registration container.
  - `eora-signup-oauth`: Fast signup via Google OAuth.
- **Guided Tour**: 2 steps (`signup-card`, `signup-oauth`).
- **Validation Rules**: Email format requirement, minimum 8-character password.

### 2.4 Route: `/onboarding` (`onboarding-journey`)
- **Title**: Onboarding Journey | AI Tathastu
- **Purpose**: Multi-step onboarding to capture student identity, academic background, target AI/ML role, priorities, and extract initial resume evidence.
- **Main Goals**: Define career trajectory, upload resume, connect GitHub, preview initial Person 360 profile.
- **Key Sections**:
  - `eora-name-input`: Student name input step.
  - `eora-role-select`: Academic role selection.
  - `eora-ai-direction`: Target AI/ML track selection.
  - `eora-priorities`: Immediate goals (Internship, Research, Building).
  - `eora-academic-form`: Institution and graduation year input.
  - `eora-resume-upload`: PDF/DOCX resume upload dropzone.
  - `eora-digital-footprints`: GitHub/LinkedIn connection step.
- **Guided Tour**: 6 steps covering each primary onboarding stage.
- **Privacy Protections**: Clear explanation of extraction boundaries and zero credential leakage.

### 2.5 Route: `/student` (`student-home`)
- **Title**: Student Workspace | AI Tathastu
- **Purpose**: Central command center displaying personalized AI career progression, active milestones, high-leverage next actions, and evidence summaries.
- **Main Goals**: Review current readiness score, execute top 3 actions, track verified evidence ledger.
- **Key Sections**:
  - `eora-active-goal`: Current target AI/ML role card.
  - `eora-next-actions`: 3 highest-leverage prioritized next tasks.
  - `eora-evidence-panel`: Breakdown of verified vs. self-reported proof.
  - `eora-sidebar`: Navigation drawer to specialized modules.
- **Guided Tour**: 4 steps (`home-goal`, `home-actions`, `home-evidence`, `home-sidebar`).

### 2.6 Route: `/student/profile` (`student-profile`)
- **Title**: Person 360 Profile | AI Tathastu
- **Purpose**: Authoritative student profile showing verified credentials, proven skills, completed projects, and faculty evaluations.
- **Main Goals**: Review personal proof ledger, audit verified vs unverified items, generate sharable proof link.
- **Key Sections**:
  - `eora-profile-header`: Student identity, affiliation, and readiness tier.
  - `eora-profile-goals`: Active career specialization targets.
  - `eora-profile-evidence`: Chronological evidence ledger items.
- **Guided Tour**: 3 steps (`prof-header`, `prof-goals`, `prof-evidence`).

### 2.7 Route: `/student/skills` (`student-skills`)
- **Title**: Skills Competency Map | AI Tathastu
- **Purpose**: Complete map of student technical skills, categorizing demonstrated proof, self-reported claims, and faculty-verified competencies.
- **Main Goals**: Identify skill gaps toward target role, inspect evidence backing specific skills, submit verification requests.
- **Key Sections**:
  - `eora-skills-overview`: Metric cards for total, demonstrated, and verified skills.
  - `eora-skills-list`: Interactive grid of categorized technical skills.
  - `eora-skill-verification`: Verification status indicator badges.
- **Guided Tour**: 3 steps (`skills-overview`, `skills-list`, `skills-verify`).

### 2.8 Route: `/student/skills/[skill]` (`student-skill-detail`)
- **Title**: Skill Detail Deep Dive | AI Tathastu
- **Purpose**: In-depth evidence provenance, related repository commits, and curated learning path for an individual skill.
- **Main Goals**: Inspect source proof, explore associated projects, follow targeted learning modules.
- **Key Sections**:
  - `eora-skill-detail-card`: Skill header card and current badge status.
  - `eora-skill-detail-evidence`: Underlying evidence citations (commits, projects).
  - `eora-skill-detail-projects`: Applied repositories utilizing this skill.
  - `eora-skill-detail-learning`: Curated tutorials and documentation.
- **Guided Tour**: 3 steps (`sk-card`, `sk-evidence`, `sk-projects`).

### 2.9 Route: `/student/projects` (`student-projects`)
- **Title**: My Projects & Evidence | AI Tathastu
- **Purpose**: Project portfolio center showing confirmed AI/ML builds, personal contribution boundaries, GitHub synched code, and architecture notes.
- **Main Goals**: Register new project, document specific contributions, review automated code observations.
- **Key Sections**:
  - `eora-projects-header`: Projects summary and action bar.
  - `eora-projects-list`: Confirmed projects cards container.
  - `eora-contribution-note`: Specific contribution explanation area.
  - `eora-add-project-btn`: Add project creation button.
- **Guided Tour**: 4 steps (`projects-header`, `projects-list`, `projects-contribution`, `add-proj-step`).

### 2.10 Route: `/student/projects/[id]` (`student-project-detail`)
- **Title**: Project Architecture Detail | AI Tathastu
- **Purpose**: Detailed breakdown of a specific project, displaying code metrics, repository links, contribution statements, and improvement recommendations.
- **Main Goals**: Review project metrics, attach live demo link, read improvement recommendations.
- **Key Sections**:
  - `eora-project-detail-hero`: Project metadata, tech stack, and links.
  - `eora-project-detail-contribution`: Documented student role and contributions.
  - `eora-project-detail-architecture`: Code architecture and complexity analysis.
- **Guided Tour**: 3 steps (`pd-hero`, `pd-contrib`, `pd-arch`).

### 2.11 Route: `/student/roadmap` (`student-roadmap`)
- **Title**: Learning Roadmap | AI Tathastu
- **Purpose**: Prerequisite-aware learning path tailored to the student's target AI/ML role, dynamically skipping mastered stages and prioritizing real gaps.
- **Main Goals**: View active stage, understand upcoming milestones, launch stage-specific build or practice actions.
- **Key Sections**:
  - `eora-roadmap-header`: Target role header and current progress overview.
  - `eora-roadmap-next`: What Matters Now primary action cards.
  - `eora-roadmap-milestones`: Sequential stages progression tree.
- **Guided Tour**: 3 steps (`roadmap-header`, `roadmap-milestones`, `roadmap-next`).

### 2.12 Route: `/student/connections` (`student-connections`)
- **Title**: Digital Footprints | AI Tathastu
- **Purpose**: External developer profile synchronization (GitHub, LinkedIn, Kaggle, Hugging Face) for automated evidence collection.
- **Main Goals**: Connect GitHub account, inspect sync history, understand public reference links vs OAuth sync.
- **Key Sections**:
  - `eora-connections-grid`: Integration cards for each external platform.
  - `eora-connection-github`: Dedicated GitHub connection and sync card.
  - `eora-sync-history`: Historical synchronization log and detected evidence count.
- **Guided Tour**: 3 steps (`conn-grid`, `conn-github`, `conn-history`).

### 2.13 Route: `/student/journey` (`student-journey`)
- **Title**: Student Journey Timeline | AI Tathastu
- **Purpose**: Chronological timeline of milestones achieved, evidence verified, projects added, and diagnostic scores recorded.
- **Main Goals**: Reflect on career growth, review historical achievements, share progression summary.
- **Key Sections**:
  - `eora-journey-timeline`: Chronological progression stream.
- **Guided Tour**: 2 steps (`journey-timeline`, `journey-summary`).

### 2.14 Route: `/student/assessments` (`student-assessments`)
- **Title**: Diagnostic Assessments | AI Tathastu
- **Purpose**: Standardized technical and conceptual diagnostic evaluations across AI/ML topics to establish baseline readiness.
- **Main Goals**: Take diagnostic tests, review topic breakdown scores, identify prerequisite weaknesses.
- **Key Sections**:
  - `eora-assessments-list`: Available assessment modules.
  - `eora-assessments-scores`: Past assessment results and topic scores.
- **Guided Tour**: 2 steps (`assess-list`, `assess-scores`).

### 2.15 Route: `/student/interviews` (`student-interviews`)
- **Title**: Mock Technical Interviews | AI Tathastu
- **Purpose**: Role-specific mock interview simulations for ML System Design, GenAI Architecture, and Python problem solving.
- **Main Goals**: Practice technical explanations, benchmark communication clarity, prepare for campus placements.
- **Key Sections**:
  - `eora-interviews-list`: Supported interview simulation modules.
- **Guided Tour**: 1 step (`iv-list`).

### 2.16 Route: `/verification` (`faculty-verification`)
- **Title**: Faculty Verification Queue | AI Tathastu
- **Purpose**: Institutional evaluation dashboard for professors and verifiers to review student evidence submissions, inspect code artifacts, and issue official verified credentials.
- **Main Goals**: Review pending submissions, inspect repository links and contribution notes, approve or request revisions.
- **Key Sections**:
  - `eora-verification-queue`: Review queue of submitted student evidence items.
  - `eora-verification-action`: Review modal and decision controls.
- **Guided Tour**: 2 steps (`v-queue`, `v-action`).
- **Authorization Guard**: Restricted to users with `student.verify_skill` permissions. Unauthorized students receive clear, non-shaming redirection.

---

## 3. Development-Time Coverage Checker

To prevent regressions when new routes are created in Next.js App Router, EORA UPI includes an automated coverage test script:

```bash
node --env-file=.env --import tsx scripts/verify-eora-phase7-coverage.ts
```

The checker enforces:
1. Every actual route pattern must be present in `PAGE_REGISTRY`.
2. Every registered contract must have non-empty `title`, `purpose`, `mainGoals`, `availableFunctions`, and `guidedTour`.
3. Every DOM target referenced in `keySections` and `guidedTour.steps` must be physically present in the code repository (`data-eora-id="..."`).
4. Any unmapped or dynamic query URL gracefully falls back to the safe generic page contract (`getSafeGenericPageContract`) without fabricating phantom tours or throwing unhandled runtime exceptions.
