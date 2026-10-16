/**
 * In-place skill edits on /student/skills (Task 2.2.3).
 *
 * - Add: an evidence_items skill row with source "student_reported" (a claim,
 *   never presented as proof).
 * - Proficiency: the student's self-assessment, stored on that same row.
 * - Hide: imported evidence is never deleted; the skill name goes on
 *   user_preferences.metadata.hiddenSkills and is left out of the skills
 *   intelligence (and so out of its counts and readiness) until shown again.
 * - Remove: deletes only the student's own student_reported rows.
 *
 * Skills intelligence is computed on read from evidence_items, so every
 * mutation here recomputes the counts the next time it is read.
 */
import { and, eq } from "drizzle-orm";
import { getDb, evidenceItems } from "../db";
import { createEvidenceRecord } from "../repositories/evidence-repository";
import { getUserPreferences, updateUserPreferences } from "../repositories/person-repository";
import { normalizeSkillName } from "./skill-intelligence-service";

export const SELF_PROFICIENCY = ["beginner", "intermediate", "advanced"] as const;
export type SelfProficiency = (typeof SELF_PROFICIENCY)[number];

export class SkillEditError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type StudentSkill = { name: string; proficiency: SelfProficiency | null; evidenceId: string };

const keyFor = (canonical: string) => `student_skill_${canonical.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw new SkillEditError("Enter a skill name.");
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new SkillEditError("Enter a skill name.");
  if (name.length > 60) throw new SkillEditError("Skill names can be at most 60 characters.");
  if (!/[\p{L}\p{N}]/u.test(name)) throw new SkillEditError("A skill name needs at least one letter or number.");
  return normalizeSkillName(name) || name;
}

function cleanProficiency(raw: unknown): SelfProficiency | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (!SELF_PROFICIENCY.includes(raw as SelfProficiency)) throw new SkillEditError("Choose beginner, intermediate or advanced.");
  return raw as SelfProficiency;
}

const valueFor = (p: SelfProficiency | null) => (p ? `Self-assessed proficiency: ${p}` : "Self-reported skill");

export async function getHiddenSkills(personId: string): Promise<string[]> {
  const prefs = await getUserPreferences(personId);
  const list = (prefs?.metadata as Record<string, unknown> | null)?.hiddenSkills;
  return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : [];
}

export async function listStudentSkills(personId: string): Promise<StudentSkill[]> {
  const db = await getDb();
  const rows = await db.select({ id: evidenceItems.id, subject: evidenceItems.subject, value: evidenceItems.value })
    .from(evidenceItems)
    .where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.category, "skill"), eq(evidenceItems.source, "student_reported")));
  return rows.map((r) => {
    const m = /proficiency: (beginner|intermediate|advanced)$/.exec(r.value);
    return { name: r.subject, proficiency: (m?.[1] as SelfProficiency) ?? null, evidenceId: r.id };
  });
}

/** Adds (or re-adds) a self-reported skill; also un-hides it. */
export async function addStudentSkill(personId: string, rawName: unknown, rawProficiency?: unknown): Promise<StudentSkill> {
  const name = cleanName(rawName);
  const proficiency = cleanProficiency(rawProficiency);
  const record = await createEvidenceRecord(personId, {
    category: "skill", subject: name, value: valueFor(proficiency),
    source: "student_reported", verificationStatus: "self_reported", originSource: "manual",
    sourceReference: "Added by you on the skills page",
    interpretation: `You added ${name} yourself. It counts as a claim until a project, assessment or verifier backs it.`,
    whyItMatters: "Lets you record skills no connected source has picked up yet.",
    importKey: keyFor(name),
  });
  await setHidden(personId, name, false);
  return { name, proficiency, evidenceId: record.id };
}

/** Updates the self-assessed proficiency; creates the student's row if the skill only came from imports. */
export async function setSkillProficiency(personId: string, rawName: unknown, rawProficiency: unknown): Promise<StudentSkill> {
  return addStudentSkill(personId, rawName, rawProficiency ?? null);
}

/** Deletes the student's own rows for this skill. Imported evidence is untouched (use hide for that). */
export async function removeStudentSkill(personId: string, rawName: unknown): Promise<{ removed: number }> {
  const name = cleanName(rawName);
  const db = await getDb();
  const removed = await db.delete(evidenceItems)
    .where(and(eq(evidenceItems.personId, personId), eq(evidenceItems.importKey, keyFor(name)), eq(evidenceItems.source, "student_reported")))
    .returning();
  return { removed: removed.length };
}

export async function setHidden(personId: string, rawName: unknown, hidden: boolean): Promise<string[]> {
  const name = cleanName(rawName);
  const current = await getHiddenSkills(personId);
  const without = current.filter((s) => s.toLowerCase() !== name.toLowerCase());
  const next = hidden ? [...without, name] : without;
  if (next.length !== current.length || hidden) await updateUserPreferences(personId, { metadata: { hiddenSkills: next } });
  return next;
}
