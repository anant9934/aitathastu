# EORA Alive Phase 6 — Browser Certification

**Date:** 10 October 2026 (IST)
**Branch:** `codex/eora-alive-phase6`
**Base:** Phase 5.1 commit `2afecd3`
**Status:** Implemented and reviewable; resume extraction remains externally blocked. No merge or deployment was performed.

## What changed

- EORA now crossfades between the existing approved pose PNGs. Entrance, exit, wave, explanation, pointing, thinking, waiting, celebration, reassurance, and quiet states use restrained transforms. The still images do **not** support independent blinking, facial rigging, or lip synchronization.
- The floating companion uses a compact avatar and a scrollable help panel. The panel sits above form controls; automatic messages stay inside it. The trigger chooses a viewport corner that avoids visible controls. Only the landing hero keeps a large EORA illustration; the onboarding illustrations use the same approved assets at a compact size.
- Onboarding tours follow the student's own navigation and wait when the next screen requires form interaction. Tours can pause, resume, exit, highlight actual targets, scroll into view, and explain unavailable targets. The live dashboard now has stable goal and action target IDs.
- Resume extraction completion now invites claim review when the backend succeeds. A successful project save produces one short message and a tiny sparkle. Validation points to the problem field and clears when corrected. These reactions use the existing deterministic dialogue registry.
- `/api/eora/context` now sends `private, no-store`, and the bridge requests uncached data. Chrome verified that logout makes the endpoint return 401 and a second test account receives a different `personId`. The bridge also uses stable callbacks so normal EORA state changes do not refetch the account context repeatedly.
- Landing “Get Started” now enters `/onboarding`, allowing the correct EORA route and tour to load. The projects topbar no longer nests links, fixing a React hydration error found in Chrome.

## Real-browser method and results

The original Phase 5.1 app was opened in headless **Google Chrome through Playwright before visual edits**. The landing and mobile welcome screens rendered without console errors. The older V3.5 pilot browser script stopped at sign-in because its controlled pilot account did not authenticate, so Phase 6 uses a new disposable browser student created through the normal onboarding flow.

The final run drove the production build from the landing CTA through onboarding, validation, resume upload attempt, profile review, authenticated dashboard, projects, roadmap, mobile sizes, logout, and a second test account. It collected screenshots, page errors, HTTP responses, EORA request counts, control collision checks, and layout shift. Results are saved in [results.json](screenshots/eora-phase6/results.json). Reproduce it with `npm run test:browser-eora-phase6` using [verify-eora-phase6-browser.ts](../scripts/verify-eora-phase6-browser.ts).

| Gate | Result |
| --- | --- |
| Chrome interaction checks | **48 passed, 2 failed** of 50. Both failures are the same resume extraction HTTP 503. |
| Existing EORA tests | **231/231 passed**: V1 101, Phase 5 72, Phase 5.1 58. |
| Core intelligence tests | **14/14 passed**. This does not substitute for live resume analysis. |
| Production build, TypeScript, ESLint | Passed. |
| Browser JavaScript errors | **0** on the final run. |
| Routine EORA chat/AI/LLM requests | **0** observed. |
| Accessibility checks | Keyboard Escape closes the panel; tour controls and avatar have labels; reduced-motion mode disables pose animation. Spotlight and panel do not trap focus. A full WCAG audit was not performed. |
| Control overlap | Trigger clear on desktop, 768px tablet, 390px, and 320px. Help panel clear of academic fields on desktop and onboarding controls at 320px. |
| Layout shift | Chrome cumulative layout shift **0.0066** in the measured onboarding view. |
| Account isolation | Logout returned 401 from EORA context; second disposable account had a distinct `personId`; no credential-like fields appeared in the context response. |

All **17 tour IDs** were exercised in Chrome: seven onboarding, four dashboard, two skills, two projects, and two roadmap. The project targets were unavailable in the empty state and highlighted after creating a test project with a contribution note. The roadmap's “next action” target was absent for the test profile; EORA displayed the unavailable-target explanation and remained usable.

## Screenshots

These are actual Chrome captures from the final production run:

| Requested view | Evidence |
| --- | --- |
| Landing | [01-landing.png](screenshots/eora-phase6/01-landing.png) |
| Onboarding welcome | [02-onboarding-welcome.png](screenshots/eora-phase6/02-onboarding-welcome.png) |
| Field guidance | [03-field-guidance.png](screenshots/eora-phase6/03-field-guidance.png) |
| Validation error and correction | [04-validation-error.png](screenshots/eora-phase6/04-validation-error.png), [04-validation-correction.png](screenshots/eora-phase6/04-validation-correction.png) |
| Interactive tour | [05-interactive-tour.png](screenshots/eora-phase6/05-interactive-tour.png) |
| Resume analysis completion | **Not capturable:** extraction returned HTTP 503. [Blocked upload screenshot](screenshots/eora-phase6/06-resume-extraction-blocked.png). |
| Profile review | [07-profile-review.png](screenshots/eora-phase6/07-profile-review.png) |
| Personalized dashboard | [08-personalized-dashboard.png](screenshots/eora-phase6/08-personalized-dashboard.png) |
| Roadmap assistance | [09-roadmap-assistance.png](screenshots/eora-phase6/09-roadmap-assistance.png) |
| Mobile companion | [390px](screenshots/eora-phase6/10-mobile-390.png), [320px](screenshots/eora-phase6/10-mobile-320.png), [tablet](screenshots/eora-phase6/10-mobile-768.png) |
| Quiet and dismissed | [11-quiet-mode.png](screenshots/eora-phase6/11-quiet-mode.png), [12-dismissed.png](screenshots/eora-phase6/12-dismissed.png) |
| Genuine project save | [09-project-save-success.png](screenshots/eora-phase6/09-project-save-success.png) |

## Remaining limitation

`POST /api/resume/extract` returned **503** with “Resume import is unavailable until credential rotation is complete.” The normal skip path reached profile review and the authenticated dashboard. Live CV extraction completion and its EORA reaction could therefore not be certified, even though the success event is wired and the existing Core tests pass. The browser script intentionally exits nonzero until this endpoint is available and the completion screenshot is captured.

Playwright video capture was unavailable because the local Playwright ffmpeg binary is not installed. No recording is claimed.
