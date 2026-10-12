import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.env.V4_BASE_URL || "http://127.0.0.1:3000";
const only = process.env.V4_ONLY || "";
const output = path.join(process.cwd(), "docs/screenshots/adaptive-v4/after");
async function main() {
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
const capture = async (page: any, name: string) => { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: !name.startsWith("mobile-"), animations: "disabled" }); console.log(`Captured ${name}`); };
const dismissEora = async (page: any) => { await page.addStyleTag({ content: '[data-eora-id="eora-floating-companion"]{display:none!important}' }); };
const account = async (context: any, label: string) => { const response = await context.request.post(`${base}/api/auth/sign-up`, { data: { email: `v4-${label}-${randomUUID()}@example.test`, password: "SafePreviewPass123!", displayName: `Preview ${label}` } }); if (!response.ok()) throw new Error(`Sign-up ${label}: ${response.status()} ${await response.text()}`); };

try {
  if (!only || only === "gallery") {
  const gallery = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const studentRole = await gallery.newPage();
  await studentRole.goto(`${base}/screens?screen=3&gallery=true`);
  await dismissEora(studentRole);
  await studentRole.getByRole("button", { name: /I'm a Student/ }).click();
  await capture(studentRole, "student-role-selection");
  await studentRole.setViewportSize({ width: 390, height: 844 }); await capture(studentRole, "mobile-student-role-selection"); await studentRole.setViewportSize({ width: 1440, height: 1000 });
  await studentRole.getByRole("button", { name: "Next", exact: true }).last().click({ force: true });
  await studentRole.getByRole("button", { name: "Continue", exact: true }).last().click({ force: true });
  await studentRole.getByRole("button", { name: /Internships & Jobs/ }).click();
  await studentRole.getByRole("button", { name: /Learn AI & ML/ }).click();
  await studentRole.getByRole("button", { name: /People & Mentors/ }).click();
  await capture(studentRole, "student-ranked-purposes");
  await studentRole.setViewportSize({ width: 390, height: 844 }); await capture(studentRole, "mobile-student-ranked-purposes"); await studentRole.setViewportSize({ width: 1440, height: 1000 });
  const facultyRole = await gallery.newPage();
  await facultyRole.goto(`${base}/screens?screen=3&gallery=true`);
  await dismissEora(facultyRole);
  await facultyRole.getByRole("button", { name: /I'm Faculty/ }).click({ force: true });
  await capture(facultyRole, "faculty-role-selection");
  await facultyRole.setViewportSize({ width: 390, height: 844 }); await capture(facultyRole, "mobile-faculty-role-selection"); await facultyRole.setViewportSize({ width: 1440, height: 1000 });
  await facultyRole.getByRole("button", { name: "Next", exact: true }).last().click();
  await facultyRole.getByRole("button", { name: /Assessments & Evaluation/ }).click();
  await facultyRole.getByRole("button", { name: /Teaching & Learning/ }).click();
  await facultyRole.getByRole("button", { name: /Student Mentorship/ }).click();
  await capture(facultyRole, "faculty-ranked-purposes");
  await facultyRole.setViewportSize({ width: 390, height: 844 }); await capture(facultyRole, "mobile-faculty-ranked-purposes"); await facultyRole.setViewportSize({ width: 1440, height: 1000 });
  await gallery.close();
  }

  for (const id of ["jobs", "learning", "projects", "research_events"]) {
    if (only && only !== id) continue;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await account(context, id);
    const update = await context.request.patch(`${base}/api/workspace/preferences`, { data: { role: "student", purposes: [id, "people"] } });
    if (!update.ok()) throw new Error(`Student preferences ${id}: ${update.status()} ${await update.text()}`);
    const page = await context.newPage(); await page.goto(`${base}/student`); await page.getByText("YOUR STUDENT WORKSPACE", { exact: true }).waitFor(); await dismissEora(page);
    await capture(page, `student-${id}-primary`);
    if (id === "jobs") { await page.getByRole("button", { name: /Customize workspace/ }).click(); await capture(page, "customize-workspace"); await page.getByRole("button", { name: "Close", exact: true }).evaluate((element: HTMLElement) => element.click()); await page.setViewportSize({ width: 390, height: 844 }); await capture(page, "mobile-student-career"); }
    await context.close();
  }
  for (const id of ["assessments", "research"]) {
    if (only && only !== `faculty-${id}`) continue;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await account(context, `faculty-${id}`);
    const complete = await context.request.post(`${base}/api/onboarding-v2`, { data: { role: "faculty", name: `Preview Faculty ${id}`, institution: "Preview University", specialization: "Computer Science", priorities: [id, "teaching"], primaryPriority: id } });
    if (!complete.ok()) throw new Error(`Faculty setup ${id}: ${complete.status()} ${await complete.text()}`);
    const forbidden = await context.request.get(`${base}/api/verification/requests`);
    if (forbidden.status() !== 403) throw new Error(`Faculty role request unexpectedly granted verification: ${forbidden.status()}`);
    const page = await context.newPage(); await page.goto(`${base}/faculty`); await page.getByText("FACULTY WORKSPACE", { exact: true }).waitFor(); await dismissEora(page);
    await capture(page, `faculty-${id}-primary-pending`);
    if (id === "assessments") { await page.setViewportSize({ width: 390, height: 844 }); await capture(page, "mobile-faculty-assessments-pending"); }
    await context.close();
  }
} finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
