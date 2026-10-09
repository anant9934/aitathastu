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
  organizations,
  organizationMemberships,
  roles,
  membershipRoles,
  goals,
  projects,
  evidenceItems,
} from "../lib/db/schema";
import { hashPassword } from "../lib/auth/password";
import { generatePersonalizedRoadmap, persistRoadmapMilestones } from "../lib/domain/roadmap";

async function main() {
  const db = await getDb();

  const email = "staging_student_v33@aitathastu.test";
  const password = "StudentPass123!";
  const passwordHash = await hashPassword(password);

  const userId = "usr_e2e_staging_student_v33";
  const personId = "prs_e2e_staging_student_v33";
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
      displayName: "Ananya Staging",
    })
    .onConflictDoUpdate({
      target: persons.id,
      set: { displayName: "Ananya Staging" },
    });

  // Link profile
  await db
    .insert(personProfiles)
    .values({
      id: `prof_${personId}`,
      personId,
      headline: "AI/ML Undergraduate Student",
      education: "B.Tech Computer Science",
      experience: "ML Research Intern",
    })
    .onConflictDoNothing();

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

  // Link active goal
  const goalId = `goal_${personId}`;
  await db
    .insert(goals)
    .values({
      id: goalId,
      personId,
      title: "Machine Learning Engineer",
      description: "Design and deploy production ML systems",
      source: "student_selected",
      status: "active",
    })
    .onConflictDoNothing();

  // Link confirmed project
  const projId = `proj_${personId}`;
  await db
    .insert(projects)
    .values({
      id: projId,
      personId,
      title: "Multimodal RAG Edge Agent",
      description: "Production cross-encoder RAG agent with ONNX runtime acceleration",
      sources: ["imported", "github"],
      status: "completed",
      technologies: ["PyTorch", "ONNX", "FastAPI", "Docker"],
      repositoryUrl: "https://github.com/anant9934/multimodal-rag",
    })
    .onConflictDoNothing();

  // Link confirmed evidence
  await db
    .insert(evidenceItems)
    .values({
      id: `ev_${personId}_pytorch`,
      personId,
      category: "skill",
      subject: "PyTorch",
      value: "Advanced",
      source: "imported",
      verificationStatus: "unverified",
      sourceReference: "resume:sha256:verified_staging",
      interpretation: "Deep learning framework used across multimodal models.",
      whyItMatters: "Essential for training and fine-tuning neural architectures.",
    })
    .onConflictDoNothing();

  // Persist roadmap
  const roadmap = generatePersonalizedRoadmap("Machine Learning Engineer", ["PyTorch", "Python"]);
  await persistRoadmapMilestones(personId, goalId, roadmap);

  console.log("✅ Seeded staging student account successfully:");
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Person ID: ${personId}`);
}

main().catch(console.error);
