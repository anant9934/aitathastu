# AI Tathastu — Exact 10-Screen Reference Specification

## Visual Source of Truth
This specification documents the exact visual geometry, component hierarchy, design tokens, and functional mappings extracted from the 10-screen reference collage.

---

## Global Design Tokens

| Token | Specification Value | Usage Context |
| :--- | :--- | :--- |
| **Font Family** | Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif | Unified across all 10 views |
| **Primary Gradient** | `linear-gradient(135deg, #00C2FF 0%, #7B2CBF 50%, #B026FF 100%)` | Landing CTA & Primary buttons |
| **Purple Solid / Tint** | `#5642EF`, `#6340EE`, tint `#F4F1FF`, hover `#4532D9` | Selection states, active dots, icons |
| **Dark Theme BG** | `#010415` (Landing), `#060B1E` / `#0A0F24` (AI Analysis) | Deep cinematic navy |
| **Light Theme BG** | `#F8F9FD` / `#FFFFFF` | Onboarding views 2–6, 8–10 |
| **Card Radii** | `16px` (Forms/Upload), `14px` (Roles/Integrations), `20px` (Containers), `9999px` (Pills) | Rounded geometry |
| **Card Borders** | `1px solid #E5E7EB` (unselected), `1.5px solid #5642EF` (selected) | High contrast, subtle stroke |
| **Box Shadows** | `0 4px 20px -2px rgba(86, 66, 239, 0.08)`, `0 10px 30px rgba(0,0,0,0.06)` | Soft ambient elevation |

---

## Screen-by-Screen Visual Architecture

### Screen 1: Landing Page (`/`)
- **Background**: `#010415` with subtle cyan/purple ambient radial glows (`radial-gradient(circle at 72% 48%, rgba(0,229,255,0.16), ...)`).
- **Header**:
  - Height: `72px`, max-width: `1440px`, padding: `20px 48px`.
  - Left: AITathastu loop logo (`36x36px`) + text `AITathastu` (bold 22px).
  - Center: Horizontal nav (`Products`, `For Students`, `For Faculty`, `For Professionals`, `Resources →`), font-size: `14px`, font-weight: `500`, color: `#CBD5E1`.
  - Right: `Login` (pill, outlined `#FFFFFF30`, `14px`) + `Get Started` (cyan-purple gradient pill, `14px`, bold).
- **Hero Left Column**:
  - Headline: 3 distinct lines:
    ```
    Your Dreams.
    Our Intelligence.
    Tathastu.
    ```
    Font size: `clamp(44px, 5vw, 68px)`, font-weight: `800`, line-height: `1.08`. First two lines `#FFFFFF`, "Tathastu." in `#00F0FF` with glowing drop shadow.
  - Subtitle: `18px`, color: `#94A3B8`, max-width: `560px`.
  - Buttons: `Get Started →` (`48px` height, gradient pill) + `▶ Watch Video` (`48px` height, dark border pill).
  - 4 Summary Cards:
    - 4 columns, card height: `76px`, border-radius: `14px`, background: `rgba(255,255,255,0.03)` with `1px solid rgba(0,240,255,0.15)`.
    - Items: `Learners 50K+` (User), `Mentors 5K+` (Users), `Opportunities 10K+` (Briefcase), `Projects 25K+` (Award).
- **Hero Right Column**:
  - Avatar: New EORA `welcome-hand.png` in inviting pose, transparent background, natural proportion (~`520px` height).
  - Speech Bubble: Positioned top-right of avatar, dark frosted glass (`rgba(10,15,36,0.85)`), border `rgba(0,240,255,0.2)`:
    - Title: `Hi! I'm EORA` (bold 14px, white).
    - Subtitle: `Let's explore your possibilities together.` (13px, `#CBD5E1`).
  - Decorative background: Circular cyan/violet orbit tracks behind EORA.

---

### Screen 2: EORA Welcome (`/screens?screen=2`)
- **Background**: `#FFFFFF` / `#F8F9FD`.
- **Header**:
  - Left: `AITathastu` logo.
  - Right: `Skip` button (`14px`, text button `#64748B`).
- **Main Content**:
  - Two-column visual layout:
    - Left: EORA avatar `waving.png` (~`400px` height).
    - Right:
      - Speech bubble: `Hi there! 👋 / I'm EORA, your AI companion at AITathastu.` (rounded pill container).
      - Headline: `Let's get to know you.` (bold 28px, `#1E1B4B`).
      - Sub-heading: `What should I call you?` (15px, `#6B7280`).
      - Name Input: Full width pill (`52px` height, border `1.5px solid #818CF8`), integrated circular purple submit arrow inside input right side.
- **Footer**:
  - Centered 5 progress dots (`8px` diameter, active dot is elongated `#5642EF`).

---

### Screen 3: Choose Your Role (`/screens?screen=3`)
- **Header**:
  - Left: Back arrow circle (`36px`) + `AITathastu` logo.
  - Right: `Step 1 of 7` badge (`13px`, font-weight `600`, `#64748B`).
- **Headings**:
  - Title: `What best describes you?` (bold 26px, centered, `#1E1B4B`).
  - Subtitle: `This helps EORA personalize your experience.` (14px, `#6B7280`).
- **Role Selection Grid**:
  - Exactly 3 columns × 2 rows (6 cards total):
    1. `I'm a Student` (Graduation cap icon)
    2. `I'm Faculty` (User icon)
    3. `I'm a Professional` (Briefcase icon)
    4. `I'm a Mentor` (Users group icon)
    5. `I'm an Alumni` (Mortarboard / Scroll icon)
    6. `I'm an Organization` (Building icon)
  - Card Dimensions: `180px - 220px` width, `120px` height, border-radius `14px`.
  - Selected state: Lavender background `#F4F1FF`, violet outline `1.5px solid #5642EF`, violet icon.
  - Unselected state: White background `#FFFFFF`, border `1px solid #E5E7EB`.
- **Footer**:
  - Left: Circular back button `←` (`40px`, border `#E5E7EB`).
  - Center: 7 progress dots (Dot 1 active).
  - Right: `Next →` gradient pill button (`44px` height).

---

### Screen 4: Basic Academic Details (`/screens?screen=4`)
- **Header**: Back arrow + `AITathastu` logo (left), `Step 2 of 7` (right).
- **Heading**: `Tell us a bit about yourself` (centered, bold 26px).
- **Form Layout**:
  - 2 columns × 3 rows (6 fields):
    - Row 1: `Full Name` | `Email`
    - Row 2: `Mobile Number` | `Current Role` (select)
    - Row 3: `Department / Domain` | `Institution`
  - Input Height: `46px`, border-radius `10px`, border `1px solid #E5E7EB`.
  - Labels: `13px`, font-weight `600`, `#374151`, `margin-bottom: 6px`.
- **Footer**: Circular back button (left), 7 progress dots (center, Dot 2 active), `Next →` button (right).

---

### Screen 5: Resume / CV Upload (`/screens?screen=5`)
- **Header**: Back arrow + `AITathastu` logo (left), `Step 3 of 7` (right).
- **Heading**:
  - Title: `Upload your Resume or CV` (centered, bold 26px).
  - Subtitle: `EORA will extract your skills, experience, education and achievements.` (14px, `#6B7280`).
- **Upload Box**:
  - Large dashed container: `border: 2px dashed #818CF8`, border-radius `18px`, padding `48px 24px`, background `#FDFEFE`.
  - Central document icon in soft purple circle.
  - Text: `Drag & drop your file here` (bold 16px, `#1E1B4B`).
  - Subtext: `PDF, DOC, DOCX (Max 10 MB)` (13px, `#9CA3AF`).
  - Button: `Upload Resume` (`44px` height, purple gradient pill).
- **Skip Action**: `Skip for now →` (centered below card, `13px`, `#6B7280`).
- **Footer**: Circular back button (left), 7 progress dots (center, Dot 3 active), `Next →` button (right).

---

### Screen 6: Connect Your Digital Footprints (`/screens?screen=6`)
- **Header**: Back arrow + `AITathastu` logo (left), `Step 4 of 7` (right).
- **Heading**:
  - Title: `Connect your accounts` (centered, bold 26px).
  - Subtitle: `Bring your digital evidence. EORA will analyze and build your profile.` (14px, `#6B7280`).
- **Grid Layout**:
  - 3 columns, 8 service cards:
    - Row 1: `LinkedIn` | `GitHub` | `LeetCode`
    - Row 2: `HackerRank` | `HackerEarth` | `CodeChef`
    - Row 3: `Google Scholar` | `Portfolio / Website`
  - Card Design: White card, `border: 1px solid #E5E7EB`, border-radius `12px`, padding `14px 16px`.
  - Card Inner: Platform icon (left), Platform name (bold 14px), small `Connect` / `Connected` pill button (`28px` height, outlined).
- **Footer**: Circular back button (left), 7 progress dots (center, Dot 4 active), `Next →` button (right).

---

### Screen 7: AI Analysis (`/screens?screen=7`)
- **Theme**: Deep cinematic dark navy `#060B1E`.
- **Header**: `AITathastu` glowing logo (left).
- **Left Column**:
  - EORA avatar `holding-tablet.png` / `thinking.png` with transparent background.
  - Holographic floating blue/cyan cards (user profile card, skills grid, data metrics).
- **Right Column**:
  - Circular glowing progress spinner (top-right, cyan/purple gradient).
  - Title: `EORA is analyzing your information...` (bold 22px, white).
  - Checklist with green circular checks:
    - ✔ `Reading your resume`
    - ✔ `Scanning LinkedIn profile`
    - ✔ `Analyzing GitHub repositories`
    - ✔ `Extracting skills and technologies`
    - ✔ `Mapping your projects`
    - ✔ `Building your intelligence profile`
  - Bottom notification card:
    - Dark blue card with lightbulb icon: `This may take a few moments. I'll notify you once it's ready!`
- **Behavior**: Real task state progression; advances to review automatically upon completion.

---

### Screen 8: Profile Insights (`/screens?screen=8`)
- **Header**: Back arrow + `AITathastu` logo (left), `Step 5 of 7` (right).
- **Heading**:
  - Title: `Here's what I found, [Student Name]!` (centered, bold 26px).
  - Subtitle: `Review and confirm the information. You can edit anything.` (14px, `#6B7280`).
- **Two-Column Layout**:
  - Left navigation list (`200px` width):
    - `Personal Info` (active: lavender background `#EEF2FF`, violet text/icon)
    - `Education`
    - `Experience`
    - `Skills`
    - `Projects`
    - `Achievements`
  - Right summary card (`border: 1px solid #E5E7EB`, border-radius `16px`, padding `24px`):
    - Top row: Circular profile avatar/initials + Name + Role + Institution + Location + `Edit` button (top-right).
    - Skill Chips Grid:
      - `[AI/ML]`, `[Deep Learning]`, `[Predictive Analytics]`, `[LLMs]`, `[NLP]`, `[Computer Vision]`, `[Research]`, `[Academic Leadership]`
      - Light blue pills (`#EFF6FF`), text `#1D4ED8`, font-size `12px`.
- **Footer**: Circular back button (left), 7 progress dots (center, Dot 5 active), `Looks Good →` button (right).

---

### Screen 9: Skills Intelligence Map (`/screens?screen=9`)
- **Header**: `AITathastu` logo (left), Title: `Your AI-Inferred Skills` (centered/left).
- **Layout**:
  - Left / Center: Interactive Node Graph:
    - Central focus node: `AI/ML` (large glowing gradient blue circle, white text).
    - Surrounding connected nodes:
      - `Deep Learning` (purple circle)
      - `LLMs` (cyan circle)
      - `NLP` (light blue circle)
      - `Research` (emerald green circle)
      - `Python` (magenta circle)
      - `MLOps` (indigo circle)
      - `Data Analytics` (teal circle)
    - Connecting curved SVG lines with soft glow.
  - Right Panel (`320px` width): `Skill Details`:
    - Header: `Skill Details` + close icon.
    - Selected Title: `Machine Learning` (or clicked node).
    - Level & Confidence: `Expert • 92%` (with dual-tone progress bar).
    - Evidence list:
      - `CV (12 mentions)`
      - `5 GitHub repositories`
      - `3 research publications`
      - `Projects (4)`
      - `LinkedIn profile`
    - Related Technologies: `[scikit-learn]`, `[XGBoost]`, `[PyTorch]`, `[TensorFlow]`.
- **Interactivity**: Clicking any node switches details in real-time.

---

### Screen 10: Projects from GitHub (`/screens?screen=10`)
- **Header**:
  - Left: Back arrow + `AITathastu` logo.
  - Title: `Your Projects` + Subtitle: `Found [N] repositories • [M] major projects`.
  - Right: `View All` (link) + `+ Add Project` (purple gradient pill).
- **Projects Grid**:
  - 3 columns on desktop.
  - Card Structure:
    - Top: GitHub icon + Project title + `Public` / `Verified` badge.
    - Thumbnail: Project preview image / diagram.
    - Description: 2-line summary.
    - Technology tags: `[Python]`, `[Deep Learning]`, `[XGBoost]`.
    - Footer row: Stars ⭐, Forks ⑂, AI Impact / Status badge `AI Impact 94`.
- **Footer**: Circular back button, 7 progress dots (center, Dot 6 active), `Next →` / `Finish` button.

---

### Screen 11: Finalize Profile (`/screens?screen=11`)
- **Header**: Back arrow + `AITathastu` logo (left), `Step 6 of 7` (right).
- **Layout**:
  - Left: New EORA `celebrating.png` / `thumbs-up.png` pose with transparent background.
  - Right:
    - Headline: `Great! 🎉 / Your profile is almost ready.` (bold 28px).
    - Subtitle: `I've gathered and analyzed your information from [N] sources. Would you like to add or update anything before we create your dashboard?`
    - Buttons: `Add More Information` (outline) + `Create My Dashboard →` (gradient pill).
- **Footer**: Circular back button, 7 progress dots (center, Dot 7 active).

---

## 3. Responsive Breakpoints

| Breakpoint | Layout Adaptations |
| :--- | :--- |
| **>= 1440px** | Full fidelity matching reference collage exactly |
| **1024px – 1439px** | Content max-width constrained, 3 columns preserved where space permits |
| **768px – 1023px** | 2-column role & project grids, vertical stacking on hero and welcome |
| **< 768px (Mobile)** | 1-column cards, full-width inputs, touch targets >= 44px, no horizontal scroll |
