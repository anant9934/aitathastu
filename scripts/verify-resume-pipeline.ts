/**
 * Offline checks for the resume pipeline (no LLM, no network):
 * layout reconstruction, output sanity pass, grounding, and onboarding skip-ahead.
 * Run: npm run test:resume-pipeline
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { reconstructReadingOrder, type LayoutSpan } from "../lib/resume/layout";
import { sanitizeResumeExtraction, toInterpretation, toExtractedProfile } from "../lib/services/resume-extraction-service";
import type { ResumeExtraction } from "../lib/resume/schema";
import { nextOnboardingScreen, resumeCoveredScreens } from "../lib/onboarding-resume-coverage";

/** Positions a run of text on a 600x800 page; width ~5.5pt per char at 10pt. */
function at(x: number, y: number, text: string, size = 10): LayoutSpan {
  return { x0: x, x1: x + text.length * size * 0.55, y0: y - size * 0.8, y1: y + size * 0.2, text };
}

test("two-column page reads banner, then sidebar, then main column", () => {
  const spans: LayoutSpan[] = [
    at(40, 50, "PRIYA RAMAN", 22),
    at(40, 110, "CONTACT", 12), at(40, 128, "priya@mail.com"), at(40, 142, "Pune, Maharashtra"), at(40, 156, "GitHub"),
    at(40, 182, "SKILLS", 12), at(40, 200, "• Python, PyTorch"), at(40, 214, "• SQL, Docker"),
    at(220, 110, "EXPERIENCE", 12),
    at(220, 128, "Senior ML Engineer"), at(470, 128, "Jan 2023 – Present"),
    at(220, 142, "Zeta Analytics"), at(490, 142, "Bengaluru, India"),
    at(226, 156, "● Built a real-time fraud model serving 4M requests per day"),
    at(226, 170, "● Cut inference latency 38% with ONNX quantisation and batching"),
    at(220, 196, "PROJECTS", 12), at(220, 214, "DocuSeek RAG search engine over two million PDFs"),
  ];
  const text = reconstructReadingOrder([{ page: 1, width: 600, height: 800, spans, links: [{ url: "https://github.com/priya", ...at(40, 156, "GitHub") }] }]);
  const lines = text.split("\n").filter(Boolean);
  const idx = (s: string) => lines.findIndex((l) => l.includes(s));

  assert.equal(lines[0], "PRIYA RAMAN");
  assert.ok(idx("CONTACT") < idx("SKILLS") && idx("SKILLS") < idx("EXPERIENCE"), "sidebar is read before the main column");
  // Right-aligned date/location stay separate cells, never merged into the name.
  assert.ok(lines.includes("Zeta Analytics | Bengaluru, India"), text);
  assert.ok(lines.includes("Senior ML Engineer | Jan 2023 – Present"), text);
  assert.ok(lines.includes("- Python, PyTorch"), "bullet glyph normalised");
  assert.ok(lines.includes("GitHub <https://github.com/priya>"), "link written next to its anchor");
});

test("right-aligned dates on a single-column page are not treated as a column", () => {
  const spans: LayoutSpan[] = [];
  for (let i = 0; i < 8; i++) {
    spans.push(at(40, 60 + i * 30, `Company number ${i} doing interesting things`), at(470, 60 + i * 30, "2020 – 2021"));
    spans.push(at(46, 74 + i * 30, `- Shipped feature ${i} for many customers across the region`));
  }
  const lines = reconstructReadingOrder([{ page: 1, width: 600, height: 800, spans }]).split("\n");
  assert.equal(lines[0], "Company number 0 doing interesting things | 2020 – 2021");
  assert.equal(lines[1], "- Shipped feature 0 for many customers across the region");
});

test("OCR bullet misreads and noise rows are cleaned", () => {
  const spans = [at(40, 50, "o Katana Vault: Built a password manager"), at(40, 64, ","), at(40, 78, "° : Managed sponsorships")];
  assert.equal(reconstructReadingOrder([{ page: 1, width: 600, height: 800, spans }]), "- Katana Vault: Built a password manager\n- Managed sponsorships");
});

const raw: ResumeExtraction = {
  name: " Kaustubh Shukla ",
  email: "mailto:k@x.com",
  phone: "+91 8317028417",
  location: "Jalandhar, Punjab, India",
  links: [
    { type: "portfolio", url: "github.com/kaustubh" },
    { type: "other", url: "https://www.linkedin.com/in/k" },
    { type: "github", url: "https://github.com/kaustubh/Pathified" },
  ],
  education: [{ institution: "Lovely Professional University", degree: "B.Tech", field_of_study: "Computer Science & Engineering", level: "undergraduate", start_date: "2025", end_date: "2029", grade: "CGPA: 8.2 / 10" }],
  experience: [{ company: "Real Gods eSports", role: "Organisation Manager", type: "leadership", location: "Remote, India", start_date: "Nov. 2022", end_date: "May 2023", description: ["• Managed rosters"] }],
  projects: [{ name: "Pathified", description: "Career app", link: "pathified.vercel.app", repository: "https://github.com/kaustubh/Pathified", tech_stack: ["React", "react", "Supabase"] }],
  skills: ["C", "Python", "python", "Languages: JavaScript, Python and a very long sentence about things"],
  certifications: [],
  achievements: [],
};
const source = [
  "Kaustubh Shukla | Email: k@x.com",
  "Real Gods eSports | Remote, India",
  "Organisation Manager | Nov. 2022 – May 2023",
  "- Pathified | GitHub: <https://github.com/kaustubh/Pathified> Career app",
  "- Languages: JavaScript (ES6+), Python, C, HTML5",
  "Lovely Professional University | Phagwara, Punjab",
].join("\n");

test("sanity pass types links by domain, strips labels/glyphs, dedupes", () => {
  const { resume, links } = sanitizeResumeExtraction(raw);
  assert.deepEqual(links, [
    { type: "github", url: "https://github.com/kaustubh" },
    { type: "linkedin", url: "https://www.linkedin.com/in/k" },
  ], "project repo is not a profile link; types come from the domain");
  assert.equal(resume.email, "k@x.com");
  assert.equal(resume.name, "Kaustubh Shukla");
  assert.equal(resume.education[0].grade, "8.2 / 10");
  assert.equal(resume.experience[0].description[0], "Managed rosters");
  assert.deepEqual(resume.projects[0].tech_stack, ["React", "Supabase"]);
  assert.deepEqual(resume.skills, ["C", "Python"], "deduped; sentence fragments dropped");
});

test("grounding keeps short skills as whole tokens and maps the primary education", () => {
  const { resume } = sanitizeResumeExtraction(raw);
  const interp = toInterpretation(resume, source);
  assert.deepEqual(interp.skills.map((s) => s.name), ["C", "Python"]);
  assert.equal(interp.education[0].institution, "Lovely Professional University");
  assert.equal(interp.experience[0].company, "Real Gods eSports");
  assert.equal(interp.projects[0].repositoryUrl, "https://github.com/kaustubh/Pathified");
  const profile = toExtractedProfile(resume);
  assert.equal(profile.expectedGraduationYear, 2029);
  assert.equal(profile.institution, "Lovely Professional University");
});

test("skip-ahead: only fully accepted sections are skipped", () => {
  const covered = resumeCoveredScreens(
    { links: { total: 2, accepted: 2 }, skills: { total: 20, accepted: 19 }, projects: { total: 3, accepted: 3 } },
    { fullName: "K", institution: "LPU", degree: "B.Tech" }
  );
  assert.deepEqual(covered, [4, 6, 10]);
  assert.equal(nextOnboardingScreen(5, covered), 7, "academic and links skipped");
  assert.equal(nextOnboardingScreen(8, covered), 9, "skills had a rejection, so it is shown");
  assert.equal(nextOnboardingScreen(9, covered), 11, "projects skipped");
  assert.deepEqual(resumeCoveredScreens({}, { fullName: "K", institution: "LPU" }), [], "degree not accepted");
});

// Task 1.1.1: a real PDF (scripts/fixtures/two_column_cv.pdf, generated by
// scripts/lib/make-layout-fixture.ts) through pdf.js + reconstructReadingOrder.
test("real two-column PDF: centred banner first, sidebar, then main; right-aligned dates stay separate cells", async () => {
  const fs = await import("node:fs");
  const { readDocumentText } = await import("../lib/resume/document-text");
  const { text } = await readDocumentText(fs.readFileSync("scripts/fixtures/two_column_cv.pdf"), "pdf");
  assert.equal(text, [
    "Meera Iyer", "meera.iyer@example.com | Chennai, India", "",
    "SKILLS", "Python", "PyTorch", "SQL", "",
    "EDUCATION", "Anna University", "B.E. Computer Science", "2021 - 2025", "",
    "EXPERIENCE", "Orbit Robotics | May 2024 - Jul 2024", "Machine Learning Intern", "- Trained a defect classifier on 40k images", "",
    "PROJECTS", "Pathfinder | 2023", "- Route planner for campus shuttles",
  ].join("\n"));
});
