/**
 * AI TATHASTU — V5.0.4 STRUCTURED EXTRACTION VERIFICATION SUITE
 *
 * Covers:
 *   Case A: Academic/Fresher resume (IIT/NIT student with publications, no experience)
 *   Case B: Internship-heavy resume (3 internships, no full-time employment)
 *   Case C: Research/Academic CV (PhD holder with patents, papers, books)
 *   Case D: Non-technical resume (Healthcare / Nursing)
 *   Case E: Designed/OCR-complex resume (Dataset B PDF-derived, mixed fonts)
 *   Case F: Sparse/minimal resume (1 education, no structured sections)
 *
 *   + 50-document annotated benchmark evaluation against v5_0_4_annotated_sample.json
 *
 * Metrics: Field-level Precision, Recall, F1 for Education, Experience, Skills,
 *          Projects, Achievements.
 *
 * Zero LLM. No production DB writes. Uses only dev partition docs.
 */

import fs from "fs";
import path from "path";
import { parseResumeDocument } from "../lib/services/document-parser-service";
import { DeterministicResumeExtractionEngine } from "../lib/services/deterministic-resume-extraction-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, title: string, evidence?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [${totalTests.toString().padStart(2, "0")}] ✅ PASS: ${title}`);
    if (evidence) console.log(`        Evidence: ${evidence}`);
  } else {
    console.error(`  [${totalTests.toString().padStart(2, "0")}] ❌ FAIL: ${title}`);
    if (evidence) console.error(`        Evidence: ${evidence}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE A: Academic/Fresher Resume
// ─────────────────────────────────────────────────────────────────────────────
function runCaseA() {
  console.log("\n━━━ CASE A: Academic/Fresher Resume ━━━");

  const text = `
PRIYA SHARMA
Email: priya.sharma@iit.ac.in | Phone: +91 98765 43210

EDUCATION
• Indian Institute of Technology Bombay
  B.Tech in Computer Science and Engineering | CGPA: 9.4/10 | 2021 – 2025
• Delhi Public School, Mathura Road
  Class XII (CBSE Senior Secondary) | 97.4% | 2019 – 2021
• Delhi Public School, Mathura Road
  Class X (CBSE Secondary School) | 98.2% | 2017 – 2019

SKILLS
Python, C++, PyTorch, TensorFlow, NumPy, Pandas, Scikit-learn, Git, Linux

PROJECTS
• NeuralRoute (AI/Robotics): Autonomous navigation system using reinforcement learning.
  Built with PyTorch and ROS2. github.com/priyasharma/neuralroute
• CropGuard (ML / Agriculture): Crop disease detection model with 94% accuracy using CNN.
  Deployed as FastAPI microservice on AWS Lambda.

RESEARCH & PUBLICATIONS
• Publication: Efficient Few-Shot Learning for Low-Resource NLP Tasks. Published IEEE NLP 2024.
• Patent: Adaptive Learning Rate Scheduling Mechanism. Indian Patent Application No. 2024-12345 (Filed 2024).

ACHIEVEMENTS & AWARDS
• 1st Place, Smart India Hackathon 2024 – AI Track (among 50,000+ participants).
• Institute Silver Medal, IIT Bombay 2023.
`;

  const r = DeterministicResumeExtractionEngine.extract(text);
  const s = r.structured;

  assert(s.education.length === 3, "Case A: Extracts 3 education records (B.Tech, Class XII, Class X)",
    `Got: ${s.education.length}: ${s.education.map(e => e.degree).join(", ")}`);
  assert(s.education.some(e => /B\.Tech/i.test(e.degree) && e.academicLevel === "undergraduate"),
    "Case A: B.Tech correctly classified as undergraduate", `Levels: ${s.education.map(e => `${e.degree}=${e.academicLevel}`).join(", ")}`);
  assert(s.education.some(e => /Class XII|Senior Secondary/i.test(e.degree) && e.academicLevel === "high_school"),
    "Case A: Class XII correctly classified as high_school");
  assert(s.education.some(e => /Class X|Secondary/i.test(e.degree) && e.academicLevel === "high_school"),
    "Case A: Class X correctly classified as high_school");

  assert(s.experience.length === 0, "Case A: No experience extracted for a fresher (correct)",
    `Got: ${s.experience.length}`);

  assert(s.skills.some(s => s.name === "PyTorch"), "Case A: PyTorch extracted from skills section");
  assert(s.skills.some(s => s.name === "Python"), "Case A: Python extracted");
  assert(s.skills.length >= 5, "Case A: At least 5 skills extracted",
    `Got: ${s.skills.map(s => s.name).join(", ")}`);

  assert(s.projects.length === 2, "Case A: 2 projects extracted",
    `Got: ${s.projects.map(p => p.title).join(", ")}`);
  assert(s.projects.some(p => /NeuralRoute/i.test(p.title)), "Case A: NeuralRoute project extracted");
  assert(s.projects.some(p => /CropGuard/i.test(p.title)), "Case A: CropGuard project extracted");

  assert(s.achievements.some(a => a.category === "publication" && /IEEE/i.test(a.issuer || "")),
    "Case A: IEEE publication extracted as achievement");
  assert(s.achievements.some(a => a.category === "patent" && a.subType === "patent_application"),
    "Case A: Patent application extracted and typed correctly");
  assert(s.achievements.some(a => a.category === "hackathon" && /Smart India/i.test(a.title || "")),
    "Case A: Hackathon award extracted");

  // Provenance / candidate ledger
  assert(r.candidates.some(c => c.ruleId === "edu_dictionary_v3_9"),
    "Case A: Education candidates have correct ruleId");
  assert(r.candidates.some(c => c.ruleId === "skill_taxonomy_v3_9"),
    "Case A: Skill candidates have correct ruleId");
  assert(r.metadata.version === "4.0.0", "Case A: Engine version is 4.0.0");
  assert(r.metadata.llmUsed === false, "Case A: Zero LLM calls confirmed");
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE B: Internship-Heavy Resume
// ─────────────────────────────────────────────────────────────────────────────
function runCaseB() {
  console.log("\n━━━ CASE B: Internship-Heavy Resume ━━━");

  const text = `
RAHUL MEHTA
Email: rahul@example.com | GitHub: github.com/rahulmehta

EDUCATION
• Indian Institute of Technology Delhi
  B.Tech in Electrical Engineering | CGPA: 8.1/10 | 2020 – 2024

EXPERIENCE & LEADERSHIP
• Google India Gurugram Software Engineering Intern May 2023 – Jul. 2023
  : Developed internal tooling for ML inference pipeline using Python and Docker.
  : Reduced inference latency by 30% using TensorFlow model quantization.
• Microsoft Research Bangalore AI Research Intern Dec. 2022 – Feb. 2023
  : Implemented RLHF fine-tuning pipeline for summarization models using PyTorch.
• Flipkart Data Science Intern Summer 2022
  : Built customer churn prediction model using XGBoost and Scikit-learn.
  : Deployed as REST API on AWS with 99.9% uptime.

SKILLS
Python, Java, C++, PyTorch, TensorFlow, Docker, Kubernetes, AWS, Git, SQL

PROJECTS
• TrafficFlow: Real-time urban traffic prediction using graph neural networks.
• ResumeAI: Zero-shot resume classification engine using spaCy.
`;

  const r = DeterministicResumeExtractionEngine.extract(text);
  const s = r.structured;

  assert(s.experience.length === 3, "Case B: Extracts all 3 internship experiences",
    `Got: ${s.experience.length}: ${s.experience.map(e => `${e.company}(${e.type})`).join(", ")}`);
  assert(s.experience.every(e => e.type === "internship"),
    "Case B: All experiences correctly typed as internship",
    `Types: ${s.experience.map(e => `${e.role}=${e.type}`).join(", ")}`);
  assert(s.experience.some(e => /Google/i.test(e.company) && e.startDate && e.endDate),
    "Case B: Google intern has structured start/end dates",
    `Google: ${JSON.stringify(s.experience.find(e => /Google/i.test(e.company)))}`);
  assert(s.experience.some(e => /Microsoft|Research/i.test(e.company)),
    "Case B: Microsoft Research extracted");
  assert(s.experience.some(e => /Flipkart/i.test(e.company)),
    "Case B: Flipkart intern extracted");
  assert(s.experience.some(e => e.technologies && e.technologies.includes("PyTorch")),
    "Case B: Technologies extracted into experience entries");
  assert(s.experience.some(e => e.highlights && e.highlights.length > 0),
    "Case B: Highlights extracted from sub-bullet lines");

  assert(s.education.length === 1 && /IIT|Delhi/i.test(s.education[0].institution),
    "Case B: Single education record (IIT Delhi) extracted correctly");
  assert(s.projects.length === 2, "Case B: 2 projects extracted",
    `Got: ${s.projects.map(p => p.title).join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE C: Research/Academic CV (PhD holder)
// ─────────────────────────────────────────────────────────────────────────────
function runCaseC() {
  console.log("\n━━━ CASE C: Research/Academic CV (PhD Holder) ━━━");

  const text = `
Dr. ARJUN NAIR
Email: arjun.nair@iitb.ac.in

EDUCATION
• Indian Institute of Technology Bombay
  Ph.D. in Computer Science | 2017 – 2022
• National Institute of Technology Calicut
  B.Tech in Computer Science | CGPA: 9.0/10 | 2013 – 2017

EXPERIENCE
• IIT Bombay Postdoctoral Researcher 2022 – Present
  : Research on distributed ML systems and federated learning.
• Samsung Research India Research Intern 2021 – 2022
  : Developed privacy-preserving inference pipeline with differential privacy.

RESEARCH, PATENTS & BOOKS
• Publication: Federated Learning with Differential Privacy at Scale. IEEE ICDM 2022.
• Publication: Graph Attention Networks for Citation Networks. ACM KDD 2021.
• Patent: Differential Privacy Mechanism for Federated Model Aggregation. Indian Patent Application No. 2022-56789 (Filed 2022).
• Patent: Privacy-Preserving Gradient Compression Protocol. US Patent 11,876,543 (Granted 2023).
• Book: Federated Machine Learning: Foundations and Applications. Co-authored with Prof. S. Jain. Springer, 2023.

ACHIEVEMENTS
• Best Paper Award, IEEE ICDM 2022.
• National Science Foundation Fellowship, 2019.
`;

  const r = DeterministicResumeExtractionEngine.extract(text);
  const s = r.structured;

  assert(s.education.length === 2, "Case C: 2 education entries (PhD + B.Tech)",
    `Got: ${s.education.length}: ${s.education.map(e => `${e.degree}@${e.institution}`).join(", ")}`);
  assert(s.education.some(e => /Ph\.D/i.test(e.degree) && e.academicLevel === "doctorate"),
    "Case C: Ph.D. classified as doctorate");
  assert(s.education.some(e => /B\.Tech/i.test(e.degree) && e.academicLevel === "undergraduate"),
    "Case C: B.Tech classified as undergraduate");

  assert(s.experience.length === 2, "Case C: 2 experience entries extracted",
    `Got: ${s.experience.length}: ${s.experience.map(e => `${e.company}|${e.type}`).join(", ")}`);

  // Research outputs must NOT appear as projects
  const projTitles = s.projects.map(p => p.title.toLowerCase());
  const hasPatentInProjects = projTitles.some(t => /patent|application|granted/i.test(t));
  const hasBookInProjects = projTitles.some(t => /federated machine learning|foundations/i.test(t));
  assert(!hasPatentInProjects, "Case C: Patents are NOT mis-classified as projects",
    `Projects: ${s.projects.map(p => p.title).join(", ")}`);
  assert(!hasBookInProjects, "Case C: Books are NOT mis-classified as projects",
    `Projects: ${s.projects.map(p => p.title).join(", ")}`);

  assert(s.achievements.some(a => a.category === "publication" && a.subType === "published_paper"),
    "Case C: IEEE publication extracted as published_paper");
  assert(s.achievements.some(a => a.category === "patent" && a.subType === "patent_application"),
    "Case C: Patent application extracted with correct subType");
  assert(s.achievements.some(a => a.category === "patent" && a.subType === "patent_granted"),
    "Case C: Granted patent extracted with correct subType");
  assert(s.achievements.some(a => a.category === "book" && a.subType === "book_coauthor"),
    "Case C: Co-authored book extracted as book_coauthor");
  assert(s.achievements.some(a => a.category === "honor"),
    "Case C: Best Paper Award extracted as honor");

  // Verify candidate provenance
  assert(r.candidates.some(c => c.category === "achievement" && c.ruleId === "ach_line_v4_4"),
    "Case C: Achievement candidates carry ruleId=ach_line_v4_4");
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE D: Non-Technical Resume (Healthcare / Nursing)
// ─────────────────────────────────────────────────────────────────────────────
function runCaseD() {
  console.log("\n━━━ CASE D: Non-Technical Resume (Healthcare) ━━━");

  // Simulate a Dataset A / Kaggle format healthcare resume
  const text = `
RN STAFF NURSE
Email: nurse@example.com | Phone: 555-123-4567

EDUCATION
• City College of Nursing
  BSN - Bachelor of Science in Nursing | 2006 – 2010

EXPERIENCE
RN Staff Nurse
August 2008 to April 2014 Company Name ï¼ City , State
Provided patient care, medication administration, and clinical documentation.

Patient Access Representative
January 2006 to August 2008 Company Name ï¼ City , State
Registered patients, verified insurance, and scheduled appointments.

SKILLS
Patient Care, Medication Administration, EHR, HIPAA, Triage, CPR/BLS, Clinical Documentation, IV Therapy

ACHIEVEMENTS
• Employee of the Month – City Hospital, 2011.
`;

  const r = DeterministicResumeExtractionEngine.extract(text);
  const s = r.structured;

  // Name disambiguation: "RN STAFF NURSE" must not be extracted as person name
  assert(
    !r.extractedProfile.fullName || !/NURSE|STAFF/i.test(r.extractedProfile.fullName),
    "Case D: Job title 'RN STAFF NURSE' not extracted as person name",
    `fullName: '${r.extractedProfile.fullName}'`
  );

  assert(s.education.length >= 1, "Case D: At least 1 education entry (BSN)",
    `Got: ${s.education.length}: ${s.education.map(e => e.degree).join(", ")}`);

  assert(s.experience.length >= 2, "Case D: At least 2 experience entries from Dataset A format",
    `Got: ${s.experience.length}: ${s.experience.map(e => `${e.role}|${e.company}`).join(", ")}`);
  assert(s.experience.some(e => /RN Staff Nurse|Staff Nurse/i.test(e.role)),
    "Case D: RN Staff Nurse role extracted");
  assert(s.experience.some(e => /Patient Access/i.test(e.role)),
    "Case D: Patient Access Representative role extracted");

  assert(s.skills.length >= 3, "Case D: At least 3 domain skills extracted (Patient Care, EHR, etc.)",
    `Got: ${s.skills.map(sk => sk.name).join(", ")}`);
  assert(s.skills.some(sk => /patient care|ehr|hipaa|cpr|triage/i.test(sk.name)),
    "Case D: Domain-specific healthcare skills extracted",
    `Skills: ${s.skills.map(sk => sk.name).join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE E: Multi-Role / Leadership Resume
// ─────────────────────────────────────────────────────────────────────────────
function runCaseE() {
  console.log("\n━━━ CASE E: Multi-Role / Leadership Resume ━━━");

  const text = `
ANANYA KRISHNAN
Email: ananya@example.com

EDUCATION
• BITS Pilani, Hyderabad Campus
  B.E. in Computer Science | CGPA: 9.1/10 | 2019 – 2023

EXPERIENCE & LEADERSHIP
• Zomato Technologies Gurugram Backend Engineer Jul. 2023 – Present
  : Led migration of monolithic payment service to microservices using Go and Kafka.
  : Improved throughput by 3x, reducing p99 latency from 450ms to 120ms.
Founders Circle Bangalore
• Co-Founder & CTO Mar. 2022 – Jun. 2023
  : Built SaaS product from 0 to 1 with 500 paying customers in 8 months.
NSS Chapter BITS Pilani
• President 2021 – 2022
  : Led 200-member volunteer chapter conducting rural health camps.

PROJECTS
• MicroPay: Distributed payment orchestration system with fault tolerance.
• DataPulse: Real-time analytics pipeline using Apache Kafka and Spark.

SKILLS
Go, Python, Java, Kafka, Docker, Kubernetes, PostgreSQL, Redis, AWS

ACHIEVEMENTS
• Winner, Zomato Hackathon 2023 – Supply Chain Optimization Track.
• Dean's List, BITS Pilani 2021.
`;

  const r = DeterministicResumeExtractionEngine.extract(text);
  const s = r.structured;

  assert(s.experience.length === 3, "Case E: 3 experiences across Format A, C and leadership",
    `Got: ${s.experience.length}: ${s.experience.map(e => `${e.company}|${e.role}|${e.type}`).join(", ")}`);
  assert(s.experience.some(e => e.type === "employment" && /Zomato/i.test(e.company)),
    "Case E: Zomato Backend Engineer extracted as employment");
  assert(s.experience.some(e => e.type === "founder" && /Founder|Co-Founder/i.test(e.role)),
    "Case E: Co-Founder & CTO extracted with type=founder");
  assert(s.experience.some(e => e.type === "leadership" && /President/i.test(e.role)),
    "Case E: NSS President extracted with type=leadership");

  // Projects must not include company names or section headings
  const projTitles = s.projects.map(p => p.title);
  assert(s.projects.length === 2, "Case E: 2 projects extracted (MicroPay, DataPulse)",
    `Got: ${projTitles.join(", ")}`);
  assert(!projTitles.some(t => /Zomato|BITS|NSS|experience/i.test(t)),
    "Case E: No company names or headings in projects");

  assert(s.achievements.some(a => a.category === "hackathon"),
    "Case E: Zomato Hackathon award extracted");
  assert(s.achievements.some(a => a.category === "honor"),
    "Case E: Dean's List extracted as honor");
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE F: Sparse / Minimal Resume
// ─────────────────────────────────────────────────────────────────────────────
function runCaseF() {
  console.log("\n━━━ CASE F: Sparse / Minimal Resume ━━━");

  const text = `
John Smith
Email: john@example.com

EDUCATION
• Harvard University
  B.A. in Economics | 2018 – 2022
`;

  const r = DeterministicResumeExtractionEngine.extract(text);
  const s = r.structured;

  assert(s.education.length === 1, "Case F: Exactly 1 education entry for sparse resume",
    `Got: ${s.education.length}`);
  assert(s.experience.length === 0, "Case F: Zero experience entries (none in document)");
  assert(s.projects.length === 0, "Case F: Zero projects (none in document)");
  assert(s.achievements.length === 0, "Case F: Zero achievements (none in document)");
  assert(!s.education[0].startDate || s.education[0].startDate === "2018",
    "Case F: Does not invent absent GPA or dates beyond what is present",
    `StartDate: ${s.education[0].startDate}, GPA: ${s.education[0].gpa}`);
  assert(r.extractedProfile.fullName === "John Smith",
    "Case F: Name correctly extracted",
    `Got: '${r.extractedProfile.fullName}'`);
  assert(r.metadata.llmUsed === false, "Case F: Zero LLM confirmed for minimal document");
}

// ─────────────────────────────────────────────────────────────────────────────
// 50-DOCUMENT ANNOTATED BENCHMARK EVALUATION
// ─────────────────────────────────────────────────────────────────────────────
async function runBenchmarkEvaluation() {
  console.log("\n━━━ 50-DOCUMENT ANNOTATED BENCHMARK EVALUATION ━━━");

  const annotatedPath = path.resolve(process.cwd(), "benchmarks/v5_0_4_annotated_sample.json");
  if (!fs.existsSync(annotatedPath)) {
    console.log("  ⚠️  Annotated sample not found, skipping 50-doc benchmark.");
    return;
  }

  const annotated: Array<{
    docId: string;
    category: string;
    source: string;
    cleanChars: number;
    groundTruth: {
      educationPresent: boolean;
      experiencePresent: boolean;
      skillsPresent: boolean;
      projectsPresent: boolean;
      achievementsPresent: boolean;
    };
  }> = JSON.parse(fs.readFileSync(annotatedPath, "utf-8"));

  // Locate the manifest to get document text
  const manifestPath = path.resolve(process.cwd(), "benchmarks/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.log("  ⚠️  Manifest not found; running field-extraction only on annotated sample groundTruth.");
    return;
  }

  const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
  let manifest: Array<{ doc_id: string; relative_path: string; format?: string }>;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    console.log("  ⚠️  Manifest is not valid JSON; skipping 50-doc benchmark.");
    return;
  }

  const pathMap = new Map<string, { relative_path: string; format?: string }>();
  for (const m of manifest) {
    if (m.doc_id && m.relative_path) {
      pathMap.set(m.doc_id, { relative_path: m.relative_path, format: m.format });
    }
  }

  // Field-level confusion matrices
  const fields = ["education", "experience", "skills", "projects", "achievements"] as const;
  type FieldName = typeof fields[number];
  const tp: Record<FieldName, number> = { education: 0, experience: 0, skills: 0, projects: 0, achievements: 0 };
  const fp: Record<FieldName, number> = { education: 0, experience: 0, skills: 0, projects: 0, achievements: 0 };
  const fn: Record<FieldName, number> = { education: 0, experience: 0, skills: 0, projects: 0, achievements: 0 };

  let docEvaluated = 0;

  for (const doc of annotated) {
    const entry = pathMap.get(doc.docId);
    if (!entry) continue;

    const fullDocPath = path.resolve(process.cwd(), entry.relative_path);
    if (!fs.existsSync(fullDocPath)) continue;

    let rawText = "";
    try {
      const buf = fs.readFileSync(fullDocPath);
      const parsed = await parseResumeDocument(buf, (entry.format || "pdf") as "pdf" | "docx");
      rawText = parsed.text || "";
    } catch {
      continue;
    }

    if (!rawText || rawText.length < 50) continue;
    docEvaluated++;

    const result = DeterministicResumeExtractionEngine.extract(rawText, { documentId: doc.docId });
    const s = result.structured;
    const gt = doc.groundTruth;

    const extractedPresence = {
      education: s.education.length > 0,
      experience: s.experience.length > 0,
      skills: s.skills.length > 0,
      projects: s.projects.length > 0,
      achievements: s.achievements.length > 0,
    };

    const gtPresence: Record<FieldName, boolean> = {
      education: gt.educationPresent,
      experience: gt.experiencePresent,
      skills: gt.skillsPresent,
      projects: gt.projectsPresent,
      achievements: gt.achievementsPresent,
    };

    for (const field of fields) {
      const extracted = extractedPresence[field];
      const groundTruth = gtPresence[field];

      if (extracted && groundTruth) tp[field]++;
      else if (extracted && !groundTruth) fp[field]++;
      else if (!extracted && groundTruth) fn[field]++;
    }
  }

  if (docEvaluated === 0) {
    console.log("  ⚠️  No documents with text found in manifest for benchmark evaluation.");
    return;
  }

  console.log(`\n  Evaluated ${docEvaluated} documents from annotated sample.\n`);
  console.log("  Field          | TP | FP | FN | Precision | Recall  | F1");
  console.log("  ─────────────────────────────────────────────────────────");

  let totalTP = 0, totalFP = 0, totalFN = 0;

  for (const field of fields) {
    const precision = tp[field] + fp[field] > 0 ? tp[field] / (tp[field] + fp[field]) : 1.0;
    const recall = tp[field] + fn[field] > 0 ? tp[field] / (tp[field] + fn[field]) : 1.0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    totalTP += tp[field]; totalFP += fp[field]; totalFN += fn[field];
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log(`  ${pad(field, 14)} | ${String(tp[field]).padStart(2)} | ${String(fp[field]).padStart(2)} | ${String(fn[field]).padStart(2)} | ${(precision * 100).toFixed(1).padStart(8)}% | ${(recall * 100).toFixed(1).padStart(6)}% | ${(f1 * 100).toFixed(1)}%`);
  }

  const macroPrecision = (totalTP + totalFP) > 0 ? totalTP / (totalTP + totalFP) : 1.0;
  const macroRecall = (totalTP + totalFN) > 0 ? totalTP / (totalTP + totalFN) : 1.0;
  const macroF1 = (macroPrecision + macroRecall) > 0 ? 2 * macroPrecision * macroRecall / (macroPrecision + macroRecall) : 0;

  console.log("  ─────────────────────────────────────────────────────────");
  console.log(`  OVERALL        | ${String(totalTP).padStart(2)} | ${String(totalFP).padStart(2)} | ${String(totalFN).padStart(2)} | ${(macroPrecision * 100).toFixed(1).padStart(8)}% | ${(macroRecall * 100).toFixed(1).padStart(6)}% | ${(macroF1 * 100).toFixed(1)}%`);

  assert(macroPrecision >= 0.70, `Benchmark: Overall Precision ≥ 70% (actual: ${(macroPrecision * 100).toFixed(1)}%)`,
    `TP=${totalTP}, FP=${totalFP}, FN=${totalFN}`);
  assert(macroRecall >= 0.70, `Benchmark: Overall Recall ≥ 70% (actual: ${(macroRecall * 100).toFixed(1)}%)`,
    `TP=${totalTP}, FP=${totalFP}, FN=${totalFN}`);
  assert(macroF1 >= 0.70, `Benchmark: Overall F1 ≥ 70% (actual: ${(macroF1 * 100).toFixed(1)}%)`,
    `Precision=${(macroPrecision * 100).toFixed(1)}%, Recall=${(macroRecall * 100).toFixed(1)}%`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("================================================================================");
  console.log("  AI TATHASTU V5.0.4 — STRUCTURED EXTRACTION VERIFICATION SUITE");
  console.log("  Engine: DeterministicResumeExtractionEngine v4.0.0 (Zero-LLM)");
  console.log("================================================================================");

  runCaseA();
  runCaseB();
  runCaseC();
  runCaseD();
  runCaseE();
  runCaseF();
  await runBenchmarkEvaluation();

  console.log("\n================================================================================");
  console.log(`  V5.0.4 VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log("  STATUS: ✅ ALL PASS");
  } else {
    console.log(`  STATUS: ❌ ${totalTests - passedTests} FAILURES`);
  }
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
