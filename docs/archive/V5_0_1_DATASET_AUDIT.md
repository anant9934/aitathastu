# AI TATHASTU V5.0.1 — DATASET AUDIT, PRIVACY & BENCHMARK PREPARATION REPORT

**Document ID:** `DOC-AUDIT-V5-0-1`  
**Execution Phase:** `V5.0.1` (Audit, Security Boundary, Registry & Benchmark Quarantine)  
**System Scope:** Deterministic Zero-LLM CV Extraction System  
**Project Workspace:** `/Users/quantumanant/aitathastu`  
**Certification Status:** **PASSED (100% — All 8/8 Safety & Audit Checks Verified)**  
**Benchmark Seed:** `AITATHASTU_V5_0_1_FROZEN_BENCHMARK_SEED_42`  

---

## Executive Summary

As part of **AI Tathastu V5.0.1**, an exhaustive data engineering and privacy audit was conducted on two external resume research datasets stored locally in the workspace:
1. **Dataset A (`resume 2/`)**: 2,484 PDFs + 1 relational CSV (`Resume.csv`), sourced from Kaggle (`snehaanbhawal/resume-dataset`).
2. **Dataset B (`Resumes PDF/`)**: 8,905 single-page image-derived PDFs organized into 97 occupational folders, sourced from Kaggle (`hadikp/resume-data-pdf`).

The audit successfully:
- Cataloged all **11,390 files** (11,389 PDFs + 1 CSV) measuring **2.50 GB total**.
- Validated a **100% 1-to-1 match** between Dataset A's CSV records and PDF documents.
- Discovered **1 malformed/empty document stub** in Dataset A and **556 duplicate image clusters (1,150 files)** in Dataset B resulting from multi-folder scraping redundancy.
- Established strict **legal provenance and privacy boundaries**: proved that nominal Kaggle "CC0" tags do not clear third-party personal data under GDPR/DPDPA, restricting both datasets strictly to local, offline benchmarking.
- Secured the repository: updated `.gitignore`, created `.vercelignore`, and confirmed via `git ls-files` that **zero dataset files or private student resumes are tracked in Git or exposed to production bundles**.
- Built an operational **zero-PII dataset registry** (`benchmarks/manifest.json`) cataloging all 11,389 documents with cryptographic fingerprints and operational metadata.
- Designed **cluster-atomic, stratified frozen evaluation splits** (`dev` 70.01%, `val` 14.87%, `test_frozen` 15.13%) mathematically proven to prevent 100% of duplicate data leakage.

---

## 1. Actual Dataset Counts & Inventory

| Metric | Dataset A (`resume 2/`) | Dataset B (`Resumes PDF/`) | Combined Evaluation Suite |
| :--- | :--- | :--- | :--- |
| **Exact Storage Path** | `resume 2/` | `Resumes PDF/` | Local private storage |
| **Primary File Format** | PDF (`.pdf`) + CSV (`.csv`) | PDF (`.pdf`) | PDF + CSV |
| **Total Files** | 2,485 (2,484 PDFs + 1 CSV) | 8,905 PDFs | **11,390 files** |
| **Total Readable PDFs** | 2,484 | 8,905 | **11,389 PDFs** |
| **Total Storage Size** | 118,289,355 bytes (~118 MB) | 2,386,959,869 bytes (~2.39 GB) | **2,505,249,224 bytes (~2.51 GB)** |
| **Zero-Byte Files** | 0 | 0 | **0** |
| **Corrupted / Unreadable PDFs** | 0 | 0 | **0** |
| **Malformed / Empty Stubs** | 1 (`12632728.pdf`) | 0 | **1 stub** |
| **Occupational Categories** | 24 categories | 97 categories | 121 category strata |
| **Usable Distinct Documents** | **2,481** | **8,311** | **10,792 distinct resumes** |

---

## 2. File Format & Document Characteristics

### Dataset A (`resume 2/`)
- **Structure:**
  - `resume 2/Resume/Resume.csv` (56,273,235 bytes)
  - `resume 2/data/data/<CATEGORY>/<ID>.pdf` (24 category directories)
- **Document Size Distribution:**
  - Min: 1,294 bytes (`12632728.pdf` - empty stub)
  - Max: 83,962 bytes
  - Mean: 24,966 bytes (~25 KB)
- **Page Count Distribution:**
  - 1 Page: 433 documents (17.43%)
  - 2 Pages: 1,775 documents (71.46%)
  - 3 Pages: 229 documents (9.22%)
  - 4 Pages: 32 documents (1.29%)
  - 5 Pages: 11 documents (0.44%)
  - 6 Pages: 2 documents (0.08%)
  - 7 Pages: 1 document (0.04%)
  - 9 Pages: 1 document (0.04%)
- **Text Stream Extraction:**
  - **Native Text Available:** 2,483 documents (99.96%). All valid documents contain rich, unencrypted FlateDecode text streams with embedded layout operators (`BT...ET`, `Tj`, `TJ`, `Tm`).
  - **OCR Requirement Candidates:** 0 documents (0.0%).
  - **Empty Document Stub:** 1 document (`12632728.pdf`, 1,294 bytes). Both the PDF and the corresponding CSV record contain only 21 characters of whitespace with no substantive resume content.

### Dataset B (`Resumes PDF/`)
- **Structure:**
  - 97 occupational subdirectories directly inside `Resumes PDF/` (e.g., `Accountant`, `Accountant resumes`, `Advocate`, `Advocate resumes`, `Agriculture`, `Agricultural resumes`, etc.).
- **Document Size Distribution:**
  - Min: 12,524 bytes
  - Max: 2,385,241 bytes (~2.38 MB)
  - Mean: 268,047 bytes (~268 KB)
- **Page Count Distribution:**
  - Exactly 1 Page: 8,905 documents (**100.0% single-page documents**).
- **Text Stream Extraction:**
  - **Native Text Available:** 0 documents (0.0%). Streams contain only image tokens or structural metadata (`-- 1 of 1 --`). Zero native selectable resume text.
  - **OCR Requirement Candidates:** 8,905 documents (**100.0%**). All documents consist of rasterized screenshot images wrapped in PDF single-page containers. Extracting text requires Tesseract.js local OCR or canvas rendering.

---

## 3. CSV Schema & ID Correspondence (Dataset A)

`resume 2/Resume/Resume.csv` was parsed with a strict streaming CSV reader:
- **Total Rows:** Exactly 2,484 rows.
- **Fields:**
  1. `ID` (string/integer identifier matching PDF basename)
  2. `Resume_str` (raw text representation with carriage returns and line feeds)
  3. `Resume_html` (structured HTML markup of the resume with LiveCareer classes)
  4. `Category` (occupational classification string)
- **Field Completeness:** 0 null or missing values across all 4 columns for all 2,484 rows.
- **Uniqueness:** 2,484 unique IDs (0 duplicate IDs in the CSV).
- **PDF-to-CSV Relationship:**
  - Every single PDF in `resume 2/data/data/` has a corresponding row in `Resume.csv`.
  - Every row in `Resume.csv` has an exact matching PDF file in `resume 2/data/data/`.
  - **Orphan CSV Rows:** 0.
  - **Orphan PDF Files:** 0.
  - **Category Discrepancies:** 0. (100.0% category alignment between folder name and CSV column).

---

## 4. Duplicate Content Analysis

Cryptographic analysis (SHA-256 binary hashing, normalized text hashing, and image stream extraction) revealed the following:

### Cross-Dataset Duplicates
- **Binary PDF Duplicates:** 0.
- **Cross-Dataset Image Matches:** 0.
- **Cross-Dataset Text Matches:** 0.
- *Finding:* Dataset A and Dataset B represent entirely distinct, disjoint collections.

### Within-Dataset Duplicates
1. **Dataset A:**
   - **Binary Hash Duplicates:** 0.
   - **Normalized Text Content Duplicates:** 2 clusters involving 4 documents:
     - `A_DUP_001` (Finance): ID `19147603` & ID `28398216`
     - `A_DUP_002` (Aviation): ID `16850314` & ID `37473139`
   - *Impact:* Deduplicating the 2 redundant documents yields **2,481 usable distinct documents**.

2. **Dataset B:**
   - **Binary Hash Duplicates:** 0.
   - **Raster Image Hash Duplicates:** **556 duplicate clusters** involving **1,150 total documents** (594 redundant copies).
   - *Root Cause:* The dataset compiler merged multiple scrape passes across occupational folders (e.g., `Agriculture/` containing hex-named PDFs like `9f5860d86ef1cd0b.pdf` and `Agricultural resumes/` containing `Image_48.pdf`). The underlying embedded JPEG raster images are 100% byte-for-byte identical.
   - *Impact:* Deduplicating the 594 redundant image copies yields **8,311 usable distinct documents**.

---

## 5. Privacy, Legal Provenance & Security Boundaries

A rigorous legal and data privacy assessment was conducted across both upstream sources:

| Evaluation Dimension | Dataset A (`snehaanbhawal/resume-dataset`) | Dataset B (`hadikp/resume-data-pdf`) |
| :--- | :--- | :--- |
| **Kaggle Listed License** | `CC0: Public Domain` | `CC0 / Open Access` |
| **Upstream Source** | Scraped from LiveCareer.com public resume builder | Scraped/rasterized portfolio resume images |
| **Original Content Rights** | LiveCareer terms explicitly reserve rights; scraping is unauthorized. | Graphic designers and resume owners retain visual and textual copyright. |
| **Personal Identifiable Information (PII)** | Real personal names, phone numbers, email addresses, educational history, residential locations. | High-resolution portrait photographs, full names, phone numbers, portfolio links, social handles. |
| **Legal Privacy Status** | **Protected Data under GDPR Art. 6/9, CCPA, and India DPDPA 2023.** A Kaggle uploader cannot waive third-party privacy rights. | **Protected Data under GDPR, CCPA, and DPDPA.** Visual likeness and contact information cannot be commercialized without consent. |
| **Permitted Usage** | **Strictly Offline Algorithmic Benchmarking Only.** Non-redistributable evaluation of extraction accuracy. | **Strictly Offline Local OCR Testing Only.** Evaluating OCR word error rate (WER) and bounding box detection. |
| **Prohibited Actions** | Committing to Git, bundling in Vercel, deploying to client, uploading to Neon DB, exposing via APIs. | Committing to Git, bundling in Vercel, deploying to client, uploading to Neon DB, exposing via APIs. |
| **Provenance Assessment** | **Restricted / Unverified Third-Party PII** | **Restricted / Unverified Image-Derived Data** |

### Privacy Protections Enacted
1. **Zero-PII Manifest Guarantee:** No individual names, phone numbers, email addresses, residential locations, or raw resume strings are stored in `benchmarks/manifest.json`. Only operational engineering metadata is recorded.
2. **Never Ingest into Database:** Neither dataset is permitted in Neon PostgreSQL student profile records or production tables.
3. **Never Expose via Runtime:** No Next.js API routes or client components read from `resume 2/` or `Resumes PDF/`.

---

## 6. Secure Local Storage Configuration

To guarantee that research datasets and private student fixtures never leak into production or version control:

1. **`.gitignore` Updates:**
   - Excludes `resume 2/`
   - Excludes `Resumes PDF/`
   - Excludes `benchmarks/`
   - Excludes `Anant-Kumar-Resume.pdf` (private fixture)
   - Excludes `*.traineddata` and `eng.traineddata`
   - Excludes `.pgdata/` and `previews/`
2. **`.vercelignore` Creation:**
   - Created explicit `.vercelignore` preventing Vercel build runners from packaging `resume 2/`, `Resumes PDF/`, `benchmarks/`, `Anant-Kumar-Resume.pdf`, or OCR binaries into serverless lambdas or edge runtime bundles.
3. **Git Index Cleanliness Check:**
   - Ran `git ls-files | grep -iE 'resume 2|resumes pdf|benchmarks|anant-kumar'`
   - **Result:** 0 tracked files found. The repository index is clean. No `git rm --cached` was required.
4. **CI Workflow Verification:**
   - Inspected `.github/workflows/ci.yml`. Confirmed that no dataset files are uploaded as CI build artifacts and security scans enforce clean secrets and environment boundaries.

---

## 7. Dataset Registry (`benchmarks/manifest.json`)

A centralized, non-identifying operational manifest was generated at `benchmarks/manifest.json`:

```json
{
  "doc_id": "DOC-A-10953078",
  "dataset_source": "kaggle_snehaanbhawal_resume_dataset",
  "relative_path": "resume 2/data/data/AGRICULTURE/10953078.pdf",
  "category": "AGRICULTURE",
  "format": "pdf",
  "file_size_bytes": 23418,
  "page_count": 2,
  "content_fingerprint": "969600d30c27d03a2c7c5632ff11aab6d47e0b342395da6b5156cc8e3afe8d15",
  "native_text_available": true,
  "ocr_required_candidate": false,
  "duplicate_group": "A_UNIQ_10953078",
  "is_duplicate": false,
  "processing_eligibility": "eligible_native_text",
  "benchmark_split": "dev"
}
```

### Manifest Schema Definitions
- `doc_id`: Unique internal evaluation identifier (`DOC-A-xxxx` or `DOC-B-xxxxx`).
- `dataset_source`: Source identifier string.
- `relative_path`: Path relative to workspace root.
- `category`: Occupational stratum.
- `format`: Document file extension (`pdf`).
- `file_size_bytes`: Exact byte size.
- `page_count`: Number of document pages.
- `content_fingerprint`: Cryptographic SHA-256 hash of document binary.
- `native_text_available`: Boolean indicating presence of extractable text streams.
- `ocr_required_candidate`: Boolean indicating necessity of OCR processing.
- `duplicate_group`: Group ID shared by identical/near-duplicate documents.
- `is_duplicate`: Boolean indicating membership in a multi-document cluster.
- `processing_eligibility`: Operational status (`eligible_native_text`, `eligible_ocr_required`, or `ineligible_empty_stub`).
- `benchmark_split`: Assigned partition (`dev`, `val`, or `test_frozen`).

---

## 8. Frozen Evaluation Split Design

To prevent overfitting, data leakage, and heuristic snooping:
- **Deterministic Seed:** `AITATHASTU_V5_0_1_FROZEN_BENCHMARK_SEED_42`
- **Split Proportions:** ~70% Development/Tuning, ~15% Validation, ~15% Frozen Holdout Test.
- **Cluster-Atomic Isolation:** Documents belonging to the same duplicate cluster (even when residing in different occupational folders, such as `Agriculture/` vs `Agricultural resumes/`) are assigned **as an indivisible atomic unit** to the same partition.

### Split Distribution Summary

| Split Partition | Dataset A (`resume 2/`) | Dataset B (`Resumes PDF/`) | Total Documents | Overall % | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Development (`dev`)** | 1,742 | 6,231 | **7,973** | **70.01%** | Extraction rule engineering, heuristic tuning, regex refinement. |
| **Validation (`val`)** | 371 | 1,322 | **1,693** | **14.87%** | Hyperparameter threshold selection, confidence calibration. |
| **Frozen Test (`test_frozen`)** | 371 | 1,352 | **1,723** | **15.13%** | **Sealed holdout test.** Final benchmark scoring only. |
| **Total** | **2,484** | **8,905** | **11,389** | **100.00%** | |

### Zero Data Leakage Verification
- Number of duplicate clusters crossing split boundaries: **0**
- Number of overlapping document IDs between splits: **0**
- Cluster-atomic isolation test: **PASSED (100%)**

---

## 9. Verification Suite & Test Results

A full test suite (`scripts/verify-v5-0-1-dataset-audit.ts`) was added to `package.json` (`npm run test:v5-0-1-audit`). All 8 verification checks passed with 100% compliance:

```text
=== AI TATHASTU V5.0.1 DATASET AUDIT & SECURITY SUITE ===

[Check 1] Dataset Directory Paths and Capitalization
  ✓ Directory A exact path: resume 2/ (Confirmed)
  ✓ Directory B exact path: Resumes PDF/ (Confirmed)

[Check 2] .gitignore Storage Exclusion
  ✓ .gitignore excludes 'resume 2/'
  ✓ .gitignore excludes 'Resumes PDF/'
  ✓ .gitignore excludes 'benchmarks/'
  ✓ .gitignore excludes 'Anant-Kumar-Resume.pdf'

[Check 3] .vercelignore Bundle Exclusion
  ✓ .vercelignore excludes 'resume 2/'
  ✓ .vercelignore excludes 'Resumes PDF/'
  ✓ .vercelignore excludes 'benchmarks/'
  ✓ .vercelignore excludes '*.traineddata'

[Check 4] Git Index Cleanliness Verification
  ✓ git ls-files confirms 0 dataset files tracked in repository index.
  ✓ Private fixture 'Anant-Kumar-Resume.pdf' is untracked.

[Check 5] Manifest Catalog & Zero-PII Verification
  ✓ Manifest validated: exactly 11389 document records.
  ✓ Zero PII attributes detected across all records.

[Check 6] Split Isolation and Zero Duplicate Leakage
  ✓ Dev Split: 7973 (70.01%)
  ✓ Val Split: 1693 (14.87%)
  ✓ Frozen Test Split: 1723 (15.13%)
  ✓ 100% duplicate clusters isolated: Zero cross-split leakage verified.

[Check 7] Production Database and Application Isolation
  ✓ Zero application routes or components reference raw dataset folders.
  ✓ Neon database models and migrations have zero Kaggle dataset schemas.

[Check 8] Manifest Summary Metrics Integrity
  ✓ Dataset A distinct usable documents: 2481
  ✓ Dataset B distinct usable documents: 8311
  ✓ Total distinct usable documents: 10792

============================================
   ALL 8/8 V5.0.1 CHECKS PASSED (100%)
============================================
```

---

## 10. Files Modified & Created

| Path | Action | Description |
| :--- | :--- | :--- |
| [`.gitignore`](file:///Users/quantumanant/aitathastu/.gitignore) | Modified | Added `benchmarks/` to ensure private manifest and split catalogs remain untracked. |
| [`.vercelignore`](file:///Users/quantumanant/aitathastu/.vercelignore) | Created | Excluded `resume 2/`, `Resumes PDF/`, `benchmarks/`, `Anant-Kumar-Resume.pdf`, and OCR models from Vercel deployment bundles. |
| [`package.json`](file:///Users/quantumanant/aitathastu/package.json) | Modified | Registered `test:v5-0-1-audit` verification script. |
| [`scripts/benchmark_audit_and_registry.py`](file:///Users/quantumanant/aitathastu/scripts/benchmark_audit_and_registry.py) | Created | Standalone audit, cryptographic hashing, duplicate clustering, and split generator. |
| [`scripts/verify-v5-0-1-dataset-audit.ts`](file:///Users/quantumanant/aitathastu/scripts/verify-v5-0-1-dataset-audit.ts) | Created | TypeScript automated verification suite for safety boundaries and split isolation. |
| [`benchmarks/README.md`](file:///Users/quantumanant/aitathastu/benchmarks/README.md) | Created | Documentation explaining benchmark workspace governance and privacy policies. |
| [`benchmarks/manifest.json`](file:///Users/quantumanant/aitathastu/benchmarks/manifest.json) | Created | 11,389-record operational zero-PII metadata catalog. |
| [`benchmarks/manifest_summary.json`](file:///Users/quantumanant/aitathastu/benchmarks/manifest_summary.json) | Created | Machine-readable metrics summary and validation metadata. |
| [`benchmarks/splits/dev.json`](file:///Users/quantumanant/aitathastu/benchmarks/splits/dev.json) | Created | 7,973 document IDs assigned to development and rule tuning. |
| [`benchmarks/splits/val.json`](file:///Users/quantumanant/aitathastu/benchmarks/splits/val.json) | Created | 1,693 document IDs assigned to validation. |
| [`benchmarks/splits/test_frozen.json`](file:///Users/quantumanant/aitathastu/benchmarks/splits/test_frozen.json) | Created | 1,723 document IDs sealed in the frozen holdout test partition. |
| [`docs/V5_0_1_DATASET_AUDIT.md`](file:///Users/quantumanant/aitathastu/docs/V5_0_1_DATASET_AUDIT.md) | Created | Complete engineering and legal audit report (this document). |

---

## 11. Remaining Blockers & Next Phase Handoff

- **Blockers for Phase V5.0.1:** **None.** All Phase V5.0.1 objectives are complete and verified.
- **Rules Enforced:**
  - Zero modifications to the resume extraction engine in this phase.
  - Zero deployment of raw resume data.
  - Zero PII printed to logs or reports.
- **Ready for Next Phase:** The evaluation workspace is securely quarantined, the frozen splits are sealed, and the deterministic test harness is ready for extraction engine benchmarking.
