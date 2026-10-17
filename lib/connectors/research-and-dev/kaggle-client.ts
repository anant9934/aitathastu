/**
 * Kaggle public artifact extractor (Task 1.6.3).
 *
 * Verified 2026-10-15 with live anonymous calls:
 *  - GET /api/v1/datasets/list?user=<u> works anonymously and returns that
 *    user's public datasets (ownerRef = <u>). Rows are still filtered on
 *    ownerRef here: the special account "kaggle" returned other people's
 *    datasets, and nothing may be attributed to a student that isn't theirs.
 *  - GET /api/v1/kernels/list needs auth (401 anonymously): notebooks are read
 *    only with the student's own Kaggle API key (Basic auth, encrypted at
 *    rest with EXTERNAL_TOKEN_ENCRYPTION_KEY by the caller).
 *  - Tier/rank and competition medals have no public API; they are NOT
 *    scraped from HTML and never guessed.
 */
import { connectorFetch } from "@/lib/connectors/rate-limiter";

export type KaggleArtifact = {
  kind: "dataset" | "notebook";
  ref: string;
  title: string;
  url: string;
  votes: number | null;
  downloads: number | null;
  lastUpdated: string | null;
};

export type KaggleProfileData = {
  username: string;
  profileUrl: string;
  datasets: KaggleArtifact[];
  notebooks: KaggleArtifact[];
  notebooksAvailable: boolean;
};

export class KaggleFetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function getAllPlatformKaggleCredentials(): Array<{ username: string; key: string }> {
  const indexed: Array<{ username: string; key: string }> = [];
  for (let i = 1; i <= 3; i++) {
    const u = process.env[`KAGGLE_USERNAME_${i}`];
    const k = process.env[`KAGGLE_KEY_${i}`];
    if (u && k && u.trim() && k.trim()) {
      indexed.push({ username: u.trim(), key: k.trim() });
    }
  }

  // When indexed credentials exist, prioritize them to prevent retired aliases from remaining active
  const candidates = indexed.length > 0 ? indexed : [];
  if (candidates.length === 0 && process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY) {
    const u = process.env.KAGGLE_USERNAME.trim();
    const k = process.env.KAGGLE_KEY.trim();
    if (u && k) candidates.push({ username: u, key: k });
  }

  // Deduplicate pairs by username:key
  const seen = new Set<string>();
  const deduped: Array<{ username: string; key: string }> = [];
  for (const pair of candidates) {
    const sig = `${pair.username.toLowerCase()}:${pair.key}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      deduped.push(pair);
    }
  }
  return deduped;
}

export function getKaggleCapacity(): { configured: boolean; capacity: number } {
  const creds = getAllPlatformKaggleCredentials();
  return { configured: creds.length > 0, capacity: creds.length };
}

let platformKaggleIndex = 0;
export function getPlatformKaggleCredential(): { username: string; key: string } | null {
  const pairs = getAllPlatformKaggleCredentials();
  if (pairs.length === 0) return null;
  const picked = pairs[platformKaggleIndex % pairs.length];
  platformKaggleIndex++;
  return picked;
}

export function normalizeKaggleHandle(input: string): string {
  return input.trim().replace(/^https?:\/\/(www\.)?kaggle\.com\//i, "").split(/[/?#]/)[0].toLowerCase();
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function fetchKaggleArtifacts(rawHandle: string, opts: { apiKey?: string; correlationId?: string } = {}): Promise<KaggleProfileData> {
  const username = normalizeKaggleHandle(rawHandle);
  if (!/^[a-z0-9_-]{2,40}$/.test(username)) throw new KaggleFetchError("Invalid Kaggle username.", 400);
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "AI-Tathastu-ProfileAuditor/1.0" };
  
  // Use student's personal key if provided; otherwise use platform service credential for public query
  let auth: Record<string, string> = {};
  if (opts.apiKey) {
    auth = { Authorization: `Basic ${Buffer.from(`${username}:${opts.apiKey}`).toString("base64")}` };
  } else {
    const plat = getPlatformKaggleCredential();
    if (plat) {
      auth = { Authorization: `Basic ${Buffer.from(`${plat.username}:${plat.key}`).toString("base64")}` };
    }
  }

  const ds = await connectorFetch("kaggle", `https://www.kaggle.com/api/v1/datasets/list?user=${encodeURIComponent(username)}&page=1`, {
    correlationId: opts.correlationId, headers: { ...headers, ...auth },
  });
  if (!ds.ok) throw new KaggleFetchError(`Kaggle datasets HTTP ${ds.status}.`, ds.status);
  let rows: unknown;
  try { rows = await ds.json(); } catch { throw new KaggleFetchError("Kaggle returned a malformed datasets response."); }
  if (!Array.isArray(rows)) throw new KaggleFetchError("Kaggle returned an unexpected datasets shape.");
  const datasets = rows
    .filter((r) => r && typeof r === "object" && String((r as { ownerRef?: string }).ownerRef || "").toLowerCase() === username)
    .map((r) => {
      const x = r as Record<string, unknown>;
      return {
        kind: "dataset" as const, ref: String(x.ref), title: String(x.title || x.ref), url: `https://www.kaggle.com/datasets/${x.ref}`,
        votes: num(x.voteCount), downloads: num(x.downloadCount), lastUpdated: typeof x.lastUpdated === "string" ? x.lastUpdated : null,
      };
    })
    .slice(0, 30);

  let notebooks: KaggleArtifact[] = [];
  let notebooksAvailable = false;
  if (opts.apiKey) {
    const kr = await connectorFetch("kaggle", `https://www.kaggle.com/api/v1/kernels/list?user=${encodeURIComponent(username)}&pageSize=30`, {
      correlationId: opts.correlationId, headers: { ...headers, ...auth },
    });
    if (kr.ok) {
      const ks = await kr.json().catch(() => []);
      if (Array.isArray(ks)) {
        notebooksAvailable = true;
        notebooks = ks
          .filter((k) => String((k as { ref?: string }).ref || "").toLowerCase().startsWith(`${username}/`))
          .map((k) => {
            const x = k as Record<string, unknown>;
            return { kind: "notebook" as const, ref: String(x.ref), title: String(x.title || x.ref), url: `https://www.kaggle.com/code/${x.ref}`, votes: num(x.totalVotes), downloads: null, lastUpdated: typeof x.lastRunTime === "string" ? x.lastRunTime : null };
          });
      }
    }
  }
  return { username, profileUrl: `https://www.kaggle.com/${username}`, datasets, notebooks, notebooksAvailable };
}
