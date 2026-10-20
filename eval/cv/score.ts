/**
 * Scores one extraction against ground truth.
 *
 * Records are paired greedily by their key field (institution, organization,
 * name, title) using token similarity; then each field of a paired record is
 * compared after normalisation. Counting, per category.field:
 *   tp  predicted value equals the truth
 *   fp  predicted a value that is wrong, or a value for a record that does not exist
 *   fn  truth has a value that was not predicted correctly
 * so a wrong value counts once as fp and once as fn (standard field-level P/R).
 */

import type { Truth, TruthDate } from "./truth";

export interface PredDate { raw?: string | null; value?: string | null }

export interface Prediction {
  personal: { fullName?: string; emails: string[]; phones: string[]; location?: string; links: string[] };
  education: Array<{ institution?: string; degree?: string; fieldOfStudy?: string; start?: PredDate; end?: PredDate; current?: boolean; grade?: string; flags?: string[]; status?: string }>;
  experience: Array<{ organization?: string; title?: string; type?: string; start?: PredDate; end?: PredDate; current?: boolean; flags?: string[]; status?: string }>;
  projects: Array<{ name?: string; technologies: string[]; url?: string }>;
  skills: string[];
  certifications: Array<{ name?: string; issuer?: string; date?: PredDate; credentialId?: string; flags?: string[]; status?: string }>;
  awards: Array<{ title?: string; category?: string }>;
  publications: Array<{ title?: string }>;
  volunteering: Array<{ organization?: string; role?: string; start?: PredDate; end?: PredDate; current?: boolean }>;
  languages: string[];
  memberships: string[];
  /** Every extracted free-text value, for the grounding (unsupported-claim) check. */
  claimedValues: string[];
}

export type Counts = { tp: number; fp: number; fn: number };
export interface DocScore {
  fields: Record<string, Counts>;
  records: Record<string, Counts & { duplicates: number }>;
  dates: { correct: number; total: number };
  association: { correct: number; total: number };
  unsupported: { claimed: number; ungrounded: number; examples: string[] };
  flags: { expected: number; raised: number; missing: string[] };
  forbiddenLeaks: string[];
  /** Per review status the extractor assigned: how many of those records were fully correct. */
  calibration: Record<string, { correct: number; total: number }>;
  /** Human-readable mismatches, for --verbose diagnosis. */
  diffs: string[];
}

// ---------------------------------------------------------------- normalisation

export function norm(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}+#'\s]/gu, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

export function similarity(a?: string, b?: string): number {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(tokens(na)), tb = new Set(tokens(nb));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const jac = inter / new Set([...ta, ...tb]).size;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  const contains = shorter.length >= 4 && ` ${longer} `.includes(` ${shorter} `) ? 0.5 + 0.5 * (shorter.length / longer.length) : 0;
  return Math.max(jac, contains);
}

const textEq = (a?: string, b?: string) => similarity(a, b) >= 0.85;
/** Organisation names: "Mount Carmel College" and "Mount Carmel College, Bengaluru" name the same place. */
const dropTail = (s?: string) => (s ?? "").replace(/\s*,\s*[^,]{2,30}$/, "");
const orgEq = (a?: string, b?: string) => textEq(a, b) || textEq(dropTail(a), b) || textEq(a, dropTail(b)) || textEq(dropTail(a), dropTail(b));

const DEGREE_ALIASES: Array<[RegExp, string]> = [
  [/^bachelor of technology$/, "btech"], [/^bachelor of engineering$/, "be"], [/^master of technology$/, "mtech"],
  [/^bachelor of science$/, "bsc"], [/^master of science$/, "msc"], [/^doctor of philosophy$/, "phd"],
  [/^bachelor of commerce$/, "bcom"], [/^bachelor of arts$/, "ba"], [/^master of design$/, "mdes"],
  [/^(?:class )?(?:xii|12|12th)(?: class)?$|^(?:senior|higher) secondary(?: school)?(?: certificate)?$|^intermediate$|^hsc$/, "class12"],
  [/^(?:class )?(?:x|10|10th)(?: class)?$|^secondary school(?: certificate)?$|^matriculation$|^ssc$/, "class10"],
];

export function degreeKey(s?: string): string {
  let d = norm((s ?? "").replace(/\([^)]*\)/g, " ")).replace(/\bhons\b|\bhonours\b|\bhonors\b/g, "").trim();
  for (const [re, key] of DEGREE_ALIASES) if (re.test(d)) return key;
  d = d.replace(/[\s.]/g, "");
  return d;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** Lenient parse of a raw date string, used only when the extractor gave no normalised value. */
export function parseLooseDate(raw?: string | null): { value: string | null; present: boolean } {
  const r = (raw ?? "").normalize("NFKC").trim();
  if (!r) return { value: null, present: false };
  if (/^(present|current|now|ongoing|till date|to date)$/i.test(r)) return { value: null, present: true };
  let m = r.match(/^([A-Za-z]{3})[a-z]*\.?\s*['’]?\s*((?:19|20)\d{2})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return { value: `${m[2]}-${MONTHS[m[1].toLowerCase()]}`, present: false };
  m = r.match(/^(0?[1-9]|1[0-2])\s*[/.\-]\s*((?:19|20)\d{2})$/);
  if (m) return { value: `${m[2]}-${m[1].padStart(2, "0")}`, present: false };
  m = r.match(/((?:19|20)\d{2})/);
  return { value: m ? m[1] : null, present: false };
}

function predDateValue(d?: PredDate): { value: string | null; present: boolean } {
  if (!d) return { value: null, present: false };
  if (d.value !== undefined) return { value: d.value, present: /present|current|ongoing/i.test(d.raw ?? "") };
  return parseLooseDate(d.raw);
}

const dateEq = (truth: TruthDate | undefined, pred?: PredDate) => (truth ?? null) === predDateValue(pred).value;

const gradeEq = (a?: string, b?: string) => {
  const na = (a ?? "").match(/\d+(?:\.\d+)?/)?.[0], nb = (b ?? "").match(/\d+(?:\.\d+)?/)?.[0];
  return Boolean(na && nb && Number(na) === Number(nb));
};

export const urlKey = (u?: string) =>
  (u ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");

const phoneKey = (p?: string) => (p ?? "").replace(/\D/g, "").slice(-10);

export const skillKey = (s: string) => norm(s).replace(/[\s.\-_]/g, "").replace(/(.{3,})js$/, "$1");

// ---------------------------------------------------------------- scoring

function bump(map: Record<string, Counts>, key: string, k: keyof Counts, n = 1) {
  map[key] ??= { tp: 0, fp: 0, fn: 0 };
  map[key][k] += n;
}

let DIFFS: string[] = [];
const show = (v: unknown) => (v === undefined || v === null || v === "" ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

function compareField(map: Record<string, Counts>, key: string, truthPresent: boolean, predPresent: boolean, equal: boolean, tv?: unknown, pv?: unknown) {
  if (truthPresent && predPresent && equal) bump(map, key, "tp");
  else {
    if (truthPresent || predPresent) DIFFS.push(`${key}: truth=${show(tv)} pred=${show(pv)}`);
    if (predPresent) bump(map, key, "fp");
    if (truthPresent) bump(map, key, "fn");
  }
}

function pair<T, P>(truth: T[], pred: P[], tkey: (t: T) => string | undefined, pkey: (p: P) => string | undefined, threshold = 0.5) {
  const scored: Array<{ ti: number; pi: number; s: number }> = [];
  truth.forEach((t, ti) => pred.forEach((p, pi) => {
    const s = similarity(tkey(t), pkey(p));
    if (s >= threshold) scored.push({ ti, pi, s });
  }));
  scored.sort((a, b) => b.s - a.s);
  const tUsed = new Map<number, number>(), pUsed = new Set<number>();
  const duplicates = new Set<number>();
  for (const { ti, pi } of scored) {
    if (pUsed.has(pi)) continue;
    if (tUsed.has(ti)) { duplicates.add(pi); continue; }
    tUsed.set(ti, pi);
    pUsed.add(pi);
  }
  return { pairs: [...tUsed.entries()].map(([ti, pi]) => ({ t: truth[ti], p: pred[pi] })), unmatchedTruth: truth.filter((_, i) => !tUsed.has(i)), unmatchedPred: pred.filter((_, i) => !pUsed.has(i) && !duplicates.has(i)), duplicates: duplicates.size };
}

function setScore(map: Record<string, Counts>, key: string, truth: string[], pred: string[], k = skillKey) {
  const t = new Set(truth.map(k)), p = new Set(pred.map(k));
  const extra = pred.filter((x) => !t.has(k(x))), missing = truth.filter((x) => !p.has(k(x)));
  for (const x of p) bump(map, key, t.has(x) ? "tp" : "fp");
  for (const x of t) if (!p.has(x)) bump(map, key, "fn");
  if (extra.length || missing.length) DIFFS.push(`${key}: missing=${show(missing)} extra=${show(extra)}`);
}

export function groundingNorm(text: string): string {
  return ` ${norm(text).replace(/'/g, "")} `;
}

export function scoreDocument(truth: Truth, pred: Prediction, sourceText: string): DocScore {
  DIFFS = [];
  const calibration: DocScore["calibration"] = {};
  const calib = (status: string | undefined, correct: boolean) => {
    if (!status) return;
    calibration[status] ??= { correct: 0, total: 0 };
    calibration[status].total++;
    if (correct) calibration[status].correct++;
  };
  const fields: Record<string, Counts> = {};
  const records: DocScore["records"] = {};
  const dates = { correct: 0, total: 0 };
  const association = { correct: 0, total: 0 };
  const flags = { expected: 0, raised: 0, missing: [] as string[] };

  const recordCounts = (cat: string, r: { pairs: unknown[]; unmatchedTruth: unknown[]; unmatchedPred: unknown[]; duplicates: number }) => {
    for (const t of r.unmatchedTruth) DIFFS.push(`${cat}: MISSING ${show(t)}`);
    for (const p of r.unmatchedPred) DIFFS.push(`${cat}: SPURIOUS ${show(p)}`);
    if (r.duplicates) DIFFS.push(`${cat}: ${r.duplicates} DUPLICATE(S)`);
    records[cat] = { tp: r.pairs.length, fp: r.unmatchedPred.length + r.duplicates, fn: r.unmatchedTruth.length, duplicates: r.duplicates };
  };
  const date = (cat: string, field: string, t: TruthDate | undefined, p?: PredDate) => {
    const predVal = predDateValue(p).value;
    compareField(fields, `${cat}.${field}`, Boolean(t), Boolean(predVal), dateEq(t, p), t, predVal);
    if (t) { dates.total++; if (dateEq(t, p)) dates.correct++; }
  };

  // Personal
  compareField(fields, "personal.fullName", Boolean(truth.personal.fullName), Boolean(pred.personal.fullName), textEq(truth.personal.fullName, pred.personal.fullName), truth.personal.fullName, pred.personal.fullName);
  setScore(fields, "personal.email", truth.personal.emails, pred.personal.emails, (s) => s.toLowerCase());
  setScore(fields, "personal.phone", truth.personal.phones, pred.personal.phones, phoneKey);
  compareField(fields, "personal.location", Boolean(truth.personal.location), Boolean(pred.personal.location),
    similarity(truth.personal.location, pred.personal.location) >= 0.6, truth.personal.location, pred.personal.location);
  setScore(fields, "personal.links", truth.personal.links, pred.personal.links, urlKey);

  // Education
  const edu = pair(truth.education, pred.education, (t) => `${t.institution} ${t.degree ?? ""}`, (p) => `${p.institution ?? ""} ${p.degree ?? ""}`, 0.35);
  recordCounts("education", edu);
  for (const { t, p } of edu.pairs) {
    compareField(fields, "education.institution", true, Boolean(p.institution), orgEq(t.institution, p.institution), t.institution, p.institution);
    compareField(fields, "education.degree", Boolean(t.degree), Boolean(p.degree), degreeKey(t.degree) === degreeKey(p.degree), t.degree, p.degree);
    compareField(fields, "education.fieldOfStudy", Boolean(t.fieldOfStudy), Boolean(p.fieldOfStudy), textEq(t.fieldOfStudy, p.fieldOfStudy), t.fieldOfStudy, p.fieldOfStudy);
    compareField(fields, "education.grade", Boolean(t.grade), Boolean(p.grade), gradeEq(t.grade, p.grade), t.grade, p.grade);
    date("education", "start", t.start, p.start);
    date("education", "end", t.end, p.end);
    association.total++;
    if (orgEq(t.institution, p.institution) && degreeKey(t.degree) === degreeKey(p.degree) && dateEq(t.end, p.end)) association.correct++;
    calib(p.status, orgEq(t.institution, p.institution) && (!t.degree || degreeKey(t.degree) === degreeKey(p.degree)) && dateEq(t.start, p.start) && dateEq(t.end, p.end) && (!t.fieldOfStudy || textEq(t.fieldOfStudy, p.fieldOfStudy)));
  }
  for (const t of edu.unmatchedTruth) {
    for (const f of ["institution", "degree", "fieldOfStudy", "grade"] as const) if (t[f]) bump(fields, `education.${f}`, "fn");
    for (const f of ["start", "end"] as const) if (t[f]) { bump(fields, `education.${f}`, "fn"); dates.total++; }
  }
  for (const p of edu.unmatchedPred) for (const f of ["institution", "degree", "fieldOfStudy", "grade"] as const) if (p[f]) bump(fields, `education.${f}`, "fp");
  for (const p of edu.unmatchedPred) calib(p.status, false);

  // Experience
  const exp = pair(truth.experience, pred.experience, (t) => `${t.organization} ${t.title}`, (p) => `${p.organization ?? ""} ${p.title ?? ""}`, 0.35);
  recordCounts("experience", exp);
  for (const { t, p } of exp.pairs) {
    compareField(fields, "experience.organization", true, Boolean(p.organization), orgEq(t.organization, p.organization), t.organization, p.organization);
    compareField(fields, "experience.title", true, Boolean(p.title), textEq(t.title, p.title), t.title, p.title);
    if (t.type) compareField(fields, "experience.type", true, Boolean(p.type), t.type === p.type, t.type, p.type);
    date("experience", "start", t.start, p.start);
    date("experience", "end", t.end, p.end);
    compareField(fields, "experience.current", Boolean(t.current), Boolean(p.current), Boolean(t.current) === Boolean(p.current), t.current, p.current);
    association.total++;
    if (orgEq(t.organization, p.organization) && textEq(t.title, p.title) && dateEq(t.start, p.start) && dateEq(t.end, p.end)) association.correct++;
    calib(p.status, orgEq(t.organization, p.organization) && textEq(t.title, p.title) && dateEq(t.start, p.start) && dateEq(t.end, p.end) && !t.invalidDates);
    if (t.invalidDates) {
      flags.expected++;
      if (p.flags?.some((f) => /invalid|conflict|review/.test(f))) flags.raised++;
      else flags.missing.push(`experience:${t.organization}`);
    }
  }
  for (const t of exp.unmatchedTruth) {
    for (const f of ["organization", "title", "type"] as const) if (t[f]) bump(fields, `experience.${f}`, "fn");
    for (const f of ["start", "end"] as const) if (t[f]) { bump(fields, `experience.${f}`, "fn"); dates.total++; }
    if (t.invalidDates) { flags.expected++; flags.missing.push(`experience:${t.organization}`); }
  }
  for (const p of exp.unmatchedPred) for (const f of ["organization", "title"] as const) if (p[f]) bump(fields, `experience.${f}`, "fp");
  for (const p of exp.unmatchedPred) calib(p.status, false);

  // Projects
  const proj = pair(truth.projects, pred.projects, (t) => t.name, (p) => p.name);
  recordCounts("projects", proj);
  for (const { t, p } of proj.pairs) {
    compareField(fields, "projects.name", true, Boolean(p.name), textEq(t.name, p.name), t.name, p.name);
    compareField(fields, "projects.url", Boolean(t.url), Boolean(p.url), urlKey(t.url) === urlKey(p.url), t.url, p.url);
    setScore(fields, "projects.technologies", t.technologies, p.technologies);
  }
  for (const t of proj.unmatchedTruth) {
    bump(fields, "projects.name", "fn");
    if (t.url) bump(fields, "projects.url", "fn");
    bump(fields, "projects.technologies", "fn", t.technologies.length);
  }
  for (const p of proj.unmatchedPred) { bump(fields, "projects.name", "fp"); if (p.url) bump(fields, "projects.url", "fp"); }

  // Skills, languages, memberships (sets)
  setScore(fields, "skills.name", truth.skills, pred.skills);
  setScore(fields, "languages.name", truth.languages, pred.languages);
  const mem = pair(truth.memberships.map((m) => ({ m })), pred.memberships.map((m) => ({ m })), (x) => x.m, (x) => x.m, 0.6);
  recordCounts("memberships", mem);

  // Certifications
  const cert = pair(truth.certifications, pred.certifications, (t) => t.name, (p) => p.name);
  recordCounts("certifications", cert);
  for (const { t, p } of cert.pairs) {
    calib(p.status, textEq(t.name, p.name) && (!t.issuer || textEq(t.issuer, p.issuer)) && dateEq(t.date, p.date) && !t.dateAmbiguous);
    compareField(fields, "certifications.name", true, Boolean(p.name), textEq(t.name, p.name), t.name, p.name);
    compareField(fields, "certifications.issuer", Boolean(t.issuer), Boolean(p.issuer), textEq(t.issuer, p.issuer), t.issuer, p.issuer);
    date("certifications", "date", t.date, p.date);
    compareField(fields, "certifications.credentialId", Boolean(t.credentialId), Boolean(p.credentialId), (t.credentialId ?? "").toLowerCase() === (p.credentialId ?? "").toLowerCase(), t.credentialId, p.credentialId);
    if (t.dateAmbiguous) {
      flags.expected++;
      if (p.flags?.some((f) => /ambiguous|review/.test(f))) flags.raised++;
      else flags.missing.push(`certification:${t.name}`);
    }
  }
  for (const t of cert.unmatchedTruth) {
    bump(fields, "certifications.name", "fn");
    if (t.issuer) bump(fields, "certifications.issuer", "fn");
    if (t.date) { bump(fields, "certifications.date", "fn"); dates.total++; }
    if (t.dateAmbiguous) { flags.expected++; flags.missing.push(`certification:${t.name}`); }
  }
  bump(fields, "certifications.name", "fp", cert.unmatchedPred.length);

  // Awards, publications, volunteering
  const aw = pair(truth.awards, pred.awards, (t) => t.title, (p) => p.title);
  recordCounts("awards", aw);
  for (const { t, p } of aw.pairs) compareField(fields, "awards.category", true, Boolean(p.category), t.category === p.category, `${t.title}: ${t.category}`, p.category);
  const pub = pair(truth.publications, pred.publications, (t) => t.title, (p) => p.title);
  recordCounts("publications", pub);
  const vol = pair(truth.volunteering, pred.volunteering, (t) => `${t.organization} ${t.role}`, (p) => `${p.organization ?? ""} ${p.role ?? ""}`, 0.35);
  recordCounts("volunteering", vol);
  for (const { t, p } of vol.pairs) {
    compareField(fields, "volunteering.organization", true, Boolean(p.organization), orgEq(t.organization, p.organization), t.organization, p.organization);
    compareField(fields, "volunteering.role", true, Boolean(p.role), textEq(t.role, p.role), t.role, p.role);
    date("volunteering", "start", t.start, p.start);
    date("volunteering", "end", t.end, p.end);
  }

  // Unsupported claims: extracted text that does not occur in the document at all.
  const source = groundingNorm(sourceText);
  const claimed = pred.claimedValues.map((v) => v.trim()).filter((v) => norm(v).length >= 2);
  const ungrounded = claimed.filter((v) => {
    const n = norm(v).replace(/'/g, "");
    return n && !source.includes(` ${n} `) && !(n.length >= 6 && source.includes(n));
  });

  const forbiddenLeaks = [
    ...truth.forbidden.emails.filter((e) => pred.personal.emails.some((x) => x.toLowerCase() === e.toLowerCase())),
    ...truth.forbidden.phones.filter((ph) => pred.personal.phones.some((x) => phoneKey(x) === phoneKey(ph))),
  ];

  return {
    fields, records, dates, association,
    unsupported: { claimed: claimed.length, ungrounded: ungrounded.length, examples: ungrounded.slice(0, 8) },
    flags, forbiddenLeaks, calibration, diffs: DIFFS,
  };
}

// ---------------------------------------------------------------- aggregation

export function add(into: Counts, c: Counts) { into.tp += c.tp; into.fp += c.fp; into.fn += c.fn; }

export function prf(c: Counts) {
  const p = c.tp + c.fp ? c.tp / (c.tp + c.fp) : c.fn ? 0 : 1;
  const r = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 1;
  const f1 = p + r ? (2 * p * r) / (p + r) : 0;
  return { precision: p, recall: r, f1 };
}
