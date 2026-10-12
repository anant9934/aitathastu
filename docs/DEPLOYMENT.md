# Deployment

Two services:

| Service | Host | Config |
|---|---|---|
| Next.js app | Netlify, builds from `main` | `netlify.toml` |
| Resume extractor (Python) | Render (Docker) | `render.yaml` |

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
2. Set `EXTRACTOR_API_TOKEN` (Render can generate it), optionally `EXTRACTOR_VERIFIER_TOKEN`,
   and `ALLOWED_ORIGIN` = your `APP_BASE_URL`.
3. Check `GET https://<service>.onrender.com/health`. `tesseract_version` must not be `unavailable`.
4. `MAX_UPLOAD_MB` is 4, matching the app's limit (`lib/config/upload-limits.ts`). Keep them equal.

## 3. Next.js app (Netlify)

1. Netlify → Add site → import the repo, branch `main`. Build settings come from `netlify.toml`
   (`npm run build`, Node 22, `@netlify/plugin-nextjs`).
2. Environment variables (see `.env.example` for the full list). The minimum for production:
   - `DATABASE_URL`, `APP_BASE_URL` (e.g. `https://www.aitathastu.com`), `NODE_ENV=production`
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
5. Scheduled maintenance: `netlify/functions/cleanup-stuck-syncs.mts` runs daily at 04:00 UTC
   and calls `/api/cron/cleanup-stuck-syncs` with `CRON_SECRET`. Any external cron can call the same URL instead.

## Notes and limits

- Netlify function payloads are capped at 6 MB and binary bodies are base64-encoded, so the CV
  upload limit is 4 MB.
- pdf.js character maps are added to the server function via `included_files` in `netlify.toml`,
  because Next's file tracing doesn't pick up `*.bcmap` files.
- Deploy previews: `APP_BASE_URL` must be set per context if OAuth is used there.
- Rollback: redeploy a previous Netlify deploy. Migrations are additive (`IF NOT EXISTS`), so older builds keep working against a newer schema.
