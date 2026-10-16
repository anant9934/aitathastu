---
name: AI Tathastu
description: A graphite workspace where a person's evidence is the brightest thing on screen.
colors:
  canvas: "#0d1117"
  surface: "#161b22"
  raised: "#1c2330"
  sunken: "#0a0e13"
  ink: "#e6edf3"
  muted: "#9aa6b2"
  line: "#2a313c"
  line-strong: "#6b7685"
  signal: "#5b9cff"
  signal-hover: "#7ab0ff"
  on-signal: "#0d1117"
  signal-tint: "#15233a"
  verified: "#4cc38a"
  verified-bg: "#12291e"
  corroborated: "#5b9cff"
  corroborated-bg: "#15233a"
  evidenced: "#b98cff"
  evidenced-bg: "#241a36"
  gap: "#8b95a1"
  warning: "#e3b341"
  warning-bg: "#2d2412"
  danger: "#ff7b72"
  danger-bg: "#321717"
  focus: "#7ab0ff"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: "2.15rem"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.6rem"
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"ss01\" on"
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.3rem"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.3rem"
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.15rem"
  data:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: "2.15rem"
    fontFeature: "\"tnum\" on"
  data-sm:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    fontFeature: "\"tnum\" on"
rounded:
  check: "4px"
  inner: "6px"
  control: "8px"
  panel: "12px"
  pill: "999px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.signal-hover}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.raised}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.signal}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.signal-tint}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.danger-bg}"
  button-sm:
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  status-chip-verified:
    backgroundColor: "{colors.verified-bg}"
    textColor: "{colors.verified}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  status-chip-corroborated:
    backgroundColor: "{colors.corroborated-bg}"
    textColor: "{colors.corroborated}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  status-chip-evidenced:
    backgroundColor: "{colors.evidenced-bg}"
    textColor: "{colors.evidenced}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  status-chip-gap:
    backgroundColor: "transparent"
    textColor: "{colors.gap}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  tag:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.inner}"
    padding: "0 8px"
    height: "24px"
  banner-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  banner-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  nav-rail-item:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  nav-rail-item-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  tab:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.inner}"
    padding: "0 12px"
    height: "40px"
  tab-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  evidence-strip:
    rounded: "{rounded.pill}"
    height: "6px"
---

# Design System: AI Tathastu

## Overview

**Creative North Star: "The Evidence Console"**

A quiet graphite workspace for people who live in GitHub, Kaggle, VS Code and terminals. The chrome recedes into three close tonal steps of graphite so that the person's own data, their counts, skills, sources and verification tiers, is the brightest thing on screen. One signal blue marks every action and link; every other hue is a status colour that carries evidence meaning and never appears without an icon and a word.

Dark is the default and the home of the system; the light companion is designed, not inverted: a cool grey canvas with white panels, signal deepened so white text passes, status hues deepened for text on white. Both modes share roles and hues; only lightness moves. The theme is chosen before first paint from a per-device stored choice and switched by a visible two-option Dark / Light toggle, with all transitions suppressed during the swap.

Density is product-grade: a fixed rem type scale, 1 px borders doing the structural work, divided lists instead of nested cards, mono tabular figures for anything countable. The signature is the evidence strip, a thin segmented bar under every skill and claim whose segments are the evidence tiers behind it, rendered identically on the dashboard, skills map, profile, project ledger and landing preview. The system refuses gradient hero cards, decorative glow, and scores without provenance.

**Key Characteristics:**
- Three-step graphite tonal depth (canvas, surface, raised) plus a sunken well; borders over shadows.
- One action colour (signal blue) in both themes.
- Status hues (verified green, corroborated blue, evidenced violet, gap grey dashed) always paired with an icon and a word.
- Geist for UI, Geist Mono with tabular figures for counts, IDs, dates and step numbers.
- 8 px controls, 12 px panels, full pills for chips and strips.
- 44 px touch targets everywhere; dense desktop sizes grow back on coarse pointers.
- Short ease-out motion (150 to 220 ms), fully neutralised under reduced motion.

## Colors

A cool graphite neutral ramp carrying a single blue action signal and a four-tier evidence vocabulary; every text pair is measured at 4.5:1 or better and every input border and focus ring at 3:1 or better in both themes (see `docs/design/PHASE3_COLOR_SYSTEM_PROPOSAL.md`). Frontmatter values are the dark default; the light companion values live beside them under `:root[data-theme="light"]` in `app/globals.css` and in the sidecar. Components always reference the CSS variable (`var(--signal)`, `bg-signal`), never a hex, so both themes stay live.

### Primary
- **Signal Blue** (signal): the only colour for primary button fills, links (`.link`), the active-nav indicator, the active tab underline, the onboarding progress bar, text selection, caret and native control accents. Hover lifts to **Signal Hover** in dark and deepens in light. Text on a signal fill uses **On Signal**.
- **Signal Tint** (signal-tint): the quiet hover wash behind quiet buttons and signal-toned chips; also the corroborated chip background.
- **Focus Blue** (focus): every focus ring, 2 px outline at 2 px offset; inputs add a 3 px 30% halo.

### Secondary
- **Evidence tiers**: **Verified Green** (verified / verified-bg), **Corroborated Blue** (corroborated / corroborated-bg, same hue as signal by design: two or more sources agree), **Evidenced Violet** (evidenced / evidenced-bg, one source), **Gap Grey** (gap, transparent fill, dashed outline). Used only in StatusChip, EvidenceStrip, EvidenceLegend, Meter and the hero/skill visualisations.

### Tertiary
- **Warning Amber** (warning / warning-bg) and **Danger Coral** (danger / danger-bg): banners, toasts, field errors and the danger button. Banner text stays ink; only the icon takes the hue.

### Neutral
- **Graphite Canvas** (canvas): page background, sticky bar backgrounds at 95% (80% with backdrop blur).
- **Graphite Surface** (surface): panels, dialogs, drawers, the desktop rail, the bottom tab bar, input fills.
- **Graphite Raised** (raised): secondary buttons, tags, active nav and tab fills, icon wells, skeleton base. In light, raised equals surface and separation comes from the border.
- **Graphite Sunken** (sunken): meter and ring tracks, recessed wells.
- **Ink** (ink) and **Muted Slate** (muted): primary and secondary text; muted carries metadata, hints, captions and inactive nav.
- **Hairline** (line): decorative dividers, panel borders, divided lists, scrollbar thumb.
- **Strong Line** (line-strong): input borders, secondary button borders, the empty-state dashed border; the 3:1 non-text contrast boundary.
- **Scrim**: `rgb(1 4 9 / 0.66)` dark, `rgb(18 24 32 / 0.48)` light, behind every dialog and drawer.

### Named Rules
**The One Signal Rule.** Signal blue is the only action and link colour. No other hue fills a button except the outlined danger variant.

**The Icon-and-Word Rule.** Status is never colour alone. Every chip, banner, toast and legend entry carries an icon and a word; the evidence strip carries a full spoken summary as its accessible name.

**The Variable-Only Rule.** Colour is applied through the theme variables, never a literal hex, because every role has a different value in the light companion.

## Typography

**Display Font:** Geist (via `geist/font`, with ui-sans-serif, system-ui fallback)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular fallback)

**Character:** One neo-grotesque family in two cuts: Geist sets the interface with tight negative tracking on headings, Geist Mono sets the evidence itself (counts, readiness scores, step numbers, IDs, OTP digits) with tabular figures so numbers align and read as data.

### Hierarchy
- **Display** (600, 2.25rem to 3.75rem across breakpoints, 1.05, -0.035em): the landing hero headline only.
- **Headline** (600, 1.75rem to 2.25rem, -0.02em to -0.025em): page titles in the workspace and onboarding, landing section headings.
- **Title** (600, 1.125rem, 1.6rem line): panel headers, dialog and drawer titles, hero and next-step headings; 1rem for level-3 panel headers.
- **Body** (400, 1rem, 1.55, `ss01` on): running text; descriptions cap at 52 to 68ch.
- **Body small / Label** (400 or 500, 0.875rem): buttons, field labels, nav items, list descriptions.
- **Caption** (400, 0.8125rem and 0.75rem): hints, stat labels, provenance lines, chip text, tab-bar labels.
- **Data** (Geist Mono 600, 1.75rem to 2.25rem, tabular): stat tile values and hero numbers; Geist Mono 0.75rem for strip counts and list indices.

The scale is fixed rem with a ~1.2 ratio (`--text-2xs` through `--text-3xl` in `@theme`), never fluid inside the product.

### Named Rules
**The Mono-Means-Data Rule.** Geist Mono with tabular figures is reserved for values a person could count or look up: totals, scores, indices, step positions, IDs, codes. Prose and labels never use it.

**The Fixed Scale Rule.** Product UI uses only the eight `@theme` text steps; only the landing display headline reaches beyond them.

## Layout

A standard product shell. At 1024 px and up a fixed 240 px left rail (surface, right hairline) holds every destination, with a theme toggle, EORA launcher and account row at its foot; content sits to its right. Below 1024 px there is a 56 px sticky top bar (canvas at 95% with backdrop blur) and a five-cell bottom tab bar (four destinations plus More, which opens the remaining destinations in a drawer). One navigation model per size, never both.

Page content uses a centred frame: 1240 px max for wide pages, 880 px for narrow, with 16 / 24 / 32 px side padding at base / sm / lg and a title row 24 px above content. Onboarding uses its own 1120 / 760 px frame with a sticky top bar, a segmented 4 px progress bar and a sticky bottom action bar on phones. The landing runs at 1200 px with 64 to 80 px section padding and two-column hero and source grids from lg.

Rhythm is the 4 px Tailwind step: 4 and 8 px inside controls, 12 and 16 px between related items, 16 to 20 px panel padding, 24 to 32 px between page blocks. Stat tiles share one bordered container separated by 1 px gaps (the line colour showing through), not four separate cards. Breakpoints are Tailwind's sm 640, md 768 and lg 1024; `scroll-padding-top` is 5rem so sticky bars never cover a jump target.

## Elevation & Depth

Depth is tonal first: canvas, then surface, then raised, each a small lightness step, with 1 px borders doing the structural separation. Shadows exist only for two jobs: lifting a floating element (the EORA bubble and minimised pill, the landing preview figure) and seating an overlay (dialogs, drawers, the EORA panel). Dark shadows pair a faint top inner highlight with a deep soft drop; light shadows are short and cool. There is no glow and no coloured shadow.

### Shadow Vocabulary
- **Raise** (`--shadow-raise`; dark `0 1px 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)`; light `0 1px 2px rgb(18 24 32 / 0.06), 0 6px 16px -10px rgb(18 24 32 / 0.18)`): floating launchers and a showcased preview panel.
- **Overlay** (`--shadow-overlay`; dark `0 1px 0 rgb(255 255 255 / 0.05) inset, 0 24px 48px -16px rgb(0 0 0 / 0.7)`; light `0 2px 6px rgb(18 24 32 / 0.08), 0 24px 48px -20px rgb(18 24 32 / 0.32)`): dialogs, drawers, the EORA panel, always above a scrim.

### Named Rules
**The Tonal Step Rule.** A container is separated by a border and a tonal step, never by a shadow at rest. Panels never nest inside panels; use a divided list or a section inside one panel.

**The No-Glow Rule.** No blurred coloured halos, no gradient fills on cards. The only gradients are functional: the skeleton shimmer and data rings.

## Shapes

Gently rounded and consistent: 8 px on every control (buttons, inputs, banners, nav items, icon wells, source marks), 12 px on every container (panels, dialogs, drawers, empty states, the stat-tile group), 6 px for small inner pieces (tags, tabs, theme-toggle segments, language toggles), 4 px on checkboxes, and full pills for status chips, evidence strips, meters, avatars and progress segments. Dialogs become bottom sheets on phones with only the top corners rounded; drawers are square-edged full-height side sheets from md and bottom sheets below, with a 40 by 4 px grab handle. Borders are always 1 px solid, except that dashed means absent.

### Named Rules
**The Dashed-Means-Absent Rule.** A dashed outline signals something not there yet: the gap tier (chip, strip segment, empty strip) and empty-state containers. Nothing that is present is ever dashed.

## Components

### Buttons
Calm and exact; colour comes only from signal or danger.
- **Shape:** gently rounded (8 px), 1 px border always present (transparent when unused) so variants share a box.
- **Primary:** signal fill, on-signal text, 500 weight 0.875rem, 44 px tall with 16 px side padding; the landing CTA grows to 48 px and 1rem.
- **Hover / Focus / Press:** hover swaps to signal-hover; focus is the 2 px focus ring at 2 px offset; press scales to 0.98; 150 ms ease-out on colour, border and transform. Disabled and loading drop to 45% opacity; loading swaps the icon for a spinner and may swap the label ("Saving…").
- **Secondary:** raised fill, ink text, strong-line border that turns ink on hover. The default variant.
- **Ghost:** transparent, ink text, raised wash on hover. **Quiet:** transparent, signal text, signal-tint wash on hover. **Danger:** transparent, danger text, 60% danger border, danger-bg wash on hover.
- **Small:** 36 px, 12 px padding, returning to 44 px on coarse pointers. **Icon button:** 40 px square (44 px on touch), always with an accessible name and a title.

### Chips
- **StatusChip:** full pill, 24 px tall (20 px small), 1 px border at 35% of the tone, tone-bg fill, tone text, bold 14 px Phosphor icon plus a word. Tones: verified (seal check), corroborated (stack), evidenced (check circle), gap (dashed circle, transparent fill, dashed border), warning, danger, neutral, signal, busy.
- **Tag:** neutral metadata (a technology, a source): 6 px corners, raised fill, hairline border, muted 0.8125rem text; Geist Mono when the content is an identifier.

### Cards / Containers
- **Corner Style:** 12 px.
- **Background:** surface on canvas.
- **Shadow Strategy:** none at rest (see The Tonal Step Rule).
- **Border:** 1 px line.
- **Internal Padding:** 16 px, 20 px from sm. Panel headers are a title plus optional muted description (max 68ch) with actions wrapping to the right. Rows inside use hairline-divided lists.

### Inputs / Fields
- **Style:** 44 px, 8 px corners, 1 px strong-line border on surface, 12 px side padding, 1rem text, muted placeholder; hover nudges the border toward ink.
- **Focus:** border turns focus blue with a 3 px 30% focus halo.
- **Error / Disabled:** border turns danger; the error line below shows a bold warning icon and danger text, announced as an alert. Disabled drops to 55% opacity. Label sits above in 500 weight; hints sit below in muted caption. Selects draw their own chevron; checkboxes are 20 px with 4 px corners and signal accent.

### Navigation
- **Rail:** 40 px items, 8 px corners, muted 0.875rem 500 text with an 18 px Phosphor icon; hover gives a raised wash; active is raised fill, ink text, filled signal icon and a 2 px signal inset bar on the left edge. One small uppercase group label separates primary from secondary destinations inside the rail; it is a navigation group label, not a heading eyebrow, and uppercase is not a type role elsewhere.
- **Bottom tab bar:** five equal 56 px cells on surface at 95% with blur; 22 px icon over a 0.75rem label; active is signal with a filled icon.
- **Tabs:** 40 px (44 on touch), 6 px corners, muted text; active is raised fill with a 2 px signal underline drawn as an inset shadow. Scrolls horizontally, never wraps; arrow, Home and End keys move focus.
- **Theme toggle:** a radiogroup of two 32 px segments (40 on touch) inside an 8 px canvas well; active segment is raised with a 1 px strong-line ring and a filled icon.

### Banners, Toasts and Empty States
- **Banner:** 8 px corners, 12 by 14 px padding, tone-bg fill with a 40% tone border, ink title, muted body, 18 px tone icon, recovery action on the right. Danger is an alert; the others are status.
- **Empty state:** 12 px dashed strong-line (60%) container, a 36 px icon well, a 500-weight title, muted explanation up to 60ch and the one action that fills it.
- **Skeleton:** raised blocks shaped like the content, with a 1.4 s linear shimmer from raised through line; static under reduced motion. Wrapped in one polite busy region.

### Overlays
Dialogs and drawers are portalled to the body, trap and return focus, close the top layer on Escape and lock scroll without layout shift. Surface fill, hairline border, overlay shadow, scrim behind; header and footer separated by hairlines with 20 px side padding; footers reverse-wrap so the primary action sits right on desktop and on top when stacked. Entrance is 150 ms scrim fade plus a 180 to 220 ms rise or slide.

### Evidence Strip (signature)
A 6 px full-pill bar split into segments with 2 px gaps, one per evidence tier, each sized by its count with a 4 px minimum; verified, corroborated and evidenced are solid fills, gap is a dashed outline, and an empty strip is one dashed pill. Optional Geist Mono counts follow it, joined by middle dots. The accessible name reads the full summary ("PyTorch evidence: 3 verified, 1 evidenced"). One legend per view, never per row. The companion **Meter** is a 6 px pill on a sunken track with a single tone fill and a 300 ms width transition.

### Source Marks
Each connected source is a single-colour mark (ink, `currentColor`) in an 8 px raised well with a hairline border, 40 or 32 px. Brand paths come unaltered from Simple Icons (CC0); LinkedIn, portfolio and CV use Phosphor. No brand colours, nothing redrawn.

### EORA
The guide character appears as a 32 px round avatar on raised inside an 8 px surface strip (the in-flow guide line on onboarding) or a 48 px floating round avatar with the raise shadow that opens a 12 px overlay-shadow panel. EORA uses the same tokens as everything else: signal for the unread dot and Ask action, a 6 px EN / Hinglish segmented toggle, mono step counters.

## Do's and Don'ts

### Do:
- **Do** reference colour through the theme variables (`var(--signal)` or `bg-signal`) so the light companion follows automatically.
- **Do** pair every status hue with its Phosphor icon and a word, and give every evidence strip a spoken summary.
- **Do** set counts, scores, indices, step positions and IDs in Geist Mono with tabular figures.
- **Do** separate surfaces with a 1 px border and a tonal step; reach for `--shadow-raise` only on floating elements and `--shadow-overlay` only on overlays.
- **Do** keep every touch target at 44 px; dense desktop sizes must grow back on coarse pointers.
- **Do** use 8 px on controls and 12 px on containers, 6 px only on small inner pieces.
- **Do** keep motion to 150 to 220 ms with `--ease-out`, and suppress transitions while the theme switches.
- **Do** show provenance next to every number: a stat tile carries its source line, a skill carries its strip.

### Don't:
- **Don't** use any colour but signal for a primary action or a link.
- **Don't** use a status hue decoratively or without its icon and word.
- **Don't** dash anything that is present; dashed is reserved for gaps and empty states.
- **Don't** nest a panel inside a panel; use a divided list.
- **Don't** add glow, coloured shadows or gradient-filled cards.
- **Don't** add a type size outside the fixed `@theme` scale in product UI.
- **Don't** recolour or redraw source brand marks; they render in one colour from their CC0 paths.
- **Don't** show a score or count without the source or tier that backs it.
