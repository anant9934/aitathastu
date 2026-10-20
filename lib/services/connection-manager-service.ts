/**
 * /student/connections management (Task 2.2.5): one row per source the
 * dashboard ranks, with an honest state badge, last sync time, how many
 * records it has contributed, and three actions: Sync now, Edit handle/ID,
 * Disconnect (which purges stored credentials). Every platform is optional.
 *
 * Sync runs through the Phase 1 sync framework (idempotent, retried, dead
 * lettered); the route starts it after responding and the page polls state.
 */
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb, evidenceItems, projects } from "../db";
import { disconnectConnection, getExternalConnectionByProvider, saveExternalConnection } from "../repositories/connection-repository";
import { parseOrcid, parseSemanticScholarAuthorId } from "../connectors/research-and-dev/scholar-client";
import { describeFound, describeOperation } from "../sync/runners";
import { latestSyncOperations } from "../sync/sync-operation";
import { syncAllFootprints } from "../sync/footprint-sync";

export const MANAGED_SOURCES = ["github", "linkedin", "leetcode", "hackerrank", "kaggle", "scholar"] as const;
export type ManagedSource = (typeof MANAGED_SOURCES)[number];

export type ConnectionBadge = "connected" | "syncing" | "needs_reauth" | "reference_only" | "disconnected" | "not_connected";
export const BADGE_LABEL: Record<ConnectionBadge, string> = {
  connected: "Connected", syncing: "Syncing", needs_reauth: "Needs re-auth", reference_only: "Reference only", disconnected: "Disconnected", not_connected: "Not connected",
};

const META: Record<ManagedSource, { title: string; what: string; handleLabel: string | null; syncable: boolean }> = {
  github: { title: "GitHub", what: "Public repositories, languages and project evidence.", handleLabel: null, syncable: true },
  linkedin: { title: "LinkedIn", what: "Roles, education, skills and more from your public profile, extracted when you ask.", handleLabel: null, syncable: false },
  leetcode: { title: "LeetCode", what: "Problems solved, contest rating and topic tags.", handleLabel: "LeetCode username", syncable: true },
  hackerrank: { title: "HackerRank", what: "Skill badges and certificates.", handleLabel: "HackerRank username", syncable: true },
  kaggle: { title: "Kaggle", what: "Competitions, datasets and notebooks.", handleLabel: "Kaggle username", syncable: true },
  scholar: { title: "Research ID", what: "Papers from your ORCID iD or Semantic Scholar author ID. Never guessed from your name.", handleLabel: "ORCID iD or Semantic Scholar author ID", syncable: true },
};

export class ConnectionManagerError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Pure: the badge for a source from its connection row and latest sync operation. */
export function badgeFor(conn: { status: string } | null | undefined, op: { state: string; action?: "retry" | "reconnect" } | null | undefined): ConnectionBadge {
  if (!conn) return "not_connected";
  if (conn.status === "disconnected") return "disconnected";
  if (op && (op.state === "queued" || op.state === "running")) return "syncing";
  if (op && op.action === "reconnect" && ["failed", "timed_out", "dead_letter"].includes(op.state)) return "needs_reauth";
  if (conn.status === "reference_only") return "reference_only";
  return "connected";
}

export type ManagedConnection = {
  source: ManagedSource;
  title: string;
  what: string;
  badge: ConnectionBadge;
  badgeLabel: string;
  handle: string | null;
  handleLabel: string | null;
  profileUrl: string | null;
  lastSyncedAt: string | null;
  recordsImported: number;
  found: string | null;
  problem: string | null;
  reconnectUrl: string | null;
  canSync: boolean;
  canEditHandle: boolean;
  canDisconnect: boolean;
};

export async function listManagedConnections(personId: string): Promise<ManagedConnection[]> {
  const db = await getDb();
  const [ops, evidenceCounts, githubProjects] = await Promise.all([
    latestSyncOperations(personId),
    db.select({ origin: evidenceItems.originSource, n: count() }).from(evidenceItems)
      .where(and(eq(evidenceItems.personId, personId), inArray(evidenceItems.originSource, [...MANAGED_SOURCES]))).groupBy(evidenceItems.originSource),
    db.select({ sources: projects.sources }).from(projects).where(eq(projects.personId, personId)),
  ]);
  const counted = new Map(evidenceCounts.map((r) => [r.origin, Number(r.n)]));
  const repoCount = githubProjects.filter((p) => ((p.sources as string[]) ?? []).includes("github")).length;

  return Promise.all(MANAGED_SOURCES.map(async (source) => {
    const conn = await getExternalConnectionByProvider(personId, source);
    const opRow = ops.find((o) => o.source === source);
    const op = opRow ? describeOperation(opRow) : null;
    const badge = badgeFor(conn, op);
    const lastOk = ops.find((o) => o.source === source && (o.state === "succeeded" || o.state === "partial"));
    const live = badge !== "not_connected" && badge !== "disconnected";
    const found = lastOk ? describeFound(source, lastOk.result) : null;
    return {
      source, title: META[source].title, what: META[source].what, badge, badgeLabel: BADGE_LABEL[badge],
      handle: live ? conn?.externalUsername ?? null : null, handleLabel: META[source].handleLabel,
      profileUrl: live ? conn?.profileUrl ?? null : null,
      lastSyncedAt: (lastOk?.finishedAt ?? conn?.lastSyncedAt ?? null)?.toISOString?.() ?? null,
      recordsImported: (counted.get(source) ?? 0) + (source === "github" ? repoCount : 0),
      found,
      problem: op?.reason ?? null,
      reconnectUrl: op?.reconnectUrl ?? (source === "github" && badge === "needs_reauth" ? "/api/auth/github/connect?returnTo=/student/connections" : null),
      canSync: live && META[source].syncable && badge !== "syncing",
      canEditHandle: META[source].handleLabel !== null,
      canDisconnect: live,
    };
  }));
}

function parseManagedSource(raw: unknown): ManagedSource {
  if (typeof raw !== "string" || !(MANAGED_SOURCES as readonly string[]).includes(raw)) throw new ConnectionManagerError("Unknown source.");
  return raw as ManagedSource;
}

/** Validates and saves a handle or research ID. Accepts a pasted profile URL too. */
export async function updateHandle(personId: string, rawSource: unknown, rawHandle: unknown) {
  const source = parseManagedSource(rawSource);
  if (!META[source].handleLabel) throw new ConnectionManagerError(source === "github" ? "GitHub is connected by signing in with GitHub. Use Reconnect instead." : "LinkedIn is connected by signing in. Use the LinkedIn card instead.");
  const raw = typeof rawHandle === "string" ? rawHandle.trim() : "";
  if (!raw) throw new ConnectionManagerError(`Enter your ${META[source].handleLabel}.`);

  if (source === "scholar") {
    const orcid = parseOrcid(raw);
    const s2 = orcid ? null : parseSemanticScholarAuthorId(raw);
    if (!orcid && !s2) throw new ConnectionManagerError("That isn't an ORCID iD or a Semantic Scholar author ID. Copy it from your profile page.");
    const kind = orcid ? "orcid" : "semantic_scholar";
    const id = (orcid ?? s2)!;
    await saveExternalConnection({ personId, provider: "scholar", externalUsername: id, profileUrl: kind === "orcid" ? `https://orcid.org/${id}` : `https://www.semanticscholar.org/author/${id}`, status: "detected", metadata: { idKind: kind } });
    return { source, handle: id };
  }
  const host = { leetcode: "leetcode.com", hackerrank: "hackerrank.com", kaggle: "kaggle.com" }[source as "leetcode" | "hackerrank" | "kaggle"];
  // A pasted profile URL becomes its last path segment ("https://leetcode.com/u/kavya/" → "kavya").
  const handle = /^https?:\/\//i.test(raw) ? (() => {
    let url: URL;
    try { url = new URL(raw); } catch { throw new ConnectionManagerError("That link isn't a valid URL."); }
    if (!url.hostname.endsWith(host)) throw new ConnectionManagerError(`That link isn't a ${host} profile.`);
    return url.pathname.split("/").filter(Boolean).pop() ?? "";
  })() : raw.replace(/^@/, "");
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(handle)) throw new ConnectionManagerError("Usernames can use letters, numbers, dots, dashes and underscores (up to 40).");
  const profileUrl = source === "leetcode" ? `https://leetcode.com/u/${handle}/` : `https://www.${host}/${handle}`;
  // A new handle starts clean: any stored key belonged to the old account.
  await saveExternalConnection({ personId, provider: source, externalUsername: handle, profileUrl, displayName: handle, status: "detected", metadata: {} });
  return { source, handle };
}

/** Checks a sync can start; the route then runs runManagedSync after responding. */
export async function assertSyncable(personId: string, rawSource: unknown): Promise<ManagedSource> {
  const source = parseManagedSource(rawSource);
  if (!META[source].syncable) throw new ConnectionManagerError("Refresh LinkedIn from its card with Refresh profile.");
  const conn = await getExternalConnectionByProvider(personId, source);
  if (!conn || conn.status === "disconnected") throw new ConnectionManagerError(`Connect ${META[source].title} first.`, 409);
  return source;
}

export async function runManagedSync(personId: string, source: ManagedSource) {
  if (source === "github") {
    const { syncGitHubConnection } = await import("./github-sync-service");
    return syncGitHubConnection(personId, undefined, { trigger: "user" });
  }
  if (source === "linkedin") return null;
  const [summary] = await syncAllFootprints(personId, "user", { sources: [source] });
  return summary;
}

/** Disconnects and purges stored credentials (tokens, API keys, sessions live in connection metadata). */
export async function disconnectManaged(personId: string, rawSource: unknown) {
  const source = parseManagedSource(rawSource);
  if (source === "github") {
    const { disconnectGitHubAccount } = await import("./github-sync-service");
    return disconnectGitHubAccount(personId);
  }
  if (source === "linkedin") {
    const { disconnectLinkedIn } = await import("./linkedin-import-service");
    await disconnectLinkedIn(personId);
    return { success: true };
  }
  await disconnectConnection(personId, source);
  return { success: true };
}
