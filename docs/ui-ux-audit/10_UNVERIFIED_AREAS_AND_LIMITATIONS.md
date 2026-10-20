# Unverified Areas and Limitations

## Audit Method

This audit was conducted via **static source code analysis** — reading component source files, CSS, and page implementations. No browser was launched, no automated accessibility scanner (axe-core, Lighthouse, WAVE) was run, and no visual screenshots were taken.

---

## Pages Not Audited or Only Partially Audited

| Route | Reason |
|-------|--------|
| `/student/roadmap` | Component not read — partial feature (no `ProjectRoadmapView` found in discovery) |
| `/student/journey` | Component not read |
| `/student/assessments` | Component not read |
| `/student/interviews` | Component not read |
| `/faculty` | Outside student-focused scope of this audit |
| `/faculty/verification` | Outside scope |
| `/verification` | Component not read |
| All legal/privacy content | Content accuracy not reviewed (outside code audit scope) |

---

## What Was Not Tested

### Browser rendering
- Actual pixel rendering, overflow, clipping, font rendering
- Cross-browser differences (Safari, Firefox, Chrome, Samsung Internet)
- Real device testing (phone, tablet)
- Dark mode and light mode rendering side-by-side

### Colour contrast
- No formal WCAG 2.1 contrast ratio measurements were taken against any colour pair
- Estimates in `07_VALIDATION_RESULTS.md` are visual approximations only
- A full accessibility audit would require axe-core or manual measurement with a contrast analyser

### Screen reader testing
- No screen reader (NVDA, JAWS, VoiceOver) was used to navigate the app
- ARIA patterns were validated against written spec, not live AT behaviour
- Some AT interactions (e.g., EORA guide collapse button `aria-expanded`, focus within ConnectorList) were noted as unverified

### Form validation
- Form field validation states (required, invalid, error messages) were reviewed in code but not exercised with real form submissions
- Edge cases (empty submit, server error during save, network timeout) were not triggered

### Dynamic content / data-dependent states
- The audit covers the static/structural aspects of each view
- Conditional rendering based on data (e.g., what happens when a student has 200 skills vs 0) was reviewed only where the code was read

### Animation and motion
- The `prefers-reduced-motion` CSS block was verified in code
- Canvas-based animations (UX-003) were identified but not tested on a device with reduced-motion enabled

### Performance measurement
- No Lighthouse scores, Core Web Vitals, or bundle size measurements
- Performance observations are architectural estimates only

---

## Assumptions Made

1. **EORA image assets exist.** References to `/assets/eora/presenting.png` and `/assets/eora/avatar.png` assume these files are present in `public/assets/eora/`. Not verified.

2. **API routes return expected data shapes.** Component error states were reviewed; whether the APIs reliably deliver those shapes was not tested.

3. **`id="main"` target resolves correctly in StudentShell.** The skip link points to `#main`; the `PageFrame` component in `StudentShell` was assumed to render a main element with that ID.

4. **Light mode rendering is correct.** The CSS light-mode token overrides look correct in code, but light-mode rendering was not verified visually.

5. **All Tailwind utility classes resolve correctly.** Custom Tailwind utilities like `text-champagne`, `text-warm-ivory`, `text-2xs` were assumed to be defined in `tailwind.config` (not read during this audit).

---

## Scope Limitations

| Limitation | Impact |
|-----------|--------|
| No browser testing | Visual bugs invisible to code review may exist |
| No colour contrast measurement | WCAG AA compliance not formally certified |
| No screen reader testing | ARIA pattern correctness is analytical, not empirical |
| Legal content not reviewed | Legal accuracy of privacy policies, terms is unknown |
| Secondary workflow pages not audited | Roadmap, Journey, Assessments, Interviews are unstated |
| TypeScript types not fully traced | Some prop requirements inferred from usage, not from exhaustive type analysis |
| Tailwind config not read | Custom colour and utility definitions assumed from usage patterns |

---

## Recommended Next Steps Before Sign-Off

1. Run axe-core against every route (automated) — expected to surface contrast ratio issues not caught here
2. Manual screen reader test with VoiceOver on Safari (Mac/iOS) for the primary student journeys
3. Visual render test on at least: iOS Safari, Android Chrome, Firefox on Windows
4. Lighthouse audit on landing page (performance budget for canvas animations)
5. Legal review of all policy pages before removing the draft notice (UX-009)
6. Verify Tailwind config defines all custom colour tokens used in components
