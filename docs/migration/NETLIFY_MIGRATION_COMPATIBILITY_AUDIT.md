# AI TATHASTU — NETLIFY MIGRATION COMPATIBILITY AUDIT
**Version:** V6.0
**Date:** 2026-10-12
**Branch:** `feat/netlify-migration`
**Base Commit:** `a438d02` (HEAD on `codex/v53-premium-experience`)

---

## 1. REPOSITORY STATE

| Item | Value |
|---|---|
| Local path | `/Users/quantumanant/aitathastu` |
| Remote | `https://github.com/anant9934/aitathastu.git` |
| Active branch | `feat/netlify-migration` |
| Base commit | `a438d02` |
| Uncommitted work | Modified screenshot PNGs only — no source code changes |
| Package manager | `npm` (v10.8.2) |
| Node.js runtime | v20.20.2 |
| Next.js version | `^15.5.27` (App Router) |
| React version | `^19.1.1` |
| TypeScript | `^5.9.2` |

---

## 2. CURRENT HOSTING ARCHITECTURE

```
Browser
  → Vercel (Next.js 15 App Router SSR + API Routes)
  → Render (Docker: Python 3.13 / FastAPI / Tesseract-OCR)
  → Neon PostgreSQL (primary database)
```

### Vercel role
- Hosts entire Next.js 15 App Router application
- Runs all API routes: auth, student, onboarding, EORA, digital footprint
- Vercel Cron at `/api/cron/cleanup-stuck-syncs` (schedule: `0 4 * * *`)
- Uses `VERCEL_PROJECT_PRODUCTION_URL` env in `lib/auth/origin.ts` as fallback URL
- Uses `VERCEL_ENV` in `lib/security/production-secrets.ts` to detect staging context

### Render role
- Separate Python 3.13 / FastAPI service (`services/resume-extractor/`)
- Docker container: `python:3.13-slim` base image
- apt: `tesseract-ocr tesseract-ocr-eng libglib2.0-0 libgl1`
- Python packages: `pytesseract`, `PyMuPDF (fitz)`, `opencv-python-headless`, `Pillow`, `python-docx`
- Next.js app calls this at `RESUME_EXTRACTOR_URL` / `NEXT_PUBLIC_RENDER_EXTRACTOR_URL`

### Neon role
- PostgreSQL via `@neondatabase/serverless` HTTP transport
- Stores: users, sessions, persons, orgs, resume docs, resume blobs, skills, evidence, projects, onboarding
- Resume blobs stored as base64 in `resumeDocumentBlobs` — no external blob storage
- Used by `ObjectStorageService` as the durable document store

---

## 3. DEPENDENCY CLASSIFICATION

### Next.js Application

| Dependency | Classification | Action |
|---|---|---|
| Next.js 15.5 App Router | COMPATIBLE AS-IS | Install @netlify/plugin-nextjs adapter |
| React 19 Server Components | COMPATIBLE AS-IS | No change |
| Server Actions | COMPATIBLE | No change |
| Route Handlers | COMPATIBLE | Mapped to Netlify Functions |
| Middleware | COMPATIBLE | Netlify Edge Functions support Next.js middleware |
| SSR/SSG/Dynamic routes | COMPATIBLE | No change |
| Image optimization | REQUIRES CONFIG | Netlify image CDN; verify next.config image domains |
| Static assets | COMPATIBLE | `public/` directory served as-is |

### Vercel-Specific Dependencies

| Item | Location | Classification | Action |
|---|---|---|---|
| `vercel.json` | Root | REPLACE | Create `netlify.toml` |
| `.vercel/` directory | Root | DELETE AFTER VERIFY | Not needed on Netlify |
| `.vercelignore` | Root | DELETE AFTER VERIFY | Not needed |
| `VERCEL_PROJECT_PRODUCTION_URL` env | `lib/auth/origin.ts:26` | MIGRATE | Update to Netlify `URL` env var |
| `VERCEL_ENV` env | `lib/security/production-secrets.ts:85` | MIGRATE | Update to `NETLIFY_CONTEXT` |
| Vercel Cron | `vercel.json` | MIGRATE | Netlify Scheduled Functions |
| `export const runtime = "nodejs"` | Route files | COMPATIBLE | No change |
| `maxDuration = 60` | Route files | REQUIRES CONFIG | Netlify sync max 26s; use background for OCR |

### CRITICAL — Render/Python OCR Service

| Dependency | Runtime Req | Netlify Support | Classification |
|---|---|---|---|
| FastAPI | Python 3.13 persistent HTTP server | NOT SUPPORTED | REQUIRES REPLACEMENT |
| uvicorn | ASGI process manager | NOT SUPPORTED | REQUIRES REPLACEMENT |
| pytesseract | Python wrapper for tesseract binary | NOT SUPPORTED | REQUIRES REPLACEMENT |
| tesseract-ocr | Linux native binary (apt) | NOT AVAILABLE | REQUIRES REPLACEMENT |
| PyMuPDF (fitz) | Native C library | NOT AVAILABLE | REQUIRES REPLACEMENT |
| opencv-python-headless | Native C/C++ | NOT AVAILABLE | REQUIRES REPLACEMENT |
| numpy | Native compiled | NOT AVAILABLE | REQUIRES REPLACEMENT |

**CRITICAL FINDING:** The Render service is a persistent Docker container running Python FastAPI with native Linux binaries. It cannot be migrated to Netlify Functions by moving Python files. The execution model is fundamentally incompatible.

### JavaScript/Node.js OCR Engine (Already In-App)

The Next.js app already contains a complete Node.js OCR engine in `lib/services/document-parser-service.ts`:

| Component | Package | Netlify Compatibility | Notes |
|---|---|---|---|
| PDF text extraction | `pdfjs-dist` | COMPATIBLE | In serverExternalPackages |
| PDF rendering for OCR | `@napi-rs/canvas` | HIGH RISK | Native .node binary — must verify Linux x64 |
| Tesseract OCR | `tesseract.js` v7 | COMPATIBLE | Pure JS + WASM, no system binary |
| Tesseract model | `eng.traineddata` (5.2MB) | REQUIRES PACKAGING | outputFileTracingIncludes already set |
| DOCX extraction | `mammoth` | COMPATIBLE | Pure JS |
| PDF parse fallback | `pdf-parse` | COMPATIBLE | Pure JS |
| Neon DB | `@neondatabase/serverless` | COMPATIBLE | HTTP transport, serverless-safe |

**KEY FINDING:** `@napi-rs/canvas` publishes platform-specific prebuilt binaries. Netlify Functions run on Amazon Linux 2 x64 — the `linux-x64-gnu` variant should work but MUST be proven on a deployed Netlify Preview. This is the single highest technical risk.

### Authentication

| Component | Status | Action |
|---|---|---|
| Custom session (not NextAuth) | COMPATIBLE | No change |
| Email/password (bcryptjs) | COMPATIBLE | No change |
| Google OAuth | REQUIRES CONFIG | Update redirect URI to Netlify domain |
| Cookie security | COMPATIBLE | httpOnly, secure, sameSite=lax — correct |
| getCanonicalOrigin() | MIGRATE | Update to read Netlify URL env vars |
| Session storage | COMPATIBLE | Neon PostgreSQL sessions table |

### Database (Neon)

| Component | Status | Action |
|---|---|---|
| @neondatabase/serverless | COMPATIBLE | HTTP transport — serverless-safe |
| Drizzle ORM | COMPATIBLE | No platform-specific code |
| PGlite fallback | COMPATIBLE (dev) | Already guarded: isProd blocks in production |
| Blob storage | COMPATIBLE | base64 in Neon — no external storage needed |

---

## 4. OCR FEASIBILITY ASSESSMENT

### Current Production Evidence (commit a438d02)
- Render service: 8/8 extractor tests passed
- Native-text PDF: WORKING
- Vector-outline PDF: FAILING — OCR_SERVICE_UNAVAILABLE after ~38 seconds

### Node.js OCR Pipeline (already in app)
1. Tier 1: pdfjs-dist text extraction (pure JS)
2. Tier 2: @napi-rs/canvas + pdfjs-dist → render page to PNG → tesseract.js OCR (WASM)
3. Tier 3: pdf-parse fallback

### OCR Migration Decision Matrix

| Scenario | Netlify Compatible | Confidence | Blocker |
|---|---|---|---|
| Native text PDF | YES | HIGH | None |
| DOCX extraction | YES | HIGH | None |
| Scanned/image PDF | LIKELY | MEDIUM | Needs Netlify Preview test |
| Vector-outline PDF | CONDITIONAL | LOW-MEDIUM | @napi-rs/canvas Linux compat must be proven |
| Background async | YES | HIGH | Netlify BG Functions: up to 15 min |

---

## 5. RISK REGISTER

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| @napi-rs/canvas fails on Netlify Linux | HIGH | MEDIUM | Deploy Preview; test immediately |
| eng.traineddata not bundled in function | HIGH | MEDIUM | outputFileTracingIncludes already set; verify |
| Function memory exceeded during OCR | MEDIUM | MEDIUM | Netlify Pro: up to 3GB; measure actual usage |
| Background Function 15-min exceeded | MEDIUM | LOW | OCR uses 15s/page, 2-page limit |
| Google OAuth callback URL mismatch | MEDIUM | HIGH | Update Google Cloud Console before Preview |
| VERCEL_PROJECT_PRODUCTION_URL not set | MEDIUM | HIGH | Must update origin.ts before deployment |

---

## 6. FILES REQUIRING CHANGE

### Must Change
| File | Change |
|---|---|
| `lib/auth/origin.ts` | Replace VERCEL_PROJECT_PRODUCTION_URL with Netlify URL env vars |
| `lib/security/production-secrets.ts` | Replace VERCEL_ENV with NETLIFY_CONTEXT |
| `app/api/cron/cleanup-stuck-syncs/route.ts` | Adapt for Netlify scheduled function trigger |

### Create New
| File | Purpose |
|---|---|
| `netlify.toml` | Build config, functions, scheduled function |
| `netlify/functions/ocr-background.mts` | Background Function for async OCR |
| `docs/migration/*.md` | All required deliverables |

### Keep As-Is
All `app/api/**/*.ts` route handlers, `lib/services/document-parser-service.ts`,
`lib/auth/session.ts`, `lib/storage/object-storage.ts`, `lib/db/index.ts`,
all pages/components, `next.config.mjs`

### Decommission After Verification
`vercel.json`, `.vercel/`, `.vercelignore`, `render.yaml`, `services/resume-extractor/`

---

## 7. GO/NO-GO GATE STATUS

| Gate | Status | Notes |
|---|---|---|
| A — Application compatibility | READY FOR MIGRATION | Next.js 15 + OpenNext supported |
| B — Student lifecycle | READY FOR MIGRATION | Auth is custom/Neon |
| C — Database | READY FOR MIGRATION | Neon HTTP transport serverless-safe |
| D — CV extraction (native) | READY FOR MIGRATION | document-parser-service.ts is Node.js |
| E — OCR reliability (scanned/vector) | IN PROGRESS | @napi-rs/canvas needs Netlify Preview |
| F — Digital Footprint | READY FOR MIGRATION | External API calls, env-driven |
| G — Core modules | READY FOR MIGRATION | Standard Next.js handlers |
| H — Security | IN PROGRESS | Secrets must move to Netlify env |
| I — Browser QA | NOT STARTED | Awaiting deployment |
| J — Cutover authorization | NOT STARTED | Pending user approval |

---

*Status: PHASE ZERO COMPLETE — Implementation beginning*
