# Publication Blockers and Launch Readiness

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

## Required facts before any legal page is live
- [ ] Verified legal entity/proprietor and real business address.
- [ ] Operational privacy, security, support and grievance contact channels; staffed processes.
- [ ] Actual product/domain scope; decide whether independent Learn, Meet, ERIS, AVSAR, etc. have separate operator policies.
- [ ] Confirmed minor eligibility/guardian mechanism before required commencement; third-party product age restrictions already matter.
- [ ] Current service-provider/subprocessor roster, contracts, regions, international transfers, training/retention settings.
- [ ] CV object/blob storage, OCR artifacts, Neon rows, Redis, EORA, job logging and backups lifecycle.
- [ ] Exact session cookie and browser local storage inventory, analytics/marketing SDK check.
- [ ] Document consent separated from external AI; hardcoded true values eliminated.
- [ ] CV data not sent to a vendor with incompatible tier, training/use policy or child-directed API restriction.
- [ ] DFI reference-only mode does not invoke unauthorized API acquisition.
- [ ] Each OAuth, public API, Firecrawl/site and export method supports its claimed data types and has platform-policy clearance.
- [ ] Uploaded/recognized user assertions never become 'independently verified' automatically.
- [ ] Security logging and CERT-In incident reporting responsibilities evaluated and operationalized.
- [ ] Correction, revocation, deletion, backups and retained-record exception workflows tested.
- [ ] Legal text does not promise more than deployed system can perform; footer links work in English and needed Indian language versions.
- [ ] Counsel approves India law scope, dates, children's rules, grievance officer requirements and disclosure wording.

## Known P0 red flags from inspected release code
1. `lib/client/onboarding/use-resume-ingestion.ts` submitted `aiConsent=true` regardless of separate opt-in.
2. `app/api/resume/extract/route.ts` conflated CV-processing consent and AI consent.
3. `lib/services/resume-ingestion-service.ts` treated consent as true unless explicitly false.
4. The CV page asserted 'No generative AI reads your CV' and 'Never shared with third parties' while external enrichment was possible.
5. DFI sync paths submitted `{consent:true}`; automatic reference registration called `/api/student/footprints/sync` with a `referenceOnly` flag that the inspected handler did not parse.
6. Latest Gemini Developer API terms disallow use in API clients directed to or likely accessed by under-18 individuals; unpaid tier is unsuitable for personal information.
These are code findings at inspected commit/version and must be checked again against current production after any fixes.

## Phased legal calendar
- 13 Nov 2025: first DPDP Act/Rules provisions commenced per Gazette notices.
- 13 Nov 2026: specified one-year tranche, including Consent Manager provisions/rule 4, scheduled.
- 13 May 2027: major personal data processing, notices, consent, children's data, rights and related rules scheduled.
These are not a declaration that all substantive obligations already applied by October 2026; existing IT/cyber/consumer/provider terms still apply.
