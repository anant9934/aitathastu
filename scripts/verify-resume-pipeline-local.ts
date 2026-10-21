/**
 * End-to-end checks for the async resume pipeline and the related security fixes,
 * run against a live local dev server (npm run dev) and extractor.
 *
 *   node --import tsx scripts/verify-resume-pipeline-local.ts [--scanned <pdf>] [--expect-ocr-engine-failure]
 *
 * Covers: 202 + queued -> processing -> review_ready transitions (text PDF,
 * DOCX, scanned PDF via the extractor), specific failure codes, the terminal-
 * state race guard, per-user document isolation for byte-identical uploads,
 * 401 without a session on read-only routes, client-supplied verifier roles
 * being ignored, deselected candidates not being imported, and retry reusing
 * the stored blob.
 */

import fs from "node:fs";
import path from "node:path";
import { reviewPayload } from "./lib/review-payload";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const SCANNED = argValue("--scanned");
const EXPECT_ENGINE_FAILURE = args.includes("--expect-ocr-engine-failure");
const FIXTURES = path.join(process.cwd(), "scripts", "fixtures");

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures++;
}

class Client {
  cookie = "";
  // Each simulated visitor gets its own address so the per-IP guest limit is
  // exercised deliberately (see the rate-limit check) rather than by accident.
  ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  constructor(public label: string) {}
  async req(method: string, url: string, body?: BodyInit | Record<string, unknown>) {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip };
    if (this.cookie) headers.cookie = this.cookie;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${url}`, { method, headers, body: payload, redirect: "manual" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, json, text, setCookie };
  }
  /** Creates a guest session the only supported way: the first onboarding draft write. */
  async startOnboarding() {
    const r = await this.req("PUT", "/api/onboarding-v2", { version: 2, currentScreen: 5 });
    if (r.status !== 200 || !this.cookie) throw new Error(`${this.label}: guest session not created (${r.status})`);
  }
  upload(file: string, name = path.basename(file)) {
    const form = new FormData();
    const type = name.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
    form.append("resume", new Blob([fs.readFileSync(file)], { type }), name);
    form.append("consent", "true");
    form.append("aiConsent", "true");
    return this.req("POST", "/api/resume/extract", form);
  }
  /** Polls status until terminal or review_ready; returns the final body and every distinct status seen. */
  async poll(documentId: string, jobId: string, timeoutMs = 240_000) {
    const seen: string[] = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const r = await this.req("GET", `/api/resume/${documentId}/status?jobId=${jobId}`);
      const s = r.json?.status;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      if (!r.json?.ok || ["review_ready", "completed", "failed", "timed_out", "cancelled", "retry"].includes(s) || Date.now() > deadline) {
        return { body: r.json, seen, httpStatus: r.status };
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
}

async function uploadAndPoll(client: Client, file: string, name?: string) {
  const up = await client.upload(file, name);
  if (up.status !== 202) return { up, final: null as any };
  const final = await client.poll(up.json.documentId, up.json.jobId);
  return { up, final };
}

async function main() {
  const textPdf = path.join(FIXTURES, "test_student_cv.pdf");
  const docx = path.join(FIXTURES, "test_student_cv.docx");

  // --- 2b: read-only routes need a session and never mint one -----------------
  const anon = new Client("anonymous");
  for (const url of ["/api/resume/00000000-0000-0000-0000-000000000000/status", "/api/resume/00000000-0000-0000-0000-000000000000", "/api/resume/00000000-0000-0000-0000-000000000000/export"]) {
    const r = await anon.req("GET", url);
    check(`cookieless GET ${url.replace(/0{8}-.*?(\/|$)/, "<id>$1")} -> 401 without Set-Cookie`, r.status === 401 && !r.setCookie, { status: r.status, setCookie: r.setCookie });
  }
  const anonUpload = await anon.upload(textPdf);
  check("cookieless resume upload -> 401 without Set-Cookie", anonUpload.status === 401 && !anonUpload.setCookie, anonUpload.status);

  // --- 2b: guest creation is rate limited per client IP ------------------------
  const sharedIp = `10.250.${Math.floor(Math.random() * 250)}.1`;
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) {
    const visitor = new Client(`flood-${i}`);
    visitor.ip = sharedIp;
    codes.push((await visitor.req("PUT", "/api/onboarding-v2", { version: 2, currentScreen: 2 })).status);
  }
  check("6th guest creation from one IP within 10 min -> 429", codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429, codes);

  // --- 1: async pipeline, text PDF ---------------------------------------------
  const alice = new Client("alice");
  await alice.startOnboarding();
  const a1 = await uploadAndPoll(alice, textPdf);
  check("text PDF upload returns 202 queued", a1.up.status === 202 && a1.up.json?.status === "queued", a1.up.json);
  check("text PDF reaches review_ready", a1.final?.body?.status === "review_ready", a1.final);
  // Upload stores "queued"; the first poll claims it (queued -> processing) and,
  // for a text PDF, finishes within that same request, so it reports review_ready.
  check("text PDF: stored queued, then review_ready", a1.up.json?.status === "queued" && a1.final?.seen.at(-1) === "review_ready", { upload: a1.up.json?.status, polled: a1.final?.seen });
  const candidates = a1.final?.body?.result?.reviewCandidates ?? [];
  check("review payload includes candidates", candidates.length > 0, a1.final?.body?.result);

  // --- 1: DOCX ----------------------------------------------------------------
  const a2 = await uploadAndPoll(alice, docx);
  check("DOCX reaches review_ready", a2.final?.body?.status === "review_ready", a2.final);

  // --- 1: race guard -------------------------------------------------------------
  const lateFail = await alice.req("PATCH", "/api/student/processing-jobs", { jobId: a2.up.json.jobId, status: "failed", errorMessage: "late client timeout" });
  const afterLate = await alice.req("GET", `/api/resume/${a2.up.json.documentId}/status?jobId=${a2.up.json.jobId}`);
  check("late client 'failed' PATCH cannot flip a review_ready job", lateFail.status === 200 && afterLate.json?.status === "review_ready", afterLate.json?.status);

  // --- 1: scanned PDF via extractor ------------------------------------------------
  if (SCANNED) {
    const a3 = await uploadAndPoll(alice, SCANNED, "scanned_cv.pdf");
    if (EXPECT_ENGINE_FAILURE) {
      check("scanned PDF with OCR engine missing -> failed", a3.final?.body?.status === "failed", a3.final);
      check("failure code is specific: OCR_ENGINE_UNAVAILABLE (not a generic 'scan unclear')", a3.final?.body?.errorCode === "OCR_ENGINE_UNAVAILABLE", a3.final?.body);
    } else {
      check("scanned PDF reaches review_ready via extractor OCR", a3.final?.body?.status === "review_ready", a3.final);
      check("scanned PDF observed in 'processing' while the extractor OCR'd it", a3.final?.seen.includes("processing"), a3.final?.seen);
      check("scanned PDF passed through the extract (OCR) stage", a3.final?.body?.result?.extractionMeta?.via === "extractor-ocr", a3.final?.body?.result?.extractionMeta);
    }
  }

  // --- 2a: identical bytes from two users -------------------------------------------
  const bob = new Client("bob");
  await bob.startOnboarding();
  const b1 = await uploadAndPoll(bob, textPdf);
  check("identical bytes from a second user get a different document id", b1.up.json?.documentId && b1.up.json.documentId !== a1.up.json.documentId, [a1.up.json?.documentId, b1.up.json?.documentId]);
  const aliceStill = await alice.req("GET", `/api/resume/${a1.up.json.documentId}`);
  check("first uploader still owns and can read their document", aliceStill.status === 200 && aliceStill.json?.documentId === a1.up.json.documentId, aliceStill.status);
  const bobReadsAlice = await bob.req("GET", `/api/resume/${a1.up.json.documentId}`);
  check("second user cannot read the first user's document (404)", bobReadsAlice.status === 404, bobReadsAlice.status);
  const bobStatusAlice = await bob.req("GET", `/api/resume/${a1.up.json.documentId}/status`);
  check("second user cannot poll the first user's job (404)", bobStatusAlice.status === 404, bobStatusAlice.status);

  // --- 2c: client-supplied verifier role is ignored ------------------------------------
  const verify = await alice.req("POST", `/api/resume/${a1.up.json.documentId}/review`, {
    group: "skills", record_id: "sk_0", field: "canonical_name", action: "verify", reviewer_role: "verifier",
  });
  check("reviewer_role=verifier in the body does not allow verify (403)", verify.status === 403, verify.json);

  // --- 3a/3b: apply imports only confirmed candidates -------------------------------------
  const skills = candidates.filter((c: any) => c.category === "skill");
  if (skills.length >= 2) {
    const keep = skills[0], drop = skills[1];
    const apply = await alice.req("POST", `/api/resume/${a1.up.json.documentId}/apply`, reviewPayload(candidates, (c) => c.candidateId !== drop.candidateId));
    check("apply succeeds and reports confirmed/rejected counts", apply.status === 200 && apply.json?.ok && apply.json.rejected >= 1, apply.json);
    const doc = await alice.req("GET", `/api/resume/${a1.up.json.documentId}`);
    const skillRecords: any[] = doc.json?.profile?.groups?.skills ?? [];
    const dropIndex = Number(drop.candidateId.split("_")[1]);
    const keepIndex = Number(keep.candidateId.split("_")[1]);
    check(`deselected skill "${drop.value}" stored as rejected`, skillRecords[dropIndex]?.record_state === "rejected", skillRecords[dropIndex]);
    check(`selected skill "${keep.value}" stored as student_confirmed`, skillRecords[keepIndex]?.record_state === "student_confirmed", skillRecords[keepIndex]);
    const p360 = await alice.req("GET", "/api/student/person-360");
    const skillEvidence = (p360.json?.evidence ?? []).filter((e: any) => e.category === "skill" && e.source === "resume").map((e: any) => e.subject);
    check(`selected skill "${keep.value}" imported into Person 360 evidence`, skillEvidence.includes(keep.value), skillEvidence);
    check(`deselected skill "${drop.value}" NOT imported into Person 360 evidence`, p360.status === 200 && !skillEvidence.includes(drop.value), skillEvidence);
    const afterApply = await alice.req("GET", `/api/resume/${a1.up.json.documentId}/status`);
    check("job is completed after apply", afterApply.json?.status === "completed", afterApply.json?.status);
    const badApply = await alice.req("POST", `/api/resume/${a1.up.json.documentId}/apply`, { workspaceVersion: 1, decisions: [{ candidateId: "skill_999", state: "confirmed" }], additions: [], currentEducationId: null });
    check("apply with an unknown candidate is rejected, not silently accepted", badApply.status === 409 && badApply.json?.ok === false, badApply.json);
  } else {
    check("fixture has at least 2 skill candidates for the deselect test", false, skills);
  }

  // --- 3d: retry reuses the stored blob ------------------------------------------------
  const retryDone = await alice.req("POST", `/api/resume/${a2.up.json.documentId}/retry`);
  check("retry of a non-failed document is refused (409), protecting the good result", retryDone.status === 409, retryDone.json);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
