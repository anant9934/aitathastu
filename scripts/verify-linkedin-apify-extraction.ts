/**
 * LinkedIn extraction: normalization, configuration and static guarantees.
 * Offline: no network, no database, no tokens.
 *
 *   node --import tsx --test scripts/verify-linkedin-apify-extraction.ts
 *
 * The durable job, persistence and provider failures are covered against a
 * local database in scripts/verify-linkedin-extraction.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeLinkedInProfile, parsePartialDate, cleanUrl, linkedinIdentifier, text,
  ProfileMismatchError, MalformedProviderOutputError,
} from "../lib/linkedin/normalize";
import { getLinkedInExtractionConfig as getConfig, toEvidence } from "../lib/services/linkedin-extraction-service";
import { validateLinkedInUrl } from "../lib/connectors/linkedin/client";

const URL_ = "https://www.linkedin.com/in/asha-rao";

test("dates keep exactly the precision the source gave", () => {
  assert.deepEqual(parsePartialDate("Jan 2020"), { year: 2020, month: 1 });
  assert.deepEqual(parsePartialDate("September 2021"), { year: 2021, month: 9 });
  assert.deepEqual(parsePartialDate("Sept 2021"), { year: 2021, month: 9 });
  assert.deepEqual(parsePartialDate("2020-03"), { year: 2020, month: 3 });
  assert.deepEqual(parsePartialDate("2024-02-10"), { year: 2024, month: 2 });
  assert.deepEqual(parsePartialDate("03/2019"), { year: 2019, month: 3 });
  assert.deepEqual(parsePartialDate("2018"), { year: 2018 }, "a year is not turned into January");
  assert.deepEqual(parsePartialDate(2018), { year: 2018 });
  assert.deepEqual(parsePartialDate({ year: 2022, month: 13 }), { year: 2022 });
  for (const bad of ["Present", "current", "", null, undefined, "soon", "1800", "2020-13", "Smarch 2020", {}]) {
    const d = parsePartialDate(bad);
    assert.ok(d === null || (d.year === 2020 && d.month === undefined), String(bad));
  }
  assert.equal(parsePartialDate("Present"), null);
  assert.equal(parsePartialDate("1800"), null);
});

test("text and URLs are trimmed, capped and made safe", () => {
  assert.equal(text("  a \t b  "), "a b");
  assert.equal(text("x".repeat(500), 10), "x".repeat(10));
  assert.equal(text("\u0000\u0007"), null);
  assert.equal(text({}), null);
  assert.equal(cleanUrl("asha.dev"), "https://asha.dev");
  assert.equal(cleanUrl("https://user:pw@asha.dev"), null);
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(cleanUrl("http://localhost:3000"), null);
  assert.equal(linkedinIdentifier("https://WWW.linkedin.com/in/Asha-Rao/"), "asha-rao");
  assert.equal(linkedinIdentifier("https://evil.example/in/asha-rao"), null);
});

test("every category maps from the configured actor's output shape", () => {
  const r = normalizeLinkedInProfile({
    fullName: "Asha Rao", headline: "ML engineer", about: "About me", location: "Pune", publicIdentifier: "asha-rao",
    experiences: [{ title: "Engineer", company: "Acme", startDate: "Jul 2024", endDate: "Present", jobStillWorking: true, employmentType: "Full-time" }],
    educations: [{ school: "IIT Bombay", degree: "B.Tech", fieldOfStudy: "CS", startYear: 2020, endYear: 2024 }],
    skills: ["Python", { name: "PyTorch" }, { title: "SQL" }, "python"],
    languages: ["Hindi", { name: "English", proficiency: "Native or bilingual" }],
    certifications: [{ name: "AWS CCP", issuer: "AWS", issueDate: "Mar 2023", credentialUrl: "https://aws.example/cert/1" }],
    courses: ["Algorithms", { title: "Deep Learning", number: "CS230" }],
    projects: [{ title: "RAG search", url: "https://github.com/asha/rag" }],
    publications: [{ title: "Paper", publisher: "arXiv", date: "2024" }],
    volunteerExperiences: [{ organization: "Code Club", role: "Mentor" }],
    honorsAwards: ["Hackathon winner"],
    websites: ["https://asha.dev"],
    articles: [{ headline: "My article", datePublished: "2024-02-10" }],
  }, URL_);
  const by = (k: string) => r.records.filter((x) => x.kind === k);
  assert.equal(r.profile.fullName, "Asha Rao");
  assert.equal(r.profile.publicIdentifier, "asha-rao");
  assert.deepEqual(by("experience")[0].data, { title: "Engineer", company: "Acme", employmentType: "Full-time", startDate: "2024-07", current: true });
  assert.deepEqual(by("education")[0].data, { institution: "IIT Bombay", degree: "B.Tech", fieldOfStudy: "CS", startDate: "2020", endDate: "2024" });
  assert.deepEqual(by("skill").map((x) => x.data.name), ["Python", "PyTorch", "SQL"], "deduplicated case-insensitively");
  assert.deepEqual(by("language").map((x) => x.data), [{ name: "Hindi" }, { name: "English", proficiency: "Native or bilingual" }], "no invented proficiency");
  assert.equal(by("certification")[0].data.issueDate, "2023-03");
  assert.equal(by("course").length, 2);
  assert.equal(by("project")[0].data.url, "https://github.com/asha/rag");
  assert.deepEqual(by("publication").map((x) => x.data.title), ["Paper", "My article"]);
  assert.equal(by("volunteering")[0].data.role, "Mentor");
  assert.equal(by("honor")[0].data.title, "Hackathon winner");
  assert.equal(by("link")[0].data.url, "https://asha.dev");
  assert.equal(r.sectionsReturned.length, 11);
});

test("other people's data, posts, counts and images are never kept", () => {
  const r = normalizeLinkedInProfile({
    fullName: "Asha Rao", publicIdentifier: "asha-rao", followersCount: 900, connectionsCount: 500, profilePicture: "https://img.example/a.jpg",
    peopleAlsoViewed: [{ fullName: "Someone Else", profileUrl: "https://www.linkedin.com/in/someone-else" }],
    updates: [{ text: "Hello" }], experiences: [],
  }, URL_);
  const all = JSON.stringify(r);
  for (const leaked of ["Someone Else", "someone-else", "Hello", "img.example", "900", "500"]) assert.ok(!all.includes(leaked), leaked);
});

test("missing data is never filled in; malformed records are counted, not guessed", () => {
  const r = normalizeLinkedInProfile({ experiences: [{ title: "No company" }, "junk", { company: "Acme", title: "Dev" }], educations: [{ degree: "BSc" }] }, URL_);
  assert.equal(r.records.filter((x) => x.kind === "experience").length, 1);
  assert.equal(r.rejected.experience, 2);
  assert.equal(r.rejected.education, 1);
  assert.equal(r.profile.fullName, null);
  assert.equal(r.profile.headline, null);
  assert.ok(!r.sectionsReturned.includes("skill"), "an absent section is reported as absent, not empty");
});

test("record keys are deterministic, so a re-run upserts instead of duplicating", () => {
  const raw = { experiences: [{ title: "Dev", company: "Acme", startDate: "Jan 2020" }], skills: ["Go"] };
  const a = normalizeLinkedInProfile(raw, URL_).records.map((x) => `${x.kind}:${x.key}`);
  const b = normalizeLinkedInProfile(JSON.parse(JSON.stringify(raw)), URL_).records.map((x) => `${x.kind}:${x.key}`);
  assert.deepEqual(a, b);
  const evidenceKeys = toEvidence(normalizeLinkedInProfile(raw, URL_).records, URL_).map((e) => e.importKey);
  assert.deepEqual(evidenceKeys, ["linkedin_apify_exp_acme_dev", "linkedin_apify_skill_go"], "keys match the earlier Apify import's, so old rows are updated");
});

test("a different person's profile is rejected; non-objects are malformed", () => {
  assert.throws(() => normalizeLinkedInProfile({ publicIdentifier: "someone-else" }, URL_), ProfileMismatchError);
  assert.throws(() => normalizeLinkedInProfile({ linkedinUrl: "https://www.linkedin.com/in/someone-else" }, URL_), ProfileMismatchError);
  assert.doesNotThrow(() => normalizeLinkedInProfile({ publicIdentifier: "ASHA-RAO" }, URL_));
  assert.throws(() => normalizeLinkedInProfile(null, URL_), MalformedProviderOutputError);
  assert.throws(() => normalizeLinkedInProfile([], URL_), MalformedProviderOutputError);
});

test("evidence is self-declared and never verified", () => {
  const records = normalizeLinkedInProfile({ skills: ["Rust"], certifications: [{ name: "CKA", issuer: "CNCF" }], languages: ["Hindi"], websites: ["https://a.dev"] }, URL_).records;
  const ev = toEvidence(records, URL_);
  assert.deepEqual(ev.map((e) => e.category), ["skill", "other"], "languages and links are not evidence");
  assert.ok(ev.every((e) => e.originSource === "linkedin" && e.verificationStatus === "imported" && e.source === "imported"));
});

test("URL validation accepts only linkedin.com/in profiles", () => {
  assert.equal(validateLinkedInUrl("linkedin.com/in/asha-rao").normalizedUrl, URL_);
  assert.equal(validateLinkedInUrl("asha-rao").normalizedUrl, URL_);
  for (const bad of ["https://evil.example/in/asha", "https://www.linkedin.com/company/acme", "https://www.linkedin.com/in/asha/details/skills", "ftp://linkedin.com/in/asha", ""]) {
    assert.equal(validateLinkedInUrl(bad).valid, false, bad);
  }
});

test("configuration comes from variable presence only", () => {
  const ok = { APIFY_LINKEDIN_ACTOR_ID: "owner/actor", APIFY_LINKEDIN_TERMS_ACKNOWLEDGED: "true" };
  const getLinkedInExtractionConfig = (env: Record<string, string>) => getConfig(env as unknown as NodeJS.ProcessEnv);
  const saved = { ...process.env };
  try {
    for (const k of Object.keys(process.env)) if (k.startsWith("APIFY_")) delete process.env[k];
    assert.equal(getLinkedInExtractionConfig({ ...ok }).configured, false, "no token");
    process.env.APIFY_TOKEN_1 = "test-token-not-real";
    assert.equal(getLinkedInExtractionConfig({ ...ok }).configured, true);
    assert.equal(getLinkedInExtractionConfig({ ...ok, APIFY_LINKEDIN_TERMS_ACKNOWLEDGED: "" }).configured, false);
    assert.equal(getLinkedInExtractionConfig({ APIFY_LINKEDIN_TERMS_ACKNOWLEDGED: "true" }).configured, false);
    assert.equal(getLinkedInExtractionConfig({ ...ok, APIFY_LINKEDIN_ACTOR_ID: "../../etc" }).configured, false, "a malformed actor id is refused");
    for (const r of [getLinkedInExtractionConfig({}), getLinkedInExtractionConfig({ ...ok })]) assert.ok(!JSON.stringify(r).includes("test-token-not-real"));
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("the export upload path is gone and secrets stay server-side", () => {
  assert.ok(!fs.existsSync("app/api/student/linkedin/import/route.ts"), "export upload route removed");
  assert.ok(!fs.existsSync("lib/services/apify-linkedin-service.ts"), "old single-request service removed");
  const card = fs.readFileSync("components/connections/LinkedInConnect.tsx", "utf8");
  assert.ok(!/type="file"|FormData|linkedin\/import|data export file/i.test(card), "no upload UI");
  assert.match(card, /Extract LinkedIn Profile/);
  const orchestrator = fs.readFileSync("lib/services/digital-source-import-orchestrator.ts", "utf8");
  assert.ok(!/parseLinkedIn(ZipArchive|DataExport)/.test(orchestrator));
  const svc = fs.readFileSync("lib/services/linkedin-extraction-service.ts", "utf8");
  assert.ok(!/NEXT_PUBLIC_/.test(svc + card));
  assert.ok(!/logger\.\w+\([^)]*token[^R]/i.test(svc), "tokens are never logged");
  const env = fs.readFileSync(".env.example", "utf8");
  for (const k of ["APIFY_LINKEDIN_ACTOR_ID=", "APIFY_LINKEDIN_TERMS_ACKNOWLEDGED=", "APIFY_TOKEN_1=", "FIRECRAWL_API_KEY_1="]) assert.ok(env.includes(`\n${k}\n`), `${k} is an empty placeholder`);
});
