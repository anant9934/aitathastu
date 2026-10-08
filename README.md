# AI Tathastu — "You imagine. AI makes it happen."

> **Production-Grade AI/ML Student Intelligence, Competency Verification & Personalization Platform**

AI Tathastu transforms student career aspirations into structured, verifiable pathways. Built for higher-education and engineering institutions, Tathastu unifies evidence from code repositories, course completions, proctored assessments, and mock interviews into an authoritative **Person 360** graph—powering personalized roadmaps, explainable readiness metrics, and dynamic student workspaces.

---

## Key Highlights & Architectural Pillars

- **Zero Mock Data in Runtime**: Authenticated student dashboards operate exclusively on real, persisted records from remote Neon PostgreSQL.
- **Enterprise Multi-Provider LLM Router**: Seamless integration with **Groq** (`openai/gpt-oss-120b`), **OpenRouter** (`meta-llama/llama-3.3-70b-instruct`), and **Google Gemini** (`gemini-3.5-flash-lite`), protected by Zod structured output validation and automatic zero-downtime deterministic fallback.
- **Grounded RAG Knowledge Engine**: 16 canonical AI/ML domains providing verified technical and academic citations (ArXiv, official documentation).
- **96 Priority-Aware Personalization Configurations**: Mathematically verified multi-interest composition engine spanning 6 core modes (Learning, Jobs, People, Collaboration, Projects, Research & Events).
- **Safe Tool Execution & Confirmation Gates**: AI assistants cannot mutate application state without explicit student confirmation in the UI.
- **Five Competency Evidence Tiers**: Clear trust depths separating *Institutionally Verified* (100%), *Demonstrated in Projects* (75%), *Source Detected* (50%), *Student Reported* (25%), and *Insufficient Evidence* (0%).
- **Defensible Readiness Scoring**: Publishes numerical readiness scores only when verified evidence coverage meets strict policy gates ($\ge 60\%$).

---

## Tech Stack

- **Framework**: [Next.js 15 App Router](https://nextjs.org/) (React 19, TypeScript)
- **Database & Persistence**: [Neon PostgreSQL](https://neon.tech/) Serverless via `@neondatabase/serverless` & [Drizzle ORM](https://orm.drizzle.team/)
- **Distributed Cache & Rate Limiting**: [Redis](https://redis.io/) with failover to in-memory rate limiting
- **Intelligence Providers**: Groq, OpenRouter, Google Gemini, Cerebras, Mistral, SambaNova
- **Styling**: Tailwind CSS & Vanilla CSS Design System tokens
- **Security**: Bcrypt password hashing, HttpOnly session cookies, timing-safe HMAC SHA-256 webhook signatures, SSRF protection

---

## Getting Started

### Prerequisites

- Node.js 20+ or 22 LTS
- Remote PostgreSQL database (Neon serverless recommended)

### Installation

```bash
# Clone repository
git clone https://github.com/anant9934/aitathastu.git
cd aitathastu

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your database and provider credentials
```

### Database Migrations

```bash
npm run db:migrate
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Testing Suite

The repository includes a comprehensive 58-suite test matrix with 307 automated tests verifying end-to-end functionality, security controls, and personalization permutations:

```bash
# Run all 307 unit, domain, and integration tests
npm test

# Run strict TypeScript typechecking
npm run typecheck

# Run ESLint validation
npm run lint

# Build optimized production bundle
npm run build
```

---

## Documentation

Full architectural documentation and certification audits are located in the [`docs/`](docs/) directory:

- [`docs/FUNCTIONAL_AUDIT.md`](docs/FUNCTIONAL_AUDIT.md) — Master route-to-service-to-DB dependency map and capability audit.
- [`docs/LLM_PROVIDER_CERTIFICATION.md`](docs/LLM_PROVIDER_CERTIFICATION.md) — Multi-provider LLM engine, schemas, tool executor, and fallback behavior.
- [`docs/REAL_DATA_SOURCE_MATRIX.md`](docs/REAL_DATA_SOURCE_MATRIX.md) — Data connector architecture, GitHub sync, resume extraction, and trust levels.
- [`docs/PERSONALIZATION_RUNTIME_REPORT.md`](docs/PERSONALIZATION_RUNTIME_REPORT.md) — 96 configurations, 6 dashboard modes, and 5 evidence tiers.
- [`docs/ROADMAP_ENGINE_VALIDATION.md`](docs/ROADMAP_ENGINE_VALIDATION.md) — Deterministic prerequisite graphs, taxonomy, and feedback loops.
- [`docs/EORA_RUNTIME_VALIDATION.md`](docs/EORA_RUNTIME_VALIDATION.md) — EORA assistant mission, RAG knowledge retrieval, and tool confirmation gates.
- [`docs/EXTERNAL_INTEGRATION_STATUS.md`](docs/EXTERNAL_INTEGRATION_STATUS.md) — Architectural boundaries for Study LPU, Padho Code, ERIS, and MentorMaze.
- [`docs/PRODUCTION_SECURITY_REVIEW.md`](docs/PRODUCTION_SECURITY_REVIEW.md) — Threat model, IDOR protection, SSRF filtering, and prompt injection defense.
- [`docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md) — Health probes, deployment steps, and rollback procedures.
- [`docs/FINAL_PRODUCTION_READINESS_REPORT.md`](docs/FINAL_PRODUCTION_READINESS_REPORT.md) — Complete launch certification verdict and sign-off.

---

## License

Private & Proprietary — AI Tathastu. All rights reserved.
