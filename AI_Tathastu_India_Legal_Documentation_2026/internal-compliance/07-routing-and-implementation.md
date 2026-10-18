# Website Routes, Controls and QA Checklist

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

### Public pages (proposed URL structure; check actual routes)
- `/privacy` -> privacy policy.
- `/terms` -> terms of use.
- `/cookies` -> cookie/browser storage policy.
- `/cookie-settings` -> real settings controls or route.
- `/privacy/resume-processing` -> CV/OCR notice.
- `/privacy/ai-processing` -> AI/EORA notice.
- `/privacy/digital-sources` -> DFI source-specific notice.
- `/privacy/your-rights` -> privacy requests.
- `/privacy/children` -> minors notice.
- `/privacy/retention` -> retention and backups.
- `/privacy/service-providers` -> verified provider register.
- `/security` -> security/reporting.
- `/acceptable-use` -> acceptable use.
- `/evidence-policy` -> evidence verification.
- `/disclaimer` -> learning/AI/career limits.
- `/copyright` -> IP and attribution.
- `/privacy/institution-sharing` -> institution-sharing notice only if applicable.
- `/grievance` -> complaints and contact.
- `/accessibility` -> accessibility contact.
- `/billing` -> ONLY once payments live and reviewed.

### Component/action locations to review
`components/onboarding/steps/CvStep.tsx`, `lib/client/onboarding/use-resume-ingestion.ts`, `app/api/resume/extract/route.ts`, `lib/services/resume-ingestion-service.ts`, `components/onboarding/steps/FootprintIntelligenceStep.tsx`, `lib/client/onboarding/use-footprint-connectors.ts`, `app/api/student/footprints/sync/route.ts`, `lib/services/digital-source-import-orchestrator.ts`, OAuth callbacks, consent/session repositories, footer/layout, model router and all provider adapters.

### Acceptance tests
- CV processing unchecked -> no upload; optional AI unchecked -> deterministic extraction succeeds and no external model call.
- Missing/false AI consent -> no AI call even on retry/poll after job rehydrate; opt-in doesn't override provider age restrictions.
- Provider fallback doesn't route to an undisclosed or blocked provider.
- DFI page load only discovers/displays references, doesn't send external acquisition requests.
- Direct forged `consent:true` to sync API is rejected without a valid stored, scoped consent.
- Multi-source fetch requires scope per provider; permission revocation blocks future requests.
- Cookie choices prevent optional script/network activity; no prechecked optional choices.
- Legal pages display real version/date and reachable contacts; footer URLs resolve on mobile and desktop.
- User can ask for correction, deletion, withdraw or appeal; jobs/records scoped to owner; backups handled truthfully.
- Guardian controls validated before lawful trigger; don't route minor-facing products through incompatible APIs.
- Security/processor inventory, vendor terms and breach playbook signed off.

### Deployment boundary
Do not publish placeholder documents; do not auto-deploy, add new paid providers, rotate secrets, migrate DB or connect live scraping until legal/QA sign-off. Record deployment SHA and snapshot all displayed legal versions.
