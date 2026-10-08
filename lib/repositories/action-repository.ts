import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb, actionStates } from "../db";
import type { ActionStatus } from "../domain";

export async function getActionStatesByPersonId(
  personId: string
): Promise<Record<string, ActionStatus>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(actionStates)
    .where(eq(actionStates.personId, personId));

  const result: Record<string, ActionStatus> = {};
  for (const row of rows) {
    result[row.recommendationKey] = row.status as ActionStatus;
  }
  return result;
}

export async function setActionState(
  personId: string,
  recommendationKey: string,
  status: ActionStatus
): Promise<void> {
  const db = await getDb();
  const now = new Date();

  const existing = await db
    .select()
    .from(actionStates)
    .where(
      and(
        eq(actionStates.personId, personId),
        eq(actionStates.recommendationKey, recommendationKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const updates: {
      status: string;
      updatedAt: Date;
      startedAt?: Date;
      dismissedAt?: Date;
    } = {
      status,
      updatedAt: now,
    };
    if (status === "active") updates.startedAt = now;
    if (status === "dismissed") updates.dismissedAt = now;

    await db
      .update(actionStates)
      .set(updates)
      .where(eq(actionStates.id, existing[0].id));
  } else {
    const id = `act_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    await db.insert(actionStates).values({
      id,
      personId,
      recommendationKey,
      status,
      startedAt: status === "active" ? now : null,
      dismissedAt: status === "dismissed" ? now : null,
      updatedAt: now,
    });
  }
}
