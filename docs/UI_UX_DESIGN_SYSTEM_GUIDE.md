# AI Tathastu — UI/UX Master Design System & Taste Playbook

> Synthesized from industry-leading design systems, motion primitives, and engineering guides:
> - **UI/UX Pro Max** (`nextlevelbuilder/ui-ux-pro-max-skill`) — Intelligent design systems, 192 reasoning rules, pre-delivery checklist, professional color systems, zero-slop execution.
> - **Impeccable** (`pbakaus/impeccable`) — Production-grade craft, craft floor, anti-patterns, WCAG AA compliance, typography & depth systems.
> - **Taste Skill** (`Leonxlnx/taste-skill`) — Anti-slop frontend discipline, dial calibration, layout diversity, color locks.
> - **Motion Primitives** (`ibelick/motion-primitives`) — GPU-accelerated motion components, spring physics, cursor/spotlight tracking.
> - **UI Skills** (`ibelick/ui-skills`) — Accessibility, layout baseline, motion performance, and design tokens.

---

## 1. Core Dial Calibrations

Every layout, motion, and density decision is calibrated across three core dials:

| Dial | Value | Principle |
|---|---|---|
| **`DESIGN_VARIANCE`** | **`8 / 10`** | Asymmetric visual hierarchy, dynamic bento grids, distinctive multi-column compositions without generic cookie-cutter cards. |
| **`MOTION_INTENSITY`** | **`6 / 10`** | Purposeful spring physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`), smooth staggered entry reveals, cursor-tracked radial spotlights. |
| **`VISUAL_DENSITY`** | **`4 / 10`** | Airy, structured breathability with high scanability, bold typographic hierarchy, and generous container paddings. |

---

## 2. Color Palette & Harmony (AI Education & Career Ecosystem)

| Token | Hex / Value | Semantic Role |
|---|---|---|
| **Primary Background (Cosmic)** | `#050A1B` / `#0A1128` | Landing & Hero dark immersion, glowing orbital container. |
| **Surface Background (Clean)** | `#F8F9FD` / `#FFFFFF` | High-readability daylight workspace, forms, insights. |
| **Primary Accent (Indigo)** | `#5642EF` | Interactive buttons, primary focus outlines, brand mark. |
| **Secondary Glow (Cyan)** | `#02C5F5` | Real-time telemetry, live radar scan beams, active indicators. |
| **Tertiary Accent (Violet)** | `#7B2CBF` | Strategic elevation highlights, skill quadrant markers. |
| **Success / Verified (Emerald)**| `#10B981` | Cryptographic evidence, verified credentials, score indicators. |
| **Milestone / Trophy (Amber)** | `#F59E0B` | Badges, achievements, top percentile accolades. |
| **Neutral Slate** | `#0F172A` / `#64748B` | High-contrast body typography, subtle borders, metadata. |

---

## 3. Impeccable Craft Floor & UI/UX Pro Max Pre-Delivery Checklist

### 3.1 Visual & Structural Rules
- **No Emojis as Icons**: Use authentic SVG icons (`lucide-react`) exclusively.
- **Explicit Pointer Cursors**: Every interactive item carries `cursor: pointer` and clear `:hover`/`:active` state transitions.
- **Physical 1px Edge Refraction**: All elevated cards feature `shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]` or crisp dual borders.
- **Multi-Layer Shadow Elevation**: Soft ambient drop shadows matching the surface hue (`0 12px 36px -6px rgba(86, 66, 239, 0.08), 0 2px 12px rgba(0, 0, 0, 0.03)`).
- **Contrast Ratios**: WCAG AA compliant: $\ge 4.5:1$ for body copy, $\ge 3:1$ for large display headlines.
- **Typography Rhythm**: Body measure between 60–75ch, heading tracking floor `-0.03em`, balanced heading wrap.

### 3.2 Anti-Patterns Strictly Prohibited
- ❌ **No Generic AI Purple/Pink Slop**: Never flood the canvas with arbitrary blurry magenta blobs. Accents must be crisp and purposeful.
- ❌ **No Fake/Placeholder Screenshots**: Display real interactive code snippets, verified architecture layers, and live AST data.
- ❌ **No Flat Dead Buttons**: All buttons have spring scale physics (`transform: scale(0.98)` on active) and dynamic hover radiance.
- ❌ **No Monotonous Layouts**: Break symmetry with bento grids, side-by-side telemetry inspectors, and staggered milestone cards.

---

## 4. Reusable Motion Primitives Catalog

1. **`SpotlightCard`**: Real-time cursor-following radial glow tracking with hardware-accelerated CSS variables.
2. **`TextShimmer`**: Subtly animated light-pass gradient across high-impact hero headings.
3. **`SpringButton`**: Damped spring tactile push on click.
4. **`GlowingBadge`**: Breathing status indicator with soft outer aura.
5. **`AnimatedCounter`**: Tabular numeral ticker with smooth spring interpolation.
6. **`InteractiveConstellation`**: 2D SVG canvas for radial skills radar with live telemetry inspector.

---

## 5. Screen Inventory & Architecture

1. **Screen 1 — Landing Page**: Dark cosmic navy (`#050A1B`), glowing orbital rings, dynamic stats bento, 5 stakeholder ecosystem cards, video modal, interactive FAQ.
2. **Screen 2 — EORA Welcome**: Broad 1260px container, large high-res transparent EORA mascot (520px), bold 48px heading, glowing input pill.
3. **Screen 3 — Choose Role**: 3-column role cards, hover spring lift, active badges.
4. **Screen 3a — Priorities & Goals**: 3-column interest matrix with primary goal switcher.
5. **Screen 4 — Academic Details**: 2-column form, RFC compliant email validation, password visibility toggle.
6. **Screen 5 — Resume Intelligence**: Dual-column drag-and-drop dropzone + live extraction breakdown.
7. **Screen 6 — Digital Footprints**: 3-column authentic brand integration cards (LinkedIn, GitHub, LeetCode, HackerRank, CodeChef, Google Scholar).
8. **Screen 7 — Holographic AI Scanner**: Animated scanning radar beam with step-by-step intelligence checklist.
9. **Screen 8 — Profile Evidence Ledger**: Multi-tab inspector across Personal, Education, Experience, Skills, Projects, and Achievements.
10. **Screen 9 — Radial Skills Constellation**: Interactive 0–240px SVG skill radar with category filters and instant skill node telemetry inspector.
11. **Screen 10 — Verified Projects Showcase**: Clickable project cards with active card glow, multi-line code AST viewer, architecture diagram, and metric breakdown.
12. **Screen 11 — Onboarding Milestone Celebration**: 4 milestone achievement cards with celebration mascot.
13. **Screen 12 — Continuous Student Dashboard**: 5-section unified stream with hero banner, 6 metrics, interactive skills radar, evidence ledger, growth roadmap, and EORA copilot.

---

*Verified against `pbakaus/impeccable`, `Leonxlnx/taste-skill`, `ibelick/motion-primitives`, `ibelick/ui-skills`, and `nextlevelbuilder/ui-ux-pro-max-skill`.*
