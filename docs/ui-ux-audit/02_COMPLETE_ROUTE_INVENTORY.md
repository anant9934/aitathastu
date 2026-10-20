# Complete Route Inventory

Legend: `Auth?` = requires authentication, `Shell?` = rendered inside StudentShell

## Public Routes

| Route | Auth? | Shell? | Page Component | Primary UI Component | Status |
|-------|-------|--------|---------------|---------------------|--------|
| `/` | No | No | `app/page.tsx` | `Landing` | ✅ Active |
| `/sign-in` | No | No | `app/sign-in/page.tsx` | `AuthForms → SignInForm` | ✅ Active |
| `/sign-up` | No | No | `app/sign-up/page.tsx` | `AuthForms → SignUpForm` | ✅ Active |
| `/start` | No | No | `app/start/page.tsx` | Auth entry (server redirect) | ✅ Active |
| `/onboarding` | Soft (redirects on complete) | No | `app/onboarding/page.tsx` | `OnboardingApp` | ✅ Active |
| `/verification` | No | No | `app/verification/page.tsx` | (unknown — not read) | ⚠️ Not fully audited |
| `/faculty` | No | No | `app/faculty/page.tsx` | `FacultyViews` | ℹ️ Outside student scope |
| `/faculty/verification` | No | No | `app/faculty/verification/page.tsx` | `FacultyViews` | ℹ️ Outside student scope |
| `/dashboard` | No | No | `app/dashboard/page.tsx` | Redirects to `/student` | ✅ Active (redirect) |

## Legal / Policy Pages (Public)

| Route | Auth? | Shell? | Renderer | Status |
|-------|-------|--------|----------|--------|
| `/privacy` | No | No | `LegalPageShell` + `LegalContentRenderer` | ✅ Active (draft notice) |
| `/privacy/your-rights` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/resume-processing` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/ai-processing` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/digital-sources` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/children` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/retention` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/service-providers` | No | No | Same | ✅ Active (draft notice) |
| `/privacy/institution-sharing` | No | No | Same | ✅ Active (draft notice) |
| `/terms` | No | No | Same | ✅ Active (draft notice) |
| `/cookies` | No | No | Same | ✅ Active (draft notice) |
| `/cookie-settings` | No | No | `CookieSettingsManager` | ✅ Active |
| `/acceptable-use` | No | No | Same | ✅ Active (draft notice) |
| `/copyright` | No | No | Same | ✅ Active (draft notice) |
| `/accessibility` | No | No | Same | ✅ Active (draft notice) |
| `/security` | No | No | Same | ✅ Active (draft notice) |
| `/grievance` | No | No | Same | ✅ Active (draft notice) |
| `/disclaimer` | No | No | Same | ✅ Active (draft notice) |
| `/evidence-policy` | No | No | Same | ✅ Active (draft notice) |

## Authenticated Student Routes (inside StudentShell)

| Route | Shell? | Page Component | Primary UI Component | Nav Location | Status |
|-------|--------|---------------|---------------------|--------------|--------|
| `/student` | Yes | `app/student/page.tsx` | `DashboardView` | Primary nav: Overview | ✅ Active |
| `/student/skills` | Yes | `app/student/skills/page.tsx` | `SkillsView` | Primary nav: Skills | ✅ Active |
| `/student/skills/[skill]` | Yes | `app/student/skills/[skill]/page.tsx` | `SkillDetailView` + `SkillDetailPanel` | Child of Skills | ✅ Active |
| `/student/projects` | Yes | `app/student/projects/page.tsx` | `ProjectLedgerView` | Primary nav: Projects | ✅ Active |
| `/student/projects/[id]` | Yes | `app/student/projects/[id]/page.tsx` | `ProjectDetailView` | Child of Projects | ✅ Active |
| `/student/profile` | Yes | `app/student/profile/page.tsx` | `ProfileView` | Primary nav: Profile | ✅ Active |
| `/student/connections` | Yes | `app/student/connections/page.tsx` | `ConnectionsView` | Primary nav: Connections | ✅ Active |
| `/student/roadmap` | Yes | `app/student/roadmap/page.tsx` | (not read) | Secondary nav: Roadmap | ⚠️ Not fully audited |
| `/student/journey` | Yes | `app/student/journey/page.tsx` | (not read) | Secondary nav: Journey | ⚠️ Not fully audited |
| `/student/assessments` | Yes | `app/student/assessments/page.tsx` | (not read) | Secondary nav: Assessments | ⚠️ Not fully audited |
| `/student/interviews` | Yes | `app/student/interviews/page.tsx` | (not read) | Secondary nav: Interviews | ⚠️ Not fully audited |
| `/student/privacy` | Yes | `app/student/privacy/page.tsx` | `PrivacyControlsView` | Secondary nav: Privacy & Data | ✅ Active |

---

## Navigation Structure

### Public Navigation (`Nav.tsx`)
- Rendered in the top bar on the landing page only
- Links: Journey, Learning, Evidence, Projects, EORA (anchor links within `/`)
- Actions: ThemeToggle, Sign In link, "Get Started" primary button
- Mobile: Hamburger with full-height drawer; `aria-expanded` toggled correctly

### Student Navigation (`StudentShell.tsx`)
**Primary nav** (always visible in rail / bottom tab bar):
1. `/student` — Overview (House icon)
2. `/student/skills` — Skills (Graph icon)
3. `/student/projects` — Projects (FolderSimple icon)
4. `/student/profile` — Profile (UserCircle icon)
5. `/student/connections` — Connections (PlugsConnected icon)

**Secondary nav** (desktop: visible in rail below divider; mobile: inside "More" sheet):
1. `/student/roadmap` — Roadmap (Path icon)
2. `/student/journey` — Journey (Timer icon)
3. `/student/assessments` — Assessments (ListChecks icon)
4. `/student/interviews` — Interviews (ChatsCircle icon)
5. `/student/privacy` — Privacy & Data (ShieldCheck icon)

**Bottom of rail (desktop only):**
- EORA launcher (EoraLauncher component)
- Sign out button

### Onboarding Navigation (`OnboardingShell.tsx`)
- Stage progress: 4 stages (student) / 2 stages (faculty) with a progress bar
- Step position: "Step N of M" text indicator
- Back / Next / Skip buttons
- Save indicator (saving / saved / error states)
- Logo top-left; ThemeToggle top-right

---

## API Routes (count)

~60 API route handlers in `app/api/`, covering:
- Auth: sign-in, sign-up, sign-out, session
- Student: dashboard, skills, projects, profile, connections, privacy
- Workspace: preferences
- Resume: extract
- EORA: chat, context
- GitHub, LinkedIn, and other connector sync endpoints
- Faculty: queue, verification
- Processing-jobs, provenance, ledger endpoints

(Full API inventory is out of scope for the UI/UX audit.)
