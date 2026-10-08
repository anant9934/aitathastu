# AI Tathastu — Codebase Cleanup & Architecture Audit
**Phase E.5 Architecture Consolidation & Dead-Code Elimination**
**Date:** October 8, 2026
**Branch:** `chore/codebase-cleanup`

---

## 1. Executive Summary

This comprehensive audit catalogs the state of the AI Tathastu repository, classifying all source files, assets, components, API endpoints, stylesheets, and scripts into actionable buckets (**KEEP**, **REFACTOR**, **MERGE**, **DELETE**, **REVIEW**).

---

## 2. Directory & Module Classification

### 2.1 Core Application Routes (`app/`)
| Path | Purpose | Active Callers | Classification | Action Taken |
|---|---|---|---|---|
| `app/page.tsx` | Root landing page | Public users, Root router | **KEEP** | Preserved exact reference landing page |
| `app/layout.tsx` | Global root layout | App Router | **KEEP** | Cleaned legacy CSS imports |
| `app/globals.css` | Tailwind v4 tokens & keyframes | App Router | **KEEP** | Preserved global styles |
| `app/exact-screens.css` | Exact 1:1 reference screen CSS | Landing & Onboarding | **KEEP** | Preserved glassmorphic tokens |
| `app/student-workspace.css` | Student workspace views CSS | `/student/*` routes | **KEEP** | Preserved workspace styling |
| `app/reference-refresh.css` | Micro-animation utilities | Global UI | **KEEP** | Preserved |
| `app/onboarding-flow.css` | Legacy v1 onboarding styles | None (Superseded) | **DELETE** | Deleted; imports removed |
| `app/onboarding/page.tsx` | EORA Onboarding entrypoint | Public / New Students | **KEEP** | Preserved |
| `app/student/page.tsx` | Student Person 360 Workspace | Authenticated Students | **KEEP** | Preserved live DB-backed workspace |
| `app/student/projects/page.tsx` | Projects Ledger View | Authenticated Students | **KEEP** | Preserved |
| `app/student/projects/[id]/page.tsx`| Project Detail View | Authenticated Students | **KEEP** | Preserved |
| `app/student/skills/page.tsx` | Skills Map View | Authenticated Students | **KEEP** | Preserved |
| `app/student/skills/[skill]/page.tsx`| Skill Detail View | Authenticated Students | **KEEP** | Preserved |
| `app/student/roadmap/page.tsx` | Personalized Roadmap View | Authenticated Students | **KEEP** | Preserved |
| `app/student/journey/page.tsx` | Verified Journey View | Authenticated Students | **KEEP** | Preserved |
| `app/student/assessments/page.tsx` | ERIS Assessment Hub | Authenticated Students | **KEEP** | Preserved |
| `app/student/interviews/page.tsx` | MentorMaze Interview Hub | Authenticated Students | **KEEP** | Preserved |
| `app/student/connections/page.tsx`| Ecosystem Connections View | Authenticated Students | **KEEP** | Preserved |
| `app/student/profile/page.tsx` | Person 360 Profile View | Authenticated Students | **KEEP** | Preserved |
| `app/faculty/verification/page.tsx`| Faculty Verifier Portal | Faculty / Verifiers | **KEEP** | Preserved |
| `app/verification/page.tsx` | Verification entrypoint | Verifiers | **KEEP** | Preserved |
| `app/screens/page.tsx` | 12-Screen Reference Viewer | QA / Demo Gallery | **KEEP** | Preserved |
| `app/sign-in/page.tsx` | Auth Sign-In View | Unauthenticated users | **KEEP** | Preserved |
| `app/sign-up/page.tsx` | Auth Sign-Up View | New registrations | **KEEP** | Preserved |

---

### 2.2 Component Modules (`components/`)
| Path | Purpose | Active Callers | Classification | Action Taken |
|---|---|---|---|---|
| `components/exact-screens/*` (18 files)| Exact 1:1 Reference Screens 1-12 | Landing, Onboarding, Screens | **KEEP** | Preserved; fixed unused imports |
| `components/student/*` (27 files) | Live Student Workspace Views | `/student/*` routes | **KEEP** | Cleaned imports & hooks |
| `components/ui/motion-primitives.tsx`| Shared Motion & Card Primitives | Landing & Exact Screens | **KEEP** | Polished dark glassmorphic styles |
| `components/brand.tsx` | Reusable brand logo & text | `student-topbar.tsx` | **KEEP** | Preserved |
| `components/eora/eora-avatar.tsx` | Official EORA avatar component | All workspace views | **KEEP** | Preserved canonical component |
| `components/hero.tsx` | Legacy Phase 1 hero prototype | None | **DELETE** | Deleted |
| `components/how-it-works.tsx` | Legacy Phase 1 overview prototype | None | **DELETE** | Deleted |
| `components/journey.tsx` | Legacy Phase 1 journey prototype | None | **DELETE** | Deleted |
| `components/ecosystem.tsx` | Legacy Phase 1 ecosystem prototype| None | **DELETE** | Deleted |
| `components/final-cta.tsx` | Legacy Phase 1 CTA prototype | None | **DELETE** | Deleted |
| `components/site-header.tsx` | Legacy Phase 1 header prototype | None | **DELETE** | Deleted |
| `components/site-footer.tsx` | Legacy Phase 1 footer prototype | None | **DELETE** | Deleted |
| `components/eora-guide.tsx` | Legacy Phase 1 guide prototype | None | **DELETE** | Deleted |
| `components/student-shell.tsx` | Legacy Phase 1 shell prototype | None | **DELETE** | Deleted |
| `components/onboarding/*` (3 files) | Legacy v1 onboarding prototype | None | **DELETE** | Deleted |
| `components/onboarding-v2/*` (2 files) | Legacy v2 onboarding monolithic | None | **DELETE** | Deleted |

---

### 2.3 Asset Directory (`public/` & root)
| Path | Purpose | Status | Action Taken |
|---|---|---|---|
| `public/assets/eora/*.png` (12 files) | Official 12 EORA Poses | **ACTIVE** | Preserved intact |
| `public/sample-resumes/*` (2 files) | Sample Resume Fixtures | **ACTIVE** | Preserved intact |
| `avtar iamges/` (11 raw PNGs, ~20MB) | Unreferenced AI avatar experiments | **DEAD** | Deleted |
| `public/yora-*.png` (13 PNGs, ~24MB) | Obsolete Yora naming duplicates | **DEAD** | Deleted |
| `public/eora-*.png` in root (18 files, ~30MB) | Duplicate unorganized root assets | **DEAD** | Deleted |
| `public/rahul-avatar.jpg` (632KB) | Unreferenced sample photo | **DEAD** | Deleted |
| `previews/` (16 screenshots, ~15MB) | Stale UI capture previews | **DEAD** | Deleted |
| `.next.log` (211B) | Temporary build log | **DEAD** | Deleted |

---

### 2.4 Library & Domain Engine (`lib/`)
| Module | Scope | Status | Protection Guarantee |
|---|---|---|---|
| `lib/db/` | Drizzle ORM, schema, Postgres / PGlite | **KEEP** | Zero data loss; preserves migrations & schema |
| `lib/auth/` | Session, passwords, RBAC, isolation | **KEEP** | Preserved multi-tenant isolation |
| `lib/security/` | SSRF defense, CSRF, rate limit, sanitization | **KEEP** | Preserved all defenses & context firewalls |
| `lib/domain/` | Person 360, readiness, gaps, roadmap, project taxonomy | **KEEP** | Authoritative business logic |
| `lib/repositories/` | Goal, project, person, evidence, verification, action repos | **KEEP** | Data layer integrity preserved |
| `lib/services/` | Activity, verification, person 360, github sync | **KEEP** | Domain services preserved |
| `lib/intelligence/` | Router, prompt defense, context firewall, cost control | **KEEP** | LLM safety preserved |
| `lib/monitoring/` | Integration status, operational status | **KEEP** | Observability preserved |
| `lib/connectors/` | GitHub connector registry | **KEEP** | Preserved read-only scopes |
| `lib/eora/avatar-registry.ts` | Canonical EORA pose manifest | **KEEP** | Preserved single source of truth |
| `lib/onboarding.ts` & `lib/onboarding-v2.ts` | Onboarding draft & state helpers | **KEEP** | Preserved for test & continuity |
| `lib/logger.ts` | Structured logger with PII redaction | **KEEP** | Preserved |

---

### 2.5 Tests (`tests/`)
All 12 test suites are verified active:
1. `tests/domain.test.ts` (Domain entities & gap logic)
2. `tests/auth-persistence.test.ts` (Auth & session security)
3. `tests/verification-readiness.test.ts` (Defensible readiness scoring)
4. `tests/integrations.test.ts` (Study LPU, Padho Code, ERIS, MentorMaze)
5. `tests/onboarding-v2.test.ts` (Onboarding stages & drafting)
6. `tests/functionalization-phase-a.test.ts` (Phase A functional flows)
7. `tests/functionalization-phase-b.test.ts` (Phase B functional flows)
8. `tests/functionalization-phase-c.test.ts` (Phase C functional flows)
9. `tests/production-readiness-phase-d.test.ts` (Security & telemetry)
10. `tests/production-readiness-phase-e.test.ts` (Ecosystem loop & rate limits)
11. `tests/product-integrity-phase-e3.test.ts` (Integrity gates & audit checks)
12. `tests/project-management-phase-e4.test.ts` (Project management & SSRF)
