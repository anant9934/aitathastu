# AI TATHASTU — 14-PDF OCR TEST MATRIX

## Status: NOT STARTED — Awaiting Netlify Preview Deployment

This matrix tracks the OCR acceptance test results on actual Netlify infrastructure.
Local macOS results do NOT qualify for any gate.

## Test Matrix

| # | Document Type | Size | Pages | Native Extraction | OCR Required | OCR Executed | OCR Time | Total Time | Extracted Fields | Failure Code | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Normal single-page PDF | — | 1 | — | — | — | — | — | — | — | NOT STARTED |
| 2 | Multi-page text PDF | — | 3+ | — | — | — | — | — | — | — | NOT STARTED |
| 3 | Two-column PDF | — | 1-2 | — | — | — | — | — | — | — | NOT STARTED |
| 4 | Table-heavy PDF | — | 1-2 | — | — | — | — | — | — | — | NOT STARTED |
| 5 | Image-only PDF | — | 1 | — | — | — | — | — | — | — | NOT STARTED |
| 6 | **Vector-outline PDF** | — | 1-2 | — | — | — | — | — | — | — | **NOT STARTED** |
| 7 | Mixed native/scanned PDF | — | 2+ | — | — | — | — | — | — | — | NOT STARTED |
| 8 | Complex multi-page CV | — | 4+ | — | — | — | — | — | — | — | NOT STARTED |
| 9 | PDF with GitHub/LinkedIn links | — | 1-2 | — | — | — | — | — | — | — | NOT STARTED |
| 10 | PDF with multiple projects | — | 2+ | — | — | — | — | — | — | — | NOT STARTED |
| 11 | PDF with multiple education records | — | 1-2 | — | — | — | — | — | — | — | NOT STARTED |
| 12 | Large supported PDF | — | 10+ | — | — | — | — | — | — | — | NOT STARTED |
| 13 | Invalid/corrupted PDF | — | — | — | — | — | — | — | — | — | NOT STARTED |
| 14 | Password-protected PDF | — | — | — | — | — | — | — | — | — | NOT STARTED |
| 15 | Normal DOCX | — | 1 | — | — | — | — | — | — | — | NOT STARTED |
| 16 | Table-heavy DOCX | — | 1-2 | — | — | — | — | — | — | — | NOT STARTED |

## CRITICAL: Vector-Outline PDF (Test #6)

This is the previously failing test case. In Render production:
- Failure mode: `OCR_SERVICE_UNAVAILABLE` after ~38 seconds
- Root cause: pytesseract on Render timed out

On Netlify, this requires:
1. `@napi-rs/canvas` successfully loads on Amazon Linux x64
2. PDF page successfully rendered to PNG via pdfjs-dist + canvas
3. tesseract.js WASM OCR successfully processes the PNG
4. Structured extraction produces correct fields

**This test MUST pass before Gate E can be declared verified.**

## Test Procedure (for each document)

1. Upload via POST /api/resume/upload
2. If native PDF: POST /api/resume/extract
3. If OCR required: POST /api/resume/ocr-trigger
4. Poll GET /api/resume/{id}/status until REVIEW_READY or FAILED
5. Check Netlify Function logs for actual OCR execution evidence
6. Record: status, timing, extracted fields, warnings

## Pass Criteria

- Tests 1-4, 8-12, 15-16: REVIEW_READY with correct field extraction
- Tests 5-7 (scanned/OCR): REVIEW_READY with `ocr_used: true` confirmed in logs
- Test 6 (vector-outline): REVIEW_READY — MUST pass on actual Netlify Preview
- Tests 13-14 (invalid/protected): FAILED with correct error code (not 500)

## Automated Test Script (To Be Created After Preview Deployment)

```bash
# Run against Netlify Preview URL
NETLIFY_PREVIEW_URL=https://[deploy].netlify.app \
  SESSION_TOKEN=[valid_session] \
  node --import tsx scripts/verify-netlify-14-pdf-matrix.ts
```

## Status: NOT STARTED
