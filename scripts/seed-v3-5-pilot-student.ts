/**
 * AI TATHASTU — V3.5 PILOT STAGING SEED & ISOLATION UTILITY
 *
 * Provisions controlled, synthetic test students for Gate 3 staging isolation
 * and Gate 4 browser pilot certification.
 * Features safe teardown to prevent test data persistence in production scopes.
 */

import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL && fs.existsSync(path.join(process.cwd(), ".env"))) {
  const envContent = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val.trim();
      }
    }
  }
}

import { getDb } from "../lib/db";
import {
  users,
  persons,
  personProfiles,
  organizationMemberships,
  membershipRoles,
  goals,
  projects,
  evidenceItems,
  externalConnections,
  sourceSnapshots,
} from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth/password";

export const PILOT_STUDENT_A = {
  email: "pilot_student_v35@aitathastu.test",
  password: "StudentPass123!",
  userId: "usr_pilot_student_v35",
  personId: "prs_pilot_student_v35",
  displayName: "Aarav Pilot",
};

export const PILOT_STUDENT_B = {
  email: "pilot_student_v35_b@aitathastu.test",
  password: "StudentPass123!",
  userId: "usr_pilot_student_v35_b",
  personId: "prs_pilot_student_v35_b",
  displayName: "Bhavna Pilot",
};

export async function seedV35PilotStudents() {
  const db = await getDb();
  const passwordHash = await hashPassword(PILOT_STUDENT_A.password);
  const orgId = "org_tathastu_default";
  const roleId = "role_student";

  // Clean prior artifacts
  await cleanupV35PilotStudents();

  // 1. Seed Student A
  await db
    .insert(users)
    .values({
      id: PILOT_STUDENT_A.userId,
      email: PILOT_STUDENT_A.email,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { passwordHash },
    });

  await db
    .insert(persons)
    .values({
      id: PILOT_STUDENT_A.personId,
      primaryUserId: PILOT_STUDENT_A.userId,
      displayName: PILOT_STUDENT_A.displayName,
    })
    .onConflictDoUpdate({
      target: persons.id,
      set: { displayName: PILOT_STUDENT_A.displayName },
    });

  await db
    .insert(personProfiles)
    .values({
      id: `prof_${PILOT_STUDENT_A.personId}`,
      personId: PILOT_STUDENT_A.personId,
      headline: "AI/ML Undergraduate Researcher | Computer Science",
      education: "B.Tech Computer Science and Engineering",
      institution: "Indian Institute of Technology (IIT)",
      specialization: "Artificial Intelligence and Machine Learning",
      degree: "B.Tech",
      currentYear: "3rd Year",
      expectedGraduationYear: 2026,
      location: "Bengaluru, India",
    })
    .onConflictDoUpdate({
      target: personProfiles.personId,
      set: {
        headline: "AI/ML Undergraduate Researcher | Computer Science",
        education: "B.Tech Computer Science and Engineering",
        institution: "Indian Institute of Technology (IIT)",
      },
    });

  await db
    .insert(organizationMemberships)
    .values({
      id: "mem_pilot_student_v35",
      organizationId: orgId,
      personId: PILOT_STUDENT_A.personId,
      status: "active",
    })
    .onConflictDoNothing();

  await db
    .insert(membershipRoles)
    .values({
      id: "mr_pilot_student_v35",
      membershipId: "mem_pilot_student_v35",
      roleId,
    })
    .onConflictDoNothing();

  // 2. Seed Student B (for multi-tenant cross-user isolation verification)
  await db
    .insert(users)
    .values({
      id: PILOT_STUDENT_B.userId,
      email: PILOT_STUDENT_B.email,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { passwordHash },
    });

  await db
    .insert(persons)
    .values({
      id: PILOT_STUDENT_B.personId,
      primaryUserId: PILOT_STUDENT_B.userId,
      displayName: PILOT_STUDENT_B.displayName,
    })
    .onConflictDoUpdate({
      target: persons.id,
      set: { displayName: PILOT_STUDENT_B.displayName },
    });

  await db
    .insert(personProfiles)
    .values({
      id: `prof_${PILOT_STUDENT_B.personId}`,
      personId: PILOT_STUDENT_B.personId,
      headline: "MLOps Engineer & Distributed Systems Lead",
      education: "M.S. in Machine Learning Systems",
      institution: "BITS Pilani",
      specialization: "MLOps and Distributed Computing",
      degree: "M.S.",
      currentYear: "2nd Year",
      expectedGraduationYear: 2025,
      location: "Pune, India",
    })
    .onConflictDoUpdate({
      target: personProfiles.personId,
      set: {
        headline: "MLOps Engineer & Distributed Systems Lead",
        education: "M.S. in Machine Learning Systems",
        institution: "BITS Pilani",
      },
    });

  await db
    .insert(organizationMemberships)
    .values({
      id: "mem_pilot_student_v35_b",
      organizationId: orgId,
      personId: PILOT_STUDENT_B.personId,
      status: "active",
    })
    .onConflictDoNothing();

  await db
    .insert(membershipRoles)
    .values({
      id: "mr_pilot_student_v35_b",
      membershipId: "mem_pilot_student_v35_b",
      roleId,
    })
    .onConflictDoNothing();

  console.log("✓ Seeded isolated V3.5 Pilot Students: A and B with clean tenant scoping.");
}

export async function cleanupV35PilotStudents() {
  const db = await getDb();
  const personIds = [PILOT_STUDENT_A.personId, PILOT_STUDENT_B.personId];
  const userIds = [PILOT_STUDENT_A.userId, PILOT_STUDENT_B.userId];

  // Clean evidence, projects, goals, connections
  for (const pid of personIds) {
    try {
      await db.delete(membershipRoles).where(eq(membershipRoles.membershipId, `mem_${pid.replace("prs_", "")}`));
      await db.delete(organizationMemberships).where(eq(organizationMemberships.personId, pid));
      await db.delete(evidenceItems).where(eq(evidenceItems.personId, pid));
      await db.delete(projects).where(eq(projects.personId, pid));
      await db.delete(goals).where(eq(goals.personId, pid));
      await db.delete(externalConnections).where(eq(externalConnections.personId, pid));
      await db.delete(sourceSnapshots).where(eq(sourceSnapshots.personId, pid));
      await db.delete(personProfiles).where(eq(personProfiles.personId, pid));
      await db.delete(persons).where(eq(persons.id, pid));
    } catch {
      // non-fatal if table empty
    }
  }

  for (const uid of userIds) {
    try {
      await db.delete(users).where(eq(users.id, uid));
    } catch {
      // non-fatal
    }
  }

  console.log("✓ Cleaned up V3.5 Pilot test student records from database.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedV35PilotStudents()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to seed V3.5 pilot students:", err);
      process.exit(1);
    });
}
