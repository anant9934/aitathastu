# AI TATHASTU — PHASE DFI-1: EXISTING CODE AUDIT
**Date:** October 2026  
**Auditor:** Principal Full-Stack & Systems Architect  
**Scope:** Phase DFI-1 — Digital Footprint Intelligence Onboarding Integration  
**Repository Branch:** `feat/warm-cinematic-rollout`  

---

## 1. Executive Summary
This audit reports the pre-existing state of the AI Tathastu codebase prior to implementing Phase DFI-1 (Digital Footprint Intelligence), detailing what already existed, what was directly reused, what was extended, and what gaps required new engineering.

The application is built on **Next.js 15 (App Router)**, **React 19**, **TypeScript 5.7+**, **Tailwind CSS 4**, and **Neon PostgreSQL via Drizzle ORM / PGlite**. Prior to this phase, student onboarding contained 11 logical screens with an early CV upload at Step 4, followed by academic details and a basic manual accounts screen at Step 6. However, there was no automated link discovery from uploaded CVs, no deterministic entity-normalization bridge, no pre-fill confirmation screen immediately post-CV, and external data connectors were disparate without a unified acquisition contract.

---

## 2. Inventory of Existing Code & Infrastructure

### 2.1 Onboarding Architecture
* **Step Registry (`lib/onboarding-step-registry.ts`):**  
  * *Original State:* Defined `STUDENT_STEPS` as an 11-step array:
    1. `platform_role` (Screen 1)
    2. `aiml_direction` (Screen 2)
    3. `priorities` (Screen 3)
    4. `resume_upload` (Screen 5)
    5. `academic_details` (Screen 4)
    6. `digital_profiles` (Screen 6)
    7. `import` (Screen 7)
    8. `profile_review` (Screen 8)
    9. `skills_map` (Screen 9)
    10. `projects` (Screen 10)
    11. `finish` (Screen 11)
  * *Key Observation:* Screen numbers were historically mapped (`resume_upload` at screen 5, followed by `academic_details` at screen 4).
* **Flow State Machine (`lib/client/onboarding/use-onboarding-flow.ts`):**  
  * Managed client-side step progression with `order: [1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11]`.
  * Included navigation helpers `nextAfter(s)` and `prevBefore(s)`.
* **Draft State & Persistence (`lib/onboarding-draft-merge.ts`, `onboarding_drafts` table):**  
  * Handled JSON draft persistence with optimistic Compare-And-Swap (CAS) revision locking (`revision: number`).
  * Stored draft payload with arbitrary keys (`cvExtract`, `discoveredProfiles`, `selectedRole`, etc.).
* **EORA Guidance Engine (`lib/eora/context.ts`, `lib/eora/dialogue.ts`, `lib/eora/hinglish.ts`):**  
  * Provided contextual conversational cues per step with bilingual English / Hinglish support.

### 2.2 CV Extraction Pipeline
* **FastAPI Microservice (`services/resume-extractor/`):**  
  * Python 3.11 service utilizing PyMuPDF (`fitz`), Mammoth (.docx), and Tesseract OCR (`eng.traineddata`).
  * Extracted text, candidate skills, projects, and basic contact information.
* **TypeScript Ingestion Service (`lib/services/resume-ingestion-service.ts`):**  
  * `ResumeIngestionService.finalize()` handled raw text parsing, skill extraction, project candidate generation, and saved records to `source_snapshots` and `evidence_items`.
  * *Missing:* Did not extract or normalize embedded PDF hyperlink annotations (`/URI` dictionary), DOCX relationship targets (`w:hyperlink`), or multiline-wrapped profile links into structured footprint candidates.

### 2.3 External Connectors & Data Import
* **Connectors Directory (`lib/connectors/`):**
  * `github/client.ts`: Octokit and native fetch client for GitHub REST API (`/users/{username}`, `/users/{username}/repos`, `/repos/{owner}/{repo}/languages`, `/repos/{owner}/{repo}/readme`).
  * `portfolio/client.ts`: Server-side fetch with SSRF validation (`isSafePublicUrl`), Cheerio HTML parsing, meta tag extraction, and project card heuristics.
  * `huggingface/client.ts`: Basic API schema definitions.
  * `orcid/client.ts`: Schema structures for works.
  * `kaggle/client.ts`: Basic profile validator.
  * `linkedin/client.ts`: OAuth configuration placeholder without live session scraping (appropriately compliant).
* **Database Schema (`lib/db/schema.ts`):**
  * Pre-existing tables:
    * `external_connections`: Stored user/person connections with `provider`, `accountUsername`, `profileUrl`, `status`, `authType`.
    * `source_snapshots`: Stored raw JSON/HTML snapshots with `contentHash`, `provenance`, `snapshotData`.
    * `evidence_items`: Grounded student evidence items with `canonicalSkillId`, `evidenceCategory`, `sourceUrl`, `observedAt`.
    * `projects` & `project_contributions`: Project records linked to person ID.
    * `sync_runs` & `sync_operations`: Background sync records.

---

## 3. What Was Reused
1. **Neon PostgreSQL Schema & Drizzle ORM:** Reused `external_connections`, `source_snapshots`, `evidence_items`, `projects`, and `onboarding_drafts` tables without destructive migrations.
2. **SSRF Defense Engine (`lib/connectors/portfolio/client.ts`):** Leveraged DNS resolution, loopback blocking (`127.0.0.0/8`), private IPv4 CIDR blocking (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and AWS/GCP cloud metadata endpoint blocking (`169.254.169.254`).
3. **EORA Dialog & Bilingual Architecture:** Reused EORA card presentation, speech bubble tokens, and Hinglish dialogue structures.
4. **CAS Merge Logic (`lib/onboarding-draft-merge.ts`):** Preserved concurrent update safety during asynchronous background imports.
5. **Core V3 Intelligence Engine (`scripts/test-core-v3.ts`):** Preserved all 14 Core intelligence verification contracts without regressions.

---

## 4. What Was Missing (Implemented in Phase DFI-1)
1. **Deterministic CV Footprint Discovery Engine:**  
   * *Missing:* An extractor that takes raw CV text and embedded hyperlink targets and outputs validated, normalized platform profiles across 12+ providers without expensive or non-deterministic LLM hallucination.
   * *Solution:* Built `lib/services/digital-footprint-discovery.ts` with regex normalization, multiline unwrapping, and ISO 7064 Mod 11,2 checksum validation for ORCID.
2. **Dedicated Step 5 in Onboarding Wizard:**  
   * *Missing:* An interactive UI screen immediately post-CV allowing students to review CV-discovered links, confirm or remove them, add accounts manually, supply portfolio/research links, and provide explicit consent.
   * *Solution:* Built `components/onboarding/steps/FootprintIntelligenceStep.tsx` conforming to the Warm Cinematic visual design system.
3. **12-Step Sequence Orchestration:**  
   * *Missing:* The step registry was capped at 11 steps.
   * *Solution:* Inserted `digital_footprint_intelligence` at Screen 5.5, shifting the visual counter from 11 to 12 steps while preserving backward compatibility with existing drafts.
4. **Resilient Rate-Limit & Network Fallback:**  
   * *Missing:* GitHub API rate limits (HTTP 403/429) threw unhandled exceptions; offline portfolio domains caused fatal job errors.
   * *Solution:* Added non-blocking rate-limit detection in `lib/connectors/github/client.ts` and graceful fallback in `DigitalSourceImportOrchestrator` to mark items as `detected` with `partial: true` or `reference_only` without failing the onboarding session.
5. **Comprehensive Verification Suite:**  
   * *Missing:* End-to-end integration test verifying the 12-step flow, deterministic discovery, SSRF defense, real provider API queries, and Neon DB persistence.
   * *Solution:* Created `scripts/verify-digital-footprint-intelligence.ts` executing 20 acceptance assertions.
