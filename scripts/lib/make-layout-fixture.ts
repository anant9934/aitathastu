/**
 * Writes scripts/fixtures/two_column_cv.pdf: a synthetic two-column CV (header
 * banner, left sidebar, main column with right-aligned dates) as a raw PDF with
 * exactly positioned Helvetica text, for the Task 1.1.1 end-to-end test.
 * Fictional person; no real data.  node --import tsx scripts/lib/make-layout-fixture.ts
 */
import fs from "node:fs";
import path from "node:path";

type Run = { x: number; y: number; size: number; text: string };
// PDF space: origin bottom-left, page 612 x 792.
const runs: Run[] = [
  { x: 230, y: 750, size: 22, text: "Meera Iyer" },
  { x: 190, y: 728, size: 10, text: "meera.iyer@example.com  |  Chennai, India" },
  // Sidebar (x 40..170)
  { x: 40, y: 680, size: 12, text: "SKILLS" },
  { x: 40, y: 662, size: 10, text: "Python" },
  { x: 40, y: 648, size: 10, text: "PyTorch" },
  { x: 40, y: 634, size: 10, text: "SQL" },
  { x: 40, y: 600, size: 12, text: "EDUCATION" },
  { x: 40, y: 582, size: 10, text: "Anna University" },
  { x: 40, y: 568, size: 10, text: "B.E. Computer Science" },
  { x: 40, y: 554, size: 10, text: "2021 - 2025" },
  // Main column (x 220..572), dates right-aligned at x 480
  { x: 220, y: 680, size: 12, text: "EXPERIENCE" },
  { x: 220, y: 662, size: 11, text: "Orbit Robotics" },
  { x: 480, y: 662, size: 10, text: "May 2024 - Jul 2024" },
  { x: 220, y: 648, size: 10, text: "Machine Learning Intern" },
  { x: 230, y: 634, size: 10, text: "- Trained a defect classifier on 40k images" },
  { x: 220, y: 600, size: 12, text: "PROJECTS" },
  { x: 220, y: 582, size: 11, text: "Pathfinder" },
  { x: 480, y: 582, size: 10, text: "2023" },
  { x: 230, y: 568, size: 10, text: "- Route planner for campus shuttles" },
];

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
const out = path.join(process.cwd(), "scripts/fixtures/two_column_cv.pdf");
fs.writeFileSync(out, pdf, "latin1");
console.log(`wrote ${out} (${Buffer.byteLength(pdf)} bytes)`);
