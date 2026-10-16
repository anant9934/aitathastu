/**
 * Writes scripts/fixtures/complete_student_cv.pdf: a one-column student CV
 * carrying every field onboarding pre-fills (name, contact, university,
 * degree, graduation year, GitHub, LinkedIn, skills, projects, experience)
 * for the Task 2.1.2 end-to-end check. Fictional person; no real data.
 *
 *   node --import tsx scripts/lib/make-complete-cv-fixture.ts
 */
import fs from "node:fs";
import path from "node:path";

const lines: [size: number, text: string][] = [
  [22, "Kavya Raman"],
  [10, "kavya.raman@example.com  |  +91 98765 43210  |  Bengaluru, India"],
  [10, "github.com/kavyaraman-ml  |  linkedin.com/in/kavya-raman-ml"],
  [12, ""],
  [13, "EDUCATION"],
  [11, "Indian Institute of Technology Madras"],
  [10, "B.Tech in Computer Science and Engineering, 2022 - 2026 (expected graduation 2026)"],
  [10, "CGPA: 8.7 / 10"],
  [12, ""],
  [13, "SKILLS"],
  [10, "Python, PyTorch, TensorFlow, scikit-learn, SQL, Docker, FastAPI, Git"],
  [12, ""],
  [13, "PROJECTS"],
  [11, "Crop Disease Detector"],
  [10, "Trained a CNN in PyTorch on 12,000 leaf images to classify 8 crop diseases; deployed with FastAPI."],
  [10, "github.com/kavyaraman-ml/crop-disease-detector"],
  [11, "Lecture Notes Q&A"],
  [10, "Retrieval-augmented question answering over course notes using FAISS and a small LLM."],
  [12, ""],
  [13, "EXPERIENCE"],
  [11, "Machine Learning Intern, Sarvam Analytics Pvt Ltd"],
  [10, "May 2025 - Jul 2025: built data pipelines and evaluation scripts for a speech model."],
];

let y = 760;
const runs = lines.map(([size, text]) => { const r = { x: 50, y, size, text }; y -= size === 12 ? 10 : size + 8; return r; }).filter((r) => r.text);
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const content = runs.map((r) => `BT /F1 ${r.size} Tf ${r.x} ${r.y} Td (${esc(r.text)}) Tj ET`).join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
];
let pdf = "%PDF-1.4\n";
const offsets: number[] = [];
objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const out = path.join(process.cwd(), "scripts/fixtures/complete_student_cv.pdf");
fs.writeFileSync(out, pdf, "latin1");
console.log(`wrote ${out} (${Buffer.byteLength(pdf)} bytes)`);
