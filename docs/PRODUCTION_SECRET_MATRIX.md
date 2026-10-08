# AI Tathastu — Production Secret Ownership & Rotation Matrix

**Document Version:** 1.0.0 (Phase E.2 Core Production Standard)  
**Security Classification:** Strict Enterprise Confidential  
**Compliance Standard:** Zero raw secrets in source code, build logs, or telemetry. Minimum 256-bit entropy.

---

## 1. Master Secret Ownership Matrix

| Secret Variable | Required For Core? | Environment | Stored Where | Rotation Owner | Rotation Procedure | Application Access |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **YES** | Staging / Prod | Vercel / Cloud Secrets | Lead DevOps | 1. Create new database role/password in Neon.<br>2. Update cloud secret.<br>3. Redeploy application.<br>4. Revoke old role after 24h. | Server-side `lib/db/index.ts` only |
| `SESSION_SECRET` | **YES** | Staging / Prod | Vercel / Cloud Secrets | Security Eng | 1. Generate 256-bit key via `npm run secrets:generate`.<br>2. Dual-key signing window (old key verifies, new key signs).<br>3. Deprecate old key after 7-day session TTL. | `lib/auth/server-session.ts` |
| `HANDOFF_SIGNING_SECRET` | **YES** | Staging / Prod | Vercel / Cloud Secrets | Security Eng | 1. Generate new 256-bit secret.<br>2. Synchronize secret update with partner gateway.<br>3. Verify 5-minute handoff token acceptance. | `lib/domain/handoff-tokens.ts` |
| `GITHUB_CLIENT_ID` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Org Admin | Update in GitHub Organization Settings → Developer settings → GitHub Apps. | `app/api/onboarding-v2/github` |
| `GITHUB_CLIENT_SECRET` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Org Admin | 1. Generate new client secret in GitHub App.<br>2. Update in hosting secrets manager.<br>3. Verify OAuth callback.<br>4. Delete old secret in GitHub. | `app/api/onboarding-v2/github/callback` |
| `GITHUB_WEBHOOK_SECRET`| **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Org Admin | 1. Update webhook secret in GitHub App settings.<br>2. Concurrently update hosting secret.<br>3. Verify ping webhook HTTP 200. | `app/api/integrations/github/webhook` |
| `STUDY_LPU_INTEGRATION_SECRET` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Academic IT | 1. Re-negotiate shared 256-bit key with university LMS IT.<br>2. Update in LMS outbound webhook config and Tathastu. | `app/api/integrations/study-lpu/events` |
| `PADHO_CODE_INTEGRATION_SECRET`| **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Platform IT | 1. Re-negotiate shared 256-bit key with coding platform team.<br>2. Update in webhook dispatcher and Tathastu. | `app/api/integrations/padho-code/events` |
| `ERIS_INTEGRATION_SECRET` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Assessment IT | 1. Issue new HMAC key through assessment authority.<br>2. Update in exam webhook dispatcher and Tathastu. | `app/api/integrations/eris/events` |
| `MENTORMAZE_INTEGRATION_SECRET`| **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Interview IT | 1. Issue new HMAC key through mock interview engine.<br>2. Update in interview webhook dispatcher and Tathastu. | `app/api/integrations/mentormaze/events` |
| `GEMINI_API_KEYS` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | AI Platform Eng | 1. Create new API key in Google AI Studio / GCP Console.<br>2. Update secret in hosting dashboard.<br>3. Delete old key. | `lib/ai/gemini-adapter.ts` |
| `GROQ_API_KEYS` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | AI Platform Eng | 1. Create new API key in Groq console.<br>2. Update secret in hosting dashboard.<br>3. Revoke old key. | `lib/ai/groq-adapter.ts` |
| `UPSTASH_REDIS_REST_URL` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Cloud Infra | Copy from Upstash console. | `lib/security/rate-limit.ts` |
| `UPSTASH_REDIS_REST_TOKEN` | **NO (Optional)** | Staging / Prod | Vercel / Cloud Secrets | Cloud Infra | 1. Rotate token in Upstash dashboard.<br>2. Update hosting secret.<br>3. Verify fail-safe memory limiter fallback during switch. | `lib/security/rate-limit.ts` |

---

## 2. Core Launch vs. Ecosystem Separation

To ensure AI Tathastu Core can deploy safely to public production without waiting on third-party organizations:
- **Core Production Required:** Only `DATABASE_URL`, `SESSION_SECRET`, and `HANDOFF_SIGNING_SECRET` are strictly required.
- **Ecosystem Feature-Flagged:** All other secrets (`GITHUB_*`, `STUDY_LPU_*`, `PADHO_CODE_*`, `ERIS_*`, `MENTORMAZE_*`, `GEMINI_*`) are optional.
- If an optional secret is omitted, its corresponding feature flag (`ENABLE_*_LIVE`) remains `false`, and the platform gracefully disables or uses deterministic fallbacks without failing startup or health probes.

---

## 3. Secret Validation & Startup Auditing

The application validates secrets using `auditProductionSecrets()` ([`lib/security/production-secrets.ts`](file:///Users/quantumanant/aitathastu/lib/security/production-secrets.ts)):
- Validates minimum length of 32 characters (256-bit entropy).
- Strictly rejects default development placeholders (`dev-insecure-secret`, `default_test_key`, etc.).
- Never prints secret values to logs, standard output, or HTTP response payloads.
