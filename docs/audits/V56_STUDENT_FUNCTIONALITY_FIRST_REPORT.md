# V5.6 Student functionality first — verification report

Date: 2026-10-12. Branch: `codex/v53-premium-experience`.

## Result

**PARTIAL at the pre-release assessment.** Local API paths for account creation, draft restoration, completion, dashboard preference, Person 360 ownership, and document extraction pass. The full desktop browser journey was interrupted by automatic browser approval review returning 429. The earlier production extraction check remains **FAILED** until a new production deployment is verified. Release commit and deployment results must be recorded separately after the main-branch push.

## Changed in this pass

- New accounts enter `/onboarding`; returning accounts pass through `/start`, which sends incomplete drafts back to onboarding and completed students to `/student` or a valid requested student page. Direct `/student` access now enforces the same incomplete-onboarding gate.
- Google sign-in uses the same entry routing. A missing Google email now returns an authentication error instead of dereferencing a null value.
- Onboarding stores and restores the visible step in the durable draft, surfaces draft save errors, and pre-fills the signed-up name without replacing text a student has already typed.
- Public role selection labels Faculty and the other unfinished roles Coming Soon. Existing protected Faculty routes and authorization were left intact.
- The extraction regression command accepts configurable native, vector, and additional PDF paths; checks OCR flags, review candidates, structured categories, and reports a pass/fail count without printing resume contents. It permits valid single-letter programming languages C and R.
- The existing local document integration script now sends the required canonical priority during completion.

## Routes and journeys

| Area | Status | Evidence and limit |
| --- | --- | --- |
| `/sign-up` → `/onboarding` | VERIFIED LOCALLY | Fresh synthetic account created in the browser and reached onboarding. Name prefill was observed after asynchronous session load. |
| Direct `/student` access | VERIFIED LOCALLY | An incomplete student received a 307 redirect to `/onboarding`; a completed student received HTTP 200 after re-login. |
| Onboarding role → direction → priorities → resume step | VERIFIED LOCALLY | Browser reached the resume step with Student selected and two ranked priorities. Other public role buttons were disabled. |
| Browser refresh, resume step, complete launch | BLOCKED | Approval review returned 429 on a later browser navigation/click. It was a review service limit, not a safety rejection. The exact browser restoration and launch path remain unverified. |
| Partial draft and returning login | VERIFIED LOCALLY | Isolated API test saved `currentScreen=5` and ordered priorities, read them back, signed out, signed in, and retrieved the completed draft. Pure routing assertions cover partial and completed entry paths. A fresh browser session remains unverified. |
| Duplicate account and account isolation | VERIFIED LOCALLY | Duplicate signup returned 409; a second account could not read the first account's draft. |
| `/api/student/dashboard` | VERIFIED LOCALLY | After re-login, dashboard composition used saved primary purpose `projects`. The UI and all six purpose modes were not browser checked. |
| `/api/student/person-360` | VERIFIED LOCALLY | After re-login, Person 360 retained the correct person ID. A reviewed resume claim persisted in the separate document integration check; unconfirmed education, experience, and achievements stayed out of Person 360. |
| `/api/resume/extract` | VERIFIED LOCALLY | 14/14 PDF cases passed on the isolated local server. Synthetic native, image, vector and table DOCX integration cases also passed. |
| GitHub import | PARTIAL | Routes and source handling exist, but a controlled account import, review, and re-login check were not executed. |
| LinkedIn | PARTIAL | URL and user-provided information paths exist; approved provider history import was not verified and must not be assumed. |
| Projects, Skills, Evidence, EORA, settings, widget customization | PARTIAL | Existing screens/APIs remain; full browser actions, persistence, and desktop usability were not completed in this pass. |
| Google OAuth | BLOCKED | Callback routing was repaired in code; no controlled Google account callback was run. |
| Production OCR | FAILED | Earlier authorized live batch returned 1/14 passing, 12 `OCR_SERVICE_UNAVAILABLE`, and 1 `PERSIST_FAILED`. The corrected local build has not been deployed. |

## CV/OCR matrix

All local API checks used an in-memory PGlite server with `DATABASE_URL=''`, so no production Neon records were changed.

| Document | Local result | OCR | Review claims |
| --- | --- | --- | ---: |
| `test_student_cv.pdf` (native) | VERIFIED LOCALLY | off | 10 |
| `myresume.pdf` (vector outline) | VERIFIED LOCALLY | on | 25 |
| `Image_1.pdf`, `Image_2.pdf`, `Image_4.pdf`, `Image_5.pdf` | VERIFIED LOCALLY | on | 1, 2, 5, 9 |
| `Image_7.pdf`, `Image_9.pdf`, `Image_10.pdf`, `Image_11.pdf` | VERIFIED LOCALLY | on | 6, 15, 3, 3 |
| `Image_12.pdf`, `Image_13.pdf`, `Image_14.pdf`, `Image_15.pdf` | VERIFIED LOCALLY | on | 3, 7, 2, 1 |
| Synthetic native, image, vector PDF and table DOCX | VERIFIED LOCALLY | off, on, on, off | 6, 6, 6, 5 |

The one-claim image results prove the local OCR path returned reviewable output; they do not prove complete field recall for those resumes. Native extraction produced education and skills. Vector extraction produced a project and skills. The API integration suite also checked education and source links for the synthetic fixtures.

## Engineering checks

- `node --import tsx scripts/verify-v56-student-entry.ts` — 10/10 assertions passed.
- `node --import tsx scripts/verify-v56-onboarding-api.ts` against isolated local server — passed signup, direct route guard, duplicate rejection, draft restore, purpose ranking, account isolation, completion, logout, re-login, dashboard, and Person 360.
- `node --import tsx scripts/test-live-production-extract.ts --base-url http://localhost:3101` with 12 additional user PDF paths — 14/14 passed.
- `node --import tsx scripts/verify-onboarding-api-local.ts` — passed native/image/vector/DOCX extraction, guest ownership, reviewed claim save, and Person 360 exclusion of pending data.
- `npm run typecheck` — passed.
- `npm test` — 14/14 core checks passed.
- `npm run lint` — exit 0, 235 warnings, 0 errors across the repository.
- `DATABASE_URL='' DATABASE_MODE=pglite PGLITE_IN_MEMORY=true NEXT_TELEMETRY_DISABLED=1 npm run build` — passed. The dev server was restarted afterward because the build altered its `.next` artifacts.

## Remaining release work

Finish the blocked browser journey and desktop viewport checks at 1280×800, 1440×900 and 1920×1080; verify completed onboarding, returning login, CV review/save, GitHub import, dashboard customization, Projects, Skills/Evidence, EORA, settings and connected products. Re-run the authorized production PDF matrix only after an approved deployment of the OCR change. Verify any relevant external service contract and production persistence separately. No duplicate-code cleanup was performed because the full canonical Student flow is not yet verified. Faculty implementation and mobile redesign remain deferred.

**GitHub delivery at this assessment:** pending. The checkout also contains unrelated preexisting screenshot edits; these were preserved outside the release commit.
