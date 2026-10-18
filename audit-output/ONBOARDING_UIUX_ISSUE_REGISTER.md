# AI Tathastu — Phase 0 UI/UX Defect & Issue Register

> **Document ID:** `AUDIT-ISSUES-006`  
> **Status:** READ-ONLY DEFECT REGISTER (PHASE 0)  
> **Repository:** `anant9934/aitathastu`  
> **Total Logged Defects:** 22 Formally Verified Defects  
> **Severity Hierarchy:**  
> - **P0 — Critical:** 0 (No blocker crashes or unrecoverable data loss in onboarding)  
> - **P1 — High:** 6 (Severe desktop whitespace wastage, EORA fold blockage, mobile scroll traps, review breakpoint cliff)  
> - **P2 — Medium:** 11 (Contrast failures, missing card focus rings, unsemantic radiogroups, tall scroll stacks)  
> - **P3 — Low:** 5 (Micro-alignment, chip padding, cosmetic token harmonization)  

---

## Complete Defect Inventory

| Defect ID | Severity | Category | Affected Step(s) | Viewports Affected | Short Description | Source File |
|:---|:---:|:---|:---|:---|:---|:---|
| `ONB-P1-01` | **P1** | Layout Architecture | Steps 0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12 | $\ge 1280\text{px}$ (Desktops/Laptops) | Static `760px` shell clamps desktop layout, causing 40%–70% blank whitespace | `OnboardingShell.tsx:97` |
| `ONB-P1-02` | **P1** | Grid Architecture | Step 5 (Footprint Grid) | $\ge 1024\text{px}$ (Tablets/Desktops) | 13 connector cards squeezed into 2 columns inside 760px; truncates URLs and handles | `FootprintIntelligenceStep.tsx:160` |
| `ONB-P1-03` | **P1** | Grid Architecture | Step 2 (Direction Catalog) | $\ge 1280\text{px}$ (Desktops) | 12 role cards locked to 2 columns, creating 2,450px vertical scroll stack | `DirectionStep.tsx:75` |
| `ONB-P1-04` | **P1** | EORA Architecture | Steps 1 through 12 | $\ge 1280\text{px}$ (Desktops) | EORA consumes vertical fold space inline instead of docking in unused side margins | `OnboardingShell.tsx:120`, `EoraGuideLine.tsx` |
| `ONB-P1-05` | **P1** | Mobile Ergonomics | Steps 2, 5, 9, 10 | $\le 430\text{px}$ (Smartphones) | StepFooter action button is not sticky; requires 3.8× screen scrolls to continue | `OnboardingShell.tsx:145` |
| `ONB-P1-06` | **P1** | Responsive Cliff | Step 9 (Review Step) | $768\text{px} - 1023\text{px}$ (Tablets) | Abrupt sidebar removal on `< lg` creates cramped multi-line horizontal tablist | `ReviewStep.tsx:186` |
| `ONB-P2-01` | **P2** | Accessibility | All Steps | All Viewports | Muted text token (`#737373`) fails WCAG AA 4.5:1 contrast on dark background (4.08:1) | `app/globals.css:12` |
| `ONB-P2-02` | **P2** | Accessibility | All Steps | All Viewports (Light Mode) | Secondary text token (`#8e8e93`) fails WCAG AA on light mode background (3.85:1) | `app/globals.css:48` |
| `ONB-P2-03` | **P2** | Accessibility | Step 1, Step 2 | All Viewports | Selection cards lack explicit WAI-ARIA `role="radio"` and `aria-checked` states | `RoleStep.tsx:28`, `DirectionStep.tsx:82` |
| `ONB-P2-04` | **P2** | Accessibility | Shell | All Viewports | Missing `<a href="#main">Skip to content</a>` link for keyboard navigation | `OnboardingShell.tsx:50` |
| `ONB-P2-05` | **P2** | Information Arch | Shell Header | All Viewports | Stepper displays 12 anonymous bullet pips without stage grouping or time estimates | `OnboardingShell.tsx:65` |
| `ONB-P2-06` | **P2** | Layout Density | Step 4 (CV Step) | $\ge 1280\text{px}$ (Desktops) | Dropzone container occupies tiny central box with vast empty margins | `CvStep.tsx:88` |
| `ONB-P2-07` | **P2** | Ergonomics | Mobile Landscape | $844 \times 390\text{px}$ | Extreme height compression causes 5.55× vertical scroll ratio | `OnboardingShell.tsx:97` |
| `ONB-P2-08` | **P2** | Accessibility | Step 10 (Skills Step) | All Viewports | "Gap" evidence chip text contrast fails WCAG AA (3.61:1) | `components/ui/StatusChip.tsx:42` |
| `ONB-P2-09` | **P2** | Form Usability | Step 6 (Details Step) | $\ge 1440\text{px}$ (Desktops) | Academic form fields span 760px with excessive horizontal field widths | `DetailsStep.tsx:95` |
| `ONB-P2-10` | **P2** | Visual Design | Step 5 (Footprint Grid) | $390\text{px} - 640\text{px}$ | Inconsistent card heights when platform handle or status badge is rendered | `FootprintIntelligenceStep.tsx:180` |
| `ONB-P2-11` | **P2** | Focus States | Step 1, Step 2, Step 5 | All Viewports (Light Mode) | 2px amber border outline has poor visual contrast against white backgrounds | `app/globals.css:98` |
| `ONB-P3-01` | **P3** | Visual Polish | Step 0 (Welcome) | $\ge 1440\text{px}$ | Value proposition boxes wrap into 3 narrow vertical cards instead of wide cards | `WelcomeStep.tsx:60` |
| `ONB-P3-02` | **P3** | Touch Targets | Step 9, Step 11 | $\le 430\text{px}$ (Smartphones) | Tag deletion buttons measure 24px, below recommended 44px touch target guidelines | `components/ui/StatusChip.tsx:85` |
| `ONB-P3-03` | **P3** | Typography | Step 12 (Finish Step) | All Viewports | Summary stat units have minor baseline misalignment with numeric figures | `FinishStep.tsx:48` |
| `ONB-P3-04` | **P3** | State Feedback | Step 8 (Import Step) | All Viewports | When all sources settle instantly, Step 8 auto-advances in ~100ms, startling users | `ImportStep.tsx:24` |
| `ONB-P3-05` | **P3** | Micro-interaction | Step 3 (Priorities) | All Viewports | Ranked numbers do not animate smoothly during drag or re-ordering | `PrioritiesStep.tsx:45` |

---

## Detailed Root Cause Analysis for Top Critical Findings

### Issue `ONB-P1-01`: Hard-Capped Static `760px` Container
- **Category:** Layout Architecture & Responsiveness
- **Severity:** **P1 (High)**
- **Confidence Level:** 100% (Direct code verification + DOM measurements)
- **Root Cause Source:** [components/onboarding/OnboardingShell.tsx:97](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/OnboardingShell.tsx#L97)
  ```tsx
  <div className={cn("mx-auto flex w-full flex-1 flex-col px-4 pt-5 sm:px-6 sm:pt-8", width === "wide" ? "max-w-[1120px]" : "max-w-[760px]")}>
  ```
- **Quantitative Evidence:**
  - 1440px desktop: 760px container, 340px empty left margin, 340px empty right margin (**52.8% utilization**).
  - 1920px Full HD: 760px container, 580px empty margins on both sides (**39.6% utilization**).
  - 2560px QHD: 760px container, 900px empty margins on both sides (**29.7% utilization**).
- **Functional Risk of Future Remediation:** **VERY LOW.** Modifying the container max-width classes in `OnboardingShell.tsx` or passing an adaptive width variant does not alter form submissions, data serialization, or draft schemas.

---

### Issue `ONB-P1-02`: Footprint Intelligence Grid Compression
- **Category:** Grid Architecture & Information Ergonomics
- **Severity:** **P1 (High)**
- **Confidence Level:** 100%
- **Root Cause Source:** [components/onboarding/steps/FootprintIntelligenceStep.tsx:160](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/steps/FootprintIntelligenceStep.tsx#L160)
  ```tsx
  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
  ```
- **Empirical Evidence:** In a 760px container, 13 cards are arranged in 2 columns. Card width is only ~340px. On desktop, user profiles (e.g. `https://scholar.google.com/citations?user=...` or `https://huggingface.co/username`) wrap onto multiple lines or truncate with ellipses.
- **Remediation Strategy:** Upgrade grid definition to:
  ```tsx
  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  ```
  when inside an expanded shell container.

---

### Issue `ONB-P1-04`: Inline EORA Vertical Fold Displacement
- **Category:** Assistant Architecture & Space Utilization
- **Severity:** **P1 (High)**
- **Confidence Level:** 100%
- **Root Cause Source:** [components/onboarding/OnboardingShell.tsx:120](file:///Users/quantum/Downloads/aitathastu-main/components/onboarding/OnboardingShell.tsx#L120)
  ```tsx
  <header className="mb-6">
    <h1 className="font-display text-2xl font-semibold tracking-tight text-warm-ivory sm:text-3xl">{title}</h1>
    {description && <p className="mt-2 text-sm text-text-muted">{description}</p>}
    {guide && <div className="mt-4">{guide}</div>}
  </header>
  ```
- **Empirical Evidence:** EORA guidance adds between 65px and 110px of vertical space directly beneath the step title. On standard laptop screens (800px–900px height), this pushes interactive cards and buttons below the fold, while 500px+ of horizontal space remains unused on the side margins.
- **Remediation Strategy:** On viewports $\ge 1280\text{px}$, extract `guide` into a responsive `<aside>` sidebar column docked to the right of the main content area.
