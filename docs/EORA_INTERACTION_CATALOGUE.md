# AI Tathastu — EORA Alive Phase 7
# Complete Interaction, Intent & Dialogue Catalogue

**Engine**: EORA Universal Page Intelligence (UPI)  
**Version**: 7.0.0  
**Languages**: English, Hindi, Hinglish  
**Execution Runtime**: Deterministic (Zero Routine LLM Network Invocations)  

---

## 1. Intent Taxonomy & Multilingual Matchers

EORA's Page-Aware Intent Engine (`lib/eora/intent.ts`) classifies student input deterministically using keyword triggers, regex patterns, and route-conditioned context.

| Intent Category | English Patterns | Hindi / Hinglish Patterns | Confidence |
|---|---|---|---|
| `EXPLAIN_PAGE` | *what is this page, what can i do here, explain this page, tell me about this page* | *ye page kya hai, yahan kya kar sakte hain, is page ke baare me batao, explain karo* | 0.95 |
| `START_TOUR` | *show me around, start tour, guided tour, give me a tour, take me on a tour* | *tour shuru karo, ghumao, guide karo, dikhao kahan kya hai* | 0.95 |
| `STOP_TOUR` | *stop tour, exit tour, end tour, cancel tour, close tour* | *tour band karo, ruk jao, exit tour, band karo* | 0.95 |
| `NEXT_TOUR_STEP` | *next step, next, continue tour, what's next in tour* | *agla step, aage chalo, next step dikhao* | 0.90 |
| `PREV_TOUR_STEP` | *previous step, back, go back in tour* | *peeche jao, pichhla step, back* | 0.90 |
| `HELP_WITH_FORM` | *help me with this form, how to fill this, guide me through this form* | *form bharne me madad karo, kaise bharun, step by step batao* | 0.90 |
| `SHOW_NEXT_ACTION` | *what should i do next, what's next, what now, where do i start* | *ab kya karun, aage kya karna hai, agla kadam kya hai, kahan se shuru karun* | 0.90 |
| `SIMPLIFY_EXPLANATION` | *i don't understand, explain simpler, simplify this, in simple words, eli5* | *samajh nahi aaya, aasan bhasha me batao, saral shabdon me samjhao* | 0.95 |
| `SWITCH_LANGUAGE` | *explain in hinglish, hinglish mein bolo, switch to english, speak in english* | *hinglish me baat karo, english me bolo, bhasha badlo* | 0.90 |
| `NAVIGATE` | *take me to projects, go to skills, open roadmap, show connections, view profile* | *projects par chalo, skills page kholo, roadmap dikhao, connections me jao* | 0.92 |
| `EXPLAIN_METRIC` | *why this score, why this percentage, explain metric, how is this calculated* | *ye score kaise aaya, ye metric kya hai, percentage kaise calculate hui* | 0.95 |
| `EXPLAIN_RECOMMENDATION` | *why this recommendation, why should i do this, why are you suggesting this* | *ye suggestion kyu diya, mujhe ye kyu karna chahiye* | 0.95 |
| `EXPLAIN_EVIDENCE` | *what is this evidence, why is this verified, explain proof, where did this come from* | *ye evidence kya hai, ye verify kaise hua, proof kahan se aaya* | 0.95 |
| `EXPLAIN_ERROR` | *something went wrong, why did this fail, error explanation, help with error* | *error aa gaya, fail kyu hua, problem kya hai, theek kaise hoga* | 0.90 |
| `QUIET_MODE` | *be quiet, quiet mode, stop talking, silent mode* | *chup raho, quiet mode on karo, shant raho* | 0.90 |
| `DISMISS` | *dismiss, close, go away, bye eora, hide* | *chale jao, band karo, bye* | 0.90 |
| `RESUME` | *i'm back, resume, continue, unpause* | *wapas aa gaya, continue karo, aage batao* | 0.90 |

---

## 2. Contextual Intent Disambiguation

Ambiguous phrases resolve intelligently based on the active page context:

| User Query | Active Page | Resolved Intent | Resolved Action |
|---|---|---|---|
| *"What's next?"* | `/onboarding` | `SHOW_NEXT_ACTION` | Explains next incomplete onboarding field/step. |
| *"What's next?"* | `/student/projects` | `SHOW_NEXT_ACTION` | Recommends adding contribution note or repo link. |
| *"What's next?"* | `/student/roadmap` | `SHOW_NEXT_ACTION` | Highlights active roadmap milestone. |
| *"What's next?"* | `/student` | `SHOW_NEXT_ACTION` | Highlights top priority action from `What Matters Now`. |
| *"Take me to my projects"* | Any | `NAVIGATE` | Navigates to `/student/projects`. |
| *"Go to skills"* | Any | `NAVIGATE` | Navigates to `/student/skills`. |
| *"Show roadmap"* | Any | `NAVIGATE` | Navigates to `/student/roadmap`. |
| *"Connect GitHub"* | Any | `NAVIGATE` | Navigates to `/student/connections`. |

---

## 3. Approved English & Hinglish Dialogue Catalogue

All dialogue is grounded directly in the active `EoraPageContract` and student context. General-purpose LLMs are never used to rephrase standard instructions.

### 3.1 Page Explanations
- **English**: *"Welcome to [PageTitle]! [PagePurpose] You can [AvailableFunctions]. Where would you like to start?"*
- **Hinglish**: *"[PageTitle] me aapka swagat hai! Yahan aap [PagePurpose]. Aap [AvailableFunctions] kar sakte hain. Kahan se shuru karein?"*

### 3.2 Simplification (`SIMPLIFY_EXPLANATION`)
- **English**: *"Let me break this down simply: [ClearStep]. Focus on this one step first, and let me know when you're ready for the next!"*
- **Hinglish**: *"Main isko simple shabdon me batati hoon: [ClearStep]. Pehle bas is ek step par focus kijiye, fir agla step dekhenge!"*

### 3.3 Form Guidance (`HELP_WITH_FORM`)
- **Add Project Form**:
  - Step 1: Project Name (e.g., *"Autonomous Vision Agent"*)
  - Step 2: AI/ML Domain & Tech Stack (e.g., *"PyTorch, YOLOv8"*)
  - Step 3: Specific Personal Contribution (e.g., *"Implemented real-time inference loop and benchmark evaluation"*)
  - Step 4: GitHub Link & Live Demo
  - Step 5: Save & Verify
- **Tone Rule**: Always encouraging, specific, and non-shaming. If a user makes a mistake or leaves a field blank, explain the requirement clearly without condescension.

### 3.4 Error Recovery (`EXPLAIN_ERROR`)
- **English**: *"Don't worry, we can fix this together. [RecoveryStep]. Let me know if you run into any trouble!"*
- **Hinglish**: *"Fikar mat kijiye, hum isko theek kar lenge. [RecoveryStep]. Koi dikkat aaye to mujhe batayein!"*

---

## 4. Safe Action Engine Security Boundaries

1. **No Password/Secret Interaction**:
   - `field-password`, `otp`, `pin`, `secret`, `token` inputs can never be targeted, focused, or read by EORA.
2. **Strict Route Whitelist**:
   - Navigation is permitted only to genuine, registered routes within AI Tathastu.
   - Any external URL, `javascript:` URI, or unauthorized administrative endpoint is rejected immediately.
3. **No Automatic Form Submission**:
   - EORA guides and focuses inputs, but the user must always click Submit, Save, or Delete manually.
