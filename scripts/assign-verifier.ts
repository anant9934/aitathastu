import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import {
  getDb,
  users,
  persons,
  roles,
  organizationMemberships,
  membershipRoles,
} from "../lib/db";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/assign-verifier.ts <user-email>");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`Assigning faculty/verifier role to: ${normalizedEmail}`);

  const db = await getDb();

  // Find user
  const userRows = await db
    .select({
      userId: users.id,
      email: users.email,
      personId: persons.id,
      displayName: persons.displayName,
    })
    .from(users)
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (userRows.length === 0) {
    console.error(`User with email "${normalizedEmail}" was not found.`);
    process.exit(1);
  }

  const user = userRows[0];

  // Find faculty role
  const facultyRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.key, "faculty"))
    .limit(1);

  if (facultyRoles.length === 0) {
    console.error("Faculty role was not found in database.");
    process.exit(1);
  }

  const facultyRole = facultyRoles[0];

  // Find active membership
  const memberships = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.personId, user.personId),
        eq(organizationMemberships.status, "active")
      )
    )
    .limit(1);

  if (memberships.length === 0) {
    console.error(`No active organization membership found for person ${user.personId}.`);
    process.exit(1);
  }

  const membership = memberships[0];

  // Check if role is already assigned
  const existingRoleLink = await db
    .select()
    .from(membershipRoles)
    .where(
      and(
        eq(membershipRoles.membershipId, membership.id),
        eq(membershipRoles.roleId, facultyRole.id)
      )
    );

  if (existingRoleLink.length > 0) {
    console.log(`✓ User ${user.displayName} (${user.email}) already has the faculty role.`);
    process.exit(0);
  }

  // Assign faculty role
  await db.insert(membershipRoles).values({
    id: `mr_fac_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    membershipId: membership.id,
    roleId: facultyRole.id,
  });

  console.log(`✓ Successfully assigned Faculty role to ${user.displayName} (${user.email}).`);
  console.log(`This user now possesses the 'student.verify_skill' capability for verification.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to assign role:", err);
  process.exit(1);
});
