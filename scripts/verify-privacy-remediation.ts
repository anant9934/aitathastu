/**
 * AI TATHASTU — PRIVACY REMEDIATION & FINAL RELEASE GATE
 * Regression test: verify-privacy-remediation.ts
 *
 * Tests:
 *   P1  – Phone-redaction enforced at LLM choke-point (structure.ts)
 *   P2  – Education deduplication correctness (oneIsOther / fieldOfStudy fill)
 *   P3  – Link URL deduplication / canonicalization
 *   P1b – Pipeline log safety
 *
 * Run: node --import tsx --test scripts/verify-privacy-remediation.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTextForModel } from "@/lib/intelligence/context-firewall";
import { ResumeDeduplicationEngine } from "@/lib/resume/deduplication-engine";
import { structureResumeText } from "@/lib/resume/structure";
import { sanitizeResumeExtraction } from "@/lib/services/resume-extraction-service";
import type { IntelligenceRouter, StructuredCompletionResult } from "@/lib/intelligence/router";
import type { ResumeExtraction } from "@/lib/resume/schema";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// P1 — ZERO-PHONE IN LLM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

const PHONES = {
  indian_mobile:       "9508108025",
  indian_bare:         "8881234567",
  e164_us:             "+18005550199",
  nanp_parenthetical:  "(312) 555-0171",
  eu_mobile:           "+44 7700 900100",
  de_mobile:           "+49 151 88883333",
  ocr_spaced:          "9 5 0 8 1 0 8 0 2 5",
  labeled_whatsapp:    "WhatsApp: 9876543210",
  labeled_tel:         "Tel: 011-22334455",
  labeled_cell:        "cell: +91-88-1234-5678",
};

function buildResumeWithPhones(): string {
  return [
    "Rahul Verma",
    `contact@example-privacy.dev | ${PHONES.indian_mobile} | ${PHONES.e164_us}`,
    PHONES.labeled_whatsapp,
    PHONES.labeled_tel,
    PHONES.labeled_cell,
    `Call: ${PHONES.nanp_parenthetical}`,
    `EU: ${PHONES.eu_mobile}`,
    `DE: ${PHONES.de_mobile}`,
    `OCR: ${PHONES.ocr_spaced}`,
    "",
    "EDUCATION",
    "Lovely Professional University | 2020 - 2024",
    "B.Tech in Computer Science | CGPA: 8.75 / 10",
    "",
    "EXPERIENCE",
    "Alpha Systems | Jul 2023 - Present",
    "Software Engineer",
    "- Scaled throughput by 45% across 12 node clusters.",
    "- Revenue improved by 3L+ with 99.9% uptime.",
    "",
    "SKILLS: Python, TypeScript, React, PostgreSQL",
  ].join("\n");
}

function makeSpyRouter(): { router: IntelligenceRouter; capturedPrompts: string[] } {
  const capturedPrompts: string[] = [];
  const stub: ResumeExtraction = {
    name: "Rahul Verma", email: "contact@example-privacy.dev", phone: null, location: null,
    links: [], education: [], experience: [], projects: [], skills: [], certifications: [], achievements: [],
  };
  const router = {
    complete: async () => { throw new Error("not used"); },
    completeStructured: async (request: { userPrompt: string }) => {
      capturedPrompts.push(request.userPrompt);
      return {
        data: stub, provider: "groq" as const, model: "spy-model",
        attempts: [{ provider: "groq" as const, outcome: "ok" as const, ms: 0 }],
        latencyMs: 0,
      } as unknown as StructuredCompletionResult<ResumeExtraction>;
    },
    isProviderCoolingDown: () => false,
    setProviderCooldown: () => {},
  } as unknown as IntelligenceRouter;
  return { router, capturedPrompts };
}

describe("P1 – Zero-phone guarantee in LLM prompts", async () => {
  await it("sanitizeTextForModel removes labeled phone patterns", () => {
    const text = `Contact: ${PHONES.indian_mobile}\n${PHONES.labeled_whatsapp}\n${PHONES.labeled_tel}`;
    const out = sanitizeTextForModel(text);
    assert.ok(!out.includes("9508108025"), `Indian mobile leaked: ${out}`);
    assert.ok(!out.includes("9876543210"), `WhatsApp leaked: ${out}`);
    assert.ok(!out.includes("22334455"),   `Tel number leaked: ${out}`);
    assert.ok(out.includes("[PHONE_REDACTED]"), "Placeholder absent");
  });

  await it("sanitizeTextForModel removes bare 10-digit Indian mobiles", () => {
    const out = sanitizeTextForModel(`Call me at ${PHONES.indian_bare} please`);
    assert.ok(!out.includes("8881234567"), `Bare Indian mobile leaked: ${out}`);
  });

  await it("sanitizeTextForModel removes NANP numbers", () => {
    const out = sanitizeTextForModel(`Phone: ${PHONES.nanp_parenthetical}`);
    assert.ok(!out.includes("555-0171"), `NANP leaked: ${out}`);
  });

  await it("sanitizeTextForModel removes EU/DE international numbers", () => {
    const uk = sanitizeTextForModel(`Contact: ${PHONES.eu_mobile}`);
    const de = sanitizeTextForModel(`Kontakt: ${PHONES.de_mobile}`);
    assert.ok(!uk.includes("7700"), `UK mobile leaked: ${uk}`);
    assert.ok(!de.includes("88883333"), `DE mobile leaked: ${de}`);
  });

  await it("sanitizeTextForModel does NOT damage CGPA, dates, metrics", () => {
    const text = "CGPA: 8.93 / 10 | 2022 - 2026 | 10000+ req/sec | 99.9% uptime | 3 nodes";
    const out  = sanitizeTextForModel(text);
    assert.ok(out.includes("8.93"),  `CGPA damaged: ${out}`);
    assert.ok(out.includes("2022"),  `Year damaged: ${out}`);
    assert.ok(out.includes("10000"), `Metric damaged: ${out}`);
    assert.ok(out.includes("99.9%"), `Percentage damaged: ${out}`);
  });

  await it("structureResumeText does NOT pass phone digits in userPrompt (all formats)", async () => {
    const rawText = buildResumeWithPhones();
    const { router, capturedPrompts } = makeSpyRouter();
    await structureResumeText(rawText, "test-person-001", router);
    assert.equal(capturedPrompts.length, 1, "Expected exactly one LLM call");
    const prompt = capturedPrompts[0];
    for (const [label, phone] of Object.entries(PHONES)) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length >= 8) {
        assert.ok(
          !prompt.includes(digits),
          `Phone "${label}" (${digits}) leaked into LLM userPrompt.\nPrompt excerpt: ${prompt.slice(0, 500)}`
        );
      }
    }
  });

  await it("structureResumeText preserves CGPA, years, metrics in sanitized prompt", async () => {
    const rawText = buildResumeWithPhones();
    const { router, capturedPrompts } = makeSpyRouter();
    await structureResumeText(rawText, "test-person-002", router);
    const prompt = capturedPrompts[0];
    assert.ok(prompt.includes("8.75"),  `CGPA missing: ${prompt.slice(0, 400)}`);
    assert.ok(prompt.includes("2020") || prompt.includes("2024"), "Year missing from prompt");
    assert.ok(prompt.includes("45%"),   `Metric missing from prompt`);
  });

  await it("OCR-spaced phone token is redacted", () => {
    // "9 5 0 8 1 0 8 0 2 5" - spaced digits should not survive as-is
    const text = `OCR phone: ${PHONES.ocr_spaced}`;
    const out  = sanitizeTextForModel(text);
    const spacedDigits = "9508108025".split("").join(" ");
    assert.ok(!out.includes(spacedDigits), `OCR-spaced phone survived: ${out}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2 — EDUCATION DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

function edu(overrides: Partial<ResumeInterpretationOutput["education"][number]>): ResumeInterpretationOutput["education"][number] {
  return {
    institution: "Test University", degree: "B.Tech",
    fieldOfStudy: undefined, gpa: undefined, percentage: undefined,
    startDate: undefined, endDate: undefined, graduationYear: undefined,
    academicLevel: "undergraduate", sourceSpan: "Test University",
    ...overrides,
  };
}

describe("P2 – Education deduplication correctness", async () => {
  await it("identical institution+level records merge into one", () => {
    const result = ResumeDeduplicationEngine.deduplicateEducation([
      edu({ institution: "LPU", degree: "B.Tech", academicLevel: "undergraduate" }),
      edu({ institution: "LPU", degree: "B.Tech", academicLevel: "undergraduate" }),
    ]);
    assert.equal(result.education.length, 1, "Should merge into 1");
    assert.equal(result.mergedCount,      1);
  });

  await it("missing fieldOfStudy is filled when enriched record provides it", () => {
    const result = ResumeDeduplicationEngine.deduplicateEducation([
      edu({ institution: "LPU", degree: "B.Tech", fieldOfStudy: undefined, academicLevel: "undergraduate" }),
      edu({ institution: "LPU", degree: "B.Tech", fieldOfStudy: "Artificial Intelligence", academicLevel: "undergraduate" }),
    ]);
    assert.equal(result.education.length, 1);
    assert.equal(result.education[0].fieldOfStudy, "Artificial Intelligence",
      "fieldOfStudy must be filled from enriched record");
  });

  await it("different degree levels from same institution remain separate", () => {
    const result = ResumeDeduplicationEngine.deduplicateEducation([
      edu({ institution: "IIT Delhi", degree: "B.Tech",  academicLevel: "undergraduate" }),
      edu({ institution: "IIT Delhi", degree: "M.Tech",  academicLevel: "postgraduate" }),
    ]);
    assert.equal(result.education.length, 2, "B.Tech and M.Tech must stay separate");
    assert.equal(result.mergedCount, 0);
  });

  await it("B.Tech and Senior Secondary (Class XII) from same org remain separate", () => {
    const result = ResumeDeduplicationEngine.deduplicateEducation([
      edu({ institution: "CBSE Board", degree: "B.Tech",    academicLevel: "undergraduate" }),
      edu({ institution: "CBSE Board", degree: "Class XII", academicLevel: "other" }),
    ]);
    assert.equal(result.education.length, 2, "B.Tech vs Senior Secondary must stay separate");
    assert.equal(result.mergedCount, 0);
  });

  await it("oneIsOther: LLM 'other'-level record enriches deterministic undergraduate", () => {
    const deterministic = edu({
      institution: "Manipal University", degree: "B.Tech Computer Science",
      academicLevel: "undergraduate", fieldOfStudy: undefined,
    });
    const llm = edu({
      institution: "Manipal University", degree: "",
      academicLevel: undefined as unknown as "undergraduate",
      fieldOfStudy: "Computer Science and Engineering",
    });
    const result = ResumeDeduplicationEngine.deduplicateEducation([deterministic, llm]);
    assert.equal(result.education.length, 1, "Should merge since one level is effectively 'other'");
    assert.equal(result.mergedCount, 1);
    assert.equal(result.education[0].fieldOfStudy, "Computer Science and Engineering",
      "fieldOfStudy must be enriched from LLM record");
  });

  await it("source GPA is preserved when LLM record has none", () => {
    const result = ResumeDeduplicationEngine.deduplicateEducation([
      edu({ institution: "BITS Pilani", degree: "B.E. CS", academicLevel: "undergraduate", gpa: "9.1" }),
      edu({ institution: "BITS Pilani", degree: "Bachelor of Engineering in Electronics", academicLevel: "undergraduate" }),
    ]);
    assert.equal(result.education.length, 1);
    assert.equal(result.education[0].gpa, "9.1", "Source GPA must survive the merge");
  });

  await it("gpa and percentage are filled from the richer record", () => {
    const result = ResumeDeduplicationEngine.deduplicateEducation([
      edu({ institution: "Anna University", degree: "B.E.", academicLevel: "undergraduate" }),
      edu({ institution: "Anna University", degree: "B.E.", academicLevel: "undergraduate", gpa: "8.5", percentage: "85%" }),
    ]);
    assert.equal(result.education.length, 1);
    assert.equal(result.education[0].gpa,        "8.5");
    assert.equal(result.education[0].percentage,  "85%");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 — LINK URL DEDUPLICATION & CANONICALIZATION
// ─────────────────────────────────────────────────────────────────────────────

function makeLinks(links: Array<{ url: string; type: string }>): ResumeExtraction {
  return {
    name: "T", email: "t@t.com", phone: null, location: null,
    links: links.map((l) => ({ url: l.url, type: l.type as "github" })),
    education: [], experience: [], projects: [], skills: [], certifications: [], achievements: [],
  };
}

describe("P3 – Link URL canonicalization and deduplication", async () => {
  await it("www. and non-www variants of same URL are deduplicated", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "https://github.com/johndoe",     type: "github" },
      { url: "https://www.github.com/johndoe", type: "github" },
    ]));
    assert.equal(links.length, 1, `www. not deduped: ${JSON.stringify(links)}`);
  });

  await it("trailing slashes are normalized away", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "https://linkedin.com/in/johndoe",  type: "linkedin" },
      { url: "https://linkedin.com/in/johndoe/", type: "linkedin" },
    ]));
    assert.equal(links.length, 1, `Trailing slash not normalized: ${JSON.stringify(links)}`);
  });

  await it("distinct profiles on same platform are preserved", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "https://github.com/alice", type: "github" },
      { url: "https://github.com/bob",   type: "github" },
    ]));
    assert.equal(links.length, 2, `Distinct profiles merged: ${JSON.stringify(links)}`);
  });

  await it("query parameters are preserved (different queries = distinct resources)", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "https://example.com/profile?tab=repos",  type: "portfolio" },
      { url: "https://example.com/profile?tab=stars",  type: "portfolio" },
    ]));
    assert.equal(links.length, 2, `Query-param variants collapsed: ${JSON.stringify(links)}`);
  });

  await it("email-like strings and mailto: are rejected", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "mailto:user@example.com", type: "other"  },
      { url: "user@github.com",         type: "github" },
    ]));
    assert.equal(links.length, 0, `Email/mailto not rejected: ${JSON.stringify(links)}`);
  });

  await it("domain classification overrides wrong user-supplied type", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "https://github.com/testuser", type: "portfolio" },
    ]));
    assert.equal(links[0]?.type, "github", `Type not corrected: ${JSON.stringify(links)}`);
  });

  await it("StackOverflow URL is classified as stackoverflow", () => {
    const { links } = sanitizeResumeExtraction(makeLinks([
      { url: "https://stackoverflow.com/users/1234/johndoe", type: "other" },
    ]));
    assert.equal(links[0]?.type, "stackoverflow", `SO type wrong: ${JSON.stringify(links)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P1b — AUDIT LOG SAFETY
// ─────────────────────────────────────────────────────────────────────────────
describe("P1b – Pipeline log safety: phones not in error messages", async () => {
  await it("sanitized output is safe to embed in error messages", () => {
    const raw    = "Applicant\nPhone: 9508108025\nB.Tech CSE\n2020-2024";
    const out    = sanitizeTextForModel(raw);
    const errMsg = `Extraction failed: ${out}`;
    assert.ok(!out.includes("9508108025"),    `Phone in sanitized output: ${out}`);
    assert.ok(!errMsg.includes("9508108025"), `Phone in error message: ${errMsg}`);
  });
});
