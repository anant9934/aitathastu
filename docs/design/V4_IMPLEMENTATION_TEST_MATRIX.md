# V4 implementation and test matrix

| Case | Expected result | Verification |
|---|---|---|
| Student and Faculty cards | Both selectable, four others coming soon | Browser role flow |
| New purposes | Nothing preselected | Browser Step 3 |
| Ranking | First, second, third order; move/remove; max three | Domain and browser tests |
| Role-specific IDs | Invalid or duplicate IDs rejected | API and domain tests |
| Faculty request | Pending state, no granted membership | Isolated browser flow and API check |
| Authorized faculty | Real queue count and protected link | Capability-backed API |
| Six student Primary purposes | Distinct first card and truthful data source | Composition/browser matrix |
| Six faculty Primary purposes | Distinct first card and availability state | Composition/browser matrix |
| Layout overrides | Pin, hide, order, size, density saved | API/browser checks |
| Goal and EORA | Specific goal separate; guidance uses saved purpose | UI/context review |
| Existing student journey | Student path still reaches student workspace | Core regression suite |

Use `DATABASE_MODE=pglite PGLITE_IN_MEMORY=true` for local browser runs. Run `npm run typecheck`, `npm test`, `node --import tsx scripts/verify-adaptive-v4.ts`, `node --import tsx scripts/verify-adaptive-v4-live.ts`, and `node --import tsx scripts/verify-adaptive-v4-onboarding-browser.ts`. Production deployment and database migrations are outside this work.

Screenshots are in `docs/screenshots/adaptive-v4`. `before` was captured from a separate Git HEAD snapshot on port 3002. `after` was captured from the current running code on port 3000 with isolated in-memory accounts. The old commit had no faculty workspace or customization screen, so their comparison is the former Faculty coming-soon card or generic student dashboard against the new screens. The faculty captures show the real pending state; no authorized faculty institution was fabricated for a screenshot.
