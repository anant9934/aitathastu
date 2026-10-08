# AI Tathastu — Public Core Production Deployment Checklist

**Document Version:** 1.0.0 (Public Core GA Checklist)  
**Target Environment:** Production Public Core Launch (`https://aitathastu.io`)  
**Scope:** Core AI Tathastu Platform (Autonomous of Partner Ecosystem)  

---

## Pre-Deployment Verification Checklist

### 1. Database Persistence
- [x] **Hosted PostgreSQL Transport:** Neon Serverless HTTP driver over port 443 verified; zero TCP port 5432 dependencies.
- [x] **Schema Migration:** All 17 normalized relational tables migrated via Drizzle ORM.
- [x] **Persistence Across Restarts:** Verified via `scripts/test-production-persistence.ts`. Real user, goal, evidence, and journey records persist on remote Neon database across process cache flushes.
- [x] **Production PGlite Prohibition:** `DATABASE_MODE=postgres` or `NODE_ENV=production` strictly enforces real PostgreSQL; silent fallback to PGlite is blocked.
- [x] **Concurrency & Integrity:** 5 simultaneous student lifecycles verified via `scripts/test-concurrent-db.ts` with zero race conditions.

### 2. Secret Provisioning & Audit
- [x] **256-bit Entropy:** Generated via `npm run secrets:generate` using `crypto.randomBytes(32)`.
- [x] **Cloud Secrets Storage:** Core secrets (`DATABASE_URL`, `SESSION_SECRET`, `HANDOFF_SIGNING_SECRET`) managed via Vercel/Cloudflare Secrets.
- [x] **Zero Secret Leakage:** Checked and confirmed via `npm run integrations:status` and automated secret audit.
- [x] **Startup Audit:** `auditProductionSecrets()` rejects development defaults in production mode.

### 3. HTTPS & Edge Security
- [x] **Strict TLS 1.3:** Managed by edge reverse proxy (Cloudflare/Vercel).
- [x] **HTTP → HTTPS Redirect:** Enforced at edge.
- [x] **Security Headers:** CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [x] **Origin & CSRF Defense:** Validates origin and referer headers on mutating routes (`POST`, `PUT`, `DELETE`).

### 4. Production-Grade Cookies & Session
- [x] **HttpOnly:** Client-side JavaScript cannot access session tokens.
- [x] **Secure:** Cookie transmitted strictly over HTTPS in production.
- [x] **SameSite=Lax:** Prevents cross-site request forgery attacks while preserving safe top-level navigations.
- [x] **Session TTL:** 7-day expiration with cryptographic HMAC-SHA256 signature verification.

### 5. Rate Limiting & Abuse Defense
- [x] **Tiered Limits:** Auth (10 req/15min), AI/LLM (15 req/1min), Resume Upload (5 req/1min), General (100 req/1min).
- [x] **Distributed Engine:** Upstash Redis REST pipeline supported.
- [x] **Fail-Safe Fallback:** Redis outages instantly trigger in-memory token bucket; sensitive endpoints never fail open.
- [x] **Privacy Preservation:** Keys use opaque identifiers (`rl:{tier}:{orgId}:{opaquePersonId}`).

### 6. Health & Readiness Observability
- [x] **Liveness Probe (`/api/health`):** HTTP 200 `{ status: "ok" }`.
- [x] **Readiness Probe (`/api/ready`):** Deep PostgreSQL connection test with 3000ms fail-fast timeout race.
- [x] **Operational Status Probe (`/api/internal/integrations-status`):** Protected administrative probe for partner health.
- [x] **Structured Logging:** JSON logs with `x-correlation-id`, service tag, route, and recursive secret masking.

### 7. Backup & Disaster Recovery
- [x] **Logical Backup & Restore:** `npm run test:restore` passes in 1214ms with 100% data fidelity and 0 orphaned foreign keys.
- [x] **Hosted Cloud Backup:** Neon PITR documented and supported.

### 8. Core Student Workflows
- [x] **Landing Page & Authentication:** Signup, login, timing-safe bcrypt password comparison.
- [x] **Onboarding Flow:** Academic background, career goal selection, initial profile setup.
- [x] **Resume Ingestion:** 5MB limit, magic byte validation, in-memory parsing, unverified evidence staging.
- [x] **Person 360 & Person Graph:** Multi-tenant isolation; verified vs self-reported skill separation.
- [x] **Deterministic Roadmap:** Arithmetic stage transitions based on verified evidence; zero LLM authority over readiness scores.
- [x] **What Matters Now:** Top 3 explainable next action cards.

### 9. AI Resilience & Deterministic Fallback
- [x] **Multi-Provider Architecture:** Pluggable Gemini, Groq, OpenRouter adapters.
- [x] **Context Firewall:** PII scrubbing before external LLM dispatch.
- [x] **Prompt Boundary Framing:** Untrusted user input enclosed in `<untrusted_content>` tags.
- [x] **No-LLM Fallback:** System functions with 100% feature completeness if LLM keys are absent or API times out.

### 10. Ecosystem Feature Flags
- [x] `ENABLE_GITHUB_LIVE=false` (gated until GitHub App registration in Phase F).
- [x] `ENABLE_STUDY_LPU_LIVE=false` (gated until university LMS hookup in Phase G).
- [x] `ENABLE_PADHO_CODE_LIVE=false` (gated until coding platform hookup in Phase G).
- [x] `ENABLE_ERIS_LIVE=false` (gated until assessment platform hookup in Phase G).
- [x] `ENABLE_MENTORMAZE_LIVE=false` (gated until interview platform hookup in Phase G).
- [x] **UI Truthfulness:** Connections page displays "Coming later" or "Reference only"; zero fake "Connected" badges.

### 11. Rollback Protocol
- [x] **Application Rollback:** Instant immutable deployment rollback via hosting dashboard CLI.
- [x] **Schema Compatibility:** Non-destructive additive DDL migrations ensure previous deployment version functions against current database schema.
