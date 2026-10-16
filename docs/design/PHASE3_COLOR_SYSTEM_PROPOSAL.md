# Phase 3 colour system: Direction B, Graphite and Signal

Status: **signed off by the owner (2026-10-15); shipped in Phase 3 (app/globals.css, DESIGN.md).**

- **What:** Direction B is the default theme, dark, with a designed light companion. It is switchable site-wide.
- **Where it applies:** the Phase 3 rebuild only. Phase 2 screens keep the current look and are not retrofitted (D-1).

**Live preview:** open `docs/design/phase3-palette-preview.html` in a browser. It shows both palettes side by side, a Dark/Light toggle that switches real components (buttons, cards, status chips, inputs with errors, banners, stats, type), and the measured contrast table.

## Why B

The people using this product work in GitHub, Kaggle, VS Code and terminals, and the core screens (skills map, project ledger, dashboard) are data-dense. B is a quiet graphite surface where the person's data is the brightest thing on screen. One blue "signal" marks action, and status colours carry evidence meaning.

The light companion exists for the cases where dark-first was weak: onboarding and long reading in bright daylight.

## Rules both modes share

- **Same roles, same hues.** Only lightness and contrast change between modes. Signal is blue in both, verified green, corroborated blue, evidenced violet, gap grey with a dashed outline.
- **One action colour.** Signal is the only colour for primary actions and links. Lime (`highlight`) is a fill behind ink text, used to mark something needing attention. It is never text and never a button.
- **Status is never colour alone.** Every status chip and banner carries an icon and a word. "Gap" is the only dashed outline.
- **Contrast:** every text pair is at least 4.5:1. Input borders and focus rings are at least 3:1 (WCAG 2.1, 1.4.3 and 1.4.11). All numbers below were measured with the WCAG relative-luminance formula; the preview recomputes them live.
- **Type:** Geist for UI and headings, Geist Mono for data (evidence IDs, counts, dates) with tabular figures. These must be loaded app-wide (closes P4-15).
- **Theme switching:** default `dark`. The user's choice is stored per device and applied before first paint (no flash), with a visible two-option toggle (Dark / Light) in the app header.

## Dark (default)

| Token | Hex | Role |
|---|---|---|
| canvas | `#0D1117` | page |
| surface | `#161B22` | panels, cards |
| raised | `#1C2330` | buttons, stat tiles, menus on a panel |
| ink | `#E6EDF3` | text |
| muted | `#9AA6B2` | secondary text, metadata |
| line | `#2A313C` | dividers (decorative) |
| line-strong | `#6B7685` | input borders, outline buttons |
| signal | `#5B9CFF` | primary button fill, links |
| signal-hover | `#7AB0FF` | primary hover |
| on-signal | `#0D1117` | text on signal |
| highlight | `#C3E66E` | attention fill; text on it is `#0D1117` |
| verified / bg | `#4CC38A` / `#12291E` | status |
| corroborated / bg | `#5B9CFF` / `#15233A` | status |
| evidenced / bg | `#B98CFF` / `#241A36` | status |
| gap | `#8B95A1` | status, dashed |
| warning / bg | `#E3B341` / `#2D2412` | banners |
| danger / bg | `#FF7B72` / `#321717` | errors, destructive |
| focus | `#7AB0FF` | focus ring |

Depth comes from tonal steps (canvas, then surface, then raised) plus a faint top highlight and a soft dark shadow. Borders do the structural work.

## Light companion

This is not an inversion. The canvas is a cool graphite grey with white panels, so the surface hierarchy holds without heavy shadows; it deliberately avoids the warm-cream default. The signal blue is darkened from `#5B9CFF` to `#1F5FCC` so white button text passes. Status hues keep their meaning and are deepened for text on white. Lime keeps the same hex because it is only ever a fill behind ink.

| Token | Hex | Role |
|---|---|---|
| canvas | `#F3F5F8` | page (cool grey) |
| surface | `#FFFFFF` | panels, cards |
| raised | `#FFFFFF` | buttons, tiles (separated by border + soft shadow) |
| ink | `#121820` | text |
| muted | `#4F5B69` | secondary text |
| line | `#D5DBE3` | dividers (decorative) |
| line-strong | `#7B8695` | input borders, outline buttons |
| signal | `#1F5FCC` | primary fill, links |
| signal-hover | `#184DA8` | primary hover |
| on-signal | `#FFFFFF` | text on signal |
| highlight | `#C3E66E` | attention fill; text on it is `#121820` |
| verified / bg | `#137A4B` / `#E5F4EC` | status |
| corroborated / bg | `#1F5FCC` / `#E6EEFC` | status |
| evidenced / bg | `#7239C4` / `#F1E9FB` | status |
| gap | `#6B7684` | status, dashed |
| warning / bg | `#8A5A00` / `#FBF1DC` | banners |
| danger / bg | `#B8322A` / `#FCE9E7` | errors, destructive |
| focus | `#1F5FCC` | focus ring |

## Measured contrast

| Pair | Need | Dark | Light |
|---|---|---|---|
| Ink on canvas | 4.5 | 16.02 | 16.33 |
| Ink on surface | 4.5 | 14.64 | 17.84 |
| Ink on raised | 4.5 | 13.34 | 17.84 |
| Muted on canvas | 4.5 | 7.63 | 6.34 |
| Muted on surface | 4.5 | 6.98 | 6.92 |
| Muted on raised | 4.5 | 6.36 | 6.92 |
| Signal text on surface | 4.5 | 6.30 | 5.89 |
| Signal text on canvas | 4.5 | 6.89 | 5.39 |
| Button text on signal | 4.5 | 6.89 | 5.89 |
| Button text on signal hover | 4.5 | 8.54 | 7.88 |
| Ink on highlight | 4.5 | 13.40 | 12.63 |
| Verified on surface | 4.5 | 7.81 | 5.37 |
| Verified on its chip | 4.5 | 6.96 | 4.72 |
| Corroborated on its chip | 4.5 | 5.73 | 5.05 |
| Evidenced on surface | 4.5 | 6.80 | 6.78 |
| Evidenced on its chip | 4.5 | 6.47 | 5.74 |
| Gap text on surface | 4.5 | 5.69 | 4.62 |
| Warning on surface | 4.5 | 8.89 | 5.93 |
| Warning on its banner | 4.5 | 7.86 | 5.28 |
| Danger on surface | 4.5 | 6.86 | 5.95 |
| Danger on its banner | 4.5 | 6.55 | 5.09 |
| Input border on surface | 3 | 3.75 | 3.69 |
| Focus ring on surface | 3 | 7.81 | 5.89 |
| Focus ring on canvas | 3 | 8.54 | 5.39 |

That is 24 pairs per mode and 48 in total, with 0 failures. The first measurement round failed one token in both modes: `line-strong`, which was 1.81 in dark and 2.96 in light. It was raised to the values above before this was written.

## Not part of this decision

Spacing, radius and motion tokens stay as the Phase 3 rebuild defines them. The preview uses an 8 px radius on controls, 12 px on panels and 150–200 ms transitions only as placeholders.

## Earlier candidates (not chosen)

- **A, Ink and verdigris:** light, scholarly; the brand colour doubled as "verified".
- **C, Indigo and terracotta:** light, warm, EORA-forward.

Both were set aside on 2026-10-15 in favour of B.
