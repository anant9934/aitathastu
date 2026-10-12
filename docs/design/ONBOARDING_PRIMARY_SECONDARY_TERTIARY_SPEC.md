# Ordered onboarding purposes

Step 3 uses the existing six-card arrangement. The first click fills Primary; later clicks fill Secondary and Tertiary. Cards show their current numbered rank. Clicking a selected card removes it and closes the gap. The ranking strip exposes keyboard-accessible Move up, Move down, and Remove buttons. At most three distinct IDs may be selected, and at least one is required to save.

Student IDs: `learning`, `jobs`, `people`, `collaboration`, `projects`, `research_events`.

Faculty IDs: `teaching`, `assessments`, `mentorship`, `research`, `projects`, `meetings`.

The server validates role, count, distinctness, and membership of each ID before completion or later preference updates. `primaryPriority` must match the first ordered ID at completion. Role changes clear the old ranking. Existing saved draft choices restore on reload.
