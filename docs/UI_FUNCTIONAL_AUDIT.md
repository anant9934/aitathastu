# AI Tathastu — Comprehensive UI Functional Audit
**Audit Date:** October 8, 2026  
**Auditor:** AI Tathastu Technical Committee  
**Baseline Test Result:** 216 / 216 PASS (30 suites, 0 failures)  
**Baseline Lint/Typecheck:** 0 errors, 0 warnings  
**Build Status:** 60 / 60 Routes compiled  

---

## 1. Executive Summary & Defect Inventory

This audit comprehensively inventories every visible button, link, form, modal, and route across the AI Tathastu application, focusing on the AI/ML student experience.

### P0 Issues Identified:
1. **User Identity Inconsistency (Rahul Sharma vs ANANT):**
   - **Root Cause:** `components/exact-screens/Screen8ProfileInsights.tsx` had hardcoded static HTML containing `"Rahul Sharma"`, `<Image src="/rahul-avatar.jpg" alt="Rahul Sharma" />`, and an arbitrary `"85%"` completion meter. `Screen11OnboardingComplete.tsx` had hardcoded `"All set, Rahul! 🎉"`. `Screen12StudentDashboard.tsx` fell back to `/rahul-avatar.jpg` for the avatar image even when `data.studentName` was ANANT, and hardcoded `"Hi Rahul!"` in EORA dialogue.
   - **Severity:** P0 (Identity violation, confusing demo content leak in production flow).

2. **Profile Navigation Redirects to Sign In:**
   - **Root Cause:** In `components/student/student-context.tsx`, `fetchPerson360()` checks `/api/auth/session`. When an unauthenticated user or a user who completed onboarding via client-side prototype state clicks "Profile" (`/student/profile`), it redirects unconditionally to `/sign-in?from=/student` without validating the return URL or preserving the intended `/student/profile` destination. Additionally, `ExactScreensContainer.tsx` failed silently on unauthenticated `POST /api/onboarding-v2` (status 401) and fell back to local Screen 12 without establishing an authenticated session, leaving the user signed out when they subsequently navigated to `/student/profile`.
   - **Severity:** P0 (Broken navigation, authentication disconnect).

3. **Project Data Discrepancy (2 Confirmed in Onboarding vs 0 on Dashboard):**
   - **Root Cause:** `Screen10GitHubProjects.tsx` fell back to static `DEFAULT_PROJECTS` (Sentiment-Analyzer and AI Study Buddy) in local component state if `discoveredProjects` was empty, but never propagated this default to `ExactScreensContainer.tsx` unless the user toggled an edit. Furthermore, when unauthenticated, `POST /api/onboarding-v2` was rejected (401), so no project evidence records or database project rows were written. The real student dashboard reads `person360.evidence.filter(e => e.category === "project")`, which yielded 0 records.
   - **Severity:** P0 (Data loss between onboarding and dashboard).

---

## 2. Screen & Route Control Inventory

Status Definitions:
- **WORKS:** Fully functional, connected to real APIs and database persistence.
- **PARTIAL:** Partially functional; UI exists but lacks persistence, validation, or full synchronization.
- **DEMO:** Hardcoded prototype fixture, static placeholder, or simulated timer.
- **BROKEN:** Throws error, redirects unexpectedly, or fails to perform declared action.
- **DISABLED:** Truthfully disabled with informative badge or modal explaining current scope.

| Screen / Route | Element / Control | Type | Current Status | Findings & Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Landing (`/`, Screen 1)** | Logo / Home link | Link | **WORKS** | Navigates to `/`. |
| | "Sign in" button | Link | **WORKS** | Navigates to `/sign-in`. |
| | "Get started" button | Button | **WORKS** | Starts onboarding flow. |
| | Nav anchors (#students, #educators, etc.) | Link | **PARTIAL** | Smooth scroll anchors; educators/org sections link to anchors. |
| **EORA Intro (Screen 2)** | Name input field | Input | **WORKS** | Captures student name; needs prefill when session exists. |
| | "Continue" button | Button | **WORKS** | Advances to Screen 3. |
| | "Skip" button | Button | **WORKS** | Advances to Screen 3 with default name. |
| **Choose Role (Screen 3)** | "I'm a Student" card | Button | **WORKS** | Primary supported path. |
| | Non-student role cards (Faculty, Mentor, etc.) | Button | **DEMO** | Enabled in prototype; must display "Coming Soon" badge and guide student role. |
| | Stepper Prev / Next | Button | **WORKS** | Advances between steps. |
| **Academic Details (Screen 4)** | Full Name, Email, Mobile | Form | **PARTIAL** | Had "Rahul Sharma" placeholder; needs generic placeholder and session prefill. |
| | Institution, Department | Inputs | **WORKS** | Captures college and major. |
| | Graduation Year | Input | **PARTIAL** | Needs clean cohort year selection (e.g. 2026, 2027). |
| **Resume Upload (Screen 5)** | File Upload Picker | Input | **WORKS** | Calls `/api/resume/extract`; handles PDF/DOCX magic bytes. |
| | Unverified evidence badge | Badge | **WORKS** | Correctly marks extracted evidence as unverified. |
| | Skip / Enter manually | Button | **WORKS** | Allows skipping file upload. |
| **Digital Footprints (Screen 6)**| GitHub Connect | Form/API | **WORKS** | Calls `/api/onboarding-v2/github` and discovers public repos. |
| | Other profiles (LinkedIn, LeetCode, etc.) | Inputs | **WORKS** | Captures URLs with domain validation. |
| **AI Analysis (Screen 7)** | Progress bar & Checklist | Display | **DEMO** | Simulated timers (75% -> 92% -> 100%). Replace with real synthesis state. |
| **Profile Insights (Screen 8)** | Name / Avatar card | Display | **DEMO / BROKEN** | Hardcoded "Rahul Sharma" and `/rahul-avatar.jpg`. Must bind to real user name & avatar initials. |
| | 85% Completion Gauge | Display | **DEMO / BROKEN** | Static circular SVG with hardcoded 85%. Must reflect actual field completion. |
| | Key Information Grid | Display | **DEMO / BROKEN** | Hardcoded "Chandigarh, India", "B.Tech CSE 2022-2026". Must bind to actual inputs. |
| **Skills Map (Screen 9)** | Bubble cluster | Visual | **DEMO** | Static SVG lines and hardcoded coordinates. Replace with evidence-grounded interactive map. |
| | Skill category badges | Chips | **WORKS** | Programming, AI/ML, Tools categories. |
| **GitHub Projects (Screen 10)**| Project card list | List | **PARTIAL** | Hardcoded fallback projects; bordered list needs card redesign and wrap fixes. |
| | Contribution selector | Dropdown | **WORKS** | Allows selecting ML, Backend, Frontend contribution roles. |
| | Confirm / Remove toggle | Button | **PARTIAL** | Needs guaranteed sync with container state and database write. |
| **Onboarding Complete (Screen 11)**| "All set, Rahul!" title | Heading | **DEMO / BROKEN** | Hardcoded "Rahul". Must display real student name. |
| | "Go to my dashboard" | Button | **PARTIAL** | If user not logged in, failed silently to Screen 12. Must persist and route cleanly. |
| **Student Dashboard (`/student`)** | Header Avatar & Profile Badge | Badge | **DEMO / BROKEN** | Displayed `/rahul-avatar.jpg` and was non-clickable. Must link to `/student/profile` with initials. |
| | Left Sidebar "Projects" | Link | **BROKEN** | Was null / inert. Needs link to projects or anchor on dashboard. |
| | Left Sidebar "Profile" | Link | **BROKEN** | Redirected unauthenticated users to `/sign-in?from=/student`. Needs returnTo preservation. |
| | Readiness Score Card | Card | **WORKS** | Defensible policy: gate active until >2 verified evidence items. |
| | "What Matters Now" (Actions) | Cards | **WORKS** | Displays top grounded actions from roadmap. |
| | EORA Insight Box | Display | **PARTIAL** | Contained "Hi Rahul!" in static text. Must use dynamic student name. |
| **Person 360 Profile (`/student/profile`)** | Editable Profile Form | Form | **WORKS** | Calls `/api/student/profile`; persists to `person_profiles`. |
| | Evidence Ledger | Table | **WORKS** | Displays verified vs unverified items with provenance. |
| | Request Verification Modal | Modal | **WORKS** | Calls `/api/verification/requests`. |
| **Skills Page (`/student/skills`)** | Skill Directory | Page | **PARTIAL** | Dark cyberpunk theme `#0D0F17`. Needs warm ivory/violet palette and interactive map. |
| **Skill Detail (`/student/skills/[skill]`)** | Evidence & Projects breakdown | Page | **PARTIAL** | Dark theme `#0D0F17`. Five trust states work; needs UI palette consistency. |
| **Roadmap (`/student/roadmap`)** | Progression stages & next actions | Page | **WORKS** | Grounded in verified evidence; stage calculations work. |
| **Connections (`/student/connections`)** | Partner Apps & GitHub | Page | **WORKS** | Displays truthful "Reference only" or "Coming later"; zero fake active badges. |

---

## 3. Plan of Action (Step-by-Step)

1. **Step 1: P0 User Identity & Demo Removal:**
   - Eliminate hardcoded "Rahul Sharma", `/rahul-avatar.jpg`, and `"85%"` across `Screen8ProfileInsights.tsx`, `Screen11OnboardingComplete.tsx`, and `Screen12StudentDashboard.tsx`.
   - Implement real user avatar initials component with verified session name.
   - Replace static completion gauge with real calculation based on provided fields.
   - Remove fake "Hi Rahul!" and demo copy from EORA dialogs.

2. **Step 2: P0 Profile Navigation & Auth Session Fix:**
   - Fix `/sign-in` return URL handling: sanitize `from` / `returnTo` to avoid open redirects, preserve `/student/profile`.
   - Update `WorkspaceProvider` in `student-context.tsx` to preserve `window.location.pathname` in `returnTo`.
   - Make the topbar profile chip in `Screen12StudentDashboard.tsx` clickable, linking to `/student/profile`.
   - Fix sidebar "Projects" and "Profile" links.

3. **Step 3: Onboarding Database Persistence & Project Consistency:**
   - Ensure `POST /api/onboarding-v2` handles both authenticated sessions and creates/persists draft state cleanly.
   - Wire `ExactScreensContainer.tsx` so that `name`, `academic`, `skills`, `projects`, and `goal` are fully preserved across refreshes.
   - Fix `Screen10GitHubProjects.tsx` and `ExactScreensContainer.tsx` so confirmed projects are guaranteed to be saved and written as both `projects` and `evidenceItems` (category `project`).
   - Validate that completing onboarding with 2 confirmed projects displays exactly 2 confirmed projects on `/student`.

4. **Step 4: Projects UI & Skills Map Redesign:**
   - Redesign project cards in `Screen10GitHubProjects.tsx` and student workspace with warm ivory/violet cards, source badges, tech tags, and contribution selectors.
   - Redesign Skills Map in `Screen9SkillsMap.tsx` and `/student/skills` using deterministic SVG layout, accessible keyboard support, and clear evidence trust badges.
   - Align `/student/skills` and `/student/skills/[skill]` styling with the core ivory/violet design system.

5. **Step 5: Testing & Certification:**
   - Add automated integration tests verifying multi-user isolation (User A vs User B), profile navigation, onboarding persistence, and project count parity.
   - Run full quality battery (`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`).
