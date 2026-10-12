# AI TATHASTU — NETLIFY CV/OCR PROCESSING DESIGN

## OCR Runtime Feasibility Gate

### Render Python Service — NOT MIGRATABLE
The `services/resume-extractor/` Python FastAPI service requires:
- `tesseract-ocr` binary (Linux apt package)
- `PyMuPDF (fitz)` C library
- `opencv-python-headless` C library
- Persistent HTTP server (uvicorn/FastAPI)

**Verdict:** INCOMPATIBLE with Netlify Functions. Cannot be moved as-is.

### Node.js OCR Engine — ALREADY IN THE CODEBASE

`lib/services/document-parser-service.ts` is a complete Node.js OCR engine:

```
PDF Input
  │
  ▼
Tier 1: pdfjs-dist text extraction (pure JS)
  │── Enough text (>40 non-ws chars)? → Structured Extraction
  │
  ▼ (if not enough native text)
Tier 2: @napi-rs/canvas renders page to PNG at 2.0x scale
  + tesseract.js v7 WASM OCR recognition
  │── OCR produces text? → Structured Extraction
  │
  ▼ (if canvas/OCR still empty)
Tier 3: pdf-parse fallback
  │
  ▼
Structured Extraction (deterministic, zero-LLM)
```

### Key Dependencies Assessment

| Package | Type | Netlify Risk | Mitigation |
|---|---|---|---|
| `tesseract.js` v7 | Pure JS + WASM | LOW — no native binary | `eng.traineddata` must be bundled |
| `pdfjs-dist` | Pure JS | LOW | In serverExternalPackages |
| `@napi-rs/canvas` v0.1.80 | Native `.node` prebuilt | MEDIUM | Must verify `linux-x64-gnu` prebuild works on Netlify Lambda |
| `mammoth` | Pure JS | LOW | No issues |
| `pdf-parse` | Pure JS | LOW | No issues |

### The `@napi-rs/canvas` Situation

`@napi-rs/canvas` provides platform-specific prebuilts:
- `@napi-rs/canvas-linux-x64-gnu` — for glibc Linux x64 (AWS Lambda, Netlify)
- `@napi-rs/canvas-darwin-x64` — macOS x64
- `@napi-rs/canvas-darwin-arm64` — macOS ARM

Netlify Functions run on **Amazon Linux 2 (glibc, x64)**.
The `linux-x64-gnu` prebuilt should load.

**Must verify:** Deploy to Netlify Preview and attempt OCR on a vector-outline PDF.
If canvas fails to load, the error will be: `Cannot find module '@napi-rs/canvas-linux-x64-gnu'`

### Fallback If `@napi-rs/canvas` Fails on Netlify

Option 1: Add `canvas` npm package (uses Cairo — also native, same risk category).
Option 2: Use `node-canvas` — same.
Option 3: Use `sharp` for image processing — has well-maintained Linux prebuilts.
Option 4: Rely on PDF.js's built-in canvas polyfill for text extraction only (no rasterization).

The most likely successful fallback is to use `sharp` for image preprocessing + a canvas polyfill.
This would require a targeted change to `renderPdfPagesWithMetadata()` in `document-parser-service.ts`.

### `eng.traineddata` Packaging

The 5.2MB `eng.traineddata` file is:
- At repository root: `/eng.traineddata`
- Referenced by `resolveLocalTrainedDataPath()` in document-parser-service.ts
- Checksum verification: SHA256 `EXPECTED_ENG_TRAINEDDATA_SHA256`
- `next.config.mjs` `outputFileTracingIncludes` already includes it for `/api/**/*`
- `netlify.toml` `included_files` also lists it

**Must verify in Netlify Preview:** Check Netlify Function logs for successful checksum validation.

## Async OCR Job Flow (Background Function)

### File: `netlify/functions/ocr-background.mts`

```
POST /api/resume/ocr-trigger
  └─→ Validates auth, job ownership
  └─→ Fire-and-forget: POST /.netlify/functions/ocr-background
        { jobId, personId, documentId }  ← NO PDF BYTES
  └─→ Returns 202 immediately
      │
      ▼
ocr-background (Netlify Background Function, up to 15 min)
  └─→ Validates OCR_INTERNAL_SECRET
  └─→ Claims job atomically (prevents duplicates)
  └─→ Retrieves PDF from Neon blob storage
  └─→ Runs Node.js OCR pipeline
  └─→ Persists result to Neon
  └─→ Updates job status: REVIEW_READY or FAILED
```

### Job States (browser polls `/api/resume/{id}/status`)

| State | Meaning |
|---|---|
| QUEUED | Job created, background function not yet claimed |
| PROCESSING | Background function has claimed the job |
| NATIVE_EXTRACTION | Running pdfjs-dist text extraction |
| OCR_PROCESSING | Running tesseract.js OCR |
| STRUCTURED_EXTRACTION | Running deterministic field extraction |
| REVIEW_READY | Extraction complete, candidates available for review |
| FAILED | Processing failed — error details in job record |
| CANCELLED | Student cancelled the job |
| EXPIRED | Job timed out without completion |

## Status: IN PROGRESS — Requires Netlify Preview deployment for Gate E validation
