# AI Tathastu — Data Retention & Lifecycle Policy (Phase D)

**Standard:** Purpose limitation, data minimization, and secure disposal.

---

## 1. Data Classification & Retention Schedules

| Data Category | Purpose | Retention Period | Storage Location | Disposal / Anonymization Method |
| :--- | :--- | :--- | :--- | :--- |
| **Raw Resume Files (PDF / DOCX)** | Text parsing during onboarding | **0 Days (Ephemeral)** | In-memory Buffer only | Destroyed immediately after parser extraction completes. Never saved to persistent disk or cloud storage. |
| **Extracted Resume Text** | Suggestion generation | **Session Only** | Client browser state | Erased on session end; only student-confirmed claims persist to database. |
| **Source Snapshots (GitHub Metadata)** | Change detection and commit provenance | **180 Days** | Database (`source_snapshots`) | Auto-pruned after 180 days if superseded by newer snapshots; archived on student disconnect. |
| **AI Audit Logs** | Observability, latency tracking, rate limit monitoring | **90 Days** | Database (`ai_audit_logs`) | Rotated and purged after 90 days. Contains zero PII or raw prompts. |
| **Sync Logs & Webhook Deliveries** | Ingestion deduplication and delivery debugging | **30 Days** | Memory / Ingestion logs | Dedup set evicted continuously; structured log entries purged after 30 days. |
| **Integration Events (Study LPU, Padho Code, ERIS, MentorMaze)** | Ecosystem activity reconciliation and auditing | **365 Days** | Database (`integration_events`) | Compressed after 180 days; retained for academic term audits. |
| **OAuth Access Tokens (GitHub)** | Authenticated API calls | **Active Connection Lifetime** | Database (`external_connections`) | Deleted immediately when student disconnects GitHub via the Connections page. |
| **Handoff Tokens (Partner Apps)** | Single-sign-on redirect | **5 Minutes (300 seconds)** | Signed JWT / URL param | Ephemeral; expires cryptographically after 300s. |
| **User Profile & Evidence History** | Student career readiness & person 360 | **Account Lifetime** | Database (`persons`, `evidence_items`, `goals`) | Deleted or pseudonymized upon verified account deletion request. |
| **Deleted Accounts** | Right to erasure | **Immediate + 30 Day Backup Flush** | All tables | Hard cascade delete across `persons`, `sessions`, `goals`, `evidence_items`. Backups cycle out after 30 days. |

---

## 2. PII Minimization in AI Provider Payloads

When sending context to external LLM providers (Gemini, Groq, OpenRouter, etc.):
1. **Allowed Context:** Normalized technology metadata, public repository README excerpts, active goal titles, evidenced skill subjects.
2. **Prohibited Context (Scrubbed via Context Firewall):**
   - Personal email addresses (`[EMAIL_REDACTED]`)
   - Phone numbers (`[PHONE_REDACTED]`)
   - Salary and compensation figures (`[COMPENSATION_REDACTED]`)
   - Student national IDs, home addresses, or private financial records
   - Confidential interview feedback transcripts

---

## 3. Account Deletion & Revocation Workflow

When an authenticated student requests account deletion:
1. Active sessions are terminated immediately via `invalidateSession`.
2. Connected integration links (`integration_identity_links`) are revoked.
3. OAuth tokens in `external_connections` are wiped.
4. Database cascade deletes person profile, goals, evidence, and roadmap milestones.
5. Verifier decision records retain immutable audit logs with `personId` anonymized to prevent verifier audit tampering.
