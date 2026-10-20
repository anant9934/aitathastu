/**
 * Deterministic CV extraction engine.
 *
 *   reading-order text (+ optional per-line layout metadata)
 *     -> normalised lines -> sections -> entries -> typed records
 *     -> de-duplication -> field- and record-level validation
 *
 * Every value comes from the document text. When a field cannot be found it is
 * left empty and the record is marked for review; nothing is filled in with a
 * placeholder or a guess. Each record carries the page, section and line span
 * it was read from.
 */

import type { LayoutLineMeta } from "../layout";
import { compareDates, findDatePoints, findDateRanges, hasDate, stripDates, type NormDate } from "./dates";
import {
  DEGREE_RE, INSTITUTION_RE, KNOWN_TECH, ORG_CUES, ORG_SUFFIX, SECTION_FAMILIES, TITLE_WORDS,
  canonicalSkill, isLocation, isSpokenLanguage, skillCategory, type SkillCategory,
} from "./lexicon";

export const EXTRACTION_SCHEMA_VERSION = "cv-extract/3.0";

export type ReviewStatus = "high_confidence" | "needs_review" | "conflicting" | "unreadable" | "not_found" | "invalid" | "user_confirmed";
export type FieldStatus = Exclude<ReviewStatus, "user_confirmed" | "conflicting"> | "conflicting";

export interface Review {
  status: ReviewStatus;
  /** Heuristic 0-1 score from observable checks; see validate(). Not a probability of correctness. */
  confidence: number;
  issues: string[];
  fields: Record<string, FieldStatus>;
}

export interface Evidence {
  page: number;
  section: string;
  lineStart: number;
  lineEnd: number;
  text: string;
  method: ExtractMethod;
}

export type ExtractMethod = "native_pdf" | "docx" | "ocr" | "text";

export interface EducationRecord {
  institution: string; degree: string; fieldOfStudy?: string; level: "undergraduate" | "postgraduate" | "doctorate" | "diploma" | "high_school" | "other";
  start?: NormDate; end?: NormDate; current: boolean; grade?: { raw: string; value: string; kind: "cgpa" | "gpa" | "percentage" | "classification" };
  location?: string; notes: string[]; evidence: Evidence; review: Review;
}
export interface ExperienceRecord {
  organization: string; title: string; type: "employment" | "internship" | "freelance" | "founder" | "leadership" | "volunteering" | "other";
  start?: NormDate; end?: NormDate; current: boolean; location?: string; highlights: string[]; technologies: string[];
  evidence: Evidence; review: Review;
}
export interface ProjectRecord {
  name: string; description: string; technologies: string[]; repositoryUrl?: string; demoUrl?: string;
  start?: NormDate; end?: NormDate; evidence: Evidence; review: Review;
}
export interface SkillRecord { name: string; original: string; category: SkillCategory; group?: string; evidence: Evidence }
export interface CertificationRecord {
  name: string; issuer?: string; issued?: NormDate; expires?: NormDate; credentialId?: string; credentialUrl?: string;
  status?: "completed" | "in_progress"; evidence: Evidence; review: Review;
}
export interface AwardRecord { title: string; category: "award" | "hackathon" | "honor"; date?: NormDate; issuer?: string; evidence: Evidence }
export interface PublicationRecord { title: string; type: "paper" | "journal" | "conference" | "book" | "patent" | "thesis" | "other"; venue?: string; date?: NormDate; evidence: Evidence }
export interface LanguageRecord { language: string; proficiency?: string; evidence: Evidence }
export interface TextRecord { heading: string; content: string; evidence: Evidence }

export interface ExtractedCv {
  schemaVersion: string;
  personal: {
    fullName?: { value: string; evidence: Evidence };
    headline?: { value: string; evidence: Evidence };
    emails: Array<{ value: string; evidence: Evidence }>;
    phones: Array<{ value: string; normalized: string; evidence: Evidence }>;
    location?: { value: string; evidence: Evidence };
    links: Array<{ url: string; evidence: Evidence }>;
  };
  summary?: { text: string; evidence: Evidence };
  education: EducationRecord[];
  experience: ExperienceRecord[];
  leadership: ExperienceRecord[];
  volunteering: ExperienceRecord[];
  projects: ProjectRecord[];
  skills: SkillRecord[];
  certifications: CertificationRecord[];
  awards: AwardRecord[];
  publications: PublicationRecord[];
  languages: LanguageRecord[];
  memberships: TextRecord[];
  other: TextRecord[];
  /** Contacts in a references section: never the candidate's own. */
  referenceContacts: string[];
  sections: Array<{ section: string; heading: string; page: number; lineStart: number; lineEnd: number }>;
  warnings: string[];
}

export interface ExtractOptions {
  hyperlinks?: string[];
  lines?: LayoutLineMeta[];
  method?: ExtractMethod;
  /** Per-page OCR quality 0-1 (mean word confidence), when OCR was used. */
  pageQuality?: Record<number, number>;
  /** Reference date for "future" checks (tests pin it). */
  now?: Date;
}

// ---------------------------------------------------------------- lines

interface Line {
  i: number;
  text: string;
  page: number;
  heading: boolean;
  height: number;
  bullet: boolean;
  gapBefore: boolean;
}

const BULLET_START = /^(?:[-–—•●○◦▪▫■□◆◇►▶▸▹➢➤✓✔‣⁃∙*·]|[©®«»°¢+](?=\s))\s*/u;
const ICONS = /[\u{E000}-\u{F8FF}\u{1F300}-\u{1FAFF}☀-➿⬀-⯿️]/gu;

export function normalizeLine(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(ICONS, " ")
    .replace(/[­​-‍﻿]/g, "")
    .replace(/[‐‑‒−]/g, "-")
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*\|\s*(?:\|\s*)+/g, " | ")
    // Icons read as a glyph glued to a date: "£309/2010", "E307/2016" -> "09/2010", "07/2016".
    .replace(/(^|\s)(?:[£€§©®°¢]|[A-Z])?\d?((?:0[1-9]|1[0-2])\/(?:19|20)\d{2})/g, "$1$2")
    // OCR spacing inside e-mail addresses: "name @gmail.com".
    .replace(/([\w.+-])\s+@\s*([\w-]+\.)/g, "$1@$2")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** OCR-only repairs for confusions that are unambiguous in CV text. */
function repairOcr(t: string): string {
  return t
    .replace(/\bAl\b/g, "AI")
    .replace(/\b(Gen|Open|Agentic)Al\b/g, "$1AI")
    .replace(/linkedin\.com[a-z]?\/?in\//gi, "linkedin.com/in/");
}

function prepareLines(text: string, meta?: LayoutLineMeta[], ocr = false): Line[] {
  const out: Line[] = [];
  let gap = false;
  // A URL broken at a hyphen or slash continues on the next line ("github.com/rahul-" + "verma-dev").
  const raws = text.split(/\r?\n/);
  for (let k = 0; k < raws.length - 1; k++) {
    if (/(?:https?:\/\/|www\.|\.(?:com|io|dev|org|in)\/)\S*[-/_]$/.test(raws[k].trim()) && /^[\w\-./]+$/.test(raws[k + 1].trim())) {
      raws[k] = raws[k].trimEnd() + raws[k + 1].trim();
      raws[k + 1] = "";
    }
  }
  raws.forEach((raw, i) => {
    let t = normalizeLine(raw);
    if (ocr) t = repairOcr(t);
    if (!t) { gap = true; return; }
    const bullet = BULLET_START.test(t);
    if (bullet) t = `- ${t.replace(BULLET_START, "").replace(/^[:|]\s*/, "").trim()}`;
    t = t.replace(/^\|\s*/, "").replace(/\s*\|$/, "").trim();
    if (!t || t === "-") { gap = true; return; }
    const m = meta?.[i];
    out.push({ i, text: t, page: m?.page ?? 1, heading: Boolean(m?.heading), height: m?.height ?? 0, bullet, gapBefore: gap });
    gap = false;
  });
  return out;
}

const plain = (l: Line) => l.text.replace(/^- /, "");

// ---------------------------------------------------------------- sections

const headingKey = (text: string) =>
  text.toLowerCase()
    .replace(/^[-\d.)\s:|#]+/, "")
    .replace(/[:|]+\s*$/, "")
    .replace(/\((?:contd?\.?|continued|cont'd)\)|\b(?:contd?\.?|continued|cont'd)$/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "'")
    .replace(/[^a-z' /]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function familyOf(key: string): string | null {
  if (!key) return null;
  // "Experience & Leadership", "Leadership Experience": experience records.
  if (/\bexperience\b/.test(key) && !/\b(?:volunteer|project)/.test(key)) return "experience";
  if (/^research$/.test(key)) return "publications";
  for (const [family, re] of SECTION_FAMILIES) if (re.test(key)) return family;
  return null;
}

/** Words that make up section headings; a weakly-cued heading must be mostly these. */
const HEADING_VOCAB = new Set(("summary profile professional career objective about me executive personal statement hello hi introduction overview who am bio " +
  "languages language known spoken education educational academic academics background qualifications qualification what studied studies schooling degrees " +
  "certifications certification certificates certificate licenses licences credentials courses course coursework online learning trainings training " +
  "volunteer volunteering voluntary service services outreach community engagement social work " +
  "awards award honours honors honour honor achievements achievement accomplishments recognition recognitions fellowships fellowship scholarships scholarship distinctions hackathons hackathon competitions competition contests prizes " +
  "publications publication papers paper research patents patent books book conference journals articles presentations posters talks " +
  "memberships membership affiliations bodies associations organisations organizations leadership positions position responsibility extracurricular extra curricular activities clubs societies " +
  "projects project portfolio things i've ive made built case studies client capstone selected key " +
  "experience experiences employment work worked history where jobs held teaching internships internship industrial " +
  "skills skill toolbox toolkit tools tool tech technical stack technologies technology competencies competency proficiencies expertise strengths programming relevant software core " +
  "interests interest hobbies passions declaration references reference referees contact details info information get touch reach " +
  "and & of the my i other additional computer").split(" "));

function headingVocabRatio(key: string): number {
  const words = key.split(/[\s/]+/).filter(Boolean);
  return words.length ? words.filter((w) => HEADING_VOCAB.has(w)).length / words.length : 0;
}

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

/** Heading decision: shape first, then a layout cue or an unmistakable keyword. */
function classifyHeading(l: Line, bodyHeight: number): { family: string | null; heading: string } | null {
  // OCR reads heading icons as bullet glyphs ("® LANGUAGES"): all-caps text still counts.
  if (l.bullet && !isAllCaps(plain(l))) return null;
  const text = plain(l).replace(/[:|]\s*$/, "").replace(/^[^\p{L}]+/u, "").trim();
  const words = text.split(/\s+/);
  if (text.length < 3 || text.length > 48 || words.length > 6) return null;
  if (/@|https?:|www\.|\d{3,}|[.,;]$/.test(text) || hasDate(text)) return null;
  const key = headingKey(text);
  // A qualification ("Master of Social Work") or a titled phrase ("Professional Certificate in X") is content.
  if (DEGREE_FIND.test(text) || (words.length > 4 && /\s(?:in|of|for|at)\s/i.test(text))) return null;
  const family = familyOf(key);
  const larger = bodyHeight > 0 && l.height >= bodyHeight * 1.12;
  const strongCue = l.heading || isAllCaps(text) || larger;
  if (family) {
    if (strongCue && (headingVocabRatio(key) >= 0.5 || isAllCaps(text))) return { family, heading: text };
    // Title-case heading at body size: short, no job-title words, mostly heading vocabulary.
    if (words.length <= 4 && !TITLE_WORDS.test(text) && !INSTITUTION_RE.test(text) && /^[\p{Lu}"]/u.test(text) && headingVocabRatio(key) >= 0.5) return { family, heading: text };
    return null;
  }
  if (l.heading && words.length <= 4 && /^[\p{L}&'’ /-]+$/u.test(text) && !TITLE_WORDS.test(text) && !ORG_CUES.test(text) && !isLocation(text) && !nameShaped(text)) return { family: "other", heading: text };
  return null;
}

interface Section { family: string; heading: string; lines: Line[]; headingLine?: Line }

function segment(lines: Line[]): Section[] {
  const heights = lines.filter((l) => l.height > 0).map((l) => l.height).sort((a, b) => a - b);
  const body = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  const sections: Section[] = [{ family: "header", heading: "", lines: [] }];
  for (const l of lines) {
    const h = classifyHeading(l, body);
    if (h) {
      sections.push({ family: h.family ?? "other", heading: h.heading, lines: [], headingLine: l });
      continue;
    }
    // One-line labelled sections in otherwise headingless CVs: "Skills: Python, SQL".
    const inline = l.text.match(/^([A-Za-z][A-Za-z &/']{2,30}):\s*(.+)$/);
    const cur = sections[sections.length - 1];
    if (inline && (cur.family === "header" || cur.family === "summary")) {
      const fam = familyOf(headingKey(inline[1]));
      if (fam === "skills" || fam === "languages" || fam === "certifications" || fam === "awards") {
        sections.push({ family: fam, heading: inline[1], lines: [{ ...l, text: inline[2] }], headingLine: l });
        sections.push({ family: cur.family, heading: cur.heading, lines: [] });
        continue;
      }
    }
    cur.lines.push(l);
  }
  const kept = sections.filter((s) => s.lines.length || s.headingLine);
  return kept.some((s) => !["header", "contact", "summary"].includes(s.family)) ? kept : classifyHeadingless(kept);
}

/**
 * CVs with no recognisable headings: classify header lines by content. Lines
 * that only describe (sentences) stay with the record above them.
 */
function classifyHeadingless(sections: Section[]): Section[] {
  const header = sections.find((s) => s.family === "header");
  if (!header) return sections;
  const out: Section[] = [{ family: "header", heading: "", lines: [] }];
  let current: Section | null = null;
  for (const l of header.lines) {
    const t = plain(l);
    const contact = /@|https?:\/\/|www\.|\+?\d[\d\s-]{8,}\d/.test(t);
    let family: string | null = null;
    let text = t;
    if (!contact && (DEGREE_FIND.test(t) || (INSTITUTION_RE.test(t) && hasDate(t)))) family = "education";
    else if (!contact && TITLE_WORDS.test(t) && (hasDate(t) || /\s(?:at|@)\s/.test(t)) && !isProse(t)) family = "experience";
    else {
      const m = t.match(/^(?:(?:proficient|skilled|experienced|expertise|fluent)\s+(?:in|with)|(?:skills|tools|technologies|tech stack)\s*:)\s*(.+)$/i);
      if (m) { family = "skills"; text = m[1].replace(/\.$/, "").replace(/\s+and\s+/gi, ", ").replace(/[()]/g, ", "); }
    }
    if (family) {
      current = { family, heading: "", lines: [] };
      out.push(current);
      current.lines.push({ ...l, text });
    } else if (current && current.family !== "skills" && isProse(t)) {
      current.lines.push({ ...l, bullet: true, text: `- ${t}` });
    } else {
      current = null;
      out[0].lines.push(l);
    }
  }
  return [...out, ...sections.filter((s) => s !== header)];
}

// ---------------------------------------------------------------- helpers

function evidenceOf(lines: Line[], section: string, method: ExtractMethod): Evidence {
  const first = lines[0], last = lines[lines.length - 1];
  return {
    page: first?.page ?? 1, section, lineStart: first?.i ?? 0, lineEnd: last?.i ?? 0,
    text: lines.map((l) => l.text).join(" ").slice(0, 600), method,
  };
}

const URL_IN_TEXT = /<?\b((?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>|,;)"]*)?)>?/gi;
const EMAIL_RE = /(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?![\w.])/gi;

function urlsIn(text: string): string[] {
  const out: string[] = [];
  const withoutEmails = text.replace(EMAIL_RE, " ");
  for (const m of withoutEmails.matchAll(URL_IN_TEXT)) {
    let u = m[1].replace(/[.,;:)\]]+$/, "");
    const host = u.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
    // "B.Tech", "Node.js", "Next.js", "ASP.NET": tokens, not addresses.
    if (!/[a-z]{2,}\.[a-z]{2,}/i.test(host) || /^(?:b|m)\.(?:tech|sc|com|e|a|arch|des|ed|pharm)$/i.test(host)) continue;
    if (/\.(?:js|ts|net|py|io)$/i.test(host) && !/\//.test(u) && !/^https?:/i.test(u) && !/\.(?:io)$/i.test(host)) continue;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try { new URL(u); } catch { continue; }
    out.push(u.replace(/\/$/, ""));
  }
  return out;
}

const titleScore = (s: string) => (TITLE_WORDS.test(s) ? 1 : 0);
const orgScore = (s: string) => (ORG_CUES.test(s) || INSTITUTION_RE.test(s) ? 1 : 0);
/** Sentence-like description text, as opposed to a head line (title, organisation, dates). */
const isProse = (text: string) => {
  const t = text.replace(/^- /, "");
  if (/\s\|\s/.test(t)) return false;
  const words = stripDates(t).split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  const verbLed = /^(?:[A-Z][a-z]+(?:ed|ing)|Led|Built|Wrote|Ran|Made|Won|Set|Taught|Drove|Grew|Cut|Owned?|Regularly|Successfully)\b/.test(t) && words >= 4 && !(TITLE_WORDS.test(t) && words <= 4);
  return words >= 10 || (/[.!?]$/.test(t) && words >= 6) || verbLed;
};

function splitSegments(text: string): string[] {
  const parts = text
    .split(/\s+\|\s+|\s+[–—]\s+|\s+-\s+|\s+(?:at|@)\s+|\s*,\s+|\s+\+\s+/)
    .map((p) => p.replace(/^[\s+|,;:–—-]+|[\s+|,;:–—-]+$/g, "").trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length && ORG_SUFFIX.test(p)) merged[merged.length - 1] += `, ${p}`;
    else merged.push(p);
  }
  return merged;
}

/** "88 Hendford Hill, London B22 0GX, United Kingdom" -> "London, United Kingdom". */
function placeSuffix(text: string): string | null {
  const parts = text.split(/\s*,\s*/).map((p) => p.replace(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b|\b\d{6}\b|\b\d{5}\b/g, "").trim()).filter(Boolean);
  const kept: string[] = [];
  for (let k = parts.length - 1; k >= 0; k--) {
    if (isLocation(parts[k])) kept.unshift(parts[k]);
    else break;
  }
  return kept.length ? kept.join(", ") : null;
}

function firstRange(lines: string[]): { start?: NormDate; end?: NormDate } {
  for (const t of lines) {
    const r = findDateRanges(t)[0];
    if (r) return { start: r.start, end: r.end };
  }
  const points = lines.flatMap((t) => findDatePoints(t)).filter((p) => p.value || p.present);
  if (points.length >= 2) return { start: points[0], end: points[1] };
  return points.length === 1 ? { end: points[0] } : {};
}

const cleanDisplay = (s: string) => s.replace(/<https?:[^>]+>/g, "").replace(/\s+/g, " ").replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, "").trim();

// ---------------------------------------------------------------- entries

/**
 * Splits a section into entries. A new entry starts at a non-bullet,
 * non-prose line once the current entry has description lines, or when it
 * repeats a kind of head information the current entry already has (a second
 * date, a second institution).
 */
function splitEntries(lines: Line[], opts: { repeatKeys?: Array<(t: string) => boolean>; startsNew?: (l: Line, cur: Line[]) => boolean } = {}): Line[][] {
  const entries: Line[][] = [];
  let cur: Line[] = [];
  let hasBody = false;
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k];
    const prev = cur[cur.length - 1];
    // A wrapped line continues the previous one: it starts in lower case, or the
    // previous line breaks mid-phrase ("..., and", "built with"). A blank line never continues.
    const continuation = prev && !l.bullet && !l.gapBefore && (
      /^[a-z(]/.test(l.text) ||
      ((prev.bullet || (hasBody && isProse(prev.text))) && !hasDate(l.text) && (/[,&/-]$|\b(?:and|or|of|for|with|to|in|the|a|an|on|by)$/i.test(prev.text) || (isProse(l.text) && !/[.!?:]$/.test(prev.text))))
    );
    if (continuation) {
      prev.text = `${prev.text} ${l.text}`;
      continue;
    }
    const head = !l.bullet && !isProse(l.text);
    const repeats = head && cur.length > 0 && ((opts.repeatKeys || []).some((test) => test(l.text) && cur.some((c) => !c.bullet && test(c.text))) || Boolean(opts.startsNew?.(l, cur)));
    if (head && cur.length && (hasBody || repeats)) {
      entries.push(cur);
      cur = [];
      hasBody = false;
    }
    cur.push({ ...l });
    if (l.bullet || isProse(l.text)) hasBody = true;
  }
  if (cur.length) entries.push(cur);
  return entries;
}

// ---------------------------------------------------------------- experience

function experienceType(title: string, section: string, heading: string): ExperienceRecord["type"] {
  const t = `${title}`.toLowerCase();
  if (section === "volunteering" || /\bvolunteer/.test(t)) return "volunteering";
  if (/\b(?:intern|internship|trainee|apprentice)\b/.test(t)) return "internship";
  if (/\bfreelanc/.test(t)) return "freelance";
  if (/\b(?:co-?founder|founder|ceo|coo|cto|owner)\b/.test(t)) return "founder";
  if (/\b(?:president|vice president|vp|head|captain|secretary|treasurer|chair(?:person|man)?|convenor|convener|lead developer)\b/.test(t) || section === "leadership") return "leadership";
  if (/internship|training/i.test(heading) && !TITLE_WORDS.test(t)) return "internship";
  return "employment";
}

function parseExperience(entry: Line[], section: Section, method: ExtractMethod): ExperienceRecord | null {
  const headLines = entry.filter((l) => !l.bullet && !isProse(l.text)).slice(0, 4);
  const body = entry.filter((l) => !headLines.includes(l));
  if (!headLines.length) return null;
  const { start, end } = firstRange(headLines.map((l) => l.text));
  let location: string | undefined;
  let title = "", organization = "";
  const segs: Array<{ text: string; line: number }> = [];
  headLines.forEach((l, li) => {
    const stripped = cleanDisplay(stripDates(l.text.replace(/<https?:[^>]+>/g, "")));
    if (!stripped) return;
    if (isLocation(stripped)) { location ??= stripped; return; }
    // Check pipe/dash pieces as places before splitting on commas ("Rochester, NY").
    const pieces = stripped.split(/\s+\|\s+|\s+[–—]\s+/).filter((p) => {
      if (isLocation(p.trim())) { location ??= p.trim(); return false; }
      return true;
    });
    for (const s of pieces.flatMap((p) => splitSegments(p))) {
      if (isLocation(s)) { location ??= s; continue; }
      // OCR reads a location pin as a stray letter: "Q SUVA, FIJI".
      const pinned = s.replace(/^[^\p{L}\d]*\p{L}\s+/u, "");
      if (pinned !== s && isLocation(pinned)) { location ??= pinned; continue; }
      if (/^(?:remote|hybrid|on-?site|full[- ]time|part[- ]time|contract)$/i.test(s)) continue;
      segs.push({ text: s, line: li });
    }
  });
  let inferred = false;
  // A job title ends in a role noun ("Senior Software Engineer", "Software Development Intern");
  // an organisation name ends in a name or an organisation word ("Bharat Electronics Limited").
  const lastWords = (t: string) => t.split(/\s+/).slice(-2).join(" ");
  const isTitle = (t: string) => TITLE_WORDS.test(lastWords(t)) || (TITLE_WORDS.test(t) && !orgScore(t));
  const isOrg = (t: string) => !isTitle(t) || ORG_SUFFIX.test(t.split(/\s+/).pop() ?? "") || /\b(?:labs?|ltd|limited|inc|llc|university|institute|college|foundation|bank|school)\.?$/i.test(t);
  const titled = segs.filter((s) => isTitle(s.text) && !isOrg(s.text));
  const orged = segs.filter((s) => !titled.includes(s));
  // Exactly one part names an organisation ("Sacred Heart Convent School"): the other is the title ("TGT English").
  const cued = segs.filter((s) => orgScore(s.text) && !isTitle(s.text));
  if (titled.length && orged.length) {
    title = titled[0].text;
    organization = orged.find((s) => s !== titled[0])?.text ?? "";
  } else if (segs.length === 2 && cued.length === 1) {
    organization = cued[0].text;
    title = segs.find((s) => s !== cued[0])!.text;
  } else if (segs.length >= 2) {
    // No cue tells them apart. "Title at Org" reads title first; otherwise the
    // common "Organisation / Title" stacking is assumed and flagged for review.
    const joined = headLines.map((l) => l.text).join(" ");
    if (/\s(?:at|@)\s/.test(joined)) { title = segs[0].text; organization = segs[1].text; }
    else { organization = segs[0].text; title = segs[1].text; }
    inferred = true;
  } else if (segs.length === 1) {
    if (titleScore(segs[0].text) && !orgScore(segs[0].text)) title = segs[0].text;
    else organization = segs[0].text;
  }
  if (!title && !organization) return null;
  const highlights = body.map((l) => cleanDisplay(plain(l))).filter((t) => t.length >= 3);
  const text = entry.map((l) => l.text).join(" ");
  const rec: ExperienceRecord = {
    organization: organization.slice(0, 150), title: title.slice(0, 150),
    type: experienceType(title, section.family, section.heading),
    start: start && !start.present ? start : undefined,
    end, current: Boolean(end?.present), location, highlights, technologies: techMentions(text),
    evidence: evidenceOf(entry, section.family, method),
    review: { status: "high_confidence", confidence: 0, issues: inferred ? ["title_organization_order_inferred"] : [], fields: {} },
  };
  if (rec.start === undefined && rec.end && !rec.end.present && !findDateRanges(headLines.map((l) => l.text).join(" ")).length) {
    // A single date on a role ("2010", "Summer 2018") bounds both ends.
    rec.start = rec.end;
  }
  return rec;
}

// ---------------------------------------------------------------- education

const BOARD = /^(?:cbse|icse|isc|igcse|ib|nios|bseb|bihar board|wbchse|wbbse|state board|hsc|ssc|up board|mp board|rbse|gseb|pseb|hbse|cisce|board)$/i;
const DEGREE_FIND = new RegExp(`(?<![A-Za-z.])(${DEGREE_RE.source})(?![A-Za-z])`, "i");

function degreeLevel(degree: string): EducationRecord["level"] {
  const d = degree.toLowerCase();
  if (/ph\.?\s?d|doctor|d\.?\s?phil/.test(d)) return "doctorate";
  if (/class|xii|\bx\b|10th|12th|secondary|intermediate|matric|high school|ssc|hsc|sslc|aisse|icse|isc|a[- ]level|o[- ]level|gcse/.test(d)) return "high_school";
  if (/master|m\.?\s?tech|m\.?\s?sc|m\.?\s?com|m\.?\s?a\b|mca|mba|pgdm|pgdbm|pg\s?diploma|m\.?\s?des|m\.?\s?e\b|m\.?\s?arch|m\.?\s?phil|msw|mfa|\bms\b|meng|llm|m\.?\s?pharm/.test(d)) return "postgraduate";
  if (/diploma/.test(d) && !/ib diploma/.test(d)) return "diploma";
  if (/ib diploma/.test(d)) return "high_school";
  return "undergraduate";
}

const GRADE_PATTERNS: Array<[RegExp, "cgpa" | "gpa" | "percentage" | "classification"]> = [
  [/\b(?:CGPA|CPI|CGPI|SGPA)\s*(?:of\s*)?[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2}(?:\.\d+)?)?)/i, "cgpa"],
  [/(\d{1,2}(?:\.\d{1,2})?(?:\s*\/\s*\d{1,2}(?:\.\d+)?)?)\s*(?:CGPA|CPI|CGPI)\b/i, "cgpa"],
  [/\bGPA\s*(?:of\s*)?[:\-]?\s*(\d(?:\.\d{1,2})?(?:\s*\/\s*\d(?:\.\d+)?)?)/i, "gpa"],
  [/(\d(?:\.\d{1,2})?(?:\s*\/\s*\d(?:\.\d+)?)?)\s*GPA\b/i, "gpa"],
  [/(?:percentage|marks|aggregate|score)?\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?\s*%)/i, "percentage"],
  [/\b((?:first|second|third|upper second|lower second|2:1|2:2)[- ]class(?: honou?rs)?(?: with distinction)?|(?:summa |magna )?cum laude|with distinction|distinction)\b/i, "classification"],
];

function findGrade(text: string): EducationRecord["grade"] | undefined {
  for (const [re, kind] of GRADE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const value = m[1].replace(/\s+/g, "");
      if (kind === "percentage" && Number(value.replace("%", "")) > 100) continue;
      // raw: the value as written ("8.84 / 10"); value: normalised ("8.84/10").
      return { raw: m[1].trim(), value: kind === "classification" ? m[1] : value, kind };
    }
  }
  return undefined;
}

function fieldAfterDegree(text: string, match: RegExpMatchArray): string | undefined {
  let rest = text.slice((match.index ?? 0) + match[0].length);
  rest = rest.replace(/^\s*\((?:hons?\.?|honou?rs)\)/i, "").replace(/^\s*(?:with\s+)?(?:\(?hons?\.?\)?|honou?rs)\b/i, "");
  rest = stripDates(rest).replace(/^[\s.,:;–—-]+/, "").replace(/^(?:in|of)\s+/i, "");
  rest = rest.split(/\s*[;|]\s*|\s+[–—]\s+|\s+-\s+/)[0];
  rest = stripDates(rest).replace(GRADE_PATTERNS[0][0], "").replace(/\b(?:CGPA|GPA|CPI|Percentage|Marks)\b.*$/i, "").replace(/\d{1,3}(?:\.\d+)?\s*%.*$/, "");
  rest = rest.replace(/\s*,\s*$/, "").trim();
  if ((rest.match(/\(/g) || []).length > (rest.match(/\)/g) || []).length) rest = rest.replace(/\s*\([^)]*$/, "").trim();
  const boardParen = rest.match(/^\(([^)]*)\)$/);
  if (boardParen) return undefined;
  rest = rest.replace(/\s*\((?:cbse|icse|isc|state board|bseb|ib)\)\s*$/i, "").trim();
  const parts = rest.split(/\s*,\s*/);
  while (parts.length > 1 && isLocation(parts[parts.length - 1])) parts.pop();
  rest = parts.join(", ").trim();
  if (!rest || rest.length < 3 || rest.length > 100 || BOARD.test(rest) || INSTITUTION_RE.test(rest) || isLocation(rest) || /^\d/.test(rest)) return undefined;
  if (!/^[\p{L}(]/u.test(rest)) return undefined;
  return rest;
}

interface TableColumns { degree?: number; institution?: number; year?: number; grade?: number; board?: number }

function tableHeader(text: string): TableColumns | null {
  const cells = text.split(/\s*\|\s*/).map((c) => c.toLowerCase());
  if (cells.length < 3) return null;
  const cols: TableColumns = {};
  cells.forEach((c, i) => {
    if (/degree|qualification|course|exam|class|programme|program/.test(c)) cols.degree ??= i;
    else if (/institut|college|school|university/.test(c)) cols.institution ??= i;
    else if (/board/.test(c)) cols.board ??= i;
    else if (/year|session|duration|passing|period/.test(c)) cols.year ??= i;
    else if (/score|marks|cgpa|gpa|percent|grade|result/.test(c)) cols.grade ??= i;
  });
  return Object.keys(cols).length >= 3 ? cols : null;
}

function parseEducation(entry: Line[], section: Section, method: ExtractMethod, table: TableColumns | null): EducationRecord | null {
  const texts = entry.map((l) => plain(l));
  const all = texts.join(" | ");
  let institution = "", degree = "", fieldOfStudy: string | undefined, location: string | undefined;
  let grade: EducationRecord["grade"];
  let dates = firstRange(texts);

  if (table && entry.length === 1 && texts[0].includes("|")) {
    const cells = texts[0].split(/\s*\|\s*/);
    const degCell = table.degree !== undefined ? cells[table.degree] ?? "" : "";
    const m = degCell.match(DEGREE_FIND);
    const hons = m ? degCell.slice((m.index ?? 0) + m[0].length).match(/^\s*\((?:hons?\.?|honou?rs)\)/i) : null;
    degree = m ? m[1].trim() + (hons ? ` ${hons[0].trim()}` : "") : degCell.trim();
    fieldOfStudy = m ? fieldAfterDegree(degCell, m) : undefined;
    institution = table.institution !== undefined ? cleanDisplay(cells[table.institution] ?? "") : "";
    if (table.grade !== undefined) grade = findGrade(cells[table.grade] ?? "") ?? (/\d/.test(cells[table.grade] ?? "") ? { raw: cells[table.grade], value: cells[table.grade].replace(/[^\d./%]/g, ""), kind: /%/.test(cells[table.grade]) ? "percentage" : "cgpa" } : undefined);
    if (table.year !== undefined) dates = firstRange([cells[table.year] ?? ""]);
  } else {
    // Degree: prefer a line that does not also name the institution.
    const ordered = [...texts].sort((a, b) => Number(INSTITUTION_RE.test(a)) - Number(INSTITUTION_RE.test(b)));
    for (const t of ordered) {
      const m = t.match(DEGREE_FIND);
      if (m) {
        // "B.Sc. (Hons)" is the qualification as written.
        const hons = t.slice((m.index ?? 0) + m[0].length).match(/^\s*\((?:hons?\.?|honou?rs)\)/i);
        degree = (m[1].trim() + (hons ? ` ${hons[0].trim()}` : "")).replace(/,$/, "");
        fieldOfStudy = fieldAfterDegree(t, m);
        break;
      }
    }
    grade = findGrade(all);
    // Institution: a segment with an institution keyword, else the first head line that is nothing else.
    const candidates = texts.flatMap((t) => splitSegmentsKeepCommas(cleanDisplay(stripDates(t.replace(/<https?:[^>]+>/g, ""))))).flatMap((seg) => {
      // "VIT Vellore, MCA, 2022" / "Lovely Professional University -- B.Tech": the text before the degree names the school.
      const m = seg.match(DEGREE_FIND);
      if (!m || !m.index) return [seg];
      const before = seg.slice(0, m.index).replace(/[\s,;:|–—-]+$/, "").trim();
      return before && (INSTITUTION_RE.test(before) || before.split(/\s+/).length >= 2) ? [before, seg] : [seg];
    });
    let inst = candidates.find((s) => INSTITUTION_RE.test(s) && !DEGREE_FIND.test(s.replace(INSTITUTION_RE, "")) && !/^(?:minors?|majors?|clubs|societies|thesis|coursework|relevant)/i.test(s));
    if (!inst) {
      inst = candidates.find((s) =>
        s.length > 3 && !DEGREE_FIND.test(s) && !findGrade(s) && !isLocation(s) && !BOARD.test(s) &&
        !/^(?:minors?|majors?|clubs|societies|thesis|coursework|relevant|graduated|honou?rs|grade|first class)/i.test(s) && !(fieldOfStudy && s.includes(fieldOfStudy)));
    }
    if (inst) {
      // Keep "St. Xavier's College, Mumbai" as written (the city often identifies the
      // institution) and also record the city as the location.
      const parts = inst.split(/\s*,\s*/);
      const tail: string[] = [];
      for (let k = parts.length - 1; k > 0 && isLocation(parts[k]); k--) tail.unshift(parts[k]);
      institution = inst.replace(/\s*\((?:cbse|icse|isc|state board)\)\s*$/i, "").replace(/[;:,]$/, "").trim();
      if (tail.length) location = tail.join(", ");
    }
    for (const t of texts) {
      if (!location && isLocation(cleanDisplay(stripDates(t)))) location = cleanDisplay(stripDates(t));
    }
  }
  if (!institution && !degree) return null;
  if (fieldOfStudy && institution && fieldOfStudy.toLowerCase() === institution.toLowerCase()) fieldOfStudy = undefined;
  // School boards (CBSE, BSEB, OCR'd "BSES") are not a field of study.
  if (fieldOfStudy && degree && degreeLevel(degree) === "high_school" && /^[A-Z]{2,6}$/.test(fieldOfStudy)) fieldOfStudy = undefined;
  // A subject line with no degree keyword ("Mathematics and Statistics" above the university).
  if (!degree && !fieldOfStudy) {
    const subject = texts.map((t) => cleanDisplay(stripDates(t))).find((s) =>
      s && s !== institution && !INSTITUTION_RE.test(s) && !isLocation(s) && !findGrade(s) && /^[\p{Lu}]/u.test(s) && s.split(" ").length <= 6 && !/:/.test(s) && !/^(?:graduated|first class|minors?|clubs)/i.test(s));
    if (subject) fieldOfStudy = subject;
  }
  const end = dates.end;
  const now = new Date();
  const future = end?.value ? end.value > `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}` : false;
  return {
    institution: institution.slice(0, 200), degree: degree.slice(0, 100), fieldOfStudy: fieldOfStudy?.slice(0, 100),
    level: degree ? degreeLevel(degree) : "other",
    start: dates.start && !dates.start.present ? dates.start : undefined,
    end,
    current: Boolean(end?.present || end?.expected || future),
    grade, location, notes: [],
    evidence: evidenceOf(entry, "education", method),
    review: { status: "high_confidence", confidence: 0, issues: [], fields: {} },
  };
}

/** Segments for institution search: split on pipes and dashes but keep "College, City" together. */
function splitSegmentsKeepCommas(text: string): string[] {
  return text.split(/\s+\|\s+|\s+[–—]\s+|\s+-{1,2}\s+|;\s*/).map((s) => s.replace(/^[\s,;:+–—-]+|[\s,;:+–—-]+$/g, "").trim()).filter(Boolean);
}

// ---------------------------------------------------------------- skills & languages

const PROFICIENCY = /^(?:native|fluent|full|limited|basic|beginner|intermediate|advanced|expert|proficient|conversational|professional(?: working)?|elementary|mother tongue|bilingual)(?: proficiency)?$/i;

function parseSkillItems(sec: Section, method: ExtractMethod): { skills: SkillRecord[]; languages: LanguageRecord[] } {
  const skills: SkillRecord[] = [];
  const languages: LanguageRecord[] = [];
  // Join wrapped list lines: "Pixelmator, Screenspresso, Sequel" + "Pro".
  const lines: Line[] = [];
  for (const l of sec.lines) {
    const prev = lines[lines.length - 1];
    const t = plain(l);
    if (prev && !l.bullet && !/[,;:]$/.test(prev.text) && (/^[a-z(]/.test(t) || (t.split(/\s+/).length <= 2 && !t.includes(",") && prev.text.includes(",")))) {
      prev.text = `${prev.text} ${t}`;
      continue;
    }
    if (prev && /,$/.test(prev.text) && !l.bullet && !/:/.test(t)) {
      prev.text = `${prev.text} ${t}`;
      continue;
    }
    lines.push({ ...l, text: t });
  }
  let group: string | undefined;
  for (const l of lines) {
    let text = l.text.replace(/<https?:[^>]+>/g, "");
    if (/@|https?:\/\//.test(text) || isProse(text) && !text.includes(",")) continue;
    const labelled = text.match(/^([^:,]{2,40}):\s*(.*)$/) || (text.includes("|") && text.split("|").length === 2 ? [text, text.split("|")[0], text.split("|")[1]] : null);
    if (labelled) {
      group = labelled[1].trim();
      text = labelled[2].trim();
      if (!text) continue;
    }
    const items = text.split(/\s*[,;•·]\s*|\s+\|\s+|\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
    for (let raw of items) {
      // Rating bars and rules read by OCR: "Microsoft Office I", "MS SQL Server 1]", "~~ ___".
      raw = raw.replace(/^[-–—*]\s*/, "").replace(/\s+(?:[Il1|\]\[]+|[~_—=-]{2,}.*)$/u, "").replace(/\.$/, "").trim();
      if (/[_~=]|—{1,}|\b[A-Z]{6,}[_—]/.test(raw) || (raw.length === 1 && !/^[CR]$/.test(raw)) || !/\p{L}{2}|^[CR]$|^[A-Za-z][+#]{1,2}$/u.test(raw)) continue;
      let proficiency: string | undefined;
      const paren = raw.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (paren && (PROFICIENCY.test(paren[2].trim()) || isSpokenLanguage(paren[1]))) { raw = paren[1].trim(); proficiency = paren[2].trim(); }
      const tab = raw.match(/^(\p{L}+)\s+(native|fluent|full|limited|basic|conversational|intermediate|advanced|professional)$/iu);
      if (tab && isSpokenLanguage(tab[1])) { raw = tab[1]; proficiency = tab[2]; }
      if (!raw || PROFICIENCY.test(raw) || raw.length > 45 || raw.split(/\s+/).length > 5 || /^\d+$/.test(raw)) continue;
      if (sec.family === "languages" || isSpokenLanguage(raw) && (!group || /language/i.test(group) || sec.family !== "skills")) {
        if (isSpokenLanguage(raw) || (sec.family === "languages" && /^\p{Lu}\p{Ll}+$/u.test(raw))) {
          languages.push({ language: raw, proficiency, evidence: evidenceOf([l], sec.family, method) });
          continue;
        }
        if (sec.family === "languages") continue;
      }
      skills.push({ name: canonicalSkill(raw), original: raw, category: skillCategory(raw), group, evidence: evidenceOf([l], "skills", method) });
    }
  }
  return { skills, languages };
}

/** Known technology names mentioned in text (for projects and roles, never the skills list). */
function techMentions(text: string): string[] {
  const out: string[] = [];
  let prose = text.replace(/<?https?:\/\/\S+>?|\b[\w-]+\.(?:com|io|app|dev|ai|org|net)\/\S*/gi, " ");
  const names = KNOWN_TECH.filter((n) => n.length > 2 && skillCategory(n) !== "concept").sort((a, b) => b.length - a.length);
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w+#.])${esc}(?![\\w+#])`, "i");
    const m = prose.match(re);
    if (!m) continue;
    // Mask the match so "Tailwind CSS" does not also yield "CSS".
    prose = prose.replace(new RegExp(re.source, "gi"), " ");
    const display = canonicalSkill(name);
    const value = display !== name ? display : m[0];
    if (!out.some((o) => o.toLowerCase() === value.toLowerCase())) out.push(value);
  }
  return out;
}

// ---------------------------------------------------------------- projects

const PROJECT_FIELD = /^(?:problem|solution|technolog(?:y|ies)(?: used)?|tech(?:nical)? stack|stack|tools?|outcomes?|results?|impact|features?|architecture|role|contributions?|repository|repo|source(?: code)?|code|github|demo|live(?: demo)?|link|links|url|website|description|overview|summary|duration|team(?: size)?|built with|highlights?|achievements?)\s*:/i;

function parseProjects(sec: Section, method: ExtractMethod): ProjectRecord[] {
  const out: ProjectRecord[] = [];
  const inline = sec.lines.filter((l) => l.bullet && /^- [^:]{2,70}?(?:\s*\([^)]*\))?\s*:\s+\S/.test(l.text) && !PROJECT_FIELD.test(plain(l))).length;
  // Style A: every bullet is a project ("- Name (Tag): what it does").
  const bulletProjects = inline >= Math.max(2, sec.lines.filter((l) => l.bullet).length * 0.6);
  // "Live: url", "Tech: ..." lines describe the current project; they never start one.
  const lines = sec.lines.map((l) => (!l.bullet && PROJECT_FIELD.test(l.text) ? { ...l, bullet: true, text: `- ${l.text}` } : l));
  const entries = bulletProjects ? splitBulletEntries(lines) : splitEntries(lines);
  for (const entry of entries) {
    const head = entry[0];
    const urls = entry.flatMap((l) => [...(l.text.match(/<(https?:[^>]+)>/g) || []).map((u) => u.slice(1, -1)), ...urlsIn(l.text.replace(/<https?:[^>]+>/g, ""))]);
    let name = "", description = "", techs: string[] = [];
    const headText = plain(head).replace(/<https?:[^>]+>/g, "").trim();
    const colon = headText.match(/^([^:]{2,70}?)(?:\s*\(([^)]*)\))?\s*:\s+(.+)$/);
    if (colon && (bulletProjects || head.bullet || colon[1].split(/\s+/).length <= 6)) {
      name = colon[1].trim();
      description = colon[3];
    } else {
      const segs = headText.replace(new RegExp(URL_IN_TEXT.source, "gi"), " ").split(/\s+\|\s+|\s+[–—]\s+/).map((s) => s.trim()).filter(Boolean);
      name = segs[0] ?? "";
      const paren = name.match(/^(.*?)\s*\(([^)]+)\)$/);
      if (paren && paren[2].split(/\s*,\s*/).every((t) => t.split(/\s+/).length <= 3)) { name = paren[1]; techs.push(...paren[2].split(/\s*,\s*/)); }
      for (const s of segs.slice(1)) {
        if (hasDate(s)) continue;
        const items = s.replace(/^(?:tech(?:nologies)?|stack|tools)\s*:\s*/i, "").split(/\s*,\s*/).filter(Boolean);
        if (items.every((t) => t.split(/\s+/).length <= 3)) techs.push(...items);
      }
    }
    name = cleanDisplay(stripDates(name)).replace(/\s*\($/, "");
    if (!name || name.length > 120 || isProse(name)) continue;
    const bodyLines = entry.slice(1).map((l) => plain(l).replace(/<(https?:[^>]+)>/g, " $1 ").trim());
    for (const b of bodyLines) {
      const m = b.match(/^(?:tech(?:nologies)?(?:\s+used)?|stack|tech stack|tools|built with)\s*:\s*(.+)$/i);
      if (m) techs.push(...m[1].split(/\s*,\s*/));
    }
    description = [description, ...bodyLines.filter((b) => !/^(?:tech(?:nologies)?|stack|tech stack|tools|built with|live|demo|repo|github|link|url)\s*:/i.test(b) && !/^https?:\/\//.test(b))].filter(Boolean).join(" ").slice(0, 1000);
    for (const t of techMentions(`${headText} ${description}`)) if (!techs.some((x) => x.toLowerCase() === t.toLowerCase())) techs.push(t);
    techs = [...new Map(techs.map((t) => [canonicalSkill(t.trim()).toLowerCase(), canonicalSkill(t.trim())])).values()].filter((t) => t && t.length <= 40);
    const repo = urls.find((u) => /(?:github|gitlab|bitbucket)\.(?:com|org)\/[^/]+\/[^/\s]+/i.test(u));
    const demo = urls.find((u) => u !== repo && !/linkedin\.com/i.test(u));
    const { start, end } = firstRange([headText]);
    out.push({
      name: name.slice(0, 200), description, technologies: techs, repositoryUrl: repo, demoUrl: demo, start, end,
      evidence: evidenceOf(entry, "projects", method),
      review: { status: "high_confidence", confidence: 0, issues: [], fields: {} },
    });
  }
  return out;
}

function splitBulletEntries(lines: Line[]): Line[][] {
  const out: Line[][] = [];
  for (const l of lines) {
    if (out.length && PROJECT_FIELD.test(plain(l))) out[out.length - 1].push({ ...l });
    else if (l.bullet || !out.length) out.push([{ ...l }]);
    else out[out.length - 1][0].text += ` ${l.text}`;
  }
  return out;
}

/** Bulleted or one-per-line lists whose wrapped lines join the previous item. */
function splitListItems(lines: Line[]): Line[][] {
  const anyBullet = lines.some((l) => l.bullet);
  const out: Line[][] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    const prevText = prev ? prev.map((x) => x.text).join(" ") : "";
    const open = prev && ((prevText.match(/\(/g) || []).length > (prevText.match(/\)/g) || []).length || /[,(—–-]$/.test(prevText));
    const cont = prev && !l.bullet && (anyBullet || open || /^[a-z(]/.test(l.text) || (/^\d+\.\s/.test(prev[0].text) && !/^\d+\.\s/.test(l.text)));
    if (cont) prev.push({ ...l });
    else out.push([{ ...l }]);
  }
  return out;
}

// ---------------------------------------------------------------- certifications

const KNOWN_ISSUERS = /^(?:the\s+)?(?:coursera|udemy|udacity|edx|aws|amazon web services|amazon|google(?: cloud)?|microsoft|ibm|meta|nvidia|cisco|oracle|infosys|simplilearn|great learning|linkedin learning|freecodecamp|kaggle|forage|nptel|hackerrank|deeplearning\.ai|stanford online|scrum alliance|pmi|garp|cfa institute|tableau|salesforce|red hat|the linux foundation|linux foundation|comptia|isaca|\(isc\)2|blockseblock|reliance foundation|the chartered institute for it|hubspot|google digital garage|nasscom|iit|nit)\b/i;

function parseCertifications(sec: Section, method: ExtractMethod): CertificationRecord[] {
  const out: CertificationRecord[] = [];
  const items = splitListItems(sec.lines);
  // Date-only lines belong to the next item; issuer-only lines to the previous one.
  const merged: Line[][] = [];
  let pendingDate: Line[] = [];
  for (const it of items) {
    const text = plain(it[0]);
    const prev = merged[merged.length - 1];
    if (it.length === 1 && hasDate(text) && !stripDates(text).replace(/[^\p{L}]/gu, "")) {
      if (prev && !prev.some((l) => hasDate(l.text))) prev.push(...it);
      else pendingDate.push(...it);
      continue;
    }
    if (prev && it.length === 1 && !it[0].bullet && (KNOWN_ISSUERS.test(text) || (ORG_CUES.test(text) && text.split(/\s+/).length <= 6) || /^the\s/i.test(text)) && !/\b(?:certified|certificate|certification|course|specialization|programme|bootcamp)\b/i.test(text)) {
      prev.push({ ...it[0], text: `__ISSUER__${text}` });
      continue;
    }
    merged.push([...pendingDate, ...it]);
    pendingDate = [];
  }
  for (const entry of merged) {
    let issuer: string | undefined;
    const parts: string[] = [];
    for (const l of entry) {
      if (l.text.startsWith("__ISSUER__")) issuer = l.text.slice(10);
      else parts.push(plain(l));
    }
    let text = parts.join(" ").replace(/<https?:[^>]+>/g, (m) => ` ${m} `);
    const credentialUrl = (text.match(/<(https?:[^>]+)>/) || [])[1] ?? urlsIn(text)[0];
    text = text.replace(/<https?:[^>]+>/g, " ").replace(new RegExp(URL_IN_TEXT.source, "gi"), (m) => (/\.(?:com|org|io|net|ai)/i.test(m) && /\//.test(m) ? " " : m));
    const cred = text.match(/\(?\s*(?:credential|certificate|cert|license|licence)\s*(?:id|no\.?|number|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})\s*\)?/i);
    if (cred) text = text.replace(cred[0], " ");
    const expiresM = text.match(/\b(?:expires?|expiry|valid (?:until|till|through))\s*:?\s*([A-Za-z]{3,9}\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})/i);
    let expires: NormDate | undefined;
    if (expiresM) { expires = findDatePoints(expiresM[1])[0]; text = text.replace(expiresM[0], " "); }
    const points = findDatePoints(text);
    // The issue date is the last date that stands apart (end of line, own segment or brackets);
    // a year inside a name ("Oracle Cloud Infrastructure 2025 Certified ...") stays in the name.
    const last = points[points.length - 1];
    const tail = last ? text.slice(last.index + last.text.length) : "";
    const standalone = last && (!/[\p{L}]/u.test(tail.replace(/[()\]|,.;:\s-]/g, "")) || /[|,(]\s*$/.test(text.slice(0, last.index)));
    const issued = standalone ? last : undefined;
    const inProgress = /\b(?:in progress|ongoing|pursuing|currently enrolled|expected)\b/i.test(text);
    if (issued && last) text = `${text.slice(0, last.index)} ${text.slice(last.index + last.text.length)}`;
    text = cleanDisplay(text.replace(/\(\s*\)/g, " ").replace(/\b(?:issued|completed|in progress|ongoing|pursuing)\b\s*:?/gi, " "));
    let name = text;
    const strongSep = /\s+\|\s+|\s+—\s+/.test(text);
    const segs = text.split(strongSep ? /\s+\|\s+|\s+—\s+/ : /\s+[–—]\s+|\s+-\s+/).map((s) => cleanDisplay(s)).filter(Boolean);
    if (segs.length >= 2) {
      const issuerIdx = segs.findIndex((s, i) => i > 0 && KNOWN_ISSUERS.test(s));
      if (KNOWN_ISSUERS.test(segs[0]) && !KNOWN_ISSUERS.test(segs[1])) { issuer ??= segs[0]; name = segs.slice(1).join(" - "); }
      else { name = segs[0]; issuer ??= segs[issuerIdx > 0 ? issuerIdx : 1]; }
    } else {
      const paren = text.match(/^(.*?)\s*\(([^)]+)\)$/);
      const comma = text.split(/\s*,\s*/);
      if (paren && KNOWN_ISSUERS.test(paren[2])) { name = paren[1]; issuer ??= paren[2]; }
      else if (comma.length >= 2 && KNOWN_ISSUERS.test(comma[comma.length - 1])) { name = comma.slice(0, -1).join(", "); issuer ??= comma[comma.length - 1]; }
      else {
        const by = text.match(/^(.*?)\s+(?:by|from|issued by)\s+(.+)$/i);
        if (by && by[2].split(/\s+/).length <= 5) { name = by[1]; issuer ??= by[2]; }
      }
    }
    name = cleanDisplay(name);
    if (!name || name.length < 3 || name.length > 200) continue;
    out.push({
      name, issuer: issuer ? cleanDisplay(issuer).slice(0, 150) || undefined : undefined, issued, expires,
      credentialId: cred?.[1], credentialUrl, status: inProgress ? "in_progress" : undefined,
      evidence: evidenceOf(entry.filter((l) => !l.text.startsWith("__ISSUER__")), "certifications", method),
      review: { status: "high_confidence", confidence: 0, issues: [], fields: {} },
    });
  }
  return out;
}

// ---------------------------------------------------------------- awards, publications, memberships

const HACKATHON = /hackathon|\bgrid\b|solution challenge|ideathon|datathon|codathon|code ?fest|hack\b|coding (?:contest|competition)|devfest|buildathon/i;
const RESTATEMENT = /^(?:publications?|leadership|education|projects?|experience|skills|certifications?)\s*:/i;

function parseAwards(sec: Section, method: ExtractMethod): AwardRecord[] {
  const out: AwardRecord[] = [];
  for (const entry of splitListItems(sec.lines)) {
    let text = cleanDisplay(entry.map((l) => plain(l)).join(" "));
    if (text.length < 4 || RESTATEMENT.test(text)) continue;
    const yearParen = text.match(/\s*\((\d{4})\)\s*$/);
    const date = findDatePoints(text).pop();
    if (yearParen) text = text.slice(0, yearParen.index).trim();
    out.push({
      title: text.slice(0, 250),
      category: HACKATHON.test(text) || /hackathon|competition/i.test(sec.heading) && HACKATHON.test(`${text} ${sec.heading}`) ? "hackathon" : "award",
      date, evidence: evidenceOf(entry, "awards", method),
    });
  }
  return out;
}

function parsePublications(sec: Section, method: ExtractMethod): PublicationRecord[] {
  const out: PublicationRecord[] = [];
  const lines = sec.lines.map((l) => ({ ...l, bullet: l.bullet || /^(?:\d+[.)]|\[\d+\])\s/.test(l.text) }));
  for (const entry of splitListItems(lines)) {
    let text = cleanDisplay(entry.map((l) => plain(l)).join(" ").replace(/^(?:\d+[.)]|\[\d+\])\s*/, ""));
    if (text.length < 8) continue;
    let type: PublicationRecord["type"] = "paper";
    const label = text.match(/^(patent|book|paper|publication|journal|conference|thesis)\s*:\s*/i);
    if (label) { type = /patent/i.test(label[1]) ? "patent" : /book/i.test(label[1]) ? "book" : /conference/i.test(label[1]) ? "conference" : /thesis/i.test(label[1]) ? "thesis" : "paper"; text = text.slice(label[0].length); }
    else if (/\bpatent\b/i.test(text)) type = "patent";
    const date = findDatePoints(text).pop();
    let title: string, venue: string | undefined;
    if (type === "patent") {
      title = text.split(/:\s+/)[0];
    } else {
      const m = text.match(/^(.{12,}?[^A-Z.])\.\s+(.+)$/);
      title = m ? m[1] : text;
      venue = m ? cleanDisplay(stripDates(m[2]).replace(/\.$/, "")).split(/\.\s/)[0] : undefined;
      if (venue && /^(?:author|co-?author)/i.test(venue)) venue = undefined;
    }
    out.push({ title: cleanDisplay(title).slice(0, 250), type, venue: venue?.slice(0, 150) || undefined, date, evidence: evidenceOf(entry, "publications", method) });
  }
  return out;
}

// ---------------------------------------------------------------- personal

const PHONE_RE = /(?<![\w+])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,5}\)[\s.-]?)?\d{2,5}(?:[\s.-]?\d{2,5}){1,4}(?![\w])/g;

function findPhones(text: string): Array<{ value: string; normalized: string }> {
  const out: Array<{ value: string; normalized: string }> = [];
  const masked = text.replace(EMAIL_RE, " ").replace(/https?:\/\/\S+/g, " ");
  // ORCID iDs (0000-0002-1825-0097) and similar grouped identifiers are not phone numbers.
  const unmasked = masked.replace(/\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b|orcid\S*/gi, " ");
  for (const m of unmasked.matchAll(PHONE_RE)) {
    const value = m[0].trim();
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) continue;
    if (findDateRanges(value).length || /^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/.test(value)) continue;
    const intl = value.startsWith("+");
    const normalized = intl ? `+${digits}` : digits.length === 10 && /^[6-9]/.test(digits) ? `+91${digits}` : digits;
    out.push({ value, normalized });
  }
  return out;
}

function nameShaped(text: string): boolean {
  const t = text.replace(/^(?:dr|mr|mrs|ms|prof)\.?\s+/i, "");
  const words = t.split(/\s+/);
  return words.length >= 2 && words.length <= 5 && /^[\p{L}][\p{L}.'’ -]+$/u.test(t) && !TITLE_WORDS.test(t) && !familyOf(headingKey(t)) &&
    !/\b(?:resume|curriculum|vitae|cv|profile|contact)\b/i.test(t) && !isLocation(t) && !ORG_CUES.test(t);
}

// ---------------------------------------------------------------- validation

const ISSUE_WEIGHT: Record<string, number> = {
  missing_title: 0.3, missing_organization: 0.3, missing_institution: 0.25, missing_degree: 0.15,
  end_before_start: 0.6, ambiguous_date: 0.2, future_start: 0.3, title_organization_order_inferred: 0.25,
  evidence_not_found: 0.5, low_ocr_quality: 0.25, duplicate_conflict: 0.3, unparsed_date: 0.15,
};

function validateDates(start: NormDate | undefined, end: NormDate | undefined, issues: string[], fields: Record<string, FieldStatus>, now: Date, allowFuture = false) {
  const nowKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  fields.start = start?.value ? (start.ambiguous ? "needs_review" : "high_confidence") : "not_found";
  fields.end = end?.present ? "high_confidence" : end?.value ? (end.ambiguous ? "needs_review" : "high_confidence") : "not_found";
  if ((start?.ambiguous || end?.ambiguous) && !issues.includes("ambiguous_date")) issues.push("ambiguous_date");
  const cmp = compareDates(start, end);
  if (cmp !== null && cmp > 0) {
    issues.push("end_before_start");
    fields.start = fields.end = "invalid";
  }
  if (!allowFuture && start?.value && start.value > nowKey.slice(0, start.value.length)) {
    issues.push("future_start");
    fields.start = "needs_review";
  }
}

function finish(review: Review, method: ExtractMethod, quality: number | undefined) {
  if (method === "ocr" && quality !== undefined && quality < 0.75 && !review.issues.includes("low_ocr_quality")) review.issues.push("low_ocr_quality");
  const base = method === "ocr" ? 0.85 * (quality ?? 0.9) : 0.95;
  const penalty = review.issues.reduce((s, i) => s + (ISSUE_WEIGHT[i] ?? 0.15), 0);
  review.confidence = Math.max(0.05, Math.round((base - penalty) * 100) / 100);
  review.status = review.issues.includes("end_before_start") ? "invalid"
    : review.issues.includes("duplicate_conflict") ? "conflicting"
    : method === "ocr" && quality !== undefined && quality < 0.45 ? "unreadable"
    : review.issues.length ? "needs_review" : "high_confidence";
}

// ---------------------------------------------------------------- de-duplication

const key = (...parts: Array<string | undefined>) => parts.map((p) => (p ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").trim()).join("|");

function dedupe<T extends { evidence: Evidence; review?: Review }>(records: T[], k: (r: T) => string, sameValues: (a: T, b: T) => boolean, warnings: string[], label: string): T[] {
  const out: T[] = [];
  for (const r of records) {
    const existing = out.find((o) => k(o) === k(r));
    if (!existing) { out.push(r); continue; }
    if (sameValues(existing, r)) {
      warnings.push(`Duplicate ${label} merged: ${k(r).replace(/\|/g, " ").trim().slice(0, 60)}`);
      continue;
    }
    // Same thing listed twice with different details: keep both, ask the student.
    for (const x of [existing, r]) if (x.review && !x.review.issues.includes("duplicate_conflict")) x.review.issues.push("duplicate_conflict");
    out.push(r);
  }
  return out;
}

const sameDate = (a?: NormDate, b?: NormDate) => (a?.value ?? null) === (b?.value ?? null);

// ---------------------------------------------------------------- entry point

export function extractCv(text: string, opts: ExtractOptions = {}): ExtractedCv {
  const method = opts.method ?? "text";
  const now = opts.now ?? new Date();
  const lines = prepareLines(text, opts.lines, method === "ocr");
  const sections = segment(lines);
  const warnings: string[] = [];
  const quality = (page: number) => opts.pageQuality?.[page];

  const cv: ExtractedCv = {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    personal: { emails: [], phones: [], links: [] },
    education: [], experience: [], leadership: [], volunteering: [], projects: [], skills: [], certifications: [], awards: [],
    publications: [], languages: [], memberships: [], other: [], referenceContacts: [],
    sections: sections.filter((s) => s.family !== "header").map((s) => ({
      section: s.family, heading: s.heading, page: (s.headingLine ?? s.lines[0])?.page ?? 1,
      lineStart: (s.headingLine ?? s.lines[0])?.i ?? 0, lineEnd: s.lines[s.lines.length - 1]?.i ?? 0,
    })),
    warnings,
  };

  // Name: the largest name-shaped line on page 1 (works for sidebars where the
  // name is read after the sidebar), else the first name-shaped header line.
  const page1 = lines.filter((l) => l.page === (lines[0]?.page ?? 1));
  const heights = page1.filter((l) => l.height > 0).map((l) => l.height).sort((a, b) => a - b);
  const body = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  const shaped = page1.filter((l) => !l.bullet && nameShaped(plain(l).replace(/\s*\|.*$/, "")));
  let nameLine = body > 0 ? [...shaped].sort((a, b) => b.height - a.height).find((l) => l.height >= body * 1.3) : undefined;
  nameLine ??= shaped.find((l) => sections[0].lines.includes(l)) ?? (sections[0].lines.length === 0 ? shaped[0] : undefined);
  if (nameLine) {
    const value = plain(nameLine).replace(/\s*\|.*$/, "").trim();
    cv.personal.fullName = { value, evidence: evidenceOf([nameLine], "header", method) };
    const next = lines[lines.indexOf(nameLine) + 1];
    if (next && !next.bullet && !/@|\d{5}|https?:|www\.|\|/.test(next.text) && next.text.split(/\s+/).length <= 10 && !classifyHeading(next, body) && !isLocation(next.text) && !hasDate(next.text)) {
      cv.personal.headline = { value: next.text, evidence: evidenceOf([next], "header", method) };
    }
  }
  const consumed = new Set<Line>([nameLine, lines.find((l) => cv.personal.headline && l.text === cv.personal.headline.value && l.i === cv.personal.headline.evidence.lineStart)].filter(Boolean) as Line[]);

  // References: collect their contacts so they are never read as the candidate's.
  for (const s of sections.filter((s) => s.family === "references")) {
    for (const l of s.lines) {
      for (const e of l.text.match(EMAIL_RE) || []) cv.referenceContacts.push(e.toLowerCase());
      for (const p of findPhones(l.text)) cv.referenceContacts.push(p.normalized);
    }
  }

  // Contact details: header and contact sections first, then anywhere but references.
  const contactZone = sections.filter((s) => s.family === "header" || s.family === "contact").flatMap((s) => s.lines);
  const elsewhere = sections.filter((s) => !["header", "contact", "references"].includes(s.family)).flatMap((s) => s.lines);
  for (const l of [...contactZone, ...elsewhere]) {
    for (const e of l.text.match(EMAIL_RE) || []) {
      const v = e.toLowerCase();
      if (!cv.referenceContacts.includes(v) && !cv.personal.emails.some((x) => x.value === v)) cv.personal.emails.push({ value: v, evidence: evidenceOf([l], "contact", method) });
    }
  }
  for (const l of contactZone.length ? contactZone : lines.slice(0, 12)) {
    for (const p of findPhones(l.text)) {
      if (!cv.referenceContacts.includes(p.normalized) && !cv.personal.phones.some((x) => x.normalized === p.normalized)) cv.personal.phones.push({ ...p, evidence: evidenceOf([l], "contact", method) });
    }
    if (!cv.personal.location) {
      const labelled = l.text.match(/\b(?:location|address|based in|city)\s*[:\-]\s*([^|•]{3,80})/i);
      const segs = labelled ? [labelled[1]] : l.text.split(/\s*[|•]\s*/);
      for (const s of segs) {
        const v = isLocation(s.trim()) ? s.trim() : placeSuffix(s.trim());
        if (v && !/^(?:remote|hybrid)$/i.test(v)) { cv.personal.location = { value: v, evidence: evidenceOf([l], "contact", method) }; break; }
      }
    }
  }

  // Personal links: addresses in the header/contact area, and profile URLs anywhere outside projects.
  const linkSeen = new Set<string>();
  const addLink = (u: string, l: Line) => {
    const k = u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (linkSeen.has(k) || /@/.test(u)) return;
    linkSeen.add(k);
    cv.personal.links.push({ url: u, evidence: evidenceOf([l], "contact", method) });
  };
  const PROFILE_URL = /(?:linkedin\.com\/(?:in|pub)\/[^/\s]+|github\.com\/[^/\s]+\/?$|scholar\.google\.[a-z.]+\/citations|orcid\.org\/\d{4}-|leetcode\.com\/|kaggle\.com\/[^/\s]+\/?$|huggingface\.co\/[^/\s]+\/?$|behance\.net\/|dribbble\.com\/|medium\.com\/@|stackoverflow\.com\/users\/)/i;
  for (const l of contactZone) for (const u of [...(l.text.match(/<(https?:[^>]+)>/g) || []).map((x) => x.slice(1, -1)), ...urlsIn(l.text.replace(/<https?:[^>]+>/g, " "))]) addLink(u, l);
  for (const s of sections.filter((s) => !["projects", "references", "header", "contact"].includes(s.family))) {
    for (const l of s.lines) for (const u of urlsIn(l.text.replace(/[<>]/g, " "))) if (PROFILE_URL.test(u)) addLink(u, l);
  }

  for (const s of sections) {
    const lines = s.lines.filter((l) => !consumed.has(l));
    if (!lines.length) continue;
    const sec = { ...s, lines };
    const q = quality(lines[0].page);
    switch (s.family) {
      case "summary": {
        const t = cleanDisplay(lines.map((l) => plain(l)).join(" "));
        if (t && !cv.summary) cv.summary = { text: t.slice(0, 2000), evidence: evidenceOf(lines, "summary", method) };
        break;
      }
      case "experience": case "leadership": case "volunteering": {
        const recs = splitEntries(lines, { repeatKeys: [hasDate] }).map((e) => parseExperience(e, sec, method)).filter(Boolean) as ExperienceRecord[];
        for (const r of recs) {
          if (s.family === "volunteering") r.type = "volunteering";
          const fields: Record<string, FieldStatus> = { title: r.title ? "high_confidence" : "not_found", organization: r.organization ? "high_confidence" : "not_found" };
          if (!r.title) r.review.issues.push("missing_title");
          if (!r.organization) r.review.issues.push("missing_organization");
          if (r.review.issues.includes("title_organization_order_inferred")) fields.title = fields.organization = "needs_review";
          validateDates(r.start, r.end, r.review.issues, fields, now);
          r.review.fields = fields;
          finish(r.review, method, q);
          (s.family === "volunteering" ? cv.volunteering : s.family === "leadership" ? cv.leadership : cv.experience).push(r);
        }
        break;
      }
      case "education": {
        const header = lines.find((l) => tableHeader(l.text));
        const table = header ? tableHeader(header.text) : null;
        const body = lines.filter((l) => l !== header);
        // A name-like line after an entry that already has its degree and dates starts the next school.
        const instLike = (t: string) => { const c = cleanDisplay(stripDates(t)); return Boolean(c) && !DEGREE_FIND.test(c) && !findGrade(c) && !isLocation(c) && /^[\p{Lu}]/u.test(c) && c.split(/\s+/).length <= 10; };
        const entries = table ? body.map((l) => [l]) : splitEntries(body, {
          repeatKeys: [hasDate, (t) => INSTITUTION_RE.test(t), (t) => DEGREE_FIND.test(t)],
          startsNew: (l, cur) => instLike(l.text) && cur.some((c) => DEGREE_FIND.test(c.text)) && cur.some((c) => hasDate(c.text)),
        });
        for (const e of entries) {
          const r = parseEducation(e, sec, method, table);
          if (!r) continue;
          const fields: Record<string, FieldStatus> = {
            institution: r.institution ? "high_confidence" : "not_found", degree: r.degree ? "high_confidence" : "not_found",
            fieldOfStudy: r.fieldOfStudy ? "high_confidence" : "not_found", grade: r.grade ? "high_confidence" : "not_found",
          };
          if (!r.institution) r.review.issues.push("missing_institution");
          if (!r.degree && !r.fieldOfStudy) r.review.issues.push("missing_degree");
          validateDates(r.start, r.end, r.review.issues, fields, now, true);
          r.review.fields = fields;
          finish(r.review, method, q);
          cv.education.push(r);
        }
        break;
      }
      case "skills": case "languages": {
        const { skills, languages } = parseSkillItems(sec, method);
        cv.skills.push(...skills);
        cv.languages.push(...languages);
        break;
      }
      case "projects":
        for (const r of parseProjects(sec, method)) {
          r.review.fields = { name: "high_confidence", technologies: r.technologies.length ? "high_confidence" : "not_found", url: r.repositoryUrl || r.demoUrl ? "high_confidence" : "not_found" };
          finish(r.review, method, q);
          cv.projects.push(r);
        }
        break;
      case "certifications":
        for (const r of parseCertifications(sec, method)) {
          const fields: Record<string, FieldStatus> = { name: "high_confidence", issuer: r.issuer ? "high_confidence" : "not_found", issued: r.issued?.value ? (r.issued.ambiguous ? "needs_review" : "high_confidence") : "not_found" };
          if (r.issued?.ambiguous) r.review.issues.push("ambiguous_date");
          r.review.fields = fields;
          finish(r.review, method, q);
          cv.certifications.push(r);
        }
        break;
      case "awards":
        cv.awards.push(...parseAwards(sec, method));
        break;
      case "publications":
        cv.publications.push(...parsePublications(sec, method));
        break;
      case "memberships":
        for (const e of splitListItems(lines)) cv.memberships.push({ heading: s.heading, content: cleanDisplay(e.map((l) => plain(l)).join(" ")), evidence: evidenceOf(e, "memberships", method) });
        break;
      case "header": case "contact": case "references": case "declaration":
        break;
      default:
        if (s.family === "interests" || s.family === "other") {
          const content = cleanDisplay(lines.map((l) => plain(l)).join("; "));
          if (content) cv.other.push({ heading: s.heading || s.family, content: content.slice(0, 1500), evidence: evidenceOf(lines, s.family, method) });
        }
    }
  }

  // Duplicates: identical repeats merge; same item with different details is flagged.
  cv.education = dedupe(cv.education, (r) => key(r.institution, r.degree, r.fieldOfStudy), (a, b) => sameDate(a.end, b.end) && (a.grade?.value ?? "") === (b.grade?.value ?? ""), warnings, "education");
  cv.experience = dedupe(cv.experience, (r) => key(r.organization, r.title), (a, b) => sameDate(a.start, b.start) && sameDate(a.end, b.end), warnings, "experience");
  cv.certifications = dedupe(cv.certifications, (r) => key(r.name), (a, b) => (a.issuer ?? "") === (b.issuer ?? "") && sameDate(a.issued, b.issued), warnings, "certification");
  cv.projects = dedupe(cv.projects, (r) => key(r.name), () => true, warnings, "project");
  cv.skills = [...new Map(cv.skills.map((s) => [key(s.name), s])).values()];
  cv.languages = [...new Map(cv.languages.map((s) => [key(s.language), s])).values()];
  cv.awards = [...new Map(cv.awards.map((a) => [key(a.title), a])).values()];
  cv.publications = [...new Map(cv.publications.map((p) => [key(p.title), p])).values()];
  for (const r of [...cv.education, ...cv.experience, ...cv.certifications]) if (r.review.issues.includes("duplicate_conflict")) finish(r.review, method, quality(r.evidence.page));

  if (!cv.personal.fullName) warnings.push("Name not found; it is left empty for the student to enter.");
  if (!sections.some((s) => s.family !== "header")) warnings.push("No section headings were recognised; records may be incomplete.");
  return cv;
}
