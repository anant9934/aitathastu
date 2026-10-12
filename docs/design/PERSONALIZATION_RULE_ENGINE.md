# Personalization rules

Inputs are requested workspace role, validated ranked purposes, specific student goal, actual evidence and ecosystem records, granted capabilities, and a versioned widget layout. Role selects a purpose registry. Ranking supplies default widget order and size. Layout may pin, hide, reorder, resize, and change density without rewriting purpose ranks. A primary-purpose change preserves layout overrides.

`composeWidgetIds` deduplicates widgets shared across rankings. `validPurposeIds` rejects invalid IDs; `validatePurposes` rejects duplicates and more than three choices. `normalizeWidgetLayout` limits overrides to registered widgets and supported sizes. Source records determine card content. Empty sources yield an explicit empty state. Protected cards use capabilities rather than requested role.

EORA's displayed guidance uses the selected role and Primary purpose and avoids claiming unretrieved activity. `/api/eora/context` returns role and authorization state with a minimal, person-scoped context.
