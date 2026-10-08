# AI TATHASTU — PHASE E.5 EXTENSION REPORT
## AI/ML Target Role & Goal Selector Implementation

### Executive Summary

In accordance with the Phase E.5 Extension requirements, a complete, production-grade onboarding screen named **Your AI/ML Direction** (Step 2 of 10) has been created and seamlessly integrated into the AI Tathastu application.

The entire career and learning ecosystem strictly targets **Artificial Intelligence and Machine Learning (AI/ML)** disciplines. The new flow establishes clean separation between:
1. **Target AI/ML Role** (e.g. *Generative AI Engineer*, *Machine Learning Engineer*, *AI Researcher*)
2. **Specific Outcome / Goal** (e.g. *Get an AI/ML internship*, *Prepare for an AI/ML job*, *Build a strong AI/ML project*, *Custom goal*)
3. **Optional Timeline** (e.g. *Within 3 months*, *Within 6 months*, *Specific date*, *Flexible*)
4. **Priorities / Platform Interests** (e.g. *Internships & Jobs*, *Build Projects*, *Learn AI & ML*)

---

### 1. Canonical 10-Step Onboarding Architecture

A centralized step registry (`lib/onboarding-step-registry.ts`) was implemented to enforce 100% consistent logical step counting and eliminate disjointed indicators (such as "Step 1.5 of 7"):

| Step # | Screen Name | Step ID | Short Label | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Step 1** | Choose Platform Role | `platform_role` | Platform Role | Choose Student, Faculty, Mentor, or Organization |
| **Step 2** | **Your AI/ML Direction (NEW)** | `aiml_direction` | **AI/ML Direction** | **Choose Target AI/ML Role, First Goal, & Timeline** |
| **Step 3** | What Brings You to Tathastu | `priorities` | Priorities | Select up to 3 platform priorities/interests |
| **Step 4** | Basic Academic Details | `academic_details` | Academic Details | Confirm Degree, University, Branch, Year, Password |
| **Step 5** | Resume / CV Upload | `resume_upload` | Resume & CV | Drag & drop PDF/DOCX parsing (Optional) |
| **Step 6** | Connect Digital Profiles | `digital_profiles` | Digital Profiles | Link GitHub, LinkedIn, LeetCode, CodeChef |
| **Step 7** | Review & Analyze Info | `ai_analysis` | AI Analysis | Animated EORA analysis and picture synthesis |
| **Step 8** | Review Profile & Skills | `profile_insights` | Profile & Skills | Verify starting picture, confirmed skills, and insights |
| **Step 9** | Review Projects & Work | `github_projects` | Projects | Review discovered/added projects and contributions |
| **Step 10** | Finalize & Enter Dashboard | `complete_launch` | Launch | Complete onboarding and launch into workspace |

---

### 2. Curated AI/ML Role Catalog (14 Roles across 4 Categories)

Defined centrally in `lib/domain/aiml-role-taxonomy.ts`:

#### Engineering (7 Roles)
- **Generative AI Engineer**: Build LLM applications, RAG pipelines, fine-tuning workflows, and autonomous agent systems.
- **Machine Learning Engineer**: Design, train, optimize, and deploy scalable ML models in production.
- **AI Engineer**: Bridge software systems and AI APIs to build resilient AI-powered applications.
- **Deep Learning Engineer**: Architect and benchmark multi-layer neural networks for vision, speech, and complex data.
- **MLOps Engineer**: Automate ML CI/CD pipelines, model registries, drift detection, and production monitoring.
- **NLP Engineer**: Develop natural language understanding, tokenizers, and translation systems.
- **Computer Vision Engineer**: Implement object detection, semantic segmentation, and spatial reasoning.

#### Research & Specialized AI (4 Roles)
- **AI Researcher**: Formulate novel algorithmic hypotheses, publish research papers, and advance state of the art.
- **Applied AI Researcher**: Translate theoretical advancements into practical prototypes solving high-impact domain problems.
- **Robotics & AI Engineer**: Integrate perception, kinematics, control algorithms, and sensor fusion.
- **Reinforcement Learning Engineer**: Develop policy gradients, Q-learning agents, and simulation environments.

#### Data & Product (2 Roles)
- **Data Scientist (AI/ML)**: Extract statistical insights, build predictive models, run A/B experiments.
- **AI Product Builder / Founder**: Build, launch, and monetize user-facing AI applications.

#### Exploration (1 Role)
- **Still Exploring AI & ML**: Discover the landscape across engineering, research, and applications.

---

### 3. Database Persistence & Evidence Integrity

- **`userPreferences` Table**:
  - `primaryPriority`: Persisted directly.
  - `secondaryPriorities`: JSON array.
  - `metadata`: Contains `{ targetRole, targetRoleId, targetTimeline, customGoalText }`.
- **`goals` Table**:
  - `title`: `draft.goal` (e.g. *"Get an AI/ML internship"*).
  - `description`: `Target Role: [role] · Timeline: [timeline] · Note: [customNote]`.
  - `source`: `"custom"` or `"preset"`.
  - `status`: `"active"`.
- **`evidenceItems` Table**:
  - Self-reported immutable evidence records created for:
    - `Target Role: [role]` (`category: "goal"`, `source: "self_reported"`, `verificationStatus: "self_reported"`)
    - `First Goal: [goal]` (`category: "goal"`, `source: "self_reported"`, `verificationStatus: "self_reported"`)
    - `Target Timeline: [timeline]` (`category: "goal"`, `source: "self_reported"`, `verificationStatus: "self_reported"`)
- **Profile Headline**:
  - Automatically populated with e.g. `Aspiring Generative AI Engineer` in `personProfiles` table.

---

### 4. Dynamic AI/ML Roadmap & Personalization

- `lib/domain/roadmap.ts` upgraded to supply tailored learning, practice, build, verification, and interview stages for all 14 taxonomy roles.
- Dynamic prioritization rules:
  - If student is near graduation ($cycle \le currentYear + 1$) or targeting internships, `Interview` and `Verify` actions on MentorMaze and ERIS take highest priority.
  - If student is targeting project builds, `Build` and `Practice` actions take priority.
  - Missing evidence remains strictly `unknown` — **zero fabricated scores or unearned percentages**.

---

### 5. Quality Gates & Test Results

| Quality Gate | Command | Status | Result |
| :--- | :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` | ✅ **PASS** | 0 TypeScript errors |
| **Lint** | `npm run lint` | ✅ **PASS** | 0 ESLint errors, 0 warnings |
| **Full Test Suite** | `npm test` | ✅ **PASS** | **248 tests across 38 suites passed (0 failures)** |
| **Production Build** | `npm run build` | ✅ **PASS** | 63/63 Next.js routes compiled in 4.3s |

---

### 6. Summary of Changed / Added Files

1. `lib/domain/aiml-role-taxonomy.ts` *(NEW)*: Centralized, versioned 14-role taxonomy, 8 goal outcomes, timeline options, and validation.
2. `lib/onboarding-step-registry.ts` *(NEW)*: Centralized 10-step canonical step registry and helpers.
3. `components/exact-screens/Screen3bAiMlDirection.tsx` *(NEW)*: Pixel-perfect Step 2 screen with role cards, explore toggle, search, goal pills, timeline selector, and live direction summary.
4. `components/exact-screens/ExactScreensContainer.tsx`: Integrated Screen 3b at step 2, linked draft persistence and jump-to-step handlers.
5. `components/exact-screens/ScreenFooter.tsx`: Upgraded to 10 total steps with labels from the centralized registry.
6. `components/exact-screens/ScreenHeader.tsx` & all individual screens (`Screen3`, `Screen3a`, `Screen4`, `Screen5`, `Screen6`, `Screen8`, `Screen9`, `Screen10`, `Screen11`): Updated to uniform `Step X of 10` numbering.
7. `components/exact-screens/ScreenNavigator.tsx` & `ScreensGallery.tsx`: Added Screen 3b preview options.
8. `lib/onboarding-v2.ts` & `lib/services/onboarding-v2-service.ts`: Added `targetRole`, `targetRoleId`, `targetTimeline`, and `customGoalText` persistence and evidence recording.
9. `lib/domain/roadmap.ts`: Expanded goal curricula for all AI/ML target roles and dynamic priority sorting.
10. `lib/intelligence/engines/eora-explainer.ts`: Grounded EORA explanations in selected target role and goal.
11. `components/student/change-goal-modal.tsx`: Enabled post-onboarding direction updates in the student workspace while preserving historical evidence.
12. `tests/aiml-role-goal-selector.test.ts` *(NEW)*: 17 comprehensive unit & integration tests.
