# V5.3 functional and integration report

Status: **IN PROGRESS** · 12 October 2026. The local build is healthy, but the full V5.3 acceptance gate is not complete.

## Baseline and current evidence

| Journey or pipeline | Status | Evidence / remaining work |
|---|---|---|
| Production build | VERIFIED LOCALLY | Final `npm run build` completed after parser, UI, and test edits; 78 static pages generated |
| Typecheck | VERIFIED LOCALLY | Final `npm run typecheck` exited 0 after build |
| Lint | VERIFIED LOCALLY with warnings | Exit 0, 235 existing warnings across repository and Python virtual environment files |
| Public route navigation | VISUALLY VERIFIED | Five widths, 30 screenshots, 200 HTTP responses, zero horizontal overflow, no page errors in `docs/screenshots/v53/public-baseline/results.json` |
| Signup/login validation | VERIFIED LOCALLY | Invalid payloads returned 400; no external database write |
| New account signup and Student/Faculty onboarding | VERIFIED LOCALLY | In-memory API tests; Faculty click-through browser test |
| Student ranking and saved widget layout | VERIFIED LOCALLY | Isolated API round trip and role-composition test |
| Faculty authorization boundary | VERIFIED LOCALLY | Pending state and 403 on protected queue |
| Google auth | NOT STARTED | Needs configured isolated OAuth environment |
| Session restoration and browser re-login | VERIFIED LOCALLY | `scripts/verify-v53-user-journey.ts` signed out, signed in again, and read saved ranked preferences; browser route was loaded |
| Person 360, projects, evidence, assessments, interviews | IN PROGRESS | Authenticated route render sweep underway; workflow mutations pending |
| EORA tutoring and context | IN PROGRESS | Context role/purpose API passed; full tutoring browser behavior pending |
| Two-user data isolation | VERIFIED LOCALLY | `scripts/verify-v53-user-journey.ts` used two synthetic accounts in in-memory PGlite and checked separate preferences and Person 360 responses |
| CV native PDF, image OCR, vector PDF, mixed PDF, DOCX | VERIFIED LOCALLY for synthetic fixtures | V5.0.4 deterministic extraction 64/64; Python extractor 34 tests; image, vector-outline, mixed, and DOCX fixture scripts passed with OCR flags and document-type checks |
| GitHub API import and LinkedIn approved data | BLOCKED / PARTIALLY VERIFIED LOCALLY | V4.3 intelligence suite 50/50 and V4.6 consent/URL/SSRF checks 8/8; live public GitHub import stopped by GitHub API 403 rate limit (remaining 0). LinkedIn user-provided export handling was not run end to end |
| Historical HTTP 422, 504, and 45-second timeout | NOT STARTED | Reproduce each independently against an authorized isolated extractor |
| Preview deployment | NOT STARTED | No preview created |

`npm test` passed 14 core tests. The annotated 50-document extraction benchmark reported precision 93.0%, recall 78.5%, F1 85.1%; those scores do not establish accuracy on every real CV. The parser now detects compressed vector outlines through PDF.js operator lists, and the deterministic extractor rejects `RN STAFF NURSE` as a person name. The synthetic Type B image, Type C vector-outline, Type D mixed PDF, and DOCX scripts all passed. Candidate-review UI mutation, downstream Skills Intelligence and Person 360 integration, and a real authorized resume/extractor run remain **IN PROGRESS**.

The running preview used `DATABASE_MODE=pglite PGLITE_IN_MEMORY=true DATABASE_URL=`. The ordinary local `.env`/`.env.local` contain a configured `DATABASE_URL`, so account-writing checks were intentionally kept on the isolated process. Google OAuth needs isolated credentials and callback configuration. The historical 422, 504, and 45-second timeout paths still need separate authorized reproductions. No live CV or personal dataset was added to Git.
