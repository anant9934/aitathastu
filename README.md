# AI Tathastu

A career and learning platform for AI/ML students. A student goes through an
EORA-guided onboarding (role, direction, CV upload and review, academic
details, digital footprints, GitHub projects) and lands in an adaptive
workspace built from reviewed evidence (Person 360, projects, skills,
roadmap). There's also a faculty workspace with an evidence verification queue.

## Stack

| Part | Tech |
|---|---|
| Web app | Next.js 15 (App Router), React 19, TypeScript, Tailwind 4 |
| Database | PostgreSQL (Neon in production) via Drizzle ORM; embedded PGlite for local dev |
| Auth | Own session tokens (`sessions` table, httpOnly cookie), Google OIDC, GitHub OAuth |
| CV parsing | In-process text extraction (pdf.js, mammoth). Scanned PDFs are OCR'd by the separate Python service |
| Resume extractor | Python FastAPI + PyMuPDF + Tesseract in `services/resume-extractor/`, deployed on Render |
| AI | Optional multi-provider LLM pool for EORA, with a deterministic fallback. CV extraction uses no LLM |
| Hosting | Vercel (Next.js app), Render (extractor), both from `newmain` |

How it fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). How to deploy it: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Run locally

Requires Node 22 (see `.nvmrc`).

```bash
npm ci
cp .env.example .env      # leave DATABASE_URL empty to use embedded PGlite
npm run dev               # http://localhost:3000
```

With `DATABASE_URL` empty and `NODE_ENV` not `production`, the app creates a
PGlite database in `.pgdata/` and applies the schema on startup. Every
variable is documented in [.env.example](.env.example).

### Resume extractor (needed only for scanned/image PDFs)

Text PDFs and DOCX are parsed by the Next app itself. Scanned PDFs need the
Python service plus a Tesseract 5 install on your PATH:

```bash
cd services/resume-extractor
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
EXTRACTOR_API_TOKEN=local-dev-token uvicorn app.main:app --port 8000
```

Then set `RESUME_EXTRACTOR_URL=http://127.0.0.1:8000` and the same
`EXTRACTOR_API_TOKEN` in the app's `.env`.

## Database migrations

`lib/db/migration-sql.ts` is the single, canonical, idempotent migration list.
`lib/db/schema.ts` is the query model and is kept in step by hand.

```bash
npm run db:migrate        # applies migration-sql.ts to DATABASE_URL
```

Production never runs DDL on cold start (`DATABASE_AUTO_MIGRATE` defaults to
false there). Run `db:migrate` as a deploy step. If a unique index is skipped
because of existing duplicates, `node --env-file=.env --import tsx scripts/report-duplicate-keys.ts`
lists them.

## Tests

There is no Jest/Vitest; tests are `tsx` scripts under `scripts/`.

```bash
npm run typecheck
npm run lint
npm test                                   # core acceptance suite (in-memory DB when DATABASE_URL is empty)
npm run test:v5-0-4-extraction             # deterministic CV extraction

# Need a running `npm run dev` (and the extractor for --scanned):
node --import tsx scripts/verify-resume-pipeline-local.ts --scanned path/to/scanned.pdf
node --import tsx scripts/verify-onboarding-integrity-local.ts

# Offline, in-memory DB:
DATABASE_URL= PGLITE_IN_MEMORY=true node --import tsx scripts/verify-github-footprint-integrity.ts
DATABASE_URL= PGLITE_IN_MEMORY=true node --import tsx scripts/verify-guest-purge.ts

# Python extractor
cd services/resume-extractor && pytest -q
```

Many older `verify-v*` / `test:core-v*` scripts expect a live Neon database or
local resume files that aren't in the repo.

## Maintenance

- `scripts/purge-stale-guests.ts`: deletes guest accounts older than 7 days that never finished onboarding (dry run unless `--apply`). Also runs daily from the cron route.
- `/api/cron/cleanup-stuck-syncs`: daily cleanup, triggered by the Netlify scheduled function `netlify/functions/cleanup-stuck-syncs.mts`.

Older certification reports are kept in [docs/archive/](docs/archive/). They predate the 2026-10-12 audit and are not current.
