# AI TATHASTU — PRODUCTION DEPLOYMENT & OPERATIONS RUNBOOK

**Document Version**: 1.0.0 (Phase F Certification)  
**Status**: Operations & Health Monitoring Runbook Certified  
**Verification Date**: October 2026  

---

## 1. Production Architecture Overview

- **Frontend & API Gateway**: Next.js 15 App Router running Node.js 22 LTS.
- **Database**: Remote Neon PostgreSQL serverless instance (Port 443 / HTTPS HTTP Transport).
- **ORM & Migrations**: Drizzle ORM with SQL migration runner (`scripts/migrate.ts`).
- **Intelligence Layer**: Multi-provider router with zero-LLM deterministic fallback.
- **Task Worker**: In-process background queue (`lib/jobs/queue.ts`) with exponential backoff and idempotency.

---

## 2. Health & Readiness Probes

### Liveness Probe (`GET /api/health`)
- **Purpose**: Verifies that the HTTP server is responsive and accepting traffic.
- **Expected Status**: `200 OK`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-08T18:45:05.464Z",
    "uptime": 1235,
    "version": "0.1.0"
  }
  ```

### Readiness Probe (`GET /api/ready`)
- **Purpose**: Verifies end-to-end connectivity to the remote Neon PostgreSQL database and schema validation before routing user traffic.
- **Expected Status**: `200 OK`
- **Response Format**:
  ```json
  {
    "status": "ready",
    "timestamp": "2026-10-08T18:45:08.215Z",
    "checks": {
      "database": "connected",
      "schema": "verified"
    },
    "durationMs": 2552
  }
  ```

---

## 3. Environment Variable Provisioning

The following environment variables must be securely populated in the production environment:

| Variable Name | Required | Purpose | Production Setting / Restriction |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | Remote Neon PostgreSQL Connection String | `postgresql://<user>:<pwd>@<endpoint>.neon.tech/neondb?sslmode=require` |
| `DATABASE_TRANSPORT` | **Yes** | Transport protocol for serverless queries | `neon-http` |
| `DATABASE_MODE` | **Yes** | Database driver mode | `postgres` (PGlite prohibited in production) |
| `SESSION_SECRET` | **Yes** | Session cookie signing secret | Minimum 256-bit cryptographically secure string |
| `ENCRYPTION_KEY` | **Yes** | Sensitive token encryption key | Minimum 32-byte hexadecimal string |
| `NODE_ENV` | **Yes** | Node runtime environment | `production` |
| `GEMINI_API_KEY` | Optional | Google Gemini 1.5 Flash Provider | Server-side secret; fallback active if absent |
| `GROQ_API_KEY` | Optional | Groq Llama 3.3 70B Provider | Server-side secret; fallback active if absent |
| `GITHUB_APP_CLIENT_ID` | Optional | Authorized GitHub App Client ID | Client ID for OAuth flow |
| `GITHUB_APP_CLIENT_SECRET`| Optional | Authorized GitHub App Secret | Server-side OAuth secret |
| `GITHUB_WEBHOOK_SECRET` | Optional | Secret for GitHub Webhook validation | HMAC SHA-256 verification secret |

---

## 4. Deployment Steps & Rollback Procedures

### Standard Production Deployment
```bash
# 1. Install dependencies
npm ci

# 2. Run automated validation gates
npm run lint
npm run typecheck
npm test

# 3. Apply remote database migrations
npm run db:migrate

# 4. Compile optimized production bundle
npm run build

# 5. Start production server
npm start
```

### Emergency Rollback Procedure
1. **Container / Code Rollback**: Redeploy the previous stable container image or git tag.
2. **Database Reversibility**: All migrations in `lib/db/migration-sql.ts` are strictly additive and non-destructive. Rollbacks do not require schema destruction.
3. **Backup Restoration**:
   - Point-in-time recovery is managed natively via Neon's branching and WAL-based point-in-time recovery.
   - Verified via `npm run test:restore`.

---

## 5. Operations & Incident Response

- **Database Disconnection**: If Neon times out, `/api/ready` returns `503 Service Unavailable`, preventing traffic routing until the connection recovers.
- **Provider Outage**: If external LLM providers return 429 or 5xx, the router automatically fails over to the deterministic rule engine without student disruption.
- **Stuck Jobs**: The queue watchdog cancels background jobs running beyond $1.5\times$ their timeout.
