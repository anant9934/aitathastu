# AI TATHASTU — NETLIFY BACKGROUND JOB DESIGN

## Design Principles

1. **Idempotent** — Safe to invoke multiple times for the same jobId
2. **Durable** — All state in Neon PostgreSQL (not in function memory)
3. **No PII in logs** — personId, document contents never logged
4. **No PDF in invocation** — Only jobId, personId, documentId passed
5. **Bounded retries** — Max 3 attempts tracked in Neon
6. **Atomic claim** — Prevents concurrent duplicate processing
7. **Cleanup** — Expired job blobs cleaned by scheduled cron

## Job Record Schema (in Neon)

```sql
-- sourceProcessingJobs table (existing schema)
id          TEXT PRIMARY KEY
personId    TEXT NOT NULL
sourceType  TEXT NOT NULL  -- 'resume_extraction'
status      TEXT NOT NULL  -- see states below
stage       TEXT           -- fine-grained progress
attempts    INT DEFAULT 0
maxAttempts INT DEFAULT 3
createdAt   TIMESTAMP
updatedAt   TIMESTAMP
claimedAt   TIMESTAMP      -- when background function claimed it
completedAt TIMESTAMP
errorCode   TEXT
errorMessage TEXT
resultReference TEXT       -- 'resume:bg:{documentId}' on success
metadata    JSONB
```

## Job Status State Machine

```
CREATED (by extract or upload route)
  │
  ▼
QUEUED (by ocr-trigger after background invoked)
  │
  ▼
PROCESSING (when background function calls claimJob)
  │
  ├─→ NATIVE_EXTRACTION (pdfjs-dist text extraction)
  │       │
  │       ├─→ STRUCTURED_EXTRACTION (if sufficient text found)
  │       │
  │       └─→ OCR_PROCESSING (if text insufficient)
  │               │
  │               └─→ STRUCTURED_EXTRACTION
  │
  ├─→ REVIEW_READY (extraction complete, candidates available)
  │
  └─→ FAILED (error_code + error_message in job record)

Dead states: CANCELLED, EXPIRED (set by cleanup cron)
```

## Idempotency Implementation

```typescript
// In SourceProcessingJobService.claimJob():
// Uses conditional UPDATE to prevent duplicate claims:
UPDATE source_processing_jobs
  SET status = 'PROCESSING', claimedAt = NOW(), attempts = attempts + 1
  WHERE id = $jobId
    AND personId = $personId
    AND status IN ('QUEUED', 'CREATED')
    AND attempts < maxAttempts
RETURNING id

// Returns { claimed: true } only if UPDATE returned a row
// Returns { claimed: false } if job already claimed or exceeded retries
```

## Retry Strategy

- Max 3 attempts per job
- Retry available when `status = 'FAILED' AND canRetry = true`
- Student can trigger retry via POST /api/resume/{id}/retry
- Each retry re-invokes ocr-trigger → ocr-background
- Attempt count incremented atomically on each claim

## Cleanup Policy

- Netlify Background Function: up to 15 minutes
- Job timeout threshold: 15 minutes (matched to Netlify limit)
- Cleanup cron (04:00 UTC): marks jobs > 15 min in PROCESSING as FAILED with TIMEOUT
- Resume blobs in Neon: 30-day retention policy (enforced by cleanup cron)
- Expired jobs: marked EXPIRED after 7 days if never completed

## Protection Against Concurrent Processing

- `claimJob()` uses atomic conditional UPDATE (single writer wins)
- Duplicate invocations of the background function find `claimed: false` and exit immediately
- Job status checked at start of every major step

## Status: IMPLEMENTED — Requires Netlify Preview verification
