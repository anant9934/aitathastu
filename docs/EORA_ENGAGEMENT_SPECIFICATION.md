# AI Tathastu — EORA Alive Phase 7
# The EORA Engagement, Expressions & Delight Engine Specification

**Companion**: EORA (Empathetic Observer & Roadmap Advisor)  
**Version**: 7.0.0  
**Design Principle**: Dignified Helpfulness without Attention Manipulation  
**Asset Lock**: Original EORA (`v1.0.0`, sky-blue hoodie, round black glasses, brown eyes)  

---

## 1. Engagement Philosophy & Ethical Standards

EORA is designed to be memorable, expressive, empathetic, and genuinely enjoyable to interact with. However, engagement at AI Tathastu exists solely to support students' real progress, never to artificially trap attention.

### Ethical Boundaries
1. **No Artificial Urgency**: EORA never displays fake countdowns, fabricated deadlines, or guilt-inducing messages (e.g. *"You'll fall behind if you don't study now!"*).
2. **No Emotional Dependency or Guilt**: EORA never says *"I missed you"* or *"Why did you leave me?"*. She remains a professional, cheerful, capable academic companion.
3. **No Unsolicited Interruptions during Focus**: When a student is typing in code inputs, writing contribution notes, or reading long documents, EORA enters **Quiet Companion** mode.
4. **Permanent Dismissal Respect**: If a student closes or dismisses a suggestion, EORA never repeats that suggestion in the same session.

---

## 2. Contextual Moments

### 2.1 The Welcome Moment
- **Trigger**: First authenticated visit of a session.
- **Behavior**: Short, warm greeting (e.g. *"Welcome back, [Name]! Ready to make progress on your [Goal] roadmap today?"*).
- **Control**: User can click, dismiss, or ignore. Automatically auto-dismisses after 8 seconds without sound.

### 2.2 Curious Discovery
- **Trigger**: User navigates to a new section for the first time (e.g., Digital Footprints or Faculty Verification).
- **Behavior**: A compact, single-sentence highlight of what this section enables (e.g. *"Here you can connect your GitHub to automatically discover your coding evidence."*).
- **Pose**: `presenting` or `holding-tablet`.

### 2.3 Tiny Victory
- **Trigger**: A genuine server-confirmed operation (e.g. Project created, resume extracted, skill evidence attached).
- **Behavior**: One short celebration moment with EORA displaying a thumbs-up or gentle sparkle.
- **Pose**: `thumbs-up` or `celebrating`.
- **Constraint**: Never triggered on failed operations or routine navigations.

### 2.4 Problem Rescue
- **Trigger**: The user receives repeated validation errors on the same form (e.g. Missing required project contribution, invalid URL format).
- **Behavior**: EORA gently opens assistance: *"Looks like this field needs a specific format. Let me help you break down what's needed."*
- **Pose**: `reassuring`.
- **Tone**: Always supportive, never shaming.

### 2.5 Project Curiosity
- **Trigger**: A project is saved without a detailed contribution note.
- **Behavior**: EORA offers: *"Recruiters love knowing what YOU specifically built. Want to add a quick 2-sentence contribution note?"*
- **Pose**: `explaining`.

### 2.6 Roadmap Discovery
- **Trigger**: Roadmap page opened with an active incomplete stage.
- **Behavior**: EORA highlights the single highest-priority milestone and offers to launch the practice workspace.
- **Pose**: `pointing-right`.

### 2.7 Smart Return
- **Trigger**: Student logs back in after 24+ hours.
- **Behavior**: EORA recalls the last active milestone: *"Last time you were building [ProjectTitle]. Would you like to continue from there?"*

### 2.8 Playful Easter Eggs
- **Trigger**: Deliberate user clicks on EORA's floating avatar.
- **Behavior**: Cycling short, witty, educational tips (e.g. *"Did you know? Code with good unit tests receives verified badges 3x faster from faculty!"*).

---

## 3. Approved Pose & Expression Registry

EORA's visual representation strictly utilizes the original character assets from `public/assets/eora/`:

| Mood / Interaction | Approved Asset Pose | Asset Filename | Visual Description |
|---|---|---|---|
| **WELCOME** | `waving` | `eora-waving.png` | Friendly greeting wave |
| **EXPLAIN** | `explaining` | `eora-explaining.png` | Open hand explaining concept |
| **POINT** | `pointing-right` | `eora-pointing-right.png` | Directing attention to UI element |
| **QUESTION** | `thinking` | `eora-thinking.png` | Thoughtful finger on chin |
| **REASSURE** | `reassuring` | `eora-reassuring.png` | Gentle smile with encouraging posture |
| **SUCCESS** | `thumbs-up` | `eora-thumbs-up.png` | Cheerful thumbs up |
| **ACHIEVEMENT** | `celebrating` | `eora-celebrating.png` | Celebratory victory pose |
| **PRESENT** | `presenting` | `eora-presenting.png` | Presenting a card or feature |
| **READ_CONTEXT** | `holding-tablet` | `eora-holding-tablet.png` | Reviewing profile / evidence data |
| **IDLE** | `avatar` | `eora-avatar-sm.png` | Compact neutral floating companion avatar |

*Note: All assets are high-resolution static PNGs. No simulated blinking or artificial facial morphing is fabricated.*

---

## 4. Motion, Accessibility & Quiet Mode

### 4.1 Reduced Motion Support
When `prefers-reduced-motion: reduce` is detected in media queries:
- All floating bobbing animations (`animationName: eora-float`) are immediately disabled.
- Transitions switch to instantaneous discrete opacity switches.

### 4.2 Quiet Mode
The user can cycle between three distinct assistance intensities via the EORA settings menu:
1. **Playful Mode**: Full animated expressions, friendly greetings, easter eggs, and victory sparkles.
2. **Balanced Mode** (Default): Gentle hints, max 2 proactive nudges per day, subtle micro-animations.
3. **Quiet Mode**:
   - Floating avatar motion is paused (`animationName: none`).
   - Proactive nudges and speech bubbles are completely suppressed.
   - EORA remains available purely as an on-demand assistance button when clicked.

---

## 5. Frequency & Anti-Burnout Rules

- **Maximum Proactive Nudges**: 2 per calendar day in Balanced mode.
- **No Duplicate Nudges**: Nudges are tracked with timestamps; the same nudge ID cannot fire twice within 24 hours.
- **Session Reset**: On browser close or logout, temporary dismissals reset while persistent tour completions remain safely stored in the user preference ledger.
