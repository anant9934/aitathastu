# Validation Results

**Method:** Static code analysis + visual/pattern review. No automated browser testing (Playwright, axe-core) was run during this audit phase. Results are derived from reading component source code, CSS, and page implementations.

---

## ARIA Pattern Validation

| Pattern | Component | Expected | Observed | Pass? |
|---------|-----------|----------|----------|-------|
| Modal dialog | `Overlay.tsx` → `Dialog` | role=dialog, aria-modal, aria-labelledby, focus-trap, Escape close | ✅ All present | ✅ |
| Alert dialog | `Overlay.tsx` → `Dialog role="alertdialog"` | role=alertdialog, no backdrop dismiss | ✅ | ✅ |
| Tab widget | `Tabs.tsx` | role=tablist, role=tab, aria-selected, aria-controls, role=tabpanel, roving tabindex, arrow key nav | ✅ All present | ✅ |
| Theme toggle | `ThemeToggle.tsx` | role=radiogroup, role=radio, aria-checked, aria-label | ✅ All present | ✅ |
| Live region | `Banner.tsx` | role=status/alert based on kind, aria-live="polite" | ✅ Correct split | ✅ |
| Loading region | `Skeleton.tsx` | role=status, aria-busy=true, aria-live=polite | ✅ | ✅ |
| Image strip | `EvidenceStrip.tsx` | role=img, aria-label with text summary | ✅ | ✅ |
| Nav current | `StudentShell.tsx` | aria-current="page" on active link | ✅ | ✅ |
| Nav landmark | `Nav.tsx` | `<nav aria-label="Primary">` | ✅ | ✅ |
| Form fields | `Field.tsx` | label-input association, aria-invalid, aria-required, aria-describedby | ✅ | ✅ |
| Skip link | `app/layout.tsx` | `<a href="#main">Skip to main content</a>` | ✅ Present | ⚠️ Target `#main` may be missing on landing page |
| Mobile menu | `Nav.tsx` | aria-expanded on hamburger button | ✅ | ⚠️ Missing aria-controls |
| Section landmark | `Panel.tsx` | `<section>` as default element | ✅ Present | ⚠️ aria-labelledby not enforced |
| Aside landmark | `EoraGuideLine.tsx` | `<aside aria-label="EORA, your guide">` | ✅ | ✅ |
| Empty state | `EmptyState.tsx` | No role | No role attribute | ⚠️ Should consider role=status when replacing live content |

---

## Focus Management Validation

| Scenario | Expected | Observed | Pass? |
|----------|----------|----------|-------|
| Dialog open | Focus moves to first focusable element (or autofocus target) | ✅ `requestAnimationFrame(focusFirst)` | ✅ |
| Dialog close | Focus returns to trigger element | ✅ `trigger.focus()` on cleanup | ✅ |
| Tab navigation | Only active tab in tab order; others at tabIndex=-1 | ✅ Roving tabindex | ✅ |
| Page navigation (onboarding) | Focus moves to `#main` on screen change | ✅ `document.getElementById("main")?.focus()` in `useLayoutEffect` | ✅ |
| Inline profile edit | Focus moves to first edit field | ⚠️ Not observed — no explicit focus directive on form reveal | ⚠️ UX-018 |
| Skip link target on landing | `#main` must exist | ⚠️ Landing page does not set `id="main"` on its main content | ⚠️ UX-019 |
| EORA launcher dismiss | Focus returns to launcher | Partial read — not fully verified | ℹ️ |

---

## Keyboard Navigation Validation

| Control | Keys | Expected | Pass? |
|---------|------|----------|-------|
| Nav links (StudentShell) | Tab | Sequential tab order through rail | ✅ |
| Tabs | Arrow keys, Home, End | Roving focus | ✅ |
| Dialog | Tab, Shift+Tab, Escape | Trapped, dismiss | ✅ |
| Buttons | Enter, Space | Activate | ✅ (native `<button>`) |
| Links | Enter | Navigate | ✅ (native `<a>`) |
| Theme toggle | Enter, Space (radio behavior) | Toggle theme | ✅ |
| Hamburger menu | Enter, Space | Open/close menu | ✅ |
| Form inputs | Tab through fields | Sequential | ✅ |
| EoraGuideLine collapse | Enter, Space | Toggle collapse | ℹ️ Not fully verified |

---

## Colour Contrast Notes (Estimated, not measured)

Dark mode combinations audited by eye — not formally measured against WCAG 2.1:

| Text / Background | Estimated Contrast | Notes |
|------------------|--------------------|-------|
| `#F4F4F2` on `#08090B` (primary text/canvas) | ~19:1 | ✅ Exceeds AAA |
| `#A8A199` on `#08090B` (muted on canvas) | ~8:1 | ✅ Exceeds AA |
| `#F49A47` on `#08090B` (signal on canvas) | ~6.5:1 | ✅ Passes AA |
| `#A8A199` on `#171513` (muted on elevated) | ~7.5:1 | ✅ Passes AA |
| Status chip text on chip bg (varies) | Not measured | ℹ️ Needs formal measurement |

Light mode: accent colour is `#89561F` on white — estimated ~6:1, passes AA. Muted text `#606775` on `#FAF9F6` — estimated ~5:1, passes AA at 16px body.

---

## Responsive Behaviour Notes

| Breakpoint | Issue | |
|-----------|-------|--|
| Mobile (<640px) | StudentShell: bottom tab bar shows 5 items; secondary nav in "More" sheet | ✅ Correct behaviour |
| Mobile | Auth form: two-column collapses to one column (EORA aside hidden) | ✅ |
| Mobile | Landing: custom max-width breakpoints (1080, 900, 768, 600, 480, 390) handle content reflow | ✅ Responsive |
| Tablet (640–1024px) | StudentShell: top bar + bottom tabs (no rail yet) | ✅ |
| Desktop (≥1024px) | StudentShell: left rail | ✅ |
| Mobile | Tabs component: horizontal scroll with hidden scrollbar | ✅ |

No horizontal overflow issues identified in static code review.

---

## Performance Considerations

| Item | Concern | Severity |
|------|---------|---------|
| Landing `Landing.tsx` (~1,500 lines) | Monolithic component; all landing sections render at once without lazy loading | Low — landing is a single scroll page |
| Neural network canvas animation | `requestAnimationFrame` loop; 100 nodes × connections per frame | Medium — no frame-rate cap or low-power mode detection |
| EORA orb mouse tracking | `mousemove` listener without throttle | Low — CSS transform is cheap; GPU-accelerated |
| Dashboard visibility refresh | Re-fetches on every `visibilitychange` with no debounce | Medium — see UX-013 |
| TabPanel unmounts on tab switch | Expensive tab children re-mount on every switch | Low — depends on usage |
| `globals.css` loaded everywhere | 4,659-line file includes landing-only styles for all routes | Low — CSS is cached after first load |

---

## Security / Content Concerns

| Item | Finding |
|------|---------|
| Footer draft notice | "Review Drafts [Awaiting Owner/Legal Fact Verification]" visible to all users — see UX-009 |
| Footer social links | Generic placeholder URLs (`linkedin.com`, `x.com`, `github.com/anant9934/aitathastu`) — the GitHub link appears to be a real repo, but LinkedIn and X are generic. See UX-007 |
| Legal content | All legal pages are marked as drafts; content accuracy unverified — not a code issue |
| `support@aitathastu.com` in footer | Email address exposed publicly — intentional contact address, not a security concern |
