# Prefill and state provenance audit

Date: 2026-10-11. Evidence is from this checkout and a local in-memory PGlite run. No production account records were inspected.

| Field/data | Legitimate source | Fresh state | Finding and action |
|---|---|---|---|
| Name, email | User entry, real authenticated session, same-person draft, reviewed CV | Empty | `getOrCreateOnboardingAuthContext` creates a guest person named `Student`; the container previously copied that placeholder into real form state. Guest detection now excludes it. |
| Role | Product route selection | `student` | Student is the only available platform journey. This is a UI route default, not an accomplishment or personal claim. |
| Degree, university, department, year | User entry, selected CV education claim, same-person draft | Empty | Gallery sample university/degree are guarded by `isGalleryMode`. CV academic fields now fill only when the student selects an education claim; unselected education remains a draft candidate. |
| Goals/priorities | User selection, same-person draft | Empty | Completion previously wrote `learning` with `preferenceSource: user_selected` when none was chosen; now skips that write. |
| Skills | Accepted resume claim or explicit student confirmation | Empty | Import objects now stay as technology candidates; Confirm/Remove controls promote or reject them. Legacy object arrays are normalized at the UI boundary without `String(object)`. |
| Education, experience, achievements, projects | CV or import suggestions followed by student confirmation | Empty | Pending entries remain draft candidates. Final save now writes only `status: confirmed`; the local Person 360 test found no synthetic pending entries. |
| Digital URLs | CV-discovered suggestion, user entry, saved own link | Empty | Two synthetic CV URLs appeared as suggestions while linked count stayed zero. Remaining provider fields stayed blank. |
| Gallery examples | Demo-only | Excluded from `/onboarding` | `Rahul Sharma`, LPU, sample projects and demo metrics live in gallery branches or `Screen12StudentDashboard` demo mode. They are not used as live initial state. |

State ownership: drafts and resume snapshots are keyed by `personId`; guest auth uses a cookie-backed unique account. Academic save now upgrades that guest account in place. A local test showed the person ID was unchanged and an existing-email collision returned 409 without moving another guest to that account. An intermittent 409 during a fast manual journey exposed competing guest cookie creation; draft writes are now serialized and read-only processing-job polls no longer mint sessions. Sign-out invalidates the session cookie. Local browser checks observed blank name/academic fields and zero linked profiles for a fresh guest.

Files modified: `ExactScreensContainer.tsx`, `Screen4AcademicDetails.tsx`, `Screen8ProfileInsights.tsx`, `Screen9SkillsMap.tsx`, `lib/onboarding-v2.ts`, `lib/onboarding-import-candidates.ts`, `app/api/onboarding-v2/route.ts`, `app/api/student/processing-jobs/route.ts`, `lib/services/onboarding-v2-service.ts`.

Tests: `scripts/verify-onboarding-boundaries.ts`, `scripts/verify-onboarding-browser-local.ts`, `scripts/verify-onboarding-sequential-local.ts`, `scripts/verify-onboarding-cv-ui-local.ts`, and `scripts/verify-onboarding-api-local.ts` passed locally. Browser checks confirmed an imported skill persisted only after clicking Confirm, a manual path reached Person 360, and an unselected CV education claim did not fill degree or institution. A read-only visit to the live initial onboarding page showed a blank name field and no browser console errors. Limits: a full returning-user browser replay, concurrent tabs, sign-out/cache switching, and Neon production ownership checks remain unverified. Existing genuine confirmed records were not reset in this audit.
