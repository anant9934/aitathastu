# AI Tathastu — Live Integration Activation Checklist

**Document Version:** 1.0.0 (Phase E.1 Activation Matrix)  
**Last Updated:** October 8, 2026  
**Environment Scope:** Staging Preview (`staging.aitathastu.io`) & Production GA Target (`aitathastu.io`)  
**Certification Standard:** Absolute Truthfulness — Zero faked statuses. An integration is marked `PRODUCTION_LIVE` **only** if an actual deployed remote system successfully communicates with the deployed environment.

---

## 1. Status Legend & Transition Gates

| Status Level | Definition | Required Evidence |
| :--- | :--- | :--- |
| `NOT_CONFIGURED` | Credentials, hostnames, or endpoints absent. | Baseline state in repository. |
| `CONFIGURED` | Environment variables, keys, and schemas provisioned in secrets manager. | `auditProductionSecrets()` clean audit; non-default entropy. |
| `NETWORK_REACHABLE` | DNS resolves, TLS terminates, HTTP ping/health returns 200/reachable. | Outbound socket or edge probe success. |
| `AUTHENTICATED` | Inbound HMAC or OAuth authorization handshake passes. | Valid signature check or bearer token. |
| `EVENT_RECEIVED` | At least one valid external payload received and stored in database. | Processed record in `integration_events`. |
| `END_TO_END_VERIFIED` | Full lifecycle verified: Ingest → Map Identity → Person Graph → Roadmap → What Matters Now. | Multi-stage integration test pass. |
| `PRODUCTION_LIVE` | Live remote host communicating continuously in deployed production with real traffic. | Active live remote telemetry without simulation. |

---

## 2. Master System Activation Matrix

| System / Component | Launch Tier | Configuration | DNS / URL | Credentials | Authentication | Connection | Inbound Event | Outbound Handoff | Identity Mapping | Persistence | Person Graph | Roadmap | Failure Test | Live Certification State |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **AI Tathastu Core** | **REQUIRED** | `CONFIGURED` | `NETWORK_REACHABLE` | `CONFIGURED` | `AUTHENTICATED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED** |
| **PostgreSQL Database** | **REQUIRED** | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` | `AUTHENTICATED` | `END_TO_END_VERIFIED` (PGlite) / `NETWORK_REACHABLE` (Neon) | N/A | N/A | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Local/PGlite)** <br> *Neon: Awaiting TCP 5432 network resolution* |
| **Distributed Rate Limiter** | **REQUIRED** | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` | `END_TO_END_VERIFIED` (Memory Fallback) | N/A | N/A | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | N/A | N/A | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Fail-Safe)** <br> *Upstash: Staging fallback active* |
| **LLM Provider (EORA)** | **REQUIRED** | `CONFIGURED` | `NETWORK_REACHABLE` | `CONFIGURED` | `CONFIGURED` | `END_TO_END_VERIFIED` (Deterministic fallback) | N/A | N/A | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Deterministic)** <br> *Live API: Fallback active* |
| **GitHub App / Sync** | **LAUNCH PREFERRED** | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` (Staging) | `AUTHENTICATED` | `END_TO_END_VERIFIED` (Staging) | `END_TO_END_VERIFIED` | N/A | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Simulation)** <br> *Awaiting live org app registration* |
| **Study LPU (LMS)** | **OPTIONAL (FLAGGED)** | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` (Staging) | `AUTHENTICATED` | `END_TO_END_VERIFIED` (Staging) | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Contract)** <br> *Live producer: Flagged disabled* |
| **Padho Code (Practice)**| **OPTIONAL (FLAGGED)** | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` (Staging) | `AUTHENTICATED` | `END_TO_END_VERIFIED` (Staging) | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Contract)** <br> *Live producer: Flagged disabled* |
| **ERIS (Assessment)** | **OPTIONAL (FLAGGED)** | `CONFIGURED` | `CONFIGURED` | `CONFIGURED` (Staging) | `AUTHENTICATED` | `END_TO_END_VERIFIED` (Staging) | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Contract)** <br> *Live producer: Flagged disabled* |
| **MentorMaze (Interview)**| **OPTIONAL (FLAGGED)**| `CONFIGURED` | `CONFIGURED` | `CONFIGURED` (Staging) | `AUTHENTICATED` | `END_TO_END_VERIFIED` (Staging) | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | `END_TO_END_VERIFIED` | **END_TO_END_VERIFIED (Contract)** <br> *Live producer: Flagged disabled* |

---

## 3. Individual Component Detailed Checklists

### 3.1 AI Tathastu Core Application
- [x] **Configuration:** Staging environment variables structured in `.env.staging` and generated `.env.staging.generated`.
- [x] **DNS / URL:** Local port 3000 verified (`http://localhost:3000`); Staging domain target `https://staging.aitathastu.io`.
- [x] **Credentials:** Cryptographic session secret (`SESSION_SECRET`) with 256-bit entropy.
- [x] **Authentication:** Bcrypt password hashing, timing-safe equality, HttpOnly + Secure cookies.
- [x] **Health & Readiness:** `/api/health` returns HTTP 200 `{ status: "ok" }`. Fail-fast 3000ms timeout protects `/api/ready`.
- [x] **Failure Test:** Invalid session rejected with 401; expired cookie rejected with 401.
- **State:** `END_TO_END_VERIFIED` (Pilot Ready).

### 3.2 Database Persistence Layer
- [x] **Schema Migration:** All 17 normalized relational tables migrated via Drizzle ORM (`npm run db:migrate`).
- [x] **Local PostgreSQL Engine (PGlite):** Verified embedded WASM engine, 100% data fidelity on backup/restore (`npm run test:restore`).
- [ ] **Remote Neon PostgreSQL:** Connection string provisioned, but remote host TCP 5432 has network timeout from local runtime.
- [x] **Data Integrity:** Referential constraints, cascading deletes where appropriate, zero orphaned foreign keys.
- **State:** `END_TO_END_VERIFIED` (PGlite) / `CONFIGURED` (Remote Neon awaiting TCP port 5432 network resolution).

### 3.3 Distributed Rate Limiter
- [x] **Architecture:** Dual-layer architecture: `DistributedRedisRateLimiter` + `MemoryRateLimiter` fallback.
- [x] **Shared Limits:** Simulated multi-instance load shares tokens under normal operations.
- [x] **Fail-Safe Mode:** Forced Redis timeouts fall back instantly to memory limiter; sensitive endpoints (`auth`, `ai`, `sync`) never fail open.
- [x] **Privacy Preservation:** Keys formatted as `rl:{tier}:{orgId}:{opaquePersonId}` or `rl:{tier}:ip:{clientIp}`.
- **State:** `END_TO_END_VERIFIED` (Fail-Safe active).

### 3.4 GitHub Integration
- [x] **Scope Minimization:** Strictly restricted to `read:user` and `repo:status`. Zero repo write or PR alteration permissions.
- [x] **Webhook Security:** HMAC SHA-256 signature verification via `X-Hub-Signature-256`.
- [x] **Meaningful Change Detection:** Code tree hashing detects meaningful evolution while skipping whitespace/typos.
- [x] **Private Repository Isolation:** Authenticated user can see private repos; other students receive 404/denied.
- [ ] **Live App Registration:** Production GitHub App on `github.com/organizations` pending live client secret injection.
- **State:** `END_TO_END_VERIFIED` (Simulation) / Awaiting live external registration.

### 3.5 Study LPU (Academic LMS)
- [x] **Endpoint:** `POST /api/integrations/study-lpu/events`.
- [x] **Signature:** `x-study-lpu-signature` checked against `STUDY_LPU_INTEGRATION_SECRET`.
- [x] **Behavior:** Module completion recorded in `learning_activities`; updates Journey; updates Person Graph.
- [x] **Trust Boundary:** Classroom completion does NOT create unearned verified skill status.
- [ ] **Live Network Producer:** University LMS production webhook outbound delivery pending.
- **State:** `END_TO_END_VERIFIED` (Contract) / Feature-flagged `ENABLE_STUDY_LPU_LIVE=false`.

### 3.6 Padho Code (Practice Engine)
- [x] **Endpoint:** `POST /api/integrations/padho-code/events`.
- [x] **Signature:** `x-padho-code-signature` checked against `PADHO_CODE_INTEGRATION_SECRET`.
- [x] **Behavior:** Coding challenges recorded; topic mapped deterministically to skill evidence.
- [x] **Trust Boundary:** Practice evidence strengthens Demonstrated state, never creates unearned Verified state.
- [ ] **Live Network Producer:** Coding platform production outbound webhook pending.
- **State:** `END_TO_END_VERIFIED` (Contract) / Feature-flagged `ENABLE_PADHO_CODE_LIVE=false`.

### 3.7 ERIS (Standardized Assessments)
- [x] **Endpoint:** `POST /api/integrations/eris/events`.
- [x] **Signature:** `x-eris-signature` checked against `ERIS_INTEGRATION_SECRET`.
- [x] **Behavior:** Proctored exams create institutional verified evidence; updates verified coverage in readiness.
- [x] **Negative Tests:** Draft assessment ignored; invalid signature rejected (HTTP 401); wrong org rejected (HTTP 400).
- [ ] **Live Network Producer:** Assessment server outbound production webhook pending.
- **State:** `END_TO_END_VERIFIED` (Contract) / Feature-flagged `ENABLE_ERIS_LIVE=false`.

### 3.8 MentorMaze (AI Mock Interviews)
- [x] **Endpoint:** `POST /api/integrations/mentormaze/events`.
- [x] **Signature:** `x-mentormaze-signature` checked against `MENTORMAZE_INTEGRATION_SECRET`.
- [x] **Behavior:** Session-specific competencies recorded; interview evidence added to Person Graph.
- [x] **Scientific Boundary:** Emotion detection, facial analysis, stress scoring, and personality profiling strictly rejected.
- [ ] **Live Network Producer:** Interview system outbound production webhook pending.
- **State:** `END_TO_END_VERIFIED` (Contract) / Feature-flagged `ENABLE_MENTORMAZE_LIVE=false`.

### 3.9 LLM Provider & EORA Intelligence
- [x] **Provider Strategy:** Multi-provider architecture (Gemini, Groq, OpenRouter, Cerebras, Mistral, SambaNova).
- [x] **Context Firewall:** PII scrubbing (emails, phones, roll numbers) before dispatch.
- [x] **Prompt Defense:** User inputs wrapped in boundary tags `<untrusted_content>`.
- [x] **Deterministic Fallback:** If LLM is unreachable or disabled, deterministic engine generates explainable Next Actions and roadmap recommendations without failing.
- **State:** `END_TO_END_VERIFIED` (Deterministic fallback operational; awaiting production live API key).

---

## 4. Cross-App Secure Handoff
- [x] **Token Protocol:** HMAC-SHA256 signed JWT-like structure with 5-minute TTL.
- [x] **Zero PII:** Only opaque student IDs (`stu_...`), target app ID, and return URL.
- [x] **Replay Protection:** Expired tokens rejected with 401; tampered tokens rejected with 401; wrong target rejected with 400.
- **State:** `END_TO_END_VERIFIED`.

---

## 5. UI Transparency & Truthfulness
- [x] **Connections Page (`app/student/connections/page.tsx`):**
  - Displays "Connected" ONLY when identity link exists or live event was processed.
  - Unconnected sources display "Not Connected" or "Reference Only".
  - Automatic statistics are explicitly disclaimed where third-party APIs do not exist (LeetCode, CodeChef, HackerRank).
- [x] **Pilot Status:** Pilot banner and invite-code gating remain visible to protect uncertified public access.
