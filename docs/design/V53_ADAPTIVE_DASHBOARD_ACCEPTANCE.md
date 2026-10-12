# V5.3 adaptive dashboard acceptance

Status: **VERIFIED LOCALLY** for isolated account, role, ranking, customization API and pending faculty authorization. **IN PROGRESS** for complete browser customization and all real ecosystem integrations. 12 October 2026.

## Implemented composition

`lib/domain/adaptive-workspace.ts` is the role-specific registry and layout normalizer. Student purposes: learning, jobs, people, collaboration, projects, research/events. Faculty purposes: teaching, assessments, mentorship, research, projects, meetings. `components/workspace/AdaptiveWorkspace.tsx` displays the ordered purposes and real API-backed data where present. User layout includes pinned, hidden, ordered, density, and size fields. `app/api/workspace/preferences/route.ts` persists the ranked purposes and layout in the authenticated person's preferences. EORA's context API sees the saved primary purpose. The first purpose determines the default headline and top focus; a user-saved pin/order can intentionally move a widget.

## Evidence

| Gate | Result | Evidence |
|---|---|---|
| Six student and six faculty purpose registries | VERIFIED LOCALLY | `node --import tsx scripts/verify-adaptive-v4.ts` passed |
| Role-specific IDs, distinct 1–3 ranking, layout normalization | VERIFIED LOCALLY | Same domain test passed |
| New student onboarding, saved ranking, custom layout readback | VERIFIED LOCALLY | `verify-adaptive-v4-live.ts` against `DATABASE_MODE=pglite PGLITE_IN_MEMORY=true` passed |
| Student role spoof through preference metadata | VERIFIED LOCALLY | Same live test retained Student role |
| Faculty purpose request remains pending | VERIFIED LOCALLY | Same live test and click-through browser test passed |
| Pending faculty denied verification queue | VERIFIED LOCALLY | API returned 403 in both tests |
| Faculty onboarding through actual browser controls | VERIFIED LOCALLY | `verify-adaptive-v4-onboarding-browser.ts` passed against isolated preview |
| Keyboard-managed customization dialog | IN PROGRESS | Focus trap, Escape, focus return implemented; full keyboard walkthrough pending |
| Save, refresh, logout and re-login | VERIFIED LOCALLY for API persistence; browser UI IN PROGRESS | `verify-v53-user-journey.ts` saved preferences, signed out, signed in, and read them back; manual browser customization walkthrough pending |
| Real product availability and authorized faculty queue | BLOCKED | Requires connected preview capabilities and an authorized faculty fixture |

The isolated local checks generated only synthetic `example.test` accounts in in-memory PGlite. They did not write to the configured Neon database. No preview or production deployment was tested.
