# Master Issue Register

**Severity scale:**  
- `HIGH` — Affects a significant number of users or creates a genuine accessibility barrier  
- `MEDIUM` — Degrades experience for a class of users or violates a pattern inconsistently  
- `LOW` — Polish, minor inconsistency, or improvement opportunity  
- `INFO` — Observation, no action required

---

## UX-001 — Global `:focus` outline removal

| Field | Value |
|-------|-------|
| **ID** | UX-001 |
| **Severity** | MEDIUM |
| **Category** | Accessibility |
| **File** | [app/globals.css:470](../app/globals.css#L470) |
| **Component** | Global base styles |

**Finding:** `:focus { outline: none }` is applied globally. `:focus-visible` restores a 2px `--accent-warm` outline. In browsers that do not support `:focus-visible` (older WebKit, some in-app browsers), no focus ring will appear at all.

**Impact:** Keyboard-only users on unsupported browsers cannot see which element has focus.

**Recommendation:** Add a `:not(.mouse-focused)` guard or use the `focus-visible` polyfill. Alternatively, since `:focus-visible` has near-universal support (Baseline 2022), add an explicit comment documenting the intentional removal and acceptable browser floor.

---

## UX-002 — Focus management: inline edit form

| Field | Value |
|-------|-------|
| **ID** | UX-002 |
| **Severity** | MEDIUM |
| **Category** | Accessibility / Focus Management |
| **File** | [components/profile/ProfileView.tsx](../components/profile/ProfileView.tsx) |
| **Component** | `AboutCard` inline edit |

**Finding:** When the user activates the Edit button on the About card, an inline form replaces the display text. No programmatic focus is moved to the first form field.

**Impact:** Keyboard users must Tab from the Edit button through intervening elements to reach the first form field.

**Recommendation:** After revealing the form, focus the first input with `firstInputRef.current?.focus()` inside a `useEffect` or `setTimeout` triggered by the edit mode state change.

---

## UX-003 — Canvas animations bypass `prefers-reduced-motion`

| Field | Value |
|-------|-------|
| **ID** | UX-003 |
| **Severity** | HIGH |
| **Category** | Accessibility / Motion |
| **File** | [components/landing/Landing.tsx](../components/landing/Landing.tsx) |
| **Component** | Neural network canvas + EORA orb canvas |

**Finding:** The landing page has two `requestAnimationFrame`-based canvas animations:
1. A continuously animated neural network background (100 nodes with connections and pulses)
2. The EORA orb with pupil mouse-tracking

Both use JavaScript RAF loops. The global CSS `@media (prefers-reduced-motion: reduce)` block does not govern JavaScript animations.

**Impact:** Users with vestibular disorders who have enabled reduced-motion will still see moving visuals. This can cause nausea, dizziness, or disorientation. WCAG 2.1 criterion 2.3.3 (AAA) and 2.3.1 (AA) apply.

**Recommendation:**
```js
// At animation start / in the animation loop:
const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (motionOk) {
  requestAnimationFrame(animate);
} else {
  // draw static snapshot only
}
```

---

## UX-004 — Skip link target missing on landing page

| Field | Value |
|-------|-------|
| **ID** | UX-004 |
| **Severity** | MEDIUM |
| **Category** | Accessibility |
| **File** | [app/layout.tsx](../app/layout.tsx), [components/landing/Landing.tsx](../components/landing/Landing.tsx) |

**Finding:** The root layout `app/layout.tsx` includes `<a href="#main">Skip to main content</a>`. The `id="main"` target is present in `StudentShell`, `AuthForms` (`AuthFrame`), and `OnboardingShell`. However, the `Landing` component does not define `id="main"` on its main content region.

**Impact:** Screen reader users navigating the landing page with the skip link will hear the link but activating it will not move focus.

**Recommendation:** Add `id="main"` and `tabIndex={-1}` to the `<main>` element in `Landing.tsx`.

---

## UX-005 — `aria-controls` missing on mobile hamburger button

| Field | Value |
|-------|-------|
| **ID** | UX-005 |
| **Severity** | LOW |
| **Category** | Accessibility |
| **File** | [components/ui/Nav.tsx:58](../components/ui/Nav.tsx#L58) |

**Finding:** The hamburger button in `Nav.tsx` has `aria-expanded={open}` but no `aria-controls` pointing to the mobile menu's ID. The mobile menu div has no `id` attribute.

**Recommendation:** Add `id="mobile-nav-menu"` to the menu div and `aria-controls="mobile-nav-menu"` to the button.

---

## UX-006 — Mobile menu DOM visibility vs screen reader visibility

| Field | Value |
|-------|-------|
| **ID** | UX-006 |
| **Severity** | MEDIUM |
| **Category** | Accessibility |
| **File** | [components/ui/Nav.tsx:70](../components/ui/Nav.tsx#L70) |

**Finding:** The mobile menu is hidden with `style={{ display: open ? "flex" : undefined }}`. When `open=false`, no `display` style is set (relies on CSS default or a CSS rule hiding the `.mobile-menu`). The links inside the menu remain in the DOM. Without `aria-hidden="true"` on the closed menu, screen readers may traverse those links even when the menu is visually closed.

**Recommendation:** Add `aria-hidden={!open}` to the mobile menu container, or use `display: none` reliably when closed.

---

## UX-007 — Footer social links use generic placeholder URLs

| Field | Value |
|-------|-------|
| **ID** | UX-007 |
| **Severity** | LOW |
| **Category** | Content |
| **File** | [components/ui/Footer.tsx:35](../components/ui/Footer.tsx#L35) |

**Finding:** Footer social links:
- GitHub: `https://github.com/anant9934/aitathastu` (appears real)
- LinkedIn: `https://linkedin.com` (generic root — no profile)
- X: `https://x.com` (generic root — no profile)

**Impact:** Clicking LinkedIn or X from the footer navigates to the generic homepage of those platforms, not any AI Tathastu profile. This is a broken UX that erodes trust.

**Recommendation:** Either link to actual AI Tathastu profiles on those platforms, or remove the social links until profiles are created.

---

## UX-008 — Footer social icons are text characters, not branded icons

| Field | Value |
|-------|-------|
| **ID** | UX-008 |
| **Severity** | LOW |
| **Category** | Visual Design |
| **File** | [components/ui/Footer.tsx:32](../components/ui/Footer.tsx#L32) |

**Finding:** Social links render as plain text: "GH", "IN", and "𝕏" in a monospace box. The rest of the UI uses Phosphor icons exclusively. Phosphor does not include brand icons (by design), but the use of text characters is inconsistent with the icon-based language and looks unpolished.

**Recommendation:** Use simple-icons (`simple-icons` package, already in `package.json`) for GitHub, LinkedIn, and X/Twitter brand SVGs.

---

## UX-009 — Footer draft notice visible to end users

| Field | Value |
|-------|-------|
| **ID** | UX-009 |
| **Severity** | MEDIUM |
| **Category** | Content / Trust |
| **File** | [components/ui/Footer.tsx](../components/ui/Footer.tsx) |

**Finding:** The footer bottom bar includes:
```
Review Drafts [Awaiting Owner/Legal Fact Verification]
```

This text appears on every page that renders the `Footer` component (landing, legal, public pages).

**Impact:** Visitors evaluating the platform's legal and privacy posture see a disclaimer that signals the legal content has not been reviewed. This undermines trust, particularly for users who care about data privacy.

**Recommendation:** Remove this text or gate it behind an admin/dev-mode flag until legal content is verified.

---

## UX-010 — Light mode: accent signal collapses to same value as ambient

| Field | Value |
|-------|-------|
| **ID** | UX-010 |
| **Severity** | LOW |
| **Category** | Design System |
| **File** | [app/globals.css:206](../app/globals.css#L206) |

**Finding:** In light mode, `--accent-primary` and `--accent-bright` are both `#89561F`. In dark mode, `--accent-primary` is `#C9A46D` (muted gold) and `--accent-bright` is `#F49A47` (bright orange). The distinction between ambient decoration (labels, dividers) and interactive signals (active tab indicator, badge pulse, CTA) is lost on the light theme.

**Impact:** Visual hierarchy between decorative and interactive elements is reduced on the light theme.

**Recommendation:** Define a slightly different `--accent-bright` value for light mode (e.g., a deeper or more saturated amber) to restore the visual distinction.

---

## UX-011 — Dashboard skills data refreshes without debounce

| Field | Value |
|-------|-------|
| **ID** | UX-011 |
| **Severity** | MEDIUM |
| **Category** | Performance / UX |
| **File** | [components/dashboard/DashboardView.tsx:38](../components/dashboard/DashboardView.tsx#L38) |

**Finding:** `DashboardView` attaches `visibilitychange` and `focus` event listeners that trigger a full skills API refetch. No debounce or minimum interval prevents rapid-fire requests when the user switches between the app and another window quickly.

**Impact:** In a development workflow where the user alternates between the app and their code editor, multiple API calls fire in rapid succession.

**Recommendation:** Add a minimum refetch interval (e.g., 30 seconds) using a `lastFetchTime` ref:
```js
const lastFetchRef = useRef(0);
const onVisible = () => {
  if (Date.now() - lastFetchRef.current > 30000) {
    lastFetchRef.current = Date.now();
    void loadSkills();
  }
};
```

---

## UX-012 — `Panel` component: `aria-labelledby` not enforced

| Field | Value |
|-------|-------|
| **ID** | UX-012 |
| **Severity** | LOW |
| **Category** | Accessibility |
| **File** | [components/ui/Panel.tsx](../components/ui/Panel.tsx) |

**Finding:** `Panel` renders as `<section>` by default but does not require `aria-labelledby`. Landmark sections without accessible names are valid HTML but provide reduced navigation quality for screen reader users who navigate by landmarks.

**Impact:** Screen reader landmark menu lists unlabelled sections as just "section", which is not helpful when there are multiple panels on one page.

**Recommendation:** Add a TypeScript compile-time nudge by requiring either `aria-labelledby` or `aria-label` when `as === "section"`, or document that consumers should always pass `id` to `PanelHeader` and `aria-labelledby` to `Panel`.

---

## UX-013 — Logo rendered differently in `Nav.tsx` vs `Logo.tsx`

| Field | Value |
|-------|-------|
| **ID** | UX-013 |
| **Severity** | LOW |
| **Category** | Visual Consistency |
| **File** | [components/ui/Nav.tsx:18](../components/ui/Nav.tsx#L18), [components/ui/Logo.tsx](../components/ui/Logo.tsx) |

**Finding:** The landing page navigation uses a custom inline logo (square CSS mark + bold text), while all other contexts use the `Logo` component (SVG triangle mark + split text weight). Font weight (700 vs 600), letter-spacing (-0.03em vs -0.02em), and the logo mark shape (square vs triangle) differ.

**Recommendation:** Replace the custom Nav logo with the shared `Logo` component to ensure consistent branding.

---

## UX-014 — Landing page uses two parallel responsive breakpoint systems

| Field | Value |
|-------|-------|
| **ID** | UX-014 |
| **Severity** | LOW |
| **Category** | Architecture / Maintainability |
| **File** | [app/globals.css:4107](../app/globals.css#L4107) |

**Finding:** The landing page uses custom `max-width` breakpoints (1080, 900, 768, 600, 480, 390px) that do not align with Tailwind's breakpoint scale (640, 768, 1024, 1280, 1536). The workspace pages use only Tailwind utilities.

**Impact:** Not a user-facing visual bug, but makes maintenance harder — a developer changing landing page responsive behaviour must work in two different breakpoint systems.

**Recommendation:** Migrate landing-page responsive styles to Tailwind utilities when the landing page is next refactored.

---

## UX-015 — `TabPanel` unmounts on tab switch (rather than hiding)

| Field | Value |
|-------|-------|
| **ID** | UX-015 |
| **Severity** | LOW |
| **Category** | Performance |
| **File** | [components/ui/Tabs.tsx:75](../components/ui/Tabs.tsx#L75) |

**Finding:** `TabPanel` returns `null` when `active === false`. This unmounts the panel's content, which is the simplest implementation but means any state or expensive work inside the panel (e.g., `ProjectLedgerView` publications tab, `DashboardView` sections) is discarded and must re-run on each tab switch.

**Impact:** Low performance cost on light panels; noticeable flicker or re-fetch on panels with API calls (e.g., Publications tab on Projects page).

**Recommendation:** For panels with API-loaded content, use `hidden` attribute or `className={active ? "" : "hidden"}` to preserve state while hiding the panel from view.

---

## UX-016 — `globals.css` landing styles loaded on all routes

| Field | Value |
|-------|-------|
| **ID** | UX-016 |
| **Severity** | INFO |
| **Category** | Architecture |
| **File** | [app/globals.css](../app/globals.css) |

**Finding:** `globals.css` (4,659 lines) is imported in the root layout and loaded on every page. The majority of lines (~3,000) are landing-page-specific styles (`.hero-*`, `.orb-*`, `.timeline-*`, `.skills-graph-*`, etc.) that are never used in the authenticated workspace.

**Impact:** CSS parse time is wasted on workspace pages. Not measurable as a UX issue in normal usage (CSS is cached), but it's a maintainability concern.

**Recommendation:** Extract landing-page styles into a `landing.css` module imported only by `Landing.tsx` when Next.js CSS module scoping is desired.

---

## UX-017 — `EmptyState` has no role when replacing live content

| Field | Value |
|-------|-------|
| **ID** | UX-017 |
| **Severity** | LOW |
| **Category** | Accessibility |
| **File** | [components/ui/EmptyState.tsx](../components/ui/EmptyState.tsx) |

**Finding:** `EmptyState` renders with no ARIA role. When a list transitions from a loaded state to empty (e.g., all projects deleted), the `EmptyState` that replaces the list is not announced to AT users.

**Recommendation:** Add `role="status"` and `aria-live="polite"` to `EmptyState`, or wrap it at the call site in a `<LoadingRegion>` equivalent.

---

## UX-018 — Onboarding step secondary nav items hidden in "More" sheet on mobile

| Field | Value |
|-------|-------|
| **ID** | UX-018 |
| **Severity** | LOW |
| **Category** | Discoverability |
| **File** | [components/layout/StudentShell.tsx](../components/layout/StudentShell.tsx) |

**Finding:** On mobile, the bottom tab bar shows only the 5 primary nav items. Secondary nav items (Roadmap, Journey, Assessments, Interviews, Privacy & Data) are accessible only through a "More" button that opens a sheet. These are important destinations that students may not discover.

**Impact:** Students on mobile may not know these features exist.

**Recommendation:** On the Overview page, add feature discovery cards or quick-link sections for secondary destinations. The current approach is architecturally sound (5-item bottom nav is a platform convention), but discoverability should be addressed through in-page promotion.

---

## UX-019 — `Badge` component: no semantic role for status information

| Field | Value |
|-------|-------|
| **ID** | UX-019 |
| **Severity** | LOW |
| **Category** | Accessibility |
| **File** | [components/ui/Badge.tsx](../components/ui/Badge.tsx) |

**Finding:** `Badge` is a `<span className="badge">` with no role. If used to show a count (e.g., "3 unread" notifications on a nav item), it needs to be announced to AT or the parent link needs an updated `aria-label`.

**Impact:** Screen reader users may not hear the count associated with a nav item.

**Recommendation:** When `Badge` is used inside a link or button to show a count, either include the count in the parent's `aria-label` (e.g., `aria-label="Connections (3 pending)"`) or add `aria-label` to the Badge itself.
