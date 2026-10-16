# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone building a career in AI/ML and its sub-fields (GenAI, ML engineering, research, data): students, job seekers, and people switching into AI/ML. They arrive with scattered evidence (a CV, GitHub, coding-practice profiles, papers, Kaggle) and want one honest picture of what they can do and what to do next. Confirmed by the owner, 2026-10-15.

A faculty workspace (evidence verification queue) exists in the product; it is a secondary audience, not the design centre.

## Product Purpose

AI Tathastu turns a person's real, scattered evidence into a verified skills profile and an adaptive workspace (Person 360, projects, skills map, roadmap) shaped by what they rank as their priorities (jobs, projects, learning). Success: the person can see, edit, and stand behind every claim on their profile, and knows their next useful step.

## Positioning

Every claim is traced to real evidence, and nothing reaches the profile until the person confirms it. Sources (CV, GitHub, LinkedIn, Scholar/ORCID, Kaggle, LeetCode, HackerRank, manual entry) carry provenance and a confidence score backed by evidence IDs; conflicts resolve by explicit precedence (CV > GitHub > other sites > manual) and the person's edit always wins. Confirmed by the owner, 2026-10-15.

## Operating Context

- Onboarding is "confirm and edit what we found": the CV and connected sources pre-fill everything, and manual entry is the fallback.
- EORA, a guide character, accompanies onboarding and the workspace (rules-based tour; grounded RAG chat). She speaks English and Hinglish (`docs/EORA_*`).
- Every third-party source is optional; skipping any of them never blocks onboarding.
- Imports run in the background and can be slow (the OCR extractor on Render's free tier cold-starts in about 53 s). The UI waits and shows real progress instead of failing.

## Capabilities and Constraints

- Stack in place: Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Drizzle on Postgres (Neon), Python extractor on Render (see `README.md`).
- Live LLM providers: Groq, Gemini, OpenRouter. LLM features must degrade gracefully when none is available; CV extraction uses no LLM.
- LinkedIn import is optional, OTP-relay based, and unproven against real LinkedIn. Its UI must show clear failure states.
- Terminology: "evidence", "source", "confirm", "provenance", "Person 360", "Project Evidence Ledger", "Skills Intelligence Map".

## Brand Commitments

- Name: AI Tathastu (wordmark "AITathastu" with the rounded-triangle logo, `app/icon.svg`).
- EORA's character and voice are defined in `docs/EORA_CHARACTER_BIBLE.md` and `docs/EORA_HINGLISH_DIALOGUE_SPEC.md`.
- Visual system: Direction B, Graphite and Signal (dark default, light companion, switchable before first paint), tokens signed off 2026-10-15 and shipped in the Phase 3 rebuild, which supersedes the Phase 2 look; tokens in `app/globals.css`, documented in `DESIGN.md`, measured contrast in `docs/design/PHASE3_COLOR_SYSTEM_PROPOSAL.md`.

## Evidence on Hand

- Real product copy in the components and `docs/ECOSYSTEM_LANDING_COPY_MAP.md`; EORA artwork in `public/assets/eora/`.
- No testimonials, customer logos, institutional partnerships, or outcome statistics exist. Do not invent any.

## Product Principles

1. Evidence before claims: show where every number and skill comes from.
2. The person has the last word: everything is editable, and their edit overrides any source.
3. Never block on a source: optional means optional, and slow means "keep going, it finishes in the background".
4. Honest states: real progress and plain-language failures with a way to recover, never fake timers or silent hangs.

## Accessibility & Inclusion

WCAG 2.1 AA (owner-confirmed 2026-10-15; matches Task 3.4.1). Status is never conveyed by colour alone; touch targets are at least 44 px; reduced motion is respected.
