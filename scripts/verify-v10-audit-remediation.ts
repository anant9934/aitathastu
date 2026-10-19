import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ResumeDeduplicationEngine } from "@/lib/resume/deduplication-engine";
import { discoverFootprintsFromResume } from "@/lib/services/digital-footprint-discovery";
import { resumeCandidates } from "@/lib/services/resume-review-service";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";

describe("V10 Audit Defect Remediation Suite", async () => {
  await it("Fix A: Deduplicates certifications with OCR bullet glyphs and trailing issuer punctuation", () => {
    const rawCerts: ResumeInterpretationOutput["certifications"] = [
      {
        name: "® Introduction to Artificial Intelligence",
        issuer: "Infosys ‘",
        year: "2024",
        sourceSpan: "Introduction to Artificial Intelligence",
      },
      {
        name: "Introduction to Artificial Intelligence",
        issuer: "Infosys",
        year: "2024",
        sourceSpan: "Introduction to Artificial Intelligence",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateCertifications(rawCerts);
    assert.equal(result.certifications.length, 1, "Duplicate Infosys certification must merge into exactly one record");
    assert.equal(result.certifications[0].name, "Introduction to Artificial Intelligence");
    assert.equal(result.certifications[0].issuer, "Infosys");
    assert.equal(result.mergedCount, 1);
  });

  await it("Fix B: Deduplicates achievements with leading OCR bullets (©)", () => {
    const rawAchs: ResumeInterpretationOutput["achievements"] = [
      {
        title: "© Secured 89% in Class XII (Senior Secondary)",
        category: "award",
        description: "",
        sourceSpan: "Secured 89% in Class XII",
      },
      {
        title: "Secured 89% in Class XII (Senior Secondary)",
        category: "award",
        description: "",
        sourceSpan: "Secured 89% in Class XII",
      },
      {
        title: "© Contributed to 6L+ lines of code across open source",
        category: "award",
        description: "",
        sourceSpan: "Contributed to 6L+ lines of code",
      },
      {
        title: "Contributed to 6L+ lines of code across open source",
        category: "award",
        description: "",
        sourceSpan: "Contributed to 6L+ lines of code",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateAchievements(rawAchs);
    assert.equal(result.achievements.length, 2, "Duplicate achievements with OCR bullets must merge into 2 clean records");
    assert.equal(result.achievements[0].title, "Secured 89% in Class XII (Senior Secondary)");
    assert.equal(result.achievements[1].title, "Contributed to 6L+ lines of code across open source");
    assert.equal(result.mergedCount, 2);
  });

  await it("Fix C1: Cleans trailing date tokens and quotes from company names in experience deduplication", () => {
    const rawExp: ResumeInterpretationOutput["experience"] = [
      {
        company: "Study LPU ‘Apr",
        role: "Chief Operating Officer / Co-Founder",
        duration: "Apr 2026 - Present",
        startDate: "Apr 2026",
        endDate: "Present",
        highlights: ["Led academic operations."],
        sourceSpan: "Study LPU ‘Apr",
      },
      {
        company: "Study LPU",
        role: "Chief Operating Officer / Co-Founder",
        duration: "Apr 2026 - Present",
        startDate: "Apr 2026",
        endDate: "Present",
        highlights: ["Scaled platform to learners."],
        sourceSpan: "Study LPU",
      },
      {
        company: "Founders Verbinden ‘Aug",
        role: "Vice President / Co-Founder",
        duration: "Aug 2025 - Present",
        startDate: "Aug 2025",
        endDate: "Present",
        highlights: ["Ecosystem leadership."],
        sourceSpan: "Founders Verbinden ‘Aug",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateExperience(rawExp);
    assert.equal(result.experience.length, 2, "Study LPU duplicate role must merge into one clean record");
    assert.equal(result.experience[0].company, "Study LPU");
    assert.equal(result.experience[1].company, "Founders Verbinden");
  });

  await it("Fix C2: Merges corrupted OCR continuation roles for same company (Image_7 Zipcar & Austin Michael)", () => {
    const rawExp: ResumeInterpretationOutput["experience"] = [
      {
        company: "ZIPCAR SEATTLE",
        role: "Marketing Street Team Associate",
        duration: "2007 - 2009",
        startDate: "2007",
        endDate: "2009",
        highlights: ["Promoted car sharing brand."],
        sourceSpan: "Zipcar Seattle",
      },
      {
        company: "ZIPCAR SEATTLE",
        role: "Marketing Street Tear | vate",
        duration: "2010 - 2010",
        startDate: "2010",
        endDate: "2010",
        highlights: ["Event marketing."],
        sourceSpan: "Zipcar Seattle",
      },
      {
        company: "AUSTIN MICHAEL INTERNET SOLUTIONS",
        role: "Web & Graphic Designer",
        duration: "2006 - 2007",
        startDate: "2006",
        endDate: "2007",
        highlights: ["Designed brand collateral."],
        sourceSpan: "Austin Michael",
      },
      {
        company: "AUSTIN MICHAEL INTERNET SOLUTIONS",
        role: "WebIntegrated&GraphicSQLandDesignerPHPtocreate custom fontendsand backendsfor",
        duration: "2006 - 2007",
        startDate: "2006",
        endDate: "2007",
        highlights: ["Engineered SQL and PHP web backends."],
        sourceSpan: "Austin Michael",
      },
    ];

    const result = ResumeDeduplicationEngine.deduplicateExperience(rawExp);
    assert.equal(result.experience.length, 2, "Corrupted OCR roles under same company must merge into canonical roles");
    assert.equal(result.experience[0].role, "Marketing Street Team Associate");
    assert.equal(result.experience[1].role, "Web & Graphic Designer");
  });

  await it("Fix C3: Prevents experience founder roles from duplicating into separate leadership review cards", () => {
    const interpretation: ResumeInterpretationOutput = {
      education: [],
      skills: [],
      certifications: [],
      achievements: [],
      projects: [],
      experience: [
        {
          company: "Study LPU ‘Apr",
          role: "Chief Operating Officer / Co-Founder",
          sourceSpan: "Study LPU",
        },
        {
          company: "Mangalkit",
          role: "Chief Operating Officer / Co-Founder",
          sourceSpan: "Mangalkit",
        },
        {
          company: "Founders Verbinden ‘Aug",
          role: "Vice President / Co-Founder",
          sourceSpan: "Founders Verbinden",
        },
      ],
      leadership: [
        {
          organization: "Study LPU",
          role: "Chief Operating Officer / Co-Founder",
          type: "leadership",
          sourceSpan: "Study LPU",
        },
        {
          organization: "Mangalkit",
          role: "Chief Operating Officer / Co-Founder",
          type: "leadership",
          sourceSpan: "Mangalkit",
        },
        {
          organization: "Founders Verbinden",
          role: "Vice President / Co-Founder",
          type: "leadership",
          sourceSpan: "Founders Verbinden",
        },
        {
          organization: "Student Academic Council",
          role: "Council President",
          type: "leadership",
          sourceSpan: "Student Academic Council",
        },
      ],
    };

    const candidates = resumeCandidates(interpretation);
    const expCandidates = candidates.filter((c) => c.category === "experience");
    const leadCandidates = candidates.filter((c) => c.category === "leadership");

    assert.equal(expCandidates.length, 3, "All 3 experience roles must be reviewable");
    assert.equal(leadCandidates.length, 1, "Only genuinely distinct non-experience leadership (Council President) must appear in leadership");
    assert.ok(leadCandidates[0].value.includes("Council President"));
  });

  await it("Fix F: Correctly extracts GitHub handle when OCR contains 'github, com' artifact", () => {
    const text = "Contact Information\nEmail: shivam@example.com\nGitHub: github, com/shiviil5165,\nLinkedIn: linkedin.com/in/shivam";
    const footprints = discoverFootprintsFromResume({
      text,
      hyperlinks: [],
    });

    const gh = footprints.find((fp) => fp.provider === "github");
    assert.ok(gh, "GitHub footprint must be discovered");
    assert.equal(gh.normalizedUrl, "https://github.com/shiviil5165", "URL must normalize to candidate profile rather than https://github.com/github");
    assert.equal(gh.candidateUsername, "shiviil5165");
  });

  await it("Fix F2: Filters out platform name false positives from labeled handles", () => {
    const text = "Profiles:\nGitHub: github\nLinkedIn: linkedin\nLeetCode: shiviil5165";
    const footprints = discoverFootprintsFromResume({
      text,
      hyperlinks: [],
    });

    const gh = footprints.find((fp) => fp.provider === "github");
    assert.equal(gh, undefined, "Platform name 'github' must never be accepted as a candidate handle");
    const lc = footprints.find((fp) => fp.provider === "leetcode");
    assert.ok(lc, "Legitimate handle must be discovered");
    assert.equal(lc.candidateUsername, "shiviil5165");
  });
});
