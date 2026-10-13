# P0.1 Neon end-to-end verification

Date: 2026-10-11. All database writes in this phase targeted the user-supplied isolated Neon endpoint `[isolated-preview branch host omitted]`. The user separately identified the app's real database endpoint; it was not used for these test writes. No credentials are recorded here.

## Branch identity and initialization

A read-only fingerprint query established database `neondb`, role `neondb_owner`, no onboarding tables, and initially no `public` schema. The first direct Neon V4.5 run stopped at migration with PostgreSQL `3F000: no schema has been selected to create in`. `lib/db/index.ts` now creates `public` if missing before the existing Drizzle migration statements in both Neon HTTP and TCP modes. The subsequent direct Neon run passed 24/24 checks. Its printed 100% synthetic subset score is not a human holdout accuracy result.

The final preview was deployed with a per-deployment runtime `DATABASE_URL` override for this isolated branch. Its readiness endpoint reported connected database and verified schema. A deployed resume upload stopped at `INGESTION_SECURITY_INCOMPLETE` before parsing; preview OCR and full preview onboarding therefore remain blocked.

## Actual Neon read/write evidence

| Boundary | Result |
|---|---|
| Direct service persistence | V4.5 24/24 on Neon, including 11 evidence items, reviewed education/experience/projects/achievements, Person 360 school and project, dashboard target role, and draft reread |
| Concurrent drafts | 20 rounds of simultaneous sparse name/goal PUTs to two independent browser API contexts; both fields retained and person IDs stable |
| Two-user ownership | Independent sessions stayed distinct; second draft did not receive the first student's goal or discovered GitHub URL |
| Logout/re-login | Sign-out invalidated session; sign-in restored original person ID, goal, and discovered link; second student retained own goal |
| CV upload API | Native, image-only, vector-outline PDF and table DOCX all HTTP 200 on loopback server backed by Neon; image/vector responses reported `ocrUsed=true` |
| CV browser review | Consent, unchecked suggestions, selected-claim save, unselected school exclusion, and two unlinked digital suggestions passed against Neon |
| Ten-step browser path | Manual path completed and redirected to `/student`; Person 360 returned the chosen institution |
| React/browser regression | Fresh fields blank; old object-valued skill candidate and Step 8 confirmation passed; 390 px screens 5, 6, 8, 9, 10 and desktop screens rendered without uncaught browser exceptions |

The concurrency test originally failed in round zero because a whole stale draft overwrote a concurrent update. `writeOnboardingDraft` now merges only sanitized keys atomically in PostgreSQL JSONB; the client sends only changed fields. The initial direct V4.5 test also exposed a dashboard target role fallback to specialization when no priority was selected; completion now persists direction metadata independently. Both regressions passed after repair.

## Limits

- The tested browser server was loopback Next.js in development mode backed by real Neon, not Vercel's preview function runtime.
- Refresh after CV upload, during processing, after a successful external import, and rejection-state persistence were not all exercised. Repeat-upload idempotence and guest-to-signed-in processing-job ownership need additional cases.
- The direct GitHub client successfully read 21 public repositories from the authorized test account. The consented app import then hit an exhausted unauthenticated GitHub quota and returned HTTP 500. Therefore the complete CV → GitHub import → Step 8 → dashboard chain is not certified.
- The V4.5 test's printed labels call its synthetic checks “Neon” even when run in PGlite. This report's 24/24 Neon claim refers specifically to the run with `DATABASE_MODE=postgres` and the isolated branch URL. No independent human accuracy score is claimed.
- Median and tail API latency were not measured. In this branch's local server logs, individual draft requests commonly took roughly 0.6–1.1 seconds after warmup; this is an observation, not a performance guarantee.

The isolated branch now contains synthetic test rows. The user confirmed a separate real database endpoint. No destructive migration, production record deletion, or production write was performed.
