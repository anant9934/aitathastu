/**
 * Onboarding account/draft integrity checks against a live local dev server.
 *
 *   node --import tsx scripts/verify-onboarding-integrity-local.ts
 *
 * Covers: guest progress (draft + CV) merged into an existing account on
 * sign-in; the account's own draft winning when both exist; no
 * cross-contamination between two accounts; a resubmitted correction
 * updating evidence; and completing onboarding twice not duplicating rows.
 */
import fs from "node:fs";
import path from "node:path";
import { reviewPayload } from "./lib/review-payload";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CV = path.join(process.cwd(), "scripts", "fixtures", "test_student_cv.pdf");
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures++;
}

class Browser {
  cookie = "";
  ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  async req(method: string, url: string, body?: FormData | Record<string, unknown>) {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip };
    if (this.cookie) headers.cookie = this.cookie;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(`${BASE}${url}`, { method, headers, body: payload, redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    if (sc) this.cookie = sc.split(";")[0];
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json };
  }
  async uploadCv() {
    const form = new FormData();
    form.append("resume", new Blob([fs.readFileSync(CV)], { type: "application/pdf" }), "cv.pdf");
    form.append("consent", "true");
    form.append("aiConsent", "true");
    const up = await this.req("POST", "/api/resume/extract", form);
    for (let i = 0; i < 60; i++) {
      const st = await this.req("GET", `/api/resume/${up.json.documentId}/status`);
      if (st.json?.status === "review_ready") return { documentId: up.json.documentId as string, result: st.json.result };
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("CV did not reach review_ready");
  }
}

const unique = () => Math.random().toString(36).slice(2, 8);
const studentBody = (extra: Record<string, unknown> = {}) => ({
  version: 2, role: "student", name: "Integrity Tester", targetRole: "ML Engineer", goal: "Get an internship",
  priorities: ["learning"], primaryPriority: "learning", degree: "B.Tech", specialization: "CSE",
  institution: "Test University", year: "3rd Year", skills: ["Python"], projects: [], resumeReviewed: [], profiles: {}, ...extra,
});

async function main() {
  // Existing account R with no onboarding draft.
  const rEmail = `r_${unique()}@example.test`;
  const r = new Browser();
  check("sign up account R", (await r.req("POST", "/api/auth/sign-up", { email: rEmail, password: "password123", name: "Account R" })).status === 200);

  // A different visitor works as a guest: draft + CV.
  const g = new Browser();
  await g.req("PUT", "/api/onboarding-v2", { version: 2, currentScreen: 5, name: "Guest Name", targetRole: "Data Scientist" });
  const cv = await g.uploadCv();
  await g.req("PUT", "/api/onboarding-v2", { version: 2, resumeDocumentId: cv.documentId, resumeFileName: "cv.pdf" });
  check("guest applies CV review", (await g.req("POST", `/api/resume/${cv.documentId}/apply`, reviewPayload(cv.result.reviewCandidates))).json?.ok === true);

  // ...then signs in to R from the same browser.
  const signIn = await g.req("POST", "/api/auth/sign-in", { email: rEmail, password: "password123" });
  check("guest signs in to R", signIn.status === 200);
  const draftAfter = await g.req("GET", "/api/onboarding-v2");
  check("guest draft merged into R (R had none)", draftAfter.json?.draft?.targetRole === "Data Scientist" && draftAfter.json?.draft?.resumeDocumentId === cv.documentId, draftAfter.json?.draft);
  check("guest CV document now readable as R", (await g.req("GET", `/api/resume/${cv.documentId}`)).status === 200);
  const p360 = await g.req("GET", "/api/student/person-360");
  const resumeSkills = (p360.json?.evidence ?? []).filter((e: any) => e.source === "resume").map((e: any) => e.subject);
  check("guest's imported CV evidence now on R", resumeSkills.length > 0, resumeSkills);

  // R in another browser sees the same merged state.
  check("R's own session sees merged draft", (await r.req("GET", "/api/onboarding-v2")).json?.draft?.targetRole === "Data Scientist");

  // Account S has its own draft; a guest with a different draft signs in to S.
  const sEmail = `s_${unique()}@example.test`;
  const s = new Browser();
  await s.req("POST", "/api/auth/sign-up", { email: sEmail, password: "password123", name: "Account S" });
  await s.req("PUT", "/api/onboarding-v2", { version: 2, currentScreen: 6, targetRole: "Researcher" });
  await s.req("POST", "/api/auth/sign-out");
  const h = new Browser();
  await h.req("PUT", "/api/onboarding-v2", { version: 2, currentScreen: 5, targetRole: "Guest Role H" });
  const cvH = await h.uploadCv();
  await h.req("POST", "/api/auth/sign-in", { email: sEmail, password: "password123" });
  check("account's existing draft wins over guest draft", (await h.req("GET", "/api/onboarding-v2")).json?.draft?.targetRole === "Researcher");
  check("guest CV still carried over to S", (await h.req("GET", `/api/resume/${cvH.documentId}`)).status === 200);

  // No cross-contamination between R and S.
  check("S cannot read R's CV", (await h.req("GET", `/api/resume/${cv.documentId}`)).status === 404);
  check("R cannot read S's CV", (await r.req("GET", `/api/resume/${cvH.documentId}`)).status === 404);
  check("R's draft untouched by S's merge", (await r.req("GET", "/api/onboarding-v2")).json?.draft?.targetRole === "Data Scientist");

  // 4d: a corrected value resubmitted with the same key updates the evidence.
  const first = await r.req("POST", "/api/onboarding-v2", studentBody({ degree: "B.Tech" }));
  check("complete onboarding (first)", first.status === 200, first.json);
  const second = await r.req("POST", "/api/onboarding-v2", studentBody({ degree: "B.E." }));
  check("complete onboarding again with a corrected degree", second.status === 200, second.json);
  const ev = (await r.req("GET", "/api/student/person-360")).json?.evidence ?? [];
  const education = ev.filter((e: any) => e.category === "education" && e.subject.includes("Test University") && e.subject.includes(" · "));
  check("education evidence updated in place to the correction", education.length === 1 && education[0].value.startsWith("B.E."), education.map((e: any) => e.value));
  const python = ev.filter((e: any) => e.category === "skill" && e.subject === "Python" && e.source === "self_reported");
  check("retrying completion does not duplicate evidence", python.length === 1, python.length);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
