/**
 * AI TATHASTU — HYBRID CV EXTRACTION VERIFICATION & BENCHMARK SUITE
 *
 * Automated tests covering:
 * 1. Tier 1 Deterministic baseline extraction (PDF / DOCX text stream)
 * 2. Evidence validation, sourceSpan preservation, and anti-negation filtering
 * 3. Render Schema v2.0 profile adaptation (Scanned OCR resumes)
 * 4. Controlled LLM enrichment decision gate (shouldEnrichWithLLM)
 * 5. Additive merge with deterministic precedence (mergeExtractionOutputs)
 * 6. Quota exhaustion resilience (zero-loss fallback to deterministic baseline)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractResumeDeterministic } from "../lib/resume/deterministic-extractor";
import {
  extractResumeDeterministicResult,
  adaptRenderProfileToInterpretation,
  shouldEnrichWithLLM,
  mergeExtractionOutputs,
} from "../lib/services/resume-extraction-service";
import type { ExtractorProfileV2 } from "../lib/services/extractor-service-client";
import { ResumeInterpretationSchema, type ResumeInterpretationOutput } from "../lib/intelligence/schemas";

const SAMPLE_STUDENT_RESUME = `
PRIYA RAMAN
priya.raman@example.com | +91 9876543210 | Bengaluru, Karnataka
GitHub: https://github.com/priyaraman | LinkedIn: https://linkedin.com/in/priyaraman

EDUCATION
B.Tech in Computer Science and Engineering
Indian Institute of Technology Madras
2021 – 2025 | CGPA: 8.9 / 10

SKILLS
Programming Languages: Python, TypeScript, JavaScript, C++, SQL, Go
Frameworks & Libraries: React, Next.js, PyTorch, Node.js, FastApi
Tools: Docker, Git, PostgreSQL
Note: No experience with Rust or Ruby. Want to learn Kubernetes in the future.

WORK EXPERIENCE
Machine Learning Engineering Intern | Zeta Analytics | Bengaluru, India
May 2024 – July 2024
- Built a real-time anomaly detection pipeline handling 2M events daily.
- Optimized model inference latency by 35% using TensorRT.

PROJECTS
DocuSeek RAG Engine
https://github.com/priyaraman/docuseek
- Built a multi-tenant retrieval-augmented generation search over 50,000 research papers.
- Integrated hybrid vector search using Qdrant and dense embeddings.

AlgoVisualizer
https://github.com/priyaraman/algoviz
- Interactive algorithm visualization platform built with React and TypeScript.

CERTIFICATIONS
AWS Certified Cloud Practitioner | Amazon Web Services | 2023

ACHIEVEMENTS
- Finalist at Smart India Hackathon 2023 with AI healthcare triage system.
- Published research paper on graph neural networks at IEEE Conference 2024.
`;

test("Phase 1: Deterministic baseline extracts structured data without LLM", () => {
  const det = extractResumeDeterministic(SAMPLE_STUDENT_RESUME, [
    "https://github.com/priyaraman",
    "https://linkedin.com/in/priyaraman",
    "https://github.com/priyaraman/docuseek",
    "https://github.com/priyaraman/algoviz",
  ]);

  // Identity & Contact
  assert.equal(det.profile.fullName, "PRIYA RAMAN");
  assert.equal(det.profile.email, "priya.raman@example.com");
  assert.equal(det.profile.mobile, undefined, "Phone extraction is strictly prohibited per V4 privacy guarantee");
  assert.equal(det.profile.location, "Bengaluru, Karnataka");

  // Education
  assert.ok(det.interpretation.education.length >= 1, "Education was extracted");
  const edu = det.interpretation.education[0];
  assert.ok(edu.institution.includes("Indian Institute of Technology Madras"), "Institution correctly identified");
  assert.ok(edu.degree.includes("B.Tech"), "Degree correctly identified");
  assert.ok(edu.graduationYear === "2025", "Graduation year extracted");
  assert.ok(edu.sourceSpan.length >= 3 && edu.sourceSpan.length <= 300, "Evidence span valid");

  // Skills & Anti-negation
  const skillNames = det.interpretation.skills.map((s) => s.name);
  assert.ok(skillNames.includes("Python"), "Python extracted");
  assert.ok(skillNames.includes("TypeScript"), "TypeScript extracted");
  assert.ok(skillNames.includes("PyTorch"), "PyTorch extracted");
  assert.ok(skillNames.includes("Next.js"), "Next.js extracted");

  // Anti-negation validation: "No experience with Rust or Ruby" must NOT be extracted as verified skills
  assert.ok(!skillNames.includes("Rust"), "Negated skill Rust was correctly dropped");
  assert.ok(!skillNames.includes("Ruby"), "Negated skill Ruby was correctly dropped");

  // Projects
  assert.ok(det.interpretation.projects.length >= 2, "Projects were extracted");
  const docuseek = det.interpretation.projects.find((p) => p.title.toLowerCase().includes("docuseek"));
  assert.ok(docuseek, "DocuSeek project found");
  assert.equal(docuseek.repositoryUrl, "https://github.com/priyaraman/docuseek");
  assert.ok(docuseek.technologies.length > 0, "DocuSeek technologies found");

  // Experience
  assert.ok(det.interpretation.experience.length >= 1, "Internship was extracted");
  const exp = det.interpretation.experience[0];
  assert.ok(exp.company.includes("Zeta Analytics"), "Company extracted");
  assert.equal(exp.type, "internship");

  // Certifications & Achievements
  assert.ok(det.interpretation.certifications.length >= 1, "Certifications extracted");
  assert.ok(det.interpretation.achievements.length >= 1, "Achievements extracted");

  // Complete Schema compliance
  const validated = ResumeInterpretationSchema.safeParse(det.interpretation);
  assert.ok(validated.success, "Deterministic output strictly conforms to ResumeInterpretationSchema");
});

test("Phase 2: Render Schema v2.0 profile is adapted into Vercel ResumeInterpretationOutput", () => {
  const mockRenderProfile: ExtractorProfileV2 = {
    schema_version: "2.0",
    document_id: "doc-render-test-123",
    groups: {
      identity: [
        {
          record_id: "id_1",
          record_state: "extracted",
          fields: {
            full_name: {
              value: "Aarav Sharma",
              original_value: "Aarav Sharma",
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "Aarav Sharma", page: 1, section: "header", method: "ocr" }],
              history: [],
            },
            location: {
              value: "New Delhi, India",
              original_value: "New Delhi, India",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "New Delhi, India", page: 1, section: "header", method: "ocr" }],
              history: [],
            },
          },
        },
      ],
      contact: [
        {
          record_id: "ct_1",
          record_state: "extracted",
          fields: {
            email: {
              value: "aarav.sharma@example.com",
              original_value: "aarav.sharma@example.com",
              confidence: 0.98,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "aarav.sharma@example.com", page: 1, section: "contact", method: "ocr" }],
              history: [],
            },
            phone: {
              value: "+91 9988776655",
              original_value: "+91 9988776655",
              confidence: 0.92,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "+91 9988776655", page: 1, section: "contact", method: "ocr" }],
              history: [],
            },
          },
        },
      ],
      education: [
        {
          record_id: "edu_1",
          record_state: "extracted",
          fields: {
            institution: {
              value: "Delhi Technological University",
              original_value: "Delhi Technological University",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "Delhi Technological University", page: 1, section: "education", method: "ocr" }],
              history: [],
            },
            degree_title: {
              value: "B.Tech Software Engineering",
              original_value: "B.Tech Software Engineering",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "B.Tech Software Engineering", page: 1, section: "education", method: "ocr" }],
              history: [],
            },
            expected_graduation: {
              value: "2024",
              original_value: "2024",
              confidence: 0.85,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "2024", page: 1, section: "education", method: "ocr" }],
              history: [],
            },
          },
        },
      ],
      skills: [
        {
          record_id: "sk_1",
          record_state: "extracted",
          fields: {
            canonical_name: {
              value: "Python",
              original_value: "Python",
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "Python, Docker, SQL", page: 1, section: "skills", method: "ocr" }],
              history: [],
            },
            category: {
              value: "language",
              original_value: "language",
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [],
              history: [],
            },
          },
        },
        {
          record_id: "sk_2",
          record_state: "extracted",
          fields: {
            canonical_name: {
              value: "Docker",
              original_value: "Docker",
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "Python, Docker, SQL", page: 1, section: "skills", method: "ocr" }],
              history: [],
            },
            category: {
              value: "tool",
              original_value: "tool",
              confidence: 0.95,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [],
              history: [],
            },
          },
        },
      ],
      experience: [],
      internships: [],
      projects: [],
      awards: [],
      certifications: [],
      digital_footprint: [],
    },
    metadata: {
      document_id: "doc-render-test-123",
      file_format: "pdf",
      page_count: 1,
      ocr_attempted: true,
      ocr_used: true,
      text_quality: "good",
      processing_seconds: 1.4,
      extraction_methods: ["tesseract", "pymupdf"],
      parser_version: "2.0.0",
      model_version: "deterministic-2",
      warnings: [],
      status: "completed",
    },
  };

  const rawOcrText = `Aarav Sharma\naarav.sharma@example.com | +91 9988776655 | New Delhi, India\nDelhi Technological University\nB.Tech Software Engineering (2024)\nSkills: Python, Docker, SQL`;
  const adapted = adaptRenderProfileToInterpretation(mockRenderProfile, rawOcrText);

  assert.ok(adapted.success, "Adaptation succeeded");
  assert.equal(adapted.extractedProfile?.fullName, "Aarav Sharma");
  assert.equal(adapted.extractedProfile?.email, "aarav.sharma@example.com");
  assert.equal(adapted.extracted?.education[0].institution, "Delhi Technological University");
  assert.equal(adapted.extracted?.skills.length, 2);
  assert.equal(adapted.provider, "render-ocr");
  assert.ok(adapted.extracted?.education[0].sourceSpan.length >= 3, "Evidence snippet preserved from Render");
});

test("Phase 3: shouldEnrichWithLLM decision gate honors quota, consent, and coverage", () => {
  const fullBaseline: ResumeInterpretationOutput = {
    education: [{ institution: "IIT Bombay", degree: "B.Tech CSE", sourceSpan: "IIT Bombay B.Tech CSE" }],
    skills: [
      { name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" },
      { name: "TypeScript", category: "language", proficiencyHint: "unknown", sourceSpan: "TypeScript" },
      { name: "Go", category: "language", proficiencyHint: "unknown", sourceSpan: "Go" },
      { name: "Docker", category: "tool", proficiencyHint: "unknown", sourceSpan: "Docker" },
      { name: "PostgreSQL", category: "tool", proficiencyHint: "unknown", sourceSpan: "PostgreSQL" },
    ],
    projects: [
      {
        title: "Distributed KV Store",
        description: "Built a Raft-replicated distributed key value store in Go with 99.99% consistency.",
        technologies: ["Go", "Raft"],
        repositoryUrl: "https://github.com/test/kv",
        sourceSpan: "Distributed KV Store in Go",
      },
      {
        title: "Microservices Gateway",
        description: "Implemented an API gateway with rate limiting and JWT verification in Node.js.",
        technologies: ["TypeScript", "Node.js"],
        repositoryUrl: "https://github.com/test/gateway",
        sourceSpan: "Microservices Gateway",
      },
    ],
    experience: [],
    certifications: [],
    achievements: [],
  };

  // 1. High coverage deterministic baseline -> Skip enrichment to conserve AI quota
  const decisionHighCoverage = shouldEnrichWithLLM(fullBaseline, { consent: true, quotaAllowed: true });
  assert.equal(decisionHighCoverage.shouldEnrich, false);
  assert.equal(decisionHighCoverage.reason, "deterministic_coverage_sufficient");

  // 2. Sparse baseline (missing projects or sparse skills) -> Allow enrichment
  const sparseBaseline: ResumeInterpretationOutput = {
    education: [{ institution: "College of Engineering", degree: "BE", sourceSpan: "College of Engineering BE" }],
    skills: [{ name: "Java", category: "language", proficiencyHint: "unknown", sourceSpan: "Java" }],
    projects: [],
    experience: [],
    certifications: [],
    achievements: [],
  };
  const decisionSparse = shouldEnrichWithLLM(sparseBaseline, { consent: true, quotaAllowed: true });
  assert.equal(decisionSparse.shouldEnrich, true);
  assert.equal(decisionSparse.reason, "sparse_or_complex_sections");

  // 3. Quota exhausted -> Skip enrichment safely
  const decisionQuotaExhausted = shouldEnrichWithLLM(sparseBaseline, { consent: true, quotaAllowed: false });
  assert.equal(decisionQuotaExhausted.shouldEnrich, false);
  assert.equal(decisionQuotaExhausted.reason, "quota_exhausted_or_unavailable");

  // 4. User declined AI consent -> Skip enrichment
  const decisionNoConsent = shouldEnrichWithLLM(sparseBaseline, { consent: false, quotaAllowed: true });
  assert.equal(decisionNoConsent.shouldEnrich, false);
  assert.equal(decisionNoConsent.reason, "user_consent_declined");
});

test("Phase 4: mergeExtractionOutputs implements additive merge with deterministic precedence", () => {
  const baseline: ResumeInterpretationOutput = {
    education: [{ institution: "BITS Pilani", degree: "B.E. Computer Science", sourceSpan: "BITS Pilani B.E. Computer Science" }],
    skills: [{ name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" }],
    projects: [
      {
        title: "NLP Sentiment Analyzer",
        description: "", // empty description to be enriched
        technologies: ["Python"],
        repositoryUrl: "https://github.com/student/nlp",
        sourceSpan: "NLP Sentiment Analyzer",
      },
    ],
    experience: [],
    certifications: [],
    achievements: [],
  };

  const rawDocumentText = `BITS Pilani B.E. Computer Science\nSkills: Python, TensorFlow, scikit-learn\nNLP Sentiment Analyzer\nBuilt a BERT-based sentiment classifier achieving 92% F1 score.\nhttps://github.com/student/nlp`;

  const aiEnriched: ResumeInterpretationOutput = {
    education: [{ institution: "BITS Pilani", degree: "Hallucinated Degree", fieldOfStudy: "Computer Science", sourceSpan: "BITS Pilani" }],
    skills: [
      { name: "Python", category: "language", proficiencyHint: "advanced", sourceSpan: "Python" },
      { name: "TensorFlow", category: "framework", proficiencyHint: "intermediate", sourceSpan: "TensorFlow" },
      { name: "HallucinatedSkill", category: "tool", proficiencyHint: "advanced", sourceSpan: "Not in document" },
    ],
    projects: [
      {
        title: "NLP Sentiment Analyzer",
        description: "Built a BERT-based sentiment classifier achieving 92% F1 score.",
        technologies: ["Python", "TensorFlow"],
        repositoryUrl: "https://github.com/hallucinated/nlp",
        sourceSpan: "NLP Sentiment Analyzer",
      },
    ],
    experience: [],
    certifications: [],
    achievements: [],
  };

  const merged = mergeExtractionOutputs(baseline, aiEnriched, rawDocumentText);

  // 1. Deterministic degree preserved over AI hallucination
  assert.equal(merged.education[0].degree, "B.E. Computer Science");
  // 2. Missing fieldOfStudy additively enriched because it's grounded
  assert.equal(merged.education[0].fieldOfStudy, "Computer Science");
  // 3. Project description enriched from AI
  assert.equal(merged.projects[0].description, "Built a BERT-based sentiment classifier achieving 92% F1 score.");
  // 4. Deterministic repositoryUrl preserved over AI
  assert.equal(merged.projects[0].repositoryUrl, "https://github.com/student/nlp");
  // 5. Valid grounded skill TensorFlow added
  const skillNames = merged.skills.map((s) => s.name);
  assert.ok(skillNames.includes("TensorFlow"), "Grounded skill added");
  // 6. Ungrounded AI skill HallucinatedSkill was dropped
  assert.ok(!skillNames.includes("HallucinatedSkill"), "Hallucinated AI skill rejected");
  // 7. Enriched skill proficiency marked unknown (never auto-verified)
  const tf = merged.skills.find((s) => s.name === "TensorFlow");
  assert.equal(tf?.proficiencyHint, "unknown");
});

test("Phase 5: Deterministic baseline produces valid review candidates when AI quota is 0", () => {
  const result = extractResumeDeterministicResult(SAMPLE_STUDENT_RESUME, [
    "https://github.com/priyaraman",
    "https://linkedin.com/in/priyaraman",
  ]);

  assert.ok(result.success);
  assert.ok(result.extracted);
  assert.equal(result.provider, "deterministic-engine");
  assert.equal(result.extractedProfile?.fullName, "PRIYA RAMAN");
  assert.ok(result.links && result.links.length >= 2, "Profile links extracted deterministically");

  // Verified that it satisfies all constraints for review_ready without needing any LLM call
  assert.ok(result.extracted.education.length > 0);
  assert.ok(result.extracted.skills.length >= 4);
  assert.ok(result.extracted.projects.length >= 2);
});
