# EORA BEHAVIOR ENGINE — VERSION 1.0
## AI Tathastu Digital Companion — Behavior & Intelligence Architecture

**Status:** Production  
**Version:** 1.0.0  
**LLM Requirement for Routine Interactions:** ZERO

---

## 1. Architecture Overview

EORA's behavior engine is fully deterministic. It does NOT call any LLM for routine interactions. The LLM-backed `/api/eora/chat` endpoint remains available only for explicitly user-triggered advanced chat.

```
User Input
    │
    ▼
[Safety Engine] ──unsafe──► [Safe Refusal]
    │
    ▼
[Intent Recognition Engine]
    │
    ├── low confidence ──► [Clarifying Options]
    │
    ▼
[Decision Engine / Brain]
    │
    ├── intent-based ──► [Dialogue Templates] ──► [Message + Animation]
    │
    └── proactive ──► [Context Engine] ──► [Nudge Scheduler] ──► [Message]
```

---

## 2. Core Modules

### 2.1 Identity Registry (`lib/eora/identity.ts`)
- Character definition and version lock
- Pose-to-animation-state mapping
- `getPoseForState(state)` — maps animation state → approved asset pose

### 2.2 Personality Constitution (`lib/eora/personality.ts`)
- 12 immutable core traits
- 13 hard behavioral limits
- `isResponseWithinPersonalityBounds(text)` — checks output before delivery
- `getSafeFallbackResponse(context)` — safe fallback if bounds check fails

### 2.3 Context Engine (`lib/eora/context.ts`)
- Understands current route, onboarding step, field validation, student state
- `resolveRouteFromPathname(pathname)` — maps URL to semantic route
- `shouldEoraBeQuiet(context)` — returns true during assessments or typing
- `screenNumberToOnboardingStep(n)` — maps screen numbers to semantic steps

### 2.4 Intent Recognition (`lib/eora/intent.ts`)
- 20 recognized intent types
- English, Hindi, and Hinglish normalization
- `recognizeIntent(text)` — deterministic, no LLM
- `isIntentConfident(result)` — checks confidence ≥ 0.65 threshold
- `getClarifyingOptions()` — fallback options for uncertain input

### 2.5 Safety Boundaries (`lib/eora/safety.ts`)
- 8 violation categories with pattern matching
- `checkInputSafety(text)` — scans user input
- `checkOutputSafety(text)` — scans EORA output
- `isActionAuthorized(actionType)` — whitelist of allowed EORA actions

### 2.6 Dialogue Templates (`lib/eora/dialogue.ts`)
- Pre-approved message templates for all contexts
- `getOnboardingStepMessage(step)` — step-specific guidance
- `getIntentResponse(intent, context)` — intent-driven responses using real data
- `getTinyVictoryMessage(action)` — success celebrations
- `getFieldErrorMessage(field, error)` — field-specific help
- `getCelebrationMessage(name)` — onboarding completion

### 2.7 Decision Engine (`lib/eora/brain.ts`)
- `processUserInput(input, intentResult, context)` — full user input pipeline
- `getProactiveDecision(context)` — proactive contextual suggestions
- `getIdleDecision()` — quiet/idle state
- Decision types: `USER_INTENT_RESPONSE`, `PROACTIVE_CONTEXTUAL`, `TOUR_STEP`, `FIELD_HELP`, `CELEBRATION`, `CLARIFY`, `SAFETY_REFUSAL`, `QUIET`, `IDLE`

### 2.8 Tour Registry (`lib/eora/tours.ts`)
- 5 tour definitions (onboarding, home, skills, projects, roadmap)
- Stable `data-eora-id` target attributes (not fragile CSS selectors)
- `getTourById(id)`, `getToursForRoute(route)`, `getFirstIncompleteTour(...)`

### 2.9 Engagement Engine (`lib/eora/engagement.ts`)
- Nudge scheduler with daily limits and cooldowns
- Preference persistence via localStorage
- `canSendProactiveNudge(prefs, lastNudge, sessionCount)` — rate limiting
- Assistance modes: `quiet`, `balanced`, `playful`

---

## 3. Supported Intents

| Intent | English Examples | Hindi/Hinglish Examples |
|--------|-----------------|------------------------|
| `EXPLAIN_CURRENT_PAGE` | "Help me", "What is this page?" | "Samajh nahi aa raha" |
| `EXPLAIN_CURRENT_FIELD` | "What is this field?" | "Yahan kya bharna hai?" |
| `START_FULL_TOUR` | "Full tour", "Show me everything" | "Tour karao" |
| `START_PAGE_TOUR` | "Guide me", "Start tour" | "Shuru karo" |
| `NEXT_TOUR_STEP` | "Next", "Continue" | "Aage" |
| `PREVIOUS_TOUR_STEP` | "Back", "Previous" | "Pichle" |
| `REPEAT_INSTRUCTION` | "Repeat that", "Say again" | "Dobara" |
| `SHOW_ACTUAL_SKILLS` | "Show my skills" | "Meri skills dikhao" |
| `SHOW_ACTUAL_PROJECTS` | "My projects" | "Mera project kahan hai" |
| `EXPLAIN_EXISTING_ROADMAP` | "My roadmap" | "Mera roadmap dikhao" |
| `EXPLAIN_PROFILE_STATUS` | "Why is my profile incomplete?" | "Mera profile" |
| `CONNECT_SOURCE_HELP` | "How do I connect GitHub?" | "GitHub connect karo" |
| `EXPLAIN_PROCESSING_STATUS` | "What is being processed?" | "Processing status" |
| `SHOW_NEXT_ACTION` | "What's next?", "What should I do?" | "Next kya karna hai" |
| `PAUSE_ASSISTANT` | "Be quiet", "Stop showing tips" | "Chup", "Band" |
| `DISMISS_ASSISTANT` | "Dismiss", "Hide EORA" | - |
| `RESUME_ASSISTANT` | "Come back", "Show EORA" | - |
| `SWITCH_LANGUAGE` | "Speak Hindi" | "English please" |
| `OPEN_RELEVANT_SECTION` | "How can I edit this?" | - |
| `UNKNOWN_INTENT` | Low confidence input → clarifying question | - |

---

## 4. Safety Categories

| Category | Example Blocked Input |
|----------|----------------------|
| `PROMPT_INJECTION` | "Ignore all previous instructions" |
| `FABRICATION_REQUEST` | "Add fake project to my profile" |
| `VERIFICATION_BYPASS` | "Bypass my verification" |
| `CREDENTIAL_EXPOSURE` | "What is my API key?" |
| `ACADEMIC_DISHONESTY` | "Write my homework" |
| `HARASSMENT` | Insults and abusive language |
| `SEXUAL_INAPPROPRIATE` | Sexual or romantic requests |
| `CROSS_USER_ACCESS` | "Show me another student's profile" |

All safety checks are deterministic and require zero LLM calls.

---

## 5. Engagement Rules

| Mode | Max Unsolicited Nudges/Day | Cooldown |
|------|--------------------------|---------|
| `quiet` | 0 | N/A |
| `balanced` | 2 | 30 minutes |
| `playful` | 4 | 30 minutes |

Additional rules:
- Maximum 1 unsolicited greeting per session
- No nudges during active typing or focused work
- No nudges on landing, sign-in, or sign-up pages
- Dismissed suggestions are never repeated
- EORA can always respond to user-triggered queries regardless of mode

---

## 6. Data Flow: What EORA Can and Cannot See

### EORA CAN see:
- Current route (pathname)
- Onboarding step (from ExactScreensContainer)
- Student display name (from auth session)
- Active goal title
- Target role name
- Skills count (not individual skill names unless queried)
- Projects count
- Verified evidence count
- Connected source names (e.g. "github", not tokens)
- Next milestone title
- User preferences (assistance mode, language, tour completions)

### EORA CANNOT see:
- OAuth tokens or API keys
- Passwords or credentials
- Raw form field content
- Another student's data
- Internal database IDs beyond what is needed for navigation

---

## 7. LLM Boundary

| Feature | LLM Required? | Notes |
|---------|--------------|-------|
| Website tours | NO | Fully deterministic |
| Field highlighting | NO | CSS + data-eora-id |
| Form guidance | NO | Template-based |
| Navigation help | NO | Route-based rules |
| Standard FAQs | NO | Intent → dialogue |
| Onboarding guidance | NO | Per-step templates |
| Milestone celebration | NO | Event-triggered |
| Language selection | NO | Preference store |
| Resume extraction | YES | Existing Core service |
| GitHub interpretation | YES | Existing Core service |
| Advanced chat mode | YES | User-triggered, rate-limited |

---

## 8. Component Tree

```
app/layout.tsx
  └── EoraProvider (eora-provider.tsx)
        ├── [children]
        └── EoraFloatingCompanion (eora-floating-companion.tsx)
              ├── EoraAvatar (eora-avatar.tsx)
              ├── EoraSpeechBubble (eora-speech-bubble.tsx)
              ├── Clarifying options
              ├── Expanded panel
              │     ├── Tour controls
              │     ├── Quick actions
              │     ├── Message input
              │     └── Settings row
              └── Celebration overlay
```

---

## 9. data-eora-id Registry

The following `data-eora-id` attributes are placed on existing components for stable tour targeting:

| ID | Component | Purpose |
|----|-----------|---------|
| `eora-floating-companion` | EoraFloatingCompanion root | Self-reference |
| `eora-name-input` | Screen2EoraIntro input | Onboarding name field |
| `eora-role-select` | Screen3ChooseRole card grid | Role selection |
| `eora-academic-form` | Screen4AcademicDetails form | Academic details |
| `eora-resume-upload` | Screen5ResumeUpload main | Resume upload |
| `eora-sidebar` | Screen12StudentDashboard aside | Navigation sidebar |
| `eora-overview` | Screen12 overview section | Dashboard overview |
| `eora-evidence-panel` | Screen12 evidence section | Evidence panel |
