/**
 * Date parsing for CV text. Every result keeps the raw text and records the
 * precision actually present: "Aug 2021" is a month, "2021" is a year. A
 * numeric day/month/year whose order cannot be known (12/03/2022) keeps only
 * the year and is marked ambiguous; nothing is guessed.
 */

export type DatePrecision = "month" | "year";

export interface NormDate {
  raw: string;
  /** "YYYY-MM" or "YYYY"; null for "Present" or when no year is readable. */
  value: string | null;
  precision: DatePrecision | null;
  present?: boolean;
  ambiguous?: boolean;
  expected?: boolean;
}

export interface DateRange {
  start?: NormDate;
  end?: NormDate;
  /** The matched text, for removal from the line. */
  text: string;
  index: number;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const YEAR4 = "(?:19|20)\\d{2}";
const PRESENT = "(?:present|current(?:ly)?|now|ongoing|till\\s+(?:date|now)|to\\s+date|today)";
const SEASON = "(?:summer|winter|spring|fall|autumn|monsoon)";

/** One date point. Alternatives are ordered from most to least specific. */
const POINT =
  `(?:(?:expected|exp\\.?|anticipated)\\s*:?\\s*)?` +
  `(?:` +
  `${MONTH}\\.?,?\\s*['’]?\\s*(?:${YEAR4}|\\d{2}\\b)` + // Aug 2021, Aug. '21
  `|\\d{1,2}\\s*[/.\\-]\\s*\\d{1,2}\\s*[/.\\-]\\s*${YEAR4}` + // 12/03/2022
  `|${YEAR4}\\s*[/.\\-]\\s*(?:0?[1-9]|1[0-2])(?![\\d])` + // 2021-08
  `|(?:0?[1-9]|1[0-2])\\s*[/.\\-]\\s*${YEAR4}` + // 08/2021
  `|${SEASON}\\s+${YEAR4}` + // Summer 2018
  `|q[1-4]\\s*${YEAR4}` +
  `|${YEAR4}` +
  `)` +
  `(?:\\s*\\(\\s*(?:expected|exp\\.?)\\s*\\))?`;

const END = `(?:${POINT}|${PRESENT})`;
const SEP = "\\s*(?:–|—|-|~|→|\\bto\\b|\\btill\\b|\\buntil\\b)\\s*";

const RANGE_RE = new RegExp(`(?<![\\w/.])(${POINT})${SEP}(${END})(?![\\w/])`, "gi");
/** Academic sessions: 2016-20, 2017–19. */
const SESSION_RE = new RegExp(`(?<![\\w/.])(${YEAR4})\\s*[–—\\-/]\\s*(\\d{2})(?![\\d/.\\-])`, "g");
const POINT_RE = new RegExp(`(?<![\\w/.])(${POINT}|${PRESENT})(?![\\w/])`, "gi");

export function parseDatePoint(raw: string): NormDate {
  const text = raw.normalize("NFKC").trim();
  const r = text.toLowerCase().replace(/\s+/g, " ");
  const expected = /expected|exp\.?|anticipated/.test(r);
  const base = { raw: text, ...(expected ? { expected: true } : {}) };
  if (new RegExp(`^${PRESENT}$`, "i").test(r)) return { raw: text, value: null, precision: null, present: true };

  let m = r.match(new RegExp(`(${MONTH})\\.?,?\\s*['’]?\\s*(${YEAR4}|\\d{2})\\b`, "i"));
  if (m) {
    const month = MONTH_NAMES[m[1].replace(/\.$/, "")] ?? MONTH_NAMES[m[1].slice(0, 3)];
    const year = m[2].length === 2 ? `20${m[2]}` : m[2];
    return { ...base, value: `${year}-${String(month).padStart(2, "0")}`, precision: "month" };
  }
  m = r.match(new RegExp(`(\\d{1,2})\\s*[/.\\-]\\s*(\\d{1,2})\\s*[/.\\-]\\s*(${YEAR4})`));
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a > 12 && b >= 1 && b <= 12) return { ...base, value: `${m[3]}-${String(b).padStart(2, "0")}`, precision: "month" };
    if (b > 12 && a >= 1 && a <= 12) return { ...base, value: `${m[3]}-${String(a).padStart(2, "0")}`, precision: "month" };
    return { ...base, value: m[3], precision: "year", ambiguous: true };
  }
  m = r.match(new RegExp(`(${YEAR4})\\s*[/.\\-]\\s*(0?[1-9]|1[0-2])(?!\\d)`));
  if (m) return { ...base, value: `${m[1]}-${m[2].padStart(2, "0")}`, precision: "month" };
  m = r.match(new RegExp(`(0?[1-9]|1[0-2])\\s*[/.\\-]\\s*(${YEAR4})`));
  if (m) return { ...base, value: `${m[2]}-${m[1].padStart(2, "0")}`, precision: "month" };
  m = r.match(new RegExp(YEAR4));
  if (m) return { ...base, value: m[0], precision: "year" };
  return { raw: text, value: null, precision: null };
}

/** All date ranges in a line, in order. Session forms (2016-20) included. */
export function findDateRanges(text: string): DateRange[] {
  const out: DateRange[] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    out.push({ start: parseDatePoint(m[1]), end: parseDatePoint(m[2]), text: m[0], index: m.index ?? 0 });
  }
  for (const m of text.matchAll(SESSION_RE)) {
    const idx = m.index ?? 0;
    if (out.some((r) => idx >= r.index && idx < r.index + r.text.length)) continue;
    const startYear = Number(m[1]);
    let endYear = Math.floor(startYear / 100) * 100 + Number(m[2]);
    if (endYear < startYear) endYear += 100;
    if (endYear - startYear > 8) continue;
    out.push({ start: { raw: m[1], value: m[1], precision: "year" }, end: { raw: m[0].slice(m[0].search(/\d{2}$/)), value: String(endYear), precision: "year" }, text: m[0], index: idx });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Single dates (outside any range) in a line. */
export function findDatePoints(text: string): Array<NormDate & { index: number; text: string }> {
  const ranges = findDateRanges(text);
  const out: Array<NormDate & { index: number; text: string }> = [];
  for (const m of text.matchAll(POINT_RE)) {
    const idx = m.index ?? 0;
    if (ranges.some((r) => idx >= r.index && idx < r.index + r.text.length)) continue;
    const d = parseDatePoint(m[1]);
    if (d.value || d.present) out.push({ ...d, index: idx, text: m[0] });
  }
  return out;
}

/** Removes date ranges, single dates and the empty brackets they leave. */
export function stripDates(text: string): string {
  let s = text;
  for (const r of findDateRanges(s).reverse()) s = s.slice(0, r.index) + " " + s.slice(r.index + r.text.length);
  s = s.replace(POINT_RE, " ");
  return s.replace(/\(\s*[-–—,]?\s*\)/g, " ").replace(/\s*[|,;–—-]\s*$/g, "").replace(/^\s*[|,;–—-]\s*/g, "").replace(/\s{2,}/g, " ").trim();
}

export function hasDate(text: string): boolean {
  return findDateRanges(text).length > 0 || findDatePoints(text).some((d) => d.value);
}

/** Compares two normalised values; month precision when both have it. */
export function compareDates(a: NormDate | undefined, b: NormDate | undefined): number | null {
  if (!a?.value || !b?.value) return null;
  const len = Math.min(a.value.length, b.value.length);
  const x = a.value.slice(0, len), y = b.value.slice(0, len);
  return x < y ? -1 : x > y ? 1 : 0;
}
