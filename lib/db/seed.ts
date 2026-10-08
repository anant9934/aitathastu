import { eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type SeedDb = PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;

export async function seedDefaultEntities(db: SeedDb) {
  // 1. Seed Default Organization
  const existingOrg = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, "tathastu-core"))
    .limit(1);

  let defaultOrgId = "org_tathastu_default";
  if (existingOrg.length === 0) {
    await db.insert(schema.organizations).values({
      id: defaultOrgId,
      name: "AI Tathastu Network",
      slug: "tathastu-core",
      status: "active",
    });
  } else {
    defaultOrgId = existingOrg[0].id;
  }

  // 2. Seed Core Capabilities
  const defaultCapabilities = [
    { key: "profile.read.self", description: "Read own profile and Person 360 data" },
    { key: "profile.update.self", description: "Update own self-managed profile fields" },
    { key: "goal.manage.self", description: "Add, switch, or update active career/skill goals" },
    { key: "evidence.read.self", description: "Read own recorded evidence and provenance" },
    { key: "evidence.create.self", description: "Submit self-reported evidence items" },
    { key: "journey.read.self", description: "Read own journey event chronology" },
    { key: "action.update.self", description: "Start, dismiss, or restore next action recommendations" },
    { key: "ranking.configure", description: "Configure cohort rankings and dimensional weightings" },
    { key: "student.verify_skill", description: "Independently verify student evidence and skills" },
  ];

  for (const cap of defaultCapabilities) {
    const existing = await db
      .select()
      .from(schema.capabilities)
      .where(eq(schema.capabilities.key, cap.key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.capabilities).values({
        id: `cap_${cap.key.replace(/\./g, "_")}`,
        key: cap.key,
        description: cap.description,
      });
    }
  }

  // 3. Seed Roles
  const defaultRoles = [
    {
      id: "role_student",
      key: "student",
      name: "Student",
      description: "Learner navigating personal growth, evidence, goals, and next actions.",
      capabilities: [
        "profile.read.self",
        "profile.update.self",
        "goal.manage.self",
        "evidence.read.self",
        "evidence.create.self",
        "journey.read.self",
        "action.update.self",
      ],
    },
    {
      id: "role_faculty",
      key: "faculty",
      name: "Faculty / Academic Guide",
      description: "Academic mentor verifying student work and project demonstrations.",
      capabilities: [
        "profile.read.self",
        "evidence.read.self",
        "student.verify_skill",
      ],
    },
    {
      id: "role_coordinator",
      key: "coordinator",
      name: "Placement / Research Coordinator",
      description: "Institutional coordinator configuring cohort analytics and directions.",
      capabilities: [
        "profile.read.self",
        "ranking.configure",
      ],
    },
  ];

  for (const roleDef of defaultRoles) {
    const existingRole = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.key, roleDef.key))
      .limit(1);

    let roleId = roleDef.id;
    if (existingRole.length === 0) {
      await db.insert(schema.roles).values({
        id: roleDef.id,
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        organizationId: defaultOrgId,
      });
    } else {
      roleId = existingRole[0].id;
    }

    // Link capabilities to role
    for (const capKey of roleDef.capabilities) {
      const cap = await db
        .select()
        .from(schema.capabilities)
        .where(eq(schema.capabilities.key, capKey))
        .limit(1);

      if (cap.length > 0) {
        const link = await db
          .select()
          .from(schema.roleCapabilities)
          .where(
            eq(schema.roleCapabilities.roleId, roleId)
          );
        const alreadyLinked = link.some((l) => l.capabilityId === cap[0].id);

        if (!alreadyLinked) {
          await db.insert(schema.roleCapabilities).values({
            id: `rc_${roleId}_${cap[0].id}`,
            roleId: roleId,
            capabilityId: cap[0].id,
          });
        }
      }
    }
  }

  return { defaultOrgId };
}
