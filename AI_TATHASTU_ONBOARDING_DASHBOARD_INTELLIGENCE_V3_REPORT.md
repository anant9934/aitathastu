# AI TATHASTU — ONBOARDING INTELLIGENCE & PERSONALIZED DASHBOARD ENGINE V3 REPORT

**Author**: Principal AI Platform Architect & Engineering Team  
**System**: AI Tathastu  
**Version**: 3.0.0-PROD  
**Architecture**: Next.js 15.5 + Render Python OCR Extractor + Neon Postgres + Redis + Distributed Sync Engine  
**Status**: Implementation & Verification Complete — 100% Tests Passing  

---

## EXECUTIVE SUMMARY

The **AI Tathastu Onboarding Intelligence & Personalized Dashboard Engine V3** delivers a deeply integrated, end-to-end intelligence pipeline connecting student onboarding to personalized, evidence-backed dashboards.

The engine powers:
1. **Accurate Document & CV Ingestion** during AI Tathastu onboarding with strict evidence grounding.
2. **Digital Footprint Discovery & Enrichment** (GitHub, Kaggle, Stack Overflow, Portfolio, LeetCode, HackerRank, Scholar, Hugging Face, ORCID, LinkedIn).
3. **Student Profile & Skills Intelligence** with canonical skill normalization (eliminating duplicates like `Python3` vs `Python` or `Sklearn` vs `Scikit-Learn`).
4. **Central Evidence Normalization** preserving exact source provenance without manufacturing artificial mastery scores.
5. **Cross-Source Project Deduplication** preventing duplicate project counts across CV, GitHub, Kaggle, and personal portfolios.
6. **Two-Stage Personalized Dashboard Delivery**:
   - **Stage A (Immediate First Dashboard)**: Instantly rendered upon onboarding completion using confirmed learner data, academic profile, goals, and local evidence with zero blocking on external API latency.
   - **Stage B (Background Enrichment)**: Asynchronous, bounded-concurrency footprint synchronization running independently across connected providers with live status reporting (`queued`, `running`, `succeeded`, `partial`, `failed`, `dead_letter`).
7. **Personalized AI/ML Career & Learning Recommendations**: Covering 10 core AI/ML modules tailored to the student's target role and unmet prerequisites.
8. **Resilient Operation Without CV or When External APIs Are Unconfigured**: Clean fallback to self-reported profiles, manual additions, and honest provisional statuses.

---

## 1. EXISTING ARCHITECTURE & REUSED COMPONENTS

The V3 engine preserves and extends the core production stack without replacing stable services:
- **Next.js 15.5 App Router**: Server-side rendering, API route handlers, and client components in React 19.
- **Neon Postgres**: Drizzle ORM schema managing `evidence_items`, `projects`, `external_connections`, `onboarding_drafts`, `source_snapshots`, `sync_operations`, and `user_preferences`.
- **Render Python OCR Service**: Native Tesseract + pdfplumber extraction bridge preserving exact text boundaries, coordinates, and section layout.
- **Distributed Sync Engine**: `runSyncOperation`, `KeyPool`, `rate-limiter`, and `state-machine` orchestrating independent per-source lifecycles with circuit breakers.
- **EORA Grounded Copilot**: Deterministic page contextual guidance and RAG conversational drawer (`/api/eora/chat`) powered by `IntelligenceRouter` and grounded in the student's real profile.

---

## 2. NEW CONNECTORS & INTEGRATION POINTS

| Provider | Connector Module | Integration Point | Acquisition Mode | Capabilities & Defenses |
| :--- | :--- | :--- | :--- | :--- |
| **Firecrawl** | `lib/connectors/firecrawl/client.ts` | `lib/sync/footprint-sync.ts`, `DigitalSourceImportOrchestrator` | `PERMITTED_PUBLIC_METADATA` | 5-credential rotation; SSRF defense blocking private IPs & cloud metadata; 8s timeout; 250KB limit; project & publication extraction. |
| **Apify** | `lib/connectors/apify/client.ts` | Compliance-cleared batch runs | `AUTHORIZED_ACTOR_RUN` | 4-token rotation; strict Actor Whitelist (`APPROVED_APIFY_ACTORS`); ToS enforcement (blocks unauthorized LinkedIn scraping; routes to OAuth/export); compute unit auditing. |
| **Kaggle** | `lib/connectors/research-and-dev/kaggle-client.ts` | `lib/sync/footprint-sync.ts`, `DigitalSourceImportOrchestrator` | `PERMITTED_PUBLIC_METADATA` | 3 platform credentials capacity; rotation without impersonating private accounts; public datasets & notebooks mapping. |
| **Stack Exchange** | `lib/connectors/research-and-dev/client.ts` | `lib/sync/footprint-sync.ts`, `DigitalSourceImportOrchestrator` | `OFFICIAL_PUBLIC_API` | 1 API key capacity (`STACKEXCHANGE_API_KEY`); backoff compliance (`soBackoffUntil`); reputation, badge, and top-tag skills mapping. |
| **Portfolio / Web** | `lib/connectors/portfolio/client.ts` | `lib/sync/footprint-sync.ts`, `DigitalSourceImportOrchestrator` | `PERMITTED_PUBLIC_METADATA` | Lightweight reader first; optional Firecrawl enrichment; strict SSRF IP resolution verification. |

---

## 3. API CONFIGURATION MATRIX

| Setting / Key Pattern | Capacity | Rotation / Selection Method | Failure Handling & Safe State |
| :--- | :--- | :--- | :--- |
| `GROQ_API_KEYS` / `GROQ_API_KEY_1..5` | 5 Credentials | `KeyPool` round-robin rotation | On 401/403: removes failing key; falls back to next provider in `CLOUD_AI_PROVIDER_ORDER`. |
| `GEMINI_API_KEYS` / `GEMINI_API_KEY_1..4` | 4 Credentials | `KeyPool` round-robin rotation | On quota exhaustion: marks key failed; switches to next provider. |
| `OPENROUTER_API_KEYS` / `OPENROUTER_API_KEY_1..4` | 4 Credentials | `KeyPool` round-robin rotation | Graceful fallback to deterministic template responses if all fail. |
| `KAGGLE_USERNAME_1..3` & `KAGGLE_KEY_1..3` | 3 Credentials | `KeyPool` credential pair rotation | If unconfigured, falls back to public profile link reference. |
| `APIFY_TOKEN_1..4` / `APIFY_TOKENS` | 4 Tokens | `KeyPool` token rotation | Strict actor whitelist; returns `{ status: "unconfigured" }` if keys absent. |
| `FIRECRAWL_API_KEY_1..5` / `FIRECRAWL_API_KEYS` | 5 Credentials | `KeyPool` token rotation | Falls back to native lightweight portfolio HTML parser. |
| `STACKEXCHANGE_API_KEY` | 1 Key | Direct parameter injection | Unauthenticated public rate limit fallback with backoff compliance. |

---

## 4. CV EXTRACTION INTEGRATION

When a learner uploads a PDF or DOCX:
1. **Document Validation**: File type, size budget (≤15MB), and structural checks.
2. **Native Text Extraction**: Dual-column aware extraction preserving visual flow and reading order.
3. **Selective High-Fidelity OCR**: Tesseract engine invoked only where native text density is insufficient.
4. **Structured Section Recognition**: Identity, education, work experience, projects, skills, certifications, publications, and digital links.
5. **No Hallucination Policy**: If dates, organizations, or titles are ambiguous, they are flagged for user review rather than inferred.
6. **Consented AI Enrichment**: AI enrichment runs only when student gives explicit consent and deterministic confidence is low.
7. **Confirmation Gate**: Confirmed records persist to Neon DB with immutable provenance.

### No-CV Path Resilience
If the learner skips CV upload:
- The 12-step onboarding remains fully operational.
- Student manually enters academic background, target AI/ML role, priorities, and digital links.
- Generates an honest initial dashboard with zero fabricated accomplishments.

---

## 5. DIGITAL FOOTPRINT INTELLIGENCE (DFI)

- Discovers platform links from CV text, PDF hyperlink annotations, and DOCX relationships.
- Supports GitHub, LinkedIn, Kaggle, Stack Overflow, Portfolio, LeetCode, HackerRank, Hugging Face, ORCID, CodeChef, and HackerEarth.
- Never guesses an account from name alone; requires learner confirmation or explicit URL.
- Supports multiple portfolio websites and multiple project links.
- Respects source-specific access rules (e.g. LinkedIn automated scraping is strictly blocked in compliance with ToS; user-authorized export archive upload is supported).

---

## 6. EVIDENCE NORMALIZATION PIPELINE

All extracted and retrieved data enters the canonical normalization service (`EvidenceNormalizationService`):
```typescript
export interface CanonicalEvidenceRecord {
  studentId: string;
  recordType: "skill" | "project" | "publication" | "assessment" | "experience" | "education" | "achievement";
  claimValue: string;
  structuredFields: Record<string, unknown>;
  sourceProvider: string;
  sourceUrl?: string | null;
  sourceEvidenceSpan?: string | null;
  captureTimestamp: string;
  freshnessTimestamp: string;
  extractionMethod: "rule_based" | "connector_api" | "resume_extractor" | "firecrawl_enrichment" | "user_confirmed" | "manual";
  extractionConfidence?: number | null;
  reviewStatus: "draft" | "candidate" | "confirmed" | "rejected";
  verificationStatus: "unverified" | "imported" | "claimed" | "verified" | "rejected";
  externalRecordId?: string | null;
  deduplicationFingerprint: string;
  parentRecordAssociation?: string | null;
  whyItMatters: string;
}
```

### Claim Distinction
- **Extracted Claim**: Observed in CV or portfolio before confirmation (`verificationStatus: "imported"`, `reviewStatus: "candidate"`).
- **Student-Confirmed Claim**: Approved by learner in Step 8 Review (`reviewStatus: "confirmed"`).
- **Externally Observed Evidence**: Directly verified from official REST APIs (GitHub, LeetCode, Kaggle, Stack Overflow).
- **Assessed Skill**: Derived from verified coding assessments or mentor interviews.
- **Independently Verified Evidence**: Cryptographically signed or faculty-verified.
- **Strict Rule**: Extracted claims are never automatically upgraded to verified achievements.

---

## 7. CROSS-SOURCE DATA FUSION

- **Skill Alias Mapping**: Normalizes variants (`python3`, `py`, `cpython` → `Python`; `torch`, `torchvision` → `PyTorch`; `sklearn` → `Scikit-Learn`; `tf`, `keras` → `TensorFlow`; `cv2` → `OpenCV`; `k8s` → `Kubernetes`).
- **Project Deduplication**: Matches projects across CV, GitHub, Kaggle, and Portfolio by canonical repository URL, demo URL, normalized title key, and repository slug (e.g. `Credit Card Fraud Detection` matches `credit-card-fraud-detection`).
- **Multi-Source Union**: Combines sources into `sources: ["resume", "github", "portfolio"]` and unions technologies while preserving user-edited descriptions.
- **Conflict Detection**: `CrossSourceFusionService.recordConflictIfDifferent` records discrepancies in dates or graduation years into `source_conflicts` for learner resolution rather than silently overwriting.

---

## 8. PERSONALIZED DASHBOARD SECTIONS (A–H)

| Section | Content & Provenance | Grounding Rule |
| :--- | :--- | :--- |
| **A. Student Overview** | Name, degree, institution, cohort, target role, active goal, priority archetype, connected platforms. | Strictly from saved `person_profile` and `user_preferences`. |
| **B. Skills Intelligence** | Tracked skills, demonstrated skills in projects, skills needing evidence, verified skills, and target-role gaps. | Sourced from `evidence_items` deduplicated by canonical skill name. |
| **C. Projects Intelligence** | Confirmed projects, GitHub repos, Kaggle notebooks, portfolio projects, technologies. | Deduplicated via `saveProject` + `EvidenceNormalizationService`. No count inflation. |
| **D. Personalized AI/ML Roadmap** | Stage-by-stage progression toward target role. | Evaluates authentic prerequisites; marks stages as `completed`, `in_progress`, or `up_next`. |
| **E. Learning Recommendations** | Tailored modules from the **10 Core AI/ML Modules** (Python, Math, ML, DL, NLP, CV, GenAI, LLM Engineering, RAG, MLOps). | Scored dynamically: unmet prerequisites receive top priority; completed topics are deprioritized. |
| **F. Digital Footprints** | Footprint cards ranked by student priority; sync states (`queued`, `running`, `succeeded`, `partial`, `failed`, `dead_letter`). | Real sync snapshots from `latestSyncOperations` and `external_connections`. |
| **G. Research & Achievements** | Publications, DOIs, LeetCode/HackerRank badges, Stack Overflow reputation, certifications. | Exact type and status preserved; links directly to DOI or verified profile. |
| **H. EORA Personal Insights** | Conversational explanations of demonstrated strengths, missing milestones, and next actions. | Grounded in `wrapUntrustedContent` profile context; strictly forbids hallucinating qualifications. |

---

## 9. IMMEDIATE DASHBOARD + ASYNC ENRICHMENT

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STUDENT ONBOARDING FLOW                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Step 12: Complete Onboarding
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               STAGE A — IMMEDIATE FIRST DASHBOARD (0ms LATENCY)        │
│  - Reads confirmed OnboardingDraft, academic details, and local claims  │
│  - Returns immediately to client; redirects to /student overview       │
│  - User experiences ZERO waiting for external network latency          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Asynchronous Fire-and-Forget
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               STAGE B — ASYNC BACKGROUND ENRICHMENT (SYNC ENGINE)       │
│  - syncAllFootprints(personId, "user") queued with bounded concurrency │
│  - Parallel execution: GitHub, Kaggle, Scholar, LeetCode, HackerRank,  │
│    Stack Overflow, Portfolio (with Firecrawl enrichment fallback)      │
│  - Each provider runs in an independent error boundary                 │
│  - Persists snapshots with SHA-256 checksums into source_snapshots     │
│  - Deduplicates projects and normalizes evidence into evidence_items   │
│  - Failed or rate-limited providers serve cached snapshots (partial)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. COST & QUOTA SAFEGUARDS

1. **Task-Specific LLM Routing**: Ingestions and evaluations specify their task (`EORA_CHAT`, `RESUME_EXTRACTION`, `PROJECT_INTELLIGENCE`) avoiding duplicate or redundant calls.
2. **KeyPool Rotation**: Rotates through healthy keys; automatically isolates 401/403/429 failures.
3. **SSRF Guard**: Strict IP resolution checks before any outbound portfolio or Firecrawl request.
4. **Rate Limits & Backoff**: Stack Exchange respects `soBackoffUntil`; LinkedIn respects 14-day cooldown; GitHub respects rate window.
5. **No Secrets in Logs**: All tokens, credentials, and raw CV content are sanitized before logging.

---

## 11. REMAINING PROVIDER ACTIVATION STEPS

To activate the newly supported capacity in production, configure the following deployment environment variables:

```bash
# LLM Providers
GROQ_API_KEYS="gsk_key1,gsk_key2,gsk_key3,gsk_key4,gsk_key5"
GEMINI_API_KEYS="AIzaSy1,AIzaSy2,AIzaSy3,AIzaSy4"
OPENROUTER_API_KEYS="sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3,sk-or-v1-key4"
CLOUD_AI_PROVIDER_ORDER="groq,gemini,openrouter,cerebras,mistral,sambanova"

# External Data Providers
KAGGLE_USERNAME_1="tathastu_bot_1"
KAGGLE_KEY_1="kaggle_key_1"
KAGGLE_USERNAME_2="tathastu_bot_2"
KAGGLE_KEY_2="kaggle_key_2"
KAGGLE_USERNAME_3="tathastu_bot_3"
KAGGLE_KEY_3="kaggle_key_3"

APIFY_TOKEN_1="apify_api_token_1"
APIFY_TOKEN_2="apify_api_token_2"
APIFY_TOKEN_3="apify_api_token_3"
APIFY_TOKEN_4="apify_api_token_4"

FIRECRAWL_API_KEY_1="fc-key-1"
FIRECRAWL_API_KEY_2="fc-key-2"
FIRECRAWL_API_KEY_3="fc-key-3"
FIRECRAWL_API_KEY_4="fc-key-4"
FIRECRAWL_API_KEY_5="fc-key-5"

STACKEXCHANGE_API_KEY="se_api_key_1"
```

*Note: The application operates gracefully in disabled/provisional mode when any or all of these keys are omitted.*

---

## 12. TEST EVIDENCE & VERIFICATION SUMMARY

All verification suites executed successfully:

| Test Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **V3 Intelligence Suite** | `npx tsx scripts/verify-v3-onboarding-intelligence.ts` | **12/12 Passed (100%)** | Validated capacities, SSRF, Apify whitelist, Kaggle rotation, Stack Overflow mapping, skill alias normalization, project fusion, and dashboard sections A–H. |
| **Core V3 Intelligence** | `npm run test` | **14/14 Passed (100%)** | Verified SSRF, semantic extraction, project intelligence, adaptive roadmaps, 96 priority configurations, and encryption. |
| **Resume Pipeline** | `npm run test:resume-pipeline` | **7/7 Passed (100%)** | Validated two-column extraction, OCR noise cleaning, link typing, and skip-ahead. |
| **Hybrid Extraction** | `npm run test:hybrid-extraction` | **5/5 Passed (100%)** | Verified deterministic baseline, Schema v2.0 adaptation, quota decision gate, and additive merge. |
| **Portfolio Network** | `npm run test:portfolio-network` | **3/3 Passed (100%)** | Validated DNS pinning and mixed public/private IP answer rejections. |
| **ESLint** | `npm run lint` | **0 Errors** | Code hygiene verified across entire workspace. |
| **TypeScript Typecheck** | `npm run typecheck` | **0 Errors** | Strict type safety confirmed across all modified modules. |
| **Next.js Production Build**| `npm run build` | **0 Errors (Exit Code 0)**| 82/82 static and dynamic pages compiled successfully. |

---

## 13. END-TO-END MANUAL VERIFICATION INSTRUCTIONS

To manually verify the full pipeline:
1. **Launch Local Dev Server**:
   ```bash
   npm run dev
   ```
2. **Test CV Onboarding Path**:
   - Navigate to `http://localhost:3000/onboarding`.
   - Step 1: Upload a PDF CV (e.g. `Anant-Kumar-Resume.pdf`).
   - Step 2: Observe discovered digital footprints (GitHub, LinkedIn, Portfolio). Confirm or edit handles.
   - Step 3–7: Verify that education, skills, projects, and target role are pre-filled without inferred dates or fake roles.
   - Step 8: Complete review and finish onboarding.
   - Immediate Dashboard (Stage A): Instant redirection to `/student` overview showing student name, target role, tracked skills, and projects.
   - Background Sync (Stage B): Check `/student/connections` to observe live sync statuses updating without page reloads.
3. **Test No-CV Path**:
   - Navigate to `/onboarding` in an incognito window.
   - Skip CV upload.
   - Manually select "Machine Learning Engineer", choose priority "Learn AI & ML", enter education details.
   - Complete onboarding.
   - Verify that the initial dashboard displays honest provisional states, 0 fake projects, and actionable learning recommendations.
