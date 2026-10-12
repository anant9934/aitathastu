# V5.3 page-by-page UI/UX contract

Status: **IN PROGRESS** · 12 October 2026

Shared rules for every row: visible primary heading and support copy; keyboard focus and semantic controls; 320px single-column fallback; loading, empty, and error states that reflect real data; reduced-motion support; EORA outside the path of primary controls; no fabricated records. The data boundary is the existing route/API named below. A blank integration is marked unavailable rather than given a fake link. The accepted landing remains the reference for tokens, typography, and EORA shape.

| Page/group and target user | Information hierarchy and placement | Primary / secondary action | Real data boundary and state requirements |
|---|---|---|---|
| Landing, visitor | Cinematic hero → product explanation → ecosystem → FAQ | Sign up / explore anchors | Public illustrative content must be labeled; EORA public demo is illustrative |
| Sign in, existing user | Compact card with heading, email/password, Google option | Sign in / reset path if available | `/api/auth/sign-in`; inline validation, pending and server errors |
| Sign up, new user | Compact card with name, email/password, Google option | Create account / sign in | `/api/auth/sign-up`; explicit validation and duplicate-account error |
| EORA welcome, all newcomers | Warm greeting, name and next action | Enter name / skip where allowed | Onboarding draft; preserve partial progress |
| Role choice, all newcomers | Student/Faculty cards before planned roles | Select role / go back | Faculty selection is a request, not permission |
| Ranked purposes, both roles | Primary, secondary, tertiary with clear order | Save priorities / reorder | `/api/onboarding-v2`; valid role-specific IDs only |
| AI/ML direction, student | Goal choice and explanation | Choose direction / back | Onboarding draft and chosen target role |
| Academic details, student | Profile form, institution and study context | Save / back | Onboarding draft; field validation |
| CV upload, student | Consent and upload surface, processing state | Upload / skip | Resume APIs; no success claim until extraction and review |
| Digital footprints, student | GitHub and approved sources with provenance | Connect/import / skip | OAuth/import availability and explicit consent |
| Analysis, student | Processing steps and honest progress | Continue when ready / retry | Job status APIs; timeouts and errors visible |
| Profile review, student | Extracted candidates, corrections and provenance | Confirm / edit | Resume review and apply APIs |
| Skills map, student | Evidence relationships, selected node detail | Review skill / continue | `/api/student/skills`, person graph; keyboard selection |
| GitHub projects, student | Candidate projects and evidence | Confirm / skip | GitHub import and project candidate APIs |
| Completion, student | Summary and next destination | Open workspace / review | Completed onboarding state |
| Faculty setup, applicant | Institution, department, work email and pending status | Request workspace / back | Role request stored; capability remains pending |
| Student home, student | Primary purpose hero → secondary and tertiary cards → EORA | Contextual next action / customize | `/api/student/dashboard`, `/api/workspace/preferences`; no synthetic items |
| Journey, student | Next action and progress before history | Continue journey / inspect why | Student activity and handoff APIs |
| Roadmap, student | Goal, gaps and recommended steps | Continue a step / inspect skills | Roadmap API; unavailable recommendations explicit |
| Skills list/detail, student | Evidence map → skill record → source contribution | Inspect evidence / navigate graph | Skills/evidence/person graph APIs; selected-node keyboard state |
| Projects list/detail, student | Confirmed work and candidate state | Open or confirm project / add evidence | Project APIs and GitHub source provenance |
| Profile/Person 360, student | Identity → goals → evidence → connected sources | Edit profile / manage sources | Person 360 and profile APIs; account isolation |
| Connections, student | Actual sources and available people | Connect a source / return to workspace | Connections API; no fabricated mentors |
| Assessments, student | Actual assessment records and next step | Open assessment / return | Assessments API; empty state if no records |
| Interviews, student | Actual interviews and feedback | Open record / return | Interviews API; empty state if no records |
| Verification, eligible user | Request state and supporting evidence | Submit/resubmit / return | Verification APIs; permission boundary |
| Faculty home, pending or authorized faculty | Top purpose and institutional status before modules | Authorized queue or request status / customize | Workspace preferences and RBAC; pending state blocks student data |
| Faculty verification, authorized evaluator | Assigned queue and decision details | Review assigned request / return | Capability-backed verification APIs |

The 15 required design dimensions are handled by each row plus the shared rules above: target, heading/copy, hierarchy, layout, components, placement, visible data, two action levels, ecosystem entry, three states, mobile, motion, accessibility, and integration boundary. The table is a contract and current implementation map; it does **not** assert that every route has passed visual acceptance. Existing routes outside this list are only `/screens` gallery and `/dashboard` redirect, covered by the inventory.
