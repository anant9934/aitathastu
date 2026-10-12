# P0.1 final acceptance matrix

Date: 2026-10-11. Base HEAD `05ce6a48f9811829b390e264cff9f8d1aebb5474`; the checkout and preview upload include uncommitted changes, so this SHA alone is not a reproducible release artifact. No production deployment or push was performed.

Last completed preview URL: **[historical Preview URL omitted]** (deployment `dpl_yih6jMB88SKYquJzkXbdr4kom92R`, target `preview`, state `READY`). It is bound to the isolated Neon branch via a per-deployment runtime override. The later confirmation-gate source fix is local only: the attempt to deploy that revision was rejected by automatic approval review because it would send an isolated database credential to Vercel through a CLI argument. The earlier preview remains available, but does not contain that final fix. Production release decision: **NOT READY**.

## Capability classification

| Capability | Classification | Evidence or reason |
|---|---|---|
| Ten-step manual student journey | LOCAL VERIFIED | Browser completion, redirect, Person 360 institution on isolated Neon |
| Fresh-user blank fields and no demo links | LOCAL VERIFIED | Browser fresh session and Linked Profiles (0) checks |
| Native PDF, image-only OCR, vector OCR, mixed-page OCR, two-column PDF, DOCX | LOCAL VERIFIED | Actual synthetic bytes; parser paths and OCR flags; four API uploads on Neon |
| Preview PDF OCR execution | BLOCKED | Preview resume POST returned `INGESTION_SECURITY_INCOMPLETE` before parser/worker |
| Traced OCR assets and build | LOCAL VERIFIED | Local route trace contains traineddata, WASM core, CMaps and fonts; local and Vercel builds passed |
| Broad real-world CV variability | IMPLEMENTED BUT UNVERIFIED | No consented independent holdout set; V5.0.3 private fixture absent |
| Independently specified multi-record synthetic CV | LOCAL VERIFIED | 2 schools, 2 jobs, 3 projects, 6 unknown-level skills, certification, award, publication, patent application, 2 links, 15 review candidates |
| CV-discovered GitHub/LinkedIn review | LOCAL VERIFIED | Browser found two unlinked suggestions and Review Profile action; selected claims only saved |
| Live GitHub public connector read | LOCAL VERIFIED | Authorized account the authorized public test account: real API profile and 21/21 public repository links; deep inspection bounded to three |
| Consented app GitHub import | BLOCKED | Isolated-Neon `/api/student/footprints/sync` hit exhausted unauthenticated quota and returned HTTP 500 |
| GitHub rate-limit truthfulness | LOCAL VERIFIED | Controlled 429 tests returned no invented profile or repos; wrong-account token endpoint fixed |
| GitHub candidate review before canonical persistence | IMPLEMENTED BUT UNVERIFIED | Source changed to snapshot and candidates only; successful live import not available |
| Other external providers' confirmation gate | IMPLEMENTED BUT UNVERIFIED | Premature evidence/project writes removed from all orchestrator branches; LinkedIn reference and five export candidates passed focused PGlite persistence test; full provider-by-provider Step 8 flow remains unverified and latest fix is not deployed |
| Portfolio SSRF controls | IMPLEMENTED BUT UNVERIFIED | URL boundary tests passed; live fetch, redirect and DNS rebinding not exercised |
| Neon schema initialization | LOCAL VERIFIED | Fresh isolated branch missing `public` was initialized; direct Neon V4.5 24/24 |
| Concurrent draft writes | LOCAL VERIFIED | 20 parallel rounds on isolated Neon and two distinct identities |
| Logout/re-login isolation | LOCAL VERIFIED | Original person/draft restored, second student remained separate |
| Full preview end-to-end onboarding | BLOCKED | Ingestion gate prevents CV upload; no preview browser chain |
| React #31 reproduction and repair | IMPLEMENTED BUT UNVERIFIED | Object-valued skill rendering regression passed locally, error boundary added; exact production stack not reproduced |
| Production behavior | IMPLEMENTED BUT UNVERIFIED | No production mutation or deployment; no production verification claim |

## Root causes and fixes in this phase

1. Concurrent stale whole-draft writes lost fields: atomic JSONB patch merge in `lib/services/onboarding-v2-service.ts`; sparse client PUTs in `components/exact-screens/ExactScreensContainer.tsx`.
2. Dashboard target role fell back to specialization without a priority selection: completion now persists direction metadata independently in `lib/services/onboarding-v2-service.ts`.
3. Multi-project CV blocks collapsed into one, Data Engineer was treated as company text, generic awards were labeled honors, and skill proficiency was invented as intermediate: corrected in `lib/services/deterministic-resume-extraction-engine.ts` with an independent fixture test.
4. A new isolated Neon branch lacked `public`: `lib/db/index.ts` creates the schema before existing migrations.
5. GitHub rate limits fabricated profile and repository records; authenticated public repo discovery targeted the token owner's account: corrected in `lib/connectors/github/client.ts`. All provider imports now save source snapshots and review candidates without premature canonical project/evidence writes in `lib/services/digital-source-import-orchestrator.ts`; the sync API and Step 6 UI count candidates separately from saved records.
6. Portfolio fetch followed unvalidated redirects and did not pin DNS: `lib/connectors/portfolio/client.ts` now validates HTTPS, public IPv4 resolution and each redirect, caps bytes, and pins the TLS connection address.
7. PDF.js CMaps and fonts were absent from the local route trace: `next.config.mjs` explicitly includes them. `app/error.tsx` adds user-facing render recovery without logging candidate content.

This phase's exact application source edits: `lib/services/onboarding-v2-service.ts`, `components/exact-screens/ExactScreensContainer.tsx`, `components/exact-screens/Screen6DigitalFootprints.tsx`, `app/api/student/footprints/sync/route.ts`, `lib/services/deterministic-resume-extraction-engine.ts`, `lib/db/index.ts`, `lib/connectors/github/client.ts`, `lib/connectors/portfolio/client.ts`, `lib/services/digital-source-import-orchestrator.ts`, `next.config.mjs`, and `app/error.tsx`. Test source added or expanded: `scripts/verify-onboarding-concurrency-local.ts`, `scripts/verify-p01-independent-extraction.ts`, `scripts/verify-p01-github-live.ts`, `scripts/verify-p01-provider-boundaries.ts`, `scripts/verify-p01-import-confirmation-gate.ts`, `scripts/verify-p01-neon-branch.ts`, `scripts/verify-p01-neon-relogin.ts`, `scripts/generate_synthetic_ocr_fixtures.py`, `scripts/verify-synthetic-ocr.ts`, and `scripts/verify-onboarding-browser-local.ts`. Other uncommitted API, UI, schema-adjacent, and audit files listed by `git status` were inherited from the previous onboarding audit and preserved.

## Test ledger

| Test | Actual result |
|---|---|
| TypeScript, ESLint, local production build | Passed |
| V5.0.3 parser suite | BLOCKED: expected private fixture absent; no synthetic substitution made |
| V5.0.4 extraction | 64/64 passed; its heuristic benchmark numbers are not independent accuracy |
| V5.0.5R integrity | 52/52 passed; HUMAN_GOLD = 0 |
| V4.5 core regression | 24/24 on in-memory PGlite and 24/24 on isolated Neon; synthetic scores only |
| Independent P0.1 synthetic CV | Passed all asserted records and no unsupported skill level |
| Local OCR matrix | Nine synthetic format/error cases passed; OCR executed where required |
| Neon browser/API | Four upload formats HTTP 200; ten-step, CV review, desktop/mobile screens, 20 concurrent rounds, two-user logout/re-login passed |
| Live GitHub | Direct client read succeeded for 21 public repos; later app API import blocked by exhausted quota |
| Import confirmation gate | LinkedIn URL and five synthetic export candidates saved no canonical evidence/projects in PGlite; source snapshots remained person-owned |
| Preview build/readiness | Vercel build passed, preview ready, schema connected |
| Preview OCR | HTTP 503 security gate before parsing; blocked |

Local parser stage timings in one run: native PDF 4 ms, image OCR 1198 ms, vector OCR 552 ms, mixed-page OCR 481 ms, table DOCX 151 ms. These are not preview latency measures. Final preview `/api/ready` reported 222 ms; no OCR stage latency exists for preview because the request stopped before parsing.

## Remaining release blockers

1. The user confirmed preview secrets have not been rotated and instructed us to keep the ingestion gate closed. Deployed OCR and function-log certification therefore remain blocked. Automatic approval review also rejected exporting preview secrets to a local file due sensitivity; that route was not retried.
2. Successful consented app GitHub import, repeat-import idempotence, pagination beyond one page, and Step 8 provenance checks after the public quota resets or an authorized token is configured.
3. Verify the newly corrected confirmation gate through Step 8 and onboarding completion for each supported provider. Empty-profile placeholder evidence was removed, but restricted-source fallback wording still needs browser review.
4. Broader privacy-safe and consented holdout resumes, including actual LaTeX, Canva, scan, encrypted and faulty-encoding cases; multi-page OCR limit needs a decision.
5. Preview browser E2E, processing-refresh cases, and reproduction or stack-level diagnosis of production React #31.

6. A refreshed preview with the final local import fix was blocked by automatic approval review because the CLI command would send the isolated Neon credential to Vercel. An ordinary attempt also failed DNS resolution. No indirect deployment workaround was attempted after rejection.

Until these pass, no capability in this report is classified PRODUCTION VERIFIED and the project is **not approved for production release**.
