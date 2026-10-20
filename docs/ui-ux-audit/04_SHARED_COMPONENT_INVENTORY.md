# Shared Component Inventory

All components are in `components/ui/`. Each entry includes: file, props surface, ARIA handling, and findings.

---

## Button (`Button.tsx`)

**Variants:** `primary`, `secondary`, `ghost`, `intel`, `danger`, `quiet`  
**Sizes:** `sm`, `md` (default), `lg`  
**Extras:** `loading` boolean, `icon` slot, `ForwardRef`

**ARIA:**
- `disabled` prop sets both HTML `disabled` and `aria-disabled`; loading state adds `aria-busy="true"` and `aria-label` "(loading)"
- `IconButton`: sets a minimum 44×44px touch target (`size-11`)

**Findings:**
- ✅ Ripple animation respects `prefers-reduced-motion` (via global CSS)
- ✅ `focusRing` class applied consistently
- ✅ `pointer-coarse:min-h-11` ensures coarse-pointer (touch) target size
- ℹ️ The `quiet` variant is not documented in the design system tokens — appears to be a utility variant for low-emphasis inline actions

---

## Badge (`Badge.tsx`)

Simple `<span className="badge">`. The `.badge` class is defined in `globals.css`.

**Findings:**
- ⚠️ No semantic role. Used as purely decorative labelling. If it carries status information, it should have `aria-label` or be inside a labelled context. Usage in practice appears decorative (navigation counts), so `aria-hidden="true"` may be appropriate.

---

## Banner (`Banner.tsx`)

**Kinds:** `info` (role="status"), `success` (role="status"), `warning` (role="status"), `danger` (role="alert")  
**Props:** `kind`, `title`, `children`, `action`, `live` (set to false for static banners)

**ARIA:**
- `role="status"` for info/success/warning — politely announced
- `role="alert"` for danger — immediately announced
- Icon is `aria-hidden="true"` (decorative)
- `live={false}` skips the role entirely for static decorative banners

**Findings:**
- ✅ Correct alert/status role split
- ✅ Recovery action slot renders inline — screen reader traverses: [icon] [title] [body] [action]

---

## Card (`Card.tsx`)

**Variants:** `surface` (default), `editorial`, `elevated`  
**Props:** All `HTMLDivElement` attributes, `glow` (boolean, default true)

The `glow` prop enables a CSS `--fx`/`--fy` custom property mouse-tracking effect that creates a subtle radial highlight on hover.

**Findings:**
- ⚠️ Mouse-tracking highlight (`onMouseMove` → CSS custom property) is pure CSS-driven and does not trigger reduced-motion. However it is decorative only (no motion, just a gradient position change) so this is acceptable.
- ✅ `ref` forwarded correctly for imperative DOM access

---

## EmptyState (`EmptyState.tsx`)

**Props:** `icon`, `title`, `children`, `actions`, `compact`

Renders a dashed-border box with an optional icon glyph, a title (in `font-display font-medium text-warm-ivory`), body text, and action buttons.

**Findings:**
- ⚠️ No `role` attribute. If the empty state replaces a live region (e.g., a list that becomes empty), it should be announced. Consider adding `role="status"` when rendered in place of previously loaded content.
- ✅ Dashed border visually communicates "placeholder" state without relying on colour alone

---

## EvidenceStrip (`EvidenceStrip.tsx`)

**Segments:** `verified`, `corroborated`, `evidenced`, `gap`  
**ARIA:** `role="img"` with computed `aria-label` from `evidenceSummary()`, e.g. "PyTorch evidence: 2 verified, 1 evidenced"

**Findings:**
- ✅ `role="img"` with full readable label — excellent screen reader experience
- ✅ Gap tier uses outline-dashed (not just colour) — distinguishable without colour
- ✅ `EvidenceLegend` component available for contextual legend

---

## Field (`Field.tsx`)

Components: `FieldShell`, `TextField`, `TextAreaField`, `SelectField`, `Checkbox`

**ARIA:**
- `FieldShell` generates `id`, `aria-describedby` pointing to hint/error spans
- `aria-invalid` on input when error present
- `aria-required` on input when required
- Label links to input via `htmlFor` (same generated ID)

**Findings:**
- ✅ Complete accessible form field pattern
- ✅ Autofill styling handled via `-webkit-autofill` override (dark mode background preserved)
- ⚠️ `Checkbox` component: needs verification that it uses `<input type="checkbox">` not a custom div toggle — not fully read in audit

---

## Label (`Label.tsx`)

Renders a `<span className="label">`. Variants: `warm` (default), `intel`, `ink`.

The `.label` class is a monospace uppercase tag with a leading horizontal rule drawn via `::before` content.

**Findings:**
- ℹ️ The `::before` animation (`labelDash`) fires every time the label enters the viewport (via entrance animations). If many labels are on screen simultaneously, could cause multiple simultaneous animations.
- ✅ Purely decorative — no ARIA needed

---

## Logo (`Logo.tsx`)

**Props:** `href` (default `/`), `label` (bool, default true)

Renders `<Link>` with `aria-label="AI Tathastu home"` → `LogoMark SVG` + optional text.

**LogoMark SVG:**
- Uses `color-mix(in srgb, var(--signal) 16%, transparent)` for fill
- Requires browser support for CSS `color-mix()` (Baseline 2023, all modern browsers)

**Findings:**
- ⚠️ In `StudentShell`, the Logo renders as `<Logo />` (with label=true) in the rail but in the landing page Nav, the logo is a custom implementation using `logo-mark` CSS class plus inline text — not using the `Logo` component. These two are visually similar but separate implementations. See UX-017.
- ✅ `aria-label` on link provides screen reader name

---

## Nav (`Nav.tsx`)

Public landing page navigation only. Scrolled state (`scrolled` class) on `window.scrollY > 20`. Mobile: hamburger with inline `style={{ display: open ? "flex" : undefined }}` toggle.

**ARIA:**
- `aria-label="Primary"` on `<nav>`
- `aria-label` on hamburger button with expanded/collapsed text
- `aria-expanded` on hamburger

**Findings:**
- ⚠️ Mobile menu visibility toggled via `style.display` rather than a proper hide/show mechanism. The links are in the DOM but hidden visually; screen readers may discover them while the menu is "closed" because `display: none` is applied inline without `aria-hidden` management. See UX-014.
- ⚠️ No `aria-controls` on hamburger button pointing to the menu's ID

---

## Overlay (`Overlay.tsx`)

Components: `Dialog`, `Drawer`, `Portal`

Full implementation with:
- Portal to `<body>` (avoids stacking context issues with transformed parents)
- Focus trap (Tab/Shift+Tab cycle within focusable elements)
- Stack-based Escape handling (only topmost overlay closes)
- Scroll lock with scrollbar-width compensation (prevents layout shift)
- Focus return to trigger on close
- `aria-modal="true"`, `role="dialog"` or `"alertdialog"`
- `aria-labelledby` pointing to title ID
- `aria-describedby` pointing to description ID (when provided)

**Findings:**
- ✅ One of the strongest implementations in the codebase — full WAI-ARIA Modal Authoring Practice compliance
- ✅ Backdrop click dismisses for `role="dialog"`, not for `role="alertdialog"` (correct)
- ✅ `initialFocus` ref prop allows directing focus to a specific element on open

---

## Panel (`Panel.tsx`)

Components: `Panel`, `PanelHeader`, `DividedList`

`Panel` renders as `<section>` by default; `as` prop allows any element. `padded` prop toggles inner padding.

**Findings:**
- ⚠️ Default `as="section"` without `aria-label` or `aria-labelledby` creates anonymous sections. Every `Panel` with `PanelHeader` should pass `id` to the header and `aria-labelledby` to the Panel. In practice, most usages do this — but the component does not enforce it. See UX-015.

---

## Pill (`Pill.tsx`)

Variants: `live` (default), `preview`, `illustrative`.  
The `live` variant renders a pulsing dot indicator (`.pill-live`).

**Findings:**
- ⚠️ The `live` variant's pulsing dot animation is CSS-based and governed by the `prefers-reduced-motion` block. ✅ Handled correctly.
- ℹ️ `preview` variant behaves identically to `live` — appears to be a placeholder for future differentiation

---

## SectionHead (`SectionHead.tsx`)

Composes `Label` + `<h2 className="h2">` + `<p className="lede">`. Used on landing page sections.

**Findings:**
- ✅ Uses semantic `<h2>` — landing page section structure is correct
- ⚠️ The `labelDash` animation fires on each SectionHead; with 6+ sections on the landing page, this creates sequential animations that may feel busy on a first visit

---

## Skeleton / LoadingRegion (`Skeleton.tsx`)

`Skeleton`: `aria-hidden="true"` shimmer block.  
`LoadingRegion`: `role="status"` + `aria-busy="true"` + `aria-live="polite"` wrapper with `sr-only` label.

**Findings:**
- ✅ Correct pattern: skeleton geometry is hidden from AT; the busy announcement is the only AT signal
- ✅ `motion-reduce:animate-none` on shimmer animation

---

## Spinner (`Spinner.tsx`)

SVG spinner, `aria-hidden="true"`. Surrounding element carries the loading label.

**Findings:**
- ✅ Decorative-only — correct pattern
- ✅ `motion-reduce:animate-none` applied

---

## StatusChip / Tag (`StatusChip.tsx`)

**StatusChip tones:** `verified`, `corroborated`, `evidenced`, `gap`, `warning`, `danger`, `neutral`, `signal`, `busy`  
**Tag:** Neutral metadata chip (technology name, source name)

Every tone has a distinct icon + colour combination.

**Findings:**
- ✅ Status never conveyed by colour alone — icon + word required by design
- ✅ `icon={null}` can be passed when context makes the icon redundant, documented in JSDoc
- ✅ Two sizes (`md`, `sm`) with consistent proportions

---

## Tabs (`Tabs.tsx`)

Full WAI-ARIA tabs pattern:
- `role="tablist"` on container
- `role="tab"`, `aria-selected`, `aria-controls` on each button
- `role="tabpanel"`, `id` matching `aria-controls` value on each panel
- Roving focus: ArrowLeft/ArrowRight/Home/End keyboard navigation
- `tabIndex={active ? 0 : -1}` on inactive tabs

**Findings:**
- ✅ Correct roving tabindex pattern
- ✅ `label` prop required for `aria-label` on tablist
- ✅ Horizontal scroll on narrow screens with scrollbar hidden (`[scrollbar-width:none]`)
- ⚠️ `TabPanel` renders `null` when inactive (unmounts) rather than `hidden` — this means tab panels with expensive content re-mount on every tab switch. Not a visual bug, but a performance consideration for tabs with heavy children.

---

## ThemeToggle (`ThemeToggle.tsx`)

`role="radiogroup"` container, `role="radio"` + `aria-checked` + `aria-label` per button.

**Findings:**
- ✅ Correct radiogroup/radio pattern
- ✅ Compact mode shows icon only; `aria-label` is still set on each button
- ✅ `pointer-coarse:h-10` ensures touch target on mobile

---

## EoraGuideLine (`EoraGuideLine.tsx`)

Inline onboarding EORA assistant panel. Renders inside `<aside aria-label="EORA, your guide">`. Collapse state persisted to `localStorage` with try/catch fallback.

**Findings:**
- ✅ `<aside>` with `aria-label` — correct landmark usage
- ✅ LocalStorage failure handled gracefully (remains open)
- ℹ️ Collapse button needs to verify aria-expanded toggle is implemented (partial read)

---

## EoraCompanion (`EoraCompanion.tsx`)

Floating launcher + card dock in workspace. Uses `openEoraChat()` custom event dispatcher for cross-component communication.

**Findings:**
- ✅ Portalled overlay (uses `Portal` component) — no stacking context issues
- ✅ SpeechSynthesis cleanup on unmount
- ⚠️ `EoraLauncher` image has `alt=""` (empty alt) — intentionally decorative (companion avatar), which is correct per ARIA. ✅
