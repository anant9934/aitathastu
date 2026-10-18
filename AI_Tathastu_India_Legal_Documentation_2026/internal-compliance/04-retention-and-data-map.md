# Data Mapping, Retention and Deletion Runbook

> **PUBLICATION STATUS — DRAFT / DO NOT PUBLISH WITHOUT REVIEW.** Replace all `[VERIFY: …]` items with verified facts; confirm the operator and contact, deployed functionality, vendor contracts, retention schedule, age protections, and applicable Indian law with qualified counsel. Version: 0.9, research cut-off 17 October 2026.

### Evidence required from actual cloud accounts
Capture **no secret values**. Collect deployment regions, database branch/cluster, Redis retention/TTL, object-store lifecycle, Render volumes/transient files, provider logs, session cookie configuration, AI account tiers and legal contracts. Account for Vercel Preview potentially sharing production database/Redis, which must be corrected before any personal data tests.

| Data class | Source | Possible store/processor | User-level deletion | TTL/status |
|---|---|---|---|---|
| Original CV | Student upload | Vercel -> file/object store, Render if OCR | Delete file+related copies | [VERIFY] |
| Raw text/layout/OCR | Parser | Job metadata/temp stores | Clear reviewed/expired artifacts | [VERIFY] |
| Parsed candidate snapshot | Parser | Neon `sourceSnapshots`/resume document metadata | Delete or restrict as lawful | [VERIFY] |
| Confirmed/verified evidence | Review | Neon Person 360/evidence tables | Correct/unverify/erase per policy | [VERIFY] |
| Learning records | App usage | Neon and possibly other stores | Access/correct/erase where eligible | [VERIFY] |
| Connection tokens | OAuth | Encrypted database storage | Revoke provider and delete local tokens | [VERIFY] |
| Sync public records | API | Neon/cache | Delete/revoke linked records | [VERIFY] |
| Rate-limit counters | Requests | Upstash Redis | Automatic expiry where configured | [VERIFY] |
| AI prompts and outputs | Consent-based feature | AI vendor/app logging | Provider-dependent, contract-based | [VERIFY] |
| Security events | Auth/infra | Logs (jurisdiction audit) | Legal/security exception | [VERIFY] |
| Backups | Recovery | Database/storage backups | Expire on verified backup schedule | [VERIFY] |

### Deletion steps
Authenticate/authorize requester; scope the request; inventory records and processors; stop new processing; separate confirmed profile records from upload candidates; remove or flag affected data where lawful; revoke OAuth tokens; handle backups and logs under documented exceptions; acknowledge and respond; record completion without retaining excessive personal data.

Do not make a fixed retention promise until ops can verify it. CERT-In log duties must not be interpreted as blanket retention of uploaded CVs or complete prompts.
