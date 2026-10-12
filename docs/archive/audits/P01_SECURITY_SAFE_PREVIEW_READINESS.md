# P0.1 security-safe preview readiness

Date: 2026-10-11 (Asia/Kolkata). No database credential was rotated, no production configuration or student record was changed, and no push or deployment was made in this preparation pass. The preview ingestion gate remains closed.

## Requirement status

| Requirement | Status | Evidence and exact blocker |
|---|---|---|
| 1. Credential exposure audit | **FAIL** | One real-database credential and one isolated-preview credential were pasted into this chat. The isolated-preview credential also appeared in earlier Vercel CLI `--env` arguments and was sent to a completed preview deployment. The real-database credential exists in ignored local `.env`, `.env.local`, and `.vercel/.env.production.local`. The last file was locally readable by other users (`0644`); permissions were tightened to `0600`. Git history (70 commits), tracked HEAD, and the current source diff have no Neon password-token matches; older tracked reports mention endpoint hostnames without credentials. Local `.next` and `.vercel/output` artifacts had no matching credentials or endpoint markers. Remote Vercel build logs, env metadata, and complete deployment history could not be audited because the connected API returned 403 for this project scope and the CLI could not resolve its API host. Treat those remote surfaces as **BLOCKED**, not clean. |
| 2. Rotation checklist without production mutation | **PASS** | Checklist below. Production database and student data were left intact. |
| 3. New least-privilege isolated-preview credential | **BLOCKED** | The connected Neon account lists a different project and region, the Neon CLI is unavailable, and the browser console requires login. The target isolated branch cannot be managed through the present connection. Role name, grants, and verification checks are prepared below; no password or connection string was generated or transmitted. |
| 4. Protected Vercel Preview setting | **BLOCKED** | The Vercel connection returns 403 for this project scope; CLI API DNS fails; the browser dashboard requires login. A new Preview-only `DATABASE_URL` Secret must be entered in the project dashboard or approved integration by an authorized operator. Do not use a CLI argument, chat, report, or Git. |
| 5. Ingestion security gate | **PASS** | `CORE_INGESTION_SECURITY_APPROVED` remains `false` in the example configuration; no deployed value was changed. The user explicitly instructed us to keep the gate closed. Deployed OCR therefore remains blocked by design. |
| 6. Pending changes and proposed build | **PASS (local)** | Base HEAD `05ce6a48f981`; the working tree is uncommitted. Latest import candidate fixes are present in the orchestrator, sync route, and Step 6 UI: imports report `candidateCount`, create zero canonical evidence/project rows before confirmation, and preserve source snapshots. A fictional five-record LinkedIn export passed the focused persistence gate. Typecheck, lint, `git diff --check`, and a local production build passed. `DATABASE_AUTO_MIGRATE=false` now prevents preview runtime DDL when configured. This exact working tree has not been deployed. |
| 7. Deployment approval | **PASS** | No push or deployment was attempted in this preparation pass. Approval should be requested only after the new role, protected Preview variable, branch identity, and security checks are verified. |
| 8. Final verification plan | **PASS** | Plan below. No preview OCR or production-readiness claim is made. |

## Production-preserving rotation checklist

These are operator actions for a separate approved maintenance window, not work executed in this pass.

1. Inventory every consumer of the real-database credential, including Production Vercel, other hosting or jobs, local files, and historical preview deployments. Review Neon connection activity and Vercel access/build logs without exporting secret values.
2. Confirm Neon backup or point-in-time restore availability and record a recovery point. Preserve the existing database, schema, and student rows; perform no reset, restore, or destructive migration.
3. Provision a replacement production credential with the permissions actually required by each service. Store it directly in each authorized secret manager as a Production-only Secret. Do not paste it into chat, shell arguments, Git, build logs, or a report.
4. In a separately approved production change, update one consumer at a time, deploy it, verify sign-in, reads, writes, and student ownership, then move to the next consumer. Keep an overlap window so the old credential can still be used for rollback while the new path is verified.
5. After every consumer and retained deployment is moved or retired, reset or revoke the exposed production credential and terminate its active connections as appropriate. Verify the old credential fails and the new one works. Remove or replace local ignored copies and review service logs for access attempts.
6. Rotate the exposed isolated-preview owner credential separately after the new restricted role is installed and any old preview deployment using it is retired. Environment variable changes apply to new deployments, so old deployments must be accounted for. [Vercel environment guidance](https://vercel.com/docs/environment-variables).

## Isolated-preview role and environment preparation

Use the existing isolated Neon branch previously tested with synthetic data. In the Neon Console, first verify its project, branch, database, and compute identity, and confirm it contains no production student rows. The connected Neon account currently exposes another project, so this verification needs the correct project connection or an authorized operator in that console.

On that branch only, create a new login role named `aitathastu_preview_app` in Neon's role UI and let Neon generate its password. Keep the password in that UI and transfer the resulting **pooled** application connection string directly to Vercel's project Settings → Environment Variables as a **Secret** scoped only to **Preview** (prefer a dedicated preview Git branch). No credential value belongs in this document or the CLI command line. Vercel's current Config/Secret model makes Secret values unreadable after saving. [Vercel Secret types](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types).

After the branch schema has been initialized by its owner or migration role, apply these grants **only on the isolated branch**, using the Neon SQL Editor as the branch owner. The app role must not own tables or inherit the owner role:

```sql
GRANT CONNECT ON DATABASE neondb TO aitathastu_preview_app;
GRANT USAGE ON SCHEMA public TO aitathastu_preview_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aitathastu_preview_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aitathastu_preview_app;
```

Check that the new role has no `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, database/schema `CREATE`, table `TRUNCATE`, or owner-role membership. Reapply only the needed grants after future owner-run migrations. The application's Preview environment also needs `DATABASE_MODE=postgres`, `DATABASE_AUTO_MIGRATE=false`, and `CORE_INGESTION_SECURITY_APPROVED=false`. The new code checks for an initialized schema and fails closed instead of attempting DDL when automatic migrations are disabled. Preview-only session, handoff, webhook, and token-encryption secrets still require separate operator certification before the ingestion gate could ever be reconsidered; this pass leaves it closed.

The target Neon project and Vercel project scope must be accessible through the approved connections before we can verify role attributes, Preview variable scope/type, and deployment history. Login tabs for both consoles were left open for the user; no credentials were entered. **Do not send any URL or password in chat.**

## Verification after configuration and explicit deployment approval

1. Freeze and review the exact source revision; confirm the import changes and `DATABASE_AUTO_MIGRATE=false` path are included. Verify Preview has only the new branch role's `DATABASE_URL` Secret and that Production remains mapped to its own database. Confirm the ingestion gate is still closed.
2. After explicit approval, deploy to Preview only. Check deployment identity, function bundle, build logs, `/api/ready`, and the expected security-gate response. A closed gate is not an OCR pass.
3. Only after separate preview secret rotation and security certification, obtain a separate authorization to open the gate. Then upload fictional native, image-only, vector-outline, mixed-page, and DOCX fixtures through the actual preview API. Confirm `ocrUsed=true` for image/vector cases, real extracted text, candidate provenance, stage times, and worker/PDF/canvas/WASM logs.
4. Check full CV extraction: two schools, two jobs, three projects, skills without invented proficiency, certification, award, publication, patent application, and discovered GitHub/LinkedIn links. Keep every extracted claim pending review.
5. Test Digital Footprint **Review → Consent → Import → Confirm** with an authorized public account. Verify rate limits, no invented provider records, provenance, repeat-import idempotence, and that unconfirmed candidates never enter canonical evidence or projects.
6. Run two independent preview student identities through upload, review, Step 8, dashboard, and Person 360. Compare API and isolated Neon records, including ownership, rejected claims, refresh during and after processing, logout/re-login, and repeat upload.
7. Monitor browser exceptions and Vercel function logs through the journey, including the old object-valued candidate case and React Error #31. Record any failures and rerun only the affected gates. Keep production untouched until all critical preview gates pass.

## Exact deployment blockers

1. Correct Neon project/branch access is missing, so the restricted preview role does not exist and its isolation/privileges cannot be verified.
2. Vercel project access is unavailable through the current connector (403) and CLI network path, so the new Preview-only Secret and deployment history cannot be verified.
3. The user has not authorized deployment and explicitly requires approval after secure configuration.
4. `CORE_INGESTION_SECURITY_APPROVED` must remain closed; therefore preview OCR certification is blocked even after a Preview deployment until separate security prerequisites are met.
