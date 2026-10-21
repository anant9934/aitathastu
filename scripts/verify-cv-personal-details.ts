/**
 * Personal-details extraction: phones, multiple contacts, names, dates of
 * birth, locations and addresses, candidate-versus-other-people details,
 * spoken versus programming languages, formats, persistence of decisions and
 * privacy. Fake AI providers and an in-memory database only.
 *
 *   node --import tsx --test --test-concurrency=1 scripts/verify-cv-personal-details.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setupTestDatabase, createTestPerson } from "./lib/test-db";
import { extractResumeDeterministic } from "../lib/resume/deterministic-extractor";
import { normalizePhone, parseDob, nameParts, locationParts, labelledFields } from "../lib/resume/extract/personal";
import { readDocumentText } from "../lib/resume/document-text";

process.env.CORE_DISABLE_LIVE_LLM = "true";
const NOW = new Date("2026-10-21T00:00:00Z");
const FIX = path.join(process.cwd(), "eval/cv/fixtures");
const pd = (text: string) => extractResumeDeterministic(text, [], { now: NOW }).personalDetails;

test("phones: Indian and international formats normalise without inventing a country code", () => {
  const cases: Array<[string, string, string | undefined, boolean]> = [
    ["+91 98765 43210", "+919876543210", "+91", false],
    ["98765-43210", "+919876543210", "+91", true],
    ["098765 43210", "+919876543210", "+91", true],
    ["0091 99887 76655", "+919988776655", "+91", false],
    ["+44 20 7946 0958", "+442079460958", "+44", false],
    ["+1 (415) 555-0132", "+14155550132", "+1", false],
    ["+971 50 123 4567", "+971501234567", "+971", false],
    ["(718) 555-0199", "7185550199", undefined, false],
    ["718-555-0199", "7185550199", undefined, false],
  ];
  for (const [raw, normalized, cc, inferred] of cases) {
    const p = normalizePhone(raw);
    assert.deepEqual([p.normalized, p.countryCode, Boolean(p.countryCodeInferred)], [normalized, cc, inferred], raw);
  }
});

test("contacts: labels pick the primary; several unlabelled contacts are flagged, not silently chosen", () => {
  const labelled = pd("Asha Rao\nPersonal: asha@example.com | Work: asha.rao@acme.example\nMobile: +91 98765 43210 | Alternate: +91 99887 76655\nEXPERIENCE\nAnalyst | Acme | Jan 2022 – Present");
  assert.deepEqual(labelled.emails.map((e) => [e.value, e.details?.label, e.issues]), [["asha@example.com", "personal", []], ["asha.rao@acme.example", "work", []]]);
  assert.deepEqual(labelled.phones.map((p) => p.details?.label), ["mobile", "alternate"]);
  const unlabelled = pd("Asha Rao\nasha@example.com | asha.rao@acme.example\n+91 98765 43210, +91 99887 76655\nSKILLS\nPython");
  assert.deepEqual([unlabelled.emails[0].issues, unlabelled.emails[0].status, unlabelled.phones[0].issues], [["multiple_emails"], "needs_review", ["multiple_phones"]]);
});

test("someone else's details: employer and referee contacts, employer links and parents are never the candidate's", () => {
  const d = extractResumeDeterministic([
    "Ravi Menon", "ravi.menon@example.com | +91 98765 43210",
    "EXPERIENCE", "Engineer | Acme Corp | Jan 2021 – Present", "- Reported to lead.priya@acme.example; contributed to github.com/acme-oss.",
    "PERSONAL DETAILS", "Father's Name: Suresh Menon", "Date of Birth: 12 March 2001",
    "REFERENCES", "Dr. Anil Kumar | anil.k@college.example | +91 94470 11111 | linkedin.com/in/anil-kumar-prof",
  ].join("\n"), [], { now: NOW });
  const p = d.personalDetails;
  assert.deepEqual(p.emails.map((e) => e.value), ["ravi.menon@example.com"]);
  assert.deepEqual(p.phones.map((x) => x.normalized), ["+919876543210"]);
  assert.equal(p.fullName?.value, "Ravi Menon");
  assert.ok(!d.links.some((l) => /acme-oss|anil-kumar/.test(l.url)), JSON.stringify(d.links));

  // No contact block at all: an email elsewhere is offered, but flagged as possibly someone else's.
  const only = pd("Ravi Menon\nEXPERIENCE\nEngineer | Acme Corp | Jan 2021 – Present\n- Contact: ravi.m@example.com for the project archive.");
  assert.deepEqual([only.emails[0]?.value, only.emails[0]?.confidence, only.emails[0]?.issues], ["ravi.m@example.com", "low", ["email_outside_contact"]]);
});

test("names: initials and long names stay unsplit; hyphens, diacritics and pronouns are kept", () => {
  assert.equal(nameParts("A. P. J. Abdul Kalam"), null);
  assert.equal(nameParts("Priya S. Nair"), null);
  assert.equal(nameParts("Madonna"), null);
  assert.deepEqual(nameParts("Lucía Fernández-García"), { first: "Lucía", last: "Fernández-García" });
  assert.deepEqual(nameParts("Rohan Kumar Verma"), { first: "Rohan", middle: "Kumar", last: "Verma" });
  const d = pd("Zoë O'Brien-Iyer (she/her)\nzoe@example.com\nSKILLS\nPython");
  assert.equal(d.fullName?.value, "Zoë O'Brien-Iyer");
  assert.equal(d.pronouns?.value, "she/her");
  assert.deepEqual(d.fullName?.details?.nameParts, { first: "Zoë", last: "O'Brien-Iyer" });
});

test("date of birth: only a labelled date; ambiguous and impossible dates are flagged, never guessed", () => {
  assert.deepEqual(parseDob("12 March 2001", NOW), { ambiguous: false, valid: true, iso: "2001-03-12" });
  assert.deepEqual(parseDob("March 12, 2001", NOW), { ambiguous: false, valid: true, iso: "2001-03-12" });
  assert.deepEqual(parseDob("25/12/2000", NOW), { ambiguous: false, valid: true, iso: "2000-12-25" });
  assert.deepEqual(parseDob("05/04/2001", NOW), { ambiguous: true, valid: true });
  assert.equal(parseDob("31/02/2001", NOW).valid, false);
  assert.equal(parseDob("2025-01-01", NOW).valid, false, "too recent to be a student's birth date");
  const d = pd("Asha Rao\nasha@example.com\nPERSONAL DETAILS\nDOB: 05/04/2001\nEDUCATION\nVIT Vellore | B.Tech | Jul 2019 – May 2023");
  assert.deepEqual([d.dateOfBirth?.value, d.dateOfBirth?.status, d.dateOfBirth?.issues, d.dateOfBirth?.normalized], ["05/04/2001", "needs_review", ["ambiguous_date"], undefined]);
  assert.equal(pd("Asha Rao\nasha@example.com\nEDUCATION\nVIT Vellore | B.Tech | 12 Jul 2019 – May 2023").dateOfBirth, undefined, "education dates are not a birth date");
});

test("locations and addresses: parts from the gazetteer, labelled addresses only, education addresses ignored", () => {
  assert.deepEqual(locationParts("Kochi, Kerala, India 682020"), { postalCode: "682020", city: "Kochi", state: "Kerala", country: "India" });
  const d = pd("Asha Rao\nasha@example.com | Pune, Maharashtra\nPERSONAL DETAILS\nPermanent Address: 14 Lake View Road, Nagpur, Maharashtra 440010\nEDUCATION\nIIT Madras, Chennai 600036 | B.Tech | 2019 – 2023");
  assert.deepEqual([d.location?.value, d.location?.details?.city, d.location?.details?.state], ["Pune, Maharashtra", "Pune", "Maharashtra"]);
  assert.deepEqual(d.addresses.map((a) => [a.value, a.details?.kind, a.details?.postalCode]), [["14 Lake View Road, Nagpur, Maharashtra 440010", "permanent", "440010"]]);
  const noLoc = pd("Asha Rao\nasha@example.com\nEDUCATION\nIIT Madras, Chennai | B.Tech | 2019 – 2023");
  assert.equal(noLoc.location, undefined, "a university's city is not the candidate's location");
  assert.deepEqual(labelledFields("Nationality: Indian | Marital Status: Single | Religion: X").map((f) => f.field), ["nationality"]);
});

test("professional profile: current role, employer and total experience are derived and marked so", () => {
  const d = pd("Asha Rao\nasha@example.com\nEXPERIENCE\nData Analyst | Infosys | Jul 2022 – Present\nAnalyst Intern | Deloitte | Jan 2022 – Jun 2022\nJunior Analyst | TCS | Jan 2020 – Dec 2022\nWork Authorization: Indian citizen");
  assert.deepEqual([d.currentRole?.value, d.currentEmployer?.value, d.currentRole?.method], ["Data Analyst", "Infosys", "derived"]);
  assert.equal(d.experienceDuration?.details?.months, 82, "Jan 2020 to Oct 2026, overlap counted once, internship excluded");
  assert.equal(pd("Asha Rao\nasha@example.com\nEXPERIENCE\nAnalyst | Acme | 2019 – 2021").experienceDuration, undefined, "year-only dates are not calculable");
});

test("spoken and programming languages stay apart", () => {
  const r = extractResumeDeterministic("Asha Rao\nasha@example.com\nSKILLS\nLanguages: Python, Java, SQL\nLANGUAGES\nEnglish (Fluent), Tamil (Native)", [], { now: NOW }).interpretation;
  assert.deepEqual(r.skills.map((s) => s.name).sort(), ["Java", "Python", "SQL"]);
  assert.deepEqual((r.languages ?? []).map((l) => [l.language, l.proficiency]), [["English", "Fluent"], ["Tamil", "Native"]]);
});

test("formats: PDF, DOCX hyperlinks, TXT and RTF carry the same personal details", async () => {
  const read = async (f: string, ext: "pdf" | "docx" | "txt" | "rtf") => {
    const doc = await readDocumentText(fs.readFileSync(path.join(FIX, f)), ext);
    return extractResumeDeterministic(doc.text, doc.hyperlinks, { lines: doc.lines, now: NOW });
  };
  for (const [f, ext] of [["ishaan-modern--pdf-single.pdf", "pdf"], ["ishaan-modern--docx-plain.docx", "docx"], ["ishaan-modern--rtf.rtf", "rtf"]] as const) {
    const r = await read(f, ext);
    assert.equal(r.personalDetails.fullName?.value, "Ishaan Kapoor", f);
    assert.deepEqual(r.personalDetails.emails.map((e) => e.value), ["ishaan.kapoor.dev@example.com"], f);
    assert.equal(r.personalDetails.location?.details?.city, "Pune", f);
  }
  const txt = await read("arvind-compact--txt.txt", "txt");
  assert.deepEqual([txt.personalDetails.phones[0]?.normalized, txt.personalDetails.phones[0]?.details?.countryCode], ["+919845077881", "+91"]);
  const docx = await read("meera-research--docx-plain.docx", "docx");
  assert.ok(docx.links.some((l) => /orcid\.org\/0000-0002-1825-0097/.test(l.url)), "DOCX hyperlinks are kept");
});

test("persistence: personal-field decisions and corrections survive reload and reprocessing", async () => {
  await setupTestDatabase();
  const { queueResumeUpload, processResumeJob, getResumeJobStatus, requeueResumeDocument } = await import("../lib/services/resume-ingestion-service");
  const { recordDecisions } = await import("../lib/services/resume-extraction-persistence");
  const owner = await createTestPerson("cvpersonal");
  const other = await createTestPerson("cvpersonal2");
  const text = "Asha Rao\nasha@example.com | asha.alt@example.com\n+91 98765 43210\nPune, Maharashtra\nPERSONAL DETAILS\nDate of Birth: 12 March 2001\nSKILLS\nPython, SQL";
  const { jobId, documentId } = await queueResumeUpload({ personId: owner, filename: "cv.txt", mimeType: "text/plain", bytes: Buffer.from(text) });
  await processResumeJob(jobId, owner);
  const first = await getResumeJobStatus(documentId, owner, jobId);
  assert.equal(first.status, "review_ready", first.message ?? "");
  const ids = first.result!.reviewCandidates.filter((c) => c.category === "profile").map((c) => c.candidateId);
  for (const id of ["profile_fullName", "profile_email", "profile_alternateEmail", "profile_mobile", "profile_location", "profile_dateOfBirth"]) assert.ok(ids.includes(id), id);
  const dob = first.result!.reviewCandidates.find((c) => c.candidateId === "profile_dateOfBirth")!;
  assert.deepEqual([(dob.recordData as { normalized?: string }).normalized, (dob.recordData as { confidenceLevel?: string }).confidenceLevel], ["2001-03-12", "high"]);

  await recordDecisions(owner, documentId, [
    { candidateId: "profile_email", state: "confirmed", correctedValue: "asha.rao@example.com" },
    { candidateId: "profile_alternateEmail", state: "rejected" },
  ]);
  const again = await requeueResumeDocument(owner, documentId);
  await processResumeJob(again!, owner);
  const after = await getResumeJobStatus(documentId, owner, again);
  const email = after.result!.reviewCandidates.find((c) => c.candidateId === "profile_email")!;
  const alt = after.result!.reviewCandidates.find((c) => c.candidateId === "profile_alternateEmail")!;
  assert.deepEqual([email.decision, email.decidedValue, alt.decision], ["confirmed", "asha.rao@example.com", "rejected"], "reprocessing keeps the student's decisions");
  assert.equal((await getResumeJobStatus(documentId, other, again)).httpStatus, 404, "another student cannot read them");
  assert.deepEqual(await recordDecisions(other, documentId, [{ candidateId: "profile_email", state: "rejected" }]), { updated: 0, unchanged: 0, added: 0 });
});

test("privacy: labelled personal details and contacts never reach an AI prompt", async () => {
  const { sanitizeTextForModel } = await import("../lib/intelligence/context-firewall");
  const out = sanitizeTextForModel("Asha Rao\nasha@example.com | +91 98765 43210\nDate of Birth: 12 March 2001\nPermanent Address: 14 Lake View Road, Nagpur 440010\nAadhaar: 2345 6789 0123\nDriving Licence: MH31 20190012345\nFather's Name: Suresh Rao\nWorked 2019 2020 2021 at Acme");
  for (const secret of ["asha@example.com", "98765", "12 March 2001", "Lake View", "2345 6789", "MH31", "Suresh"]) assert.ok(!out.includes(secret), secret);
  assert.ok(out.includes("2019 2020 2021"), "years are not mistaken for an ID");
});

test("images: personal details survive the OCR path (local extractor, no network)", async (t) => {
  const py = path.join(process.cwd(), "services/resume-extractor/.venv/bin/python");
  if (!fs.existsSync(py)) { t.skip("Python extractor venv not installed"); return; }
  const { ocrPayload } = await import("../eval/cv/pipeline");
  const { textFromExtractorPayload } = await import("../lib/services/resume-ingestion-service");
  let raw;
  try {
    process.env.PATH = `${path.dirname(process.execPath)}:${process.env.PATH}`;
    raw = ocrPayload(path.join(FIX, "kabir-internships--png.png"));
  } catch {
    t.skip("Tesseract is not available locally");
    return;
  }
  const { text, hyperlinks, lines, pageQuality } = textFromExtractorPayload(raw as never);
  const d = extractResumeDeterministic(text, hyperlinks, { lines, method: "ocr", pageQuality, now: NOW }).personalDetails;
  assert.equal(d.fullName?.value, "Kabir Singh");
  assert.equal(d.emails[0]?.value, "kabir.singh@example.in");
});
