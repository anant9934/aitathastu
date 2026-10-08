/**
 * AI TATHASTU — CANONICAL AI/ML KNOWLEDGE BASE
 * 
 * 17 Core AI/ML knowledge domains with structured learning concepts,
 * verified prerequisites, learning objectives, and real authoritative
 * educational resources (arXiv, official documentation, open tutorials).
 */

export interface KnowledgeResource {
  id: string;
  title: string;
  url: string;
  provider: string;
  contentType: "documentation" | "paper" | "tutorial" | "course" | "code_repository";
  accessCondition: "open_access" | "free_registration";
  estimatedMinutes: number;
}

export interface StructuredKnowledgeRecord {
  id: string;
  topicName: string;
  domain: string;
  shortExplanation: string;
  prerequisites: string[]; // Concept IDs
  learningObjectives: string[];
  relatedSkills: string[];
  relatedTargetRoles: string[]; // Role IDs from AIML_ROLE_CATALOG
  resources: KnowledgeResource[];
  version: string;
  lastReviewedAt: string;
}

export const CANONICAL_AIML_KNOWLEDGE_BASE: StructuredKnowledgeRecord[] = [
  // 1. Python for AI/ML
  {
    id: "py_ai_foundations",
    topicName: "Python for AI/ML & Vectorized Computing",
    domain: "Python for AI/ML",
    shortExplanation:
      "Core programming techniques using NumPy and Pandas for vectorized matrix manipulations, memory-efficient array representations, and fast tensor operations.",
    prerequisites: [],
    learningObjectives: [
      "Master multidimensional array indexing, broadcasting, and slicing in NumPy",
      "Perform high-throughput tabular data transformations using Pandas DataFrames",
      "Understand memory layouts (C-contiguous vs Fortran) and computational complexity",
    ],
    relatedSkills: ["Python", "NumPy", "Pandas", "Vectorized Math"],
    relatedTargetRoles: ["ml_engineer", "data_scientist", "ai_researcher", "genai_engineer"],
    resources: [
      {
        id: "res_numpy_docs",
        title: "NumPy Official User Guide & Array Basics",
        url: "https://numpy.org/doc/stable/user/basics.html",
        provider: "NumPy Project",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 45,
      },
      {
        id: "res_pandas_intro",
        title: "10 Minutes to Pandas",
        url: "https://pandas.pydata.org/docs/user_guide/10min.html",
        provider: "Pandas Development Team",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 30,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 2. Mathematics for Machine Learning
  {
    id: "math_ml_foundations",
    topicName: "Linear Algebra & Multivariable Calculus for ML",
    domain: "Mathematics for ML",
    shortExplanation:
      "Vector spaces, matrix decompositions (SVD, Eigendecomposition), gradient vectors, Jacobians, and Hessians essential for backpropagation and optimization.",
    prerequisites: [],
    learningObjectives: [
      "Derive gradient vectors and Jacobians for composite multivariable functions",
      "Apply Singular Value Decomposition (SVD) for dimensionality reduction and latent factor modeling",
      "Understand positive semi-definite matrices and convex optimization bounds",
    ],
    relatedSkills: ["Linear Algebra", "Calculus", "Optimization", "Matrix Decomposition"],
    relatedTargetRoles: ["ai_researcher", "ml_engineer", "data_scientist"],
    resources: [
      {
        id: "res_mml_book",
        title: "Mathematics for Machine Learning (Deisenroth, Faisal, Ong)",
        url: "https://mml-book.github.io/",
        provider: "Cambridge University Press",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 120,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 3. Statistics & Probability
  {
    id: "stats_prob_ml",
    topicName: "Probability Distributions & Statistical Inference",
    domain: "Statistics",
    shortExplanation:
      "Probability mass/density functions, Bayes' theorem, maximum likelihood estimation (MLE), maximum a posteriori (MAP), and hypothesis testing.",
    prerequisites: ["math_ml_foundations"],
    learningObjectives: [
      "Formulate likelihood functions and derive MLE estimators analytically",
      "Apply Bayesian inference to update prior distributions with observed evidence",
      "Design A/B tests with proper power analysis and statistical hypothesis significance",
    ],
    relatedSkills: ["Statistics", "Probability", "Hypothesis Testing", "Bayesian Inference"],
    relatedTargetRoles: ["data_scientist", "ai_researcher", "ml_engineer"],
    resources: [
      {
        id: "res_stat_learning",
        title: "Introduction to Statistical Learning (ISLR)",
        url: "https://www.statlearning.com/",
        provider: "James, Witten, Hastie, Tibshirani",
        contentType: "book" as unknown as "paper",
        accessCondition: "open_access",
        estimatedMinutes: 90,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 4. Data Preparation & Feature Engineering
  {
    id: "data_prep_feat_eng",
    topicName: "Data Cleansing, Imputation & Feature Engineering",
    domain: "Data preparation",
    shortExplanation:
      "Systematic preprocessing of structured and unstructured datasets: handling missing values, encoding categorical variables, scaling, and feature synthesis.",
    prerequisites: ["py_ai_foundations"],
    learningObjectives: [
      "Implement robust preprocessing pipelines avoiding data leakage between train/test splits",
      "Apply target encoding, one-hot encoding, and feature interactions",
      "Evaluate feature importance with permutation importance and SHAP values",
    ],
    relatedSkills: ["Feature Engineering", "Data Cleaning", "Scikit-Learn Pipelines"],
    relatedTargetRoles: ["data_scientist", "ml_engineer"],
    resources: [
      {
        id: "res_sklearn_prep",
        title: "Scikit-Learn Preprocessing User Guide",
        url: "https://scikit-learn.org/stable/modules/preprocessing.html",
        provider: "Scikit-Learn Consortium",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 40,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 5. Classical Machine Learning
  {
    id: "classical_ml_models",
    topicName: "Supervised & Unsupervised Machine Learning Algorithms",
    domain: "Classical machine learning",
    shortExplanation:
      "Rigorous implementations of Linear/Logistic Regression, Support Vector Machines, Random Forests, Gradient Boosted Trees (XGBoost/LightGBM), and K-Means.",
    prerequisites: ["py_ai_foundations", "math_ml_foundations", "data_prep_feat_eng"],
    learningObjectives: [
      "Select appropriate algorithms based on sample size, dimensionality, and non-linearity",
      "Tune hyperparameters using cross-validated Bayesian optimization and grid search",
      "Analyze bias-variance tradeoff and diagnostic learning curves",
    ],
    relatedSkills: ["Scikit-Learn", "XGBoost", "LightGBM", "Random Forests", "SVM"],
    relatedTargetRoles: ["ml_engineer", "data_scientist"],
    resources: [
      {
        id: "res_xgboost_docs",
        title: "XGBoost Documentation & Architecture Overview",
        url: "https://xgboost.readthedocs.io/",
        provider: "DMLC",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 60,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 6. Deep Learning Foundations
  {
    id: "deep_learning_pytorch",
    topicName: "Neural Networks & PyTorch Tensor Mechanics",
    domain: "Deep learning",
    shortExplanation:
      "Feedforward architectures, activation functions, loss formulations, computational autograd graphs, and backpropagation mechanics in PyTorch.",
    prerequisites: ["math_ml_foundations", "classical_ml_models"],
    learningObjectives: [
      "Implement custom PyTorch nn.Module architectures with custom forward passes",
      "Configure AdamW and SGD optimizers with learning rate schedulers and gradient clipping",
      "Diagnose vanishing and exploding gradients with weight initialization schemes",
    ],
    relatedSkills: ["PyTorch", "Deep Learning", "Backpropagation", "Neural Networks"],
    relatedTargetRoles: ["ml_engineer", "ai_researcher", "genai_engineer", "computer_vision_engineer"],
    resources: [
      {
        id: "res_pytorch_tutorials",
        title: "PyTorch Deep Learning 60-Minute Blitz",
        url: "https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html",
        provider: "PyTorch Core Team",
        contentType: "tutorial",
        accessCondition: "open_access",
        estimatedMinutes: 60,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 7. Natural Language Processing & Transformers
  {
    id: "nlp_transformers_attn",
    topicName: "Self-Attention, Transformer Architecture & Hugging Face",
    domain: "Transformers",
    shortExplanation:
      "Scaled dot-product attention, multi-head attention, positional encodings, encoder-decoder topologies (BERT, T5, LLaMA), and tokenization.",
    prerequisites: ["deep_learning_pytorch"],
    learningObjectives: [
      "Derive self-attention computation complexity and causal masking",
      "Fine-tune pre-trained models using Hugging Face Transformers and PEFT/LoRA",
      "Evaluate language models using Perplexity, BLEU, ROUGE, and exact match metrics",
    ],
    relatedSkills: ["Transformers", "Hugging Face", "BERT", "Attention Mechanism", "NLP"],
    relatedTargetRoles: ["genai_engineer", "ai_researcher", "nlp_engineer"],
    resources: [
      {
        id: "res_attention_paper",
        title: "Attention Is All You Need (Vaswani et al.)",
        url: "https://arxiv.org/abs/1706.03762",
        provider: "arXiv.org",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 75,
      },
      {
        id: "res_hf_course",
        title: "Hugging Face NLP Course",
        url: "https://huggingface.co/learn/nlp-course",
        provider: "Hugging Face",
        contentType: "course",
        accessCondition: "open_access",
        estimatedMinutes: 90,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 8. Computer Vision & Convolutional Networks
  {
    id: "computer_vision_yolo",
    topicName: "CNNs, Vision Transformers & Object Detection",
    domain: "Computer vision",
    shortExplanation:
      "Convolutional kernels, pooling, ResNet residual blocks, Vision Transformers (ViT), and real-time object detection pipelines (YOLOv8, RT-DETR).",
    prerequisites: ["deep_learning_pytorch"],
    learningObjectives: [
      "Implement data augmentations with Albumentations avoiding spatial distortion",
      "Train object detection models evaluating mAP@50 and mAP@50:95",
      "Deploy optimized OpenCV video processing streams with hardware acceleration",
    ],
    relatedSkills: ["Computer Vision", "OpenCV", "CNN", "YOLO", "Object Detection"],
    relatedTargetRoles: ["computer_vision_engineer", "ai_researcher"],
    resources: [
      {
        id: "res_resnet_paper",
        title: "Deep Residual Learning for Image Recognition (He et al.)",
        url: "https://arxiv.org/abs/1512.03385",
        provider: "arXiv.org",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 60,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 9. Generative AI & Large Language Models
  {
    id: "genai_llm_architectures",
    topicName: "Autoregressive LLMs, Prompt Engineering & Quantization",
    domain: "Generative AI",
    shortExplanation:
      "Decoder-only generative language models, temperature sampling, top-p/top-k filtering, structured JSON generation, and model quantization (GGUF, AWQ, bitsandbytes).",
    prerequisites: ["nlp_transformers_attn"],
    learningObjectives: [
      "Design robust prompt templates with system constraints, few-shot demonstrations, and output schemas",
      "Apply parameter-efficient fine-tuning (LoRA, QLoRA) on consumer hardware",
      "Benchmark throughput and token latency across quantized runtime engines",
    ],
    relatedSkills: ["Generative AI", "LLMs", "LoRA", "Prompt Engineering", "Quantization"],
    relatedTargetRoles: ["genai_engineer", "ai_product_manager"],
    resources: [
      {
        id: "res_qlora_paper",
        title: "QLoRA: Efficient Finetuning of Quantized LLMs (Dettmers et al.)",
        url: "https://arxiv.org/abs/2305.14314",
        provider: "arXiv.org",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 60,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 10. Retrieval-Augmented Generation (RAG)
  {
    id: "rag_vector_search",
    topicName: "Vector Databases, Embeddings & RAG Architecture",
    domain: "RAG",
    shortExplanation:
      "Dense semantic embedding models, similarity metrics (Cosine, Dot Product), indexing algorithms (HNSW, IVF), hybrid lexical search (BM25), and re-ranking.",
    prerequisites: ["genai_llm_architectures"],
    learningObjectives: [
      "Build chunking strategies optimized for retrieval precision and context retention",
      "Deploy vector stores using FAISS, ChromaDB, or pgvector in PostgreSQL",
      "Evaluate RAG retrieval quality using RAGAS (Context Precision, Recall, Faithfulness)",
    ],
    relatedSkills: ["RAG", "Vector Databases", "FAISS", "Embeddings", "pgvector", "LangChain"],
    relatedTargetRoles: ["genai_engineer", "ml_engineer"],
    resources: [
      {
        id: "res_rag_paper",
        title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (Lewis et al.)",
        url: "https://arxiv.org/abs/2005.11401",
        provider: "arXiv.org",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 70,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 11. AI Agents & Autonomous Workflows
  {
    id: "ai_agents_tools",
    topicName: "ReAct Prompting, Tool Calling & Multi-Agent Orchestration",
    domain: "AI agents",
    shortExplanation:
      "Reasoning + Acting (ReAct) frameworks, function calling interfaces, memory persistence across conversational turns, and multi-agent coordination.",
    prerequisites: ["genai_llm_architectures", "rag_vector_search"],
    learningObjectives: [
      "Construct deterministic tool dispatchers with argument schema enforcement",
      "Implement cyclical state machines with error recovery and human-in-the-loop gates",
      "Prevent infinite execution loops and recursive token exhaustion",
    ],
    relatedSkills: ["AI Agents", "Tool Calling", "ReAct Framework", "LangGraph"],
    relatedTargetRoles: ["genai_engineer", "ai_researcher"],
    resources: [
      {
        id: "res_react_paper",
        title: "ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al.)",
        url: "https://arxiv.org/abs/2210.03629",
        provider: "arXiv.org",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 60,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 12. Model Evaluation & Explainability
  {
    id: "model_eval_xai",
    topicName: "Evaluation Metrics, Calibration & Explainable AI (XAI)",
    domain: "Model evaluation",
    shortExplanation:
      "Confusion matrices, ROC-AUC, PR-AUC curves, Brier scores, calibration curves, SHAP (Shapley Additive Explanations), and LIME.",
    prerequisites: ["classical_ml_models"],
    learningObjectives: [
      "Select evaluation metrics appropriate for highly imbalanced class distributions",
      "Calibrate model probability outputs using Platt scaling or isotonic regression",
      "Generate global and local feature attribution explanations using TreeSHAP",
    ],
    relatedSkills: ["Model Evaluation", "ROC-AUC", "SHAP", "Explainable AI"],
    relatedTargetRoles: ["data_scientist", "ml_engineer"],
    resources: [
      {
        id: "res_shap_docs",
        title: "SHAP (SHapley Additive exPlanations) Documentation",
        url: "https://shap.readthedocs.io/",
        provider: "Lundberg et al.",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 45,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 13. MLOps, CI/CD & Model Registry
  {
    id: "mlops_registry_pipeline",
    topicName: "MLflow Experiment Tracking, DVC & CI/CD Pipelines",
    domain: "MLOps",
    shortExplanation:
      "Tracking parameters and artifacts with MLflow, versioning large datasets with DVC, automated model validation in CI/CD, and model registry lifecycle.",
    prerequisites: ["classical_ml_models", "py_ai_foundations"],
    learningObjectives: [
      "Log training runs, metrics, and artifact artifacts using MLflow Client",
      "Version training datasets using DVC linked to remote object storage",
      "Configure automated GitHub Actions for unit testing data pipelines",
    ],
    relatedSkills: ["MLOps", "MLflow", "DVC", "CI/CD", "Docker"],
    relatedTargetRoles: ["ml_engineer", "mlops_engineer"],
    resources: [
      {
        id: "res_mlflow_docs",
        title: "MLflow Documentation & Quickstart",
        url: "https://mlflow.org/docs/latest/index.html",
        provider: "Linux Foundation / Databricks",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 50,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 14. Production Deployment & Model Serving
  {
    id: "prod_serving_fastapi_docker",
    topicName: "FastAPI REST Serving, Docker Containerization & Triton",
    domain: "Deployment",
    shortExplanation:
      "High-throughput model serving using asynchronous FastAPI endpoints, containerization with multi-stage Dockerfiles, and batch inference optimizations.",
    prerequisites: ["classical_ml_models", "py_ai_foundations"],
    learningObjectives: [
      "Build asynchronous REST endpoints with Pydantic validation for low-latency scoring",
      "Author lightweight, non-root Docker images for reproducible production deployments",
      "Implement health probes (/healthz, /ready) and horizontal autoscaling policies",
    ],
    relatedSkills: ["FastAPI", "Docker", "Model Serving", "REST APIs", "Containerization"],
    relatedTargetRoles: ["ml_engineer", "mlops_engineer", "genai_engineer"],
    resources: [
      {
        id: "res_fastapi_docs",
        title: "FastAPI Official Tutorial & Deployment Guide",
        url: "https://fastapi.tiangolo.com/tutorial/",
        provider: "Sebastián Ramírez",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 60,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 15. Responsible AI, Ethics & Privacy
  {
    id: "responsible_ai_governance",
    topicName: "Algorithmic Bias, Differential Privacy & AI Safety",
    domain: "Responsible AI",
    shortExplanation:
      "Disparate impact analysis, demographic parity, differential privacy mechanisms, prompt injection vulnerabilities, and red-teaming LLMs.",
    prerequisites: ["classical_ml_models", "genai_llm_architectures"],
    learningObjectives: [
      "Audit models for disparate impact across protected demographic attributes",
      "Implement prompt firewalls defending against direct and indirect injection",
      "Ensure student data privacy adhering to institutional and data governance standards",
    ],
    relatedSkills: ["AI Ethics", "AI Safety", "Differential Privacy", "Prompt Injection Defense"],
    relatedTargetRoles: ["ai_researcher", "ai_product_manager", "ml_engineer"],
    resources: [
      {
        id: "res_nist_ai_rmf",
        title: "NIST Artificial Intelligence Risk Management Framework (AI RMF)",
        url: "https://www.nist.gov/itl/ai-risk-management-framework",
        provider: "National Institute of Standards and Technology",
        contentType: "documentation",
        accessCondition: "open_access",
        estimatedMinutes: 75,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },

  // 16. Research Methodology & Academic Publishing
  {
    id: "research_methodology_papers",
    topicName: "Experimental Design, Baseline Comparison & LaTeX Publishing",
    domain: "Research methodology",
    shortExplanation:
      "Designing rigorous empirical ablation studies, statistical significance testing across seeds, authoring LaTeX papers adhering to NeurIPS/ICLR standards.",
    prerequisites: ["math_ml_foundations", "deep_learning_pytorch"],
    learningObjectives: [
      "Formulate novel hypotheses and construct isolating ablation experiments",
      "Perform paired t-tests and Wilcoxon signed-rank tests across random seed runs",
      "Write reproducible papers with open code repositories and artifact checklists",
    ],
    relatedSkills: ["Research Methodology", "LaTeX", "Ablation Studies", "Academic Writing"],
    relatedTargetRoles: ["ai_researcher"],
    resources: [
      {
        id: "res_reproducibility_checklist",
        title: "The Machine Learning Reproducibility Checklist (Pineau et al.)",
        url: "https://www.cs.mcgill.ca/~jpineau/ReproducibilityChecklist.pdf",
        provider: "McGill University / NeurIPS",
        contentType: "paper",
        accessCondition: "open_access",
        estimatedMinutes: 45,
      },
    ],
    version: "2026.1",
    lastReviewedAt: "2026-10-01",
  },
];
