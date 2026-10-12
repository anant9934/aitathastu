# AI TATHASTU — NETLIFY FUNCTION & API MAPPING

## Classification Key
- A: Lightweight synchronous API
- B: Server-side Next.js handler
- C: Background processing task
- D: External third-party integration
- E: Unsupported (Render Python) — replaced

---

## Authentication Routes

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| POST /api/auth/login | A | COMPATIBLE | Custom bcryptjs + Neon sessions |
| POST /api/auth/signup | A | COMPATIBLE | Custom Neon-backed |
| POST /api/auth/logout | A | COMPATIBLE | Cookie clear + Neon session delete |
| GET /api/auth/google | A | COMPATIBLE | OAuth redirect initiation |
| GET /api/auth/google/callback | A | REQUIRES CONFIG | OAuth redirect URI must point to Netlify |
| GET /api/auth/github/callback | A | REQUIRES CONFIG | Same |
| GET /api/auth/session | A | COMPATIBLE | Session validation |

## Resume/CV Routes

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| POST /api/resume/upload | A | COMPATIBLE | Stores to Neon blob |
| POST /api/resume/extract | B | COMPATIBLE | Sync for native PDFs; triggers background for OCR |
| POST /api/resume/ocr-trigger | A | NEW | Triggers Netlify Background Function |
| POST /api/resume/preflight | A | COMPATIBLE | File validation |
| POST /api/resume/signed-upload | A | MIGRATE | Currently points to Render; update to Netlify |
| GET /api/resume/[id]/status | A | COMPATIBLE | Polls Neon job record |
| GET /api/resume/[id] | A | COMPATIBLE | Fetches extraction from Neon |
| POST /api/resume/[id]/review | A | COMPATIBLE | Updates review state in Neon |
| POST /api/resume/[id]/apply | A | COMPATIBLE | Saves confirmed Person 360 records |
| POST /api/resume/[id]/retry | A | COMPATIBLE | Re-triggers extraction |
| GET /api/resume/[id]/export | A | COMPATIBLE | Fetches from Neon |

## Netlify Background Function

| Function | Class | Status | Notes |
|---|---|---|---|
| `/.netlify/functions/ocr-background` | C | NEW | Created in netlify/functions/ocr-background.mts |

## Netlify Scheduled Function

| Function | Class | Status | Notes |
|---|---|---|---|
| cleanup-stuck-syncs (Netlify) | C | NEW | netlify/functions/cleanup-stuck-syncs.mts, 04:00 UTC daily |
| GET /api/cron/cleanup-stuck-syncs | C | KEEP | HTTP endpoint for manual/Vercel trigger (backward compat) |

## Student Routes

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| GET /api/student/dashboard | B | COMPATIBLE | Neon-backed |
| GET/POST /api/student/profile | A | COMPATIBLE | Neon-backed |
| GET/POST /api/student/skills | A | COMPATIBLE | Neon-backed |
| GET/POST /api/student/evidence | A | COMPATIBLE | Neon-backed |
| GET/POST /api/student/projects | A | COMPATIBLE | Neon-backed |
| GET/POST /api/student/journey | A | COMPATIBLE | Neon-backed |
| GET /api/student/person360 | A | COMPATIBLE | Neon-backed |
| POST /api/student/settings | A | COMPATIBLE | Neon-backed |

## Onboarding Routes

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| GET/POST /api/onboarding-v2/** | A | COMPATIBLE | Neon-backed onboarding state |
| GET /api/ready | A | COMPATIBLE | Readiness check |

## EORA Routes

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| POST /api/eora/chat | B | COMPATIBLE | External AI API calls; credentials in env |

## Integration Routes

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| GET /api/integrations/github/** | D | COMPATIBLE | Public GitHub API |
| POST /api/integrations/github/connect | D | REQUIRES CONFIG | Update OAuth callback URL |
| GET /api/integrations/linkedin/** | D | COMPATIBLE | URL validation only |
| GET/POST /api/workspace/** | A | COMPATIBLE | Workspace preferences |

## Debug Routes (Internal)

| Endpoint | Class | Status | Notes |
|---|---|---|---|
| GET /api/debug/extractor-config | A | MIGRATE | Remove RENDER_EXTRACTOR_URL reference |
| GET /api/health | A | COMPATIBLE | Health check endpoint |

## Render Python Service Routes (DECOMMISSION)

| Service Route | Status | Replacement |
|---|---|---|
| POST /api/resumes/upload (Render) | DECOMMISSION | Netlify: POST /api/resume/upload |
| POST /api/resumes/upload-and-extract (Render) | DECOMMISSION | Netlify: ocr-background function |
| GET /api/resumes/{id}/status (Render) | DECOMMISSION | Netlify: GET /api/resume/{id}/status |
| GET /api/resumes/{id} (Render) | DECOMMISSION | Netlify: GET /api/resume/{id} |
| POST /api/resumes/{id}/review (Render) | DECOMMISSION | Netlify: POST /api/resume/{id}/review |
| GET /api/resumes/{id}/export (Render) | DECOMMISSION | Netlify: GET /api/resume/{id}/export |
| GET /health (Render) | DECOMMISSION | Netlify: GET /api/health |

## Status: READY FOR DEPLOYMENT
