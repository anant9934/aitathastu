# AI Tathastu — Indian Website Legal & Consent Documentation Pack

**Research cutoff:** 17 October 2026. **Status: Draft only — not publish-ready.**

The pack contains original English policy drafts tailored to the described AI Tathastu technology and products. It is NOT a legal opinion or compliance certification. No public page should be published with `[VERIFY]` placeholders, untested promises, unsupported vendor claims or unapproved child-processing flows.

## Public documents

- `public-pages/01-privacy-policy.md` — Privacy Policy
- `public-pages/02-terms-of-use.md` — Terms of Use
- `public-pages/03-cookie-policy.md` — Cookie and Browser Storage Policy
- `public-pages/04-resume-processing.md` — Resume and CV Data Processing Notice
- `public-pages/05-ai-processing.md` — AI Processing, EORA and Automated Suggestions Notice
- `public-pages/06-digital-sources.md` — Digital Footprint, Third-Party APIs and Public Profiles Notice
- `public-pages/07-data-rights.md` — Your Privacy Rights and Requests
- `public-pages/08-children-privacy.md` — Children, Age and Parent/Guardian Privacy Notice
- `public-pages/09-retention.md` — Data Retention, Deletion and Backups
- `public-pages/10-service-providers.md` — Service Providers and International Processing
- `public-pages/11-security.md` — Security Practices and Responsible Vulnerability Disclosure
- `public-pages/12-acceptable-use.md` — Acceptable Use and Community Guidelines
- `public-pages/13-evidence-policy.md` — Profile Claims, Skills Evidence and Verification Policy
- `public-pages/14-learning-ai-disclaimer.md` — Learning, EORA and Career Guidance Disclaimer
- `public-pages/15-copyright-and-attribution.md` — Copyright, Content Licensing and Attribution
- `public-pages/16-institutional-sharing.md` — Institution, Faculty, Mentor and Recruiter Sharing Notice
- `public-pages/17-grievance.md` — Grievance, Privacy and Content Complaints
- `public-pages/18-accessibility.md` — Accessibility and Support
- `public-pages/19-payments-conditional.md` — Fees, Subscriptions, Cancellation and Refunds — Conditional Draft
- `public-pages/20-community-collaboration-conditional.md` — Collaboration and Research Community Notice — Conditional Draft

## Consent wording and internal operational materials

- `consent-copy/01-consent-ui-copy.md` — Consent Text for Live Onboarding and Account Settings
- `consent-copy/02-cookie-banner-and-preference-modal.md` — Cookie Banner and Preferences Modal Copy
- `internal-compliance/01-launch-readiness.md` — Publication Blockers and Launch Readiness
- `internal-compliance/02-indian-law-matrix.md` — Indian Legal Applicability and Sources
- `internal-compliance/03-consent-record-schema.md` — Consent Storage and Backend Enforcement Contract
- `internal-compliance/04-retention-and-data-map.md` — Data Mapping, Retention and Deletion Runbook
- `internal-compliance/05-api-provider-register.md` — Third-Party API, AI Provider and Content Licence Register
- `internal-compliance/06-incident-response-and-complaints.md` — Security Incident and Grievance Operational Plan
- `internal-compliance/07-routing-and-implementation.md` — Website Routes, Controls and QA Checklist

## Verified context vs conditional integrations
- Core confirmed/documented architecture: Next.js/Vercel, Python/Render OCR using PyMuPDF/Tesseract, Neon PostgreSQL, PGlite development, optional Upstash Redis, consented external model router, GitHub/Google OAuth and DFI. Actual deployment, regions and secrets not audited for this pack.
- Configured AI vendors: Groq, Cerebras, Gemini, OpenRouter, Mistral and SambaNova; *not* proof all providers actively process data. Each needs current terms and contract review.
- Firecrawl and Stack Exchange may be desired or planned; supplied `.env.example` did not establish Firecrawl operational use and did not include a Stack Exchange API key. Kaggle credentials exist in `.env.example` but do not prove an active user-profile integration. Publish only verified integrations.
- The product may be accessed by minors. Gemini Developer API terms explicitly restrict API clients directed at or likely accessed by under-18 individuals. This is a separate contractual blocker beyond the DPDP phased timetable.
- CV parser currently uses a user checkbox but previously inspected frontend force-submitted AI consent; backend and claims need to be audited/fixed before legal notices promise separation.
- Independent products (Tathastu Meet, Learn, ERIS, AVSAR, etc.) require independent operator/product-specific privacy and data collection analysis.

## Launch blocker checklist
1. Replace legal operator, business address, effective dates and contacts.
2. Confirm exact deployed domains/routes and relevant active products.
3. Obtain operational signed-off vendor register, contract/tier/subprocessors and retention schedule.
4. Implement consent ledger + server-side scoped enforcement and age-appropriate approach.
5. Inventory browser storage and nonessential scripts; publish accurate cookie table.
6. Verify rights, deletion, grievance, incident and security log workflows.
7. Review with qualified Indian counsel and publish approved text only.

## Important legal timetable
Digital Personal Data Protection Act 2023 and DPDP Rules 2025 have phased commencement (2025, 2026 and 2027). Avoid treating future operative consent/child obligations as already fully in force in October 2026; prepare implementation now. Other laws and contractual obligations may already be effective.

## References
See `sources/LEGAL_AND_VENDOR_SOURCES.md` for official legal and vendor documents.
