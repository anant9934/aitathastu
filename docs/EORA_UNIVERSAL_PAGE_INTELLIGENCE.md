# AI Tathastu — EORA Alive Phase 7
# Universal Page Intelligence (UPI) Architecture Specification

**System**: EORA Universal Page Intelligence (UPI)  
**Version**: 7.0.0  
**Status**: Certified Implementation Architecture  
**Character Lock**: Original EORA (`v1.0.0`, sky-blue hoodie, round black glasses, dark hair, brown eyes)  
**Policy**: Zero Routine LLM Invocations (Deterministic Contract-Grounded Runtime)  

---

## 1. Architectural Blueprint & Core Philosophy

The goal of **EORA Universal Page Intelligence (UPI)** is to transform EORA from a localized onboarding guide into a universal, deeply context-aware, interactive companion across the entire AI Tathastu platform.

EORA does not repeat generic navigation labels or invent non-existent features. She understands:
1. **The Purpose**: Why does this page exist? What is the user's primary outcome?
2. **The Structure**: What sections, metrics, filters, and actions are currently visible?
3. **The State**: Is the user on their first visit, returning, looking at an empty slate, or recovering from a validation failure?
4. **The Authenticated Context**: What is the student's active career goal, demonstrated evidence, and priority?
5. **The Boundaries**: EORA never reads passwords, OTPs, or API keys, and never executes destructive actions automatically.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EORA Universal Page Intelligence                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────┐          ┌───────────────────┐       ┌──────────────────┐
│ Route Engine │          │   Page Registry   │       │   State Engine   │
│ - Exact URL  │ ◄──────► │ - Typed Contracts │ ◄───► │ - First Visit    │
│ - Dynamic ID │          │ - Key Sections    │       │ - Empty State    │
│ - Safe Gate  │          │ - Guided Tours    │       │ - Validation Err │
└──────────────┘          └─────────┬─────────┘       └──────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │       Safe Action & Intent Bus       │
                 │ - Explain Page   - Guided Tour       │
                 │ - Form Stepper   - Next Best Action  │
                 │ - Safe Navigate  - Error Recovery    │
                 │ - Language Switch- Zero Routine LLM  │
                 └──────────────────────────────────────┘
```

---

## 2. Centralized Typed Page Knowledge Registry

The single source of truth for page intelligence is [`lib/eora/page-registry.ts`](file:///Users/quantumanant/aitathastu/lib/eora/page-registry.ts).

### 2.1 The Page Contract Schema (`EoraPageContract`)

```typescript
export interface EoraPageContract {
  pageId: string;
  routePattern: RegExp;
  routePath: string;
  pageTitle: string;
  pagePurpose: string;
  mainUserGoals: string[];
  availableFunctions: string[];
  keySections: Array<{
    sectionId: string;
    label: string;
    description: string;
    targetId: string;
  }>;
  importantButtons: Array<{
    buttonId: string;
    label: string;
    action: string;
  }>;
  importantFormFields: Array<{
    fieldId: string;
    label: string;
    type: string;
    required: boolean;
    purpose: string;
  }>;
  validationRules: Array<{
    fieldId: string;
    rule: string;
    friendlyMessage: string;
  }>;
  commonQuestions: Array<{
    q: string;
    a: string;
    hinglish: string;
  }>;
  guidedTour: TourDefinition;
  dataDependencies: string[];
  relevantPermissions: string[];
  potentialErrors: Array<{
    errorId: string;
    trigger: string;
    recovery: string;
  }>;
  suggestedNextActions: Array<{
    id: string;
    label: string;
    description: string;
    actionType?: string;
    route?: string;
  }>;
  allowedNudges: string[];
  emptyStateGuidance?: {
    title: string;
    description: string;
    recommendedAction: string;
    actionRoute?: string;
  };
  completionConditions: string[];
}
```

### 2.2 Route Resolution & Generic Fallback Safety

Route resolution utilizes `getPageContract(routeOrId: string)`.
- If an exact `pageId` matches (e.g. `student-projects`), it returns that contract.
- If a route pathname is passed (e.g. `/student/projects/proj_981`), it executes regex pattern matching against `routePattern`.
- If an unmapped or future route is queried, it returns `getSafeGenericPageContract(pathname)`:
  - Generates a grounded, dignified explanation without hallucinating tours.
  - Prevents runtime null pointer crashes.
  - Logs a development-time notice to register the missing contract.

---

## 3. Page State Awareness Engine

EORA dynamically assesses UI and context state before generating dialogue:

1. **First Visit**:
   - Offers optional gentle welcome hint.
   - Suggests the page tour without interrupting focused work.
2. **Returning Visit**:
   - Suppresses redundant introductory dialogue.
   - Points directly to active progress or recent changes.
3. **Empty State**:
   - Detected via empty arrays in authenticated data (`projects.length === 0`, `skills.length === 0`).
   - Speaks honestly about empty state: never congratulates on non-existent projects or implies completed work.
   - Recommends the specific step required to populate the page (e.g. "Connect GitHub" or "Add Project").
4. **Loading / Processing**:
   - Acknowledges background operations (e.g. resume extraction or GitHub synchronization).
   - Suppresses proactive nudges to prevent race conditions.
5. **Validation Error / Problem Rescue**:
   - Tracks repeated failed submissions.
   - Steps in with non-shaming, concrete step-by-step guidance on the specific field causing validation failure.
6. **Permission Denied / Restricted**:
   - Distinguishes unauthorized verifier views from student views.
   - Offers dignified redirection without exposing sensitive administrative details.
7. **Offline / Unresponsive**:
   - Detects API disconnections and offers non-technical recovery options.

---

## 4. Universal Assistance Capabilities

### A. Explain This Page
When the user asks *"What is this page?"* or clicks EORA's page explanation card:
- Clarifies the primary purpose of the current screen.
- Explains what data is presented (e.g., verified evidence vs self-reported).
- Identifies where the user should begin.

### B. Show Me Around (Guided Tours)
- Executes structured tours with real DOM highlighting (`data-eora-spotlight="true"`).
- Highlights buttons, form inputs, and metric cards.
- Provides Next, Back, Exit, and Pause controls with full keyboard accessibility (`Escape` to close).

### C. What Should I Do Next?
- Evaluates the authenticated student profile and active career goal.
- Pulls from the authoritative `primaryActions` generated by Tathastu's deterministic roadmap engine.
- Recommends the single highest-leverage grounded action.

### D. Help Me Complete This (Form Stepper)
- Activates focused step-by-step assistance for complex forms (such as Add Project, Academic Details, Resume Review).
- Only walks through form fields that physically exist in the UI.
- Never asks for or reads sensitive authentication secrets.

### E. Why Am I Seeing This?
- Explains metric scores, recommendations, and evidence badges using Core provenance.
- Explains why a repository was categorized under a specific AI/ML domain.

### F. Find Something For Me (Safe Navigation)
- Maps natural language intent (e.g., *"Take me to my projects"*, *"Where is my roadmap?"*) to authorized internal routes.
- Whitelist enforced: external URLs and sensitive administrative routes are strictly rejected.

### G. Something Went Wrong (Error Recovery)
- Explains application errors with empathy and clear recovery steps (e.g., file size limits, session expiration).

### H. Repeat or Simplify (Linguistic Accessibility)
- Explains steps in simple, jargon-free English upon request.
- Switches seamlessly to the approved Hinglish dialogue catalogue without requiring general-purpose LLM translation calls.

---

## 5. Safe Action Engine (`lib/eora/actions.ts`)

EORA actions operate over a strict whitelist with security barriers:

```typescript
export const SAFE_ACTION_WHITELIST = [
  "HIGHLIGHT_ELEMENT",
  "SCROLL_TO_SECTION",
  "FOCUS_FIELD",
  "OPEN_DIALOG",
  "NAVIGATE_ROUTE",
  "START_PAGE_TOUR",
  "STOP_PAGE_TOUR",
  "NEXT_TOUR_STEP",
  "PREV_TOUR_STEP",
  "SHOW_CONTEXTUAL_EXPLANATION",
  "SWITCH_LANGUAGE",
  "SET_ASSISTANCE_MODE",
  "DISMISS_MESSAGE",
  "RECOVER_ERROR",
] as const;
```

### 5.1 Sensitive Field Barrier
Field focus and interaction check for sensitive credential substrings:
- `password`, `passphrase`
- `otp`, `2fa`, `mfa`
- `pin`, `security_code`
- `secret`, `token`, `key`

Attempting to target any element matching these patterns immediately fails validation with:
`"Focusing sensitive credential or security fields is strictly prohibited."`

### 5.2 Navigation Route Whitelist
Only routes registered in the official 16-route inventory can be navigated. External URLs, `javascript:` pseudoprotocols, and unauthorized administrative endpoints are blocked before execution.

---

## 6. Zero Routine LLM Policy

All routine operations:
- Page understanding and explanations
- Guided tour step progression
- Intent detection and disambiguation
- English and Hinglish dialogue selection
- Form stepper guidance
- Navigation and DOM highlighting
- Error recovery guidance

...are executed **100% deterministically on the client/Edge runtime with 0 external LLM requests**. External LLMs are reserved strictly for deep semantic analysis (such as unstructured research paper evaluation), protected behind explicit security gates, budget caps, and rate limits.
