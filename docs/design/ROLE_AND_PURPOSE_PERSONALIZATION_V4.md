# Role and purpose personalization V4

The public role selector offers Student and Faculty. Professional, Mentor, Alumni and Organization remain visible as coming soon. A faculty click records a requested role; it does not create an organization membership or grant any capability. The existing `can(personId, "student.verify_skill")` authorization gate remains the only path to verification work.

Purpose selection is an ordered list of one to three role-specific IDs. Position zero is Primary, position one Secondary, and position two Tertiary. Neither role nor purpose is preselected for a new visitor. The student journey keeps its existing career, resume, and evidence steps. Faculty branches from role selection to faculty purposes and a short institution request form, then opens `/faculty` in a pending state until a real membership authorizes protected work.

The existing `onboarding_drafts` JSONB stores in-progress choices. `user_preferences.primary_priority` and `secondary_priorities` store the completed ranking. `metadata.requestedRole` stores the request, `metadata.purposeVersion` records the model, and `metadata.widgetLayout` stores customization. No schema migration is needed.

Local hosting can use `DATABASE_MODE=pglite PGLITE_DATA_DIR=./previews/v4-db` to keep preview data isolated from the existing `.pgdata` directory while preserving choices across server restarts.

Code: `lib/domain/adaptive-workspace.ts`, `components/exact-screens/Screen3ChooseRole.tsx`, `Screen3aPriorities.tsx`, `FacultySetup.tsx`, and `components/workspace/AdaptiveWorkspace.tsx`.
