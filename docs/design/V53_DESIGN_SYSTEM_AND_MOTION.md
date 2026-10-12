# V5.3 design system and motion

Status: **IN PROGRESS** · 12 October 2026

The semantic token source is the approved landing CSS in `components/landing/ecosystem-landing.css`. `app/landing-theme.css` maps that source into the product pages. The marketing page retains its own scoped presentation.

| Meaning | Token | Reference value | Use |
|---|---|---|---|
| Obsidian | `--obsidian` / `--site-obsidian` | `#08090B` | Navigation, feature surfaces, EORA context |
| Warm charcoal | `--warm-charcoal` | `#171513` | Dark elevated panels |
| Paper | `--paper` / `--site-paper` | `#FAF9F6` | Reading and working surfaces |
| Warm paper | `--warm-paper` / `--site-warm-paper` | `#F4F1EA` | Secondary surfaces |
| Ink | `--ink` / `--site-ink` | `#17171F` | Primary text |
| Muted ink | `--muted-ink` / `--site-muted` | `#69707E` | Secondary text |
| Champagne | `--champagne` / `--site-gold` | `#C9A46D` | Warm accents and primary marketing CTA |
| Soft amber | `--soft-amber` / `--site-amber` | `#F49A47` | EORA glow and warm gradients |
| Intelligent violet | `--intelligent-violet` / `--site-violet` | `#7865F5` | Selected controls and focus |
| Electric cyan | `--electric-cyan` / `--site-cyan` | `#66D9F7` | Intelligence highlights and focus |
| Deep indigo | `--deep-indigo` / `--site-indigo` | `#17132D` | Dark gradient depth |
| Border | `--soft-border` / `--site-border` | `#E4E0DC` | Paper cards and forms |

Typography follows the reference: **DM Sans** for UI and reading, **Space Grotesk** for headings, **JetBrains Mono** for short technical labels. The application has fallback fonts if those faces are unavailable. Working pages use paper backgrounds and restrained dark feature panels; the public page can be cinematic.

Shared components and selectors currently include auth forms, exact-screen onboarding controls, `StudentLayout`, `AdaptiveWorkspace`, `EoraFloatingCompanion`, and modal/drawer classes. A single component library migration remains **IN PROGRESS**. `AdaptiveWorkspace` now has a scoped paper/obsidian/champagne treatment in `components/workspace/adaptive-workspace.css`; auth contrast and EORA mobile placement are repaired in `app/landing-theme.css` and `app/eora-companion.css`.

Motion values from the landing reference: fast 160 ms, hover 240 ms, card 560 ms, section 760 ms, premium easing `cubic-bezier(.22,1,.36,1)`. The workspace uses 240 ms hover and 180–260 ms dialog entrance. Floating EORA uses a CSS amber sphere with expression states and slow orbital/hover motion. All motion must collapse under `prefers-reduced-motion`; focus and primary actions remain available without waiting for animation. Landing canvas observation pauses offscreen; dashboard motion uses no continuous canvas.

**Browser evidence:** landing viewport and overflow sweep passed at five widths; mobile auth and onboarding screenshots were inspected after the first repair. The full interaction and keyboard/reduced-motion visual gate for every authenticated route remains **IN PROGRESS**. Source inspection alone is not visual verification.
