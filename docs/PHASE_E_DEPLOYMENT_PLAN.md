# AI Tathastu — Phase E Production Deployment Plan & Operational Runbook

**Document Version:** 1.0.0 (Phase E Public Production Closure)  
**Target Environments:** Development, Staging (Pilot), Production (GA)  
**Security Baseline:** Zero secrets in source control, strict HTTPS, cryptographic authorization, distributed abuse defense.

---

## 1. System Architecture & Topology

AI Tathastu is deployed as an enterprise-grade Next.js (App Router) application backed by PostgreSQL with an abstraction layer supporting managed serverless PostgreSQL (Neon) and embedded PostgreSQL (PGlite).

```
                      [ HTTPS Client / Browser / Mobile ]
                                      │
                                      ▼
                        [ Cloudflare / CDN Edge ]
                   (Strict TLS 1.3, DDoS Mitigation)
                                      │
                                      ▼
                      [ Next.js Serverless Runtime ]
      ┌──────────────────────────────────────────────────────────────┐
      │  Security Middleware:                                        │
      │  - Origin / CSRF Defense (`lib/security/csrf.ts`)            │
      │  - SSRF Resolver Guard (`lib/security/ssrf.ts`)              │
      │  - Distributed Rate Limiter (`lib/security/rate-limit.ts`)   │
      │    (Memory fallback + Distributed Redis Backend)             │
      │  - Context Firewall & Prompt Injection Defense               │
      └──────────────────────────────┬───────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [ Relational DB ]       [ Redis Distributed ]     [ External Ecosystem ]
  - Neon PostgreSQL        - Upstash / Valkey        - GitHub OAuth & App
  - Drizzle ORM Pooler     - Atomic token sliding    - Study LPU (Academic)
  - Multi-tenant isolation   window & abuse blocks   - Padho Code (Practice)
  - PITR & Logical Archive                           - ERIS (Verified Assessment)
                                                     - MentorMaze (Interview)
                                                     - Multi-LLM / Deterministic
```

---

## 2. Deployment Environments & Domain Separation

| Attribute | Development (`dev`) | Staging (`staging`) | Production (`prod`) |
| :--- | :--- | :--- | :--- |
| **Primary Domain** | `http://localhost:3000` | `https://staging.aitathastu.io` | `https://aitathastu.io` |
| **Database** | Local PGlite / Dev Postgres | Isolated Neon Staging DB Branch | High-Availability Neon DB Cluster |
| **Data Scope** | Synthetic mocks & test fixtures | Anonymous test cohort (10–50 students) | Real verified student cohorts |
| **Distributed Cache** | In-Memory Token Bucket | Upstash Redis (Staging Namespace) | Upstash Redis (Production Cluster) |
| **GitHub App** | Dev Test App | `ai-tathastu-staging` | `ai-tathastu-production` |
| **Partner Webhooks** | Simulated Dev Keys | Staging Shared HMAC Keys | Hardware/KMS Rotated HMAC Keys |
| **LLM Tier** | Mock / Deterministic Fallback | Staging Quota (50k tokens/user/day) | Enterprise Tiered Quota |

---

## 3. Required Credentials & Secret Ownership Matrix

All production secrets are provisioned via cloud secrets management (e.g. Vercel Secrets, Doppler, AWS SSM). No secrets are stored in Git or exposed to client-side bundles.

| Environment Variable | Classification | Purpose | Owner / Rotation |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **REQUIRED** | PostgreSQL connection string with SSL pooler | Lead DevOps / 90 days |
| `SESSION_SECRET` | **REQUIRED** | AES-256 HMAC secret for HTTP-only cookies | Security Eng / 90 days |
| `HANDOFF_SIGNING_SECRET` | **REQUIRED** | Signs short-lived cross-app navigation tokens | Security Eng / 90 days |
| `GITHUB_CLIENT_ID` | **REQUIRED** | GitHub App client ID | GitHub Org Admin |
| `GITHUB_CLIENT_SECRET` | **REQUIRED** | GitHub App client secret | GitHub Org Admin / 180 days |
| `GITHUB_WEBHOOK_SECRET` | **REQUIRED** | HMAC-SHA256 signature for GitHub webhooks | GitHub Org Admin / 90 days |
| `STUDY_LPU_INTEGRATION_SECRET` | **REQUIRED** | Shared secret for Study LPU learning events | Academic IT / 90 days |
| `PADHO_CODE_INTEGRATION_SECRET` | **REQUIRED** | Shared secret for Padho Code practice events | Practice Platform / 90 days |
| `ERIS_INTEGRATION_SECRET` | **REQUIRED** | Shared secret for ERIS assessment events | Verification Authority / 90 days |
| `MENTORMAZE_INTEGRATION_SECRET` | **REQUIRED** | Shared secret for MentorMaze interview events | Interview Platform / 90 days |
| `UPSTASH_REDIS_REST_URL` | **OPTIONAL** | Distributed rate limiter HTTP endpoint | Cloud Infrastructure |
| `UPSTASH_REDIS_REST_TOKEN` | **OPTIONAL** | Distributed rate limiter authorization token | Cloud Infrastructure |
| `GEMINI_API_KEYS` | **OPTIONAL** | Primary Google Gemini LLM API keys | AI Eng / 90 days |
| `GROQ_API_KEYS` | **OPTIONAL** | Secondary Groq fast inference keys | AI Eng / 90 days |

---

## 4. Public Callbacks & Webhook URL Endpoints

### GitHub Integration:
- **Authorization Callback:** `https://<domain>/api/onboarding-v2/github/callback`
- **Webhook Ingestion:** `https://<domain>/api/integrations/github/webhook`
- **Permitted Scopes:** `read:user`, `repo:status` (Strictly read-only; zero write or admin scopes).

### First-Party Partner Webhook Ingestion Endpoints:
- **Study LPU:** `POST https://<domain>/api/integrations/study-lpu/events`
- **Padho Code:** `POST https://<domain>/api/integrations/padho-code/events`
- **ERIS Assessment:** `POST https://<domain>/api/integrations/eris/events`
- **MentorMaze Interview:** `POST https://<domain>/api/integrations/mentormaze/events`
- **Common Cross-App Handoff:** `GET https://<domain>/api/student/handoff`

---

## 5. Distributed Rate Limiter Architecture & Fail-Safe Protocol

1. **Interface Contract:** Standard `RateLimiterBackend` supporting atomic increment, sliding windows, and TTL management.
2. **Backends:**
   - `MemoryRateLimiter`: Zero-dependency local sliding window used in unit tests and local development.
   - `DistributedRedisRateLimiter`: Multi-instance Redis store using atomic timestamp sliding windows.
3. **Fail-Safe Fallback:**
   - **Critical / Sensitive Endpoints** (`auth`, `ai`, `sync`, `resume`): If Redis fails or times out (>500ms), the system falls back to strict in-memory token limits per instance. Requests are **never** permitted to bypass rate limiting.
   - **General / Read Endpoints** (`general`, `webhook`): Logged as degraded; falls back to instance-level rate limit.
4. **Key Format:**
   - `rl:{tier}:{orgId}:{opaquePersonId}` or `rl:{tier}:ip:{clientIp}`.
   - Raw user emails are **never** used as rate limit keys.

---

## 6. Staging & Production Deployment Sequences

### Staging Verification Sequence (Step-by-Step):
1. **Infrastructure Provisioning:**
   - Create isolated Neon branch `staging-preview`.
   - Provision Upstash Redis database `tathastu-staging`.
2. **Environment Secret Injection:**
   - Generate secure random secrets via `npm run secrets:generate`.
   - Load `.env.staging` into deployment environment.
3. **Database Migration:**
   - Run `npm run db:migrate` against staging database.
   - Verify all 17 tables, indexes, and initial organization entities exist.
4. **Verification Probes:**
   - Query `GET /api/health` -> verify HTTP 200 `{ status: "ok" }`.
   - Query `GET /api/ready` -> verify HTTP 200 `{ status: "ready", checks: { database: "connected" } }`.
5. **Cross-App Closed Loop Drill:**
   - Execute synthetic ML Engineer student onboarding.
   - Emit signed events from Study LPU, Padho Code, ERIS, and MentorMaze.
   - Verify Person Graph, Skill Evidence Graph, and Roadmap update correctly.

### Production Promotion Sequence:
1. **Pre-flight Gate:**
   - 100% of automated tests pass (`npm test`).
   - Clean lint, typecheck, and production build (`npm run build`).
   - Backup/restore automated test passes (`npm run test:restore`).
2. **Maintenance Window / Zero-Downtime Rollout:**
   - Set deployment environment variables.
   - Apply schema migrations forward (`npm run db:migrate`).
   - Deploy Next.js serverless build with canary / blue-green traffic split.
3. **Post-Deployment Smoke Tests:**
   - Check `/api/health` and `/api/ready`.
   - Test login and session cookie attributes (`Secure`, `HttpOnly`, `SameSite=Lax`).
   - Monitor operational health logs via `GET /api/health`.

---

## 7. Rollback & Disaster Recovery Plan

1. **Application Code Rollback:**
   - Next.js / Vercel: Instant rollback to previous immutable deployment artifact via deployment dashboard or CLI (`vercel rollback`).
2. **Database Schema Rollback:**
   - All migrations are designed to be backward-compatible (non-destructive additive changes).
   - If a schema defect is detected, rollback migration scripts in `docs/BACKUP_AND_RECOVERY.md` are executed.
3. **Database State Recovery:**
   - Continuous Point-in-Time Recovery (PITR) allows rolling back Neon storage to any specific second within the 14-day retention window.
   - Daily logical JSON archives stored securely in object storage.
