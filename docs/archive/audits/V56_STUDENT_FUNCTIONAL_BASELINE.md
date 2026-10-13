# V5.6 Student functional baseline

Date: 2026-10-12. Branch: `codex/v53-premium-experience`.

## Scope and existing work

The repository already has uncommitted onboarding/EORA styling and component edits plus screenshot changes. The prior OCR repair is staged in the same checkout. This audit preserves those changes. The active student pages are under `app/student/`; onboarding is `app/onboarding` using `ExactScreensContainer`. APIs are under `app/api/auth`, `app/api/onboarding-v2`, `app/api/resume`, `app/api/student`, `app/api/workspace`, and `app/api/eora`. Persistence is in `lib/db/schema.ts` through repositories and services. The standalone OCR service is under `services/resume-extractor`.

## First local checks

- `npm run typecheck`: passed.
- Next.js dev server: started at `http://localhost:3101`; landing and sign-up rendered in a browser.
- Subsequent student tests use `DATABASE_MODE=pglite`, `PGLITE_IN_MEMORY=true`, and an empty `DATABASE_URL` to avoid writing to configured Neon data.

## Findings before V5.6 edits

| Area | Status | Evidence |
| --- | --- | --- |
| Sign-up API/session | PARTIAL | Creates a real user and session, but the sign-up page sends a new account directly to `/student`, skipping onboarding. |
| Returning/partial sign-in | PARTIAL | Sign-in sends everyone to `/student` by default; it does not inspect an unfinished onboarding draft. |
| Onboarding persistence | PARTIAL | `onboarding_drafts` stores profile fields and priorities, but the visible screen is not stored/restored; `/onboarding` starts at screen 2. |
| Public role gate | PARTIAL | Faculty can currently be selected during public onboarding, contrary to the student-only release scope. Protected Faculty authorization remains separate. |
| Native CV extraction | VERIFIED LOCALLY | Prior live production check returned 10 claims with OCR off for the text-native fixture. |
| OCR production | FAILED | Prior live batch: 12 OCR PDFs returned `OCR_SERVICE_UNAVAILABLE`; one image PDF returned `PERSIST_FAILED`. Local parser read all 13 OCR PDFs. Code/model packaging fix is staged but not deployed. |
| GitHub/LinkedIn | PARTIAL | Source discovery and GitHub routes exist; authorized live import and persistence have not yet been verified in this audit. |
| Student dashboard, projects, Person 360, EORA | PARTIAL | Pages and APIs exist; complete browser and persistence journeys are pending. |
| Google OAuth | BLOCKED | Provider credentials are configured locally, but a controlled provider account and callback journey have not been exercised. |

No release claim follows from this baseline. The first implementation gate is authentication routing and durable onboarding recovery.
