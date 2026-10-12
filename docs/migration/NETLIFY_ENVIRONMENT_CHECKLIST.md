# AI TATHASTU — NETLIFY ENVIRONMENT VARIABLE CHECKLIST

## Instructions
Set these in the Netlify dashboard: Site Settings → Environment Variables.
DO NOT commit actual secrets to git.
Use "Scopes: All scopes" unless marked otherwise.
Use "Values: Same value for all deploy contexts" unless marked as preview/production only.

---

## Category 1: Core Application (REQUIRED IN ALL CONTEXTS)

| Variable | Type | Example Value | Notes |
|---|---|---|---|
| `DATABASE_URL` | Server-side secret | `postgresql://user:pass@host/db?sslmode=require` | Neon production connection string |
| `APP_BASE_URL` | Runtime config | `https://www.aitathastu.com` | Canonical URL — must match Google OAuth redirect URI |
| `DATABASE_AUTO_MIGRATE` | Runtime config | `false` | MUST be false in production on Netlify |
| `NODE_ENV` | Build-time | `production` | Set automatically by Netlify; explicit override if needed |
| `HANDOFF_SIGNING_SECRET` | Server-side secret | `[64+ char random hex]` | Required for partner app handoff tokens |

---

## Category 2: Authentication (REQUIRED)

| Variable | Type | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Server-side secret | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Server-side secret | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | Server-side secret | GitHub OAuth (for student Digital Footprint) |
| `GITHUB_CLIENT_SECRET` | Server-side secret | GitHub OAuth |
| `GITHUB_WEBHOOK_SECRET` | Server-side secret | GitHub webhook verification |

**IMPORTANT — Google OAuth Redirect URI:**
After deploying to Netlify, add these to Google Cloud Console → APIs → Credentials:
- `https://[your-netlify-site].netlify.app/api/auth/google/callback` (Preview)
- `https://www.aitathastu.com/api/auth/google/callback` (Production)

---

## Category 3: OCR Background Processing (REQUIRED FOR OCR)

| Variable | Type | Example Value | Notes |
|---|---|---|---|
| `OCR_INTERNAL_SECRET` | Server-side secret | `[32+ char random hex]` | Authorizes ocr-background function invocation |

Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Category 4: AI Providers (OPTIONAL — fallback to zero-LLM if absent)

| Variable | Type | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Server-side secret | Google Gemini for EORA |
| `GEMINI_API_KEYS` | Server-side secret | Comma-separated for key rotation |
| `GROQ_API_KEY` | Server-side secret | Groq (fast inference) |
| `GROQ_API_KEYS` | Server-side secret | Comma-separated |
| `OPENROUTER_API_KEY` | Server-side secret | OpenRouter |
| `OPENROUTER_API_KEYS` | Server-side secret | Comma-separated |
| `CEREBRAS_API_KEY` | Server-side secret | Cerebras |
| `MISTRAL_API_KEY` | Server-side secret | Mistral |
| `SAMBANOVA_API_KEY` | Server-side secret | SambaNova |
| `ENABLE_LLM_EORA` | Runtime config | `true` | Enable AI EORA responses |

---

## Category 5: Feature Flags (OPTIONAL)

| Variable | Type | Default | Notes |
|---|---|---|---|
| `PILOT_MODE` | Runtime config | `false` | Restrict to pilot users |
| `INVITE_CODE_REQUIRED` | Runtime config | `false` | Require invite codes |
| `PILOT_INVITE_CODES` | Runtime config | — | Comma-separated invite codes |
| `ENABLE_GITHUB_LIVE` | Runtime config | `false` | Live GitHub integration |
| `CORE_DISABLE_LIVE_LLM` | Runtime config | `false` | Force zero-LLM mode |

---

## Category 6: Cron Security (OPTIONAL — if using direct HTTP cron endpoint)

| Variable | Type | Notes |
|---|---|---|
| `CRON_SECRET` | Server-side secret | Protects `/api/cron/cleanup-stuck-syncs` via Authorization header |

---

## Category 7: Partner App Integration (OPTIONAL)

| Variable | Notes |
|---|---|
| `INTEGRATION_STUDY_LPU_SECRET` | Study LPU handoff |
| `INTEGRATION_PADHO_CODE_SECRET` | Padho Code handoff |
| `INTEGRATION_ERIS_SECRET` | ERIS handoff |
| `INTEGRATION_MENTORMAZE_SECRET` | MentorMaze handoff |

---

## Category 8: Render/Vercel (DECOMMISSION AFTER CUTOVER)

These were used for the Render backend. After Netlify Preview is verified:
- `RESUME_EXTRACTOR_URL` — Remove; replaced by Netlify Background Function
- `EXTRACTOR_API_TOKEN` — Remove
- `NEXT_PUBLIC_RENDER_EXTRACTOR_URL` — Remove

---

## Preview Database Isolation (RECOMMENDED)

For Netlify Deploy Previews, use a separate Neon branch:

1. Create a Neon branch: `aitathastu-preview`
2. Set `PREVIEW_DATABASE_URL` in Netlify dashboard (Deploy Previews scope only)
3. In `netlify.toml` deploy-preview context, override `DATABASE_URL` to use preview branch

This prevents integration tests from touching production student data.

---

## Variables Set Automatically by Netlify (Do NOT set manually)

| Variable | Description |
|---|---|
| `URL` | Canonical site URL (e.g., `https://aitathastu.netlify.app`) |
| `DEPLOY_URL` | Unique URL for each deploy |
| `NETLIFY` | Set to `true` on all Netlify deployments |
| `NETLIFY_CONTEXT` | `production`, `deploy-preview`, or `branch-deploy` |
| `SITE_ID` | Netlify site ID |
| `DEPLOY_ID` | Unique deploy ID |

---

## Security Rules
- NEVER prefix secrets with `NEXT_PUBLIC_` — this exposes them in client JS bundles
- NEVER commit `.env` or `.env.local` with real values to git (already blocked by CI scan)
- Rotate any credentials that may have been previously exposed in logs
- Use Netlify's secret rotation if available for critical credentials

## Status: READY FOR CONFIGURATION
