# AI TATHASTU — PERSONALIZED ROADMAP ENGINE VALIDATION

**Document Version**: 1.0.0 (Phase F Certification)  
**Status**: Deterministic Graph & Feedback Engine Validated  
**Verification Date**: October 2026  

---

## 1. Roadmap Planning Architecture

AI Tathastu's roadmap engine (`lib/domain/aiml-role-taxonomy.ts`, `lib/domain/gaps.ts`, `lib/domain/recommendations.ts`) constructs goal-directed progression pathways based on deterministic prerequisite graphs rather than unconstrained LLM hallucinations.

```
Authenticated Student Context
(Goal + Role + Priorities + Evidence)
                 │
                 ▼
[1. Target Role Taxonomy Resolution]  (e.g. Generative AI Engineer)
                 │
                 ▼
[2. Evidence Ledger Comparison]       (Separate Demonstrated vs Claimed vs Insufficient)
                 │
                 ▼
[3. Prerequisite Graph Traversal]     (Topological ordering: Python -> PyTorch -> Transformers -> RAG)
                 │
                 ▼
[4. Priority Modulation]              (Jobs vs Learning vs Research sequencing)
                 │
                 ▼
[5. Versioned Roadmap & Next Actions] (Up to 5 Ranked Actions with Rationale & Working Routes)
```

---

## 2. Supported AI/ML Target Role Taxonomies

The taxonomy defines required core competencies, recommended project types, and prerequisite sequences:

| Target Role | Core Competencies | Key Prerequisite Chain | Recommended Capstone Project |
|---|---|---|---|
| **Generative AI Engineer** | LLM Architectures, Vector DBs, Prompt Engineering, RAG Systems, Agentic Workflows, Evaluation (RAGAS) | Python ➔ PyTorch ➔ Hugging Face Transformers ➔ Vector Indexing ➔ Agentic Tool Use | End-to-End Enterprise RAG with Citations & Evaluation |
| **Machine Learning Engineer** | Classical ML, Feature Engineering, Scikit-Learn, Deep Learning, Model Serving (FastAPI/Docker), Monitoring | Linear Algebra & Calc ➔ Python & NumPy ➔ Scikit-Learn ➔ PyTorch ➔ Docker Containerization | Production Model API with Drift Monitoring & CI/CD |
| **AI Research Scientist** | Mathematical Rigor, Preprints Analysis, Novel Architectures, Benchmark Evaluation, Ablation Studies | Multivariable Calculus & Probability ➔ Deep Architecture Theory ➔ PyTorch Research Code ➔ Reproducibility | Benchmark Replication & Novel Architecture Ablation Study |
| **Computer Vision Engineer** | CNNs, Vision Transformers, Object Detection, Segmentation, OpenCV, TensorRT/ONNX Optimization | Image Processing Fundamentals ➔ PyTorch CNNs ➔ YOLO / Mask R-CNN ➔ Real-time Inference | Edge-Optimized Real-time Object Tracking Pipeline |
| **MLOps Engineer** | CI/CD for ML, Feature Stores, Data Versioning (DVC), Pipeline Orchestration (Airflow/Kubeflow), Monitoring | Linux & Shell ➔ Docker & Kubernetes ➔ Model Registries ➔ Automated Training Pipelines | End-to-End GitOps ML Training & Deployment Pipeline |
| **NLP Engineer** | Tokenization, Word Embeddings, Recurrent Networks, Attention Mechanisms, Fine-tuning (PEFT/LoRA) | Linguistics & Text Preprocessing ➔ Word2Vec/GloVe ➔ Transformers ➔ LoRA Fine-Tuning | Domain-Adapted SLM Fine-Tuned with LoRA & Eval Suite |

---

## 3. Personalized Next Best Action (NBA) Generator

The Next Best Action engine produces up to 5 prioritized, explainable steps (`lib/domain/recommendations.ts`):

- **Action Title**: Concise, imperative statement (e.g., *"Build an End-to-End RAG Project"*).
- **Reason**: Clear justification linking the action to the student's active goal and prerequisite gaps.
- **Linked Goal**: Associated career target (e.g., *"Internship in 6 months"*).
- **Target Route**: Working, functional internal URL (`/student/projects`, `/student/roadmap`, `/student/skills`). **Zero dead buttons permitted.**
- **Prerequisite State**: Explains why this step comes before advanced milestones.

---

## 4. Student Feedback Loop & Dynamic Recomputation

The roadmap provides an interactive feedback loop via `/api/student/feedback`:

- **Feedback Actions**:
  - `not_relevant`: De-prioritizes the recommended milestone from the active view.
  - `already_done`: Guides the student to attach project or GitHub evidence to demonstrate mastery.
  - `save_for_later`: Moves the action to the student's backlog.
  - `change_goal`: Reroutes the student to the Goal & Target Role selector.
  - `change_priorities`: Reroutes to the Priority Configuration screen.
- **Non-Destructive Invalidation**: Modifying goals or feedback updates the current roadmap without deleting previously recorded evidence or altering historical journey events.

---

## 5. Validation Verdict

| Capability | Verdict | Notes |
|---|---|---|
| **Deterministic Dependency Order** | **PASSED** | Prerequisite cycles prevented via acyclic taxonomy graphs. |
| **Evidence-Aware Step Skipping** | **PASSED** | Demonstrated skills automatically fulfill prerequisite nodes. |
| **Action Route Validity** | **PASSED** | 100% of generated next actions resolve to valid application routes. |
| **Feedback Persistence** | **PASSED** | Verified via test suite and API endpoint test. |
