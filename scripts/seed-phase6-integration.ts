import { eq } from "drizzle-orm";
import { getDb, users, persons, organizations } from "../lib/db";
import {
  createIntegrationCredential,
  createIdentityLink,
} from "../lib/repositories/integration-repository";

export const ERIS_DEV_KEY = "eris_live_sec_key_tathastu_dev_2026";
export const INTERVIEW_DEV_KEY = "ai_interview_sec_key_tathastu_dev_2026";
export const STUDY_LPU_DEV_KEY = "study_lpu_sec_key_tathastu_dev_2026";
export const PADHO_CODE_DEV_KEY = "padho_code_sec_key_tathastu_dev_2026";
export const MENTORMAZE_DEV_KEY = "mentormaze_sec_key_tathastu_dev_2026";

async function main() {
  console.log("Seeding Phase C Connected Evidence Producers setup...");
  const db = await getDb();

  // 1. Get default organization
  const orgRows = await db.select().from(organizations).limit(1);
  if (orgRows.length === 0) {
    console.error("No organization found. Please run migrations first.");
    process.exit(1);
  }
  const org = orgRows[0];
  console.log(`Using organization: ${org.name} (${org.id})`);

  // 2. Create / ensure credentials
  await createIntegrationCredential({
    organizationId: org.id,
    producer: "eris",
    rawKey: ERIS_DEV_KEY,
    label: "ERIS Standardized Assessment Test Key",
  });
  console.log("✓ ERIS integration credential active");

  await createIntegrationCredential({
    organizationId: org.id,
    producer: "ai_interview",
    rawKey: INTERVIEW_DEV_KEY,
    label: "AI Interview Platform Test Key",
  });
  console.log("✓ AI Interview integration credential active");

  await createIntegrationCredential({
    organizationId: org.id,
    producer: "study_lpu",
    rawKey: STUDY_LPU_DEV_KEY,
    label: "Study LPU Academic Learning Test Key",
  });
  console.log("✓ Study LPU integration credential active");

  await createIntegrationCredential({
    organizationId: org.id,
    producer: "padho_code",
    rawKey: PADHO_CODE_DEV_KEY,
    label: "Padho Code Practice Test Key",
  });
  console.log("✓ Padho Code integration credential active");

  await createIntegrationCredential({
    organizationId: org.id,
    producer: "mentormaze",
    rawKey: MENTORMAZE_DEV_KEY,
    label: "MentorMaze Interview Test Key",
  });
  console.log("✓ MentorMaze integration credential active");

  // 3. Find Arjun
  const arjunRows = await db
    .select({ id: users.id, personId: persons.id })
    .from(users)
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, "arjun.student@example.com"))
    .limit(1);

  if (arjunRows.length > 0) {
    const arjun = arjunRows[0];
    await createIdentityLink({
      organizationId: org.id,
      producer: "eris",
      externalSubjectId: "eris_stu_arjun",
      personId: arjun.personId,
    });
    await createIdentityLink({
      organizationId: org.id,
      producer: "ai_interview",
      externalSubjectId: "ai_int_arjun",
      personId: arjun.personId,
    });
    await createIdentityLink({
      organizationId: org.id,
      producer: "study_lpu",
      externalSubjectId: "study_stu_arjun",
      personId: arjun.personId,
    });
    await createIdentityLink({
      organizationId: org.id,
      producer: "padho_code",
      externalSubjectId: "padho_stu_arjun",
      personId: arjun.personId,
    });
    await createIdentityLink({
      organizationId: org.id,
      producer: "mentormaze",
      externalSubjectId: "mm_stu_arjun",
      personId: arjun.personId,
    });
    console.log(`✓ Identity links created for Arjun (${arjun.personId})`);
  }

  // 4. Find Priya
  const priyaRows = await db
    .select({ id: users.id, personId: persons.id })
    .from(users)
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, "priya.verified@example.com"))
    .limit(1);

  if (priyaRows.length > 0) {
    const priya = priyaRows[0];
    await createIdentityLink({
      organizationId: org.id,
      producer: "eris",
      externalSubjectId: "eris_stu_priya",
      personId: priya.personId,
    });
    await createIdentityLink({
      organizationId: org.id,
      producer: "ai_interview",
      externalSubjectId: "ai_int_priya",
      personId: priya.personId,
    });
    console.log(`✓ Identity links created for Priya (${priya.personId}): eris_stu_priya, ai_int_priya`);
  }

  console.log("Phase 6 setup completed successfully.");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
