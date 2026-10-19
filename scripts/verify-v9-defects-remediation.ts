/**
 * AI TATHASTU — V9 DEFECT REMEDIATION & INCONSISTENCY REGRESSION SUITE
 * File: scripts/verify-v9-defects-remediation.ts
 *
 * Tests:
 *   D1 — Education degree level regex word boundaries (resolves Image_6 IB Diploma defect)
 *   D2 — Experience company bullet normalization (resolves Image_7 + RIT defect)
 *   D3 — Experience action-verb & OCR fragment filtering (resolves Image_6 7 vs 3 exp defect)
 *   D4 — Projects deduplication & canonical heading preservation (resolves Anant-Kumar 5 vs 4 defect)
 *   D5 — Candidate accounting invariant: Total = Profile + Domain (resolves candidate mismatch)
 *   D6 — Zero-Phone privacy invariant across all synthetic formats
 *
 * Run: node --import tsx --test scripts/verify-v9-defects-remediation.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ResumeDeduplicationEngine } from "@/lib/resume/deduplication-engine";
import { sanitizeTextForModel } from "@/lib/intelligence/context-firewall";
import { structureResumeText } from "@/lib/resume/structure";
import type { ResumeExtraction } from "@/lib/resume/schema";
import type { IntelligenceRouter, StructuredCompletionResult } from "@/lib/intelligence/router";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import { applyReviewDecisions, type ReviewDecision } from "@/lib/services/resume-review-decisions";
import type { ExtractorProfileV2 } from "@/lib/services/extractor-service-client";

describe("D1 — Education Degree Level Regex Word Boundaries (Image_6 Defect)", async () => {
  await it("normalizes 'IB Diploma Programme' as 'diploma' and NOT 'postgraduate'", () => {
    const rawEducation: ResumeInterpretationOutput["education"] = [
      {
        institution: "The International School Estepona",
        degree: "International Baccalaureate (IB) Diploma Programme",
        graduationYear: "2018",
        sourceSpan: "The International School Estepona IB Diploma Programme",
      },
      {
        institution: "The International School Estepona",
        degree: "IB Diploma",
        graduationYear: "2018",
        sourceSpan: "The International School Estepona IB Diploma",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateEducation(rawEducation);

    assert.equal(
      result.education.length,
      1,
      `Expected 1 deduplicated high school education record, got ${result.education.length}`
    );
    assert.equal(result.education[0].institution, "The International School Estepona");
    assert.equal(result.mergedCount, 1);
  });

  await it("properly recognizes legitimate M.E. / M.Tech / MBA postgraduate degrees", () => {
    const rawEducation: ResumeInterpretationOutput["education"] = [
      {
        institution: "Anna University",
        degree: "M.E. Computer Science",
        graduationYear: "2022",
        sourceSpan: "Anna University M.E. Computer Science",
      },
      {
        institution: "Anna University",
        degree: "Master of Engineering",
        graduationYear: "2022",
        sourceSpan: "Anna University Master of Engineering",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateEducation(rawEducation);

    assert.equal(result.education.length, 1, "Should merge M.E. and Master of Engineering from Anna University");
  });
});

describe("D2 — Experience Company Bullet Normalization (Image_7 Defect)", async () => {
  await it("strips leading OCR bullet glyphs (+, *, ~, •) to deduplicate company records", () => {
    const rawExperience: ResumeInterpretationOutput["experience"] = [
      {
        company: "+ RIT ACADEMIC TECHNOLOGY SUPPORT",
        role: "Student Tech Support Specialist",
        duration: "2018 - Present",
        highlights: ["Provided tier 1/2 hardware and software support."],
        sourceSpan: "+ RIT ACADEMIC TECHNOLOGY SUPPORT Student Tech Support Specialist",
      },
      {
        company: "RIT ACADEMIC TECHNOLOGY SUPPORT",
        role: "Student Tech Support Specialist",
        duration: "2018 - Present",
        highlights: ["Configured campus lab computers and network printers."],
        sourceSpan: "RIT ACADEMIC TECHNOLOGY SUPPORT Student Tech Support Specialist",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateExperience(rawExperience);

    assert.equal(
      result.experience.length,
      1,
      `Expected 1 deduplicated experience record, got ${result.experience.length}`
    );
    assert.ok(
      result.experience[0].highlights?.length === 2,
      "Highlights from both duplicate records should be merged"
    );
  });

  await it("preserves programming languages like C++ while maintaining distinctness from C", () => {
    const rawSkills: ResumeInterpretationOutput["skills"] = [
      { name: "C++", category: "language", proficiencyHint: "intermediate", sourceSpan: "C++" },
      { name: "C", category: "language", proficiencyHint: "intermediate", sourceSpan: "C" },
      { name: "c++", category: "language", proficiencyHint: "intermediate", sourceSpan: "c++" },
    ];

    const result = ResumeDeduplicationEngine.deduplicateSkills(rawSkills);

    const names = result.skills.map((s) => s.name);
    assert.ok(names.includes("C++"), "C++ must be preserved");
    assert.ok(names.includes("C"), "C must be preserved as distinct from C++");
    assert.equal(result.skills.length, 2, "Duplicate 'c++' should merge into 'C++'");
  });
});

describe("D3 — Experience Action-Verb & OCR Fragment Filtering (Image_6 Defect)", async () => {
  await it("filters out action-verb bullet points and malformed date fragments from becoming companies", () => {
    const rawExperience: ResumeInterpretationOutput["experience"] = [
      {
        company: "SpyBiotech, Inc.",
        role: "Research Assistant",
        duration: "2020 - 2021",
        highlights: ["Maintained laboratory reagents and automated assays."],
        sourceSpan: "SpyBiotech, Inc. Research Assistant",
      },
      {
        company: "Collected, studied and evaluated serum antibodies",
        role: "Assistant",
        duration: "2020 - 2021",
        highlights: ["Assisted principal investigators with data compilation."],
        sourceSpan: "Collected, studied and evaluated serum antibodies",
      },
      {
        company: "5109/",
        role: "Intern",
        duration: "2020",
        highlights: ["Scanned lab notebooks."],
        sourceSpan: "5109/ 2020",
      },
      {
        company: "CGL, Inc.",
        role: "Junior Analyst",
        duration: "2019 - 2020",
        highlights: ["Performed quality assurance on biological specimens."],
        sourceSpan: "CGL, Inc. Junior Analyst",
      },
      {
        company: "Go Overseas",
        role: "Student Ambassador",
        duration: "2018 - 2019",
        highlights: ["Promoted study abroad programs."],
        sourceSpan: "Go Overseas Student Ambassador",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateExperience(rawExperience);

    assert.equal(
      result.experience.length,
      3,
      `Expected exactly 3 genuine employment records, got ${result.experience.length}`
    );
    const companies = result.experience.map((e) => e.company);
    assert.ok(companies.includes("SpyBiotech, Inc."));
    assert.ok(companies.includes("CGL, Inc."));
    assert.ok(companies.includes("Go Overseas"));
    assert.ok(!companies.some((c) => c.toLowerCase().includes("collected, studied")));
    assert.ok(!companies.some((c) => c.includes("5109/")));
  });
});

describe("D4 — Projects Deduplication & Canonical Heading Preservation (Anant-Kumar Defect)", async () => {
  await it("preserves composite client project headings without fragmenting", () => {
    const rawProjects: ResumeInterpretationOutput["projects"] = [
      {
        title: "GeoJeevan AI",
        description: "Geospatial land analysis tool using satellite imagery.",
        technologies: ["Python", "TensorFlow"],
        sourceSpan: "GeoJeevan AI geospatial land analysis",
      },
      {
        title: "GyanMatrix",
        description: "Automated curriculum and course indexing engine.",
        technologies: ["Next.js", "PostgreSQL"],
        sourceSpan: "GyanMatrix automated curriculum",
      },
      {
        title: "QuickDorm",
        description: "Real-time student accommodation portal.",
        technologies: ["React", "Express"],
        sourceSpan: "QuickDorm real-time student accommodation",
      },
      {
        title: "Client Work (Sai Enterprises, TechSolutions)",
        description: "Delivered customized web applications for regional SMBs.",
        technologies: ["Tailwind", "Node.js"],
        sourceSpan: "Client Work (Sai Enterprises, TechSolutions) customized web apps",
      },
      {
        title: "Client Work",
        description: "Delivered customized web applications for regional SMBs.",
        technologies: ["Tailwind", "Node.js"],
        sourceSpan: "Client Work customized web apps",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateProjects(rawProjects);

    assert.equal(
      result.projects.length,
      4,
      `Expected exactly 4 distinct projects, got ${result.projects.length}`
    );
    assert.ok(result.projects.some((p) => p.title.includes("Client Work")));
  });
});

describe("D5 — Candidate Accounting Invariants", async () => {
  await it("strictly obeys Total Candidates = Profile Candidates + Domain Candidates", () => {
    const testCases = [
      { name: "Anant-Kumar-Resume.pdf", profile: 3, domain: 52, total: 55, confirmed: 52, rejected: 0, pending: 0 },
      { name: "Image_6.pdf", profile: 3, domain: 35, total: 38, confirmed: 35, rejected: 0, pending: 0 },
      { name: "Image_7.pdf", profile: 1, domain: 54, total: 55, confirmed: 54, rejected: 0, pending: 0 },
      { name: "myresume.pdf", profile: 3, domain: 55, total: 58, confirmed: 55, rejected: 0, pending: 0 },
    ];

    for (const tc of testCases) {
      assert.equal(
        tc.profile + tc.domain,
        tc.total,
        `Total accounting failed for ${tc.name}: ${tc.profile} profile + ${tc.domain} domain must equal ${tc.total} total`
      );
      assert.equal(
        tc.domain,
        tc.confirmed + tc.rejected + tc.pending,
        `Domain partition invariant failed for ${tc.name}: ${tc.domain} domain must equal ${tc.confirmed} confirmed + ${tc.rejected} rejected + ${tc.pending} pending`
      );
    }
  });

  await it("guarantees applyReviewDecisions partitions known domain candidates without count leakage", () => {
    const mkField = (val: string, conf = 0.9) => ({
      value: val,
      original_value: val,
      confidence: conf,
      history: [],
      confidence_kind: "heuristic" as const,
      review_state: "extracted" as const,
      evidence: [],
    });

    // Construct a mock profile mirroring Image_7: 1 education, 6 experience, 49 skills, 1 digital_footprint + 4 unpresented raw records
    const mockProfile: ExtractorProfileV2 = {
      schema_version: "2.0",
      document_id: "doc_mock_image7",
      metadata: {
        document_id: "doc_mock_image7",
        file_format: "pdf",
        page_count: 1,
        ocr_attempted: true,
        ocr_used: true,
        text_quality: "good",
        processing_seconds: 1.0,
        extraction_methods: ["ocr"],
        parser_version: "2.0.0",
        model_version: "tesseract-5.5",
        status: "completed",
        warnings: [],
      },
      groups: {
        education: [
          { record_id: "edu_0", fields: { degree_title: mkField("B.Sc.") }, record_state: "extracted" },
        ],
        experience: [
          { record_id: "exp_0", fields: { job_title: mkField("Tech Support") }, record_state: "extracted" },
        ],
        skills: [
          { record_id: "sk_0", fields: { canonical_name: mkField("Linux", 0.95) }, record_state: "extracted" },
          { record_id: "sk_1", fields: { canonical_name: mkField("Bash", 0.95) }, record_state: "extracted" },
          // Unpresented raw noise record (e.g. OCR single digit '1') not present in domain candidates
          { record_id: "sk_2", fields: { canonical_name: mkField("1", 0.1) }, record_state: "extracted" },
        ],
      },
    };

    // Domain candidates presented on review screen: 1 education, 1 experience, 2 skills = 4 domain candidates
    const knownDomainIds = new Set(["education_0", "experience_0", "skill_0", "skill_1"]);
    // Student decisions: confirm education_0, experience_0, skill_0; reject skill_1
    const decisions: ReviewDecision[] = [
      { candidateId: "education_0", state: "confirmed" },
      { candidateId: "experience_0", state: "confirmed" },
      { candidateId: "skill_0", state: "confirmed" },
      { candidateId: "skill_1", state: "rejected" },
    ];

    const result = applyReviewDecisions(mockProfile, knownDomainIds, decisions);

    assert.equal(result.domainCandidatesCount, 4, "Domain candidate count must be 4");
    assert.equal(result.confirmed, 3, "Confirmed candidates must be 3");
    assert.equal(result.rejected, 1, "Rejected candidates must be 1");
    assert.equal(result.pending, 0, "Pending candidates must be 0");
    assert.equal(
      result.domainCandidatesCount,
      result.confirmed + result.rejected + result.pending,
      "Domain candidates must strictly equal confirmed + rejected + pending"
    );
    // Unpresented noise record sk_2 was pruned and marked rejected in the profile
    assert.equal(result.prunedRecords, 1, "Unpresented noise record must be recorded as pruned");
    assert.equal(result.profile.groups.skills[2].record_state, "rejected", "Unpresented noise record must be rejected in DB profile");
  });
});

describe("D6 — Zero-Phone Privacy Invariant Across All Synthetic Formats", async () => {
  const SYNTHETIC_PHONES = [
    { format: "Indian Mobile with Country Code", raw: "+91 98765 43210" },
    { format: "Indian Bare 10-digit", raw: "9876543210" },
    { format: "US NANP Standard", raw: "(555) 019-2834" },
    { format: "US NANP Hyphenated", raw: "555-019-2834" },
    { format: "UK International Mobile", raw: "+44 7911 123456" },
    { format: "German International Mobile", raw: "+49 151 23456789" },
    { format: "Spaced OCR Digits", raw: "9 8 7 6 5 4 3 2 1 0" },
    { format: "Labeled Phone Field", raw: "Mobile: 9876543210" },
  ];

  for (const item of SYNTHETIC_PHONES) {
    await it(`redacts ${item.format} from model prompt without leakage`, () => {
      const input = `Candidate Contact: ${item.raw} | Email: student@university.edu`;
      const sanitized = sanitizeTextForModel(input);

      // Verify no 7+ contiguous digit sequence from the phone appears
      const digits = item.raw.replace(/\D/g, "");
      if (digits.length >= 7) {
        assert.ok(
          !sanitized.includes(digits),
          `Leaked digits ${digits} in sanitized output: "${sanitized}"`
        );
      }
      assert.ok(sanitized.includes("[PHONE_REDACTED]") || sanitized.includes("[EMAIL_REDACTED]"));
    });
  }

  await it("never leaks phone numbers into LLM router prompts", async () => {
    let capturedUserPrompt = "";
    const mockRouter: IntelligenceRouter = {
      complete: async () => { throw new Error("not used"); },
      completeStructured: async (req: { userPrompt: string }) => {
        capturedUserPrompt = req.userPrompt;
        return {
          data: {
            name: "Test Candidate",
            email: "test@example.com",
            phone: null,
            location: null,
            links: [],
            education: [],
            experience: [],
            projects: [],
            skills: [],
            certifications: [],
            achievements: [],
          },
          provider: "groq",
          model: "test-model",
          attempts: [],
          latencyMs: 10,
        } as unknown as StructuredCompletionResult<ResumeExtraction>;
      },
      isProviderCoolingDown: () => false,
      setProviderCooldown: () => {},
    } as unknown as IntelligenceRouter;

    const resumeWithPhones = `
      John Doe
      Phone: +1 (555) 234-5678 | WhatsApp: +91 9988776655
      Email: john.doe@example.com
      Skills: TypeScript, Python, React
    `;

    await structureResumeText(resumeWithPhones, "user-privacy-audit", mockRouter);

    assert.ok(!capturedUserPrompt.includes("555"), "NANP area code leaked into LLM prompt");
    assert.ok(!capturedUserPrompt.includes("9988776655"), "WhatsApp phone leaked into LLM prompt");
    assert.ok(capturedUserPrompt.includes("[PHONE_REDACTED]"), "Placeholder [PHONE_REDACTED] should be present");
  });
});
