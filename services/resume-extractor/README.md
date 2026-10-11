# AI Tathastu Universal Resume Extractor Service

Authoritative deterministic resume extraction engine for AI Tathastu. Deployed as a Docker Web Service on Render, communicating securely with the AI Tathastu Next.js frontend deployed on Vercel and Neon PostgreSQL.

## Architecture

- **Runtime**: Python 3.13 / FastAPI / Uvicorn
- **OCR Engine**: Tesseract OCR (with native PDF extraction fast-path)
- **Computer Vision**: OpenCV Headless / Pillow
- **Contracts**: Canonical Schema Version 2.0 (`contracts/resume-profile-v2.schema.json`)
- **Authentication**: Scoped service-to-service authorization (`X-User-Id`, `X-User-Role`, `X-Org-Id`) and short-lived HMAC user tokens (`u.{payload}.{signature}`)
- **Persistence**: Durable document object storage with strict tenant ownership

## Canonical Information Groups (15)

1. `identity`: full_name, professional_headline, professional_identity
2. `contact`: email, phone, location, website
3. `summary`: professional_summary, career_objective
4. `education`: qualification, degree_title, institution, coursework, expected_graduation, grade
5. `experience`: organization, job_title, responsibility, contribution, technologies, evidence_url
6. `internships`: provider, role, duration, skills, completion_status
7. `skills`: canonical_name, original_wording, category, proficiency
8. `projects`: title, description, technical_domain, contribution, technologies, github_url
9. `awards`: name, type, issuer, date, rank
10. `certifications`: title, issuer, credential_id, verification_url, issue_date
11. `research`: title, type, venue, year, doi, scholar_url
12. `books_patents`: type, title, authors, publisher, filing_date
13. `leadership`: organization, role, outcome, evidence_url
14. `digital_footprint`: platform, original_url, normalized_url, discovery_source
15. `extraction_metadata`: document_id, format, page_count, ocr_used, processing_seconds, text_quality

## API Endpoints

| Method | Path | Auth Scope | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Service health & Tesseract version |
| `POST` | `/api/resumes/upload` | `upload` | Secure document upload |
| `POST` | `/api/resumes/extract` | `extract` | Asynchronous extraction job |
| `GET` | `/api/resumes/{id}/status` | `status` | Extraction progress & warnings |
| `GET` | `/api/resumes/{id}` | `view` | Full Schema v2.0 document profile |
| `GET` | `/api/resumes/{id}/sections` | `view` | Extracted section lines & layout |
| `POST` | `/api/resumes/{id}/review` | `review` | Field/record review & auditable history |
| `GET` | `/api/resumes/{id}/export` | `export` | JSON or summary text export |
| `POST` | `/api/resumes/{id}/retry` | `retry` | Retry failed extraction |
| `DELETE` | `/api/resumes/{id}` | `delete` | Document deletion with owner check |

## Local Development

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements-dev.txt

# Run service
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run tests
pytest tests/ -v
```

## Render Deployment

This service is configured for zero-configuration deployment via `render.yaml`:
- **Service Type**: Docker Web Service
- **Build Context**: `services/resume-extractor`
- **Dockerfile**: `services/resume-extractor/Dockerfile`
- **Port**: Dynamically binds to `$PORT`
- **Health Check**: `/health`
- **Security**: Runs as non-root user `extractor` (UID 10001)
