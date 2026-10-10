import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  getDb,
  users,
  persons,
  personProfiles,
  userPreferences,
  organizations,
  roles,
  organizationMemberships,
  membershipRoles,
  journeyEvents,
} from "../db";

export type CreateUserParams = {
  email: string;
  passwordHash: string;
  displayName: string;
};

export async function createUser({ email, passwordHash, displayName }: CreateUserParams) {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = displayName.trim() || "Student";

  const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const personId = `person_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const profileId = `prof_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const prefId = `pref_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const membershipId = `mem_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const memRoleId = `mr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Find default organization
  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "tathastu-core"))
    .limit(1);

  const defaultOrgId = orgs.length > 0 ? orgs[0].id : "org_tathastu_default";

  // Find student role
  const studentRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.key, "student"))
    .limit(1);

  const studentRoleId = studentRoles.length > 0 ? studentRoles[0].id : "role_student";

  // Insert user
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    passwordHash,
  });

  // Insert person
  await db.insert(persons).values({
    id: personId,
    primaryUserId: userId,
    displayName: trimmedName,
  });

  // Insert profile
  await db.insert(personProfiles).values({
    id: profileId,
    personId,
    education: "",
    experience: "",
    headline: "",
  });

  // Insert preferences
  await db.insert(userPreferences).values({
    id: prefId,
    personId,
    reducedGuidance: false,
    eoraDismissed: false,
  });

  // Insert default organization membership
  await db.insert(organizationMemberships).values({
    id: membershipId,
    personId,
    organizationId: defaultOrgId,
    status: "active",
  });

  // Assign student role to membership
  await db.insert(membershipRoles).values({
    id: memRoleId,
    membershipId,
    roleId: studentRoleId,
  });

  // Record initial account_created journey event
  await db.insert(journeyEvents).values({
    id: `je_acc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    personId,
    type: "account_created",
    title: "Account created",
    description: "Welcome to AI Tathastu. Your journey and progress will persist with your account.",
    timestamp: new Date(),
  });

  return {
    userId,
    personId,
    email: normalizedEmail,
    displayName: trimmedName,
  };
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
      personId: persons.id,
      displayName: persons.displayName,
    })
    .from(users)
    .leftJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function findUserById(id: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      personId: persons.id,
      displayName: persons.displayName,
    })
    .from(users)
    .leftJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.id, id))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function updateUserCredentials(
  userId: string,
  params: { email?: string; passwordHash?: string; displayName?: string }
): Promise<void> {
  const db = await getDb();
  if (params.email || params.passwordHash) {
    const userUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (params.email) userUpdates.email = params.email.trim().toLowerCase();
    if (params.passwordHash) userUpdates.passwordHash = params.passwordHash;
    await db.update(users).set(userUpdates).where(eq(users.id, userId));
  }
  if (params.displayName) {
    await db
      .update(persons)
      .set({ displayName: params.displayName.trim(), updatedAt: new Date() })
      .where(eq(persons.primaryUserId, userId));
  }
}

