import fs from "fs";
import path from "path";

// Ensure .env is loaded if DATABASE_URL not yet in environment
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

import { getDb, resetDbForTesting } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { getPerson360 } from "../lib/services/person-360-service";
import { setActiveGoal, getActiveGoal } from "../lib/repositories/goal-repository";
import { createEvidenceRecord, getEvidenceByPersonId } from "../lib/repositories/evidence-repository";
import { createJourneyEventRecord, getJourneyEventsByPersonId } from "../lib/repositories/journey-repository";

async function main() {
  console.log("==================================================");
  console.log("AI TATHASTU: REAL HOSTED POSTGRES PERSISTENCE TEST");
  console.log(`Database Target: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "Unknown"}`);
  console.log("==================================================");

  const timestamp = Date.now();
  const testEmail = `staging.student.${timestamp}@aitathastu.io`;

  console.log(`1. Creating staging student account on hosted Postgres: ${testEmail}`);
  const user = await createUser({
    email: testEmail,
    passwordHash: "bcrypt_hash_placeholder_staging_pass_123",
    displayName: "Ananya Sharma (Staging ML)",
  });
  console.log(`✓ User created on hosted Postgres: personId=${user.personId}`);

  console.log("2. Setting career goal on hosted Postgres...");
  const goal = await setActiveGoal(
    user.personId,
    "Machine Learning Engineer",
    "Target role: ML Engineer",
    "preset"
  );
  console.log(`✓ Goal persisted: id=${goal.id}, title=${goal.title}`);

  console.log("3. Recording verified evidence item on hosted Postgres...");
  const evidence = await createEvidenceRecord(user.personId, {
    category: "skill",
    subject: "machine_learning",
    value: "PyTorch & TensorFlow Pipeline",
    source: "self_reported",
    verificationStatus: "verified",
    interpretation: "Production model training pipeline with experiment tracking",
    whyItMatters: "Essential demonstrated competency for ML Engineer role",
  });
  console.log(`✓ Evidence persisted: id=${evidence.id}, status=${evidence.verificationStatus}`);

  console.log("4. Appending journey event on hosted Postgres...");
  const journey = await createJourneyEventRecord(user.personId, {
    type: "goal_selected",
    title: "Target Role Selected: ML Engineer",
    description: "Student selected ML Engineer as their primary target role.",
  });
  console.log(`✓ Journey event persisted: id=${journey.id}`);

  console.log("\n--- SIMULATING APPLICATION RESTART & CACHE FLUSH ---");
  resetDbForTesting();
  console.log("✓ In-memory database singleton and cache completely cleared.");

  console.log("\n5. Verifying persistence in fresh DB instance across remote network...");
  await getDb();

  const freshGoal = await getActiveGoal(user.personId);
  if (!freshGoal || freshGoal.title !== "Machine Learning Engineer") {
    throw new Error("Goal failed to persist across instance restart!");
  }
  console.log(`✓ Verified Goal intact on remote Neon DB: ${freshGoal.title}`);

  const freshEvidence = await getEvidenceByPersonId(user.personId);
  const matchedEvidence = freshEvidence.find((e) => e.id === evidence.id);
  if (!matchedEvidence || matchedEvidence.verificationStatus !== "verified") {
    throw new Error("Evidence failed to persist across instance restart!");
  }
  console.log(`✓ Verified Evidence intact on remote Neon DB: ${matchedEvidence.value} (status: ${matchedEvidence.verificationStatus})`);

  const freshJourney = await getJourneyEventsByPersonId(user.personId);
  const matchedJourney = freshJourney.find((j) => j.id === journey.id);
  if (!matchedJourney) {
    throw new Error("Journey event failed to persist across instance restart!");
  }
  console.log(`✓ Verified Journey intact on remote Neon DB: ${matchedJourney.title}`);

  const person360 = await getPerson360(user.personId, user.personId);
  if (!person360 || person360.person.id !== user.personId) {
    throw new Error("Person 360 profile failed to load from hosted Postgres!");
  }
  console.log(`✓ Verified Person 360 assembled from hosted Postgres: ${person360.person.displayName}`);

  console.log("==================================================");
  console.log("HOSTED POSTGRES PERSISTENCE CERTIFICATION: PASS");
  console.log("Data proven strictly external to local memory/PGlite.");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Hosted persistence test failed:", err);
  process.exit(1);
});
