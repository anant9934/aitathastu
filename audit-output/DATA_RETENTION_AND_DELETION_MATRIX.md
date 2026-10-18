# DATA RETENTION AND DELETION MATRIX

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Lifecycle, Archival, Erasure & Statutory Retention Rules

---

## 1. Data Retention & Destruction Register

| Data Category | Active Operational Lifecycle | Post-Account Closure / Erasure Request | Backup Retention Window | Permanent Deletion Method | Statutory Legal Justification |
|:---|:---|:---|:---|:---|:---|
| **Account Credentials & Auth Identity** | Active while account remains open | Immediate soft-deletion; permanently purged within 30 days | 30 days in encrypted daily snapshots | Cryptographic shredding & relational `CASCADE DELETE` | Contract fulfillment & DPDP §12 |
| **Uploaded CVs & OCR Text Blobs** | Retained while active resume is selected by student | Immediate deletion upon document replacement or student request | Purged with next backup cycle (≤30 days) | Unlinked from blob storage, database record zeroed | Consent-based processing (DPDP §6/12) |
| **Extracted Profile & Candidate Suggestions** | Stored in student workspace until modified or confirmed | Purged upon account deletion or profile reset | Purged with backup cycle (≤30 days) | Database row deletion | DPDP §12 Data minimization |
| **Evidence Items & Verification Records** | Maintained throughout student learning journey | Purged on account erasure; verified issuer hashes anonymized | 30 days in backup snapshots | Database row deletion | Academic provenance & student rights |
| **Digital Footprint Links & Synced Metadata** | Maintained while connection is active | Deleted immediately upon connection disconnect or account closure | Purged with backup cycle (≤30 days) | Tokens shredded; cache tables purged | Consent-based processing (DPDP §6) |
| **Consent Ledger & Audit Trail** | Retained across account lifetime (up to 200 events) | Retained for 180 days post-closure to prove statutory compliance | 180 days in immutable audit archives | Automated archival purge | CERT-In Directions 2022 & DPDP §6 |
| **Statutory Data Rights & Grievance Tickets** | Active during inquiry resolution | Retained for 1 year following dispute resolution | 1 year | Encrypted archival purge | IT Act 2000 Grievance Rules |
| **Server Access & Cybersecurity Logs** | Active rotating buffer (30 days) | Retained for mandatory 180 days within Indian jurisdiction | 180 days | Secure overwrite | CERT-In Cyber Security Directions (2022) |

---

## 2. Deletion & Erasure Protocol (DPDP Section 12)

When a student submits an account erasure request via `/api/student/privacy/requests`:
1. **Immediate Revocation:** The authenticated session is immediately invalidated, and login access is disabled.
2. **Synchronous Unlinking:** External connection sync tokens (GitHub, Kaggle, LeetCode) are shredded, preventing future background API calls.
3. **Data Scrubbing:** All personal profile details, resume files, and project descriptions are scheduled for permanent purge.
4. **Compliance Retention Hold:** Only mandatory cybersecurity audit logs and the consent audit trail are retained for the legally required 180-day window under CERT-In directions, after which they are automatically destroyed.
