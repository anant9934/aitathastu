import { eq, and } from "drizzle-orm";
import {
  getDb,
  users,
  persons,
  roles,
  organizationMemberships,
  membershipRoles,
} from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { hashPassword } from "../lib/auth/password";
import { createEvidenceRecord } from "../lib/repositories/evidence-repository";
import { setActiveGoal } from "../lib/repositories/goal-repository";
import { submitEvidenceForVerification, reviewVerificationRequest } from "../lib/services/verification-service";

async function main() {
  console.log("Seeding Phase 5 demonstration data...");
  const db = await getDb();

  // 1. Create Faculty User
  const facultyEmail = "faculty.shalini@example.com";
  const facUser = await db
    .select({ id: users.id, personId: persons.id })
    .from(users)
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, facultyEmail))
    .limit(1);

  let facPersonId = "";
  if (facUser.length === 0) {
    const facHash = await hashPassword("FacultyPass123!");
    const created = await createUser({
      email: facultyEmail,
      passwordHash: facHash,
      displayName: "Dr. Shalini Sen",
    });
    facPersonId = created.personId;
  } else {
    facPersonId = facUser[0].personId;
  }

  // Ensure faculty role assigned
  const facRoleRows = await db.select().from(roles).where(eq(roles.key, "faculty")).limit(1);
  const facRole = facRoleRows[0];
  const facMem = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.personId, facPersonId))
    .limit(1);

  const existingFacRole = await db
    .select()
    .from(membershipRoles)
    .where(and(eq(membershipRoles.membershipId, facMem[0].id), eq(membershipRoles.roleId, facRole.id)));

  if (existingFacRole.length === 0) {
    await db.insert(membershipRoles).values({
      id: `mr_fac_demo_${Date.now()}`,
      membershipId: facMem[0].id,
      roleId: facRole.id,
    });
  }
  console.log(`✓ Faculty account ready: ${facultyEmail}`);

  // 2. Create Student Arjun (State A: In progress, requesting verification)
  const studentEmail = "arjun.student@example.com";
  const stuUser = await db
    .select({ id: users.id, personId: persons.id })
    .from(users)
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, studentEmail))
    .limit(1);

  let arjunPersonId = "";
  if (stuUser.length === 0) {
    const arjunHash = await hashPassword("StudentPass123!");
    const created = await createUser({
      email: studentEmail,
      passwordHash: arjunHash,
      displayName: "Arjun Patel",
    });
    arjunPersonId = created.personId;
  } else {
    arjunPersonId = stuUser[0].personId;
  }

  await setActiveGoal(
    arjunPersonId,
    "ML Engineer",
    "Aiming to build deployable production machine learning models.",
    "preset"
  );


  // Seed Arjun's evidence items
  await createEvidenceRecord(arjunPersonId, {
    category: "skill",
    subject: "Python Programming",
    value: "Python, OOP, and data structure fundamentals",
    source: "resume_extracted",
    verificationStatus: "unverified",
    interpretation: "Extracted from resume. Self-reported coding exposure.",
    whyItMatters: "Foundational for ML pipeline implementation.",
  });

  await createEvidenceRecord(arjunPersonId, {
    category: "project",
    subject: "PyTorch Vision Classifier",
    value: "Trained ResNet-50 model on customized image dataset with 91.4% accuracy",
    source: "self_reported",
    verificationStatus: "self_reported",
    sourceReference: "https://github.com/arjun/resnet-vision-pipeline",
    interpretation: "Self-reported computer vision project.",
    whyItMatters: "Core evidence for Machine Learning and Project Build dimensions.",
  });

  await createEvidenceRecord(arjunPersonId, {
    category: "project",
    subject: "FastAPI Model Container",
    value: "Packaged ML prediction endpoint into Docker container with swagger docs",
    source: "self_reported",
    verificationStatus: "self_reported",
    sourceReference: "https://github.com/arjun/fastapi-model-service",
    interpretation: "Self-reported model serving prototype.",
    whyItMatters: "Direct evidence for the deployment dimension.",
  });

  console.log(`✓ Student Arjun ready: ${studentEmail}`);

  // 3. Create Student Priya (State B: Verified threshold satisfied for defensible readiness display)
  const priyaEmail = "priya.verified@example.com";
  const priyaUser = await db
    .select({ id: users.id, personId: persons.id })
    .from(users)
    .innerJoin(persons, eq(persons.primaryUserId, users.id))
    .where(eq(users.email, priyaEmail))
    .limit(1);

  let priyaPersonId = "";
  if (priyaUser.length === 0) {
    const priyaHash = await hashPassword("StudentPass123!");
    const created = await createUser({
      email: priyaEmail,
      passwordHash: priyaHash,
      displayName: "Priya Roy",
    });
    priyaPersonId = created.personId;
  } else {
    priyaPersonId = priyaUser[0].personId;
  }

  await setActiveGoal(
    priyaPersonId,
    "ML Engineer",
    "Specializing in end-to-end ML architectures and deployment.",
    "preset"
  );


  // Seed Priya's verified evidence items
  const priyaEv1 = await createEvidenceRecord(priyaPersonId, {
    category: "skill",
    subject: "Python Programming",
    value: "Advanced Python and data structures",
    source: "self_reported",
    verificationStatus: "self_reported",
    sourceReference: "https://github.com/priya/python-algorithms",
    interpretation: "Hands-on Python code library.",
    whyItMatters: "Programming dimension.",
  });
  const req1 = await submitEvidenceForVerification(priyaPersonId, priyaEv1.id, {
    supportingReference: "https://github.com/priya/python-algorithms",
  });
  await reviewVerificationRequest({
    verifierPersonId: facPersonId,
    requestId: req1.id,
    decision: "verified",
    reason: "Code review completed. Clean architecture, extensive unit test suite.",
    method: "code_review",
  });

  const priyaEv2 = await createEvidenceRecord(priyaPersonId, {
    category: "skill",
    subject: "Deep Learning with PyTorch",
    value: "Implemented transformer attention mechanism from scratch",
    source: "self_reported",
    verificationStatus: "self_reported",
    sourceReference: "https://github.com/priya/transformer-experiments",
    interpretation: "Deep learning transformer implementation.",
    whyItMatters: "Machine learning dimension.",
  });
  const req2 = await submitEvidenceForVerification(priyaPersonId, priyaEv2.id, {
    supportingReference: "https://github.com/priya/transformer-experiments",
  });
  await reviewVerificationRequest({
    verifierPersonId: facPersonId,
    requestId: req2.id,
    decision: "verified",
    reason: "Reviewed mathematical formulations and loss curves.",
    method: "code_review",
  });

  const priyaEv3 = await createEvidenceRecord(priyaPersonId, {
    category: "project",
    subject: "End-to-End NLP Sentiment Service",
    value: "Production pipeline trained on IMDb reviews with automated evaluation",
    source: "self_reported",
    verificationStatus: "self_reported",
    sourceReference: "https://github.com/priya/sentiment-nlp-prod",
    interpretation: "End-to-end NLP model and pipeline.",
    whyItMatters: "Project build dimension.",
  });
  const req3 = await submitEvidenceForVerification(priyaPersonId, priyaEv3.id, {
    supportingReference: "https://github.com/priya/sentiment-nlp-prod",
  });
  await reviewVerificationRequest({
    verifierPersonId: facPersonId,
    requestId: req3.id,
    decision: "verified",
    reason: "Demonstrated reproducible end-to-end ML benchmark results.",
    method: "faculty_evaluation",
  });

  const priyaEv4 = await createEvidenceRecord(priyaPersonId, {
    category: "project",
    subject: "Docker & Kubernetes Model Deployment",
    value: "Deployed FastAPI inference service with Docker and k8s manifest",
    source: "self_reported",
    verificationStatus: "self_reported",
    sourceReference: "https://github.com/priya/k8s-model-deployment",
    interpretation: "Containerized model deployment.",
    whyItMatters: "Deployment dimension.",
  });
  const req4 = await submitEvidenceForVerification(priyaPersonId, priyaEv4.id, {
    supportingReference: "https://github.com/priya/k8s-model-deployment",
  });
  await reviewVerificationRequest({
    verifierPersonId: facPersonId,
    requestId: req4.id,
    decision: "verified",
    reason: "Container health checks, latency tests, and endpoint verified.",
    method: "code_review",
  });

  console.log(`✓ Student Priya ready with verified threshold satisfied: ${priyaEmail}`);
  console.log("Phase 5 demonstration seed completed successfully.");
}

main().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
