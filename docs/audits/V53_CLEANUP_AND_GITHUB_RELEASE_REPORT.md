# V5.3 cleanup and GitHub release report

Status: **IN PROGRESS** for local source delivery; production deployment is **NOT STARTED**. 12 October 2026.

## Safe cleanup classification

| Candidate | Classification | Reason |
|---|---|---|
| `components/landing` and approved reference CSS | KEEP | Current approved visual source |
| `components/workspace/AdaptiveWorkspace.tsx` and role registry | KEEP | Current purpose dashboard and saved layout |
| `app/student/page.tsx` and `app/faculty/page.tsx` | KEEP | Current role workspaces |
| `components/exact-screens/Screen12StudentDashboard.tsx` | UNKNOWN — PRESERVE | Gallery preview may contain behavior or design evidence not yet migrated |
| Legacy `app/dashboard` redirect | UNKNOWN — PRESERVE | Existing deep links may rely on it |
| Older EORA asset registry and portrait components | UNKNOWN — PRESERVE | Other screens still reference these assets; floating guide now uses amber sphere |
| Standalone student skills/roadmap/connections pages | MERGE VISUAL SYSTEM, KEEP FUNCTIONAL LOGIC | They have distinct data flows and cannot be deleted because of shell duplication |
| Duplicate style rules in `globals.css`, `reference-refresh.css`, `landing-theme.css` | MERGE AFTER TESTING | Specificity and route behavior need screenshot comparisons first |
| Resume extractor, migrations, security, integration fallbacks | UNKNOWN — PRESERVE | No dependency or pipeline audit is complete |

No mass deletion was run. Branch at audit start was `main`, with extensive pre-existing uncommitted landing, onboarding, EORA, workspace, and documentation changes. A local `codex/v53-premium-experience` branch was created without discarding those changes. Remote `origin` points to `anant9934/aitathastu`. `.gitignore` excludes local environment files, `.next`, PGlite data, resumes and benchmark/private datasets. Final local `npm run build`, `npm run typecheck`, and `npm run lint` passed (lint has 235 warnings). `render.yaml` contains `autoDeploy: true` for its configured service; the actual Render branch-to-production setting has not been verified. The connected Vercel account lists `connect` and `aistudyassisant`, neither named for this repository, so it does not establish the deployment branch for this source. The GitHub workflow runs on `main` pushes and PRs to `main`.

Release gate before push: finish visual and functional acceptance, review each changed file and deletion, scan candidate staged files for secrets/private CVs, confirm feature-branch push cannot trigger production deployment, then push without force. The live GitHub public import is currently blocked by its API rate limit, and Google OAuth, historical extractor failures, full ten-step visual review, and preview verification remain open. The local work must not be labeled production ready. No production resource changes are authorized by this report.
