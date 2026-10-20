# User Journey Audit

## Journey 1: New User — Sign-Up to First Dashboard View

### Steps

1. **Land on `/`** (Landing page)
   - Hero section with animated headline, EORA orb (3D canvas), neural network background
   - CTA: "Get Started" → `/onboarding`; "Sign In" → `/sign-in`
   - The "Get Started" button uses `LinkButton href="/onboarding"` — goes directly to onboarding without requiring sign-up first
   - **Gap UX-003:** Canvas animations run regardless of `prefers-reduced-motion`

2. **Navigate to `/sign-up`** (Sign-up form)
   - Two-column layout: form on left, EORA illustration on right (hidden on mobile)
   - Fields: Display name, email, password (with show/hide toggle), confirm password
   - Warm ambient glows behind the form (CSS decorative)
   - Google OAuth option present (GoogleLogo icon)
   - After sign-up → redirect via `/start`

3. **`/start` → `/onboarding`** (Auth entry redirect)
   - Server-side auth check; unfinished onboarding resumes at last screen

4. **Onboarding wizard** (`OnboardingApp`)
   - **Step 1 — Welcome:** Intro to EORA; role selection (student / faculty)
   - **Step 2 — Role:** Confirm/specify AI/ML role
   - **Step 3 — Direction:** Career direction, goals
   - **Step 4 — Priorities:** What matters most (placement, learning, research)
   - **Step 5 — CV upload:** Drag-drop or browse; async extraction with progress
   - **Step 5.5 — Footprint Intelligence:** Platform connections (GitHub, LinkedIn, etc.)
   - **Step 6 — Details:** Personal details, institution, degree
   - **Step 7 — Accounts:** Link coding profiles (LeetCode, HackerRank, etc.)
   - **Step 8 — Import:** LinkedIn CSV import
   - **Step 9 — Review:** Review extracted CV data, confirm/edit skills/projects
   - **Step 10 — Skills:** Confirm inferred skills, add self-reported ones
   - **Step 11 — Projects:** Review discovered projects, add manual ones
   - **Step 12 — Finish:** Completion celebration, go to workspace

   **Stepper:** Stage indicator (e.g., "Stage 2 of 4: CV & Discovery") + step progress bar + save indicator
   **EORA guide line:** Inline guidance below each step heading, collapsible, persisted to localStorage
   **Error handling:** Failed save keeps user on step with retry banner

5. **First workspace view** (`/student`)
   - DashboardView: StatRow, PriorityHero, SkillsMap, section cards
   - If skills/projects are empty: EmptyState with action prompts
   - JumpNav for within-page navigation

**Journey health:** ✅ Solid. The 13-step onboarding is guided and forgiving (resume autosaves). The only gap is the canvas animation on the landing page.

---

## Journey 2: Returning User — Sign-In and Workspace Navigation

### Steps

1. **`/sign-in`** → Email + password → `/start`
2. **`/start`** → Server checks onboarding completion:
   - Incomplete: redirect to `/onboarding` at last screen
   - Complete: redirect to `/student`
3. **`/student`** (workspace overview)
   - EORA launcher in rail/top bar
   - Jump nav for Overview → Skills Map → Dashboard sections
   - "Focus" button opens a drawer to change target role or priorities
   - Data refreshes on tab visibility change (no debounce — see UX-013)
4. **Navigating to `/student/skills`**
   - Skills map (SVG-based, interactive nodes)
   - Skill ledger with filter, search, hide toggle
   - Inline proficiency edit (POST to API, optimistic update)
   - Empty state with action prompt to add projects
5. **Navigating to `/student/connections`**
   - Per-source status chips
   - "Sync" / "Reconnect" buttons per connector
   - LinkedIn import panel
   - Footprint overview summary (connected / synced / records / health)

**Journey health:** ✅ Healthy with one concern: dashboard over-fetching on tab visibility changes.

---

## Journey 3: Student — Update Profile

### Steps

1. Navigate to `/student/profile`
2. Click "Edit" (PencilSimple icon) on About card
3. Inline form fields expand (TextField, TextAreaField, SelectField)
4. Save → `PATCH /api/student/profile` → toast success → data refreshes
5. On error: toast error with message

**Focus management:** Edit button revealed the inline form, but focus may not move to the first field. The form appears in-place without a focus directive.

**Finding UX-018:** Edit form opens inline without programmatic focus move to first field. Keyboard users must Tab from the edit button to reach the first form control.

**Journey health:** ✅ Mostly healthy. Minor focus management improvement possible.

---

## Journey 4: Student — Connect GitHub

### Steps

1. Navigate to `/student/connections`
2. Click "Connect GitHub" in ConnectorList
3. GitHub OAuth flow (browser redirect to github.com → callback)
4. Return to `/student/connections`
5. Source shows "syncing" chip while background sync runs
6. After sync completes: shows "synced" chip + last sync date

**Deep extraction:** After initial sync, `executeFullGitHubExtraction` runs asynchronously — per-repo commit stats, branches, PRs, manifests. This may take minutes for users with many repositories. The UI shows "syncing" status during this period.

**Finding:** No user-visible progress detail during deep extraction — just "syncing." Users with 50+ repos might wait several minutes with no feedback beyond the status chip. This is a UX gap but not a blocking issue.

**Journey health:** ✅ Functional. Deep extraction progress feedback is an enhancement opportunity.

---

## Journey 5: Student — Request LinkedIn Import

### Steps

1. Navigate to `/student/connections`
2. Find "LinkedIn" in connector list — status: "Linked" (reference_only) until extraction runs
3. Enter LinkedIn profile URL
4. Click "Import via Apify" (or similar trigger)
5. Backend: starts Apify actor run → polls → updates status
6. On success: status chip changes to "Imported" (connected + lastSyncedAt set)
7. Evidence records appear in profile/skills

**Journey health:** ✅ Healthy (fixed in previous session — status now correctly shows "Imported" after extraction).

---

## Journey 6: Student — Review Evidence and Request Verification

### Steps

1. Navigate to `/student/profile`
2. Scroll to Evidence Ledger
3. Find an evidence item; click "Request verification"
4. Dialog appears with verification form
5. Submit → `POST /api/student/evidence/verify` → toast success
6. Status chip changes from "evidenced" to "pending review"

**Journey health:** ✅ Functional based on code review; not fully verified without browser testing.

---

## Journey 7: Student — Privacy Controls and Data Export

### Steps

1. Navigate to `/student/privacy`
2. View consent audit trail (active consents + history)
3. Manage consent toggles (grant/withdraw)
4. Request data export (download link)
5. Submit data rights request (erasure, portability, correction)

**Journey health:** ✅ Well-implemented `PrivacyControlsView` and `DataRightsRequestCard`. DPDP 2023 framework present.

---

## Journey 8: Legal Policy Reading

All legal pages share the same shell (`LegalPageShell`) and renderer (`LegalContentRenderer`).

**Issue UX-009:** Every legal page in the footer carries the footer text:
```
Review Drafts [Awaiting Owner/Legal Fact Verification]
```
This notice is visible to all users, including potential users evaluating the platform's compliance posture. It signals that legal content is unreviewed and may undermine trust.

**Journey health:** ⚠️ Content issue. The pages load and render correctly; the problem is the draft status notice.

---

## EORA Companion Journey

EORA is omnipresent in the workspace:
- In onboarding: inline `EoraGuideLine` under each step heading
- In workspace: floating `EoraLauncher` in the rail with a chat panel
- TTS (SpeechSynthesis) support with language toggle (en-IN / hi-IN)
- Tour mode: highlights specific UI elements with an outline ring
- Intent recognition for free-form navigation ("go to skills", "show projects")

**Journey health:** ✅ Well-integrated. The tour mode and navigation intent recognition are distinctive features that reduce onboarding friction.
