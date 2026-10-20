# Codebase & Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 4 + handwritten CSS in `app/globals.css` (4,659 lines) |
| Database | Neon PostgreSQL via Drizzle ORM |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Fonts | Space Grotesk (display), DM Sans (body), JetBrains Mono (mono) via `next/font/google` |
| Auth | Custom email/password + OTP |
| AI companion | EORA (internal LLM chat + intent engine) |

---

## Directory Structure (UI-relevant)

```
app/
  globals.css          — 4,659 lines; all tokens, component classes, landing styles
  layout.tsx           — Root layout: skip link, AppProviders, dark theme default
  page.tsx             — Landing page (delegates to Landing component)
  student/
    layout.tsx         — Auth guard + onboarding redirect + StudentShell
    page.tsx           — Overview (DashboardView)
    skills/            — Skills map + ledger
    projects/          — Project ledger + detail
    profile/           — Person 360 + inline edit
    connections/       — Connections + LinkedIn import
    roadmap/           — Roadmap (stub?)
    journey/           — Journey timeline
    assessments/       — Assessments
    interviews/        — Interviews
    privacy/           — Privacy controls + consent audit trail
  onboarding/page.tsx  — 13-step wizard (OnboardingApp)
  sign-in/sign-up/     — Auth forms (AuthForms component)
  faculty/             — Faculty queue
  privacy/             — 9 privacy sub-pages
  legal/               — terms, cookies, acceptable-use, copyright, etc.

components/
  ui/                  — 18 primitive components
  layout/              — StudentShell (workspace frame)
  dashboard/           — DashboardView, DashboardParts, JumpNav, FocusEditor, Sections
  onboarding/          — OnboardingApp, OnboardingShell, 13 step components
  connections/         — ConnectionsView, ConnectorList, LinkedInConnect, etc.
  skills/              — SkillsView, SkillsMap, SkillDetailView/Panel
  projects/            — ProjectLedgerView, ProjectDetailView
  profile/             — ProfileView
  auth/                — AuthForms
  eora/                — EoraCompanion (floating launcher), EoraGuideLine, EoraChat
  landing/             — Landing (monolithic, ~1,500 lines)
  review/              — EntryList, InlineField, SkillReview, SourceFilter, LinkReview
  legal/               — CookieSettingsManager, DataRightsRequestCard, LegalContentRenderer
  student/             — PrivacyControlsView
  github/              — GitHubIntelligenceDashboard
```

---

## Design System

### Theme Architecture

- **Default:** dark ("Warm Cinematic")
- **Root selector:** `:root` and `:root[data-theme="dark"]` share identical token values
- **Light override:** `:root[data-theme="light"]` overrides colour tokens only — all other tokens (spacing, radius, shadows) remain constant
- **System preference:** NOT used. Theme is stored in `localStorage` and applied via JS before first paint; no `prefers-color-scheme` media query fallback is wired in CSS. First render on a system-dark device will get dark by default; system-light devices also default to dark until the JS cookie/localStorage value is read.
- **Theme switch:** Handled by `useTheme` hook; `data-theme` attribute set on `<html>`; theme-switching class disables all transitions during the switch

### Colour Palette (Dark Mode)

| Role | Token | Value |
|------|-------|-------|
| Canvas/background | `--background-primary` | `#08090B` |
| Elevated surface | `--background-elevated` | `#171513` |
| Raised surface | `--background-raised` | `#24201B` |
| Primary text | `--foreground-primary` | `#F4F4F2` |
| Muted text | `--foreground-muted` | `#A8A199` |
| Warm text | `--foreground-warm` | `#F4E7D0` |
| Accent (primary) | `--accent-primary` | `#C9A46D` |
| Accent (bright/signal) | `--accent-bright` | `#F49A47` |
| Border (subtle) | `--border-decorative` | `rgba(244,231,208, 0.10)` |
| Border (interactive) | `--border-interactive` | `#A8A199` |
| Verified | `--verified` | (defined in palette block) |
| Warning | `--warning` | (defined in palette block) |
| Danger | `--danger` | (defined in palette block) |

### Colour Palette (Light Mode)

| Role | Token | Value |
|------|-------|-------|
| Canvas/background | `--background-primary` | `#FAF9F6` |
| Elevated surface | `--background-elevated` | `#F4F1EA` |
| Primary text | `--foreground-primary` | `#17171F` |
| Muted text | `--foreground-muted` | `#606775` |
| Accent | `--accent-primary` | `#89561F` |
| Accent bright | `--accent-bright` | `#89561F` (same as primary in light) |
| Border subtle | `--border-decorative` | `#E4E0DC` |

**Note:** In light mode `--accent-primary` and `--accent-bright` collapse to the same value (`#89561F`), removing the visual distinction between ambient accent and interactive signal. This is a design decision but reduces the visual hierarchy.

### Typography Scale

| Role | Font | CSS |
|------|------|-----|
| Display headings | Space Grotesk | `var(--font-display)` |
| Body copy | DM Sans | `var(--font-body)` |
| Mono/code/labels | JetBrains Mono | `var(--font-mono)` |
| Base size | 16px | `font-size: 16px` on `body` |
| Line height | 1.65 | `body` |
| Heading line-height | 1.06 | `h1–h6` |
| Heading letter-spacing | −0.035em | `h1–h6` |
| `.h2` class (landing) | clamp(34px, 5vw, 68px) | fluid from 34–68 px |
| `.lede` class | clamp(15px, 1.35vw, 18px) | fluid from 15–18 px |
| 2xs utility | text-2xs | defined via Tailwind |

### Spacing & Radius

| Token | Value |
|-------|-------|
| `--radius-sm` | 10px |
| `--radius-md` | 16px |
| `--radius-card` | 20px |
| `--radius-lg` | 28px |
| `--radius-pill` | 100px |
| `--radius-control` | 10px (buttons, inputs) |
| `--radius-panel` | 16px |

### Shadow Tokens

- `--shadow-warm`: warm-tinted elevation shadow used on cards and overlays
- `shadow-card`: Tailwind utility, mapped to `--shadow-warm`

---

## CSS Architecture Notes

`globals.css` is the single source of truth for all component CSS classes (`.fcard`, `.btn`, `.pill-live`, `.badge`, `.nav`, `.section-head`, `.h2`, `.lede`, etc.). Tailwind is used primarily for utility composition within component JSX; the global classes are applied via `className` or the `cn()` helper.

The file contains two parallel copies of some layout/typography classes: one at the top level (e.g., `.wrap`, `.section-head`) and one inside the landing page `@media` scoped block (lines 1085+). This creates style specificity conflicts that affect the landing page layout on screen sizes below certain breakpoints.

Landing-page specific styles (including all `.hero-*`, `.orb-*`, `.timeline-*`, `.skills-*`, `.dash-*`, `.eora-*`, `.faq-*`) are embedded directly in `globals.css` rather than being scoped to the Landing component. This couples the global stylesheet to a single page's implementation.

---

## Accessibility Baseline

- **Focus styles:** `:focus { outline: none }` globally; `:focus-visible` restores a 2px `--accent-warm` outline. Browsers that do not support `:focus-visible` show no focus ring.
- **Skip link:** Present in `app/layout.tsx` pointing to `#main`. `#main` exists on the student shell and auth forms; the landing page does not define `id="main"` on its main content region.
- **Reduced-motion:** `@media (prefers-reduced-motion: reduce)` in `globals.css` sets `animation-duration: 0.001ms` globally. Canvas animations in `Landing.tsx` use direct `requestAnimationFrame` and are not governed by this rule.
- **Colour contrast:** Not formally tested (outside audit scope without browser tooling), but the dark-mode palette (warm ivory on near-black) is consistent with WCAG AA at typical sizes.
- **ARIA patterns:** Tabs, Dialog, Drawer, ThemeToggle radiogroup, Banner (role="status"/"alert"), Skeleton (role="status" + aria-busy), EvidenceStrip (role="img"), NavItems (aria-current="page") — all correctly implemented.
