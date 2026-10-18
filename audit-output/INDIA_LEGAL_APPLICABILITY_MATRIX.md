# INDIA LEGAL APPLICABILITY MATRIX

**Document Version:** 1.0  
**Effective Date:** Phased Implementation under Indian Technology Law  
**Platform:** AI Tathastu (Learning, Evidence & Career Verification Platform)  
**Classification:** Statutory Mapping & Compliance Assessment

---

## 1. Statutory Framework Overview

AI Tathastu operates within the sovereign jurisdiction of India. Data processing, platform operations, and user privacy are governed by the following statutes, rules, and executive directions:

1. **Digital Personal Data Protection Act, 2023 (DPDP Act, 2023)** & **Draft DPDP Rules, 2025**
2. **Information Technology Act, 2000 (IT Act, 2000)** (Sections 43A, 67C, 69, 70B, 79)
3. **Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (SPDI Rules, 2011)**
4. **CERT-In Cyber Security Directions (No. 20(3)/2022-CERT-In)** (April 2022)
5. **CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023**

---

## 2. Comprehensive Applicability & Compliance Register

| Statutory Provision | Regulatory Scope | AI Tathastu Operational Role | Technical Implementation Mechanism | Compliance Status |
|:---|:---|:---|:---|:---|
| **DPDP Act §5 — Notice** | Itemized notice describing personal data sought, specific purpose, manner of exercising rights, and grievance officer details. | Data Fiduciary | Granular notices displayed at every intake point (`CvStep.tsx`, `FootprintIntelligenceStep.tsx`, `AuthForms.tsx`) and dedicated notices at `/privacy/resume-processing`, `/privacy/ai-processing`, `/privacy/digital-sources`. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **DPDP Act §6 — Consent** | Consent must be free, specific, informed, unconditional, unambiguous, and signified through clear affirmative action. | Data Fiduciary | Granular, unbundled checkboxes (unchecked by default). Absence of consent defaults strictly to `false`. Consent withdrawal supported with zero penalty. Recorded in `ConsentService`. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **DPDP Act §6(4) — Withdrawal** | Data Principal has the right to withdraw consent with the same ease with which consent was granted. | Data Fiduciary | Dedicated student privacy dashboard (`/student/privacy`) featuring one-click withdrawal of optional external AI enrichment and footprint background sync. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **DPDP Act §9 — Children's Data** | Verifiable parental consent before processing child data; strict prohibition on behavioral tracking, targeted advertisements, or detrimental processing. | Data Fiduciary | Platform strictly serves career/academic preparation. Age gate in sign-up flow (`AuthForms.tsx`), parental notice at `/privacy/children`. Zero advertising trackers, zero behavioral ad cookies. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **DPDP Act §11 — Right to Access** | Summary of personal data processed, identities of all data fiduciaries/processors with whom shared. | Data Fiduciary | `DataRightsService.exportStudentData` generates a complete, structured JSON export covering profile, evidence items, skills, projects, and consent history. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **DPDP Act §12 — Correction & Erasure** | Correction of misleading data and erasure of personal data that is no longer necessary. | Data Fiduciary | Self-service field editing across student workspace; formal erasure request endpoint at `/api/student/privacy/requests`. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **DPDP Act §13 — Grievance Redressal** | Readily accessible grievance redressal mechanism with established response channels. | Data Fiduciary | Public grievance redressal portal at `/grievance`, interactive request logger in `DataRightsRequestCard.tsx`, and published contact channel `support@aitathastu.com`. *(Named individual awaiting verification)* | `IMPLEMENTED AND TECHNICALLY VERIFIED` *(Personnel verification pending)* |
| **IT Act §43A & SPDI Rules 2011** | Comprehensive security practices, encryption, and protection of passwords, financial, and personal details. | Intermediary / Fiduciary | Passwords hashed using bcrypt/Argon2, external API tokens encrypted with AES-256-GCM (`lib/crypto/encryption.ts`), strict SSRF defense on external URLs (`url-check.ts`). | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **CERT-In Directions §70B (2022)** | Logging of ICT system events for 180 days within Indian jurisdiction, synchronization with NTP servers, 6-hour cybersecurity incident reporting. | System Operator | Server logs maintain UTC/IST timestamps; immutable `consentLedger` retains 200 chronological events per user; incident reporting protocol documented in `/security`. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |
| **CCPA Dark Patterns Guidelines (2023)** | Prohibition of false urgency, basket sneaking, confirmshaming, forced action, disguised ads, and trick questions. | Digital Platform | Clean, neutral UX: all optional checkboxes unbundled and unchecked by default; equal visual weight for "Skip" and "Accept" actions; zero subscription traps. | `IMPLEMENTED AND TECHNICALLY VERIFIED` |

---

## 3. Statutory Phased Timetable & Verification Protocol

Because the DPDP Rules 2025 are rolling out in phased administrative tranches, AI Tathastu has adopted an active, forward-compatible architecture:

1. **Pre-Enforcement Readiness:** Core architecture (granular consent, immutable ledger, data portability, right to erasure) is fully built and functioning today.
2. **Review Draft Status:** To maintain complete legal truthfulness, all public policies clearly state:
   > *"Review Draft — Awaiting Owner & Legal Fact Verification. Published for technical readiness and transparency under the phased timetable of the DPDP Act, 2023."*
3. **Release Approval Gate:** Final corporate identity details (CIN, physical registered office, named Grievance Officer, and statutory response SLAs) will be unlocked once verified by corporate leadership.
