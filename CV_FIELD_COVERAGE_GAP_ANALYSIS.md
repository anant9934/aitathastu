# AI TATHASTU — CV FIELD COVERAGE GAP ANALYSIS
**Document ID:** `CV_FIELD_COVERAGE_GAP_ANALYSIS.md`  
**Date:** October 17, 2026  
**Status:** COMPLETE DIAGNOSTIC AUDIT  
**Target:** Option C Hybrid CV Extraction Pipeline  
**Engineers:** Principal Resume Parsing Engineer, OCR Engineer, Next.js/TypeScript Engineer, Python Engineer, Security Auditor, QA Lead  

---

## 1. Executive Summary & Diagnostic Approach

An end-to-end diagnostic audit of the AI Tathastu Option C Hybrid CV Extraction engine was executed against four locally supplied diagnostic test resumes and production UI screenshots:
1. **Resume 1:** `Anant-Kumar-Resume(3).pdf` — Anant Kumar (Single-page native PDF, text layer intact, 3,418 characters, single column with subsections).
2. **Resume 2:** `myresume(2).pdf` — Shivam Kumar Singh (Single-page vector graphics PDF, 2,564 vector path curves, 0 font glyphs, requires OCR/rasterization).
3. **Resume 3:** `Image_7.pdf` — Liz Shaw (Single-page raster scan PDF, 1 embedded image, 2-column asymmetric layout with divider rules).
4. **Resume 4:** `Image_6.pdf` — Emily Saavedra (Single-page raster scan PDF, 1 embedded image, 2-column layout with header banner).
5. **Observed UI Outputs:** Production screenshots from Desktop (`Screenshot 2026-10-17 at 2.59.52 AM.png`, `4.49.28 PM.png`, `6.05.51 PM.png`).

### Key Audit Findings
1. **Section Heading Truncation & Bleed:** Section headings such as `SKILLS SUMMARY`, `EXPERIENCE & LEADERSHIP`, `SELECTED PROJECTS & CLIENT WORK`, `RESEARCH, PATENTS & BOOKS`, `TRAINING`, `QUALIFICATIONS`, `RELEVANT LANGUAGES`, `VOLUNTEERING`, and `CERTIFICATES` were unmapped in `SECTION_HEADINGS` (`lib/resume/deterministic-extractor.ts`) and `HEADINGS` (`services/resume-extractor/app/document.py`). Unmatched content was blindly assigned to the prior section, causing entire CVs to collapse into 50+ lines of malformed education records.
2. **Education Grouping & Placeholder Degeneration:** When institutions and degrees were on separate lines, degrees were attributed to the subsequent institution (e.g., LPU's B.Tech assigned to Pious Mission School), board results were extracted as institutions (e.g., `"Intermediate, CBSE; 80.8%"`), and placeholders (`"Degree"`, `"Unknown Institution"`) were emitted.
3. **Multi-Line Experience & Projects Loss:** Experiences and projects spanning multi-line headers (`Organization \n Location \n Role \n Dates`) were discarded or fractured into standalone titles. In Shivam Kumar Singh's CV, four founder/leadership roles were misclassified as 8 separate project fragments.
4. **Research, Patents & Books Collapsed:** Co-authored books and patent co-inventorships were either dropped entirely or flattened into uninformative award strings.
5. **Digital Footprint Handle Extraction Defect:** Labeled handle patterns (`GitHub: ...`, `LinkedIn: ...`) failed on URLs containing `/`, capturing `github.com` and `linkedin.com` as usernames and constructing fake profiles (`https://github.com/github.com`, `https://www.linkedin.com/in/linkedin.com`). Multiple independent portfolios (`anantkumar.site`, `anantshivam.online`) were ignored.
6. **Multi-Column OCR Reading Order Interleaving:** Rasterized 2-column resumes (`Image_6.pdf`, `Image_7.pdf`) scanned across horizontal lines, merging unrelated columns (`SpyBiotech, Inc.` + `& skills` -> `SpyBiotech, Inc. & skills`), and cropping out styled banner titles (`Emily Saavedra`).
7. **Consent & UI Transparency Inconsistency:** UI states *"No generative AI reads your CV"* with a parsing consent checkbox, yet the backend unconditionally routed to external LLM without explicit enrichment consent, surfacing `AI_QUOTA_EXCEEDED` errors to the user when quota ran out.

---

## 2. Source Ground Truth vs Observed Extraction Comparison

### 2.1 Resume 1 — Anant Kumar (`Anant-Kumar-Resume(3).pdf`)

| Field / Claim | Source Document Evidence | Baseline Extraction Output | Classification | Defect Pipeline Stage |
| :--- | :--- | :--- | :--- | :--- |
| **Full Name** | `Anant Kumar` (Header) | `Anant Kumar` | Correct | Deterministic Entity Extraction |
| **Email** | `720anant@gmail.com` | `720anant@gmail.com` | Correct | Deterministic Entity Extraction |
| **Phone** | `+91 7209536120` | `+91 7209536120` | Correct | Deterministic Entity Extraction |
| **Location** | `Gaya, Bihar, India` | `Gaya, Bihar, India` | Correct | Deterministic Entity Extraction |
| **LinkedIn** | `linkedin.com/in/quantumanant01` | `https://www.linkedin.com/in/quantumanant01` AND `https://www.linkedin.com/in/linkedin.com` | Duplicate & Wrong Value | Deterministic Entity Extraction (Handle regex) |
| **GitHub** | `github.com/anant9934` | `https://github.com/anant9934` AND `https://github.com/github.com` | Duplicate & Wrong Value | Deterministic Entity Extraction (Handle regex) |
| **Primary Portfolio**| `anantkumar.site` | *None* | Missing | Deterministic Entity Extraction (Portfolio regex) |
| **Joint Portfolio** | `anantshivam.online` | *None* | Missing | Deterministic Entity Extraction (Portfolio regex) |
| **Summary / Profile**| `B.Tech CSE (AI & ML) student, founder, researcher...` | *None* (assigned to header) | Missing | Section Classification (`PROFILE` unmapped) |
| **Edu 1: Institution**| `Lovely Professional University` | `• Lovely Professional University` | Correct | Deterministic Entity Extraction |
| **Edu 1: Degree** | `B.Tech, Computer Science & Engineering (AI & ML)` | `"Degree"` (placeholder) | Wrong Value | Deterministic Entity Extraction (Line split failure) |
| **Edu 1: Dates** | `Aug. 2025 – Present` | *None* | Missing | Deterministic Entity Extraction (Year regex) |
| **Edu 1: CGPA** | `8.84 / 10` | *None* | Missing | Deterministic Entity Extraction (Line split failure) |
| **Edu 2: Institution**| `Pious Mission School, Arwal` | `• Pious Mission School, Arwal` | Correct | Deterministic Entity Extraction |
| **Edu 2: Degree** | `Intermediate, CBSE; 80.8%` | `B.Tech` (stolen from Edu 1!) | Wrong Parent Record | Deterministic Entity Extraction (Chunking error) |
| **Edu 2: Field** | *None* | `B.Tech, Computer Science & Engineering...` | Wrong Parent Record | Deterministic Entity Extraction (Chunking error) |
| **Edu 2: Percentage**| `80.8%` | *None* | Missing | Deterministic Entity Extraction |
| **Edu 3: Board Record**| `Intermediate, CBSE; 80.8%` | `Intermediate, CBSE; 80.8%` as Institution! | Wrong Category | Deterministic Entity Extraction |
| **Edu 4: Hallucinated**| *From Experience: Study LPU Online* | `• Study LPU Online` as Institution! | Wrong Category | Section Classification (Experience as Edu) |
| **Skills Summary** | 6 categories, 24 skills | 0 skills extracted | Missing | Section Classification (`SKILLS SUMMARY` unmapped) |
| **Exp 1: Verbinden**| `Founders Verbinden` / `President` / `Aug. 2025 – Present` | *None* (0 experiences extracted) | Missing | Section Classification (`EXPERIENCE & LEADERSHIP`) |
| **Exp 2: MangalKit** | `MangalKit` / `Founder & CEO` / `2025 – Present` | *None* | Missing | Section Classification (`EXPERIENCE & LEADERSHIP`) |
| **Exp 3: Study LPU** | `Study LPU Online` / `Founder / Builder` / `Feb. 2026 – Present` | *None* | Missing | Section Classification (`EXPERIENCE & LEADERSHIP`) |
| **Proj 1: GeoJeevan** | `GeoJeevan AI` / Environmental Intelligence | *None* (0 projects extracted) | Missing | Section Classification (`SELECTED PROJECTS...`) |
| **Proj 2: GyanMatrix**| `GyanMatrix` / EdTech & Mentorship | *None* | Missing | Section Classification (`SELECTED PROJECTS...`) |
| **Proj 3: QuickDorm** | `QuickDorm` / Quick Commerce | *None* | Missing | Section Classification (`SELECTED PROJECTS...`) |
| **Proj 4: Client Work**| `Client Work (Sai Enterprises, Aditya TVS)` | *None* | Missing | Section Classification (`SELECTED PROJECTS...`) |
| **Patent: DBMS** | `Patent: DBMS Predictive Execution` | `Patent: DBMS Predictive Execution...` (as generic award) | Wrong Category | Deterministic Entity Extraction (`RESEARCH...`) |
| **Book 1: The AI Student**| `Book: The AI Student... Author (Co-author: Mandeep Kumar)` | *None* | Missing | Deterministic Entity Extraction |
| **Book 2: Rhythm Code**| `Book: The Rhythm Code... Co-author` | *None* | Missing | Deterministic Entity Extraction |
| **Achievements** | Revenue 6L+, Reach 300+, Publications, Leadership | 4 entries as generic awards | Correct | Deterministic Entity Extraction |

---

### 2.2 Resume 2 — Shivam Kumar Singh (`myresume(2).pdf`)

| Field / Claim | Source Document Evidence | Baseline Extraction Output | Classification | Defect Pipeline Stage |
| :--- | :--- | :--- | :--- | :--- |
| **Document Type** | 2,564 vector paths, 0 text glyphs | OCR fallback triggered via rasterization | Correct | PDF Text Retrieval / OCR Recognition |
| **Full Name** | `SHIVAM KUMAR SINGH` | `SHIVAM KUMAR SINGH` | Correct | Deterministic Entity Extraction |
| **Email** | `shiviiii5165@gmail.com` | `shiviiii5165@gmail.com` | Correct | Deterministic Entity Extraction |
| **Phone** | `+91 9508108025` | `+91 9508108025` | Correct | Deterministic Entity Extraction |
| **LinkedIn** | `linkedin.com/in/shivam-kumar-singh-lpu` | Valid URL + Spurious `linkedin.com` handle | Duplicate & Wrong Value | Deterministic Entity Extraction (Handle regex) |
| **GitHub** | `github.com/shiviiii5165` | Valid URL + Spurious `github.com` handle | Duplicate & Wrong Value | Deterministic Entity Extraction (Handle regex) |
| **HackerRank** | `Python (Basic) \| HackerRank Dec 2025` | Spurious handle `"Dec"` (`hackerrank.com/Dec`) | Wrong Value | Deterministic Entity Extraction (Handle regex) |
| **Skills (Explicit)**| 5 category bullets, 26 skills | 21 skills extracted (missing multi-word/tools) | Low Confidence | Skill Taxonomy & Word Boundary |
| **Proj 1: TeachGenie**| `TeachGenie` + AI RAG assistant | Captured with tech | Correct | Deterministic Entity Extraction |
| **Proj 2: EduCore** | `EduCore` + School Management System | Captured with tech | Correct | Deterministic Entity Extraction |
| **Proj 3: Self-Car** | `Self-Surveillance Car System` | Captured with tech | Correct | Deterministic Entity Extraction |
| **Training Section** | Heading `TRAINING` | Treated as `projects` section! | Wrong Category | Section Classification (`TRAINING` unmapped) |
| **Work 1: Nayee Asha**| `Nayee Asha` / `Technical Advisor & Lead Developer` | Split into 2 separate fake projects! | Wrong Category & Grouping | Section Classification & Experience Chunking |
| **Work 2: Study LPU** | `Study LPU` / `Chief Operating Officer / Co-Founder` | Split into 2 separate fake projects! | Wrong Category & Grouping | Section Classification & Experience Chunking |
| **Work 3: MangalKit** | `MangalKit` / `Chief Operating Officer / Co-Founder` | Split into 2 separate fake projects! | Wrong Category & Grouping | Section Classification & Experience Chunking |
| **Work 4: Verbinden** | `Founders Verbinden` / `Vice President / Co-Founder` | Split into 2 separate fake projects! | Wrong Category & Grouping | Section Classification & Experience Chunking |
| **Certifications** | 7 certifications | 7 extracted, but dates merged into issuers | Wrong Value | Deterministic Entity Extraction |
| **Edu 1: LPU** | `Lovely Professional University` / `B.Tech CSE (AI & ML)` | Correctly grouped with CGPA 8.93 | Correct | Deterministic Entity Extraction |
| **Edu 2: School** | `Rajkiya Jila School, Arrah` / `Senior Secondary, BSEB; 89%` | Percentage captured | Correct | Deterministic Entity Extraction |

---

### 2.3 Resume 3 — Liz Shaw (`Image_7.pdf`)

| Field / Claim | Source Document Evidence | Baseline Extraction Output | Classification | Defect Pipeline Stage |
| :--- | :--- | :--- | :--- | :--- |
| **Document Type** | 1 embedded raster image, 2-column layout | Tesseract full-page OCR (PSM 3) | Low Confidence | Reading Order / OCR Segmentation |
| **Full Name** | `LIZ SHAW` | `"Web Developer and Designer"` | Wrong Value | Deterministic Entity Extraction (Header name) |
| **Headline/Title** | `Web Developer and Designer` | Extracted as candidate name! | Wrong Category | Deterministic Entity Extraction |
| **Email** | `liz@cthuliz.com` | `lizecthulizcom` (OCR typo) or dropped | Wrong Value / Missing | OCR Recognition & Email Regex |
| **LinkedIn / Web** | `WEB: linkedin.com/in/lizhelene` | Extracted as LinkedIn URL | Correct | Digital Footprint Discovery |
| **Education Section**| `EDUCATION` (Left col top) | 0 education records extracted | Missing | Reading Order & Section Classification |
| **Edu 1: Institution**| `Rochester Institute of Technology` | *None* | Missing | Reading Order & Section Classification |
| **Edu 1: Degree** | `B.Sc. with Honors, Biological Science` | *None* | Missing | Reading Order & Section Classification |
| **Edu 1: Minors** | `Minors in Computer Science and German` | *None* | Missing | Deterministic Entity Extraction |
| **Work Section** | `WORK EXPERIENCE` | 0 work experiences extracted | Missing | Reading Order (Interleaved across columns) |
| **Work 1: RIT** | `RIT ACADEMIC TECHNOLOGY SUPPORT` | *None* | Missing | Reading Order (Merged with Right Col CMS) |
| **Work 2: RWU** | `ROGER WILLIAMS UNIVERSITY` | *None* | Missing | Reading Order (Merged with Right Col Langs) |
| **Work 3: Zipcar** | `ZIPCAR SEATTLE` | *None* | Missing | Reading Order |
| **Work 4: Reporter**| `REPORTER MAGAZINE` | *None* | Missing | Reading Order (Merged with Right Col Refs) |
| **Work 5: Austin** | `AUSTIN MICHAEL INTERNET SOLUTIONS` | *None* | Missing | Reading Order |
| **Qualifications** | Heading `QUALIFICATIONS` | *None* | Missing | Section Classification (`QUALIFICATIONS` unmapped)|
| **Skills / Software**| Adobe Captivate, Flash, Illustrator, InDesign, Photoshop, Eclipse, Excel, Word, Pixelmator, Screenspresso, Sequel Pro | 0 skills extracted | Missing | Section Classification & Taxonomy |
| **CMS Tools** | Adobe Connect, b2evolution, CommuniCart, Confluence, Desire2Learn, Drupal, Google Analytics, Joomla, phpMyAdmin, PrestaShop, WordPress | 0 skills extracted | Missing | Section Classification & Taxonomy |
| **Relevant Languages**| `RELEVANT LANGUAGES` (CSS, HTML, Java, Javascript, PHP, SQL, UNIX scripting) | 0 skills extracted | Missing | Section Classification (`RELEVANT LANGUAGES` unmapped) |
| **References** | 4 professional references | Unsupported | Unsupported | System Architecture (Out of scope) |

---

### 2.4 Resume 4 — Emily Saavedra (`Image_6.pdf`)

| Field / Claim | Source Document Evidence | Baseline Extraction Output | Classification | Defect Pipeline Stage |
| :--- | :--- | :--- | :--- | :--- |
| **Document Type** | 1 embedded raster image, 2-column + banner | Tesseract full-page OCR (PSM 3) | Low Confidence | Reading Order / OCR Segmentation |
| **Full Name** | `Emily Saavedra` (Top styled banner) | *None* (entirely omitted!) | Missing | OCR Recognition (Banner box filtered out) |
| **Email** | `emilysaavedra@gmail.com` | `emilysaavedra@gmail.com` | Correct | Deterministic Entity Extraction |
| **Phone** | `078 3515 0056` | `078 3515 0056` | Correct | Deterministic Entity Extraction |
| **Address/Location** | `88 Hendford Hill, London B22 0GX, United Kingdom`| `88 Hendford Hill, London B22 0GX, United Kingdom` | Correct | Deterministic Entity Extraction |
| **Profile / Summary**| `Highly accurate and experienced Data Scientist...` | Joined with Education on line 1 | Missing / Corrupt | Reading Order (`4 Profile © Education`) |
| **Work 1: SpyBiotech**| `SpyBiotech, Inc.` / `Data Scientist` / `09/2017 - 02/2019` | 0 experiences extracted | Missing | Reading Order (`SpyBiotech, Inc. & skills`) |
| **Work 2: CGL** | `CGL, Inc.` / `Data Scientist` / `07/2016 - 09/2017` | 0 experiences extracted | Missing | Reading Order |
| **Edu 1: Chichester** | `University of Chichester` / `Mathematics and Statistics` / `09/2012 - 05/2016` / `First Class Honours` | 0 education records extracted | Missing | Reading Order & Section Classification |
| **Edu 2: Estepona** | `The International School Estepona` / `IB Diploma Programme` / `09/2010 - 05/2012` / `Distinction` | 0 education records extracted | Missing | Reading Order & Section Classification |
| **Languages** | `Spanish (Native)`, `English (Full)`, `French (Limited)` | 0 extracted | Missing | Section Classification & Taxonomy |
| **Computer Skills** | `Microsoft Office`, `MS SQL Server`, `Sisense`, `Zoho Analytics`, `GoodData`, `Qlik Sense` | 0 extracted | Missing | Section Classification (`COMPUTER/DATA ANALYTICS SKILLS`) |
| **Volunteering** | `Go Overseas` / `English Tutor` / `06/2014 - 08/2014` / `Suva, Fiji` | 0 extracted | Missing | Section Classification (`VOLUNTEERING` unmapped)|
| **Certificates** | `The Chartered Institute for IT` / `Professional Certificate in Data Analysis` / `10/2016` | 0 extracted | Missing | Section Classification (`Certificates` unmapped)|

---

## 3. Root Cause Attribution by Pipeline Stage

Tracing intermediate outputs proves each defect occurred at a specific stage:

```
[Uploaded Document]
        │
        ├─► [Stage 1: PDF Text Retrieval] 
        │         • PASSED for Anant Kumar (native text layer 3418 chars)
        │         • Correctly triggered OCR for Shivam Kumar (vector drawing), Liz Shaw, Emily Saavedra
        │
        ├─► [Stage 2: OCR Recognition] 
        │         • Top banner thresholding in Emily Saavedra failed to recognize "Emily Saavedra" in banner box.
        │         • OCR character substitution (e.g. `lizecthulizcom` instead of `liz@cthuliz.com`).
        │
        ├─► [Stage 3: Reading Order & Multi-Column Segmentation] 
        │         • FAILED on 2-column scanned PDFs (Liz Shaw, Emily Saavedra). Horizontal text scanning merged
        │           left and right column text into single corrupted lines (`SpyBiotech, Inc. & skills`).
        │
        ├─► [Stage 4: Section Classification] 
        │         • CRITICAL FAILURE across TS and Python extractors. Unmapped headings:
        │           - `SKILLS SUMMARY`, `COMPUTER/DATA ANALYTICS SKILLS`, `RELEVANT LANGUAGES`, `QUALIFICATIONS`
        │           - `EXPERIENCE & LEADERSHIP`, `TRAINING`, `VOLUNTEERING`
        │           - `SELECTED PROJECTS & CLIENT WORK`
        │           - `RESEARCH, PATENTS & BOOKS`
        │           - `CERTIFICATES`
        │         • Blind assignment to preceding section (`education`) dumped 52 lines of content into education!
        │
        ├─► [Stage 5: Deterministic Entity Extraction] 
        │         • Education: Naive line chunking misbound degrees to next institutions and made board records institutions.
        │         • Digital Footprints: Regex `\b(?:github|linkedin)[\s:]+@?([a-zA-Z0-9_\-\.]+)` halted at `/` and
        │           captured `linkedin.com` and `github.com` as candidate handles.
        │         • Certifications: Date tokens were appended to issuer names instead of being cleanly separated.
        │         • Patents & Books: No typed extraction logic existed for publications, patents, and books.
        │
        ├─► [Stage 6: Consent & UI Transparency] 
        │         • UI stated "No generative AI reads your CV", yet backend unconditionally fell through to LLM,
        │           failing with `AI_QUOTA_EXCEEDED` when quota was exhausted.
        │
        └─► [Stage 7: Review Candidate Construction]
                  • Review UI flattened complex nested records into simple string chips without showing
                    organization/role pairs, issuers, dates, or structured claims.
```

---

## 4. Remediation Plan by Phase

Based on verified root causes, the following narrowly scoped upgrades will be executed:

1. **Phase 2 — Section Recognition:**
   - Expand `HEADINGS` in Python (`services/resume-extractor/app/document.py`) and `SECTION_HEADINGS` in TypeScript (`lib/resume/deterministic-extractor.ts`).
   - Add normalized patterns for all real headings: `SKILLS SUMMARY`, `EXPERIENCE & LEADERSHIP`, `SELECTED PROJECTS & CLIENT WORK`, `RESEARCH, PATENTS & BOOKS`, `TRAINING`, `RELEVANT LANGUAGES`, `QUALIFICATIONS`, `COMPUTER/DATA ANALYTICS SKILLS`, `VOLUNTEERING`, `CERTIFICATES`.
   - Prevent blind bleed into prior section; fallback unmatched blocks to `"unknown"` rather than corrupting `"education"`.

2. **Phase 3 — Education Extraction:**
   - Implement stateful multi-line record grouping: Associate degrees, institutions, locations, and grade metrics accurately.
   - Forbid placeholder generation (`"Degree"`, `"Unknown Institution"`).
   - Distinguish secondary/intermediate boards from higher education institutions.

3. **Phase 4 — Work, Projects, and Leadership:**
   - Support multi-line visual blocks (`Organization \n Location \n Role \n Dates \n Bullets`).
   - Group `TRAINING`, `VOLUNTEERING`, and `LEADERSHIP` into typed experiences rather than misclassifying as projects.
   - Maintain parent-child relationships between roles and bullet achievements.

4. **Phase 5 — Certifications, Research, Patents, Books:**
   - Cleanly separate certificate titles, issuers, and dates.
   - Introduce typed extraction for `patents`, `books`, and `publications` with author/co-author metadata.

5. **Phase 6 — Skill Taxonomy & Word Boundary:**
   - Support sub-category bullets (`Languages: ...`, `AI & Data: ...`).
   - Expand curated skill taxonomy to include modern AI/ML, data analytics, cloud, and core development tools.
   - Enforce strict word boundaries and drop non-technical incidental words.

6. **Phase 7 — Digital Footprint Classification:**
   - Fix handle regex to reject domain strings (`linkedin.com`, `github.com`).
   - Support multi-portfolio extraction (`anantkumar.site`, `anantshivam.online`).
   - Return uncertain links for user confirmation without silent invention.

7. **Phase 8 — Consent & UI Truth:**
   - Decouple document parsing consent from external AI enrichment consent.
   - Default to deterministic Tier 1 extraction when external AI consent is not granted.
   - Ensure `AI_QUOTA_EXCEEDED` does not block deterministic onboarding.

8. **Phase 9 & 10 — Rich Review Candidates & Synthetic Regression Tests:**
   - Build comprehensive synthetic regression test suite in `scripts/test-cv-extraction-regression.ts`.
   - Verify precision and recall across all categories.

---
*Report generated and validated against real diagnostic fixtures.*
