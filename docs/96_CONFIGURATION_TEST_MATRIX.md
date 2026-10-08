# AI Tathastu — 96-Configuration Test Matrix & Specification

## 1. Mathematical Breakdown
AI Tathastu features 6 canonical interest domains:
- `learning` (Learn AI & ML)
- `jobs` (Internships & Jobs)
- `people` (People & Mentors)
- `collaboration` (Collaborate)
- `projects` (Build Projects)
- `research_events` (Research & Events)

### Configuration Sets:
1. **Single-Interest Selections (6 configurations)**:
   - 6 items choose 1 = 6 configurations. The selected interest is automatically designated as Primary.
2. **Two-Interest Pairs with Primary Assignment (30 configurations)**:
   - 6 items choose 2 = 15 unordered pairs.
   - For each pair $(A, B)$, there are 2 valid choices for Primary (Primary $A$ with Secondary $B$, or Primary $B$ with Secondary $A$).
   - $15 \times 2 = 30$ configurations.
3. **Three-Interest Triples with Primary Assignment (60 configurations)**:
   - 6 items choose 3 = 20 unordered triples.
   - For each triple $(A, B, C)$, there are 3 valid choices for Primary ($A$ with $\{B, C\}$, $B$ with $\{A, C\}$, or $C$ with $\{A, B\}$).
   - $20 \times 3 = 60$ configurations.

**Total Canonical Priority Configurations: $6 + 30 + 60 = 96$.**

---

## 2. Test Suite Validation
The automated test suite in `tests/personalization-engine-96-configs.test.ts` programmatically enumerates and validates all 96 configurations across the following dimensions:
1. **Structural Uniqueness**: All 96 configuration IDs are unique and parseable.
2. **Dashboard Composition**: Every configuration generates a valid 5-section view model with non-empty hero headlines, slot assignments, and EORA contextual text.
3. **Primary Dominance**: Jobs Primary vs. Learning Primary generates distinct candidate rankings and hero copy for the same student context.
4. **Action Grounding**: All candidate actions map to live, functional routes (`/student/skills`, `/student/projects`, `/student/interviews`, `/student/connections`).
5. **Deterministic Fallback**: Zero reliance on external network calls for core dashboard structure.
