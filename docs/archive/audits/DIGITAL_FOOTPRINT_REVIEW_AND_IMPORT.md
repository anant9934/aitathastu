# Digital footprint review and import audit

Date: 2026-10-11. Data path: `discoverDigitalFootprints` in deterministic CV extraction → `discoveredResumeProfiles` in person-scoped draft → Step 6 suggestion cards → Review Profile modal → explicit import request with `consent:true` → `/api/student/footprints/sync` → `DigitalSourceImportOrchestrator` → pending imported candidates → Step 8 student confirmation. A detected URL is never enough to prove account ownership.

| Source | Implemented path seen in code | Current verification |
|---|---|---|
| GitHub | Public profile/repository API and bounded metadata/manifest inspection; project/skill candidates | Contract inspected. `acquisitionMode` corrected to `OFFICIAL_PUBLIC_API` for this path. No live GitHub import executed here. Private access requires separate authorization. |
| Hugging Face, ORCID, DEV, Stack Overflow | Public provider interfaces in orchestrator | Code inspected; provider response and rate-limit behavior not exercised here. |
| Portfolio | Public static metadata with SSRF guard | Code inspected; no live URL fetched in this audit. |
| LinkedIn | URL reference or authorized user export; no direct profile scraping | Synthetic CV URL suggestion/browser review passed; export parsing not exercised. |
| LeetCode, HackerRank, CodeChef, HackerEarth, Kaggle, Google Scholar | Provider-specific public metadata, reference or manual path depending on connector | No live provider acceptance run; do not call a mere link an authenticated connection. |

The import response contract returns skill objects `{name, sourceReference, confidence}`, experience `title`, and education `school`; the former UI expected skill strings, `role`, and `institution`. `lib/onboarding-import-candidates.ts` now normalizes this boundary. The browser regression verified two synthetic CV links shown as `Found in CV`, zero linked profiles, and a review modal prefilled with the actual GitHub URL. Imported skills now enter persisted `techCandidates` and require Confirm/Remove in Step 8 before entering confirmed `skills`. Pending imported education, experience, projects and achievements remain candidates. Source statuses distinguish `Profile Linked` from `Public Data Imported` in the Step 6 UI.

Files modified: `Screen6DigitalFootprints.tsx`, `ExactScreensContainer.tsx`, `Screen8ProfileInsights.tsx`, `lib/onboarding-import-candidates.ts`, `lib/onboarding-v2.ts`, `lib/services/digital-source-import-orchestrator.ts`. Local tests: `scripts/verify-onboarding-boundaries.ts`, `scripts/verify-onboarding-browser-local.ts`, and `scripts/verify-onboarding-cv-ui-local.ts` passed. The CV browser path reached Step 6 with two unlinked suggestions; no import request was made. Limits: no real provider import, OAuth denial, rate-limit, export archive, duplicate sync or wrong-account ownership test was executed. Provider public-record import remains unverified in preview and production.
