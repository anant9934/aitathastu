/**
 * AI TATHASTU — PHASE DFI-2.1: SECTION 1 CV PIPELINE VERIFICATION
 * Tests the complete actual pipeline:
 * CV Upload → Document Parser → Link Discovery → Onboarding Draft → Step 5 Grid
 */

import fs from "node:fs";
import path from "node:path";
import { reviewPayload } from "./lib/review-payload";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const FIXTURES = path.join(process.cwd(), "scripts", "fixtures");

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? `\n      ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures++;
}

class Client {
  cookie = "";
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

  async startOnboarding() {
    const r = await this.req("PUT", "/api/onboarding-v2", {
      version: 2,
      currentScreen: 4,
      personalDetails: { fullName: `Test ${this.label}` }
    });
    if (r.status !== 200 || !this.cookie) throw new Error(`${this.label}: guest session not created (${r.status})`);
  }

  upload(file: string, name = path.basename(file)) {
    const form = new FormData();
    const type = name.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
    form.append("resume", new Blob([fs.readFileSync(file)], { type }), name);
    form.append("consent", "true");
    form.append("aiConsent", "true");
    return this.req("POST", "/api/resume/extract", form);
  }

  async poll(documentId: string, jobId: string, timeoutMs = 60_000) {
    const seen: string[] = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const r = await this.req("GET", `/api/resume/${documentId}/status?jobId=${jobId}`);
      const s = r.json?.status;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      if (!r.json?.ok || ["review_ready", "completed", "failed", "timed_out", "cancelled"].includes(s) || Date.now() > deadline) {
        return { body: r.json, seen, httpStatus: r.status };
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
}

async function runCvPipelineVerification() {
  console.log("===============================================================================");
  console.log("   AI TATHASTU — DFI-2.1 SECTION 1: REAL CV PIPELINE VERIFICATION");
  console.log("===============================================================================\n");

  // 1. Rich PDF with visible, multiline, hyperlink, portfolio
  console.log("--- 1. Testing Rich PDF Document Parsing & Link Discovery ---");
  const student1 = new Client("student-rich-pdf");
  await student1.startOnboarding();

  const richPdfPath = path.join(FIXTURES, "dfi21_rich_profile.pdf");
  const upPdf = await student1.upload(richPdfPath);
  check("PDF upload returns 202 queued", upPdf.status === 202 && upPdf.json?.status === "queued", upPdf.json);

  const pollPdf = await student1.poll(upPdf.json.documentId, upPdf.json.jobId);
  check("PDF pipeline finishes with review_ready", pollPdf.body?.status === "review_ready", pollPdf.body?.status);

  const discoveredPdf = pollPdf.body?.result?.discoveredProfiles || {};
  console.log("PDF Discovered Profiles from real parser:", discoveredPdf);
  check("Discovered visible GitHub URL", discoveredPdf.github === "https://github.com/anant9934", discoveredPdf);
  check("Discovered visible LinkedIn URL", discoveredPdf.linkedin === "https://linkedin.com/in/anant-mishra-ai", discoveredPdf);
  check("Discovered visible LeetCode URL", discoveredPdf.leetcode === "https://leetcode.com/u/anant9934", discoveredPdf);
  check("Discovered portfolio URL", discoveredPdf.portfolio === "https://anantmishra.dev", discoveredPdf);
  check("Discovered embedded ORCID annotation hyperlink", discoveredPdf.orcid === "https://orcid.org/0009-0003-8535-646X", discoveredPdf);

  // Apply decisions
  const candidates = pollPdf.body?.result?.reviewCandidates || [];
  check("PDF produced review candidates", candidates.length > 0, candidates.length);
  const applyPdf = await student1.req("POST", `/api/resume/${upPdf.json.documentId}/apply`,
    reviewPayload(candidates, (c) => !c.candidateId.startsWith("profile_") && !c.candidateId.startsWith("link_")));
  check("PDF apply succeeds", applyPdf.status === 200 && applyPdf.json?.ok === true, applyPdf.json);

  // Verify draft persistence
  const resPdf = await student1.req("GET", "/api/onboarding-v2");
  const draftPdf = resPdf.json?.draft;
  check("Onboarding draft has discoveredResumeProfiles from PDF", !!draftPdf?.discoveredResumeProfiles, draftPdf);
  const draftProfilesPdf = draftPdf?.discoveredResumeProfiles || {};
  check("Draft contains GitHub", draftProfilesPdf.github === "https://github.com/anant9934", draftProfilesPdf);
  check("Draft contains LinkedIn", draftProfilesPdf.linkedin === "https://linkedin.com/in/anant-mishra-ai", draftProfilesPdf);
  check("Draft contains LeetCode", draftProfilesPdf.leetcode === "https://leetcode.com/u/anant9934", draftProfilesPdf);
  check("Draft contains Portfolio", draftProfilesPdf.portfolio === "https://anantmishra.dev", draftProfilesPdf);
  check("Draft contains ORCID", draftProfilesPdf.orcid === "https://orcid.org/0009-0003-8535-646X", draftProfilesPdf);

  // 2. Rich DOCX with embedded hyperlinks & multiline
  console.log("\n--- 2. Testing Rich DOCX Document Parsing & Link Discovery ---");
  const student2 = new Client("student-rich-docx");
  await student2.startOnboarding();

  const richDocxPath = path.join(FIXTURES, "dfi21_rich_profile.docx");
  const upDocx = await student2.upload(richDocxPath);
  check("DOCX upload returns 202 queued", upDocx.status === 202 && upDocx.json?.status === "queued", upDocx.json);

  const pollDocx = await student2.poll(upDocx.json.documentId, upDocx.json.jobId);
  check("DOCX pipeline finishes with review_ready", pollDocx.body?.status === "review_ready", pollDocx.body?.status);

  const discoveredDocx = pollDocx.body?.result?.discoveredProfiles || {};
  console.log("DOCX Discovered Profiles from real parser:", discoveredDocx);
  check("DOCX discovered GitHub URL", discoveredDocx.github === "https://github.com/anant9934", discoveredDocx);
  check("DOCX discovered LinkedIn URL", discoveredDocx.linkedin === "https://linkedin.com/in/anant-mishra-ai", discoveredDocx);
  check("DOCX discovered LeetCode URL", discoveredDocx.leetcode === "https://leetcode.com/u/anant9934", discoveredDocx);
  check("DOCX discovered embedded Portfolio hyperlink", discoveredDocx.portfolio === "https://anantmishra.dev", discoveredDocx);
  check("DOCX discovered embedded DEV Community hyperlink", discoveredDocx.devto === "https://dev.to/anant9934", discoveredDocx);

  const applyDocx = await student2.req("POST", `/api/resume/${upDocx.json.documentId}/apply`,
    reviewPayload(pollDocx.body?.result?.reviewCandidates || [], (c) => !c.candidateId.startsWith("profile_") && !c.candidateId.startsWith("link_")));
  check("DOCX apply succeeds", applyDocx.status === 200 && applyDocx.json?.ok === true, applyDocx.json);

  const resDocx = await student2.req("GET", "/api/onboarding-v2");
  const draftProfilesDocx = resDocx.json?.draft?.discoveredResumeProfiles || {};
  check("Draft contains DEV Community from DOCX", draftProfilesDocx.devto === "https://dev.to/anant9934", draftProfilesDocx);
  check("Draft contains Portfolio from DOCX", draftProfilesDocx.portfolio === "https://anantmishra.dev", draftProfilesDocx);

  // 3. Clean Zero-Profile PDF
  console.log("\n--- 3. Testing Clean Zero-Profile CV ---");
  const student3 = new Client("student-zero-links");
  await student3.startOnboarding();

  const zeroPdfPath = path.join(FIXTURES, "dfi21_clean_zero_profiles.pdf");
  const upZero = await student3.upload(zeroPdfPath);
  check("Zero-profile CV upload returns 202 queued", upZero.status === 202, upZero.json);

  const pollZero = await student3.poll(upZero.json.documentId, upZero.json.jobId);
  check("Zero-profile CV reaches review_ready", pollZero.body?.status === "review_ready", pollZero.body?.status);

  const discoveredZero = pollZero.body?.result?.discoveredProfiles || {};
  check("Zero-profile CV discovers NO false links", Object.keys(discoveredZero).length === 0, discoveredZero);

  console.log(failures === 0 ? "\nALL CV PIPELINE CHECKS PASSED!" : `\n${failures} CV PIPELINE CHECKS FAILED!`);
  if (failures > 0) process.exit(1);
}

runCvPipelineVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
