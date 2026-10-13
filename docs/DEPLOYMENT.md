# Deployment

Two services:

| Service | Host | Config |
|---|---|---|
| Next.js app | Vercel, production branch `newmain` | `vercel.json` |
| Resume extractor (Python) | Render (Docker), branch `newmain` | `render.yaml` |

## 1. Database (Neon)

1. Create the database; copy the pooled connection string into `DATABASE_URL`.
2. Apply the schema before the first deploy and **before every deploy that changes `lib/db/migration-sql.ts`**:
   ```bash
   DATABASE_URL='postgres://...' npm run db:migrate
   ```
   The app never runs DDL on a production cold start.
3. If the output (or `scripts/report-duplicate-keys.ts`) says a unique index was skipped because of
   duplicate rows, resolve those rows and re-run `db:migrate`.

## 2. Resume extractor (Render)

1. Render Dashboard → Blueprints → connect the repo; `render.yaml` defines `aitathastu-resume-extractor`.
   For the existing `aitathastu` service, use branch `newmain`, root directory
   `services/resume-extractor`, and Dockerfile `./Dockerfile` relative to that root.
2. Set `EXTRACTOR_API_TOKEN` (Render can generate it), optionally `EXTRACTOR_VERIFIER_TOKEN`,
   and `ALLOWED_ORIGIN` = your `APP_BASE_URL`.
3. Check `GET https://<service>.onrender.com/health`. `tesseract_version` must not be `unavailable`.
4. `MAX_UPLOAD_MB` is 4, matching the app's limit (`lib/config/upload-limits.ts`). Keep them equal.

## 3. Next.js app (Vercel)

1. Use the existing `professor-f740/aitathastu` Vercel project. Under Settings →
   Environments → Production, set branch tracking to `newmain`. Deploying or
   redeploying `main` serves the older resume flow; `newmain` must be Production,
   not just a Preview deployment. Build settings come from `vercel.json`
   (`npm ci --include=dev`, `npm run build`, Next.js). Node 22 is pinned in `package.json`.
2. Environment variables (see `.env.example` for the full list). Set these for the
   **Production** environment, then redeploy after any change:
   - `DATABASE_URL`, `APP_BASE_URL=https://aitathastu.vercel.app`, `NODE_ENV=production`
   - `CORE_INGESTION_SECURITY_APPROVED=true`, `SESSION_SECRET`, `HANDOFF_SIGNING_SECRET`,
     `GITHUB_WEBHOOK_SECRET`, `EXTERNAL_TOKEN_ENCRYPTION_KEY` (each ≥ 32 chars; generate with
     `npm run secrets:generate`). If any is missing, CV upload returns 503.
   - `RESUME_EXTRACTOR_URL` and `EXTRACTOR_API_TOKEN` (same token as Render). Without them, scanned PDFs fail with `OCR_SERVICE_NOT_CONFIGURED`.
   - `CRON_SECRET` for the scheduled cleanup.
   - Recommended: `GITHUB_TOKEN`, `UPSTASH_REDIS_REST_URL`/`_TOKEN`, OAuth client ids/secrets.
3. OAuth callback URLs: `$APP_BASE_URL/api/auth/google/callback` and `$APP_BASE_URL/api/auth/github/callback`.
   Production builds redirect URIs only from `APP_BASE_URL`, never from request headers.
4. Deploy. Verify:
   - `GET /api/health` → 200
   - `GET /api/resume/preflight` → `{ "ready": true, "renderReady": true, "scannedPdfSupported": true }`.
     If `ready` is false, `failureCategories` names the missing variables.
5. Scheduled maintenance: `vercel.json` runs `/api/cron/cleanup-stuck-syncs` daily
   at 04:00 UTC. Vercel sends the configured `CRON_SECRET` as the bearer token.
6. Test a text PDF and a scanned PDF: upload returns 202, then the status route
   advances the job until `review_ready`. A scanned PDF must report
   `extractionMeta.via = "extractor-ocr"`. `/health` alone does not verify service credentials.

## Notes and limits

- The CV upload limit is 4 MB to fit Vercel's function request limit, including multipart overhead.
- pdf.js character maps and standard fonts are included in the resume functions by
  `outputFileTracingIncludes` in `next.config.mjs`.
- Previews need their own database and environment variables; production-only secrets
  are not available in a Preview deployment. Set `APP_BASE_URL` for preview OAuth separately.
- Render OCR runs outside Vercel. Its health response must report a Tesseract version;
  the app and extractor must use the same `EXTRACTOR_API_TOKEN`.
- Rollback: restore a previous production deployment in Vercel. Migrations are additive
  (`IF NOT EXISTS`), so older builds keep working against a newer schema.
