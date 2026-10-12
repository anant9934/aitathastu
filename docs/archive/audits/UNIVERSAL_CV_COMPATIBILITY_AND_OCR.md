# CV compatibility and OCR audit

Date: 2026-10-11. The live upload contract accepts PDF and DOCX up to 5 MB with explicit consent. Legacy `.doc` is rejected with conversion guidance; TXT, RTF, ODT, JPEG, PNG, WebP and HEIC are not claimed as supported inputs. `parseResumeDocument` is the single deterministic parser used by the route. No generative LLM call was found in that route or `resume-extraction-service.ts`.

| Input/structure | Strategy | This audit's result |
|---|---|---|
| Native text PDF | PDF.js text/layout, stream and pdf-parse fallback | Synthetic PDF: HTTP 200, `ocrUsed:false`, education and six review candidates. |
| Image-only PDF | Render page with `@napi-rs/canvas`, local Tesseract worker | Synthetic raster PDF with zero extractable text: HTTP 200, `ocrUsed:true`, name/education/skill classified. |
| Vector-path PDF | Render vector paths, OCR rendered page | Synthetic path-only PDF with zero extractable text: HTTP 200, `ocrUsed:true`, name/education/skill classified. This proves path OCR, not Canva-specific layout coverage. |
| Table DOCX | Mammoth raw text plus HTML table/link inspection | Synthetic table DOCX: HTTP 200, table school and skills recovered; five review candidates. |
| Legacy DOC | No isolated converter installed in app | Explicitly unsupported; save as DOCX or PDF. |
| Hybrid, multi-column, sidebar, scanned low quality, multilingual, encrypted, >5 MB | Code paths or rejection exist | Not independently verified in this audit. Existing reports contain historical claims that are not counted as current certification. |

The local synthetic fixture generator is `scripts/generate_synthetic_ocr_fixtures.py`. It emits PDFs/DOCX only into a temporary directory. The vector fixture is drawn entirely with PDF rectangles; `pdfplumber` extracted zero characters before OCR. The parser test asserted actual `ocrUsed`, recovered text and structured name/education/skill; the HTTP test repeated those checks through `/api/resume/extract`. No private CV bytes were committed or logged.

Root causes repaired: the old identical-file cache stored review claims but not OCR text or discovered links, then reparsed with OCR off and reported false `ocrUsed:false` and constant latency. It is disabled until a complete cache contract exists. The route now distinguishes encrypted/invalid documents and OCR-empty from native-empty documents, and no longer rejects every short nonempty document solely for fewer than 40 non-space characters. The upload UI gives `.doc` conversion guidance and clears a prior success display before a new upload.

Files modified: `app/api/resume/extract/route.ts`, `Screen5ResumeUpload.tsx`; synthetic test scripts added. Tests passed: `scripts/verify-synthetic-ocr.ts`, `scripts/verify-onboarding-api-local.ts`. Limits: OCR worker/binary/assets were exercised locally only. Vercel traced output, preview timeout/memory, real Canva/Europass/LaTeX documents, encrypted failure response, corrupted files, and a representative multi-format benchmark are not certified. The parser still uses a page-quality threshold internally and the error taxonomy remains incomplete.
