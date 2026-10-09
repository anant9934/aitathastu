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
} from "../lib/db/schema";
import { hashPassword } from "../lib/auth/password";

export async function seedV34BrowserStudent() {
  const db = await getDb();

  const email = "browser_student_v34@aitathastu.test";
  const password = "StudentPass123!";
  const passwordHash = await hashPassword(password);

  const userId = "usr_e2e_browser_student_v34";
  const personId = "prs_e2e_browser_student_v34";
  const orgId = "org_tathastu_default";
  const roleId = "role_student";

  // Create user
  await db
    .insert(users)
    .values({
      id: userId,
      email,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { passwordHash },
    });

  // Create person
  await db
    .insert(persons)
    .values({
      id: personId,
      primaryUserId: userId,
      displayName: "Ananya Browser",
    })
    .onConflictDoUpdate({
      target: persons.id,
      set: { displayName: "Ananya Browser" },
    });

  // Link profile
  await db
    .insert(personProfiles)
    .values({
      id: `prof_${personId}`,
      personId,
      headline: "AI/ML Undergraduate Student",
      education: "B.Tech Computer Science and Engineering",
      institution: "Lovely Professional University (LPU)",
      specialization: "Computer Science and Engineering",
      degree: "B.Tech",
      currentYear: "3rd Year",
      expectedGraduationYear: 2026,
    })
    .onConflictDoUpdate({
      target: personProfiles.personId,
      set: {
        headline: "AI/ML Undergraduate Student",
        education: "B.Tech Computer Science and Engineering",
        institution: "Lovely Professional University (LPU)",
        specialization: "Computer Science and Engineering",
        degree: "B.Tech",
        currentYear: "3rd Year",
        expectedGraduationYear: 2026,
      },
    });

  // Link organization membership
  const memId = `mem_${personId}`;
  await db
    .insert(organizationMemberships)
    .values({
      id: memId,
      personId,
      organizationId: orgId,
      status: "active",
    })
    .onConflictDoUpdate({
      target: organizationMemberships.id,
      set: { organizationId: orgId, status: "active" },
    });

  await db
    .insert(membershipRoles)
    .values({
      id: `mr_${memId}`,
      membershipId: memId,
      roleId: roleId,
    })
    .onConflictDoUpdate({
      target: membershipRoles.id,
      set: { roleId },
    });

  console.log(`✅ Seeded V3.4 Browser Student A: ${email} (${personId})`);

  // Student B for multi-tenant isolation testing
  const emailB = "browser_student_v34_b@aitathastu.test";
  const userIdB = "usr_e2e_browser_student_v34_b";
  const personIdB = "prs_e2e_browser_student_v34_b";

  await db
    .insert(users)
    .values({
      id: userIdB,
      email: emailB,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { passwordHash },
    });

  await db
    .insert(persons)
    .values({
      id: personIdB,
      primaryUserId: userIdB,
      displayName: "Rohan Sharma",
    })
    .onConflictDoUpdate({
      target: persons.id,
      set: { displayName: "Rohan Sharma" },
    });

  await db
    .insert(personProfiles)
    .values({
      id: `prof_${personIdB}`,
      personId: personIdB,
      headline: "Computer Vision Researcher",
      education: "M.Tech Robotics",
      institution: "Lovely Professional University (LPU)",
      specialization: "Robotics & Automation",
      degree: "M.Tech",
      currentYear: "1st Year",
      expectedGraduationYear: 2027,
    })
    .onConflictDoUpdate({
      target: personProfiles.personId,
      set: {
        headline: "Computer Vision Researcher",
        education: "M.Tech Robotics",
        institution: "Lovely Professional University (LPU)",
        specialization: "Robotics & Automation",
        degree: "M.Tech",
        currentYear: "1st Year",
        expectedGraduationYear: 2027,
      },
    });

  const memIdB = `mem_${personIdB}`;
  await db
    .insert(organizationMemberships)
    .values({
      id: memIdB,
      personId: personIdB,
      organizationId: orgId,
      status: "active",
    })
    .onConflictDoUpdate({
      target: organizationMemberships.id,
      set: { organizationId: orgId, status: "active" },
    });

  await db
    .insert(membershipRoles)
    .values({
      id: `mr_${memIdB}`,
      membershipId: memIdB,
      roleId: roleId,
    })
    .onConflictDoUpdate({
      target: membershipRoles.id,
      set: { roleId },
    });

  console.log(`✅ Seeded V3.4 Browser Student B: ${emailB} (${personIdB})`);

  return { email, password, personId, userId, emailB, personIdB };
}

if (process.argv[1]?.endsWith("seed-v3-4-browser-student.ts")) {
  seedV34BrowserStudent().catch(console.error);
}
