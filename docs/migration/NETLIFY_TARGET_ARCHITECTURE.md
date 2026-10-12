# AI TATHASTU — NETLIFY TARGET ARCHITECTURE

## System Overview

```
Browser
  │
  ├─→ Netlify CDN (static assets, public/)
  │
  └─→ Netlify Next.js Application (@netlify/plugin-nextjs / OpenNext)
        │
        ├─→ App Router Pages (SSR, Server Components)
        │
        ├─→ API Routes (mapped to Netlify Functions)
        │     ├─ /api/auth/**       — Auth, Google OAuth, sessions
        │     ├─ /api/resume/**     — Upload, extract, status, review
        │     ├─ /api/student/**    — Dashboard, profile, skills, evidence
        │     ├─ /api/eora/**       — EORA AI chat
        │     ├─ /api/integrations/**— GitHub, LinkedIn
        │     └─ /api/health        — Health check
        │
        ├─→ Netlify Background Function (ocr-background.mts)
        │     └─ OCR processing (up to 15 minutes)
        │
        ├─→ Netlify Scheduled Function (cleanup-stuck-syncs.mts)
        │     └─ Daily at 04:00 UTC
        │
        └─→ Neon PostgreSQL (HTTP transport)
              ├─ users, sessions, persons
              ├─ resumeDocuments, resumeDocumentBlobs
              ├─ skills, evidence, projects
              └─ journeyEvents, onboardingState
```

## OCR Job Lifecycle

```
Student uploads CV
  │
  ▼
POST /api/resume/upload
  - Auth validation
  - File validation (type, size, magic bytes)
  - Store blob in Neon (resumeDocumentBlobs table)
  - Store document record in Neon (resumeDocuments table)
  - Returns: { documentId }
  │
  ▼
POST /api/resume/extract
  - For native-text PDFs: runs synchronously (< 10 seconds)
  - For scanned/complex PDFs: delegates to OCR trigger
  - Creates job record in Neon
  - Returns: { jobId, status: "QUEUED" | "completed" }
  │
  ▼ (if OCR required)
POST /api/resume/ocr-trigger
  - Validates job ownership
  - Invokes Netlify Background Function (fire-and-forget)
  - Returns 202 immediately
  - OCR_INTERNAL_SECRET protects background function invocation
  │
  ▼
Netlify Background Function: ocr-background
  - Validates OCR_INTERNAL_SECRET
  - Claims job atomically (prevents duplicate processing)
  - Retrieves document from Neon blob storage
  - Runs document-parser-service.ts Node.js OCR pipeline:
      1. pdfjs-dist text extraction (Tier 1)
      2. @napi-rs/canvas + tesseract.js OCR (Tier 2 — for scanned pages)
      3. pdf-parse fallback (Tier 3)
  - Runs structured extraction (deterministic, zero-LLM)
  - Persists extraction result to Neon
  - Updates job status: REVIEW_READY | FAILED
  │
  ▼
Browser polls: GET /api/resume/{id}/status
  - Returns job status from Neon
  - Possible states: QUEUED, PROCESSING, NATIVE_EXTRACTION,
    OCR_PROCESSING, STRUCTURED_EXTRACTION, REVIEW_READY, FAILED
  │
  ▼
Student reviews candidates in onboarding Step 4
  └─→ POST /api/resume/{id}/apply
        - Saves confirmed Person 360 records
```

## Key Differences from Vercel + Render

| Aspect | Vercel + Render | Netlify (Target) |
|---|---|---|
| Frontend | Vercel | Netlify |
| API routes | Vercel Serverless Functions | Netlify Functions (via OpenNext) |
| OCR engine | Render Python/FastAPI/Tesseract | Netlify Background Function + Node.js tesseract.js |
| Cron | Vercel Cron | Netlify Scheduled Function |
| Document storage | Neon blob (unchanged) | Neon blob (unchanged) |
| Database | Neon (unchanged) | Neon (unchanged) |
| Max sync function duration | 60 seconds | 26 seconds |
| Max background duration | N/A | 15 minutes |

## Netlify Environment Variables Required

See `NETLIFY_ENVIRONMENT_CHECKLIST.md` for the full list.

## Status: IN PROGRESS
