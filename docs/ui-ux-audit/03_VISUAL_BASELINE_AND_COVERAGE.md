# Visual Baseline & Coverage

## Design Language

**Name:** Warm Cinematic  
**Character:** Dark-first, warm amber-gold accent palette, espresso browns as mid-tones, near-black canvas. Film-noir warmth applied to a technical product.  
**Motion philosophy:** Entrance animations (word-up, fade-up, float) on landing; reduced or static in the workspace. `prefers-reduced-motion` disables all CSS transitions/animations globally.

---

## Token Coverage Audit

### Colour Roles

| Role | Dark Token | Light Token | Used in Components | Consistency |
|------|-----------|-------------|-------------------|-------------|
| Canvas bg | `--background-primary` (`#08090B`) | `#FAF9F6` | `body`, `.nav`, auth frame | ✅ Consistent |
| Elevated surface | `--background-elevated` (`#171513`) | `#F4F1EA` | Panel, Card, Skeleton shimmer | ✅ Consistent |
| Raised surface | `--background-raised` (`#24201B`) | `#FFFFFF` | Overlay backdrop, Banner | ✅ Consistent |
| Surface (cards) | `--background-card` (`#171513`) | `#FFFFFF` | fcard, Tabs active | ✅ Consistent |
| Primary text | `--foreground-primary` | `#17171F` | `body`, headings | ✅ Consistent |
| Muted text | `--foreground-muted` | `#606775` | Descriptions, placeholders | ✅ Consistent |
| Warm text | `--foreground-warm` (`#F4E7D0`) | `#89561F` | Headings in dark shell | ✅ Consistent |
| Accent (ambient) | `--accent-primary` (`#C9A46D`) | `#89561F` | Labels, link hover, dividers | ⚠️ Collapses in light mode — same as bright |
| Signal (interactive) | `--accent-bright` (`#F49A47`) | `#89561F` | Pill-live, active tab indicator, badge | ⚠️ Collapses in light mode — same as ambient |
| Verified | `--verified` | same | StatusChip, EvidenceStrip | ✅ Consistent |
| Corroborated | `--corroborated` | same | StatusChip, EvidenceStrip | ✅ Consistent |
| Evidenced | `--evidenced` | same | StatusChip, EvidenceStrip | ✅ Consistent |
| Warning | `--warning` | same | Banner, StatusChip | ✅ Consistent |
| Danger | `--danger` | same | Banner, StatusChip | ✅ Consistent |

**Light mode accent collapse:** In light mode, `--accent-primary` and `--accent-bright` are both `#89561F`. The dark-mode distinction (muted `#C9A46D` vs bright `#F49A47`) that creates visual hierarchy between ambient decorative elements and interactive signals is lost in light mode. This is a design limitation that reduces affordance clarity on the light theme.

---

### Typography Consistency

| Context | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Hero headline (landing) | Space Grotesk | clamp(34–68px) | 700 | fluid `.h2` |
| Page section labels | JetBrains Mono | 11px | 600 | `.label` uppercase, letter-spacing |
| Body / descriptions | DM Sans | 16px | 400 | standard |
| Panel headers | Space Grotesk | 18px (h2) / 16px (h3) | 600 | `PanelHeader` |
| Navigation items | DM Sans | 14px | 500/600 | `RailLink`, `TabButton` |
| Status chips | DM Sans | 12px (md) / 10px (sm) | 500 | `StatusChip` |
| Tags | DM Sans | 12px | 400 | `Tag` |
| Mono metadata | JetBrains Mono | varies (text-2xs, text-xs, text-xl) | varies | dashboard stat numbers, footer labels |
| `.lede` body text | DM Sans | clamp(15–18px) | 400 | landing sections only |

**Dashboard stat numbers** use `font-display text-xl font-semibold` (Space Grotesk), consistent across Skills, Connections overview, and Profile stats. Good.

---

### Spacing & Layout

| Pattern | Token/Class | Used |
|---------|-------------|------|
| Max-width container | `max-w-[1240px]` | Student workspace pages |
| Max-width landing | `var(--maxw)` / `.wrap` | Landing page sections |
| Page padding | `px-4 sm:px-6 lg:px-8` | Workspace content areas |
| Section padding | `120px 0` (landing), `pt-7`/`pt-8` (workspace) | Distinct per zone |
| Card gaps | `gap-5` | Dashboard/Profile grid |
| Panel padding | `p-4 sm:p-5` | `Panel` component |
| Radius (controls) | `--radius-control` (10px) | Buttons, inputs, banners |
| Radius (cards/panels) | `--radius-panel`/`rounded-card` (16–20px) | Cards, panels |

Spacing is generally consistent within each zone (landing vs workspace) but there is no unified spacing scale token — values are hardcoded Tailwind utilities throughout component JSX.

---

### Icon System

All icons come from `@phosphor-icons/react` using the SSR import (`/dist/ssr`) for server-compatible rendering.

Usage pattern: `weight="bold"` or `weight="fill"` for active/highlighted states, `weight="regular"` for inactive states. `aria-hidden="true"` applied consistently on decorative icons.

**Exception:** Footer social links use plain text characters ("GH", "IN", "𝕏") instead of Phosphor icons or SVG brand icons. This is inconsistent with the icon-based design system used everywhere else. See UX-006.

---

### Theming Coverage by Section

| Section | Dark Mode | Light Mode | Notes |
|---------|-----------|------------|-------|
| Landing page | ✅ Full | ✅ Full | Some hardcoded hex values in inline styles for canvas/SVG |
| Auth pages | ✅ Full | ✅ Full | Warm ambient glows use Tailwind opacity utilities |
| Onboarding | ✅ Full | ✅ Full | |
| Student workspace | ✅ Full | ✅ Full | Rail nav uses semantic colour tokens |
| Dashboard | ✅ Full | ✅ Full | Stat numbers use `text-champagne`/`text-verified` semantic tokens |
| Skills / Projects / Profile | ✅ Full | ✅ Full | |
| Connections | ✅ Full | ✅ Full | |
| Privacy controls | ✅ Full | ✅ Full | |
| Legal pages | ✅ Full | ✅ Full | |
| Footer | ✅ Full | ✅ Full | |

---

### Animation & Motion Inventory

| Animation | Trigger | Reduced-motion handled? |
|-----------|---------|------------------------|
| Landing word-up entrance | Page load | ✅ Via global CSS rule |
| Landing hero glow float | Continuous | ✅ Via global CSS rule |
| EORA orb pupil tracking | Mouse move | ⚠️ Canvas-based — NOT handled by CSS rule |
| Neural network canvas | Continuous | ⚠️ Canvas-based — NOT handled by CSS rule |
| Skeleton shimmer | Loading state | ✅ `motion-reduce:animate-none` inline |
| Button ripple | Click | ✅ Via global CSS rule |
| Spinner | Loading | ✅ `motion-reduce:animate-none` inline |
| Theme switch flash prevention | `data-theme` change | ✅ `.theme-switching` disables all transitions |
| Tab slide indicator | Tab change | ✅ `transition-colors duration-150` (instant at 0.01ms) |
| Scroll progress indicator (landing) | Scroll | CSS only — ✅ |
| EORA guide collapse | Click | ✅ Via global CSS rule |

**Critical gap:** Two canvas-based animations on the landing page (`requestAnimationFrame` loops) are not governed by the CSS reduced-motion block. Users with vestibular disorders who have enabled reduced-motion will still see a continuously moving neural network canvas and a pupil-tracking orb. See **UX-003**.

---

### Responsive Breakpoints

| Breakpoint | px | Applied via |
|-----------|-----|-------------|
| Default (mobile-first) | 0 | Base utilities |
| `sm` | 640 | Tailwind `sm:` |
| `md` | 768 | Tailwind `md:` |
| `lg` | 1024 | Tailwind `lg:` |
| `xl` | 1280 | Tailwind `xl:` |
| `2xl` | 1536 | Tailwind `2xl:` |
| Landing custom | 1080, 900, 768, 600, 480, 390 | Hardcoded `@media (max-width)` in `globals.css` |

The landing page uses custom pixel breakpoints that do not align with Tailwind's scale. This creates two parallel breakpoint systems: Tailwind for all workspace pages, and custom max-width queries for the landing. This inconsistency is a maintainability concern (UX-016).
