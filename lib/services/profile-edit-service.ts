/**
 * In-place edits on /student/profile (Task 2.2.2). Validates the fields a
 * student may change about themselves, writes person_profiles, and records a
 * person_profile_versions snapshot of the edited profile. A save that changes
 * nothing writes nothing.
 */
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb, personProfiles } from "../db";
import { CrossSourceFusionService } from "./cross-source-fusion-service";

export const PLACEMENT_STATUSES = ["preparing", "actively_applying", "interviewing", "placed", "not_looking"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export type ProfileEdit = {
  headline?: string;
  bio?: string;
  institution?: string;
  degree?: string;
  specialization?: string;
  expectedGraduationYear?: number | null;
  placementStatus?: PlacementStatus;
};

export class ProfileEditError extends Error {
  constructor(message: string, readonly field: keyof ProfileEdit | null = null) { super(message); }
}

const TEXT_LIMITS: Record<"headline" | "bio" | "institution" | "degree" | "specialization", number> = {
  headline: 120, bio: 600, institution: 120, degree: 80, specialization: 120,
};
const LABEL: Record<keyof ProfileEdit, string> = {
  headline: "Headline", bio: "Bio", institution: "Institution", degree: "Degree", specialization: "Specialization",
  expectedGraduationYear: "Graduation year", placementStatus: "Placement status",
};

/** Accepts only known fields with sane values; throws ProfileEditError naming the field otherwise. */
export function validateProfileEdit(input: unknown): ProfileEdit {
  if (!input || typeof input !== "object") throw new ProfileEditError("Nothing to save.");
  const raw = input as Record<string, unknown>;
  const out: ProfileEdit = {};
  for (const key of Object.keys(TEXT_LIMITS) as (keyof typeof TEXT_LIMITS)[]) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "string") throw new ProfileEditError(`${LABEL[key]} must be text.`, key);
    const value = (raw[key] as string).trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    if (value.length > TEXT_LIMITS[key]) throw new ProfileEditError(`${LABEL[key]} can be at most ${TEXT_LIMITS[key]} characters.`, key);
    out[key] = value;
  }
  if (raw.expectedGraduationYear !== undefined) {
    const y = raw.expectedGraduationYear;
    if (y === null || y === "") out.expectedGraduationYear = null;
    else {
      const n = typeof y === "string" ? Number(y.trim()) : y;
      const thisYear = new Date().getFullYear();
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1990 || n > thisYear + 8) {
        throw new ProfileEditError(`Graduation year must be a year between 1990 and ${thisYear + 8}.`, "expectedGraduationYear");
      }
      out.expectedGraduationYear = n;
    }
  }
  if (raw.placementStatus !== undefined) {
    if (!PLACEMENT_STATUSES.includes(raw.placementStatus as PlacementStatus)) throw new ProfileEditError("Choose one of the listed placement statuses.", "placementStatus");
    out.placementStatus = raw.placementStatus as PlacementStatus;
  }
  return out;
}

export async function editProfileDetails(personId: string, input: unknown) {
  const edit = validateProfileEdit(input);
  const db = await getDb();
  let [row] = await db.select().from(personProfiles).where(eq(personProfiles.personId, personId)).limit(1);
  if (!row) {
    [row] = await db.insert(personProfiles).values({ id: `prof_${crypto.randomBytes(10).toString("hex")}`, personId }).returning();
  }
  const current = row as unknown as Record<string, unknown>;
  const changed = (Object.keys(edit) as (keyof ProfileEdit)[]).filter((k) => (current[k] ?? (k === "expectedGraduationYear" ? null : "")) !== edit[k]);
  if (!changed.length) return { changed: [] as string[], version: null as number | null, profile: row };

  const patch = Object.fromEntries(changed.map((k) => [k, edit[k]]));
  const [updated] = await db.update(personProfiles).set({ ...patch, updatedAt: new Date() }).where(eq(personProfiles.personId, personId)).returning();
  const snapshot = {
    headline: updated.headline, bio: updated.bio, institution: updated.institution, degree: updated.degree,
    specialization: updated.specialization, expectedGraduationYear: updated.expectedGraduationYear, placementStatus: updated.placementStatus,
    editedFields: changed,
  };
  const version = await CrossSourceFusionService.recordProfileVersion(
    personId, "profile_edited", `Edited ${changed.map((k) => LABEL[k].toLowerCase()).join(", ")}`, snapshot,
  );
  return { changed: changed as string[], version, profile: updated };
}
