# AI Tathastu — Phase 0 Step-by-Step UI/UX & Functional Analysis

> **Document ID:** `AUDIT-STEPS-002`  
> **Status:** READ-ONLY COMPREHENSIVE STEP INVENTORY (PHASE 0)  
> **Repository:** `anant9934/aitathastu`  
> **Scope:** Welcome Screen + All 12 Student Steps + Alternate Faculty Step  
> **Source Grounding:** Direct source inspection of `components/onboarding/steps/*` and runtime verification via Playwright automation.  

---

## Complete Step Inventory Table

| # | Step Name | Screen ID | File Path | Shell Width | Key UI Pattern | Backend Contract |
|:---:|:---|:---:|:---|:---:|:---|:---|
| **0** | Welcome | `2` | `components/onboarding/steps/WelcomeStep.tsx` | `760px` | Centered Hero + Identity Card | `/api/onboarding-v2` |
| **1** | Role Selection | `3` | `components/onboarding/steps/RoleStep.tsx` | `760px` | 2-Card Selection Grid | `role` field commit |
| **2** | AI/ML Direction | `3.2` | `components/onboarding/steps/DirectionStep.tsx` | `760px` | 12-Card Taxonomy Grid | `targetRole`, `targetRoleId` |
| **3** | Learning Priorities | `3.5` | `components/onboarding/steps/PrioritiesStep.tsx` | `760px` | Ranked Selection Checklist | `priorities`, `primaryPriority` |
| **4** | CV Upload & Extraction | `5` | `components/onboarding/steps/CvStep.tsx` | `760px` | File Dropzone + Extraction Live Status | `/api/student/resume/upload` |
| **5** | Footprint Intelligence | `5.5` | `components/onboarding/steps/FootprintIntelligenceStep.tsx` | `760px` | 13-Platform Connected Grid | `/api/student/connections/*` |
| **6** | Academic Details | `4` | `components/onboarding/steps/DetailsStep.tsx` | `760px` | 2-Column Form Fields | `academic` record commit |
| **7** | Digital Profiles | `6` | `components/onboarding/steps/AccountsStep.tsx` | `760px` | Stacked URL Input Fields | `profiles` object commit |
| **8** | Import Progress | `7` | `components/onboarding/steps/ImportStep.tsx` | `760px` | Live Multi-Source Progress Bars | `/api/student/sync-status` |
| **9** | Profile Review | `8` | `components/onboarding/steps/ReviewStep.tsx` | `1120px` (wide) | Two-Column Sticky Navigation + Inline Editor | Multi-entity review commit |
| **10** | Skills & Evidence | `9` | `components/onboarding/steps/SkillsStep.tsx` | `760px` | Prerequisite Match + Evidence Badges | `skills` candidate commit |
| **11** | Project Confirmation | `10` | `components/onboarding/steps/ProjectsStep.tsx` | `760px` | Accordion List + Manual Add Modal | `projects` entry commit |
| **12** | Finish & Workspace | `11` | `components/onboarding/steps/FinishStep.tsx` | `760px` | Metric Counter Grid + Onboarding Complete | `/api/onboarding-v2/finish` |
| **Alt** | Faculty Account | `3.7` | `components/onboarding/steps/FacultyStep.tsx` | `760px` | Institutional Verification Form | Faculty account registration |

---

## Detailed Step-by-Step Analysis

---

### Step 0: Welcome Screen (Screen 2)
- **Component Path:** [components/onboarding/steps/WelcomeStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/WelcomeStep.tsx)
- **Visual Evidence:**
  - `welcome_desktop_1440_dark.png`
  - `welcome_desktop_1440_light.png`
  - `welcome_tablet_768_dark.png`
  - `welcome_mobile_390_dark.png`
  - `welcome_mobile_320_dark.png`
- **Purpose:** First touchpoint after signup or invite; introduces AI Tathastu and establishes user identity (name).
- **UI Elements:**
  - Platform brand mark with glowing subtle radial gradient.
  - Heading: *"Welcome to AI Tathastu"*.
  - Subtitle: *"An evidence-driven learning and career platform for AI/ML."*
  - Name input field (`data-eora-id="eora-name-input"`).
  - Primary button: *"Get started"* with arrow icon.
  - Three platform feature highlights (Proof over claims, Intelligent AI roadmap, Verified portfolio).
- **Layout Critique & Whitespace Problems:**
  - Hardcoded to `max-w-[760px]` inside `OnboardingShell.tsx`.
  - On a 1440px or 1920px screen, the single name input sits inside an excessively narrow column, leaving 580px of unused black canvas on each side.
  - Feature highlights wrap awkwardly into 3 tiny boxes below the fold instead of taking advantage of a wide 3-column desktop layout.
- **State & Backend Dependencies:** Reads `draft.name`; writes `name` via optimistic draft update.
- **Future Redesign Opportunity:**
  - Create a cinematic two-column split layout on desktop ($\ge 1024\text{px}$): Left column features interactive product value props and an animated EORA introduction; Right column holds the identity input and action button.

---

### Step 1: Your Role (Screen 3)
- **Component Path:** [components/onboarding/steps/RoleStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/RoleStep.tsx)
- **Visual Evidence:** `step_01_role_desktop_1440_dark.png`, `step_01_role_mobile_390_dark.png`
- **Purpose:** Directs users into either the primary student/learner path or the faculty verification path.
- **UI Elements:**
  - 2 selection cards:
    - **Student / Learner:** *"Build evidence, verify skills, and prepare for AI/ML roles."* (Selected by default)
    - **Faculty / Mentor:** *"Mentor students, verify projects, and evaluate cohort readiness."* (Disabled in current catalog: `available: false`, displays *"Coming soon"* tag).
  - Step footer: *"Continue"* button (`btn-primary`).
- **Layout Critique:**
  - With only 2 cards, constraining to 760px creates a tall, sparse vertical stack with over 60% empty side margins on desktop.
- **State Dependencies:** Reads `data.role`; commits `role: "student"` (or `"faculty"`) to draft.
- **Future Redesign Opportunity:**
  - Render as large, expressive horizontal comparison cards with icon illustrations and clear bullet points showing what features unlock for each persona.

---

### Step 2: AI/ML Direction (Screen 3.2)
- **Component Path:** [components/onboarding/steps/DirectionStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/DirectionStep.tsx)
- **Visual Evidence:** `step_02_direction_desktop_1440_dark.png`, `step_02_direction_tablet_768_dark.png`, `step_02_direction_mobile_390_dark.png`
- **Purpose:** Allows user to select their target AI/ML specialization from the 12-role catalog defined in `lib/domain/aiml-role-taxonomy.ts`.
- **UI Elements:**
  - Role catalog includes: *Machine Learning Engineer, Deep Learning Engineer, Computer Vision Engineer, NLP Engineer, MLOps Engineer, Data Scientist, Generative AI Engineer, AI Research Scientist, AI Product Manager, Robotics AI Engineer, AI Ethics Specialist, AI Infrastructure Engineer*.
  - Each card displays role title, brief description, core prerequisites count, and demand badge.
- **Layout Critique & Whitespace Problems:**
  - **Severe desktop squashing:** In a 760px shell, 12 cards are jammed into a tight 2-column grid (`grid-cols-1 sm:grid-cols-2 gap-3`).
  - Vertical page height balloons to **2,450px ($2.7\times$ the viewport height)**, forcing the user to scroll through pages of cards while 680px of horizontal desktop width is completely wasted!
- **State Dependencies:** Commits `targetRole` (title string) and `targetRoleId` (slug).
- **Future Redesign Opportunity:**
  - Allow the shell to expand to `1240px` on desktop. Render a rich 3-to-4 column responsive grid with role categorization tabs (*Core Engineering, Specialized AI, Research & Infrastructure*).

---

### Step 3: Priorities (Screen 3.5)
- **Component Path:** [components/onboarding/steps/PrioritiesStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/PrioritiesStep.tsx)
- **Visual Evidence:** `step_03_priorities_desktop_1440_dark.png`, `step_03_priorities_mobile_390_dark.png`
- **Purpose:** Solicits user's immediate learning priorities (e.g. *Hands-on projects, Portfolio verification, Interview prep, Fundamentals*).
- **UI Elements:**
  - Vertical list of selectable priority options with rank numbering (1st, 2nd, 3rd priority).
  - Selected pills reorder dynamically.
- **Layout Critique:**
  - Rendered as narrow vertical list items in 760px.
- **State Dependencies:** Commits `priorities: string[]` and `primaryPriority: string`.
- **Future Redesign Opportunity:**
  - Interactive chip-grid or drag-and-drop priority ranker with clear visual feedback.

---

### Step 4: CV Upload & Extraction (Screen 5)
- **Component Path:** [components/onboarding/steps/CvStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/CvStep.tsx)
- **Visual Evidence:** `step_04_cv_desktop_1440_dark.png`, `step_04_cv_mobile_390_dark.png`
- **Purpose:** Collects resume/CV PDF to kick off automated profile extraction.
- **UI Elements:**
  - Dropzone area with dashed border, upload icon, file format restrictions (PDF, DOCX up to 10MB).
  - Mandatory consent checkbox for AI extraction processing.
  - Skip button: *"I'll fill this manually"* (bypasses to Step 6 `DetailsStep`).
- **Layout Critique:**
  - Centered box with massive unused margins.
- **State Dependencies:** Uploads via `POST /api/student/resume/upload`; poll status via `GET /api/student/resume/status`.
- **Future Redesign Opportunity:**
  - Two-column desktop layout: Left column contains the drag-and-drop dropzone; Right column previews live extraction benefits, parsing accuracy indicators, and privacy guarantees.

---

### Step 5: Digital Footprint Intelligence (Screen 5.5)
- **Component Path:** [components/onboarding/steps/FootprintIntelligenceStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/FootprintIntelligenceStep.tsx)
- **Visual Evidence:**
  - `step_05_footprint_desktop_1440_dark.png`
  - `step_05_footprint_desktop_1920_dark.png`
  - `step_05_footprint_desktop_2560_dark.png`
  - `step_05_footprint_tablet_768_dark.png`
  - `step_05_footprint_mobile_390_dark.png`
- **Purpose:** Connects student's external engineering footprints across 13 verified developer and research platforms.
- **UI Elements:**
  - 13 platform cards:
    - **Code & Repositories:** GitHub, GitLab, Hugging Face
    - **Competitive & Practice:** LeetCode, HackerRank, Codeforces, Kaggle
    - **Research & Writing:** Google Scholar, Semantic Scholar, ArXiv, Medium/Substack
    - **Professional:** LinkedIn, Personal Portfolio / Website
  - Each card contains: Platform brand icon, name, status badge (*Connected, Verified, Discovered, Idle*), inline handle/URL input, and connect button.
- **Layout Critique & Whitespace Problems:**
  - **Most severely damaged screen by the 760px container:** 13 rich interactive connector cards are squeezed into a narrow 2-column grid (`grid-cols-1 sm:grid-cols-2`).
  - Card widths are constrained to ~340px each, causing username inputs and URL strings to truncate.
  - Page scroll ratio reaches **$2.4\times$ to $3.5\times$** on desktop while 60% of horizontal space sits empty!
- **State Dependencies:** Connects to `/api/student/connections/*` and updates `profiles` in draft.
- **Future Redesign Opportunity:**
  - Expand to `1240px` or full fluid container on desktop.
  - Layout as a categorized 3-column (or 4-column at 1920px) platform grid grouped by *Code & Open Source*, *Problem Solving & Contests*, and *Research & Writing*.

---

### Step 6: Academic Details (Screen 4)
- **Component Path:** [components/onboarding/steps/DetailsStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/DetailsStep.tsx)
- **Visual Evidence:** `step_06_details_desktop_1440_dark.png`, `step_06_details_mobile_390_dark.png`
- **Purpose:** Captures degree, institution, department, year of study, and graduation year.
- **UI Elements:**
  - Degree field, Institution autocomplete, Specialization, Current Year, Expected Graduation.
  - If unauthenticated: Email and password fields for account creation.
- **Layout Critique:**
  - Two-column form layout fits decently inside 760px, but looks isolated on large desktop monitors.
- **State Dependencies:** Commits `academic` object; sets authentication state if registering.

---

### Step 7: Accounts Step (Screen 6)
- **Component Path:** [components/onboarding/steps/AccountsStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/AccountsStep.tsx)
- **Visual Evidence:** `step_07_accounts_desktop_1440_dark.png`, `step_07_accounts_mobile_390_dark.png`
- **Purpose:** Fallback URL entry for primary profiles (GitHub, LinkedIn, Portfolio).
- **Layout Critique:**
  - Vertical list of text fields with platform prefix icons.
- **Future Redesign Opportunity:**
  - Can be harmonized or consolidated with the unified Step 5 Footprint Intelligence system to avoid duplicate account entry workflows.

---

### Step 8: Live Import Progress (Screen 7)
- **Component Path:** [components/onboarding/steps/ImportStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/ImportStep.tsx)
- **Visual Evidence:** `step_08_import_desktop_1440_dark.png`, `step_08_import_mobile_390_dark.png`
- **Purpose:** Displays live synchronization status for connected accounts (CV parsing, GitHub repo ingestion, etc.) before the user reviews findings.
- **UI Elements:**
  - `SourceProgress` component (`variant="full"`).
  - Status chips (*Queued, Running, Succeeded, Needs Code*).
  - Animated pulsing progress segments.
- **Functional Architecture Insight:**
  - Auto-advances via `onReadyToReview` callback when primary sources (CV and GitHub) have settled.
- **Layout Critique:**
  - Clean card container, but appears small and lost in the center of wide desktop screens.

---

### Step 9: Profile Review (Screen 8)
- **Component Path:** [components/onboarding/steps/ReviewStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/ReviewStep.tsx)
- **Visual Evidence:** `step_09_review_desktop_1440_dark.png`, `step_09_review_mobile_390_dark.png`
- **Purpose:** Core confirmation screen where users review all parsed education, work experience, projects, achievements, and skills before workspace creation.
- **UI Elements:**
  - Sticky vertical navigation sidebar on desktop (`lg:block`, width `w-48`), switching to horizontal tabs on mobile/tablet.
  - Section tabs: *Personal, Education, Experience, Skills, Projects, Achievements, Links*.
  - Source filter badge bar (*All, CV, GitHub, LinkedIn, Manual*).
  - Inline editable fields with "Accept All" and "Reject" source controls.
- **Shell Width:** **The ONLY step configured with `width="wide"` (`max-w-[1120px]`).**
- **Layout Critique:**
  - Demonstrates how much better the platform looks with wider containers.
  - However, on tablet ($\le 1023\text{px}$), the desktop sidebar abruptly hides, replacing it with cramped tabs.
- **State Dependencies:** Reads and mutates draft education, experiences, projects, achievements.

---

### Step 10: Skills & Evidence (Screen 9)
- **Component Path:** [components/onboarding/steps/SkillsStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/SkillsStep.tsx)
- **Visual Evidence:** `step_10_skills_desktop_1440_dark.png`, `step_10_skills_mobile_390_dark.png`
- **Purpose:** Correlates student skills against the target role prerequisites and renders the AI Tathastu Evidence Strip.
- **UI Elements:**
  - Target role prerequisite bar (*e.g. 5 of 8 core prerequisites in your skills*).
  - Evidence badges: *Corroborated (2+ sources), Evidenced (1 source), Gap (User's word only)*.
  - Expandable skill evidence drawers showing which repo or CV bullet proved each skill.
- **Layout Critique:**
  - Squeezed into 760px shell. Skills map and prerequisite badges wrap excessively.
- **Future Redesign Opportunity:**
  - Two-column wide layout: Left column displays the interactive role prerequisite radar/gap map; Right column displays the evidence verification breakdown.

---

### Step 11: Projects Step (Screen 10)
- **Component Path:** [components/onboarding/steps/ProjectsStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/ProjectsStep.tsx)
- **Visual Evidence:** `step_11_projects_desktop_1440_dark.png`, `step_11_projects_mobile_390_dark.png`
- **Purpose:** Users confirm imported GitHub repos or add manual engineering projects, specifying their personal contribution.
- **UI Elements:**
  - Candidate project list with source tags and star/fork counts.
  - Personal contribution checklist (*"What did you personally do?"*).
  - "Add a project" inline form dialog.
- **Layout Critique:**
  - Squeezed into 760px.
- **State Dependencies:** Mutates `data.projects`.

---

### Step 12: Finish Step (Screen 11)
- **Component Path:** [components/onboarding/steps/FinishStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/FinishStep.tsx)
- **Visual Evidence:** `step_12_finish_desktop_1440_dark.png`, `step_12_finish_mobile_390_dark.png`
- **Purpose:** Final summary of verified profile entities before launching the student's active workspace.
- **UI Elements:**
  - 6 metric stat cards (*Skills, Projects, Education, Experience, Achievements, Linked accounts*).
  - Primary button: *"Build my workspace"* (`onFinish`).
- **Layout Critique:**
  - High-impact milestone screen rendered in a modest 760px box.
- **Future Redesign Opportunity:**
  - A celebratory, full-width dashboard preview showing the initial roadmap unlocked based on the user's role and evidence.

---

### Alternate Step: Faculty Account Setup (Screen 3.7)
- **Component Path:** [components/onboarding/steps/FacultyStep.tsx](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/FacultyStep.tsx)
- **Visual Evidence:** `step_faculty_desktop_1440_dark.png`, `step_faculty_mobile_390_dark.png`
- **Purpose:** Captures institutional faculty credentials (institution, department, academic email, password) for administrative verification.
- **UI Elements:**
  - Institutional details form with validation banner.
  - Primary button: *"Create faculty account"*.
