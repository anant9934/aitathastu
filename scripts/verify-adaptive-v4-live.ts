import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";

async function main() {
  const base = process.env.V4_BASE_URL || "http://127.0.0.1:3000";
  const create = async (label: string) => {
    const context = await request.newContext({ baseURL: base });
    const response = await context.post("/api/auth/sign-up", { data: { email: `v4-live-${label}-${randomUUID()}@example.test`, password: "SafePreviewPass123!", displayName: `V4 ${label}` } });
    assert.equal(response.status(), 200, await response.text());
    return context;
  };
  const student = await create("student");
  try {
    const invalid = await student.put("/api/onboarding-v2", { data: { role: "administrator" } });
    assert.equal(invalid.status(), 400);
    const complete = await student.post("/api/onboarding-v2", { data: { role: "student", name: "V4 Student", targetRole: "Machine Learning Engineer", goal: "Get an ML internship", institution: "Preview University", degree: "B.Tech", specialization: "Computer Science", year: "3rd Year", priorities: ["jobs", "learning", "people"], primaryPriority: "jobs" } });
    assert.equal(complete.status(), 200, await complete.text());
    const prefs = await student.get("/api/workspace/preferences");
    const before = await prefs.json();
    assert.equal(before.role, "student");
    assert.deepEqual(before.purposes, ["jobs", "learning", "people"]);
    const customization = await student.patch("/api/workspace/preferences", { data: { role: "student", purposes: ["projects", "learning", "jobs"], layout: { version: 1, pinned: ["projects"], hidden: ["opportunities"], order: ["projects", "learning"], density: "compact", sizes: { projects: "wide" } } } });
    assert.equal(customization.status(), 200, await customization.text());
    const after = await (await student.get("/api/workspace/preferences")).json();
    assert.deepEqual(after.purposes, ["projects", "learning", "jobs"]);
    assert.deepEqual(after.layout.hidden, ["opportunities"]);
    const spoof = await student.patch("/api/student/preferences", { data: { metadata: { requestedRole: "faculty" } } });
    assert.equal(spoof.status(), 200, await spoof.text());
    const afterSpoof = await (await student.get("/api/workspace/preferences")).json();
    assert.equal(afterSpoof.role, "student");
    const dashboard = await student.get("/api/student/dashboard");
    assert.equal(dashboard.status(), 200, await dashboard.text());
    console.log("Student completion, ranking, customization, and role-spoof boundary passed.");
  } finally { await student.dispose(); }
  const faculty = await create("faculty");
  try {
    const complete = await faculty.post("/api/onboarding-v2", { data: { role: "faculty", name: "V4 Faculty", institution: "Preview University", specialization: "Computer Science", priorities: ["assessments", "teaching", "mentorship"], primaryPriority: "assessments" } });
    assert.equal(complete.status(), 200, await complete.text());
    const prefs = await (await faculty.get("/api/workspace/preferences")).json();
    assert.equal(prefs.role, "faculty");
    assert.equal(prefs.facultyAccess, "pending");
    assert.deepEqual(prefs.purposes, ["assessments", "teaching", "mentorship"]);
    assert.equal((await faculty.get("/api/verification/requests")).status(), 403);
    const invalid = await faculty.patch("/api/workspace/preferences", { data: { role: "faculty", purposes: ["jobs"] } });
    assert.equal(invalid.status(), 400);
    const eora = await (await faculty.get("/api/eora/context")).json();
    assert.equal(eora.role, "faculty");
    assert.equal(eora.primaryPriority, "assessments");
    assert.equal(eora.facultyAuthorized, false);
    console.log("Faculty request, purpose validation, EORA context, and protected queue boundary passed.");
  } finally { await faculty.dispose(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
