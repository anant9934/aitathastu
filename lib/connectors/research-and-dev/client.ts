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

import { isValidOrcidChecksum } from "@/lib/services/digital-footprint-registry";

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
  datasets: Array<{
    id: string;
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
    detectedTopics: string[];
    positiveReactionsCount: number;
  }>;
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
}

export interface StackOverflowProfile {
  userId: string;
  profileUrl: string;
  displayName?: string;
  reputation: number;
  badgeCounts?: { bronze: number; silver: number; gold: number };
  topTags?: Array<{ tagName: string; answerCount: number; questionCount: number }>;
  status: "LIVE_VERIFIED" | "PROFILE_LINK_ONLY" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
}

export interface KaggleProfile {
  username: string;
  profileUrl: string;
  displayName?: string;
  tier?: string;
  datasetsCount?: number;
  notebooksCount?: number;
  competitionsCount?: number;
  studentReportedArtifacts?: Array<{
    type: "dataset" | "notebook" | "competition" | "model";
    title: string;
    url?: string;
    description?: string;
  }>;
  status: "MANUAL_PROFILE_REFERENCE" | "LIVE_VERIFIED" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
}

export interface GoogleScholarProfile {
  scholarId: string;
  profileUrl: string;
  status: "MANUAL_PROFILE_REFERENCE" | "UNAVAILABLE";
  retrievedAt: string;
  notes?: string;
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
 * Fetches public Hugging Face models, datasets and spaces via official Hub API.
 */
export async function fetchHuggingFaceArtifacts(rawInput: string): Promise<HuggingFaceArtifacts> {
  const username = normalizeHuggingFaceUsername(rawInput);
  const profileUrl = `https://huggingface.co/${username}`;
  const now = new Date().toISOString();

  if (!username) {
    return { username: "", profileUrl: "", models: [], datasets: [], spaces: [], status: "UNAVAILABLE", retrievedAt: now };
  }

  try {
    const [modelsRes, datasetsRes, spacesRes] = await Promise.all([
      fetch(`https://huggingface.co/api/models?author=${encodeURIComponent(username)}&limit=15`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-HFAuditor/1.0" },
        signal: AbortSignal.timeout(6000),
      }),
      fetch(`https://huggingface.co/api/datasets?author=${encodeURIComponent(username)}&limit=15`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-HFAuditor/1.0" },
        signal: AbortSignal.timeout(6000),
      }),
      fetch(`https://huggingface.co/api/spaces?author=${encodeURIComponent(username)}&limit=15`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-HFAuditor/1.0" },
        signal: AbortSignal.timeout(6000),
      }),
    ]);

    const modelsData = modelsRes.ok ? await modelsRes.json() : [];
    const datasetsData = datasetsRes.ok ? await datasetsRes.json() : [];
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

    const datasets = Array.isArray(datasetsData)
      ? datasetsData.map((d: any) => ({
          id: String(d.id),
          likes: Number(d.likes) || 0,
          downloads: Number(d.downloads) || 0,
          tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
        }))
      : [];

    const spaces = Array.isArray(spacesData)
      ? spacesData.map((s: any) => ({
          id: String(s.id),
          sdk: s.sdk ? String(s.sdk) : undefined,
          likes: Number(s.likes) || 0,
        }))
      : [];

    const hasArtifacts = models.length > 0 || datasets.length > 0 || spaces.length > 0;
    return {
      username,
      profileUrl,
      models,
      datasets,
      spaces,
      status: hasArtifacts ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY",
      retrievedAt: now,
      notes: `Discovered ${models.length} models, ${datasets.length} datasets, and ${spaces.length} spaces on Hugging Face Hub.`,
    };
  } catch {
    return {
      username,
      profileUrl,
      models: [],
      datasets: [],
      spaces: [],
      status: "PROFILE_LINK_ONLY",
      retrievedAt: now,
      notes: "Hugging Face profile linked. Open Hub registry query timed out.",
    };
  }
}

/**
 * Normalizes ORCID 16-character identifier (e.g., 0000-0002-1825-0097).
 */
export function normalizeOrcidId(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?orcid\.org\//i, "")
    .replace(/\/$/, "");
}

/**
 * Queries public ORCID member record for academic works and DOIs,
 * with ISO 7064 Mod 11,2 checksum validation and DOI deduplication.
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

  // Validate Mod 11,2 checksum
  if (!isValidOrcidChecksum(orcid)) {
    return {
      orcid,
      profileUrl,
      works: [],
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "ORCID check digit failed ISO 7064 Mod 11,2 verification.",
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
        notes: `ORCID public registry returned HTTP status ${res.status}. Profile URL preserved.`,
      };
    }

    const data = await res.json();
    const group = data?.group || [];
    const works: OrcidPublication[] = [];
    const seenDois = new Set<string>();
    const seenTitles = new Set<string>();

    for (let i = 0; i < group.length && i < 30; i++) {
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
          doi = ext["external-id-value"]?.trim();
          break;
        }
      }

      // Deduplicate by DOI or lowercase normalized title
      const normalizedTitle = title.toLowerCase().trim();
      if (doi && seenDois.has(doi.toLowerCase())) continue;
      if (!doi && seenTitles.has(normalizedTitle)) continue;

      if (doi) seenDois.add(doi.toLowerCase());
      seenTitles.add(normalizedTitle);

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
 * Classifies technical writing topics based on article titles and tags.
 */
export function classifyDevToTopics(title: string, tags: string[]): string[] {
  const combined = `${title} ${tags.join(" ")}`.toLowerCase();
  const topics: string[] = [];

  const TOPIC_RULES: Array<{ topic: string; pattern: RegExp }> = [
    { topic: "Generative AI", pattern: /\b(generative ai|genai|llm|llms|gpt|prompt engineering|rag|langchain|llamaindex|claude|gemini)\b/i },
    { topic: "Deep Learning", pattern: /\b(deep learning|neural network|pytorch|tensorflow|keras|cnn|rnn|transformer)\b/i },
    { topic: "Machine Learning", pattern: /\b(machine learning|ml|scikit-learn|supervised|unsupervised|clustering|regression)\b/i },
    { topic: "Computer Vision", pattern: /\b(computer vision|opencv|yolo|object detection|image classification|segmentation)\b/i },
    { topic: "NLP", pattern: /\b(nlp|natural language processing|tokenization|embeddings|sentiment analysis)\b/i },
    { topic: "MLOps", pattern: /\b(mlops|model serving|mlflow|dvc|kubeflow|triton|model monitoring)\b/i },
    { topic: "System Design", pattern: /\b(system design|microservices|scalability|distributed systems|architecture|kafka|redis)\b/i },
    { topic: "Python", pattern: /\b(python|fastapi|flask|django|numpy|pandas)\b/i },
    { topic: "Web Development", pattern: /\b(next\.?js|react|typescript|javascript|frontend|webdev|tailwind)\b/i },
  ];

  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(combined)) {
      topics.push(rule.topic);
    }
  }

  return topics.length > 0 ? topics : ["Technical Writing"];
}

/**
 * Fetches published articles from DEV.to public API and extracts candidate topics.
 */
export async function fetchDevToArticles(rawInput: string): Promise<DevToArticles> {
  const username = rawInput.trim().replace(/^https?:\/\/(www\.)?dev\.to\//i, "").replace(/\/$/, "").replace(/^@/, "");
  const profileUrl = `https://dev.to/${username}`;
  const now = new Date().toISOString();

  if (!username) {
    return { username: "", profileUrl: "", articles: [], status: "UNAVAILABLE", retrievedAt: now };
  }

  try {
    const res = await fetch(`https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=15`, {
      headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-DevToAuditor/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const articles = Array.isArray(data)
        ? data.map((a: any) => {
            const title = String(a.title || "Article");
            const tags = Array.isArray(a.tag_list) ? a.tag_list.map(String) : [];
            const detectedTopics = classifyDevToTopics(title, tags);
            return {
              title,
              url: String(a.url || ""),
              publishedAt: String(a.published_at || a.created_at || now),
              tags,
              detectedTopics,
              positiveReactionsCount: Number(a.positive_reactions_count) || 0,
            };
          })
        : [];

      return {
        username,
        profileUrl,
        articles,
        status: articles.length > 0 ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY",
        retrievedAt: now,
        notes: `Discovered ${articles.length} published technical articles on DEV.to.`,
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
    notes: "DEV.to profile linked. Network timeout connecting to public articles endpoint.",
  };
}

/**
 * Queries public Stack Overflow reputation, badges and top tags.
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
      notes: "Invalid Stack Overflow user ID. Expected numeric ID like 1234567.",
    };
  }

  try {
    const [userRes, tagsRes] = await Promise.all([
      fetch(`https://api.stackexchange.com/2.3/users/${userId}?site=stackoverflow`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-SOAuditor/1.0" },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`https://api.stackexchange.com/2.3/users/${userId}/top-tags?site=stackoverflow`, {
        headers: { Accept: "application/json", "User-Agent": "AI-Tathastu-SOAuditor/1.0" },
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ]);

    if (userRes.ok) {
      const data = await userRes.json();
      const user = data.items?.[0];
      if (user) {
        let topTags: Array<{ tagName: string; answerCount: number; questionCount: number }> | undefined = undefined;
        if (tagsRes && tagsRes.ok) {
          const tagsData = await tagsRes.json();
          if (Array.isArray(tagsData.items)) {
            topTags = tagsData.items.slice(0, 10).map((t: any) => ({
              tagName: String(t.tag_name),
              answerCount: Number(t.answer_count) || 0,
              questionCount: Number(t.question_count) || 0,
            }));
          }
        }

        return {
          userId,
          profileUrl,
          displayName: user.display_name,
          reputation: Number(user.reputation) || 0,
          badgeCounts: user.badge_counts,
          topTags,
          status: "LIVE_VERIFIED",
          retrievedAt: now,
          notes: `Stack Overflow profile verified with ${user.reputation} reputation score.`,
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
    notes: "Stack Overflow profile linked. Public API query timed out or quota exceeded.",
  };
}

/**
 * Normalizes Kaggle username or profile URL.
 */
export function normalizeKaggleUsername(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?kaggle\.com\//i, "")
    .replace(/\/$/, "")
    .replace(/^@/, "");
}

/**
 * Validates and normalizes Kaggle profile reference, supporting student-confirmed
 * datasets, notebooks, and competition records.
 */
export function fetchKaggleProfile(
  rawInput: string,
  manualArtifacts?: Array<{ type: "dataset" | "notebook" | "competition" | "model"; title: string; url?: string; description?: string }>
): KaggleProfile {
  const username = normalizeKaggleUsername(rawInput);
  const profileUrl = `https://www.kaggle.com/${username}`;
  const now = new Date().toISOString();

  if (!username || !/^[a-zA-Z0-9_]{3,40}$/.test(username)) {
    return {
      username: username || "unknown",
      profileUrl,
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "Invalid Kaggle username format.",
    };
  }

  const artifacts = Array.isArray(manualArtifacts) ? manualArtifacts : [];
  const datasetsCount = artifacts.filter((a) => a.type === "dataset").length;
  const notebooksCount = artifacts.filter((a) => a.type === "notebook").length;
  const competitionsCount = artifacts.filter((a) => a.type === "competition").length;

  return {
    username,
    profileUrl,
    displayName: username,
    datasetsCount,
    notebooksCount,
    competitionsCount,
    studentReportedArtifacts: artifacts,
    status: "MANUAL_PROFILE_REFERENCE",
    retrievedAt: now,
    notes: "Kaggle profile reference preserved. Automatic scraping is disabled per provider terms. Artifacts recorded upon student confirmation.",
  };
}

/**
 * Validates Google Scholar profile link and extracts scholar user ID.
 */
export function validateGoogleScholarProfile(rawInput: string): GoogleScholarProfile {
  const trimmed = rawInput.trim();
  const now = new Date().toISOString();

  // Try extracting ?user=... parameter
  let scholarId = "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      if (url.hostname.includes("scholar.google.")) {
        scholarId = url.searchParams.get("user") || "";
      }
    } else if (/^[a-zA-Z0-9_-]{10,20}$/.test(trimmed)) {
      scholarId = trimmed;
    }
  } catch {
    // URL parsing failed
  }

  if (!scholarId) {
    return {
      scholarId: "invalid",
      profileUrl: trimmed,
      status: "UNAVAILABLE",
      retrievedAt: now,
      notes: "Invalid Google Scholar URL. Expected link in format: https://scholar.google.com/citations?user=XXXXXXXXXXXX",
    };
  }

  const canonicalUrl = `https://scholar.google.com/citations?user=${scholarId}`;
  return {
    scholarId,
    profileUrl: canonicalUrl,
    status: "MANUAL_PROFILE_REFERENCE",
    retrievedAt: now,
    notes: "Google Scholar profile reference preserved. In accordance with platform terms, direct automated profile scraping is disabled. Publication records are resolved via Crossref, ORCID and DOIs.",
  };
}

