import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb, externalConnections, sourceSnapshots, syncRuns } from "../db";

export type SaveConnectionParams = {
  personId: string;
  provider: "google" | "github" | "linkedin" | "leetcode" | "codechef" | "hackerrank" | "hackerearth" | "eris" | "mentormaze" | "padho_code" | "study_lpu";
  externalUsername: string;
  profileUrl: string;
  externalAccountId?: string;
  displayName?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  status?: "connected" | "syncing" | "needs_attention" | "reference_only" | "disconnected" | "unavailable" | "revoked" | "error";
};

export async function saveExternalConnection(params: SaveConnectionParams) {
  const db = await getDb();
  const now = new Date();
  const id = `conn_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const existing = await db
    .select()
    .from(externalConnections)
    .where(
      and(
        eq(externalConnections.personId, params.personId),
        eq(externalConnections.provider, params.provider)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(externalConnections)
      .set({
        externalUsername: params.externalUsername,
        profileUrl: params.profileUrl,
        displayName: params.displayName ?? existing[0].displayName,
        externalAccountId: params.externalAccountId ?? existing[0].externalAccountId,
        scopes: params.scopes ?? existing[0].scopes,
        metadata: params.metadata || existing[0].metadata,
        status: params.status || "connected",
        disconnectedAt: params.status === "disconnected" ? now : null,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(externalConnections.id, existing[0].id));
    return { ...existing[0], ...params, lastSyncedAt: now, updatedAt: now };
  }

  const [created] = await db
    .insert(externalConnections)
    .values({
      id,
      personId: params.personId,
      provider: params.provider,
      externalUsername: params.externalUsername,
      profileUrl: params.profileUrl,
      displayName: params.displayName || params.externalUsername,
      externalAccountId: params.externalAccountId || null,
      scopes: params.scopes || [],
      status: params.status || "connected",
      metadata: params.metadata || null,
      lastSyncedAt: now,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function getExternalConnections(personId: string) {
  const db = await getDb();
  return db
    .select()
    .from(externalConnections)
    .where(eq(externalConnections.personId, personId));
}

export async function getExternalConnectionByProvider(personId: string, provider: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(externalConnections)
    .where(
      and(
        eq(externalConnections.personId, personId),
        eq(externalConnections.provider, provider)
      )
    )
    .limit(1);
  return rows[0] || null;
}

export async function disconnectConnection(personId: string, provider: string) {
  const db = await getDb();
  const now = new Date();
  await db
    .update(externalConnections)
    .set({
      status: "disconnected",
      disconnectedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(externalConnections.personId, personId),
        eq(externalConnections.provider, provider)
      )
    );
}

export async function saveSourceSnapshot(
  personId: string,
  source: string,
  sourceReference: string,
  snapshotData: Record<string, unknown>,
  checksum?: string
) {
  const db = await getDb();
  const id = `snap_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [created] = await db
    .insert(sourceSnapshots)
    .values({
      id,
      personId,
      source,
      sourceReference,
      snapshotData,
      checksum: checksum || null,
      createdAt: new Date(),
    })
    .returning();

  return created;
}

export async function getLatestSourceSnapshot(
  personId: string,
  source: string,
  sourceReference: string
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(sourceSnapshots)
    .where(
      and(
        eq(sourceSnapshots.personId, personId),
        eq(sourceSnapshots.source, source),
        eq(sourceSnapshots.sourceReference, sourceReference)
      )
    )
    .orderBy(desc(sourceSnapshots.createdAt))
    .limit(1);

  return rows[0] || null;
}

export async function getSourceSnapshots(personId: string, source?: string) {
  const db = await getDb();
  if (source) {
    return db
      .select()
      .from(sourceSnapshots)
      .where(
        and(
          eq(sourceSnapshots.personId, personId),
          eq(sourceSnapshots.source, source)
        )
      )
      .orderBy(desc(sourceSnapshots.createdAt));
  }

  return db
    .select()
    .from(sourceSnapshots)
    .where(eq(sourceSnapshots.personId, personId))
    .orderBy(desc(sourceSnapshots.createdAt));
}

// Sync runs
export async function createSyncRun(
  connectionId: string,
  personId: string,
  provider: string
) {
  const db = await getDb();
  const id = `sync_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();

  const [created] = await db
    .insert(syncRuns)
    .values({
      id,
      connectionId,
      personId,
      provider,
      status: "running",
      startedAt: now,
      recordsFetched: 0,
      recordsChanged: 0,
    })
    .returning();

  return created;
}

export async function completeSyncRun(
  syncRunId: string,
  result: {
    status: "completed" | "partial" | "failed";
    recordsFetched: number;
    recordsChanged: number;
    errorCode?: string;
    errorSummary?: string;
  }
) {
  const db = await getDb();
  const now = new Date();

  await db
    .update(syncRuns)
    .set({
      status: result.status,
      completedAt: now,
      recordsFetched: result.recordsFetched,
      recordsChanged: result.recordsChanged,
      errorCode: result.errorCode || null,
      errorSummary: result.errorSummary || null,
    })
    .where(eq(syncRuns.id, syncRunId));
}

export async function getSyncRunsByPerson(personId: string, limit = 10) {
  const db = await getDb();
  return db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.personId, personId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}
