/**
 * Personal details beyond name and contact: phone normalisation, labelled
 * fields (date of birth, nationality, address, work authorisation, driving
 * licence, pronouns), name parts, location parts and derived profile facts.
 *
 * Everything here is deterministic and only reads what the document labels or
 * states. Nothing is inferred that the document does not support: a country
 * code is only added to a phone number when the number is written in the
 * Indian mobile format, and that inference is marked as such.
 */

import { placeKind } from "./lexicon";
import type { NormDate } from "./dates";

export type Confidence = "high" | "medium" | "low";

// ---------------------------------------------------------------- phones

const CC1 = new Set(["1", "7"]);
const CC2 = new Set(["20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98"]);
const CC3 = new Set(["212", "234", "254", "351", "352", "353", "354", "358", "380", "852", "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977"]);

function countryCodeOf(digits: string): string | undefined {
  if (CC3.has(digits.slice(0, 3))) return digits.slice(0, 3);
  if (CC2.has(digits.slice(0, 2))) return digits.slice(0, 2);
  if (CC1.has(digits[0])) return digits[0];
  return undefined;
}

export interface NormalizedPhone {
  value: string;
  /** E.164 when the country code is known (written, or inferred for Indian mobiles); otherwise the digits as written. */
  normalized: string;
  countryCode?: string;
  /** True when the country code was not written but inferred from the Indian mobile format. */
  countryCodeInferred?: boolean;
  national: string;
}

export function normalizePhone(value: string): NormalizedPhone {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");
  let explicit = trimmed.startsWith("+");
  if (!explicit && digits.startsWith("00") && digits.length >= 11) { digits = digits.slice(2); explicit = true; }
  if (explicit) {
    const cc = countryCodeOf(digits);
    return { value, normalized: `+${digits}`, ...(cc ? { countryCode: `+${cc}` } : {}), national: cc ? digits.slice(cc.length) : digits };
  }
  const national = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  // "98765 43210", "98765-43210", "9876543210": an Indian mobile. "(718) 555-0199" or
  // "718-555-0199" are North American groupings and get no country code.
  const nanpGrouping = /\(\d{3}\)|^\d{3}[\s.-]\d{3}[\s.-]\d{4}$/.test(trimmed);
  if (national.length === 10 && /^[6-9]/.test(national) && !nanpGrouping) {
    return { value, normalized: `+91${national}`, countryCode: "+91", countryCodeInferred: true, national };
  }
  return { value, normalized: digits, national: digits };
}

/** Last ten digits: compares the same number written with and without a country code. */
export const phoneKey = (normalized: string) => normalized.replace(/\D/g, "").slice(-10);

// ---------------------------------------------------------------- labelled fields

export type LabelledField = "dateOfBirth" | "nationality" | "pronouns" | "workAuthorization" | "drivingLicence" | "address";

const SEP = String.raw`\s*(?:[:\-–—]|\t)\s*`;
const LABELS: Array<[LabelledField, RegExp]> = [
  ["dateOfBirth", new RegExp(String.raw`^(?:date\s+of\s+birth|d\.?\s?o\.?\s?b\.?|birth\s*date|born(?:\s+on)?)${SEP}(.+)$`, "i")],
  ["nationality", new RegExp(String.raw`^(?:nationality|citizenship)${SEP}(.+)$`, "i")],
  ["pronouns", new RegExp(String.raw`^pronouns?${SEP}(.+)$`, "i")],
  ["workAuthorization", new RegExp(String.raw`^(?:work\s+authori[sz]ation|work\s+permit|visa(?:\s+status)?|right\s+to\s+work|employment\s+eligibility)${SEP}(.+)$`, "i")],
  ["drivingLicence", new RegExp(String.raw`^(?:driving\s+licen[cs]e|driver'?s\s+licen[cs]e)(?:\s+(?:no\.?|number))?${SEP}(.+)$`, "i")],
  ["address", new RegExp(String.raw`^((?:current|present|permanent|residential|home|correspondence|mailing|postal)\s+)?address${SEP}(.+)$`, "i")],
];

export interface LabelledValue { field: LabelledField; value: string; kind?: string }

/**
 * Labelled personal fields in one line ("DOB: 12 March 2001 | Nationality: Indian").
 * Other people's details ("Father's Name"), gender, marital status, religion and
 * identity-document numbers are never read.
 */
export function labelledFields(line: string): LabelledValue[] {
  const out: LabelledValue[] = [];
  for (const part of line.replace(/^- /, "").split(/\s+[|•·]\s+/)) {
    const p = part.trim();
    if (/^(?:father|mother|spouse|guardian|husband|wife|parent)'?s?\b/i.test(p)) continue;
    for (const [field, re] of LABELS) {
      const m = p.match(re);
      if (!m) continue;
      const value = (field === "address" ? m[2] : m[1]).trim().replace(/[;,.]$/, "");
      if (!value || value.length > 200) break;
      out.push({ field, value, ...(field === "address" ? { kind: (m[1] ?? "").trim().toLowerCase() || "address" } : {}) });
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- date of birth

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export interface ParsedDob { iso?: string; ambiguous: boolean; valid: boolean }

/** A full date of birth. "05/04/2001" could be either order: it is kept as written and flagged. */
export function parseDob(raw: string, now = new Date()): ParsedDob {
  const r = raw.trim().replace(/\s+/g, " ");
  let y: number | undefined, mo: number | undefined, d: number | undefined, ambiguous = false;
  let m: RegExpMatchArray | null;
  if ((m = r.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-./]+([A-Za-z]{3,9})\.?,?[\s\-./]+(\d{4})$/))) { d = +m[1]; mo = MONTHS[m[2].toLowerCase().slice(0, 3)]; y = +m[3]; }
  else if ((m = r.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/))) { mo = MONTHS[m[1].toLowerCase().slice(0, 3)]; d = +m[2]; y = +m[3]; }
  else if ((m = r.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = r.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    const a = +m[1], b = +m[2];
    y = +m[3];
    if (a > 12 && b <= 12) { d = a; mo = b; }
    else if (b > 12 && a <= 12) { mo = a; d = b; }
    else if (a === b) { d = a; mo = b; }
    else { ambiguous = true; d = a; mo = b; }
  }
  if (!y || !mo || !d) return { ambiguous: false, valid: false };
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  const plausible = y >= 1940 && y <= now.getUTCFullYear() - 13;
  if (!real || !plausible) return { ambiguous, valid: false };
  return { ambiguous, valid: true, ...(ambiguous ? {} : { iso: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` }) };
}

// ---------------------------------------------------------------- names

export const PRONOUNS_RE = /\(?\b((?:she|he|they|ze|xe)\s*\/\s*(?:her|him|them|hers|his|theirs|they|she|he|zir|xem|xyr)(?:\s*\/\s*[a-z]+)?)\b\)?/i;

/**
 * First / middle / last name, only when the split is unambiguous: two or three
 * full words. Initials, single names and longer names are left unsplit, since
 * naming order varies by culture and a wrong split is worse than none.
 */
export function nameParts(full: string): { first: string; middle?: string; last: string } | null {
  const t = full.replace(/^(?:dr|mr|mrs|ms|prof)\.?\s+/i, "").trim();
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 3) return null;
  if (words.some((w) => /^\p{L}\.?$/u.test(w) || /^(?:\p{L}\.){2,}\p{L}?$/u.test(w) || /^\p{Lu}{2,3}$/u.test(w))) return null;
  return words.length === 2 ? { first: words[0], last: words[1] } : { first: words[0], middle: words[1], last: words[2] };
}

// ---------------------------------------------------------------- places

const POSTAL = [
  /\b[1-9]\d{2}\s?\d{3}\b/, // India PIN (6 digits, may be written "560 034")
  /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/, // UK
  /\b\d{5}(?:-\d{4})?\b/, // US ZIP
];

export function postalCodeIn(text: string): string | undefined {
  for (const re of POSTAL) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return undefined;
}

export function locationParts(value: string): { city?: string; state?: string; country?: string; postalCode?: string } {
  const out: { city?: string; state?: string; country?: string; postalCode?: string } = {};
  const postal = postalCodeIn(value);
  if (postal) out.postalCode = postal;
  for (const raw of value.split(/\s*,\s*/)) {
    const p = raw.replace(postal ?? "\u0000", "").replace(/[-–]\s*$/, "").trim();
    const kind = p ? placeKind(p) : null;
    if (kind && !out[kind]) out[kind] = p;
  }
  return out;
}

// ---------------------------------------------------------------- derived profile facts

interface RoleLike { organization: string; title: string; type: string; start?: NormDate; end?: NormDate; current: boolean }

const monthIndex = (v: string) => Number(v.slice(0, 4)) * 12 + Number(v.slice(5, 7)) - 1;

/**
 * Total professional experience (employment, freelance, founder roles), with
 * overlapping roles counted once. Only calculable when every such role has
 * month-precision dates; internships and volunteering are not counted.
 */
export function experienceDuration(roles: RoleLike[], now = new Date()): { months: number; text: string } | null {
  const counted = roles.filter((r) => ["employment", "freelance", "founder"].includes(r.type));
  if (!counted.length) return null;
  const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const spans: Array<[number, number]> = [];
  for (const r of counted) {
    if (!r.start?.value || r.start.value.length !== 7) return null;
    const end = r.current || r.end?.present ? nowIdx : r.end?.value && r.end.value.length === 7 ? monthIndex(r.end.value) : null;
    if (end === null) return null;
    const s = monthIndex(r.start.value);
    if (end < s) return null;
    spans.push([s, end]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let months = 0, curS = spans[0][0], curE = spans[0][1];
  for (const [s, e] of spans.slice(1)) {
    if (s <= curE + 1) curE = Math.max(curE, e);
    else { months += curE - curS + 1; curS = s; curE = e; }
  }
  months += curE - curS + 1;
  const y = Math.floor(months / 12), m = months % 12;
  const text = [y ? `${y} year${y === 1 ? "" : "s"}` : "", m ? `${m} month${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "Less than a month";
  return { months, text };
}
