/**
 * The fixed-schema CV review workspace: the ten sections and every field,
 * mandatory profile fields, blank optional fields, canonical serialization,
 * repeatable-record editing, persistence across reload and reprocessing,
 * explicit save selection, privacy and authorization. Synthetic CV text and an
 * in-memory database only; no AI provider is called.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-cv-review-workspace.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import {
  SECTIONS, RECORD_TYPES, acceptedProfileFrom, addRecord, addSingle, applyPayload, buildWorkspace, fieldProblems, mandatoryProblems, removeItem,
  restoreItem, serializeWorkspace, setCurrentEducation, setSectionSelected, setSelected, setValue, type CandidateLike, type Workspace,
} from "../lib/resume/review-workspace";
import { parseApplyBody } from "../lib/resume/apply-payload";

process.env.CORE_DISABLE_LIVE_LLM = "true";
const NOW = new Date("2026-10-21T00:00:00Z");

const CANDIDATES: CandidateLike[] = [
  { candidateId: "profile_fullName", category: "profile", field: "fullName", value: "Asha Rao", sourceSpan: "Asha Rao", recordData: { method: "deterministic", confidenceLevel: "high", evidence: { page: 1, section: "header", text: "Asha Rao" }, review: { status: "high_confidence", issues: [] } } },
  { candidateId: "profile_email", category: "profile", field: "email", value: "asha.rao@example.com", sourceSpan: "asha.rao@example.com", recordData: { confidenceLevel: "high", evidence: { page: 1, text: "asha.rao@example.com | +91 98765 43210" } } },
  { candidateId: "profile_dateOfBirth", category: "profile", field: "dateOfBirth", value: "12 March 2001", sourceSpan: "Date of Birth: 12 March 2001", recordData: { confidenceLevel: "high" } },
  { candidateId: "education_0", category: "education", value: "B.Tech · 2022–Present", sourceSpan: "B.Tech, Computer Science, VIT, 2022 – Present", recordData: { degree: "B.Tech", institution: "VIT", fieldOfStudy: "Computer Science", startDate: "2022", endDate: "Present", current: true, review: { status: "high_confidence", confidence: 0.9 } } },
  { candidateId: "education_1", category: "education", value: "Class XII · 2022", sourceSpan: "Class XII, KV Pune, 2022", recordData: { degree: "Class XII", institution: "KV Pune", endDate: "2022" } },
  { candidateId: "experience_0", category: "experience", value: "Intern · Acme", sourceSpan: "Intern | Acme | Jan 2025 – Jun 2025", recordData: { role: "Intern", company: "Acme", startDate: "Jan 2025", endDate: "Jun 2025", highlights: ["Built dashboards"], technologies: ["Python"] } },
  { candidateId: "skill_0", category: "skill", value: "Python", sourceSpan: "Python", recordData: { name: "Python" } },
  { candidateId: "skill_1", category: "skill", value: "SQL", sourceSpan: "SQL", recordData: { name: "SQL", review: { status: "invalid" } } },
  { candidateId: "digitalFootprint_0", category: "digitalFootprint", value: "GitHub · https://github.com/asha-rao", sourceSpan: "github.com/asha-rao", recordData: { platform: "GitHub", url: "https://github.com/asha-rao" } },
  { candidateId: "digitalFootprint_1", category: "digitalFootprint", value: "LinkedIn", sourceSpan: "linkedin.com/in/asha", recordData: { platform: "LinkedIn", url: "https://linkedin.com/in/asha" } },
];

/** Ticks name, email, GitHub and the pursued degree and fills in its missing fields. */
function complete(ws: Workspace): Workspace {
  let w = ws;
  for (const id of ["profile_fullName", "profile_email", "github_digitalFootprint_0", "education_0"]) w = setSelected(w, id, true);
  w = setValue(w, "education_0", "endDate", "May 2027");
  return w;
}

test("sections: the ten sections in order, and every personal field present even when the CV had none", () => {
  assert.deepEqual(SECTIONS.map((s) => s.title), [
    "Identity & Personal Details", "Contact Information", "Location & Work Authorization", "Education", "Work Experience",
    "Skills & Technologies", "Projects", "Certifications, Awards & Achievements", "Publications, Research & Patents", "Online Presence & Other Details",
  ]);
  const ws = buildWorkspace([]);
  for (const s of SECTIONS) for (const f of s.singles) {
    const item = ws.items.find((i) => i.kind === "single" && i.field === f.key);
    assert.ok(item, f.key);
    assert.deepEqual([item!.values.value, item!.source, item!.evidence, item!.selected], ["", "none", undefined, false], f.key);
  }
  // Every record type belongs to exactly one section and lists all of its fields.
  const placed = SECTIONS.flatMap((s) => s.recordTypes);
  assert.deepEqual([...placed].sort(), Object.keys(RECORD_TYPES).sort());
  assert.deepEqual(RECORD_TYPES.education.fields.map((f) => f.key), ["degree", "institution", "fieldOfStudy", "startDate", "status", "endDate", "grade", "location"]);
});

test("extracted values are shown as read; missing ones stay blank and nothing is invented", () => {
  const ws = buildWorkspace(CANDIDATES);
  const edu = ws.items.find((i) => i.id === "education_0")!;
  assert.deepEqual(edu.values, { degree: "B.Tech", institution: "VIT", fieldOfStudy: "Computer Science", startDate: "2022", status: "Pursuing", endDate: "", grade: "", location: "" });
  const xii = ws.items.find((i) => i.id === "education_1")!;
  assert.equal(xii.values.status, "", "a bare year does not decide Graduated or Pursuing");
  assert.equal(xii.values.fieldOfStudy, "");
  const gh = ws.items.find((i) => i.field === "githubUrl")!;
  assert.deepEqual([gh.values.value, gh.linkedCandidateId, gh.source], ["https://github.com/asha-rao", "digitalFootprint_0", "cv"]);
  // Source, confidence, checks, verification and evidence are separate facts.
  const name = ws.items.find((i) => i.id === "profile_fullName")!;
  assert.deepEqual([name.source, name.confidence, name.extractorStatus, name.saved, name.evidence?.text], ["cv", "high", "high_confidence", undefined, "Asha Rao"]);
  const added = addRecord(ws, "project");
  assert.equal(added.ws.items.find((i) => i.id === added.id)!.evidence, undefined, "something typed in has no CV evidence");
});

test("mandatory: name, email, GitHub profile and the six current-education fields, checked when saving", () => {
  const empty = buildWorkspace([]);
  assert.deepEqual(mandatoryProblems(empty, NOW).map((p) => p.field), ["fullName", "email", "githubUrl", "currentEducation"]);

  const ws = buildWorkspace(CANDIDATES);
  // Reviewing is never blocked: the workspace exists with problems outstanding.
  const before = mandatoryProblems(ws, NOW).map((p) => p.field);
  assert.ok(before.includes("fullName") && before.includes("currentEducation") && before.includes("endDate"), before.join());
  const ok = complete(ws);
  assert.deepEqual(mandatoryProblems(ok, NOW), []);
  assert.deepEqual(fieldProblems(ok), []);

  const msg = (w: Workspace) => mandatoryProblems(w, NOW).map((p) => `${p.field}:${p.message}`);
  assert.match(msg(setValue(ok, "github_digitalFootprint_0", "value", "https://github.com/asha-rao/crop-advisor")).join(), /githubUrl:.*not a repository/);
  assert.match(msg(setValue(ok, "profile_email", "value", "asha@")).join(), /email:Enter a valid email/);
  assert.match(msg(setValue(ok, "education_0", "fieldOfStudy", "")).join(), /fieldOfStudy:Specialization/);
  assert.match(msg(setValue(ok, "education_0", "status", "")).join(), /status:Education status is required/);
  assert.match(msg(setValue(ok, "education_0", "endDate", "May 2025")).join(), /endDate:An expected passing-out date cannot be in the past/);
  const graduated = setValue(ok, "education_0", "status", "Graduated");
  assert.match(msg(graduated).join(), /endDate:A graduated course cannot end in the future/);
  assert.deepEqual(msg(setValue(graduated, "education_0", "endDate", "June 2026")), []);
  assert.match(msg(setValue(ok, "education_0", "startDate", "2028")).join(), /before the start year/);

  // Current education can be any record, and is the one that is checked.
  const other = setCurrentEducation(ok, "education_1");
  assert.deepEqual(mandatoryProblems(other, NOW).map((p) => p.field).sort(), ["currentEducation", "fieldOfStudy", "startDate", "status"].sort());
});

test("optional blanks: empty optional fields are valid and are not sent", () => {
  const ws = complete(buildWorkspace(CANDIDATES));
  assert.deepEqual(fieldProblems(ws), []);
  const p = serializeWorkspace(ws);
  assert.ok(!p.additions.some((a) => a.field === "pronouns" || a.field === "nationality"), "untouched blank fields are not saved");
  assert.ok(!p.decisions.some((d) => d.candidateId.startsWith("user_profile_")));
});

test("canonical serialization: stable, section-ordered, changed fields only, unticked or emptied is rejected", () => {
  const ws = complete(buildWorkspace(CANDIDATES));
  const p1 = serializeWorkspace(ws);
  assert.deepEqual(serializeWorkspace(ws), p1, "same workspace, same payload");
  assert.equal(JSON.stringify(serializeWorkspace(buildWorkspace(CANDIDATES))), JSON.stringify(serializeWorkspace(buildWorkspace([...CANDIDATES]))));
  const ids = p1.decisions.map((d) => d.candidateId);
  assert.deepEqual(ids, ["profile_fullName", "profile_dateOfBirth", "profile_email", "education_0", "education_1", "experience_0", "skill_0", "skill_1", "digitalFootprint_0", "digitalFootprint_1"]);
  const by = Object.fromEntries(p1.decisions.map((d) => [d.candidateId, d]));
  assert.deepEqual(by.profile_fullName, { candidateId: "profile_fullName", state: "confirmed" }, "untouched: no correction sent");
  assert.equal(by.profile_dateOfBirth.state, "rejected", "unticked is an explicit rejection");
  assert.deepEqual(by.education_0, {
    candidateId: "education_0", state: "confirmed", correctedValue: "B.Tech · Computer Science · VIT",
    fields: { degree: "B.Tech", endDate: "May 2027", fieldOfStudy: "Computer Science", grade: "", institution: "VIT", location: "", startDate: "2022", status: "Pursuing" },
    currentEducation: true,
  });
  assert.deepEqual(Object.keys(by.education_0.fields!), [...Object.keys(by.education_0.fields!)].sort(), "field keys are sorted");
  assert.equal(p1.currentEducationId, "education_0");
  const emptied = serializeWorkspace(setValue(setSelected(ws, "experience_0", true), "experience_0", "role", ""));
  assert.equal(emptied.decisions.find((d) => d.candidateId === "experience_0")!.state, "confirmed", "one field emptied keeps the record");
  let blank = setSelected(ws, "skill_0", true);
  blank = setValue(blank, "skill_0", "name", "");
  assert.equal(serializeWorkspace(blank).decisions.find((d) => d.candidateId === "skill_0")!.state, "rejected", "a fully emptied record is never saved");
  // The server reproduces the same final state from the payload.
  const replayed = applyPayload(buildWorkspace(CANDIDATES), p1);
  assert.deepEqual(serializeWorkspace(replayed).decisions, p1.decisions);
});

test("repeatable records: add, edit, remove and restore; the current-education marker follows", () => {
  let ws = complete(buildWorkspace(CANDIDATES));
  const a = addRecord(ws, "education"); ws = a.ws;
  for (const [k, v] of Object.entries({ degree: "M.Tech", institution: "IIT Bombay", fieldOfStudy: "AI", startDate: "2027", status: "Pursuing", endDate: "2029" })) ws = setValue(ws, a.id, k, v);
  ws = setCurrentEducation(ws, a.id);
  assert.deepEqual(mandatoryProblems(ws, NOW), []);
  const b = addRecord(ws, "project"); ws = setValue(b.ws, b.id, "title", "Crop Advisor");
  const p = serializeWorkspace(ws);
  assert.deepEqual(p.additions.map((x) => [x.kind, x.category, x.currentEducation ?? false]), [["education", "education", true], ["project", "project", false]]);
  assert.equal(p.decisions.find((d) => d.candidateId === "education_0")!.currentEducation, undefined, "only one current education");

  ws = removeItem(ws, a.id);
  assert.equal(ws.currentEducationId, "education_0", "removing the current one moves the marker");
  assert.ok(!serializeWorkspace(ws).additions.some((x) => x.id === a.id), "a removed addition is not sent");
  ws = removeItem(ws, "experience_0");
  assert.equal(serializeWorkspace(ws).decisions.find((d) => d.candidateId === "experience_0")!.state, "rejected");
  ws = restoreItem(ws, "experience_0");
  assert.equal(serializeWorkspace(ws).decisions.find((d) => d.candidateId === "experience_0")!.state, "confirmed");
  const alt = addSingle(ws, "alternateEmail");
  ws = setValue(alt.ws, alt.id, "value", "asha.alt@example.com");
  assert.ok(serializeWorkspace(ws).additions.some((x) => x.field === "alternateEmail" && x.fields.value === "asha.alt@example.com"));
});

test("explicit selection: nothing is pre-ticked, bulk tick skips invalid records, typing a value ticks it", () => {
  const ws = buildWorkspace(CANDIDATES);
  assert.ok(ws.items.every((i) => !i.selected), "nothing is saved unless the student ticks it");
  assert.ok(serializeWorkspace(ws).decisions.every((d) => d.state === "rejected"));
  assert.deepEqual(serializeWorkspace(ws).additions, []);
  const bulk = setSectionSelected(ws, "skills", true);
  assert.deepEqual(bulk.items.filter((i) => i.kind === "skill").map((i) => [i.id, i.selected]), [["skill_0", true], ["skill_1", false]]);
  const typed = setValue(ws, "user_profile_pronouns", "value", "she/her");
  assert.equal(typed.items.find((i) => i.id === "user_profile_pronouns")!.selected, true);
  // An earlier upload's confirmation pre-ticks only that item.
  const carried = buildWorkspace([{ ...CANDIDATES[0], previousDecision: "confirmed" }]);
  assert.equal(carried.items.find((i) => i.id === "profile_fullName")!.selected, true);
});

test("payload parsing: limits, ids and categories are enforced", () => {
  const p = serializeWorkspace(complete(buildWorkspace(CANDIDATES)));
  assert.ok(parseApplyBody(p));
  assert.ok(parseApplyBody({ decisions: [{ candidateId: "skill_0", state: "confirmed" }] }), "the legacy body still parses");
  assert.equal(parseApplyBody({ decisions: [], additions: [] }), null, "additions need the workspace version");
  const add = (a: Record<string, unknown>) => parseApplyBody({ workspaceVersion: 1, decisions: [], additions: [a], currentEducationId: null });
  assert.equal(add({ id: "skill_0", category: "skill", kind: "skill", fields: { name: "x" } }), null, "an addition cannot take an extracted id");
  assert.equal(add({ id: "user_x", category: "secrets", kind: "skill", fields: { name: "x" } }), null);
  assert.equal(add({ id: "user_x", category: "education", kind: "skill", fields: { name: "x" } }), null, "kind and category must agree");
  assert.equal(add({ id: "user_x", category: "profile", kind: "single", field: "password", fields: { value: "x" } }), null);
  assert.equal(add({ id: "user_x", category: "skill", kind: "skill", fields: { "na-me": "x" } }), null);
  assert.equal(parseApplyBody({ decisions: Array.from({ length: 1001 }, (_, i) => ({ candidateId: `skill_${i}`, state: "rejected" })) }), null);
  const long = parseApplyBody({ workspaceVersion: 1, decisions: [{ candidateId: "skill_0", state: "confirmed", fields: { name: "x".repeat(9000) } }], additions: [] });
  assert.equal(long!.decisions[0].fields!.name.length, 4000);
});

test("privacy: only onboarding's own profile fields leave the review; date of birth and address do not", async () => {
  let ws = complete(buildWorkspace(CANDIDATES));
  ws = setSelected(ws, "profile_dateOfBirth", true);
  ws = setValue(ws, "user_profile_address", "value", "14 Lake View Road, Nagpur");
  const ap = acceptedProfileFrom(ws);
  assert.deepEqual(Object.keys(ap).sort(), ["degree", "email", "expectedGraduationYear", "fullName", "institution", "specialization"]);
  assert.equal(ap.expectedGraduationYear, "2027");
  const { workspaceToOnboarding } = await import("../lib/client/onboarding/use-resume-ingestion");
  const out = workspaceToOnboarding(ws.items.filter((i) => i.selected && !i.removed), ws, "doc_1");
  const json = JSON.stringify(out);
  for (const secret of ["12 March 2001", "Lake View"]) assert.ok(!json.includes(secret), secret);
  assert.equal(out.extra.acceptedLinks?.github, "https://github.com/asha-rao");
});

test("downstream: onboarding receives the edited and added records, not the original extraction", async () => {
  const { workspaceToOnboarding } = await import("../lib/client/onboarding/use-resume-ingestion");
  const { applyResumeReview } = await import("../lib/client/onboarding/apply-resume");
  let ws = complete(buildWorkspace(CANDIDATES));
  ws = setValue(ws, "education_0", "institution", "Vellore Institute of Technology");
  const b = addRecord(ws, "project"); ws = setValue(setValue(b.ws, b.id, "title", "Crop Advisor"), b.id, "technologies", "Python, Flask");
  const kept = ws.items.filter((i) => i.selected && !i.removed && Object.values(i.values).some((v) => v.trim()));
  const { claims, extra } = workspaceToOnboarding(kept, ws, "doc_1");
  const data = { name: "", academic: { fullName: "", email: "", mobile: "", institution: "", degree: "", department: "" }, education: [], experiences: [], achievements: [], projects: [], skills: [], profiles: {}, portfolioUrls: [], discoveredResumeProfiles: {}, resumeReviewed: [] } as never;
  const { next } = applyResumeReview(data, "cv.txt", claims, extra);
  assert.equal(next.academic.institution, "Vellore Institute of Technology");
  assert.equal(next.academic.expectedGraduationYear, 2027);
  assert.deepEqual(next.projects.map((p) => [p.title, p.technologies]), [["Crop Advisor", ["Python", "Flask"]]]);
  assert.equal(next.profiles.github, "https://github.com/asha-rao");
});

const CV_TEXT = [
  "Asha Rao", "asha.rao@example.com | +91 98765 43210 | github.com/asha-rao | Pune, Maharashtra",
  "EDUCATION", "B.Tech in Computer Science, Vellore Institute of Technology, 2022 – 2026", "Higher Secondary (XII), Kendriya Vidyalaya Pune, 2020 – 2022",
  "SKILLS", "Python, SQL, React", "PROJECTS", "Crop Advisor | Python, Flask", "- Built a crop recommendation web app for farmers",
].join("\n");

async function reviewReady(label: string) {
  await setupTestDatabase();
  const svc = await import("../lib/services/resume-ingestion-service");
  const owner = await createTestPerson(label);
  const other = await createTestPerson(`${label}2`);
  const { jobId, documentId } = await svc.queueResumeUpload({ personId: owner, filename: "cv.txt", mimeType: "text/plain", bytes: Buffer.from(CV_TEXT) });
  await svc.processResumeJob(jobId, owner);
  const status = await svc.getResumeJobStatus(documentId, owner, jobId);
  assert.equal(status.status, "review_ready", status.message ?? "");
  return { svc, owner, other, documentId, jobId, candidates: status.result!.reviewCandidates as CandidateLike[] };
}

/** The student's review of the CV above: what they fill in, edit, add and leave out. */
function studentReview(candidates: CandidateLike[]) {
  let ws = buildWorkspace(candidates);
  for (const id of ["profile_fullName", "profile_email", "github_digitalFootprint_0", "skill_0", "project_0"]) ws = setSelected(ws, id, true);
  const edu = ws.items.find((i) => i.kind === "education" && /B\.?Tech/.test(i.values.degree))!;
  ws = setSelected(ws, edu.id, true);
  for (const [k, v] of Object.entries({ institution: "Vellore Institute of Technology", fieldOfStudy: "Computer Science", status: "Graduated", endDate: "June 2026" })) ws = setValue(ws, edu.id, k, v);
  ws = setCurrentEducation(ws, edu.id);
  const cert = addRecord(ws, "certification"); ws = setValue(setValue(cert.ws, cert.id, "name", "AWS Cloud Practitioner"), cert.id, "issuer", "Amazon Web Services");
  return { ws, eduId: edu.id, certId: cert.id };
}

test("persistence: edits, additions and the current education survive reload and reprocessing", async () => {
  const { svc, owner, documentId, candidates } = await reviewReady("cvws");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { ws, eduId, certId } = studentReview(candidates);
  const res = await applyResumeReviewForPerson(owner, documentId, serializeWorkspace(ws));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.added, 1);

  const check = async (label: string) => {
    const st = await svc.getResumeJobStatus(documentId, owner);
    const reloaded = buildWorkspace(st.result!.reviewCandidates as CandidateLike[]);
    const edu = reloaded.items.find((i) => i.id === eduId)!;
    assert.deepEqual([edu.saved, edu.values.institution, edu.values.status, edu.values.endDate], ["confirmed", "Vellore Institute of Technology", "Graduated", "June 2026"], label);
    assert.equal(reloaded.currentEducationId, eduId, label);
    const cert = reloaded.items.find((i) => i.id === certId)!;
    assert.deepEqual([cert.source, cert.saved, cert.values.name, cert.values.issuer, cert.evidence], ["user", "confirmed", "AWS Cloud Practitioner", "Amazon Web Services", undefined], label);
    assert.equal(reloaded.items.find((i) => i.id === "skill_1")!.saved, "rejected", label);
    assert.deepEqual(mandatoryProblems(reloaded, NOW), [], `${label}: a reloaded save is still complete`);
    // Re-saving the reloaded review changes nothing.
    const again = await applyResumeReviewForPerson(owner, documentId, serializeWorkspace(reloaded));
    assert.deepEqual([again.status, again.body.recordsUpdated, again.body.added], [200, 0, 0], label);
  };
  await check("reload");

  // The Schema v2 profile has the edits in their own fields, not a joined summary.
  const { getDb, resumeDocuments } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const [doc] = await (await getDb()).select().from(resumeDocuments).where(eq(resumeDocuments.id, documentId));
  const v2 = (doc.extractedProfile as { groups: Record<string, Array<{ record_state: string; fields: Record<string, { value: string; evidence: unknown[] }> }>> }).groups.education;
  const confirmed = v2.find((r) => r.record_state === "student_confirmed")!;
  assert.deepEqual([confirmed.fields.institution.value, confirmed.fields.specialization?.value, confirmed.fields.expected_graduation?.value], ["Vellore Institute of Technology", "Computer Science", "2026"]);
  if (!candidates.find((c) => c.candidateId === eduId)?.recordData?.institution) assert.deepEqual(confirmed.fields.institution.evidence, [], "a typed-in value carries no evidence");

  const again = await svc.requeueResumeDocument(owner, documentId);
  await svc.processResumeJob(again!, owner);
  await check("reprocessing");
});

test("mandatory fields are enforced by the server too: 422, problems listed, nothing saved", async () => {
  const { owner, documentId, candidates } = await reviewReady("cvwsreq");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { decisionsByCandidate, userAddedRecords } = await import("../lib/services/resume-extraction-persistence");
  let { ws } = studentReview(candidates);
  ws = setSelected(ws, "github_digitalFootprint_0", false);
  ws = setValue(ws, "profile_email", "value", "secret-typo@");
  const res = await applyResumeReviewForPerson(owner, documentId, serializeWorkspace(ws));
  assert.equal(res.status, 422);
  assert.equal(res.body.code, "MANDATORY_FIELDS_MISSING");
  assert.deepEqual((res.body.problems as Array<{ field: string }>).map((p) => p.field).sort(), ["email", "githubUrl"]);
  assert.ok(!JSON.stringify(res.body).includes("secret-typo"), "the response does not echo what was typed");
  assert.equal((await decisionsByCandidate(owner, documentId)).size, 0);
  assert.equal((await userAddedRecords(owner, documentId)).length, 0);
});

test("authorization: another student cannot save, add to, read or take over this review", async () => {
  const { svc, owner, other, documentId, jobId, candidates } = await reviewReady("cvwsauth");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { recordDecisions, userAddedRecords, listRecords } = await import("../lib/services/resume-extraction-persistence");
  const { ws, certId } = studentReview(candidates);
  const payload = serializeWorkspace(ws);
  assert.equal((await applyResumeReviewForPerson(other, documentId, payload)).status, 404);
  assert.deepEqual(await recordDecisions(other, documentId, [], [{ id: "user_certification_x", category: "certification", kind: "certification", fields: { name: "Fake" }, value: "Fake" }]), { updated: 0, unchanged: 0, added: 0 });
  assert.equal((await listRecords(owner, documentId)).filter((r) => r.provenance === "user").length, 0, "nothing was added to the owner's document");

  assert.equal((await applyResumeReviewForPerson(owner, documentId, payload)).status, 200);
  assert.equal((await svc.getResumeJobStatus(documentId, other, jobId)).httpStatus, 404);
  assert.deepEqual(await userAddedRecords(other, documentId), []);
  // A decision on someone else's or an unknown added item is refused, not ignored.
  const forged = { ...payload, decisions: [...payload.decisions, { candidateId: "user_certification_forged", state: "rejected" as const }] };
  assert.equal((await applyResumeReviewForPerson(owner, documentId, forged)).status, 409);
  // Removing an addition the owner made is a recorded rejection.
  const reloaded = buildWorkspace((await svc.getResumeJobStatus(documentId, owner)).result!.reviewCandidates as CandidateLike[]);
  const removed = serializeWorkspace(removeItem(reloaded, certId));
  assert.deepEqual(removed.decisions.find((d) => d.candidateId === certId), { candidateId: certId, state: "rejected" });
  assert.equal((await applyResumeReviewForPerson(owner, documentId, removed)).status, 200);
  assert.deepEqual((await userAddedRecords(owner, documentId)).map((a) => a.state), ["rejected"]);
});

// ---------------------------------------------------------------- hardening

test("one contract: a bare list of decisions is refused (it cannot satisfy the required fields); nothing is saved", async () => {
  const { owner, documentId, candidates } = await reviewReady("cvwslegacy");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { decisionsByCandidate } = await import("../lib/services/resume-extraction-persistence");
  const legacy = { decisions: candidates.map((c) => ({ candidateId: c.candidateId, state: "confirmed" })) };
  const res = await applyResumeReviewForPerson(owner, documentId, legacy);
  assert.deepEqual([res.status, res.body.code], [400, "UNSUPPORTED_REVIEW_FORMAT"]);
  assert.equal((await applyResumeReviewForPerson(owner, documentId, null)).status, 400);
  assert.equal((await applyResumeReviewForPerson(owner, documentId, { workspaceVersion: 2, decisions: [], additions: [] })).status, 400);
  assert.equal((await decisionsByCandidate(owner, documentId)).size, 0);
});

test("crafted payloads cannot bypass the checks: one-line corrections, several current educations, emptied items, stale ids", async () => {
  const { owner, documentId, candidates } = await reviewReady("cvwscraft");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { listRecords } = await import("../lib/services/resume-extraction-persistence");
  const { ws, eduId } = studentReview(candidates);
  const good = serializeWorkspace(ws);
  const swap = (p: typeof good, id: string, patch: Record<string, unknown>) => ({ ...p, decisions: p.decisions.map((d) => (d.candidateId === id ? { ...d, ...patch } : d)) });

  const badEmail = swap(good, "profile_email", { correctedValue: "not-an-email" });
  const r1 = await applyResumeReviewForPerson(owner, documentId, badEmail);
  assert.deepEqual([r1.status, (r1.body.problems as Array<{ field: string }>).map((p) => p.field)], [422, ["email"]], "a correction without fields is validated as the field's value");
  assert.ok(!JSON.stringify(r1.body).includes("not-an-email"));

  const emptied = swap(good, "skill_0", { fields: { name: "" } });
  assert.equal((await applyResumeReviewForPerson(owner, documentId, emptied)).status, 400, "a confirmed item with nothing in it is malformed");

  const stale = { ...good, decisions: [...good.decisions, { candidateId: "skill_999", state: "confirmed" as const }] };
  const incompleteStale = { ...stale, decisions: stale.decisions.filter((d) => d.candidateId !== "profile_fullName") };
  assert.equal((await applyResumeReviewForPerson(owner, documentId, incompleteStale)).status, 409, "a stale review is refused before validation");

  // Two records claim to be current: exactly one (the validated one) is stored.
  const other = candidates.find((c) => c.category === "education" && c.candidateId !== eduId)!.candidateId;
  const twoCurrent = { ...good, decisions: good.decisions.map((d) => (d.candidateId === other ? { ...d, state: "confirmed" as const, currentEducation: true } : d)) };
  assert.equal((await applyResumeReviewForPerson(owner, documentId, twoCurrent)).status, 200);
  const flagged = (await listRecords(owner, documentId)).filter((r) => (r.data as { currentEducation?: boolean }).currentEducation).map((r) => r.candidateId);
  assert.deepEqual(flagged, [eduId]);
});

test("current education: several records, switching the current one, status-dependent dates, deselection and empty required fields", async () => {
  const { svc, owner, documentId, candidates } = await reviewReady("cvwscur");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { listRecords } = await import("../lib/services/resume-extraction-persistence");
  const now = new Date();
  const y = now.getUTCFullYear();
  const review = studentReview(candidates);
  const eduId = review.eduId;
  let ws = review.ws;
  const xii = candidates.find((c) => c.category === "education" && c.candidateId !== eduId)!.candidateId;
  const send = async (w: Workspace) => applyResumeReviewForPerson(owner, documentId, serializeWorkspace(w));
  const fields = async (w: Workspace) => ((await send(w)).body.problems as Array<{ field: string }> | undefined)?.map((p) => p.field) ?? [];

  // The student can review and edit an incomplete profile; only the save is refused.
  assert.deepEqual(await fields(setValue(ws, eduId, "status", "Graduated")), [], "Graduated with a past date is fine");
  assert.deepEqual(await fields(setValue(setValue(ws, eduId, "status", "Graduated"), eduId, "endDate", `May ${y + 1}`)), ["endDate"]);
  assert.deepEqual(await fields(setValue(setValue(ws, eduId, "status", "Pursuing"), eduId, "endDate", `May ${y - 1}`)), ["endDate"]);
  assert.deepEqual(await fields(setValue(setValue(ws, eduId, "status", "Pursuing"), eduId, "endDate", `May ${y + 1}`)), []);
  assert.ok((await fields(setSelected(ws, eduId, false))).includes("currentEducation"), "an unticked current education (and its unsent edits) is not saved");
  assert.deepEqual(await fields(setValue(ws, eduId, "institution", "")), ["institution"]);
  const afterRemove = await fields(removeItem(ws, eduId));
  assert.ok(["currentEducation", "fieldOfStudy", "status"].every((f) => afterRemove.includes(f)), `removing it makes the next record current, which must be ticked and complete: ${afterRemove}`);
  const status = await svc.getResumeJobStatus(documentId, owner);
  assert.ok(status.result, "the review can still be loaded and edited after refused saves");

  // Switch the current education to the second record, completed by the student.
  ws = setSelected(ws, xii, true);
  for (const [k, v] of Object.entries({ institution: "Kendriya Vidyalaya Pune", fieldOfStudy: "Science", status: "Graduated", startDate: "2020", endDate: "2022" })) ws = setValue(ws, xii, k, v);
  assert.equal((await send(setCurrentEducation(ws, eduId))).status, 200);
  assert.equal((await send(setCurrentEducation(ws, xii))).status, 200);
  const flagged = (await listRecords(owner, documentId)).filter((r) => (r.data as { currentEducation?: boolean }).currentEducation).map((r) => r.candidateId);
  assert.deepEqual(flagged, [xii], "the marker moved; the earlier current record is no longer marked");
  const reloaded = buildWorkspace((await svc.getResumeJobStatus(documentId, owner)).result!.reviewCandidates as CandidateLike[]);
  assert.equal(reloaded.currentEducationId, xii);
});

test("reprocessing: decisions stay with their record when the order changes, and a record no longer found does not lend its decision", async () => {
  await setupTestDatabase();
  const svc = await import("../lib/services/resume-ingestion-service");
  const p = await import("../lib/services/resume-extraction-persistence");
  const owner = await createTestPerson("cvwsorder");
  const { jobId, documentId } = await svc.queueResumeUpload({ personId: owner, filename: "cv.txt", mimeType: "text/plain", bytes: Buffer.from("x") });
  const A = { category: "education", value: "A", sourceSpan: "A", recordData: { institution: "Alpha", degree: "BSc" } };
  const B = { category: "education", value: "B", sourceSpan: "B", recordData: { institution: "Beta", degree: "MSc" } };
  const state = async () => Object.fromEntries([...(await p.decisionsByCandidate(owner, documentId))].map(([k, v]) => [k, v.state]));
  await p.persistExtraction({ personId: owner, documentId, jobId, candidates: [{ ...A, candidateId: "education_0" }, { ...B, candidateId: "education_1" }], llmUsed: false });
  await p.recordDecisions(owner, documentId, [{ candidateId: "education_0", state: "confirmed" }, { candidateId: "education_1", state: "rejected" }]);
  await p.persistExtraction({ personId: owner, documentId, jobId, candidates: [{ ...B, candidateId: "education_0" }, { ...A, candidateId: "education_1" }], llmUsed: false });
  assert.deepEqual(await state(), { education_0: "rejected", education_1: "confirmed" }, "Beta stays rejected and Alpha confirmed");
  await p.persistExtraction({ personId: owner, documentId, jobId, candidates: [{ ...B, candidateId: "education_0" }], llmUsed: false });
  assert.deepEqual(await state(), { education_0: "rejected" });
  const rows = await p.listRecords(owner, documentId);
  assert.equal(rows.length, 2, "nothing is duplicated");
  assert.equal(rows.find((r) => (r.data as { record?: { institution?: string } }).record?.institution === "Alpha")!.reviewStatus, "confirmed", "the decision itself is kept");
});

test("persistence: no duplicate additions, removals stay removed, unchanged saves write nothing", async () => {
  const { svc, owner, documentId, candidates } = await reviewReady("cvwsidem");
  const { applyResumeReviewForPerson } = await import("../lib/services/resume-review-apply");
  const { userAddedRecords, listRecords } = await import("../lib/services/resume-extraction-persistence");
  const { getDb, resumeDocuments, resumeReviewHistory } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const { ws, certId } = studentReview(candidates);
  const p1 = serializeWorkspace(ws);
  assert.equal((await applyResumeReviewForPerson(owner, documentId, p1)).status, 200);
  assert.equal((await applyResumeReviewForPerson(owner, documentId, p1)).status, 200, "a retried save");
  assert.equal((await userAddedRecords(owner, documentId)).length, 1);

  const snapshot = async () => {
    const [doc] = await db.select().from(resumeDocuments).where(eq(resumeDocuments.id, documentId));
    const history = await db.select().from(resumeReviewHistory).where(eq(resumeReviewHistory.documentId, documentId));
    const rows = await listRecords(owner, documentId);
    return { docAt: doc.updatedAt.getTime(), profile: JSON.stringify(doc.extractedProfile), history: history.length, rowsAt: rows.map((r) => `${r.id}:${r.updatedAt.getTime()}`).sort().join() };
  };
  const before = await snapshot();
  const reloaded = buildWorkspace((await svc.getResumeJobStatus(documentId, owner)).result!.reviewCandidates as CandidateLike[]);
  const res = await applyResumeReviewForPerson(owner, documentId, serializeWorkspace(reloaded));
  assert.deepEqual([res.status, res.body.recordsUpdated, res.body.added], [200, 0, 0]);
  assert.deepEqual(await snapshot(), before, "an unchanged save rewrites no row, profile or history");

  // Removed addition and rejected suggestion stay that way through reprocessing.
  assert.equal((await applyResumeReviewForPerson(owner, documentId, serializeWorkspace(removeItem(reloaded, certId)))).status, 200);
  const again = await svc.requeueResumeDocument(owner, documentId);
  await svc.processResumeJob(again!, owner);
  const after = buildWorkspace((await svc.getResumeJobStatus(documentId, owner)).result!.reviewCandidates as CandidateLike[]);
  assert.equal(after.items.find((i) => i.id === certId)!.removed, true, "the removed addition does not come back");
  assert.equal(after.items.find((i) => i.id === "skill_1")!.saved, "rejected");
  assert.equal(serializeWorkspace(after).additions.length, 0);
  assert.equal((await userAddedRecords(owner, documentId)).length, 1, "still one row for it, never a second");
});

test("evidence: a value the student typed or changed never keeps CV evidence that does not contain it", async () => {
  const { applyReviewDecisions } = await import("../lib/services/resume-review-decisions");
  const ev = (snippet: string) => [{ page: 1, section: "education", snippet, method: "txt" as const }];
  const field = (value: string, snippet: string) => ({ value, original_value: value, evidence: ev(snippet), confidence: 0.9, confidence_kind: "heuristic" as const, review_state: "extracted" as const, history: [] });
  const line = "B.Tech in Computer Science, Vellore Institute of Technology, 2022 – 2026";
  const profile = { schema_version: "2.0" as const, document_id: "d", metadata: {} as never, groups: { education: [{ record_id: "edu_0", record_state: "extracted" as const, fields: {
    qualification: field("B.Tech", line), institution: field("", line), specialization: field("Computer Science", line), expected_graduation: field("2026", line),
  } }] } };
  const out = applyReviewDecisions(profile, new Set(["education_0"]), [{ candidateId: "education_0", state: "confirmed", fields: {
    degree: "B.Tech", institution: "Vellore Institute of Technology", fieldOfStudy: "Data Science", endDate: "June 2026", grade: "9.1",
  } }]).profile.groups.education[0].fields;
  assert.deepEqual(out.institution.evidence, [], "filled in where the extractor found nothing");
  assert.deepEqual(out.specialization.evidence, [], "changed to something the CV line does not say");
  assert.equal(out.qualification.evidence.length, 1, "unchanged keeps its evidence");
  assert.equal(out.expected_graduation.evidence.length, 1, "a year the CV line contains keeps it");
  assert.deepEqual([out.specialization.value, out.specialization.history.at(-1)?.previous_value], ["Data Science", "Computer Science"]);
});

test("request limits: oversized bodies are refused before parsing; invalid JSON is a 400", async () => {
  const { readJsonBodyLimited } = await import("../lib/resume/apply-payload");
  const big = JSON.stringify({ x: "y".repeat(300 * 1024) });
  const req = (body: string, headers: Record<string, string> = {}) => new Request("http://x/", { method: "POST", body, headers });
  assert.equal((await readJsonBodyLimited(req("{}", { "content-length": String(10 * 1024 * 1024) }), 256 * 1024)).tooLarge, true);
  assert.equal((await readJsonBodyLimited(req(big), 256 * 1024)).tooLarge, true);
  assert.deepEqual(await readJsonBodyLimited(req("{not json"), 256 * 1024), { tooLarge: false, body: null });
  assert.deepEqual(await readJsonBodyLimited(req('{"a":1}'), 256 * 1024), { tooLarge: false, body: { a: 1 } });
});

test("consent and defaults: no AI call without an explicit yes; recovery and verification are off unless configured", async () => {
  const { shouldEnrichWithLLM } = await import("../lib/services/resume-extraction-service");
  const { buildResumeReview } = await import("../lib/services/resume-ingestion-service");
  const { IntelligenceRouter } = await import("../lib/intelligence/router");
  const sparse = "Asha Rao\nasha@example.com\nPROJECTS\n- \nSKILLS\nPython";
  const prevEnv = { live: process.env.CORE_DISABLE_LIVE_LLM, rec: process.env.AI_RECOVERY_ENABLED, ver: process.env.AI_VERIFY_ENABLED };
  process.env.CORE_DISABLE_LIVE_LLM = "false";
  delete process.env.AI_RECOVERY_ENABLED;
  delete process.env.AI_VERIFY_ENABLED;
  try {
    for (const consent of [undefined, false]) assert.equal(shouldEnrichWithLLM(null, { consent }).shouldEnrich, false, `consent ${consent}`);
    const tasks: string[] = [];
    const router = new IntelligenceRouter();
    (router as unknown as { providers: unknown[] }).providers = [{
      name: "groq", structuredCapability: "strict_json_schema", isAvailable: () => true,
      completeStructured: async (r: { task: string }) => { tasks.push(r.task); throw new Error("offline test provider"); },
    }];
    const input = { text: sparse, hyperlinks: [], fileFormat: "txt", pageCount: 1, ocrUsed: false, via: "txt" } as never;
    await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: false, router });
    assert.deepEqual(tasks, [], "declined consent: the provider is never called");
    await buildResumeReview(input, { documentId: "d", personId: "p", aiConsent: true, router });
    assert.ok(!tasks.some((t) => t === "RESUME_RECOVERY" || t === "RESUME_VERIFY"), `defaults call neither recovery nor verification: ${tasks.join()}`);
  } finally {
    process.env.CORE_DISABLE_LIVE_LLM = prevEnv.live;
    if (prevEnv.rec !== undefined) process.env.AI_RECOVERY_ENABLED = prevEnv.rec;
    if (prevEnv.ver !== undefined) process.env.AI_VERIFY_ENABLED = prevEnv.ver;
  }
});

test("onboarding completion accepts the claims a saved review produces (edited, unedited and added items)", async () => {
  const { owner, documentId, candidates } = await reviewReady("cvwsclaims");
  const { validateReviewedResumeClaims } = await import("../lib/services/resume-review-service");
  const { workspaceToOnboarding } = await import("../lib/client/onboarding/use-resume-ingestion");
  let { ws } = studentReview(candidates);
  ws = setSectionSelected(ws, "skills", true);
  ws = setValue(ws, "skill_1", "name", "PostgreSQL");
  const added = addRecord(ws, "skill"); ws = setValue(added.ws, added.id, "name", "Docker");
  const kept = ws.items.filter((i) => i.selected && !i.removed && Object.values(i.values).some((v) => v.trim()));
  const { claims, extra } = workspaceToOnboarding(kept, ws, documentId);
  assert.ok(claims.length >= 4, `claims: ${claims.map((c) => c.candidateId).join()}`);
  assert.ok(!claims.some((c) => c.candidateId?.startsWith("user_")), "what the student added is never presented as read from the CV");
  assert.equal(claims.find((c) => c.candidateId === "skill_1")?.corrected, true);
  assert.equal(claims.find((c) => c.candidateId === "skill_0")?.corrected, false);
  await validateReviewedResumeClaims(owner, claims); // the check completeOnboarding runs; throws on any mismatch
  assert.ok(extra.reviewedRecords?.skills?.includes("Docker") && extra.reviewedRecords.skills.includes("PostgreSQL"));
  // A forged claim is still refused.
  await assert.rejects(validateReviewedResumeClaims(owner, [{ ...claims[0], sourceSpan: "not in the CV" }]), /does not match/);
});
