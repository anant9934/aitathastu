/**
 * CV extraction accuracy regressions — offline, deterministic, no network or DB.
 *
 *   node --import tsx --test scripts/verify-cv-extraction-accuracy.ts
 */
import test from "node:test";
import { sanitizeTextForModel } from "../lib/intelligence/context-firewall";
import assert from "node:assert/strict";
import { extractResumeDeterministic, tagLines } from "../lib/resume/deterministic-extractor";
import { extractResumeDeterministicResult } from "../lib/services/resume-extraction-service";
import { discoverFootprintsFromResume } from "../lib/services/digital-footprint-discovery";
import { ResumeDeduplicationEngine } from "../lib/resume/deduplication-engine";

const STANDARD = `PRIYA SHARMA
Bengaluru, India | priya.sharma@example.com | +91 98765 43210
github.com/priyash | linkedin.com/in/priya-sharma-123 | leetcode.com/u/priyash

EDUCATION
Indian Institute of Technology Delhi
B.Tech in Computer Science and Engineering, CGPA: 8.7/10
Aug 2021 – May 2025

EXPERIENCE
Software Engineering Intern, Google
May 2024 - Jul 2024 | Bengaluru
- Built a caching layer in Go that cut p99 latency by 35%
Research Assistant — IIT Delhi ML Lab
01/2023 – 12/2023
• Fine-tuned BERT models using PyTorch and Hugging Face Transformers

PROJECTS
ChatDocs | Python, LangChain, FastAPI, PostgreSQL
Built a RAG system over PDFs. https://github.com/priyash/chatdocs
Live: https://chatdocs.vercel.app
VisionCount — React, TypeScript, TensorFlow.js
Real-time object counting in the browser.

CERTIFICATIONS
AWS Certified Cloud Practitioner — Amazon Web Services, 2023
Deep Learning Specialization, Coursera (2022)

ACHIEVEMENTS
Winner, Smart India Hackathon 2023
Kaggle Expert — kaggle.com/priyash
`;

test("content lines starting with a heading word are not section headings", () => {
  const tagged = tagLines(["EXPERIENCE", "Research Assistant — IIT Delhi ML Lab", "Projects Manager, Acme", "Technical Skills"]);
  assert.equal(tagged[1].section, "experience");
  assert.equal(tagged[2].section, "experience");
  assert.equal(tagged[3].section, "heading:skills");
});

test("experience: role/company split, numeric dates, and a role after a heading-like line", () => {
  const exp = extractResumeDeterministic(STANDARD).interpretation.experience;
  assert.equal(exp.length, 2);
  assert.deepEqual([exp[0].company, exp[0].role, exp[0].startDate, exp[0].endDate], ["Google", "Software Engineering Intern", "May 2024", "Jul 2024"]);
  assert.equal(exp[0].type, "internship");
  assert.deepEqual([exp[1].company, exp[1].role, exp[1].startDate, exp[1].endDate], ["IIT Delhi ML Lab", "Research Assistant", "01/2023", "12/2023"]);
});

test("experience: 'Role at Company dates' and 'Role, Company, dates' one-liners", () => {
  const a = extractResumeDeterministic("Rahul Verma\nrahul@example.org\nExperience\nBackend Developer at Infosys        June 2022 to Present\nDeveloped microservices using Spring Boot.").interpretation.experience;
  assert.deepEqual([a[0]?.company, a[0]?.role, a[0]?.startDate, a[0]?.endDate], ["Infosys", "Backend Developer", "June 2022", "Present"]);
  const b = extractResumeDeterministic("Karan Mehta\nkaran@example.com\nEXPERIENCE\nIntern, TCS, Jan 2023 – Mar 2023").interpretation.experience;
  assert.deepEqual([b[0]?.company, b[0]?.role], ["TCS", "Intern"]);
});

test("'October' is not split at 'to' when parsing a range", () => {
  const exp = extractResumeDeterministic("Asha Rao\nasha@example.com\nEXPERIENCE\nData Analyst, Swiggy\nOctober 2021 – Present").interpretation.experience;
  assert.equal(exp[0]?.startDate, "October 2021");
  assert.equal(exp[0]?.endDate, "Present");
});

test("projects: link lines are not projects, titles drop the stack, demo URL captured, repo link is not a 'GitHub' skill", () => {
  const projects = extractResumeDeterministic(STANDARD).interpretation.projects;
  assert.deepEqual(projects.map((p) => p.title), ["ChatDocs", "VisionCount"]);
  assert.equal(projects[0].repositoryUrl, "https://github.com/priyash/chatdocs");
  assert.equal(projects[0].demoUrl, "https://chatdocs.vercel.app");
  assert.ok(!projects[0].technologies.includes("GitHub"));
});

test("certifications: name, issuer and year are separated", () => {
  const certs = extractResumeDeterministic(STANDARD).interpretation.certifications;
  assert.deepEqual(certs.map((c) => [c.name, c.issuer, c.year]), [
    ["AWS Certified Cloud Practitioner", "Amazon Web Services", "2023"],
    ["Deep Learning Specialization", "Coursera", "2022"],
  ]);
});

test("achievements: each unbulleted line is its own entry", () => {
  const ach = extractResumeDeterministic(STANDARD).interpretation.achievements;
  assert.equal(ach.length, 2);
  assert.equal(ach[0].category, "hackathon");
});

test("education: '8.1 CGPA' and institution without the glued-on degree", () => {
  const edu = extractResumeDeterministic("Rahul Verma\nrahul@example.org\nEducation\nVIT Vellore, MCA, 2022, 8.1 CGPA").interpretation.education;
  assert.deepEqual([edu[0]?.institution, edu[0]?.degree, edu[0]?.gpa, edu[0]?.graduationYear], ["VIT Vellore", "MCA", "8.1", "2022"]);
});

test("CV without section headings still yields education, experience and skills", () => {
  const r = extractResumeDeterministic(`Ananya Iyer
ananya@example.com
Data Analyst at Flipkart (2021-2023)
Worked on dashboards in Tableau and SQL.
St. Xavier's College, Mumbai — B.Sc. Statistics (2018 – 2021)
Proficient in Excel, Power BI and Python (pandas, numpy).`).interpretation;
  assert.deepEqual([r.experience[0]?.company, r.experience[0]?.role], ["Flipkart", "Data Analyst"]);
  // The degree keeps the document's spelling ("B.Sc.").
  assert.deepEqual([r.education[0]?.institution, r.education[0]?.degree, r.education[0]?.fieldOfStudy], ["St. Xavier's College, Mumbai", "B.Sc.", "Statistics"]);
  assert.ok(r.skills.some((s) => s.name === "Python"));
});

test("footprints: platform names in prose never become profiles", () => {
  const text = [
    "Fine-tuned models with Hugging Face Transformers",
    "Kaggle Expert (top 5%)",
    "CI/CD with GitHub Actions",
    "Tools: Git, GitHub, Docker",
    "LeetCode: Solved 400 problems",
  ].join("\n");
  assert.deepEqual(discoverFootprintsFromResume({ text }), []);
  const fps = extractResumeDeterministic(`Test User\ntest@example.com\nSKILLS\n${text}`).interpretation.digitalFootprints ?? [];
  assert.deepEqual(fps, []);
});

test("footprints: labelled handles and wrapped URLs are still found", () => {
  const fps = discoverFootprintsFromResume({ text: "GitHub: octocat | HF @octo-ml\nhttps://www.linkedin.com/in/\nrahulverma" });
  const byProvider = Object.fromEntries(fps.map((f) => [f.provider, f.normalizedUrl]));
  assert.equal(byProvider.github, "https://github.com/octocat");
  assert.equal(byProvider.huggingface, "https://huggingface.co/octo-ml");
  assert.match(byProvider.linkedin, /linkedin\.com\/in\/rahulverma$/);

  const det = extractResumeDeterministic("Rahul Verma\nrahul@example.org\nhttps://github.com/rahul-\nverma-dev").interpretation.digitalFootprints ?? [];
  // A PDF line break inside a URL adds no hyphen, so the trailing "-" belongs to the handle.
  assert.deepEqual(det.map((f) => f.url), ["https://github.com/rahul-verma-dev"]);
});

test("links: leetcode /u/ and bare forms are one profile", () => {
  const r = extractResumeDeterministicResult(STANDARD);
  const leet = (r.links ?? []).filter((l) => l.type === "leetcode");
  assert.equal(leet.length, 1);
});

test("phone: the candidate's own number only, never a referee's, never sent to a model", () => {
  const text = "Asha Rao\nasha@example.com | +91 98765 43210\nREFERENCES\nDr. K. Menon, Professor\nmenon@example.edu | +91 90000 11111";
  const r = extractResumeDeterministic(text);
  assert.equal(r.profile.mobile, "+91 98765 43210");
  assert.equal(r.profile.email, "asha@example.com");
  assert.ok(!r.engine.personal.phones.some((p) => p.normalized.endsWith("9000011111")));
  assert.ok(!r.engine.personal.emails.some((e) => e.value === "menon@example.edu"));
  assert.ok(!sanitizeTextForModel(text).includes("98765 43210"), "the model never sees the number");
});

test("dedup keeps a promotion at the same company as two roles", () => {
  const { interpretation } = ResumeDeduplicationEngine.deduplicateAll({
    education: [], projects: [], skills: [], certifications: [], achievements: [],
    experience: [
      { company: "Acme", role: "Software Engineer", startDate: "2021", endDate: "2023", sourceSpan: "role one", highlights: [], technologies: [] },
      { company: "Acme", role: "Senior Software Engineer, Platform Team", startDate: "2023", endDate: "Present", sourceSpan: "role two", highlights: [], technologies: [] },
    ],
  });
  assert.equal(interpretation.experience.length, 2);
});
