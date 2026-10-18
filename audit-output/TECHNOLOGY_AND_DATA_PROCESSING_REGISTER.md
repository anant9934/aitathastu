# TECHNOLOGY AND DATA PROCESSING REGISTER

**Document Version:** 1.0  
**Effective Date:** October 2026  
**Platform:** AI Tathastu  
**Scope:** Internal Processing Inventory & Technical Safeguards

---

## 1. Data Processing Register

| Pipeline Name | Data Categories Processed | Legal Basis | Processing Engines & Subprocessors | Storage Location & Encryption | Retention Period | Technical Safeguards |
|:---|:---|:---|:---|:---|:---|:---|
| **Account Registration** | Email, display name, password hash, role, terms acceptance, age confirmation | Contract (Terms §2) & Consent (DPDP §6) | In-house Next.js auth handler (`/api/auth/sign-up`), bcrypt/Argon2 hashing | Neon PostgreSQL / PGlite `users`, `persons` tables | Account lifetime + 30 days post-deletion | Salted password hashing, zero plain-text storage |
| **CV Upload & OCR** | PDF/DOCX binary, extracted text, raw spans, candidate entities | Explicit Consent (DPDP §6) | Deterministic parser (`deterministic-extractor.ts`), PDF.js / OCR (text layer only) | `resume_documents` table, local temporary storage | Active resume version or until deleted by student | Strict filetype validation, 10MB limit, antivirus scan |
| **Optional CV AI Enrichment** | Redacted resume text excerpts, project descriptions, skills keywords | Explicit Consent (Optional, DPDP §6) | External LLMs: OpenAI / Anthropic / Google Vertex AI via Intelligence Router | Ephemeral memory only; zero persistent DB storage | Ephemeral (zero data retention by LLM providers) | Mandatory consent gate (`aiConsent === true`), PII masking |
| **Digital Footprints Sync** | Public GitHub repos, commits, stars, Kaggle ranks, LeetCode problem counts | Explicit Consent (Optional, DPDP §6) | GitHub REST API, Kaggle API, LeetCode GraphQL, Apify actors | `external_connections`, `portfolio_items` tables | Sync active while linked; disconnected on request | SSRF check (`isSafePublicUrl`), AES-256 token encryption |
| **Skills & Evidence Ledger** | Skill name, proficiency tier, evidence URLs, verification status | Legitimate Use & Student Claims | Internal Evidence Engine (`evidence-service.ts`) | `skills`, `evidence_items` tables | Account lifetime | 3-tier distinction: Detected Hint, Confirmed, Verified |
| **EORA Companion Assistant** | Student query, context summary, roadmap milestones | Legitimate Educational Purpose | EORA Router (`intelligence/router.ts`), external LLM fallback | Client session memory, `journey_events` table | Ephemeral session queries; milestone events saved | Strict prompt injection filters, contextual bounding |
| **Data Portability Export** | Complete profile JSON, evidence items, projects, consent log | Statutory Duty (DPDP §11) | `DataRightsService.exportStudentData` | Ephemeral JSON buffer streamed to client | Ephemeral download; zero export log cache | Strict redaction of password hashes, API keys, tokens |
| **Cookie & Storage Preferences** | Theme (`theme`), session ID (`auth_token`), consent state | Consent & Security Necessity | Browser `localStorage`, HTTP-only secure cookie | User browser client storage | 12 months for preferences; session for auth | Secure, HTTP-Only, SameSite=Lax flags |

---

## 2. Architectural Security Principles

1. **Zero-LLM Baseline Guarantee:** The application is architected so that all core student workflows (onboarding, resume text extraction, skills mapping, and project ledgers) function completely without external LLMs.
2. **Strict Consent Decoupling:** Optional AI enrichment and external footprint syncing are strictly partitioned from essential platform access. Declining or withdrawing optional consent never degrades core functionality.
3. **Data Minimization:** No unnecessary personal data (such as government IDs, biometric data, or financial credentials) is requested or stored.
