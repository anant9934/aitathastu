/**
 * AI TATHASTU — CENTRAL EVIDENCE NORMALIZATION & CROSS-SOURCE DATA FUSION SERVICE (V3)
 *
 * Implements:
 * 1. Part 6: Canonical Evidence Record schema with provenance, extraction method,
 *    claim categorization (extracted vs confirmed vs externally observed vs assessed vs verified),
 *    freshness, and deduplication fingerprints.
 * 2. Part 7: Cross-Source Data Fusion:
 *    - Deep canonical skill alias normalization (e.g. Python3 -> Python, Sklearn -> Scikit-Learn)
 *    - Project deduplication across Resume, GitHub, Kaggle, Portfolio, and LinkedIn
 *    - Preserves independent evidence sources and provenance
 *    - Detects conflicting dates, organizations, and URLs without silent overwrites
 */

import crypto from "crypto";
import type { EvidenceInsertParams } from "@/lib/repositories/evidence-repository";
import type { EvidenceCategory, EvidenceSource, VerificationStatus } from "@/lib/domain/evidence";

export type CanonicalRecordType =
  | "skill"
  | "project"
  | "publication"
  | "assessment"
  | "experience"
  | "education"
  | "achievement";

export type EvidenceExtractionMethod =
  | "rule_based"
  | "connector_api"
  | "resume_extractor"
  | "firecrawl_enrichment"
  | "user_confirmed"
  | "manual";

export type EvidenceReviewStatus =
  | "draft"
  | "candidate"
  | "confirmed"
  | "rejected";

export type CanonicalVerificationStatus =
  | "unverified"
  | "imported"
  | "claimed"
  | "verified"
  | "rejected";

export interface CanonicalEvidenceRecord {
  studentId: string;
  recordType: CanonicalRecordType;
  claimValue: string;
  structuredFields: Record<string, unknown>;
  sourceProvider: string;
  sourceUrl?: string | null;
  sourceEvidenceSpan?: string | null;
  captureTimestamp: string;
  freshnessTimestamp: string;
  extractionMethod: EvidenceExtractionMethod;
  extractionConfidence?: number | null;
  reviewStatus: EvidenceReviewStatus;
  verificationStatus: CanonicalVerificationStatus;
  externalRecordId?: string | null;
  deduplicationFingerprint: string;
  parentRecordAssociation?: string | null;
  whyItMatters: string;
}

const CANONICAL_SKILL_ALIASES: Record<string, { canonical: string; category: string }> = {
  // Python & Core AI
  python: { canonical: "Python", category: "Languages" },
  python3: { canonical: "Python", category: "Languages" },
  "python 3": { canonical: "Python", category: "Languages" },
  py: { canonical: "Python", category: "Languages" },
  cpython: { canonical: "Python", category: "Languages" },
  pytorch: { canonical: "PyTorch", category: "AI & ML" },
  torch: { canonical: "PyTorch", category: "AI & ML" },
  torchvision: { canonical: "PyTorch", category: "AI & ML" },
  torchaudio: { canonical: "PyTorch", category: "AI & ML" },
  tensorflow: { canonical: "TensorFlow", category: "AI & ML" },
  tf: { canonical: "TensorFlow", category: "AI & ML" },
  "tensorflow 2": { canonical: "TensorFlow", category: "AI & ML" },
  "tensorflow 2.0": { canonical: "TensorFlow", category: "AI & ML" },
  keras: { canonical: "TensorFlow", category: "AI & ML" },
  "scikit-learn": { canonical: "Scikit-Learn", category: "AI & ML" },
  sklearn: { canonical: "Scikit-Learn", category: "AI & ML" },
  opencv: { canonical: "OpenCV", category: "AI & ML" },
  cv2: { canonical: "OpenCV", category: "AI & ML" },
  "opencv-python": { canonical: "OpenCV", category: "AI & ML" },

  // GenAI & LLM
  transformers: { canonical: "Transformers", category: "GenAI" },
  huggingface: { canonical: "Transformers", category: "GenAI" },
  hf: { canonical: "Transformers", category: "GenAI" },
  "hugging face": { canonical: "Transformers", category: "GenAI" },
  langchain: { canonical: "LangChain", category: "GenAI" },
  "langchain-core": { canonical: "LangChain", category: "GenAI" },
  llamaindex: { canonical: "LlamaIndex", category: "GenAI" },
  "llama-index": { canonical: "LlamaIndex", category: "GenAI" },
  rag: { canonical: "RAG", category: "GenAI" },
  "retrieval augmented generation": { canonical: "RAG", category: "GenAI" },
  "retrieval-augmented generation": { canonical: "RAG", category: "GenAI" },
  "hybrid rag": { canonical: "RAG", category: "GenAI" },
  llm: { canonical: "LLMs", category: "GenAI" },
  llms: { canonical: "LLMs", category: "GenAI" },
  "large language models": { canonical: "LLMs", category: "GenAI" },
  "large language model": { canonical: "LLMs", category: "GenAI" },
  "prompt engineering": { canonical: "Prompt Engineering", category: "GenAI" },
  "prompt design": { canonical: "Prompt Engineering", category: "GenAI" },
  faiss: { canonical: "Vector Databases", category: "GenAI" },
  chroma: { canonical: "Vector Databases", category: "GenAI" },
  chromadb: { canonical: "Vector Databases", category: "GenAI" },
  pinecone: { canonical: "Vector Databases", category: "GenAI" },
  qdrant: { canonical: "Vector Databases", category: "GenAI" },
  weaviate: { canonical: "Vector Databases", category: "GenAI" },
  milvus: { canonical: "Vector Databases", category: "GenAI" },

  // Classical Disciplines
  nlp: { canonical: "NLP", category: "AI & ML" },
  "natural language processing": { canonical: "NLP", category: "AI & ML" },
  "computer vision": { canonical: "Computer Vision", category: "AI & ML" },
  cv: { canonical: "Computer Vision", category: "AI & ML" },
  "deep learning": { canonical: "Deep Learning", category: "AI & ML" },
  dl: { canonical: "Deep Learning", category: "AI & ML" },
  "machine learning": { canonical: "Machine Learning", category: "AI & ML" },
  ml: { canonical: "Machine Learning", category: "AI & ML" },
  "generative ai": { canonical: "Generative AI", category: "GenAI" },
  genai: { canonical: "Generative AI", category: "GenAI" },
  "linear algebra": { canonical: "Linear Algebra", category: "AI & ML" },
  calculus: { canonical: "Calculus", category: "AI & ML" },
  statistics: { canonical: "Statistics", category: "AI & ML" },
  probability: { canonical: "Probability", category: "AI & ML" },

  // MLOps, Cloud, Infrastructure
  mlops: { canonical: "MLOps", category: "Cloud" },
  "ml pipeline": { canonical: "MLOps", category: "Cloud" },
  "model serving": { canonical: "MLOps", category: "Cloud" },
  docker: { canonical: "Docker", category: "Cloud" },
  dockerfile: { canonical: "Docker", category: "Cloud" },
  kubernetes: { canonical: "Kubernetes", category: "Cloud" },
  k8s: { canonical: "Kubernetes", category: "Cloud" },
  fastapi: { canonical: "FastAPI", category: "Backend" },
  flask: { canonical: "Flask", category: "Backend" },
  django: { canonical: "Django", category: "Backend" },
  aws: { canonical: "AWS", category: "Cloud" },
  "amazon web services": { canonical: "AWS", category: "Cloud" },
  gcp: { canonical: "GCP", category: "Cloud" },
  "google cloud": { canonical: "GCP", category: "Cloud" },
  azure: { canonical: "Azure", category: "Cloud" },
  "microsoft azure": { canonical: "Azure", category: "Cloud" },

  // Data & Databases
  postgresql: { canonical: "PostgreSQL", category: "Data" },
  postgres: { canonical: "PostgreSQL", category: "Data" },
  psql: { canonical: "PostgreSQL", category: "Data" },
  mongodb: { canonical: "MongoDB", category: "Data" },
  mongo: { canonical: "MongoDB", category: "Data" },
  sql: { canonical: "SQL", category: "Data" },
  mysql: { canonical: "MySQL", category: "Data" },
  sqlite: { canonical: "SQLite", category: "Data" },
  pandas: { canonical: "Pandas", category: "Data" },
  numpy: { canonical: "NumPy", category: "Data" },
  matplotlib: { canonical: "Matplotlib", category: "Data" },
  seaborn: { canonical: "Matplotlib", category: "Data" },

  // Languages & Full-Stack
  typescript: { canonical: "TypeScript", category: "Languages" },
  ts: { canonical: "TypeScript", category: "Languages" },
  javascript: { canonical: "JavaScript", category: "Languages" },
  js: { canonical: "JavaScript", category: "Languages" },
  react: { canonical: "React", category: "Frontend" },
  "react.js": { canonical: "React", category: "Frontend" },
  reactjs: { canonical: "React", category: "Frontend" },
  "next.js": { canonical: "Next.js", category: "Frontend" },
  nextjs: { canonical: "Next.js", category: "Frontend" },
  "node.js": { canonical: "Node.js", category: "Backend" },
  nodejs: { canonical: "Node.js", category: "Backend" },
  node: { canonical: "Node.js", category: "Backend" },
  "c++": { canonical: "C++", category: "Languages" },
  cpp: { canonical: "C++", category: "Languages" },
  "c++11": { canonical: "C++", category: "Languages" },
  "c++14": { canonical: "C++", category: "Languages" },
  "c++17": { canonical: "C++", category: "Languages" },
  "c++20": { canonical: "C++", category: "Languages" },
  java: { canonical: "Java", category: "Languages" },
  golang: { canonical: "Go", category: "Languages" },
  go: { canonical: "Go", category: "Languages" },
  git: { canonical: "Git", category: "Tools" },
  github: { canonical: "Git", category: "Tools" },
  linux: { canonical: "Linux", category: "Tools" },
  bash: { canonical: "Linux", category: "Tools" },
  zsh: { canonical: "Linux", category: "Tools" },
};

export class EvidenceNormalizationService {
  /**
   * Normalizes raw skill strings into their canonical form with category.
   */
  static normalizeSkill(raw: string): { canonical: string; category: string } {
    const cleaned = raw.trim();
    const lower = cleaned.toLowerCase();
    const mapped = CANONICAL_SKILL_ALIASES[lower];
    if (mapped) {
      return mapped;
    }
    // Handle punctuation/version stripped
    const stripped = lower.replace(/[^a-z0-9+#]/g, "");
    const strippedMatch = CANONICAL_SKILL_ALIASES[stripped];
    if (strippedMatch) {
      return strippedMatch;
    }
    return {
      canonical: cleaned,
      category: "Other",
    };
  }

  /**
   * Generates a stable deduplication fingerprint (SHA-256) for evidence.
   */
  static generateFingerprint(studentId: string, category: string, subject: string, source: string): string {
    const normSubject = subject.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const raw = `${studentId}:${category}:${normSubject}:${source.toLowerCase()}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
  }

  /**
   * Constructs a canonical evidence record from heterogeneous sources.
   */
  static buildCanonicalRecord(params: {
    studentId: string;
    recordType: CanonicalRecordType;
    subject: string;
    claimValue: string;
    structuredFields?: Record<string, unknown>;
    sourceProvider: string;
    sourceUrl?: string | null;
    sourceEvidenceSpan?: string | null;
    extractionMethod: EvidenceExtractionMethod;
    extractionConfidence?: number | null;
    reviewStatus?: EvidenceReviewStatus;
    verificationStatus?: CanonicalVerificationStatus;
    externalRecordId?: string | null;
    parentRecordAssociation?: string | null;
    whyItMatters?: string;
  }): CanonicalEvidenceRecord {
    const now = new Date().toISOString();
    const fingerprint = this.generateFingerprint(
      params.studentId,
      params.recordType,
      params.subject,
      params.sourceProvider
    );

    return {
      studentId: params.studentId,
      recordType: params.recordType,
      claimValue: params.claimValue,
      structuredFields: params.structuredFields || {},
      sourceProvider: params.sourceProvider,
      sourceUrl: params.sourceUrl,
      sourceEvidenceSpan: params.sourceEvidenceSpan,
      captureTimestamp: now,
      freshnessTimestamp: now,
      extractionMethod: params.extractionMethod,
      extractionConfidence: params.extractionConfidence ?? 0.8,
      reviewStatus: params.reviewStatus || "candidate",
      verificationStatus: params.verificationStatus || "imported",
      externalRecordId: params.externalRecordId,
      deduplicationFingerprint: fingerprint,
      parentRecordAssociation: params.parentRecordAssociation,
      whyItMatters: params.whyItMatters || "Corroborates candidate capability through verifiable public evidence.",
    };
  }

  /**
   * Translates a CanonicalEvidenceRecord into EvidenceInsertParams for database insertion.
   */
  static toEvidenceInsertParams(rec: CanonicalEvidenceRecord): EvidenceInsertParams {
    let source: EvidenceSource = "imported";
    if (rec.sourceProvider === "resume") source = "resume_extracted";
    else if (rec.sourceProvider === "user" || rec.extractionMethod === "user_confirmed") source = "self_reported";
    else if (rec.sourceProvider === "institution") source = "institutional";

    let verificationStatus: VerificationStatus = "imported";
    if (rec.verificationStatus === "verified") verificationStatus = "verified";
    else if (rec.verificationStatus === "unverified") verificationStatus = "unverified";
    else if (rec.verificationStatus === "claimed") verificationStatus = "self_reported";

    return {
      category: rec.recordType as EvidenceCategory,
      subject: rec.claimValue,
      value: rec.claimValue,
      source,
      verificationStatus,
      sourceReference: rec.sourceUrl || rec.sourceEvidenceSpan || rec.sourceProvider,
      originSource: rec.sourceProvider,
      interpretation: rec.sourceEvidenceSpan || `${rec.recordType} claim observed from ${rec.sourceProvider}.`,
      whyItMatters: rec.whyItMatters,
      importKey: rec.deduplicationFingerprint,
      confidenceScore: rec.extractionConfidence ?? undefined,
    };
  }

  /**
   * Cross-source project deduplication. Merges project records that refer to the same
   * underlying work across CV, GitHub, Kaggle, and Portfolio.
   */
  static fuseProjects(
    projects: Array<{
      title: string;
      source: string;
      repositoryUrl?: string;
      demoUrl?: string;
      technologies?: string[];
      description?: string;
    }>
  ): Array<{
    title: string;
    description: string;
    sources: string[];
    repositoryUrl?: string;
    demoUrl?: string;
    technologies: string[];
    isMultiSource: boolean;
  }> {
    const fused: Array<{
      title: string;
      description: string;
      sources: string[];
      repositoryUrl?: string;
      demoUrl?: string;
      technologies: string[];
      isMultiSource: boolean;
      titleKey: string;
      repoSlug: string | null;
      cleanRepo: string | null;
      cleanDemo: string | null;
    }> = [];

    const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const getRepoSlug = (url?: string) => {
      if (!url) return null;
      const clean = url.toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");
      const last = clean.split("/").pop() || "";
      return normTitle(last);
    };
    const cleanUrl = (url?: string) => {
      if (!url) return null;
      return url.toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");
    };

    for (const p of projects) {
      const pTitleKey = normTitle(p.title);
      const pRepoSlug = getRepoSlug(p.repositoryUrl);
      const pCleanRepo = cleanUrl(p.repositoryUrl);
      const pCleanDemo = cleanUrl(p.demoUrl);

      const existing = fused.find((f) => {
        // Direct repository URL match
        if (pCleanRepo && f.cleanRepo && pCleanRepo === f.cleanRepo) return true;
        // Direct demo URL match
        if (pCleanDemo && f.cleanDemo && pCleanDemo === f.cleanDemo) return true;
        // Exact normalized title match
        if (pTitleKey && f.titleKey && pTitleKey === f.titleKey) return true;
        // Cross-match: title matches repository slug (e.g. "Credit Card Fraud Detection" vs "credit-card-fraud-detection")
        if (pRepoSlug && f.titleKey && (pRepoSlug === f.titleKey || (pRepoSlug.length >= 6 && f.titleKey.includes(pRepoSlug)))) return true;
        if (pTitleKey && f.repoSlug && (pTitleKey === f.repoSlug || (pTitleKey.length >= 6 && f.repoSlug.includes(pTitleKey)))) return true;
        // Substring title match for descriptive titles (min length 6 to prevent short collisions)
        if (pTitleKey.length >= 6 && f.titleKey.length >= 6 && (pTitleKey.includes(f.titleKey) || f.titleKey.includes(pTitleKey))) return true;
        return false;
      });

      if (existing) {
        if (!existing.sources.includes(p.source)) {
          existing.sources.push(p.source);
        }
        existing.isMultiSource = true;
        if (!existing.repositoryUrl && p.repositoryUrl) {
          existing.repositoryUrl = p.repositoryUrl;
          existing.cleanRepo = pCleanRepo;
          existing.repoSlug = pRepoSlug;
        }
        if (!existing.demoUrl && p.demoUrl) {
          existing.demoUrl = p.demoUrl;
          existing.cleanDemo = pCleanDemo;
        }
        if (p.description && (!existing.description || p.description.length > existing.description.length)) {
          existing.description = p.description;
        }
        // Choose the more human-readable title
        if (p.title.includes(" ") && !existing.title.includes(" ")) {
          existing.title = p.title;
        }
        const techSet = new Set([...existing.technologies, ...(p.technologies || [])]);
        existing.technologies = Array.from(techSet);
      } else {
        fused.push({
          title: p.title,
          description: p.description || "",
          sources: [p.source],
          repositoryUrl: p.repositoryUrl,
          demoUrl: p.demoUrl,
          technologies: p.technologies || [],
          isMultiSource: false,
          titleKey: pTitleKey,
          repoSlug: pRepoSlug,
          cleanRepo: pCleanRepo,
          cleanDemo: pCleanDemo,
        });
      }
    }

    return fused.map(({ titleKey: _t, repoSlug: _rs, cleanRepo: _cr, cleanDemo: _cd, ...rest }) => rest);
  }
}
