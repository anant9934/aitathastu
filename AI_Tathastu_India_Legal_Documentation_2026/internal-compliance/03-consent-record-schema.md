# Consent Storage and Backend Enforcement Contract

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

A consent ledger is an operational record; do **not** call this product a formally registered DPDP Consent Manager without statutory registration.

### Suggested fields (schema plan, not an already deployed database)
`consent_id`, `person_id`, `purpose_id`, `scope` (provider, identifier hash/URL where authorized), `policy_version`, `notice_version`, `status` (granted/withdrawn), `granted_at`, `withdrawn_at`, `lawful_authority_reference` (guardian only where required), `source_UI`, `record_created_at`. Use minimal necessary metadata; never store CV text in a consent record.

### Permission design
- `cv_processing`: only allows supported upload, parsing, transient storage and review.
- `cv_external_ai_enrichment`: optional, recipient list and age/tier gate; default false; provider routing only within disclosed and approved recipients.
- `profile_reference_discovery`: occurs within authorized CV parsing and must not call external sites.
- `external_profile_fetch`: scope by platform + normalized account + categories + method + version.
- `connected_oauth:[provider]`: scopes authorized by the provider grant and user consent.
- `learning_personalization` where optional; child-related restrictions checked.
- `sharing:[audience]`: exact recipients/content.
- `cookies_analytics` / `cookies_marketing` only if installed and required.

### Enforce server-side
- Require current `cv_processing` to accept uploads.
- Never infer `cv_external_ai_enrichment` from upload acceptance or absent metadata.
- Require recipient to be approved **before** `IntelligenceRouter` selects a model or retries/fails over.
- At `/api/student/footprints/sync` verify a scoped stored authorization, rather than trusting a JSON `consent: true` from the client.
- `referenceOnly` must explicitly short-circuit without a network request to the external platform, even on page mount and reload.
- OAuth callback checks state/nonce, grant scope and account binding; no opportunistic extra import.
- Revocation races: atomically stop new jobs and cancel queued future acquisition where feasible.
- Audit only necessary identifiers, allowed decisions and policy version; no secret/token leak.
- Review parental/guardian workflows with legal and access-control teams.
