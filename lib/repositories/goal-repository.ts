import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb, goals } from "../db";

export type GoalRecord = {
  id: string;
  personId: string;
  title: string;
  description?: string | null;
  source: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getActiveGoal(personId: string): Promise<GoalRecord | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.personId, personId), eq(goals.status, "active")))
    .orderBy(desc(goals.updatedAt))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function getGoalsByPersonId(personId: string): Promise<GoalRecord[]> {
  const db = await getDb();
  return db
    .select()
    .from(goals)
    .where(eq(goals.personId, personId))
    .orderBy(desc(goals.updatedAt));
}

export async function setActiveGoal(
  personId: string,
  title: string,
  description?: string,
  source?: "preset" | "custom"
): Promise<GoalRecord> {
  const db = await getDb();
  const trimmed = title.trim();
  const now = new Date();

  // Find if there is an existing active goal
  const currentActive = await getActiveGoal(personId);

  if (currentActive) {
    if (currentActive.title.toLowerCase() === trimmed.toLowerCase()) {
      // Just update timestamp/description
      await db
        .update(goals)
        .set({
          description: description !== undefined ? description.trim() : currentActive.description,
          updatedAt: now,
        })
        .where(eq(goals.id, currentActive.id));

      return {
        ...currentActive,
        description: description !== undefined ? description.trim() : currentActive.description,
        updatedAt: now,
      };
    }

    // Pause the old goal
    await db
      .update(goals)
      .set({
        status: "paused",
        updatedAt: now,
      })
      .where(eq(goals.id, currentActive.id));
  }

  // Create new active goal
  const goalId = `goal_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const isPreset = ["ml engineer", "ai researcher", "ai founder"].includes(trimmed.toLowerCase());
  const finalSource = source || (isPreset ? "preset" : "custom");

  await db.insert(goals).values({
    id: goalId,
    personId,
    title: trimmed,
    description: description ? description.trim() : null,
    source: finalSource,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: goalId,
    personId,
    title: trimmed,
    description: description ? description.trim() : null,
    source: finalSource,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}
