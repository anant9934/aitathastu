import { eq } from "drizzle-orm";
import { getDb, persons, personProfiles, userPreferences } from "../db";

export async function getPersonById(personId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function getPersonProfile(personId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(personProfiles)
    .where(eq(personProfiles.personId, personId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function updatePersonProfileData(
  personId: string,
  data: {
    displayName?: string;
    education?: string;
    experience?: string;
    headline?: string;
    bio?: string;
    degree?: string;
    specialization?: string;
    institution?: string;
    currentYear?: string;
    semester?: string;
    expectedGraduationYear?: number | null;
    location?: string;
    placementStatus?: string;
    internshipStatus?: string;
  }
) {
  const db = await getDb();
  const now = new Date();

  if (data.displayName !== undefined) {
    await db
      .update(persons)
      .set({
        displayName: data.displayName.trim(),
        updatedAt: now,
      })
      .where(eq(persons.id, personId));
  }

  const profileUpdates: {
    updatedAt: Date;
    education?: string;
    experience?: string;
    headline?: string;
    bio?: string;
    degree?: string;
    specialization?: string;
    institution?: string;
    currentYear?: string;
    semester?: string;
    expectedGraduationYear?: number | null;
    location?: string;
    placementStatus?: string;
    internshipStatus?: string;
  } = { updatedAt: now };
  if (data.education !== undefined) profileUpdates.education = data.education.trim();
  if (data.experience !== undefined) profileUpdates.experience = data.experience.trim();
  if (data.headline !== undefined) profileUpdates.headline = data.headline.trim();
  if (data.bio !== undefined) profileUpdates.bio = data.bio.trim();
  if (data.degree !== undefined) profileUpdates.degree = data.degree.trim();
  if (data.specialization !== undefined) profileUpdates.specialization = data.specialization.trim();
  if (data.institution !== undefined) profileUpdates.institution = data.institution.trim();
  if (data.currentYear !== undefined) profileUpdates.currentYear = data.currentYear.trim();
  if (data.semester !== undefined) profileUpdates.semester = data.semester.trim();
  if (data.expectedGraduationYear !== undefined) profileUpdates.expectedGraduationYear = data.expectedGraduationYear;
  if (data.location !== undefined) profileUpdates.location = data.location.trim();
  if (data.placementStatus !== undefined) profileUpdates.placementStatus = data.placementStatus.trim();
  if (data.internshipStatus !== undefined) profileUpdates.internshipStatus = data.internshipStatus.trim();

  await db
    .update(personProfiles)
    .set(profileUpdates)
    .where(eq(personProfiles.personId, personId));

  return { success: true };
}

export async function getUserPreferences(personId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.personId, personId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function updateUserPreferences(
  personId: string,
  prefs: {
    reducedGuidance?: boolean;
    eoraDismissed?: boolean;
    primaryPriority?: string;
    secondaryPriorities?: string[];
    metadata?: Record<string, unknown>;
  }
) {
  const db = await getDb();
  const existing = await getUserPreferences(personId);

  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (prefs.reducedGuidance !== undefined) updates.reducedGuidance = prefs.reducedGuidance;
    if (prefs.eoraDismissed !== undefined) updates.eoraDismissed = prefs.eoraDismissed;
    if (prefs.primaryPriority !== undefined) updates.primaryPriority = prefs.primaryPriority;
    if (prefs.secondaryPriorities !== undefined) updates.secondaryPriorities = prefs.secondaryPriorities;
    if (prefs.metadata !== undefined) {
      updates.metadata = { ...((existing.metadata as Record<string, unknown>) || {}), ...prefs.metadata };
    }

    await db
      .update(userPreferences)
      .set(updates)
      .where(eq(userPreferences.personId, personId));
  } else {
    await db
      .insert(userPreferences)
      .values({
        id: crypto.randomUUID(),
        personId,
        reducedGuidance: prefs.reducedGuidance ?? false,
        eoraDismissed: prefs.eoraDismissed ?? false,
        primaryPriority: prefs.primaryPriority || null,
        secondaryPriorities: prefs.secondaryPriorities || [],
        metadata: prefs.metadata || {},
        preferenceSource: "user_selected",
        updatedAt: new Date(),
      });
  }

  return { success: true };
}
