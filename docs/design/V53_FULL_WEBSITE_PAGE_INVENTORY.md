# V5.3 full website page inventory

Status: **IN PROGRESS** · 12 October 2026

This inventory is derived from every `app/**/page.tsx` route and the onboarding screen switch in `components/exact-screens/ExactScreensContainer.tsx`. The approved reference currently lives in `components/landing/reference-markup.ts` and `components/landing/ecosystem-landing.css`. The current landing implementation is the visual source of truth; file timestamps alone were not used to choose a canonical page.

| Route or screen | User and purpose | Current implementation | Canonical direction | Status |
|---|---|---|---|---|
| `/` | Public product discovery and signup | `EcosystemLanding`, reference markup | Keep the approved cinematic landing | VISUALLY VERIFIED at five widths; final production-build interaction sweep passed |
| `/sign-in` | Existing user login and Google entry | `app/sign-in/page.tsx` | Keep form logic; use shared auth styling | VISUALLY VERIFIED at five widths |
| `/sign-up` | New user signup and Google entry | `app/sign-up/page.tsx` | Keep form logic; use shared auth styling | VISUALLY VERIFIED at five widths after contrast fix at 390px; other after views pending |
| `/onboarding` | Student or Faculty setup | `ExactScreensContainer` | Keep state machine and selected visual screens | IN PROGRESS |
| `/screens` | Internal screen gallery | `ExactScreensContainer` in gallery mode | Preserve for design review, distinguish from production flow | NOT STARTED |
| `/dashboard` | Legacy entry | Redirect to `/student` | Keep redirect until role-aware destination is verified | VERIFIED LOCALLY as build route; role routing review pending |
| `/student` | Purpose-based student overview | `AdaptiveWorkspace` + student dashboard API | Keep adaptive workspace as canonical overview | IN PROGRESS |
| `/student/journey` | Progress and next actions | `StudentLayout` + journey view | Keep functioning journey components | IN PROGRESS |
| `/student/roadmap` | Career and learning direction | Standalone roadmap page | Bring into common shell after route check | IN PROGRESS |
| `/student/skills` | Skills and evidence map | Standalone skills page | Keep interactive skills graph and evidence model | IN PROGRESS |
| `/student/skills/[skill]` | Skill detail and provenance | Standalone detail page | Keep evidence and contribution logic | IN PROGRESS |
| `/student/projects` | Project ledger | `StudentLayout` + project list | Keep confirmed project flows | IN PROGRESS |
| `/student/projects/[id]` | Project detail | `StudentLayout` + detail view | Keep real project data and provenance | IN PROGRESS |
| `/student/profile` | Person 360 and account profile | `StudentLayout` + profile view | Keep editable account data | IN PROGRESS |
| `/student/connections` | Connections and footprint sources | Standalone connections page | Keep real availability and account links | IN PROGRESS |
| `/student/assessments` | Student assessment results | `StudentLayout` + assessment view | Keep actual results and honest empty state | IN PROGRESS |
| `/student/interviews` | Interview history | `StudentLayout` + interview view | Keep actual records and honest empty state | IN PROGRESS |
| `/verification` | Verification request status | Standalone protected workflow | Keep permission checks and real requests | IN PROGRESS |
| `/faculty` | Faculty priorities and pending approval | `AdaptiveWorkspace` | Keep pending/authorized separation | IN PROGRESS |
| `/faculty/verification` | Authorized evaluator queue | Existing verification page | Keep capability checks; never grant through role choice | IN PROGRESS |

## Onboarding screen inventory

| Screen | Purpose | Implementation | Status |
|---|---|---|---|
| 1 landing preview | Gallery only | `Screen1Landing` | UNKNOWN — PRESERVE |
| 2 EORA welcome and name | Student/Faculty entry | `Screen2EoraIntro` | IN PROGRESS |
| 3 role choice | Student/Faculty public choice; others planned | `Screen3ChooseRole` | IN PROGRESS |
| 3a ranked purposes | Primary, optional secondary and tertiary | `Screen3aPriorities` | VERIFIED LOCALLY at domain/API boundary; visual review pending |
| 3b AI/ML direction | Student goal direction | `Screen3bAiMlDirection` | IN PROGRESS |
| 4 academic details | Institution and course details | `Screen4AcademicDetails` | IN PROGRESS |
| 5 CV upload | Explicit document intake | `Screen5ResumeUpload` | IN PROGRESS |
| 6 digital footprints | User-controlled connected sources | `Screen6DigitalFootprints` | IN PROGRESS |
| 7 analysis | Processing status | `Screen7AiAnalysis` | IN PROGRESS |
| 8 profile review | Candidate correction and confirmation | `Screen8ProfileInsights` | IN PROGRESS |
| 9 skills map | Skills and evidence relationships | `Screen9SkillsMap` | IN PROGRESS |
| 10 GitHub projects | Project candidate review | `Screen10GitHubProjects` | IN PROGRESS |
| 11 completion | Dashboard handoff | `Screen11OnboardingComplete` | IN PROGRESS |
| 12 gallery dashboard | Preview/legacy screen | `Screen12StudentDashboard` | UNKNOWN — PRESERVE |
| Faculty setup | Institution request, no privileged grant | `FacultySetup` | VERIFIED LOCALLY for pending state; visual review pending |

## Product and integration entry points

Learn, Collaborate, Meet, and ERIS are promoted from the public landing and contextual workspace. Their independent product destinations are not represented by application pages in this repository. The interface must describe availability honestly and use only verified URLs. GitHub OAuth, Google OAuth, CV extraction, LinkedIn data handling, and verification are implemented as API routes and user flows, not standalone pages. There is no separate Student Settings, Research, Career, Opportunity, or Faculty Teaching route in this tree. The relevant sections are currently embedded in the routes above or remain planned; a clickable page must not be invented for them.

## Baseline

The non-destructive baseline ran `npm run typecheck`, `npm run build`, and a public browser sweep before authenticated account creation. Signup and sign-in invalid-payload validation each returned 400; unauthenticated session lookup returned 200 with a guest state. Public routes returned 200 and had no horizontal overflow at 320, 390, 768, 1024, and 1440 pixels. Evidence: `docs/screenshots/v53/public-baseline/results.json` and the neighboring PNGs. These checks do not prove successful login or data persistence.
