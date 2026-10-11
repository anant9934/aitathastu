# P0.1 preview OCR and runtime verification

Date: 2026-10-11. Scope: preview only. No production deployment or production database write was made.

## Runtime evidence

- Vercel project `aitathastu`, scope `team_AVYtWN7wlYyVmDiH7aTkRVrB`; last completed preview deployment `dpl_yih6jMB88SKYquJzkXbdr4kom92R` is at `[historical Preview URL omitted]`. It was built from the dirty checkout at base HEAD `05ce6a48f9811829b390e264cff9f8d1aebb5474`. This SHA does **not** uniquely identify the uncommitted code uploaded by the CLI. The later local import confirmation fix is not in this preview.
- `npm run build` passed locally with a deliberately invalid loopback `DATABASE_URL`. Vercel's Linux build also passed and produced serverless functions. The `/api/resume/extract` route is Node.js with `maxDuration = 60` and a 5 MB upload limit. OCR has a 15 second application timeout; PDF OCR renders at most two pages. Broader academic CVs can exceed that OCR page limit.
- The local Next.js file trace for `/api/resume/extract` contains both `eng.traineddata` locations, 22 `tesseract.js-core` files, 169 PDF.js CMaps, and 16 standard fonts after `next.config.mjs` was corrected. Both language files match SHA-256 `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`. The macOS trace contains a Darwin canvas binary; the Vercel Linux build passed, but OCR initialization in the deployed function has not run.
- The final preview `/api/ready` response reported database `connected`, schema `verified`, and `durationMs: 222`. A synthetic image-only PDF POST to deployed `/api/resume/extract` returned `INGESTION_SECURITY_INCOMPLETE` before parsing. Thus there are no preview OCR worker, WASM, PDF-rendering, or model-loading logs to certify. The security gate was not bypassed.
- A preview environment secret export was rejected by automatic approval review because it would copy sensitive secrets into a local file. We did not retry that action by another route. The supplied isolated Neon branch was bound directly to this preview deployment through the CLI's per-deployment runtime override.
- The user confirmed the four preview security secrets have not been rotated and instructed us to keep the ingestion gate closed. A later preview deployment attempt carrying the isolated database credential was rejected by automatic approval review; no workaround was attempted. The closed gate remains the intended preview behavior.

## Local synthetic document matrix

All inputs are fictional and stayed under `/private/tmp/aitathastu-audit-fixtures`. Tests read their actual bytes. Times are one local macOS run of `parseResumeDocument`, not preview latency or population performance estimates.

| Format | Local result | Path and evidence | Time |
|---|---|---|---:|
| Native PDF | LOCAL VERIFIED | Native text; `ocrUsed=false`; 270 chars | 4 ms |
| Image-only PDF | LOCAL VERIFIED | Tesseract executed; `ocrUsed=true`, `ocrFailed=false`; 275 chars; name, school, skill classified | 1198 ms |
| Vector-outline PDF | LOCAL VERIFIED | Render and Tesseract executed; `ocrUsed=true`, `ocrFailed=false`; 275 chars; name, school, skill classified | 552 ms |
| Mixed native/image PDF | LOCAL VERIFIED | Two pages, one `native` and one `ocr`; 339 chars | 481 ms |
| Two-column PDF | LOCAL VERIFIED | `multi_column` reading order; school and Python recovered | 2 ms |
| Table-heavy DOCX | LOCAL VERIFIED | Mammoth text and table path; 241 chars | 151 ms |
| Standard DOCX | LOCAL VERIFIED | Mammoth path; 109 chars | 60 ms |
| Short valid PDF | LOCAL VERIFIED | 25 chars retained; parser did not reject it for insufficient length | 436 ms |
| Corrupted PDF | LOCAL VERIFIED | No fabricated text; manual review required | — |
| Scanned paper PDF | IMPLEMENTED BUT UNVERIFIED | Raster OCR path exists; no independent scan fixture | — |
| LaTeX-produced PDF | IMPLEMENTED BUT UNVERIFIED | Native PDF path exists; no actual LaTeX producer fixture | — |
| Canva-produced PDF | IMPLEMENTED BUT UNVERIFIED | No actual Canva export fixture | — |
| Faulty-encoding PDF | IMPLEMENTED BUT UNVERIFIED | Fallback code exists; no controlled fixture | — |
| Multi-page academic CV | IMPLEMENTED BUT UNVERIFIED | OCR page cap of two prevents a general claim | — |
| Encrypted PDF | IMPLEMENTED BUT UNVERIFIED | Rejection code exists; no encrypted fixture tested | — |
| Legacy DOC | BLOCKED | API truthfully rejects `.doc`; no conversion implemented | — |

Local HTTP tests against the isolated Neon branch returned HTTP 200 for native, image-only, vector-outline PDF, and table DOCX; image and vector responses had `ocrUsed=true`. These returned 6, 6, 6, and 5 review candidates respectively. The parser-level matrix adds the mixed, two-column, short, standard DOCX, and corrupted cases; those were not all sent to preview.

No consented holdout resumes of different real producers were supplied. The prior private vector resume and the V5.0.3 private fixture were absent; no private resume was committed. Source spans and pending review candidates are verified by the extraction tests, while broad real-world format accuracy remains open.

## Required next gate

The preview ingestion security prerequisites must be satisfied and certified by the operator before OCR can execute in a deployed function. Then rerun the same synthetic upload matrix and inspect function logs for model load, canvas/PDF rendering, worker errors, memory, and timeout behavior. Do not infer PREVIEW VERIFIED from a successful build or from local OCR.
