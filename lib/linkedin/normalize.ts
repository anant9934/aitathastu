/**
 * Provider output → one internal LinkedIn profile schema. Pure: no I/O.
 *
 * Provider output is untrusted. Every field is optional, typed, trimmed and
 * length-capped; nothing missing is filled in; dates keep only the precision
 * the source gave (a year stays a year). Records get deterministic keys from
 * their normalized fields so repeated runs upsert instead of duplicating.
 *
 * Field names follow the configured Apify actor (parseforge/linkedin-profile-scraper),
 * whose top-level, experience and education keys were read from a stored run
 * (fullName, headline, about, location, linkedinUrl, publicIdentifier,
 * experiences[{title, company, location, startDate, endDate, description,
 * employmentType, jobStillWorking, duration}], educations[{school, degree,
 * fieldOfStudy, startYear, endYear, description}], websites[], articles[{headline,
 * datePublished, url}], plus skills, languages, certifications, courses, projects,
 * publications, volunteerExperiences, honorsAwards). The inner keys of those
 * last sections were empty in every observed run, so they accept the common
 * variants (strings, or objects keyed name/title, issuer/authority, ...).
 * Deliberately NOT kept: other people's profiles (peopleAlsoViewed), posts,
 * images, follower counts and employer company details.
 */
export const LINKEDIN_NORMALIZATION_VERSION = "linkedin-norm-v1";

export const RECORD_KINDS = [
  "experience", "education", "skill", "language", "certification", "course",
  "project", "publication", "volunteering", "honor", "link",
] as const;
export type LinkedInRecordKind = (typeof RECORD_KINDS)[number];

/** Year, or year and month, exactly as precise as the source. */
export type PartialDate = { year: number; month?: number };

export type NormalizedRecord = { kind: LinkedInRecordKind; key: string; data: Record<string, unknown>; providerRecordId?: string };

export type NormalizedProfile = {
  profileUrl: string;
  publicIdentifier: string | null;
  fullName: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
};

export type NormalizationResult = {
  profile: NormalizedProfile;
  records: NormalizedRecord[];
  /** Which sections the provider returned at all (an empty array counts as returned). */
  sectionsReturned: LinkedInRecordKind[];
  /** Records dropped for being malformed, by kind. */
  rejected: Partial<Record<LinkedInRecordKind, number>>;
};

const MAX_PER_SECTION = 100;
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Trimmed, whitespace-collapsed string within `max` characters, or null. */
export function text(v: unknown, max = 300): string | null {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return t ? t.slice(0, max) : null;
}
const first = (o: Obj, keys: string[], max?: number) => {
  for (const k of keys) {
    const t = text(o[k], max);
    if (t) return t;
  }
  return null;
};

/** https URL without credentials, or null. */
export function cleanUrl(v: unknown): string | null {
  const t = text(v, 500);
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || !u.hostname.includes(".")) return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * "Jan 2020", "January 2020", "2020-03", "03/2020", "2020", { year, month }.
 * "Present"/"Current" and anything unrecognised give null; nothing is guessed.
 */
export function parsePartialDate(v: unknown): PartialDate | null {
  if (isObj(v)) {
    const year = Number(v.year);
    const month = Number(v.month);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
    return Number.isInteger(month) && month >= 1 && month <= 12 ? { year, month } : { year };
  }
  const t = text(v, 40)?.toLowerCase();
  if (!t || /present|current|now|ongoing/.test(t)) return null;
  let m = t.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, m[1] === "sept" ? 4 : 3)]) return valid({ year: +m[2], month: MONTHS[m[1].slice(0, m[1] === "sept" ? 4 : 3)] });
  m = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?(?:t.*)?$/);
  if (m) return valid({ year: +m[1], month: +m[2] });
  m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return valid({ year: +m[2], month: +m[1] });
  m = t.match(/^(\d{4})$/);
  if (m) return valid({ year: +m[1] });
  return null;
}
function valid(d: PartialDate): PartialDate | null {
  if (d.year < 1900 || d.year > 2100) return null;
  if (d.month !== undefined && (d.month < 1 || d.month > 12)) return { year: d.year };
  return d;
}
const fmt = (d: PartialDate | null) => (d ? (d.month ? `${d.year}-${String(d.month).padStart(2, "0")}` : String(d.year)) : null);
const isPresent = (v: unknown) => typeof v === "string" && /present|current|now/i.test(v);

function slug(...parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)).join("|");
}

/** The /in/<identifier> of a LinkedIn profile URL, lower-cased, or null. */
export function linkedinIdentifier(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/in\/([^/]+)\/?$/i);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
  } catch {
    return null;
  }
}

function section(item: Obj, keys: string[]): { present: boolean; items: unknown[] } {
  for (const k of keys) if (Array.isArray(item[k])) return { present: true, items: (item[k] as unknown[]).slice(0, MAX_PER_SECTION) };
  return { present: false, items: [] };
}

/**
 * Normalizes one provider record for the requested profile. Throws
 * ProfileMismatchError when the provider returned a different person.
 */
export function normalizeLinkedInProfile(raw: unknown, requestedUrl: string): NormalizationResult {
  if (!isObj(raw)) throw new MalformedProviderOutputError("Provider returned no profile object.");
  const item = isObj(raw.profile) ? { ...raw, ...raw.profile } : raw;

  const requestedId = linkedinIdentifier(requestedUrl);
  const returnedId = text(item.publicIdentifier, 200)?.toLowerCase() ?? linkedinIdentifier(text(item.linkedinUrl, 500) ?? text(item.url, 500) ?? text(item.profileUrl, 500));
  if (requestedId && returnedId && requestedId !== returnedId) throw new ProfileMismatchError();

  const profileUrl = cleanUrl(item.linkedinUrl) ?? cleanUrl(item.profileUrl) ?? requestedUrl;
  const profile: NormalizedProfile = {
    profileUrl,
    publicIdentifier: returnedId ?? requestedId,
    fullName: text(item.fullName, 200) ?? ([text(item.firstName, 100), text(item.lastName, 100)].filter(Boolean).join(" ") || null),
    headline: text(item.headline, 300),
    about: text(item.about ?? item.summary, 5000),
    location: text(item.location ?? item.addressWithoutCountry, 200),
  };

  const records: NormalizedRecord[] = [];
  const rejected: Partial<Record<LinkedInRecordKind, number>> = {};
  const sectionsReturned = new Set<LinkedInRecordKind>();
  const seen = new Set<string>();
  const add = (kind: LinkedInRecordKind, key: string, data: Obj, providerRecordId?: string | null) => {
    const k = `${kind}::${key}`;
    if (seen.has(k)) return; // the same record twice in one response
    seen.add(k);
    records.push({ kind, key, data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "")), ...(providerRecordId ? { providerRecordId } : {}) });
  };
  const reject = (kind: LinkedInRecordKind) => { rejected[kind] = (rejected[kind] ?? 0) + 1; };
  const each = (kind: LinkedInRecordKind, keys: string[], fn: (e: unknown) => boolean) => {
    const s = section(item, keys);
    if (s.present) sectionsReturned.add(kind);
    for (const e of s.items) if (!fn(e)) reject(kind);
  };

  each("experience", ["experiences", "experience", "positions"], (e) => {
    if (!isObj(e)) return false;
    const title = first(e, ["title", "role", "position"], 200);
    const company = first(e, ["company", "companyName"], 200);
    if (!title || !company) return false;
    const start = parsePartialDate(e.startDate ?? e.from ?? e.starts_at);
    const end = parsePartialDate(e.endDate ?? e.to ?? e.ends_at);
    const current = e.jobStillWorking === true || e.isCurrent === true || isPresent(e.endDate ?? e.to) || (!end && e.jobStillWorking !== false && isPresent(e.duration));
    add("experience", slug(company, title, fmt(start)), {
      title, company, employmentType: first(e, ["employmentType", "type"], 80), startDate: fmt(start), endDate: current ? null : fmt(end),
      current: current || undefined, location: first(e, ["location"], 200), description: first(e, ["description"], 4000),
      companyUrl: cleanUrl(e.companyLinkedinUrl),
    });
    return true;
  });

  each("education", ["educations", "education", "schools"], (e) => {
    if (!isObj(e)) return false;
    const institution = first(e, ["school", "schoolName", "institution"], 200);
    if (!institution) return false;
    const degree = first(e, ["degree", "degreeName"], 200);
    const fieldOfStudy = first(e, ["fieldOfStudy", "field"], 200);
    const start = parsePartialDate(e.startYear ?? e.startDate);
    const end = parsePartialDate(e.endYear ?? e.endDate ?? e.graduationDate);
    add("education", slug(institution, degree, fieldOfStudy), {
      institution, degree, fieldOfStudy, startDate: fmt(start), endDate: fmt(end), description: first(e, ["description", "activities"], 2000),
    });
    return true;
  });

  each("skill", ["skills"], (e) => {
    const name = typeof e === "string" ? text(e, 100) : isObj(e) ? first(e, ["name", "title", "skill"], 100) : null;
    if (!name) return false;
    add("skill", slug(name), { name });
    return true;
  });

  each("language", ["languages"], (e) => {
    const name = typeof e === "string" ? text(e, 80) : isObj(e) ? first(e, ["name", "language", "title"], 80) : null;
    if (!name) return false;
    // Only a proficiency the source states.
    add("language", slug(name), { name, proficiency: isObj(e) ? first(e, ["proficiency", "level"], 80) : null });
    return true;
  });

  const credential = (kind: "certification" | "course", keys: string[]) =>
    each(kind, keys, (e) => {
      const name = typeof e === "string" ? text(e, 200) : isObj(e) ? first(e, ["name", "title"], 200) : null;
      if (!name) return false;
      const o = isObj(e) ? e : {};
      const issuer = first(o, ["issuer", "authority", "issuingOrganization", "organization", "company"], 200);
      add(kind, slug(name, issuer), {
        name, issuer, issueDate: fmt(parsePartialDate(o.issueDate ?? o.issuedOn ?? o.date ?? o.startDate)),
        expiryDate: fmt(parsePartialDate(o.expiryDate ?? o.expirationDate ?? o.endDate)),
        credentialId: first(o, ["credentialId", "licenseNumber"], 120), credentialUrl: cleanUrl(o.credentialUrl ?? o.url),
        number: kind === "course" ? first(o, ["number", "code"], 60) : null,
      });
      return true;
    });
  credential("certification", ["certifications", "licenses", "licensesAndCertifications"]);
  credential("course", ["courses"]);

  each("project", ["projects"], (e) => {
    const o = isObj(e) ? e : {};
    const title = typeof e === "string" ? text(e, 200) : first(o, ["title", "name"], 200);
    if (!title) return false;
    add("project", slug(title), {
      title, description: first(o, ["description"], 4000), organization: first(o, ["associatedWith", "organization", "company"], 200),
      url: cleanUrl(o.url ?? o.link), startDate: fmt(parsePartialDate(o.startDate)), endDate: fmt(parsePartialDate(o.endDate)),
    });
    return true;
  });

  const publication = (e: unknown, fromArticles: boolean) => {
    const o = isObj(e) ? e : {};
    const title = typeof e === "string" ? text(e, 300) : first(o, ["title", "name", "headline"], 300);
    if (!title) return false;
    const url = cleanUrl(o.url ?? o.link);
    add("publication", slug(title), {
      title, publisher: fromArticles ? "LinkedIn article" : first(o, ["publisher", "publication", "source"], 200),
      date: fmt(parsePartialDate(o.date ?? o.publishedOn ?? o.datePublished)), url, description: first(o, ["description"], 2000),
    });
    return true;
  };
  each("publication", ["publications"], (e) => publication(e, false));
  // The student's own long-form articles are publications; their short posts ("updates") are not kept.
  const articles = section(item, ["articles"]);
  if (articles.present) sectionsReturned.add("publication");
  for (const a of articles.items) if (!publication(a, true)) reject("publication");

  each("volunteering", ["volunteerExperiences", "volunteering", "volunteer"], (e) => {
    if (!isObj(e)) return false;
    const organization = first(e, ["organization", "company", "companyName"], 200);
    const role = first(e, ["role", "title"], 200);
    if (!organization && !role) return false;
    const start = parsePartialDate(e.startDate);
    add("volunteering", slug(organization, role, fmt(start)), {
      organization, role, cause: first(e, ["cause"], 120), startDate: fmt(start), endDate: fmt(parsePartialDate(e.endDate)), description: first(e, ["description"], 2000),
    });
    return true;
  });

  each("honor", ["honorsAwards", "honors", "awards"], (e) => {
    const o = isObj(e) ? e : {};
    const title = typeof e === "string" ? text(e, 300) : first(o, ["title", "name"], 300);
    if (!title) return false;
    const issuer = first(o, ["issuer", "issuedBy", "organization"], 200);
    add("honor", slug(title, issuer), { title, issuer, date: fmt(parsePartialDate(o.date ?? o.issueDate)), description: first(o, ["description"], 2000) });
    return true;
  });

  each("link", ["websites", "links"], (e) => {
    const url = cleanUrl(typeof e === "string" ? e : isObj(e) ? e.url ?? e.link : null);
    if (!url) return false;
    add("link", slug(url), { url, label: isObj(e) ? first(e, ["label", "type", "title"], 80) : null });
    return true;
  });

  return { profile, records, sectionsReturned: [...sectionsReturned], rejected };
}

export class ProfileMismatchError extends Error {
  constructor() { super("The provider returned a different LinkedIn profile than the one requested."); }
}
export class MalformedProviderOutputError extends Error {}
