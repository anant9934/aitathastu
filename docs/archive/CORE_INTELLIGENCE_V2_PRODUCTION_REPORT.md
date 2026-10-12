# Core Intelligence V2 production report

Date: 2026-10-09. Scope: AI Tathastu Core. This is a code and local-build assessment, not a production certification.

## Status legend

`LIVE VERIFIED` means exercised on the deployed services. `LOCAL VERIFIED` means exercised in this checkout. `PARTIALLY FUNCTIONAL` means a working subset exists. `BLOCKED` means a prerequisite is missing. `DISABLED` means intentionally unavailable. No Core V2 integration in this report is claimed `LIVE VERIFIED`.

## 1–5. Source acquisition and interpretation

| Source | Acquisition method | Current status | Limit |
| --- | --- | --- | --- |
| Resume PDF/DOCX | Authenticated upload, deterministic text parse, optional approved-model interpretation after explicit choice, owner-bound candidate snapshot | PARTIALLY FUNCTIONAL | Uploaded file is not stored in durable private object storage. No malware scanner or process-restart recovery. |
| GitHub public profile | User-entered username and public GitHub API | PARTIALLY FUNCTIONAL | A profile link is `reference_only`; public discovery is not OAuth connection. |
| GitHub OAuth | Existing OAuth callback with no requested OAuth scope for public profile/repository metadata; encrypted token at rest; public-only metadata/README interpretation endpoint and onboarding review action | PARTIALLY FUNCTIONAL | Private repositories are filtered before candidate mapping and their README/languages are not fetched. Private ingestion requires a separate fine-grained authorization flow. OAuth callback, provider revocation and repository access need live verification. The onboarding screen requires explicit AI-processing choice and contribution text before confirmation. |
| LinkedIn | User-supplied profile URL | PARTIALLY FUNCTIONAL | No automatic detailed profile import is claimed. |
| LeetCode, CodeChef, HackerRank, HackerEarth | User-supplied profile URL | PARTIALLY FUNCTIONAL | No unofficial statistics import is claimed. |
| Portfolio website | None | DISABLED | No permitted metadata ingestion path is implemented. |

Structured resume and repository output use Zod validation. Resume candidates must carry a verbatim source excerpt present in the parsed text; a second deterministic check rejects skill, project-title and certification claims absent from that excerpt and drops optional details absent from the parsed text. This is a guard against unsupported claims, not proof of extraction accuracy. Malformed or deterministic fallback model output is not treated as successful extraction. GitHub model output remains a student-review candidate; README claims are not independent verification. A synthetic DOCX was parsed locally and produced 1 education, 1 experience, 1 project, and 2 skill candidates before this additional grounding check. No labeled accuracy benchmark was run; no real student CV or repository was processed, so extraction accuracy and project interpretation remain `BLOCKED` for certification.

## 6–10. Review, Person 360, projects, and evidence

The upload screen now requires explicit AI-processing choice and shows education, experience, project, skill, and certification candidates with select and edit controls. Validated extraction candidates and excerpts are stored as immutable, owner-bound source snapshots before the API returns them. At onboarding completion, each reviewed claim must match that student's snapshot; forged document claims, changed uncorrected values and cross-account claims are rejected. Student corrections are stored as self-reported evidence with the original excerpt retained for context. The source reference is a SHA-256 digest of the uploaded file. This flow is `LOCAL VERIFIED` by typecheck/build and focused two-account database checks, but a real document and cross-session browser test have not been run. The source hash cannot replace durable document storage for later reprocessing.

GitHub project confirmation now asks for a personal contribution description. The dedicated imported-project confirmation route requires a matching candidate in that student's saved source snapshots and uses server-side source labels and detected technologies. A manual project or user-entered GitHub URL remains self-reported. Manual project creation no longer defaults to Python or a model-development contribution. Publicly discovered projects enter onboarding as candidates; authorized README interpretation can be requested in the project review screen. Confirmed project descriptions, repository URLs, and reviewed AI purpose/limitations persist through onboarding. Resume and GitHub duplicate resolution remains `PARTIALLY FUNCTIONAL` (title-based candidate deduplication only). Academic field conflict resolution and technology alias normalization across all sources remain `BLOCKED`.

Person 360, project, contribution, and evidence tables already exist. Resume review stores source-backed, unverified claims; it does not grant verified status. Existing authenticated services enforce person ownership, but cross-account end-to-end tests are still required.

## 11–14. Goal, roadmap, personalization, and EORA

Goal and roadmap domain services exist. The roadmap API now reads the saved target role separately from the student's specific goal, reads the primary priority, and changes its active action when confirmed project records exist. A custom internship goal with a saved GenAI role now resolves a nonempty role roadmap in local tests. Only verified skill evidence can complete stages; recorded projects add an evidence-documentation action without silently completing a skill. The API filters actions to the Core project workspace and avoids assigning an unknown role the GenAI curriculum. `roadmap_milestones` persistence, versions, history, and event-driven replanning are `BLOCKED`.

The 96-configuration personalization engine exists. All 96 priority combinations now pass a local empty-profile composition check: each produces distinct interest-aware hero/EORA wording, at most five actions with Core routes, no invented journey events, and an honest unavailable network card. This is `LOCAL VERIFIED`, not an authenticated or production test. The live journey rail receives persisted Person 360 events instead of fixed enrollment/placement stages. Live dashboard composition avoids default student degree, institution, cohort, goal, verified achievements, fake learning resources, completed stages, fixed readiness percentages, invented network activity, and an always-verified skills popup. Unsupported mentor, job, collaboration, and event cards show Core-unavailable states with real profile/project routes. Live preference changes use the server-returned authenticated composition after save, rather than recomposing from missing client data. Demo data remains in explicit gallery/guest presentation paths. Action eligibility and evidence wording still need broader real-record auditing before certification.

The landing page's unsupported learner, mentor, opportunity, and project counts were replaced with descriptions of Core capabilities. Its EORA tips and Core onboarding descriptions no longer promise an active mentor directory, automated opportunity matching, or automatic project verification. The visual layout was preserved.

EORA now requires a session, reads that person's Person 360 context, rate limits questions, and returns an honest temporary-unavailability response on deterministic fallback. Grounded-answer behavior with real users, project-specific reasoning, and working mutation tools remain `BLOCKED` for end-to-end verification.

## 15–18. Screenshots, models, cost, and jobs

Production dashboard screenshots: `BLOCKED` — no new code was deployed. The public landing page loaded in the in-app browser on 2026-10-09, but an attempt to open `/api/health` returned `net::ERR_BLOCKED_BY_CLIENT`, and the shell could not resolve the production host. The authenticated dashboard and deployed API were therefore not verified. Do not use local or gallery images as production evidence.

LLM routing continues to use the existing Gemini, Groq, Cerebras, Mistral, OpenRouter, and SambaNova adapters. Resume uses `PROFILE_EXTRACT`; repository interpretation uses `PROJECT_SUMMARY`. Provider identity and model are returned in response metadata and logged by the existing audit path. One synthetic-CV local invocation used Groq `openai/gpt-oss-120b` because Next.js loaded `.env.local` despite empty command-line key overrides. The server was stopped, all local AI-provider key values were cleared, and a router-level `CORE_DISABLE_LIVE_LLM` switch plus production credential gate were added. There are no verified per-model accuracy or cost measurements. That invocation does not count as credential rotation or permission to reuse a disclosed key.

The existing AI quota and rate limit modules are present. Their global, multi-instance durability and actual provider billing are unverified. The `BackgroundJobQueue` remains an in-memory map. Placeholder success handlers were removed, so an unregistered job fails visibly. Queue persistence, real handlers, restart recovery, Redis worker behavior, and Render worker operation are `BLOCKED`.

## 19–21. Security, deployment, and blockers

`LOCAL VERIFIED`: insecure handoff and webhook runtime fallbacks were removed; new GitHub tokens use AES-256-GCM with person-bound authenticated data; production now requires a separate external-token encryption key, and the ingestion gate checks for it. Local handoff/webhook/session/token-encryption secrets were regenerated without printing values; all local AI-provider key values were cleared; `.env` and `.env.local` are ignored by Git; no local environment file was found in tracked history. The live onboarding path no longer writes passwords to localStorage or creates a placeholder account at completion. Production ingestion and all external model calls fail closed until `CORE_INGESTION_SECURITY_APPROVED=true` and required Core secrets are set. The flag is currently false. The GitHub disconnect path attempts provider-side token revocation, always deletes its local encrypted token, and tells the student when provider revocation could not be confirmed. The provider call has only a mocked local test.

On 2026-10-09, the operator confirmed that the previously disclosed AI provider keys and GitHub/webhook secrets were revoked and replaced in Vercel and Render. This is a user attestation; this checkout cannot independently inspect deployed secret values, the deployed API health check was blocked by the in-app browser, and a replacement-key request through the deployed service was not performed. Existing OAuth token migration and live authentication still need validation. Production secret audit for this local checkout still reports missing secrets for out-of-scope independent Tathastu integrations. Keep the production ingestion flag closed until deployed service checks, webhook signing, and the new build are verified.

Actual deployment status: `BLOCKED`. This checkout has not been deployed. No Vercel/Neon/Render end-to-end test, production credential test, queue restart test, two-student isolation test, or rollback exercise was performed.

## Local verification

- `npm run typecheck` — passed.
- `npm run test:core-v2` — passed token confidentiality/person isolation/tamper, closed production gate, empty draft defaults, extraction-schema and claim grounding, EORA fallback, owner-bound resume candidate validation, source-candidate isolation, mocked GitHub token revocation, private-repository exclusion before content reads, role/goal roadmap distinction and project-aware action, and all 96 empty-profile dashboard compositions.
- Isolated in-memory local API check — synthetic account sign-up returned 200; synthetic DOCX without consent returned 400; with consent returned 200 and validated candidates. No production database or student data was used.
- `npm run build` — passed after the source-audit edits.
- `npm run lint` — passed after excluding generated `.vercel` output from lint input.
- `git diff --check` — passed.

## Next implementation gates

1. Verify the operator-reported credential rotation through deployed secret audit and safe service checks after deployment, then explicitly open the production ingestion gate.
2. Add private durable resume storage, normalized candidate/review records, and authorized download/deletion.
3. Replace the in-memory job queue and stub handlers with durable processing, then test a worker restart.
4. Persist versioned roadmap milestones and connect confirmed evidence/goal changes to replanning.
5. Run the twelve specified staging and production scenarios with authorized test accounts, documents, and repositories; capture real dashboard screenshots and update every status above.
