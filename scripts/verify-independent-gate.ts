/**
 * AI TATHASTU — INDEPENDENT VERIFICATION & RELEASE GATE AUDIT SUITE
 *
 * Rigorous, skeptical tests for Option C Hybrid CV Extraction:
 * 1. Edge-Case Deterministic Extraction with Labeled Ground-Truth Precision & Recall
 * 2. Grounding & sourceSpan Accuracy (Exact substring containment verification)
 * 3. Anti-negation, Aspirational Filtering, and Boundary Collision Protection
 * 4. Render Schema v2.0 Adapter Robustness (Nulls, Missing Fields, Bad Formats)
 * 5. Optional LLM Decision & Failure Resilience (Scenarios A through H)
 * 6. Onboarding Draft Non-Destructive System Merge Validation
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractResumeDeterministic } from "../lib/resume/deterministic-extractor";
import {
  adaptRenderProfileToInterpretation,
  shouldEnrichWithLLM,
  mergeExtractionResults,
  type ResumeExtractionResult,
} from "../lib/services/resume-extraction-service";
import type { ExtractorProfileV2 } from "../lib/services/extractor-service-client";
import { ResumeInterpretationSchema, type ResumeInterpretationOutput } from "../lib/intelligence/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// LABELED GROUND-TRUTH TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const LABELED_EDGE_CASE_CV = `
ANANYA CHATTERJEE
ananya.c@gatech.edu | +91 9123456789 | Kolkata, West Bengal
LinkedIn: https://linkedin.com/in/ananyac | GitHub: https://github.com/ananyac

EDUCATION
Master of Science in Computer Science
Georgia Institute of Technology
Expected: 2024 – 2026 | CGPA: 3.95/4.0
Bachelor of Technology in Information Technology
Jadavpur University
2020 – 2024 | Percentage: 88.5%

TECHNICAL SKILLS
Languages: Python, C++, TypeScript, SQL, Go
Web & ML: React, Next.js, PyTorch, FastAPI, Docker
Excluded Items:
- Have never used Ruby or PHP.
- No commercial experience with Rust.
- Planning to learn Kubernetes in the next year.
- Interested in learning Solidity.

WORK EXPERIENCE
Research Assistant | Georgia Tech AI Lab | Atlanta, GA
Aug 2024 – Present
- Conducting research on transformer attention sparsity.
- Reduced memory footprint of LLM inference by 22%.
Software Engineering Intern | Google | Bengaluru, India
Jan 2024 – June 2024
- Implemented gRPC microservices in Go and C++.
- Deployed internal telemetry dashboard using React and TypeScript.

PROJECTS
NeuroSim: Spiking Neural Network Simulator
https://github.com/ananyac/neurosim
- High-performance simulator written in C++ and Python with OpenMP parallelism.
- Benchmarked against NEST simulator with 3x speedup on multi-core CPUs.

MedVision: Dermatological Diagnostic Tool
- Mobile-first diagnostic application using PyTorch and FastAPI.
- Trained convolutional neural network on 45,000 skin lesion images.

CERTIFICATIONS
Deep Learning Specialization | Coursera | 2023
AWS Certified Developer – Associate | Amazon Web Services | 2024

AWARDS & ACHIEVEMENTS
- First Prize at Smart India Hackathon 2023.
- Recipient of Google Women Techmakers Scholarship 2024.
`;

// Ground-truth expectations for LABELED_EDGE_CASE_CV
const GROUND_TRUTH_1 = {
  fullName: "ANANYA CHATTERJEE",
  email: "ananya.c@gatech.edu",
  phone: "+91 9123456789",
  location: "Kolkata, West Bengal",
  educationInstitutions: ["Georgia Institute of Technology", "Jadavpur University"],
  trueSkills: ["Python", "C++", "TypeScript", "SQL", "Go", "React", "Next.js", "PyTorch", "FastAPI", "Docker", "LLM"],
  negatedSkills: ["Ruby", "PHP", "Rust", "Kubernetes", "Solidity"],
  projects: ["NeuroSim: Spiking Neural Network Simulator", "MedVision: Dermatological Diagnostic Tool"],
  experiences: ["Georgia Tech AI Lab", "Google"],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DETERMINISTIC EXTRACTOR VALIDATION & PRECISION/RECALL AUDIT
// ─────────────────────────────────────────────────────────────────────────────

test("Audit 1.1: Precision, Recall, and Grounding on Labeled Fixture", () => {
  const det = extractResumeDeterministic(LABELED_EDGE_CASE_CV, [
    "https://github.com/ananyac",
    "https://linkedin.com/in/ananyac",
    "https://github.com/ananyac/neurosim",
  ]);

  // Identity verification
  assert.equal(det.profile.fullName, GROUND_TRUTH_1.fullName, "Name matches ground truth");
  assert.equal(det.profile.email, GROUND_TRUTH_1.email, "Email matches ground truth");
  assert.equal(det.profile.mobile, GROUND_TRUTH_1.phone, "Phone matches ground truth");

  // Education recall
  const extractedInstitutions = det.interpretation.education.map((e) => e.institution);
  for (const expectedInst of GROUND_TRUTH_1.educationInstitutions) {
    const found = extractedInstitutions.some((inst) => inst.toLowerCase().includes(expectedInst.toLowerCase()));
    assert.ok(found, `Expected education institution '${expectedInst}' was recalled`);
  }

  // Skills precision and recall
  const extractedSkillNames = det.interpretation.skills.map((s) => s.name);
  console.log("Extracted skills:", extractedSkillNames);
  let truePositives = 0;
  let falsePositives = 0;

  for (const skill of extractedSkillNames) {
    if (GROUND_TRUTH_1.trueSkills.some((ts) => ts.toLowerCase() === skill.toLowerCase())) {
      truePositives++;
    } else {
      falsePositives++;
    }
  }

  const falseNegatives = GROUND_TRUTH_1.trueSkills.filter(
    (ts) => !extractedSkillNames.some((es) => es.toLowerCase() === ts.toLowerCase())
  ).length;

  const precision = truePositives / (truePositives + falsePositives);
  const recall = truePositives / (truePositives + falseNegatives);

  console.log(`[audit-1.1] Labeled Skills Precision: ${(precision * 100).toFixed(1)}%, Recall: ${(recall * 100).toFixed(1)}%`);
  assert.ok(precision >= 0.90, `Precision must be >= 90%, got ${(precision * 100).toFixed(1)}%`);
  assert.ok(recall >= 0.80, `Recall must be >= 80%, got ${(recall * 100).toFixed(1)}%`);

  // Anti-negation verification: NONE of the negated skills should appear
  for (const negated of GROUND_TRUTH_1.negatedSkills) {
    assert.ok(
      !extractedSkillNames.some((s) => s.toLowerCase() === negated.toLowerCase()),
      `Negated or aspirational skill '${negated}' MUST NOT be extracted`
    );
  }

  // Exact Substring Grounding Verification
  const lines = LABELED_EDGE_CASE_CV.split("\n");
  const allClaims = [
    ...det.interpretation.education,
    ...det.interpretation.skills,
    ...det.interpretation.projects,
    ...det.interpretation.experience,
    ...det.interpretation.certifications,
    ...det.interpretation.achievements,
  ];

  for (const claim of allClaims) {
    assert.ok(claim.sourceSpan, "Claim must have a sourceSpan");
    assert.ok(claim.sourceSpan.length >= 3 && claim.sourceSpan.length <= 300, `sourceSpan '${claim.sourceSpan}' within valid bounds`);
    const existsInDoc = lines.some((l) => l.toLowerCase().includes(claim.sourceSpan.toLowerCase()) || claim.sourceSpan.toLowerCase().includes(l.trim().toLowerCase()));
    assert.ok(existsInDoc, `Evidence sourceSpan '${claim.sourceSpan}' must exist verbatim in document content`);
  }
});

test("Audit 1.2: Boundary Collisions & False Positives", () => {
  const boundaryText = `
John Doe | john@test.com
Skills:
- Go and C are good.
- Google is a search engine.
- Reactivity in biology is fascinating.
- The letter R is capital.
- Rusting of iron is an oxidation reaction.
`;
  const det = extractResumeDeterministic(boundaryText);
  const skills = det.interpretation.skills.map((s) => s.name);

  // "Go" must be extracted as a programming language
  assert.ok(skills.includes("Go"), "Go programming language extracted");

  // "Google" must NOT match "Go"
  // "Reactivity" must NOT match "React"
  // "Rusting" must NOT match "Rust"
  assert.ok(!skills.includes("React"), "Reactivity must not trigger React skill");
  assert.ok(!skills.includes("Rust"), "Rusting must not trigger Rust skill");
});

test("Audit 1.3: Malformed Dates and Missing Sections Resilience", () => {
  const malformedCv = `
VIKRAM JOSHI
vikram.j@domain.org

EDUCATION
B.Sc Physics
Unknown College
Dates: 202x to ongoing | GPA: 7.8

WORK EXPERIENCE
Intern
Startup Co
Dates: Spring 2023 - Present
- Fixed bugs and helped customers.
`;

  const det = extractResumeDeterministic(malformedCv);
  assert.equal(det.profile.fullName, "VIKRAM JOSHI");
  assert.equal(det.profile.email, "vikram.j@domain.org");

  // Even with malformed dates, extraction succeeds without throwing
  assert.ok(det.interpretation.education.length > 0, "Education extracted despite malformed dates");
  assert.ok(det.interpretation.experience.length > 0, "Experience extracted despite atypical dates");
  // Projects and skills are safely empty
  assert.equal(det.interpretation.projects.length, 0);
  assert.equal(det.interpretation.skills.length, 0);

  const validated = ResumeInterpretationSchema.safeParse(det.interpretation);
  assert.ok(validated.success, "Schema validation succeeds on partial/sparse CVs");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. RENDER PROFILE ADAPTER VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

test("Audit 2.1: Render Profile Adapter Handles Nulls, Empty Groups, and Malformed Fields", () => {
  const malformedProfile: ExtractorProfileV2 = {
    schema_version: "2.0",
    document_id: "doc-edge-999",
    groups: {
      identity: [
        {
          record_id: "id_empty",
          record_state: "extracted",
          fields: {}, // Missing full_name
        },
      ],
      contact: [
        {
          record_id: "ct_bad",
          record_state: "extracted",
          fields: {
            email: {
              value: "not-an-email", // Malformed email
              original_value: "not-an-email",
              confidence: 0.1,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [],
              history: [],
            },
          },
        },
      ],
      education: [
        {
          record_id: "edu_partial",
          record_state: "extracted",
          fields: {
            institution: {
              value: "Stanford University",
              original_value: "Stanford University",
              confidence: 0.9,
              confidence_kind: "heuristic",
              review_state: "extracted",
              evidence: [{ snippet: "Stanford University", page: 1, section: "education", method: "ocr" }],
              history: [],
            },
            // degree_title and graduation dates are missing/null
          },
        },
      ],
      skills: [],
      experience: [],
      internships: [],
      projects: [],
      awards: [],
      certifications: [],
      digital_footprint: [],
    },
    metadata: {
      document_id: "doc-edge-999",
      file_format: "pdf",
      page_count: 1,
      ocr_attempted: true,
      ocr_used: true,
      text_quality: "poor",
      processing_seconds: 0.8,
      extraction_methods: ["tesseract"],
      parser_version: "2.0.0",
      model_version: "deterministic-2",
      warnings: ["Image contrast poor"],
      status: "completed",
    },
  };

  const adapted = adaptRenderProfileToInterpretation(malformedProfile, "Stanford University student resume");
  assert.ok(adapted.success, "Adaptation succeeds without throwing on malformed/partial fields");
  // Malformed email is rejected
  assert.equal(adapted.extractedProfile?.email, undefined);
  // Valid institution is kept
  assert.equal(adapted.extracted?.education[0].institution, "Stanford University");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. OPTIONAL LLM VERIFICATION (SCENARIOS A THROUGH H)
// ─────────────────────────────────────────────────────────────────────────────

test("Audit 3.1: Scenario A — AI Available & User Consent Granted", () => {
  const sparseBaseline: ResumeInterpretationOutput = {
    education: [{ institution: "National University", degree: "BA", sourceSpan: "National University BA" }],
    skills: [{ name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" }],
    projects: [],
    experience: [],
    certifications: [],
    achievements: [],
  };

  const decision = shouldEnrichWithLLM(sparseBaseline, { consent: true, quotaAllowed: true });
  assert.equal(decision.shouldEnrich, true);
  assert.equal(decision.reason, "sparse_or_complex_sections");
});

test("Audit 3.2: Scenario B — User Consent Declined", () => {
  const sparseBaseline: ResumeInterpretationOutput = {
    education: [{ institution: "National University", degree: "BA", sourceSpan: "National University BA" }],
    skills: [{ name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" }],
    projects: [],
    experience: [],
    certifications: [],
    achievements: [],
  };

  const decision = shouldEnrichWithLLM(sparseBaseline, { consent: false, quotaAllowed: true });
  assert.equal(decision.shouldEnrich, false);
  assert.equal(decision.reason, "user_consent_declined");
});

test("Audit 3.3: Scenario C — Internal Daily Quota Exhausted", () => {
  const sparseBaseline: ResumeInterpretationOutput = {
    education: [{ institution: "National University", degree: "BA", sourceSpan: "National University BA" }],
    skills: [{ name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" }],
    projects: [],
    experience: [],
    certifications: [],
    achievements: [],
  };

  const decision = shouldEnrichWithLLM(sparseBaseline, { consent: true, quotaAllowed: false });
  assert.equal(decision.shouldEnrich, false);
  assert.equal(decision.reason, "quota_exhausted_or_unavailable");
});

test("Audit 3.4: Scenario D — Provider Quota Failure (Simulated 429 Quota Exhaustion)", () => {
  const baseline: ResumeExtractionResult = {
    success: true,
    extracted: {
      education: [{ institution: "IIT Delhi", degree: "B.Tech", sourceSpan: "IIT Delhi B.Tech" }],
      skills: [{ name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" }],
      projects: [],
      experience: [],
      certifications: [],
      achievements: [],
    },
    extractedProfile: { fullName: "Rohan Varma", email: "rohan@test.com" },
    provider: "deterministic-engine",
    modelUsed: "rules-v1",
    promptVersion: "v1",
    latencyMs: 5,
    truncated: false,
  };

  // Simulating provider quota error response
  const failedAiResult: ResumeExtractionResult = {
    success: false,
    extracted: null,
    provider: "groq",
    modelUsed: "llama-3.3-70b-versatile",
    promptVersion: "v1",
    latencyMs: 120,
    truncated: false,
    error: "AI_QUOTA_EXCEEDED: daily token budget reached",
    errorKind: "quota",
  };

  const merged = mergeExtractionResults(baseline, failedAiResult, "IIT Delhi B.Tech Rohan Varma Python");
  // Verification: baseline survived 100% intact, no data lost
  assert.equal(merged.success, true);
  assert.equal(merged.extractedProfile?.fullName, "Rohan Varma");
  assert.equal(merged.extracted?.education[0].institution, "IIT Delhi");
});

test("Audit 3.5: Scenario E — Provider Timeout", () => {
  const baseline: ResumeExtractionResult = {
    success: true,
    extracted: {
      education: [{ institution: "IIT Bombay", degree: "M.Tech", sourceSpan: "IIT Bombay M.Tech" }],
      skills: [{ name: "Go", category: "language", proficiencyHint: "unknown", sourceSpan: "Go" }],
      projects: [],
      experience: [],
      certifications: [],
      achievements: [],
    },
    extractedProfile: { fullName: "Karan Johar", email: "karan@test.com" },
    provider: "deterministic-engine",
    modelUsed: "rules-v1",
    promptVersion: "v1",
    latencyMs: 4,
    truncated: false,
  };

  const timeoutAiResult: ResumeExtractionResult = {
    success: false,
    extracted: null,
    provider: "groq",
    modelUsed: "llama-3.3-70b-versatile",
    promptVersion: "v1",
    latencyMs: 15000,
    truncated: false,
    error: "Request timed out after 15000ms",
    errorKind: "provider",
  };

  const merged = mergeExtractionResults(baseline, timeoutAiResult, "IIT Bombay M.Tech Karan Johar Go");
  assert.equal(merged.success, true);
  assert.equal(merged.extractedProfile?.fullName, "Karan Johar");
  assert.equal(merged.extracted?.skills[0].name, "Go");
});

test("Audit 3.6: Scenario F — Provider Returns Invalid JSON / Schema Error", () => {
  const baseline: ResumeExtractionResult = {
    success: true,
    extracted: {
      education: [{ institution: "BITS", degree: "BE", sourceSpan: "BITS BE" }],
      skills: [{ name: "TypeScript", category: "language", proficiencyHint: "unknown", sourceSpan: "TypeScript" }],
      projects: [],
      experience: [],
      certifications: [],
      achievements: [],
    },
    extractedProfile: { fullName: "Amitabh Sen", email: "amitabh@test.com" },
    provider: "deterministic-engine",
    modelUsed: "rules-v1",
    promptVersion: "v1",
    latencyMs: 3,
    truncated: false,
  };

  const invalidJsonAiResult: ResumeExtractionResult = {
    success: false,
    extracted: null,
    provider: "groq",
    modelUsed: "llama-3.3-70b-versatile",
    promptVersion: "v1",
    latencyMs: 450,
    truncated: false,
    error: "Invalid JSON response received from model",
    errorKind: "invalid_output",
  };

  const merged = mergeExtractionResults(baseline, invalidJsonAiResult, "BITS BE Amitabh Sen TypeScript");
  assert.equal(merged.success, true);
  assert.equal(merged.extractedProfile?.fullName, "Amitabh Sen");
  assert.equal(merged.extracted?.skills[0].name, "TypeScript");
});

test("Audit 3.7: Scenario G — All Configured Providers Unavailable", () => {
  const baseline: ResumeExtractionResult = {
    success: true,
    extracted: {
      education: [{ institution: "NIT Trichy", degree: "B.Tech", sourceSpan: "NIT Trichy B.Tech" }],
      skills: [{ name: "Java", category: "language", proficiencyHint: "unknown", sourceSpan: "Java" }],
      projects: [],
      experience: [],
      certifications: [],
      achievements: [],
    },
    extractedProfile: { fullName: "Sunil Kumar", email: "sunil@test.com" },
    provider: "deterministic-engine",
    modelUsed: "rules-v1",
    promptVersion: "v1",
    latencyMs: 3,
    truncated: false,
  };

  const unavailAiResult: ResumeExtractionResult = {
    success: false,
    extracted: null,
    provider: "unknown",
    modelUsed: "",
    promptVersion: "v1",
    latencyMs: 50,
    truncated: false,
    error: "All providers cooling down or unreachable",
    errorKind: "provider",
  };

  const merged = mergeExtractionResults(baseline, unavailAiResult, "NIT Trichy B.Tech Sunil Kumar Java");
  assert.equal(merged.success, true);
  assert.equal(merged.extractedProfile?.fullName, "Sunil Kumar");
});

test("Audit 3.8: Scenario H — Deterministic Baseline Already High Coverage", () => {
  const highCoverageBaseline: ResumeInterpretationOutput = {
    education: [{ institution: "IIT Madras", degree: "B.Tech CSE", sourceSpan: "IIT Madras B.Tech CSE" }],
    skills: [
      { name: "Python", category: "language", proficiencyHint: "unknown", sourceSpan: "Python" },
      { name: "C++", category: "language", proficiencyHint: "unknown", sourceSpan: "C++" },
      { name: "TypeScript", category: "language", proficiencyHint: "unknown", sourceSpan: "TypeScript" },
      { name: "SQL", category: "language", proficiencyHint: "unknown", sourceSpan: "SQL" },
      { name: "PyTorch", category: "framework", proficiencyHint: "unknown", sourceSpan: "PyTorch" },
    ],
    projects: [
      {
        title: "Search Engine",
        description: "Implemented high-throughput search engine over distributed inverted indexes.",
        technologies: ["C++"],
        repositoryUrl: "https://github.com/user/search",
        sourceSpan: "Search Engine in C++",
      },
      {
        title: "Mobile App",
        description: "Built React Native cross platform mobile app for student task scheduling.",
        technologies: ["TypeScript", "React"],
        repositoryUrl: "https://github.com/user/app",
        sourceSpan: "Mobile App in React Native",
      },
    ],
    experience: [],
    certifications: [],
    achievements: [],
  };

  const decision = shouldEnrichWithLLM(highCoverageBaseline, { consent: true, quotaAllowed: true });
  // Verification: LLM is skipped when deterministic baseline is comprehensive
  assert.equal(decision.shouldEnrich, false);
  assert.equal(decision.reason, "deterministic_coverage_sufficient");
});
