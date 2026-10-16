/**
 * Research publications by VERIFIED identifier only (Task 1.6.2).
 * There is no name, email or institution lookup anywhere in this module, and
 * no code path that derives an identifier from anything but user input.
 *
 *  - ORCID iD: works come from the researcher's own ORCID record
 *    (pub.orcid.org), which they curate. OpenAlex is consulted only to enrich a
 *    work by its exact DOI (citations, venue). OpenAlex's own author.orcid
 *    filter is NOT used: on 2026-10-15 it returned 1,620 works for ORCID's
 *    fictional test identity 0000-0002-1825-0097, whose ORCID record has 6.
 *  - Semantic Scholar author ID: /graph/v1/author/{id}/papers. The student
 *    supplies the ID of their own S2 author page.
 */
import { connectorFetch } from "@/lib/connectors/rate-limiter";

export type ScholarIdentifier = { kind: "orcid"; value: string } | { kind: "semantic_scholar"; value: string };

export type Publication = {
  title: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  citationCount: number | null;
  coAuthors: string[];
  sourceId: string; // ORCID put-code or S2 paperId
};

export class ScholarFetchError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = true) {
    super(message);
  }
}

/** ORCID iD with a valid ISO 7064 MOD 11-2 check digit, normalised to 0000-0000-0000-000X. */
export function parseOrcid(input: string): string | null {
  const m = input.trim().replace(/^https?:\/\/(www\.)?orcid\.org\//i, "").toUpperCase().match(/^(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])$/);
  if (!m) return null;
  const digits = m.slice(1).join("");
  let total = 0;
  for (const c of digits.slice(0, 15)) total = (total + Number(c)) * 2;
  const check = (12 - (total % 11)) % 11;
  const expected = check === 10 ? "X" : String(check);
  return digits[15] === expected ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : null;
}

export function parseSemanticScholarAuthorId(input: string): string | null {
  const id = input.trim().replace(/^https?:\/\/(www\.)?semanticscholar\.org\/author\/[^/]*\//i, "").split(/[/?#]/)[0];
  return /^\d{3,12}$/.test(id) ? id : null;
}

const cleanDoi = (d: string | null | undefined) => (d ? d.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() : null);

async function json(provider: "orcid" | "openalex" | "semantic_scholar", url: string, correlationId?: string) {
  const res = await connectorFetch(provider, url, { correlationId, headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-ResearchLedger/1.0 (mailto:support@aitathastu.app)" } });
  if (res.status === 404) throw new ScholarFetchError("That research profile ID was not found.", 404, false);
  if (!res.ok) throw new ScholarFetchError(`${provider} HTTP ${res.status}`, res.status, res.status >= 500 || res.status === 429);
  try { return await res.json(); } catch { throw new ScholarFetchError(`${provider} returned malformed JSON.`); }
}

export async function fetchPublications(id: ScholarIdentifier, opts: { correlationId?: string; max?: number } = {}): Promise<Publication[]> {
  const max = opts.max ?? 50;
  if (id.kind === "semantic_scholar") {
    const authorId = parseSemanticScholarAuthorId(id.value);
    if (!authorId) throw new ScholarFetchError("Invalid Semantic Scholar author ID.", 400, false);
    const body = await json("semantic_scholar", `https://api.semanticscholar.org/graph/v1/author/${authorId}/papers?fields=title,year,venue,citationCount,externalIds,authors,url&limit=${max}`, opts.correlationId);
    if (!Array.isArray(body?.data)) throw new ScholarFetchError("Semantic Scholar returned an unexpected shape.");
    return body.data.filter((p: { title?: string }) => p?.title).map((p: Record<string, unknown>) => ({
      title: String(p.title), year: typeof p.year === "number" ? p.year : null, venue: (p.venue as string) || null,
      doi: cleanDoi((p.externalIds as { DOI?: string } | undefined)?.DOI), url: (p.url as string) || null,
      citationCount: typeof p.citationCount === "number" ? p.citationCount : null,
      coAuthors: ((p.authors as { name?: string }[]) || []).map((a) => a.name || "").filter(Boolean).slice(0, 20),
      sourceId: `s2:${p.paperId}`,
    }));
  }

  const orcid = parseOrcid(id.value);
  if (!orcid) throw new ScholarFetchError("Invalid ORCID iD (checksum failed).", 400, false);
  const body = await json("orcid", `https://pub.orcid.org/v3.0/${orcid}/works`, opts.correlationId);
  const groups: unknown[] = Array.isArray(body?.group) ? body.group : [];
  const works: Publication[] = groups.slice(0, max).map((g) => {
    const s = ((g as { "work-summary"?: Record<string, unknown>[] })["work-summary"] || [])[0] || {};
    const ext = ((s["external-ids"] as { "external-id"?: { "external-id-type": string; "external-id-value": string }[] } | undefined)?.["external-id"]) || [];
    const yearRaw = (s["publication-date"] as { year?: { value?: string } } | undefined)?.year?.value;
    return {
      title: String(((s.title as { title?: { value?: string } } | undefined)?.title?.value) || ""),
      year: yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null,
      venue: ((s["journal-title"] as { value?: string } | undefined)?.value) || null,
      doi: cleanDoi(ext.find((e) => e["external-id-type"] === "doi")?.["external-id-value"]),
      url: null, citationCount: null, coAuthors: [],
      sourceId: `orcid:${s["put-code"] ?? ""}`,
    };
  }).filter((w) => w.title);

  // Enrich by exact DOI only; a failure here never drops the ORCID works.
  await Promise.all(works.filter((w) => w.doi).slice(0, 25).map(async (w) => {
    try {
      const oa = await json("openalex", `https://api.openalex.org/works/doi:${encodeURIComponent(w.doi!)}?select=doi,cited_by_count,primary_location,authorships`, opts.correlationId);
      if (cleanDoi(oa?.doi) !== w.doi) return; // must be the same work
      w.citationCount = typeof oa.cited_by_count === "number" ? oa.cited_by_count : null;
      w.venue ||= oa.primary_location?.source?.display_name || null;
      w.coAuthors = (oa.authorships || []).map((a: { author?: { display_name?: string } }) => a.author?.display_name || "").filter(Boolean).slice(0, 20);
    } catch {
      // enrichment is optional
    }
  }));
  for (const w of works) w.url = w.doi ? `https://doi.org/${w.doi}` : null;
  return works;
}
