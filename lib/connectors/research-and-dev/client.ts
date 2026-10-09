/**
 * AI TATHASTU — V3.2 RESEARCH, ML & TECHNICAL WRITING CONNECTORS
 *
 * Covers:
 * - Hugging Face (Public models, spaces, downloads, task tags)
 * - ORCID (Public academic works, journal articles, DOIs)
 * - Kaggle (Profile linking & student-confirmed datasets/notebooks)
 * - DEV Community (Public technical articles & tutorial publications)
 * - Stack Overflow (Public developer reputation & top tags)
 *
 * Rules:
 * - Uses only officially permitted public REST APIs
 * - Ingests public artifacts with strict ownership provenance
 * - A public model or notebook is evidence of a published artifact, NOT proof of sole authorship
 * - Handles rate limits, timeouts, and private profiles defensively
 */

export interface HuggingFaceArtifacts {
  username: string;
  profileUrl: string;
  models: Array<{
    id: string;
    pipelineTag?: string;
    likes: number;
    downloads: number;
    tags: string[];
  }>;
  spaces: Array<{
    id: string;
    sdk?: string;
    likes: number;
  }>;
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
}

export interface OrcidPublication {
  title: string;
  doi?: string;
  publicationYear?: string;
  type?: string;
  journalTitle?: string;
  url?: string;
  sourceLocation: string;
}

export interface OrcidRecord {
  orcid: string;
  profileUrl: string;
  works: OrcidPublication[];
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
}

export interface DevToArticles {
  username: string;
  profileUrl: string;
  articles: Array<{
    title: string;
    url: string;
    publishedAt: string;
    tags: string[];
    positiveReactionsCount: number;
  }>;
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
}

export interface StackOverflowProfile {
  userId: string;
  profileUrl: string;
  displayName?: string;
  reputation: number;
  badgeCounts?: { bronze: number; silver: number; gold: number };
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
}

/**
 * Normalizes a Hugging Face username or URL.
 */
export function normalizeHuggingFaceUsername(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?huggingface\.co\//i, "")
    .replace(/\/$/, "")
    .replace(/^@/, "");
}

/**
 * Fetches public Hugging Face models and spaces.
 */
export async function fetchHuggingFaceArtifacts(rawInput: string): Promise<HuggingFaceArtifacts> {
  const username = normalizeHuggingFaceUsername(rawInput);
  const profileUrl = `https://huggingface.co/${username}`;
  const now = new Date().toISOString();

  if (!username) {
    return { username: "", profileUrl: "", models: [], spaces: [], status: "UNAVAILABLE", retrievedAt: now };
  }

  try {
    const [modelsRes, spacesRes] = await Promise.all([
      fetch(`https://huggingface.co/api/models?author=${encodeURIComponent(username)}&limit=15`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-HFAuditor/1.0" },
        signal: AbortSignal.timeout(6000),
      }),
      fetch(`https://huggingface.co/api/spaces?author=${encodeURIComponent(username)}&limit=15`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-HFAuditor/1.0" },
        signal: AbortSignal.timeout(6000),
      }),
    ]);

    const modelsData = modelsRes.ok ? await modelsRes.json() : [];
    const spacesData = spacesRes.ok ? await spacesRes.json() : [];

    const models = Array.isArray(modelsData)
      ? modelsData.map((m: any) => ({
          id: String(m.id || m.modelId),
          pipelineTag: m.pipeline_tag ? String(m.pipeline_tag) : undefined,
          likes: Number(m.likes) || 0,
          downloads: Number(m.downloads) || 0,
          tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
        }))
      : [];

    const spaces = Array.isArray(spacesData)
      ? spacesData.map((s: any) => ({
          id: String(s.id),
          sdk: s.sdk ? String(s.sdk) : undefined,
          likes: Number(s.likes) || 0,
        }))
      : [];

    return {
      username,
      profileUrl,
      models,
      spaces,
      status: models.length > 0 || spaces.length > 0 ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY",
      retrievedAt: now,
      notes: `Discovered ${models.length} models and ${spaces.length} spaces on Hugging Face.`,
    };
  } catch (err: unknown) {
    return {
      username,
      profileUrl,
      models: [],
      spaces: [],
      status: "PROFILE_LINK_ONLY",
      retrievedAt: now,
      notes: "Hugging Face profile linked. Network timeout contacting open registry.",
    };
  }
}

/**
 * Validates ORCID 16-character identifier (e.g., 0000-0002-1825-0097).
 */
export function normalizeOrcidId(input: string): string {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?orcid\.org\//i, "")
    .replace(/\/$/, "");
  return cleaned;
}

/**
 * Queries public ORCID member record for academic works and DOIs.
 */
export async function fetchOrcidRecord(rawInput: string): Promise<OrcidRecord> {
  const orcid = normalizeOrcidId(rawInput);
  const profileUrl = `https://orcid.org/${orcid}`;
  const now = new Date().toISOString();

  const orcidRegex = /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/;
  if (!orcidRegex.test(orcid)) {
    return {
      orcid: orcid || "invalid",
      profileUrl,
      works: [],
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "Invalid ORCID format. Expected 16-character ID like 0000-0002-1825-0097.",
    };
  }

  try {
    const res = await fetch(`https://pub.orcid.org/v3.0/${encodeURIComponent(orcid)}/works`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AI-Tathastu-OrcidAuditor/1.0",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return {
        orcid,
        profileUrl,
        works: [],
        status: "PROFILE_LINK_ONLY",
        retrievedAt: now,
        notes: `ORCID registry returned HTTP status ${res.status}. Profile URL preserved.`,
      };
    }

    const data = await res.json();
    const group = data?.group || [];
    const works: OrcidPublication[] = [];

    for (let i = 0; i < group.length && i < 20; i++) {
      const summary = group[i]?.["work-summary"]?.[0];
      if (!summary) continue;

      const title = summary.title?.title?.value || "Untitled Work";
      const year = summary["publication-date"]?.year?.value || undefined;
      const type = summary.type || undefined;
      const journalTitle = summary["journal-title"]?.value || undefined;
      const url = summary.url?.value || undefined;

      // Extract DOI if available
      let doi: string | undefined = undefined;
      const externalIds = summary["external-ids"]?.["external-id"] || [];
      for (const ext of externalIds) {
        if (ext["external-id-type"] === "doi") {
          doi = ext["external-id-value"];
          break;
        }
      }

      works.push({
        title,
        doi,
        publicationYear: year,
        type,
        journalTitle,
        url,
        sourceLocation: `orcid.org/${orcid}:work[${i}]`,
      });
    }

    return {
      orcid,
      profileUrl,
      works,
      status: works.length > 0 ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY",
      retrievedAt: now,
      notes: `Ingested ${works.length} peer-reviewed works and DOIs from public ORCID record.`,
    };
  } catch {
    return {
      orcid,
      profileUrl,
      works: [],
      status: "PROFILE_LINK_ONLY",
      retrievedAt: now,
      notes: "ORCID profile linked. Registry query timed out.",
    };
  }
}

/**
 * Fetches published articles from DEV.to public API.
 */
export async function fetchDevToArticles(rawInput: string): Promise<DevToArticles> {
  const username = rawInput.trim().replace(/^https?:\/\/(www\.)?dev\.to\//i, "").replace(/\/$/, "");
  const profileUrl = `https://dev.to/${username}`;
  const now = new Date().toISOString();

  if (!username) {
    return { username: "", profileUrl: "", articles: [], status: "UNAVAILABLE", retrievedAt: now };
  }

  try {
    const res = await fetch(`https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=10`, {
      headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-DevToAuditor/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const articles = Array.isArray(data)
        ? data.map((a: any) => ({
            title: String(a.title || "Article"),
            url: String(a.url || ""),
            publishedAt: String(a.published_at || a.created_at || now),
            tags: Array.isArray(a.tag_list) ? a.tag_list.map(String) : [],
            positiveReactionsCount: Number(a.positive_reactions_count) || 0,
          }))
        : [];

      return {
        username,
        profileUrl,
        articles,
        status: articles.length > 0 ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY",
        retrievedAt: now,
      };
    }
  } catch {
    // Network fallback
  }

  return {
    username,
    profileUrl,
    articles: [],
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
  };
}

/**
 * Queries public Stack Overflow reputation and badges.
 */
export async function fetchStackOverflowProfile(rawInput: string): Promise<StackOverflowProfile> {
  const cleaned = rawInput.trim();
  const match = cleaned.match(/stackoverflow\.com\/users\/(\d+)/i) || cleaned.match(/^(\d+)$/);
  const userId = match ? match[1] : cleaned;
  const profileUrl = `https://stackoverflow.com/users/${userId}`;
  const now = new Date().toISOString();

  if (!/^\d+$/.test(userId)) {
    return {
      userId,
      profileUrl,
      reputation: 0,
      status: "PROFILE_LINK_ONLY",
      retrievedAt: now,
    };
  }

  try {
    const res = await fetch(`https://api.stackexchange.com/2.3/users/${userId}?site=stackoverflow`, {
      headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-SOAuditor/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const user = data.items?.[0];
      if (user) {
        return {
          userId,
          profileUrl,
          displayName: user.display_name,
          reputation: Number(user.reputation) || 0,
          badgeCounts: user.badge_counts,
          status: "LIVE_VERIFIED",
          retrievedAt: now,
        };
      }
    }
  } catch {
    // Fallback
  }

  return {
    userId,
    profileUrl,
    reputation: 0,
    status: "PROFILE_LINK_ONLY",
    retrievedAt: now,
  };
}
