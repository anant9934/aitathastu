/**
 * Runs one file through the production extraction path, without the database
 * or any LLM call, and maps the result to the scorer's Prediction shape.
 *
 * Text-layer PDFs and DOCX are read in-process exactly as the ingestion
 * service does. Scans and images go through eval/cv/ocr_payload.py, which runs
 * the Render extractor's own read_document + extract_profile, so the OCR branch
 * gets the same payload production receives from Render.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Prediction, PredDate } from "./score";

export const PYTHON = path.join(process.cwd(), "services/resume-extractor/.venv/bin/python");
const CACHE_DIR = path.join(process.cwd(), "eval/cv/.cache");

export interface OcrPayload {
  raw_text: string;
  pages: Array<{ page: number; width: number; height: number; spans: Array<{ x0: number; y0: number; x1: number; y1: number; text: string; conf?: number }>; links?: Array<{ url: string; x0: number; y0: number; x1: number; y1: number }>; quality?: Record<string, unknown> }>;
  ocr_used: boolean;
  profile: unknown;
  warnings: string[];
  seconds: number;
}

function serviceCodeHash(): string {
  const h = crypto.createHash("sha256");
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { if (f !== "__pycache__") walk(p); }
      else if (f.endsWith(".py")) h.update(fs.readFileSync(p));
    }
  };
  walk(path.join(process.cwd(), "services/resume-extractor/app"));
  h.update(fs.readFileSync(path.join(process.cwd(), "eval/cv/ocr_payload.py")));
  return h.digest("hex").slice(0, 16);
}
let codeHash: string | null = null;

/** The Render extractor's payload for a file (cached by file + service code hash). */
export function ocrPayload(file: string): OcrPayload {
  codeHash ??= serviceCodeHash();
  const key = crypto.createHash("sha256").update(fs.readFileSync(file)).update(codeHash).digest("hex").slice(0, 24);
  const cached = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, "utf8"));
  const env = { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` };
  const out = execFileSync(PYTHON, ["-I", path.join(process.cwd(), "eval/cv/ocr_payload.py"), file], { env, maxBuffer: 64 * 1024 * 1024 });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, out);
  return JSON.parse(out.toString());
}

export interface PipelineOutput {
  supported: boolean;
  text: string;
  ocrUsed: boolean;
  latencyMs: number;
  ocrSeconds?: number;
  prediction: Prediction;
  raw: unknown;
}

const empty = (): Prediction => ({
  personal: { emails: [], phones: [], links: [] }, leadership: [], languageProficiency: {}, education: [], experience: [], projects: [], skills: [],
  certifications: [], awards: [], publications: [], volunteering: [], languages: [], memberships: [], claimedValues: [],
});

const d = (raw?: string | null, value?: string | null): PredDate | undefined =>
  raw || value ? { raw: raw ?? null, ...(value !== undefined ? { value } : {}) } : undefined;

const flagsOf = (r: any): string[] => [...(r.flags || []), ...(r.review?.issues || []), ...(r.review && r.review.status !== "high_confidence" ? [r.review.status] : [])];

/** Maps the persisted extraction (structured interpretation + profile + links) to the scorer's shape. */
export function toPrediction(review: { structured: any; extractedProfile: any; discoveredProfiles: any; links: any }): Prediction {
  const x = review.structured || {};
  const p = review.extractedProfile || {};
  const out = empty();
  out.personal.fullName = p.fullName ?? x.personal?.fullName;
  out.personal.emails = [p.email ?? x.personal?.email].filter(Boolean);
  out.personal.phones = [p.mobile ?? x.personal?.phone].filter(Boolean);
  out.personal.location = p.location ?? x.personal?.location;
  out.personal.headline = x.personal?.title ?? x.summary?.headline;
  out.summary = x.summary?.text;
  out.leadership = (x.leadership || []).map((l: any) => ({ organization: l.organization, role: l.role, start: d(l.startDate, l.dates?.start?.value), end: /present/i.test(l.endDate ?? "") ? undefined : d(l.endDate, l.dates?.end?.value), current: l.current }));
  for (const l of x.languages || []) out.languageProficiency[l.language] = l.proficiency;
  const links = new Set<string>([...Object.values(review.discoveredProfiles || {}) as string[], ...((review.links || []) as Array<{ url: string }>).map((l) => l.url)]);
  const projectUrls = new Set((x.projects || []).flatMap((pr: any) => [pr.repositoryUrl, pr.demoUrl]).filter(Boolean).map((u: string) => u.toLowerCase().replace(/\/$/, "")));
  out.personal.links = [...links].filter((u) => u && !projectUrls.has(u.toLowerCase().replace(/\/$/, "")));

  const isPresent = (s?: string) => /present|current|ongoing|now/i.test(s ?? "");
  out.education = (x.education || []).map((e: any) => ({
    institution: e.institution, degree: e.degree, fieldOfStudy: e.fieldOfStudy,
    start: d(e.startDate, e.dates?.start?.value), end: isPresent(e.endDate) ? undefined : d(e.endDate ?? e.graduationYear, e.dates?.end?.value),
    current: isPresent(e.endDate) || e.current === true, grade: e.gpa ?? e.percentage ?? e.grade?.value, flags: flagsOf(e), status: e.review?.status,
  }));
  out.experience = (x.experience || []).map((e: any) => ({
    organization: e.company, title: e.role, type: e.type,
    start: d(e.startDate, e.dates?.start?.value), end: isPresent(e.endDate) ? undefined : d(e.endDate, e.dates?.end?.value),
    current: isPresent(e.endDate) || e.current === true, flags: flagsOf(e), status: e.review?.status, location: e.location,
  }));
  out.projects = (x.projects || []).map((pr: any) => ({ name: pr.title, technologies: pr.technologies || [], url: pr.repositoryUrl || pr.demoUrl || undefined, repo: pr.repositoryUrl || undefined, demo: pr.demoUrl || undefined }));
  out.skills = (x.skills || []).filter((s: any) => s.isExplicit !== false).map((s: any) => s.originalName ?? s.name);
  out.certifications = (x.certifications || []).map((c: any) => ({ name: c.name, issuer: c.issuer, date: d(c.issueDate ?? c.year, c.dates?.issued?.value), credentialId: c.credentialId, credentialUrl: c.credentialUrl, expires: d(c.expiryDate, c.dates?.expires?.value), flags: flagsOf(c), status: c.review?.status }));
  out.awards = [
    ...(x.achievements || []).filter((a: any) => !["publication", "patent", "book"].includes(a.category)).map((a: any) => ({ title: a.title, category: a.category, issuer: a.issuer, date: d(a.date) })),
    ...(x.hackathons || []).map((h: any) => ({ title: h.event, category: "hackathon" })),
  ];
  out.publications = [
    ...(x.research || []).map((r: any) => ({ title: r.title, venue: r.publisher, date: d(r.date) })),
    ...(x.achievements || []).filter((a: any) => ["publication", "patent", "book"].includes(a.category)).map((a: any) => ({ title: a.title })),
  ];
  out.volunteering = [
    ...(x.volunteering || []).map((v: any) => ({ organization: v.organization, role: v.role, start: d(v.startDate ?? v.dates?.split?.(/[–—-]/)[0], v.dateRange?.start?.value), end: d(v.endDate ?? v.dates?.split?.(/[–—-]/)[1], v.dateRange?.end?.value) })),
    ...(x.experience || []).filter((e: any) => e.type === "volunteering").map((e: any) => ({ organization: e.company, role: e.role, start: d(e.startDate), end: d(e.endDate) })),
  ];
  out.languages = (x.languages || []).map((l: any) => l.language);
  out.memberships = (x.memberships || x.additional?.filter((a: any) => /member/i.test(`${a.heading} ${a.content}`)).map((a: any) => ({ title: a.content })) || []).map((m: any) => m.title ?? m);

  const push = (...v: Array<string | undefined | null>) => { for (const s of v) if (typeof s === "string" && s.trim()) out.claimedValues.push(s); };
  push(out.personal.fullName, out.personal.location, ...out.personal.emails);
  for (const e of out.education) push(e.institution, e.degree, e.fieldOfStudy);
  for (const e of out.experience) push(e.organization, e.title);
  for (const pr of out.projects) push(pr.name, ...pr.technologies);
  push(...out.skills);
  for (const c of out.certifications) push(c.name, c.issuer);
  for (const a of out.awards) push(a.title);
  for (const pb of out.publications) push(pb.title);
  for (const v of out.volunteering) push(v.organization, v.role);
  push(...out.languages);
  return out;
}

export { empty as emptyPrediction };
