# AI TATHASTU — REAL DATA SOURCE MATRIX & CONNECTOR AUDIT

**Document Version**: 1.0.0 (Phase F Certification)  
**Status**: Real Data Connectors Active & Policy Guardrails Certified  
**Verification Date**: October 2026  

---

## 1. External Source Connector Architecture

AI Tathastu adheres to a single standard connector interface (`lib/connectors/registry.ts` and `lib/acquisition/acquisition-service.ts`) enforcing:
- Explicit student consent and authorization state
- Bounded least-privilege access scopes
- Data provenance tracking (every record retains source origin, URL, and observation timestamp)
- Revocation and deletion capabilities
- Strict SSRF (Server-Side Request Forgery) protection against private IPs, AWS metadata endpoints (`169.254.169.254`), and internal network ranges.

---

## 2. Source Classification & Operational Matrix

| Data Source | Ingestion Method | Supported Fields | Provenance & Trust Level | Status Classification | Notes & Restrictions |
|---|---|---|---|---|---|
| **GitHub Public Repositories** | GitHub REST API v3 / App | Repositories, descriptions, primary language, README content, topic tags, commit metadata | `source_detected` (Unverified) | **Implemented & Tested in Staging; Production App Blocked** | Read-only scope (`repo:read`, `public_repo`). Never clones entire codebase. |
| **GitHub Signed Webhooks** | HTTP POST to `/api/integrations/github/webhook` | `push`, `repository` events, delivery ID | `source_detected` | **Tested in Staging (HMAC SHA-256 Validated)** | Requires `X-Hub-Signature-256`. Deduplicates delivery IDs; enqueues async processing. |
| **Resume Upload (PDF / DOCX)** | Direct multipart upload to `/api/resume/extract` | Candidate education, experience, detected tools, project snippets | `self_reported` (Unverified) | **Tested Live & Verified** | Magic byte validation (`%PDF-`, `PK\x03\x04`). Maximum 10MB file limit. Extracted keywords never auto-promoted to verified. |
| **LinkedIn Profile** | Student-provided HTTPS URL | Profile URL, display slug | `self_reported` | **Tested Live (Profile Reference Only)** | Uncontrolled scraping is strictly forbidden by policy and Terms of Service. |
| **LeetCode Profile** | Student-provided profile URL | Profile handle, URL | `self_reported` | **Tested Live (Reference Only)** | Automated scraping prohibited; stats displayed only via verified student claims. |
| **CodeChef Profile** | Student-provided profile URL | Profile handle, URL | `self_reported` | **Tested Live (Reference Only)** | Reference link only. |
| **HackerRank Profile** | Student-provided profile URL | Profile handle, URL | `self_reported` | **Tested Live (Reference Only)** | Reference link only. |
| **HackerEarth Profile** | Student-provided profile URL | Profile handle, URL | `self_reported` | **Tested Live (Reference Only)** | Reference link only. |
| **Student Portfolio / Web** | HTTPS crawl with SSRF filter | Page title, OpenGraph metadata, text description | `self_reported` | **Tested in Staging (SSRF Enforced)** | Blocks loopback (`127.0.0.1`), LANs (`10.0.0.0/8`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`). |

---

## 3. GitHub Project Analysis Pipeline

When an authorized GitHub repository is imported:

```
1. Fetch Metadata (Repository name, description, stars, primary language, updated_at)
       │
       ▼
2. Select Relevant Manifests (package.json, requirements.txt, pyproject.toml, README.md)
       │
       ▼
3. Validate File Size & MIME (Exclude binaries, limit README to 20,000 characters)
       │
       ▼
4. Dependency Inspection (Deterministic extraction: PyTorch, TensorFlow, Scikit-learn, etc.)
       │
       ▼
5. Structured Candidate Generation (Zod GitHubProjectInterpretationSchema)
       │
       ▼
6. Student Contribution Review Screen (Student specifies personal role: ML modeling, backend, etc.)
       │
       ▼
7. Persist Confirmed Project (Recorded in Neon PostgreSQL `projects` and `evidenceItems`)
       │
       ▼
8. Recompute Recommendations (Next Best Actions adapt to newly confirmed repository)
```

- **Core Rule**: Ingesting a repository NEVER grants verified mastery. Repository code is treated as candidate evidence (`source_detected`).

---

## 4. Source Refresh & Stale-Source Detection

1. **GitHub Webhooks**: Signed deliveries invalidate cached student project metadata within <1,000ms.
2. **Reconciliation Sweeps**: Background queue (`GITHUB_SYNC`) executes periodic checks for repositories unmodified in >30 days.
3. **Manual Refresh**: Throttled to 1 sync per repository per 15 minutes to respect GitHub API rate limits.
4. **Revocation & Deletion**: When a student removes a connected GitHub account or project, all associated unverified evidence items are archived and omitted from the active Person 360 graph.
