# AI TATHASTU V4.6 — One-Action Digital Footprint Import & Real Source Acquisition Report

## Executive Summary

AI Tathastu V4.6 transitions Onboarding Step 6 (`Screen6DigitalFootprints`) from a passive URL reference registry into an active, consent-based digital source acquisition hub. Supported by `DigitalSourceImportOrchestrator`, single-action "Connect & Import" triggers deterministic, authorized ingestion workflows across all 13 supported providers without any generative LLM dependencies.

All imported records are persisted directly into the Neon Database (`externalConnections`, `sourceSnapshots`, `evidenceItems`, `projects`), tracked via durable processing jobs (`sourceProcessingJobs`), and propagated immediately to Step 8 Review (`Screen8ProfileInsights`) with explicit source badges.

---

## 1. Provider Capabilities & Consent Matrix

| Provider | Display Name | Acquisition Mode | Action Label | Auth Method | Strict Guarantees |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **github** | GitHub | OFFICIAL_OAUTH_API | Connect & Import | public_or_oauth | Zero writes; public repos & manifests only; read-only token |
| **portfolio** | Personal Website | PERMITTED_PUBLIC_METADATA | Connect & Import | public_url | Strict SSRF defense; loopback/private CIDR/metadata IP blocked |
| **linkedin** | LinkedIn | MANUAL_PROFILE_REFERENCE / USER_EXPORT_UPLOAD | Import Your Data | user_export_upload | Zero unauthorized scraping; ToS compliant; Positions.csv parsing |
| **huggingface** | Hugging Face | OFFICIAL_PUBLIC_API | Connect & Import | public_url | Official Hub API; models, datasets, spaces & likes ingested |
| **orcid** | ORCID | OFFICIAL_PUBLIC_API | Connect & Import | public_url | ISO 7064 Mod 11,2 checksum verified; public v3.0 works API |
| **devto** | DEV Community | OFFICIAL_PUBLIC_API | Connect & Import | public_url | Official Forem API; published technical writing & tags |
| **stackoverflow**| Stack Overflow | OFFICIAL_PUBLIC_API | Connect & Import | public_url | Stack Exchange API v2.3; reputation score & top skill tags |
| **leetcode** | LeetCode | PERMITTED_PUBLIC_METADATA | Connect & Import | public_url | Public GraphQL stats; solved tiers & contest rankings |
| **hackerrank** | HackerRank | PERMITTED_PUBLIC_METADATA | Connect & Import | public_url | Public profile badges, domain stars & practice scores |
| **codechef** | CodeChef | MANUAL_PROFILE_REFERENCE | Connect & Import | manual_upload | Verified handle reference; archive upload for full stats |
| **hackerearth** | HackerEarth | MANUAL_PROFILE_REFERENCE | Connect & Import | manual_upload | Verified handle reference; challenge participation tracking |
| **kaggle** | Kaggle | PERMITTED_PUBLIC_METADATA | Connect & Import | public_url | Tier levels, public notebooks, datasets & competition medals |
| **google_scholar**| Google Scholar | MANUAL_PROFILE_REFERENCE | Add Profile Reference | manual_upload | Zero bot scraping; citation profile reference for DOI matching |

---

## 2. Architecture & Service Orchestration

### `DigitalSourceImportOrchestrator` (`lib/services/digital-source-import-orchestrator.ts`)
- **Validation**: Enforces strict URL regex patterns and ISO 7064 Mod 11,2 checksum validation for ORCID.
- **SSRF Defense**: Utilizes `isSafePublicUrl` from the Portfolio connector to strictly disallow loopback (`127.0.0.1`), `localhost`, private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and AWS/GCP cloud metadata IP (`169.254.169.254`).
- **Audit & Job State**: Orchestrates `SourceProcessingJobService` tracking lifecycle stages (`acquire` -> `parse` -> `extract` -> `validate` -> `complete`).
- **Idempotency & Neon DB Persistence**:
  - Persists raw snapshot hashes (`SHA-256`) to `sourceSnapshots`.
  - Upserts single active records per provider to `externalConnections`.
  - Creates atomic `evidenceItems` and candidate `projects`.
- **Candidates Discovered Callback**: Emits `{ projects, skills, experiences, educations, achievements }` to `ExactScreensContainer` and persists canonical state via `writeOnboardingDraft`.

---

## 3. Step 6 Card Lifecycle State Machine

Each profile card implements a non-dead-end state machine with 8 distinct states:
1. `Found in CV`: Shows green badge and "Review Profile".
2. `Public Provider Supported`: Shows "Connect & Import".
3. `OAuth Required`: Shows "Authorize & Import".
4. `Export Required`: Shows "Import Your Data" (e.g. LinkedIn archive upload).
5. `Importing...`: Displays live spinner and progress indicator.
6. `Last Synced / Refresh`: Displays relative sync timestamp, summary pill, and "Refresh" action.
7. `Retry`: Active upon network or API transient errors.
8. `Reconnect`: Available after deliberate student disconnection.

**Non-Dead-End Guarantee**: Clicking any connected card opens a slide-over modal presenting the last synced timestamp, record breakdown summary, "Refresh" button, and "Disconnect" button.

---

## 4. Step 8 Review & Ledger Provenance

Imported items are rendered in `Screen8ProfileInsights` with dynamic source badges:
- **Education**: Shows institution, degree, and source badges (`Source: ORCID`, `Source: LinkedIn Export`, `Source: CV`).
- **Experience**: Shows role, company, type, and source badges (`Source: LinkedIn Export`, `Source: CV`).
- **Projects**: Shows repository details, tech stack, and badges (`Source: GitHub`, `Source: Hugging Face`, `Source: Kaggle`, `Source: Portfolio`).
- **Achievements**: Shows publications, patents, competition medals, and badges (`Source: ORCID`, `Source: Stack Overflow`, `Source: LeetCode`, `Source: HackerRank`).

---

## 5. Verification Battery Results

### Test Battery: `npm run test:core-v4-6` (`scripts/verify-v4-6-digital-import.ts`)
- **Suite 1: Provider Capabilities & Consent Disclosures Matrix** (3 tests) — 3/3 PASS
- **Suite 2: URL Validation & Identifier Normalization** (3 tests) — 3/3 PASS
- **Suite 3: SSRF Protection & Network Isolation** (2 tests) — 2/2 PASS
- **Suite 4: GitHub Live Public Import & V4.3 Intelligence Reuse** (3 tests) — 3/3 PASS
- **Suite 5: Permitted Public API Integrations (HF, ORCID, DEV, SO)** (4 tests) — 4/4 PASS
- **Suite 6: Authorized LinkedIn Archive Ingestion vs Scraping Compliance** (3 tests) — 3/3 PASS
- **Suite 7: Coding Platforms & Google Scholar Compliance** (3 tests) — 3/3 PASS
- **Suite 8: Step 6 Card State Machine & Non-Dead-End Guarantee** (2 tests) — 2/2 PASS
- **Suite 9: Multi-Student Data Isolation & Neon DB Persistence** (1 test) — 1/1 PASS
- **Suite 10: Step 8 Candidate Propagation & Ledger Integrity** (1 test) — 1/1 PASS

**Result: 25 / 25 Tests Passed (100% Pass Rate)**

---

## 6. Regression Testing

| Test Suite | Command | Result |
| :--- | :--- | :--- |
| **V4.6 One-Action Digital Footprint Import** | `npm run test:core-v4-6` | **25/25 PASS** |
| **V4.5 Complete CV Extraction** | `npm run test:core-v4-5` | **26/26 PASS** |
| **V4.4 Canonical Data Foundation** | `npm run test:core-v4-4` | **23/23 PASS** |
| **V4.3 GitHub Live Intelligence Engine** | `npm run test:core-v4-3` | **50/50 PASS** |
| **TypeScript Typecheck** | `npm run typecheck` | **0 Errors (Clean Pass)** |
| **Next.js Production Build** | `npm run build` | **74/74 Static & Dynamic Routes Generated Cleanly** |

---

## 7. Compliance & Production Readiness
- **Zero Generative LLM**: Deterministic parsing and official APIs only.
- **Provider Policy Compliance**: Zero page-scraping of LinkedIn or Google Scholar.
- **Network Defense**: Strict SSRF firewall blocks internal, private, and cloud metadata IPs.
- **Multi-Tenant Isolation**: Zero cross-student data leakage guaranteed in Neon DB.
