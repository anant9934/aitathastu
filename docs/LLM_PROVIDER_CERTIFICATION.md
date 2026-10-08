# AI TATHASTU — MULTI-PROVIDER LLM ENGINE CERTIFICATION

**Document Version**: 1.0.0 (Phase F Certification)  
**Status**: Architecture Certified & Deterministic Fallback Active  
**Verification Date**: October 2026  

---

## 1. Provider Registry & Architecture

AI Tathastu implements an enterprise multi-provider model routing abstraction in `lib/intelligence/providers/registry.ts` and `lib/intelligence/router.ts`. The platform enforces strict server-side secrecy, zero client credential exposure, and per-user token quotas.

### Registered Provider Specifications

| Provider ID | Configured Production Model ID | Context Limit | Default Timeout | JSON / Structured Output | Tool Calling Support | Operational State |
|---|---|---|---|---|---|---|
| `groq` | `openai/gpt-oss-120b` | 128,000 tokens | 8,000 ms | Supported (`json_object`) | Yes | **TESTED LIVE & ACTIVE (Primary)** |
| `openrouter` | `meta-llama/llama-3.3-70b-instruct` | 128,000 tokens | 15,000 ms | Supported | Yes | **TESTED LIVE & ACTIVE (Secondary)** |
| `gemini` | `gemini-3.5-flash-lite` | 1,000,000 tokens | 20,000 ms | Supported (`generateContent`) | Yes | **TESTED LIVE & ACTIVE (Tertiary)** |
| `cerebras` | `gpt-oss-120b` | 8,192 tokens | 5,000 ms | Supported | Experimental | **Standby (Payment Quota)** |
| `mistral` | `mistral-small-latest` | 128,000 tokens | 15,000 ms | Supported | Yes | **Standby (Rate Limited)** |
| `sambanova` | `Meta-Llama-3.3-70B-Instruct` | 64,000 tokens | 10,000 ms | Supported | Experimental | **Standby (Auth Renewal)** |
| `deterministic_fallback` | `rule-engine-v1` | Unlimited | 5 ms | Strictly Conforming Zod Output | Yes (User-Gated) | **Active Safety Net (Verified)** |

---

## 2. Task-Based Routing & Zod Validation Schemas

All model interactions are dispatched by task domain and validated via strict Zod schemas in `lib/intelligence/schemas.ts`:

### Task A — Resume Interpretation (`PROFILE_EXTRACT`)
- **Input**: Validated raw text extracted from PDF or DOCX resume streams.
- **Output Schema**: `ResumeInterpretationSchema`
  - Validates candidates for education, experience, technical projects, and claimed skills.
  - Enforces provenance: all extracted skills are assigned trust tier `self_reported` or `source_detected`.
  - **Prohibition**: Never flags resume keywords as `institutionally_verified`.

### Task B — Goal Understanding (`GOAL_INTERPRETATION`)
- **Input**: Free-text student career aspirations.
- **Output Schema**: `GoalUnderstandingSchema`
  - Classifies goal into `internship | full_time_job | research | higher_studies | startup | project_portfolio`.
  - Maps to canonical AI/ML taxonomy: `Machine Learning Engineer`, `Generative AI Engineer`, `AI Research Scientist`, `Computer Vision Engineer`, `NLP Engineer`, `MLOps Engineer`.
  - Generates recommended 3–6 month milestones.

### Task C — GitHub Repository Interpretation (`PROJECT_INTERPRETATION`)
- **Input**: Authorized repository metadata, README excerpt, and dependency manifest (`package.json`, `requirements.txt`).
- **Output Schema**: `GitHubProjectInterpretationSchema`
  - Extracts project purpose, primary domain classification, and libraries used.
  - Flags competency evidence strictly as `source_detected` with explicit justification.
  - Enforces uncertainty notes for ambiguous or unexecuted source files.

### Task D — Learning Recommendations (`LEARNING_RECOMMENDATIONS`)
- **Input**: Target role prerequisites, verified coverage gaps, and student priorities.
- **Output Schema**: `LearningRecommendationsSchema`
  - Generates up to 3 prioritized actions.
  - Requires internal, accessible application routes (e.g. `/student/roadmap`, `/student/projects`).
  - Prohibits dead or external hallucinatory links.

### Task E — Roadmap Explanation (`ROADMAP_EXPLANATION`)
- **Input**: Current deterministic prerequisite graph state and active evidence ledger.
- **Output Schema**: `RoadmapExplanationSchema`
  - Synthesizes student progress narrative, current milestone focus, and prerequisite rationale.

### Task F — EORA Conversation (`EORA_CHAT`)
- **Input**: User query, minimal authorized student context packet (PII redacted), and retrieved RAG concepts.
- **Output**: Grounded conversational markdown response with source citations and optional structured tool proposals.

---

## 3. Safe Tool Execution Framework

The intelligence engine never executes untrusted code, arbitrary SQL, or unconfirmed mutations. The execution pipeline in `lib/intelligence/tool-executor.ts` enforces:

```
LLM Suggestion / Tool Call
         │
         ▼
[1. Name & Schema Validation]  (propose_add_project, propose_update_goal, propose_request_verification)
         │
         ▼
[2. Authentication Gate]      (Requires valid personId & sessionUserId)
         │
         ▼
[3. User Confirmation Gate]    (isConfirmedByUser === true?)
         ├── NO ────────► Returns actionSummary & confirmationPayload (Awaiting Student Click)
         └── YES ───────► Executes domain service (e.g. saveProject, setActiveGoal)
                                 │
                                 ▼
                         [4. DB Audit Log] (Persisted to aiAuditLogs)
```

- **Prohibited Operations**: Arbitrary SQL execution, unrestricted outbound HTTP fetches, file system access, and OS shell commands are strictly disallowed.

---

## 4. Reliability, Rate Limiting & Cost Controls

- **Circuit Breaking**: When a provider returns HTTP 429 (Too Many Requests) or 5xx server errors, a 60-second cooldown is enforced for that provider.
- **Automatic Fallback**: If all external providers fail or their credentials are not provisioned, requests seamlessly transition to `executeDeterministicFallback()` within <5ms.
- **Per-User Quotas**: Daily token budgets are tracked in `lib/intelligence/cost-control.ts` (default 50,000 tokens/day per student), preventing runaway billing.
- **Telemetry & Auditing**: Every model request is audited with latency, task, provider, status, and fallback flag.

---

## 5. Certification Verdict

| Check | Verdict | Details |
|---|---|---|
| **Multi-Provider Architecture** | **PASSED** | 6 external adapters + 1 deterministic engine integrated. |
| **Zod Schema Validation** | **PASSED** | 100% of tasks validated via strict typings in acceptance tests. |
| **Deterministic Fallback** | **PASSED** | Unit & integration tests pass with 0 external API keys present. |
| **Third-Party Provider Production Keys** | **PASSED & ACTIVE** | Live cloud LLM inference verified with Groq (`openai/gpt-oss-120b`), OpenRouter (`llama-3.3-70b`), and Gemini (`gemini-3.5-flash-lite`). |
