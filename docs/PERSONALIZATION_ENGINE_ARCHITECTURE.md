# AI Tathastu — Personalization Engine Architecture

## 1. Core Architecture
The Personalization Engine (`lib/domain/personalization-engine.ts`) is a deterministic-first composition system designed exclusively for AI & ML students. It bridges student goals, recorded project and skill evidence, canonical interest priorities, and platform capabilities.

```
Authenticated Student Identity
  │
  ▼
Person 360 Context (Skills, Evidence Ledger, Projects, Credentials)
  │
  ▼
AI/ML Direction Resolver (14 Canonical Roles, Prerequisite Matrix)
  │
  ▼
Priority Ranker (96 Configurations: 1 Primary + up to 2 Secondaries)
  │
  ▼
Intersection Engine (Pairwise & Triple Semantics)
  │
  ▼
Candidate Action Generator & Eligibility Filter (Top 5 Actions)
  │
  ▼
5-Section Dashboard View Model (Overview, Evidence, Growth, Ecosystem, Next Actions)
```

---

## 2. Key Modules
- **`CANONICAL_INTERESTS`**: Six foundational interest models with tailored theme colors, hero copy, and primary emphasis guidelines.
- **`getAll96Configurations()`**: Programmatic enumeration of all 96 valid priority combinations.
- **`getIntersectionStrategy()`**: Domain mapping of 15 pairs and 20 triples to ensure semantic action generation (e.g. `jobs` + `projects` yields "Portfolio-First Employability").
- **`composePersonalizedDashboard()`**: Pure deterministic function creating the 5-section student view model.

---

## 3. Security & Isolation Invariants
1. **Multi-User Isolation**: No global or shared cache contains private student records.
2. **Zero Mock Leakage**: Low-data and fresh students receive honest "provisional" indicators rather than simulated numbers.
3. **Deterministic Integrity**: Core platform features remain fully functional when LLM providers are unavailable or offline.
