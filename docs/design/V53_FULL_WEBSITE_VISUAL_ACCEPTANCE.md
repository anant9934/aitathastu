# V5.3 full website visual acceptance

Status: **IN PROGRESS** · 12 October 2026. This report does not declare the entire website visually complete.

## Reference and method

The approved landing implementation is `components/landing/reference-markup.ts` with `ecosystem-landing.css`; existing screenshots in `docs/screenshots/ecosystem-landing/` are the reference captures. Public baseline screenshots are in `docs/screenshots/v53/public-baseline/`, with machine-readable `results.json`. Authenticated after screenshots and measurements are in `docs/screenshots/v53/authenticated-after/`, with `results.json`. Authenticated captures used synthetic accounts in in-memory PGlite, never the configured Neon connection. Screenshots are 900px-high viewports; they are not full-page evidence for every section.

| Surface | 320 | 390 | 768 | 1024 | 1440 | Status |
|---|---|---|---|---|---|---|
| Landing | captured | captured | captured | captured | captured | VISUALLY VERIFIED for viewport/overflow |
| Sign in / Sign up | captured | captured | captured | captured | captured | VISUALLY VERIFIED for viewport/overflow; after contrast fix inspected at 390 |
| Onboarding entry | captured | captured | captured | captured | captured | VISUALLY VERIFIED for entry viewport only; ten-step pass pending |
| Unauthenticated Student / Faculty | captured | captured | captured | captured | captured | VISUALLY VERIFIED for guest/error entry only |
| Authenticated Student home | captured | captured | captured | captured | captured | VISUALLY VERIFIED for first viewport and overflow |
| Student Journey, Roadmap, Skills, Projects, Profile, Connections, Assessments, Interviews, Verification | captured each | captured each | captured each | captured each | captured each | VISUALLY VERIFIED for first viewport and overflow |
| Faculty home and protected verification route | captured each | captured each | captured each | captured each | captured each | VISUALLY VERIFIED for first viewport and overflow; faculty is pending |
| Dynamic skill and project detail | — | — | — | — | — | NOT STARTED |
| Full ten-step onboarding and Faculty setup | — | — | — | — | — | IN PROGRESS; click-through Faculty path passed without complete screenshot matrix |

Public sweep: 30 captures, all HTTP 200, zero horizontal overflow, zero page errors. Authenticated sweep: 60 captures across 12 routes, all HTTP 200, zero horizontal overflow, zero page errors. The first authenticated sweep found eight overflow cases in the legacy topbar, Skills grids/filters, Roadmap grid, and Connections grid. The fixes were applied at those exact layout sources, and the final sweep reported no failures. Representative after screenshots were inspected for Student home desktop/mobile, Faculty pending mobile, Skills mobile, signup mobile, and onboarding mobile.

## Motion, overlays, and accessibility

The landing browser script tested tabs, EORA chip, FAQ, graph focus, CTA destinations, responsive anchors, reduced-motion rendering, and back-to-top. Its final run against the local production build **passed** at 1440, 1280, 768, 390, and 320px with zero overflow and no reported page errors. The earlier development-server run produced generic `Event` page errors and a back-to-top failure after other interactions; the isolated fresh-page control check and production-build rerun passed. The workspace dialog now supports Escape, Tab containment, body scroll lock, and focus return. The compact mobile EORA sphere was clicked in a real browser and opened its panel. Mobile standalone header contrast was inspected after the fix. Manual full keyboard exploration, WCAG contrast audit, and every animation state are still **IN PROGRESS**.

Remaining visual risks: mobile onboarding guidance still occupies a floating region near the page content; the compact treatment prevents clipping and leaves the primary next control visible, but all ten steps need manual review. The older standalone Student pages are themed through shared CSS and local component styles; complete full-page screenshot comparison and consolidation are pending. No preview deployment was checked.
