# Resume structured extraction accuracy audit

Date: 2026-10-11. The path is document parser → `extractResumeStructured` → deterministic extraction engine → schema validation → source-span review candidates. It does not call a generative model. `resumeCandidates` requires source spans and applies skill/project validators. Student-selected claims are checked against a person-owned snapshot before completion.

Current independent synthetic checks assert the fictional name, institution and Python skill on both image-only and vector-path PDFs. The HTTP route returned six review candidates for native/image/vector PDFs and five for the table DOCX after synthetic GitHub/LinkedIn URLs were added. The API test asserted education and those two actual URL discoveries on native PDF and DOCX. These are record-level checks of a small synthetic specification, not an overall precision/recall estimate.

| Category | Current evidence | Remaining risk |
|---|---|---|
| Identity and links | Synthetic name and two URLs recovered | OCR URL spelling and mixed-link annotation cases untested. |
| Education | Synthetic institution recovered by OCR and DOCX | Multiple schools, degrees, date association and table edge cases untested here. |
| Experience | Test source contains one internship; local test does not yet assert its structured grouping | Wrong role/company pairing remains possible. |
| Projects | Test source contains one project; count/classification not asserted | Books/patents versus projects need independent labeled fixtures. |
| Skills | Python asserted on OCR fixtures | Negation/aspiration and exact count need broader holdout. |
| Certifications, awards, publications, books, patents | Deterministic engine contains categories and existing scripts | No new independent record-level acceptance run for all categories in this audit. |

The previous V5.0.5R report stated HUMAN_GOLD = 0. Its heuristic labels are not independent human truth. This report therefore gives no accuracy percentage. Candidate evidence must not be shown as independently verified; OCR confidence measures recognition quality only.

Files modified for downstream classification integrity: `lib/onboarding-import-candidates.ts`, `ExactScreensContainer.tsx`, `Screen8ProfileInsights.tsx`, `lib/services/onboarding-v2-service.ts`. Tests: `scripts/verify-synthetic-ocr.ts`, `scripts/verify-onboarding-api-local.ts`, and `scripts/verify-onboarding-boundaries.ts` passed. Broad field accuracy gate remains open.
