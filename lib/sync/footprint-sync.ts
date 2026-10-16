/**
 * Digital-footprint syncs on the sync framework (Tasks 1.6.2-1.6.6).
 *
 * One work function per source (LeetCode, HackerRank, Kaggle, Scholar), each
 * run through runSyncOperation, so every source inherits idempotency,
 * correlation IDs, timeouts, retry backoff and dead letters. Requests go
 * through connectorFetch (rate window + circuit breaker). When a provider is
 * rate-limited / circuit-open / timing out, the last snapshot is served and
 * the attempt is `partial` with servedFromCache, never a hard failure.
 *
 * syncAllFootprints runs every connected source with Promise.allSettled and an
 * independent boundary per source (1.6.6), skipping sources inside their TTL
 * unless the trigger allows a bypass. Page loads never call any of this.
 */
import crypto from "crypto";
import { fetchLeetCodeProfileStats } from "@/lib/connectors/leetcode/client";
import { fetchHackerRankProfile } from "@/lib/connectors/coding-platforms/client";
import { fetchKaggleArtifacts, KaggleFetchError } from "@/lib/connectors/research-and-dev/kaggle-client";
import { fetchPublications, ScholarFetchError, type ScholarIdentifier } from "@/lib/connectors/research-and-dev/scholar-client";
import { isServeFromCacheError } from "@/lib/connectors/rate-limiter";
import { getExternalConnectionByProvider, getSourceSnapshots, saveSourceSnapshot } from "@/lib/repositories/connection-repository";
import { writeEvidenceBatch, type EvidenceInsertParams } from "@/lib/repositories/evidence-repository";
import { saveProject } from "@/lib/repositories/project-repository";
import { decryptConnectionToken } from "@/lib/security/connection-token";
import { isSyncDue } from "./policy";
import { latestSyncOperations, runSyncOperation, SyncError, type SyncContext, type SyncTrigger, type SyncWorkResult } from "./sync-operation";

export const FOOTPRINT_SOURCES = ["leetcode", "hackerrank", "kaggle", "scholar"] as const;
export type FootprintSource = (typeof FOOTPRINT_SOURCES)[number];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);
const checksum = (v: unknown) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");

function evidence(source: FootprintSource, item: Omit<EvidenceInsertParams, "source" | "verificationStatus" | "originSource" | "whyItMatters"> & { whyItMatters?: string }): EvidenceInsertParams {
  return {
    whyItMatters: "Public platform data can corroborate a skill for student review.",
    ...item,
    source: "imported",
    verificationStatus: "imported",
    originSource: source,
  };
}

/** Last snapshot for this source+reference, used when the live call is refused. */
async function latestSnapshot(personId: string, source: FootprintSource, reference: string) {
  const snaps = await getSourceSnapshots(personId, source, { limit: 20 });
  return snaps.find((s) => s.sourceReference === reference) ?? null;
}

async function cachedOrThrow(personId: string, source: FootprintSource, reference: string, reason: string, ctx: SyncContext): Promise<SyncWorkResult> {
  const snap = await latestSnapshot(personId, source, reference);
  ctx.log.warn(`${source}.live_unavailable`, { metadata: { reason, servedFromCache: Boolean(snap) } });
  if (!snap) throw new SyncError(`${source} is unavailable right now (${reason}) and there is no saved copy yet.`, `${source}_unavailable`, true);
  return { outcome: "partial", result: { servedFromCache: true, snapshotAt: snap.createdAt.toISOString(), reason } };
}

// ── LeetCode (1.6.4) ───────────────────────────────────────────────────────
export async function leetcodeWork(personId: string, handle: string, ctx: SyncContext): Promise<SyncWorkResult> {
  const stats = await fetchLeetCodeProfileStats(handle, { correlationId: ctx.correlationId });
  if (stats.acquisitionStatus === "RATE_LIMITED" || (stats.acquisitionStatus === "PROFILE_LINK_ONLY" && /timeout|network/i.test(stats.error || ""))) {
    return cachedOrThrow(personId, "leetcode", stats.username || handle, stats.error || "rate limited", ctx);
  }
  if (stats.acquisitionStatus !== "LIVE_VERIFIED") throw new SyncError(stats.error || "LeetCode profile not found or private.", "leetcode_not_found", false);
  await saveSourceSnapshot(personId, "leetcode", stats.username, { ...stats, correlationId: ctx.correlationId }, checksum(stats));
  const items: EvidenceInsertParams[] = [];
  const threshold = [500, 300, 200, 100, 50].find((t) => stats.totalSolved >= t);
  if (threshold) {
    items.push(evidence("leetcode", {
      category: "skill", subject: "Data Structures & Algorithms", value: `LeetCode ${threshold}+ Problems Solved`,
      sourceReference: stats.profileUrl, importKey: "leetcode_dsa_solved",
      interpretation: `${stats.totalSolved} problems solved on LeetCode (${stats.easySolved} easy, ${stats.mediumSolved} medium, ${stats.hardSolved} hard).`,
    }));
  }
  if (stats.contestRating) {
    items.push(evidence("leetcode", {
      category: "assessment", subject: "LeetCode Contest Rating", value: String(stats.contestRating), sourceReference: stats.profileUrl,
      importKey: "leetcode_contest_rating",
      interpretation: `Contest rating ${stats.contestRating}${stats.contestsAttended ? ` across ${stats.contestsAttended} contests` : ""}${stats.contestGlobalRanking ? `, global rank ${stats.contestGlobalRanking}` : ""}.`,
    }));
  }
  for (const badge of stats.badges ?? []) {
    items.push(evidence("leetcode", { category: "assessment", subject: badge, value: "LeetCode badge", sourceReference: stats.profileUrl, importKey: `leetcode_badge_${slug(badge)}`, interpretation: `Earned the LeetCode badge "${badge}".` }));
  }
  await writeEvidenceBatch(personId, items);
  return { outcome: "succeeded", result: { totalSolved: stats.totalSolved, contestRating: stats.contestRating ?? null, badges: stats.badges?.length ?? 0, evidence: items.length } };
}

// ── HackerRank (1.6.5) ─────────────────────────────────────────────────────
export async function hackerrankWork(personId: string, handle: string, ctx: SyncContext): Promise<SyncWorkResult> {
  const p = await fetchHackerRankProfile(handle, undefined, { correlationId: ctx.correlationId });
  if (p.status === "RATE_LIMITED") return cachedOrThrow(personId, "hackerrank", p.username, p.notes || "rate limited", ctx);
  if (p.status === "UNAVAILABLE") throw new SyncError(p.notes || "Invalid HackerRank username.", "hackerrank_invalid", false);
  if (p.status === "PROFILE_LINK_ONLY") return cachedOrThrow(personId, "hackerrank", p.username, "live fetch failed", ctx);
  await saveSourceSnapshot(personId, "hackerrank", p.username, { ...p, correlationId: ctx.correlationId }, checksum(p));
  const items: EvidenceInsertParams[] = (p.badges ?? []).map((b) => evidence("hackerrank", {
    // "Problem Solving" / "Python" badges map onto the skill of the same name.
    category: "skill", subject: b.badge, value: b.stars ? `${b.stars} stars` : "badge", sourceReference: p.profileUrl,
    importKey: `hackerrank_badge_${slug(b.badge)}`,
    interpretation: `HackerRank ${b.badge} badge${b.stars ? `: ${b.stars} stars` : ""}.`,
  }));
  for (const d of p.domainScores ?? []) {
    items.push(evidence("hackerrank", { category: "assessment", subject: `HackerRank ${d.domain}`, value: String(d.practiceScore), sourceReference: p.profileUrl, importKey: `hackerrank_score_${slug(d.domain)}`, interpretation: `Practice score ${d.practiceScore} in ${d.domain}${d.rank ? ` (rank ${d.rank})` : ""}.` }));
  }
  await writeEvidenceBatch(personId, items);
  return { outcome: "succeeded", result: { badges: p.badges?.length ?? 0, domains: p.domainScores?.length ?? 0, evidence: items.length } };
}

// ── Kaggle (1.6.3) ─────────────────────────────────────────────────────────
export async function kaggleWork(personId: string, handle: string, ctx: SyncContext, apiKey?: string): Promise<SyncWorkResult> {
  let data;
  try {
    data = await fetchKaggleArtifacts(handle, { apiKey, correlationId: ctx.correlationId });
  } catch (error) {
    if (isServeFromCacheError(error) || (error instanceof Error && error.name === "TimeoutError") || (error instanceof KaggleFetchError && (error.status ?? 500) >= 500)) {
      return cachedOrThrow(personId, "kaggle", handle.toLowerCase(), (error as Error).message, ctx);
    }
    if (error instanceof KaggleFetchError && error.status === 400) throw new SyncError(error.message, "kaggle_invalid", false);
    throw error;
  }
  await saveSourceSnapshot(personId, "kaggle", data.username, { ...data, correlationId: ctx.correlationId }, checksum(data));
  for (const a of [...data.datasets, ...data.notebooks]) {
    await saveProject(personId, {
      title: a.title, summary: `Kaggle ${a.kind}`, description: `Public Kaggle ${a.kind} ${a.ref}.`,
      sources: ["kaggle"], demoUrl: a.url, status: "candidate", projectType: "software",
    });
  }
  await writeEvidenceBatch(personId, [...data.datasets, ...data.notebooks].map((a) => evidence("kaggle", {
    category: "project", subject: a.title, value: `Kaggle ${a.kind}`, sourceReference: a.url, importKey: `kaggle_${a.kind}_${slug(a.ref)}`,
    interpretation: `Published the Kaggle ${a.kind} "${a.title}"${a.votes ? ` (${a.votes} votes)` : ""}${a.downloads ? `, ${a.downloads} downloads` : ""}.`,
  })));
  return { outcome: "succeeded", result: { datasets: data.datasets.length, notebooks: data.notebooks.length, notebooksAvailable: data.notebooksAvailable } };
}

// ── Scholar (1.6.2) ────────────────────────────────────────────────────────
export async function scholarWork(personId: string, id: ScholarIdentifier, ctx: SyncContext): Promise<SyncWorkResult> {
  const reference = `${id.kind}:${id.value}`;
  let papers;
  try {
    papers = await fetchPublications(id, { correlationId: ctx.correlationId });
  } catch (error) {
    if (error instanceof ScholarFetchError && !error.retryable) throw new SyncError(error.message, "scholar_invalid_id", false);
    if (isServeFromCacheError(error) || error instanceof ScholarFetchError || (error instanceof Error && error.name === "TimeoutError")) {
      return cachedOrThrow(personId, "scholar", reference, (error as Error).message, ctx);
    }
    throw error;
  }
  await saveSourceSnapshot(personId, "scholar", reference, { identifier: id, papers, correlationId: ctx.correlationId }, checksum(papers));
  await writeEvidenceBatch(personId, papers.map((p) => evidence("scholar", {
    category: "publication", subject: p.title, value: [p.venue, p.year].filter(Boolean).join(", ") || "Publication",
    sourceReference: p.url || reference, importKey: `scholar_${p.doi ? `doi_${slug(p.doi)}` : slug(p.sourceId)}`,
    interpretation: `${p.title}${p.venue ? `, ${p.venue}` : ""}${p.year ? ` (${p.year})` : ""}${p.citationCount !== null ? `; cited ${p.citationCount} times` : ""}${p.coAuthors.length ? `; with ${p.coAuthors.slice(0, 5).join(", ")}` : ""}.`,
    whyItMatters: "A publication attributed through your own verified research ID.",
  })));
  return { outcome: "succeeded", result: { papers: papers.length, identifier: id.kind } };
}

// ── wiring ─────────────────────────────────────────────────────────────────
/** The connected handle/ID for a source, or null when the student hasn't added one (=> the source never runs). */
export async function resolveFootprintTarget(personId: string, source: FootprintSource): Promise<{ run: (ctx: SyncContext) => Promise<SyncWorkResult> } | null> {
  const conn = await getExternalConnectionByProvider(personId, source);
  if (!conn || conn.status === "disconnected" || !conn.externalUsername) return null;
  const meta = (conn.metadata || {}) as Record<string, unknown>;
  switch (source) {
    case "leetcode": return { run: (ctx) => leetcodeWork(personId, conn.externalUsername, ctx) };
    case "hackerrank": return { run: (ctx) => hackerrankWork(personId, conn.externalUsername, ctx) };
    case "kaggle": {
      const apiKey = typeof meta.encryptedApiKey === "string" ? decryptConnectionToken(meta.encryptedApiKey, personId) : undefined;
      return { run: (ctx) => kaggleWork(personId, conn.externalUsername, ctx, apiKey) };
    }
    case "scholar": {
      // Only an ID the student entered; never derived from their name.
      const kind = meta.idKind === "semantic_scholar" ? "semantic_scholar" : meta.idKind === "orcid" ? "orcid" : null;
      if (!kind) return null;
      return { run: (ctx) => scholarWork(personId, { kind, value: conn.externalUsername }, ctx) };
    }
  }
}

export type FootprintRunSummary = { source: FootprintSource; outcome: "ran" | "skipped_not_connected" | "skipped_fresh" | "error"; state?: string; error?: string };

/**
 * Sync every connected footprint source independently (1.6.6). One source
 * throwing, timing out or being rate-limited never affects the others.
 */
export async function syncAllFootprints(personId: string, trigger: SyncTrigger, opts: { sources?: readonly FootprintSource[]; requestId?: string } = {}): Promise<FootprintRunSummary[]> {
  const sources = opts.sources ?? FOOTPRINT_SOURCES;
  const ops = await latestSyncOperations(personId);
  const settled = await Promise.allSettled(sources.map(async (source): Promise<FootprintRunSummary> => {
    const target = await resolveFootprintTarget(personId, source);
    if (!target) return { source, outcome: "skipped_not_connected" };
    const last = ops.find((o) => o.source === source && (o.state === "succeeded" || o.state === "partial"));
    if (!isSyncDue(source, last?.finishedAt ?? null, trigger)) return { source, outcome: "skipped_fresh", state: last?.state };
    const { operation } = await runSyncOperation({ personId, source, trigger, requestId: opts.requestId ? `${opts.requestId}:${source}` : undefined }, target.run);
    return { source, outcome: "ran", state: operation.state, error: operation.lastError ?? undefined };
  }));
  return settled.map((r, i) => r.status === "fulfilled" ? r.value : { source: sources[i], outcome: "error", error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
}
