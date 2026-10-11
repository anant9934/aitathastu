import assert from "node:assert/strict";
import { extractResumeStructured } from "../lib/services/resume-extraction-service";
import { resumeCandidates } from "../lib/services/resume-review-service";

// Acceptance labels were written from this fictional CV before running the parser.
const cv = `
MAYA SEN
Email: maya.sen@example.test
GitHub: https://github.com/mayasentest
LinkedIn: https://www.linkedin.com/in/mayasentest

EDUCATION
• Northfield Technical University
  M.S. in Computer Science | 2022 – 2024
• Bayview State College
  B.S. in Mathematics | 2018 – 2022

EXPERIENCE
• Solstice Analytics Senior Data Engineer Jan. 2024 – Present
  : Built batch processing jobs in Python and SQL.
• Harbor Research Lab Research Intern Jun. 2023 – Aug. 2023
  : Tested image segmentation models using PyTorch.

PROJECTS
• River Flood Forecasting
  : Built a forecast dashboard with Python and FastAPI.
• Museum Image Search
  : Created a visual search index using PyTorch.
• Transit Delay Explorer
  : Analyzed bus delays using SQL and React.

SKILLS
Python, SQL, PyTorch, FastAPI, React, Docker

CERTIFICATIONS
• Cloud Data Fundamentals, Example Training Institute, 2023

AWARDS
• Faculty Innovation Award, 2022

PUBLICATIONS
• Evaluating Urban Flood Forecasts, Journal of Synthetic Studies, 2024

PATENTS
• Adaptive Water Sensor Network, patent application filed 2024
`;

async function main() {
  const result = await extractResumeStructured(cv);
  assert.ok(result.success && result.extracted, "Extraction must return structured data");
  const data = result.extracted;
  const summary = {
    name: result.extractedProfile?.fullName,
    education: data.education.map((x) => x.institution),
    experience: data.experience.map((x) => `${x.role} @ ${x.company}`),
    projects: data.projects.map((x) => x.title),
    skills: data.skills.map((x) => `${x.name}:${x.proficiencyHint}`),
    certifications: data.certifications.map((x) => x.name),
    achievements: data.achievements.map((x) => `${x.category}:${x.status || ""}:${x.title}`),
    profiles: result.discoveredProfiles,
    reviewCandidates: resumeCandidates(data, cv).length,
  };
  console.log(JSON.stringify(summary, null, 2));

  const expected = {
    name: "MAYA SEN",
    education: ["Northfield Technical University", "Bayview State College"],
    experience: ["Solstice Analytics", "Harbor Research Lab"],
    projects: ["River Flood Forecasting", "Museum Image Search", "Transit Delay Explorer"],
    skills: ["Python", "SQL", "PyTorch", "FastAPI", "React", "Docker"],
  };
  assert.equal(summary.name, expected.name);
  for (const institution of expected.education) assert.ok(data.education.some((x) => x.institution.includes(institution)), `Missing education: ${institution}`);
  for (const company of expected.experience) assert.ok(data.experience.some((x) => x.company.includes(company)), `Missing experience: ${company}`);
  for (const title of expected.projects) assert.ok(data.projects.some((x) => x.title.includes(title)), `Missing project: ${title}`);
  for (const name of expected.skills) assert.ok(data.skills.some((x) => x.name === name), `Missing skill: ${name}`);
  assert.equal(data.education.length, 2, "Unexpected education record");
  assert.equal(data.experience.length, 2, "Unexpected experience record");
  assert.equal(data.projects.length, 3, "Unexpected project record");
  assert.ok(data.certifications.some((x) => /Cloud Data Fundamentals/.test(x.name)), "Missing certification");
  assert.ok(data.achievements.some((x) => x.category === "award" && /Faculty Innovation Award/.test(x.title)), "Missing award");
  assert.ok(data.achievements.some((x) => x.category === "publication" && /Evaluating Urban Flood Forecasts/.test(x.title)), "Missing publication");
  assert.ok(data.achievements.some((x) => x.category === "patent" && x.status !== "granted" && /Adaptive Water Sensor Network/.test(x.title)), "Patent application missing or marked granted");
  assert.ok(data.skills.every((x) => x.proficiencyHint === "unknown"), "Unsupported proficiency invented");
  assert.ok(data.projects.every((x) => !/publication|patent|projects/i.test(x.title)), "Heading or research output classified as project");
  assert.ok(resumeCandidates(data, cv).every((x) => cv.replace(/\s+/g, " ").toLowerCase().includes(x.sourceSpan.replace(/\s+/g, " ").toLowerCase())), "Candidate lost source provenance");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
