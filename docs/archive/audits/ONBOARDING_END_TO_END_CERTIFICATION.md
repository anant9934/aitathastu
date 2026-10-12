# End-to-end certification status

Date: 2026-10-11. Status: **not certified for preview or production**. Local tests used `DATABASE_MODE=pglite PGLITE_IN_MEMORY=true` on a loopback Next.js server, and fictional fixtures in `/private/tmp/aitathastu-audit-fixtures`. The live `/onboarding` initial page was opened read-only in the in-app browser: its name field was blank and no browser console errors appeared. No live form was submitted. No Neon migration, direct production database query, push or deployment occurred.

## Gate results

| Gate | Evidence | Result |
|---|---|---|
| A full audit | Ten-step map and JSON matrix; route, state, service and repository trace | Source audit complete; step registry corrected and mapping asserted locally. |
| B page reliability/state | Fresh Chrome guest blanks; render of all onboarding screens; object-skill SSR regression; imported-skill Confirm persisted; sequential manual browser path through launch; guest upgrade and 409 collision; read-only job poll did not mint a guest; read-only live initial page | Focused local pass. An intermittent local 409 on fast completion led to serialized draft writes and side-effect-free polling; two subsequent manual journeys passed. Original minified production stack not reproduced; mobile browser flow incomplete. |
| C document reliability | Native PDF, image-only PDF, vector-path PDF and table DOCX through parser and HTTP route | Focused local pass. Legacy DOC unsupported; real-world/preview compatibility pending. |
| D structured extraction | Synthetic name, school, skill and profile URLs asserted | Partial. No broad independent record-level accuracy for experience/projects/awards/patents. |
| E footprint import | Two CV links suggested in a real upload browser path, modal review, zero automatic links; import adapter contract test | Partial. No live provider import, export or OAuth test. |
| F downstream | Manual browser path completed and reached `/student`; Person 360 contained the entered institution. Guest retained person ID; reviewed claim saved; pending education/experience/award absent from Person 360 | Focused local pass. Full CV→consented provider import→Neon→dashboard path pending. |
| G preview | No deployment or preview test | Not run. |

## Commands and observed results

| Command | Outcome |
|---|---|
| `npm run typecheck` | Passed. |
| `npm run lint -- --quiet` | Passed. |
| `node --import tsx scripts/verify-onboarding-boundaries.ts` | Passed blank draft, import mapping, pending roundtrip, legacy React object rendering. |
| `python3 scripts/generate_synthetic_ocr_fixtures.py /private/tmp/aitathastu-audit-fixtures` using bundled Python | Generated fictional native, raster, vector-path PDF and table DOCX fixtures. |
| `node --import tsx scripts/verify-synthetic-ocr.ts /private/tmp/aitathastu-audit-fixtures` | Passed native/OCR/DOCX checks; both OCR PDFs recovered name, school and skill. |
| Local `next dev` on port 3101 with in-memory PGlite, then `node --import tsx scripts/verify-onboarding-browser-local.ts` | Passed fresh blank fields, screen rendering, no uncaught errors, two CV link suggestions without auto-import, and imported-skill confirmation persisted. |
| `node --import tsx scripts/verify-onboarding-sequential-local.ts` | Passed manual sequential path through the ten numbered steps, completion redirect and Person 360 institution. |
| `node --import tsx scripts/verify-onboarding-cv-ui-local.ts` | Passed CV consent, initially unchecked claims, selected claim save, exclusion of unselected academic fields, and two unlinked CV profile suggestions. |
| `node --import tsx scripts/verify-onboarding-api-local.ts` | Four uploads HTTP 200; OCR flags correct; guest isolation, in-place upgrade, collision rejection and pending-record exclusion passed. |

Files modified for these gates: `app/api/onboarding-v2/route.ts`, `app/api/resume/extract/route.ts`, `app/api/student/processing-jobs/route.ts`, `components/exact-screens/ExactScreensContainer.tsx`, `Screen4AcademicDetails.tsx`, `Screen5ResumeUpload.tsx`, `Screen6DigitalFootprints.tsx`, `Screen8ProfileInsights.tsx`, `Screen9SkillsMap.tsx`, `Screen10GitHubProjects.tsx`, `lib/onboarding-v2.ts`, `lib/onboarding-step-registry.ts`, `lib/onboarding-import-candidates.ts`, `lib/services/onboarding-v2-service.ts`, and `lib/services/digital-source-import-orchestrator.ts`. Focused test scripts and fictional fixture generator were added under `scripts/`.

## Open P0/P1 work

1. Complete the remaining CV→consented provider import→Step 8/9 contribution→completion browser journey on desktop and mobile, then verify refresh and re-login. The manual full journey and CV-to-digital journey pass locally.
2. Run OCR-requiring fixtures through an actual Vercel preview and inspect runtime worker/assets, latency and memory. Local OCR does not prove deployment compatibility.
3. Build independent labeled fixtures for two education records, two experiences, three projects, six skills, an award and patent application; assert exact candidate categories and zero inventions.
4. Exercise supported live provider imports with authorized test accounts, pagination/rate limits, partial failures and wrong-account review.
5. Verify Neon ownership, Person 360/dashboard counts, idempotent completion and returning-user preservation in an isolated preview database.

Decision: **BLOCKED — CRITICAL DEFECTS REMAIN**. The local repairs are reviewable and tested, but the required preview, live import, broad extraction accuracy and full persistence gates remain open.
