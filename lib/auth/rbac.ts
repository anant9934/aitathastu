import { eq, and } from "drizzle-orm";
import {
  getDb,
  organizationMemberships,
  membershipRoles,
  roles,
  roleCapabilities,
  capabilities,
} from "../db";

export type AuthContextOptions = {
  targetPersonId?: string;
  organizationId?: string;
};

export async function can(
  personId: string,
  capabilityKey: string,
  context?: AuthContextOptions
): Promise<boolean> {
  if (!personId || !capabilityKey) return false;

  // Handle self-scoped capabilities
  if (capabilityKey.endsWith(".self")) {
    if (context?.targetPersonId && context.targetPersonId !== personId) {
      // Cannot execute .self capability on a different person
      return false;
    }
  }

  const db = await getDb();

  // Query all capabilities assigned to this person through their active organization memberships and roles
  const userCapabilities = await db
    .select({
      capKey: capabilities.key,
      roleKey: roles.key,
      orgId: organizationMemberships.organizationId,
    })
    .from(organizationMemberships)
    .innerJoin(
      membershipRoles,
      eq(membershipRoles.membershipId, organizationMemberships.id)
    )
    .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
    .innerJoin(roleCapabilities, eq(roleCapabilities.roleId, roles.id))
    .innerJoin(capabilities, eq(capabilities.id, roleCapabilities.capabilityId))
    .where(
      and(
        eq(organizationMemberships.personId, personId),
        eq(organizationMemberships.status, "active")
      )
    );

  // If specific organization context is given, filter to memberships of that org
  const matching = userCapabilities.filter((row) => {
    if (context?.organizationId && row.orgId !== context.organizationId) {
      return false;
    }
    return row.capKey === capabilityKey;
  });

  return matching.length > 0;
}
