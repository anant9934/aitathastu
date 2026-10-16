import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb, journeyEvents } from "../db";
import type { JourneyEventType } from "../domain";
import { pageBounds, type PageOptions } from "./pagination";

export type JourneyEventRecord = {
  id: string;
  personId: string;
  type: JourneyEventType | string;
  title: string;
  description: string;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  importKey?: string | null;
  timestamp: Date;
  createdAt: Date;
};

export type JourneyEventInsertParams = {
  id?: string;
  type: JourneyEventType | string;
  title: string;
  description: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  importKey?: string;
  timestamp?: Date | string;
};

export async function getJourneyEventsByPersonId(personId: string, page?: PageOptions): Promise<JourneyEventRecord[]> {
  const db = await getDb();
  const { limit, offset } = pageBounds(page);
  const rows = await db
    .select()
    .from(journeyEvents)
    .where(eq(journeyEvents.personId, personId))
    .orderBy(desc(journeyEvents.timestamp), desc(journeyEvents.id))
    .limit(limit)
    .offset(offset);

  return rows as JourneyEventRecord[];
}

export async function createJourneyEventRecord(
  personId: string,
  event: JourneyEventInsertParams
): Promise<JourneyEventRecord> {
  const db = await getDb();
  const now = new Date();
  const ts = event.timestamp ? new Date(event.timestamp) : now;
  const id = event.id || `je_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // If importKey is specified, verify it doesn't already exist for this person
  if (event.importKey) {
    const existing = await db
      .select()
      .from(journeyEvents)
      .where(
        and(
          eq(journeyEvents.personId, personId),
          eq(journeyEvents.importKey, event.importKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0] as JourneyEventRecord;
    }
  }

  const inserted = await db.insert(journeyEvents).values({
    id,
    personId,
    type: event.type,
    title: event.title.trim(),
    description: event.description.trim(),
    relatedEntityId: event.relatedEntityId || null,
    metadata: event.metadata || null,
    importKey: event.importKey || null,
    timestamp: ts,
    createdAt: now,
  }).onConflictDoNothing().returning();

  // A concurrent writer recorded the same import-keyed event first (uq_journey_events_import_key).
  if (!inserted.length && event.importKey) {
    const [winner] = await db.select().from(journeyEvents)
      .where(and(eq(journeyEvents.personId, personId), eq(journeyEvents.importKey, event.importKey))).limit(1);
    if (winner) return winner as JourneyEventRecord;
  }

  return {
    id,
    personId,
    type: event.type,
    title: event.title.trim(),
    description: event.description.trim(),
    relatedEntityId: event.relatedEntityId || null,
    metadata: event.metadata || null,
    importKey: event.importKey || null,
    timestamp: ts,
    createdAt: now,
  };
}
