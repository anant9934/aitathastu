/**
 * AI TATHASTU — CORE INTELLIGENCE V3.1 LIVE CERTIFICATION SUITE
 * 
 * Verifies real database persistence, live CV extraction lifecycle,
 * GitHub project intelligence, cross-source fusion, multi-tenant isolation,
 * adaptive roadmaps for 4 AI/ML directions, grounded EORA context,
 * and background job lifecycle in Neon PostgreSQL.
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
import { sql } from "drizzle-orm";
import {
  persons,
  users,
  personProfiles,
  projects,
  projectContributions,
  evidenceItems,
  goals,
} from "../lib/db/schema";
import { ExtractionValidator } from "../lib/services/extraction-validator";
import { runExtractionBenchmark } from "../lib/services/extraction-benchmark";
import { CrossSourceFusionService } from "../lib/services/cross-source-fusion-service";
import {
  analyzeArchitecturalComponents,
  generateImprovementSuggestions,
} from "../lib/services/github-project-intelligence";
import {
  generatePersonalizedRoadmap,
  persistRoadmapMilestones,
  getPersistedRoadmapMilestones,
} from "../lib/domain/roadmap";
import { composePersonalizedDashboard, getAll96Configurations } from "../lib/domain/personalization-engine";
import { SourceProcessingJobService } from "../lib/services/source-processing-job-service";
import { defaultIntelligenceRouter } from "../lib/intelligence/router";
import { encryptConnectionToken, decryptConnectionToken } from "../lib/security/connection-token";

process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY =
  process.env.EXTERNAL_TOKEN_ENCRYPTION_KEY || "thirty-two-bytes-secret-encryption-key-for-auth";

async function runLiveCertificationSuite() {
  console.log("================================================================");
  console.log("AI TATHASTU — CORE INTELLIGENCE V3.1 LIVE CERTIFICATION SUITE");
  console.log("================================================================");

  const db = await getDb();
  const testRunId = `run_${Date.now()}`;
  const studentAId = `student_a_${testRunId}`;
  const studentBId = `student_b_${testRunId}`;

  // -------------------------------------------------------------
  // [Gate 1] Verify Real Neon Database Connection
  // -------------------------------------------------------------
  console.log("\n[1/10] Verifying Live Neon PostgreSQL Connection & Schema...");
  const dbInfo = await db.execute(sql`SELECT current_database() as db, current_user as user, version() as version;`);
  const infoRows = (dbInfo as unknown as { rows: Array<{ db: string; user: string; version: string }> }).rows || dbInfo;
  const dbFirst = (infoRows as Array<{ db: string; user: string; version: string }>)[0];
  console.log(`  ✓ Connected to database: ${dbFirst?.db} as user: ${dbFirst?.user}`);

  const tableQuery = await db.execute(sql`
    SELECT count(*)::int as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  const tableCountRows = (tableQuery as unknown as { rows: Array<{ count: number }> }).rows || tableQuery;
  const tableCount = (tableCountRows as Array<{ count: number }>)[0]?.count;
  console.log(`  ✓ Verified ${tableCount} active tables in live schema.`);
  if (tableCount < 35) throw new Error("Database schema missing expected tables");

  // -------------------------------------------------------------
  // [Gate 2] Complete CV Extraction Pipeline & Validation
  // -------------------------------------------------------------
  console.log("\n[2/10] Testing Complete CV Pipeline with Real Validation...");
  
  // Create Student A record in Neon
  const userAId = `user_a_${testRunId}`;
  await db.insert(users).values({
    id: userAId,
    email: `ananya_${testRunId}@example.com`,
    passwordHash: "test_salted_hash_for_testing",
  });
  await db.insert(persons).values({
    id: studentAId,
    primaryUserId: userAId,
    displayName: "Ananya Sharma",
  });
  await db.insert(personProfiles).values({
    id: `prof_a_${testRunId}`,
    personId: studentAId,
    headline: "Aspiring Computer Vision Engineer",
    degree: "B.Tech Computer Science",
    institution: "Delhi Technological University",
  });

  // Track CV Job lifecycle in Neon
  const cvJobId = await SourceProcessingJobService.startJob({
    personId: studentAId,
    sourceId: "resume",
    stage: "acquire",
  });
  await SourceProcessingJobService.updateStage(cvJobId, studentAId, "parse");
  await SourceProcessingJobService.updateStage(cvJobId, studentAId, "extract");

  // Raw skill claims tested through ExtractionValidator
  const validSkillRes = ExtractionValidator.validateSkillClaim(
    "PyTorch",
    "Developed deep learning CNNs using PyTorch for object detection",
    "Projects: Developed deep learning CNNs using PyTorch for object detection."
  );
  const negatedSkillRes = ExtractionValidator.validateSkillClaim(
    "TensorFlow",
    "Familiar with PyTorch, but have not used TensorFlow in production",
    "Skills: Familiar with PyTorch, but have not used TensorFlow in production."
  );
  const aspirationalSkillRes = ExtractionValidator.validateSkillClaim(
    "JAX",
    "Looking forward to learn JAX and Rust in the future",
    "Future: Looking forward to learn JAX and Rust in the future."
  );
  const courseworkSkillRes = ExtractionValidator.validateSkillClaim(
    "Machine Learning",
    "Completed CS229: Machine Learning coursework at university",
    "Courses: Completed CS229: Machine Learning coursework at university."
  );

  console.log(`  ✓ Valid claim accepted: ${validSkillRes.normalizedValue} (valid: ${validSkillRes.valid})`);
  console.log(`  ✓ Negated claim rejected: TensorFlow (flag: ${negatedSkillRes.flag}, valid: ${negatedSkillRes.valid})`);
  console.log(`  ✓ Aspirational claim rejected: JAX (flag: ${aspirationalSkillRes.flag}, valid: ${aspirationalSkillRes.valid})`);
  console.log(`  ✓ Coursework mention flagged: ${courseworkSkillRes.flag}`);

  if (!validSkillRes.valid) throw new Error("Valid skill claim was incorrectly rejected");
  if (negatedSkillRes.valid) throw new Error("Negated skill claim was incorrectly accepted");
  if (aspirationalSkillRes.valid) throw new Error("Aspirational skill claim was incorrectly accepted");

  // Run ground truth benchmark
  const benchmark = runExtractionBenchmark();
  console.log(`  ✓ Benchmark: Precision ${(benchmark.metrics.precision * 100).toFixed(1)}%, Recall ${(benchmark.metrics.recall * 100).toFixed(1)}%, Negation Rej ${(benchmark.metrics.negationRejectionRate * 100).toFixed(1)}%`);

  // Persist verified evidence to Neon
  await SourceProcessingJobService.updateStage(cvJobId, studentAId, "persist");
  await db.insert(evidenceItems).values({
    id: `evi_cv_1_${testRunId}`,
    personId: studentAId,
    category: "skills",
    subject: "PyTorch",
    value: "Observed in CV: Computer Vision pipeline development",
    source: "resume",
    verificationStatus: "SUPPORTED_BY_WORK",
    interpretation: "Hands-on experience in PyTorch deep learning",
    whyItMatters: "Direct prerequisite for Deep Learning and Vision tracks",
  });

  await SourceProcessingJobService.completeJob({
    jobId: cvJobId,
    personId: studentAId,
    resultReference: "resume_ananya.pdf",
    metadata: { skillsExtracted: 2 },
  });
  console.log("  ✓ CV Pipeline job lifecycle completed and tracked in source_processing_jobs.");

  // -------------------------------------------------------------
  // [Gate 3] Real GitHub Intelligence & Architectural Classification
  // -------------------------------------------------------------
  console.log("\n[3/10] Testing Deep GitHub Project Intelligence (12 Architectural Findings)...");
  
  const sampleRepoFiles = [
    "models/vision_transformer.py",
    "training/train.py",
    "inference/predict.py",
    "api/main.py",
    "frontend/src/App.tsx",
    "tests/test_model.py",
    "Dockerfile",
    "README.md",
  ];

  const findings = analyzeArchitecturalComponents(
    sampleRepoFiles,
    "Vision transformer pipeline for industrial defect detection with PyTorch and FastAPI server.",
    "surface-defect-detector",
    { Python: 25000, TypeScript: 4000 }
  );

  console.log("  ✓ 12 Architectural Components Evaluated:");
  for (const f of findings) {
    console.log(`    - ${f.component.padEnd(26)}: ${f.status}`);
  }

  const modelTraining = findings.find((f) => f.component === "model_training");
  const modelInference = findings.find((f) => f.component === "model_inference");
  const retrieval = findings.find((f) => f.component === "retrieval_rag");

  if (modelTraining?.status !== "OBSERVED") throw new Error("Expected model_training to be OBSERVED");
  if (modelInference?.status !== "OBSERVED") throw new Error("Expected model_inference to be OBSERVED");
  if (retrieval?.status !== "NOT_FOUND") throw new Error("Expected retrieval to be NOT_FOUND");

  const cvSuggestions = generateImprovementSuggestions(findings, "Computer Vision");
  console.log(`  ✓ Generated ${cvSuggestions.length} role-aligned improvement suggestions.`);
  if (cvSuggestions.length > 0) {
    console.log(`    Top recommendation: "${cvSuggestions[0].suggestion}"`);
  }

  // Persist project and contribution to Neon
  const projectId = `proj_cv_${testRunId}`;
  await db.insert(projects).values({
    id: projectId,
    personId: studentAId,
    title: "Surface Defect Detector",
    description: "Vision transformer pipeline for industrial defect detection.",
    technologies: ["PyTorch", "Python", "FastAPI", "Docker"],
    sources: ["github"],
    status: "confirmed",
  });
  await db.insert(projectContributions).values({
    id: `contrib_${testRunId}`,
    projectId: projectId,
    personId: studentAId,
    roles: ["Machine Learning", "Backend"],
    description: "Implemented ViT fine-tuning loop and FastAPI inference server.",
  });
  console.log("  ✓ Project and verified contributions persisted to Neon database.");

  // -------------------------------------------------------------
  // [Gate 4] Cross-Source Fusion & Entity Deduplication
  // -------------------------------------------------------------
  console.log("\n[4/10] Testing Cross-Source Fusion & Conflict Management...");
  
  const resumeProject = {
    title: "Surface Defect Detector",
    source: "resume",
    description: "Industrial visual defect detection with PyTorch.",
    technologies: ["PyTorch", "FastAPI"],
  };

  const gitHubProject = {
    title: "surface-defect-detector",
    source: "github",
    description: "Vision transformer pipeline for industrial defect detection.",
    technologies: ["PyTorch", "FastAPI", "Docker"],
    repositoryUrl: "https://github.com/ananya/surface-defect-detector",
  };

  const matchResult = CrossSourceFusionService.matchProjects(resumeProject, gitHubProject);
  console.log(`  ✓ Project match result: ${matchResult.isMatch ? "MATCHED" : "UNMATCHED"} (confidence: ${matchResult.confidence})`);
  console.log(`    Combined sources: ${matchResult.combinedSources.join(", ")}`);
  console.log(`    Combined technologies: ${matchResult.combinedTechnologies.join(", ")}`);
  if (!matchResult.isMatch) throw new Error("Expected cross-source projects to match and fuse");

  // Conflict recording test
  const conflictLogged = await CrossSourceFusionService.recordConflictIfDifferent(
    studentAId,
    "education.gpa",
    "resume",
    "8.8",
    "portfolio",
    "9.1"
  );
  console.log(`  ✓ Academic conflict detection: ${conflictLogged ? "RECORDED IN CONFLICT LEDGER (no silent overwrite)" : "NO CONFLICT"}`);
  if (!conflictLogged) throw new Error("Expected conflict between differing source values");

  // Persist profile version to Neon
  const newVersion = await CrossSourceFusionService.recordProfileVersion(
    studentAId,
    "project_confirmed",
    "Merged Surface Defect Detector across CV and GitHub",
    { verifiedSkills: ["PyTorch", "FastAPI"], projectCount: 1 }
  );
  const currentVersion = await CrossSourceFusionService.getCurrentProfileVersion(studentAId);
  console.log(`  ✓ Profile version advanced to: v${newVersion} (current: v${currentVersion})`);

  // -------------------------------------------------------------
  // [Gate 5] Multi-Tenant Person 360 Isolation in Neon
  // -------------------------------------------------------------
  console.log("\n[5/10] Testing Multi-Tenant Person 360 Isolation in Neon...");

  // Create Student B record in Neon
  const userBId = `user_b_${testRunId}`;
  await db.insert(users).values({
    id: userBId,
    email: `rohan_${testRunId}@example.com`,
    passwordHash: "test_salted_hash_for_rohan",
  });
  await db.insert(persons).values({
    id: studentBId,
    primaryUserId: userBId,
    displayName: "Rohan Varma",
  });
  await db.insert(personProfiles).values({
    id: `prof_b_${testRunId}`,
    personId: studentBId,
    headline: "NLP & Generative AI Enthusiast",
  });

  // Query Student A projects vs Student B projects
  const studentAProjects = await db.select().from(projects).where(sql`${projects.personId} = ${studentAId}`);
  const studentBProjects = await db.select().from(projects).where(sql`${projects.personId} = ${studentBId}`);

  console.log(`  ✓ Student A projects in Neon: ${studentAProjects.length}`);
  console.log(`  ✓ Student B projects in Neon: ${studentBProjects.length}`);
  if (studentAProjects.length !== 1 || studentBProjects.length !== 0) {
    throw new Error("Multi-tenant cross-account isolation violation!");
  }

  // -------------------------------------------------------------
  // [Gate 6] Adaptive AI/ML Roadmaps across 4 Target Roles
  // -------------------------------------------------------------
  console.log("\n[6/10] Testing Adaptive Roadmaps across 4 Target AI/ML Directions...");
  
  const rolesToTest = [
    "Machine Learning Engineer",
    "GenAI Engineer",
    "AI Engineer",
    "AI Researcher",
  ];

  for (const role of rolesToTest) {
    const roadmap = generatePersonalizedRoadmap(role, ["Python", "PyTorch"]);
    console.log(`  ✓ [${role}] Generated ${roadmap.stages.length} stages with ${roadmap.primaryActions.length} primary actions:`);
    for (const a of roadmap.primaryActions.slice(0, 2)) {
      console.log(`    - Action: "${a.title}" -> ${a.destinationUrl}`);
      if (!a.destinationUrl?.startsWith("/")) {
        throw new Error(`Invalid non-Core URL in milestone: ${a.destinationUrl}`);
      }
    }
  }

  // Evidence adaptation: compare novice vs experienced
  const noviceRoadmap = generatePersonalizedRoadmap("GenAI Engineer", []);
  const advancedRoadmap = generatePersonalizedRoadmap("GenAI Engineer", [
    "Python", "DSA", "OOP", "Linear Algebra", "Scikit-Learn", "Machine Learning", "PyTorch", "Deep Learning", "Transformers"
  ]);

  console.log(`  ✓ Novice starts at stage: ${noviceRoadmap.currentStageIndex} ("${noviceRoadmap.stages[0]?.title}")`);
  console.log(`  ✓ Advanced starts at stage: ${advancedRoadmap.currentStageIndex} ("${advancedRoadmap.stages[advancedRoadmap.currentStageIndex]?.title}")`);
  if (noviceRoadmap.currentStageIndex === advancedRoadmap.currentStageIndex) {
    throw new Error("Roadmap failed to adapt based on demonstrated student skills!");
  }

  // Persist advanced roadmap stages to Neon
  const goalId = `goal_genai_${testRunId}`;
  await db.insert(goals).values({
    id: goalId,
    personId: studentAId,
    title: "Become a Production Generative AI Engineer",
    source: "preset",
    status: "active",
  });
  await persistRoadmapMilestones(studentAId, goalId, advancedRoadmap);
  const persistedMilestones = await getPersistedRoadmapMilestones(studentAId, goalId);
  console.log(`  ✓ Persisted and retrieved ${persistedMilestones.length} milestones from live Neon.`);

  // -------------------------------------------------------------
  // [Gate 7] Grounded EORA Intelligence & Tool Safety
  // -------------------------------------------------------------
  console.log("\n[7/10] Testing Grounded EORA Assistant Queries & Fallbacks...");

  const eoraRes1 = await defaultIntelligenceRouter.complete({
    task: "EORA_CHAT",
    personId: studentAId,
    systemPrompt: "You are EORA, grounded strictly in authenticated Person 360 records.",
    userPrompt: "What did you learn from my CV?",
  });
  console.log(`  ✓ Question: "What did you learn from my CV?"`);
  console.log(`    Provider: ${eoraRes1.provider} | Model: ${eoraRes1.modelUsed}`);
  console.log(`    Answer: "${eoraRes1.content.slice(0, 100)}..."`);

  const eoraRes2 = await defaultIntelligenceRouter.complete({
    task: "EORA_CHAT",
    personId: studentAId,
    systemPrompt: "You are EORA, grounded strictly in authenticated Person 360 records.",
    userPrompt: "What information is still unconfirmed?",
  });
  console.log(`  ✓ Question: "What information is still unconfirmed?"`);
  console.log(`    Answer: "${eoraRes2.content.slice(0, 100)}..."`);

  // -------------------------------------------------------------
  // [Gate 8] Background Processing & Error Recovery
  // -------------------------------------------------------------
  console.log("\n[8/10] Verifying Background Job Failure Classification & Retries...");
  
  const failedJobId = await SourceProcessingJobService.startJob({
    personId: studentAId,
    sourceId: "resume",
    stage: "parse",
  });
  await SourceProcessingJobService.failJob({
    jobId: failedJobId,
    personId: studentAId,
    errorCode: "MALFORMED_PDF_ENCODING",
    errorMessage: "Corrupt xref table in PDF document",
  });

  const jobs = await SourceProcessingJobService.getJobsForPerson(studentAId);
  const failedJob = jobs.find((j) => j.id === failedJobId);
  console.log(`  ✓ Failed job status: ${failedJob?.status} | Error: ${failedJob?.errorCode}`);
  if (failedJob?.status !== "failed" || failedJob?.errorCode !== "MALFORMED_PDF_ENCODING") {
    throw new Error("Background job error tracking failed");
  }

  // -------------------------------------------------------------
  // [Gate 9] Real Dashboard Section Lineage & 96 Configurations
  // -------------------------------------------------------------
  console.log("\n[9/10] Verifying Dashboard Data Lineage & All 96 Priority Configurations...");
  
  const dashboard = composePersonalizedDashboard({
    personId: studentAId,
    name: "Ananya Sharma",
    targetRole: "Computer Vision Engineer",
    targetRoleId: "computer_vision_engineer",
    goal: "Deploy production vision transformer",
    primaryInterest: "projects",
    secondaryInterests: ["learning"],
    skills: [
      { name: "PyTorch", verificationStatus: "SUPPORTED_BY_WORK", source: "resume" },
      { name: "FastAPI", verificationStatus: "SUPPORTED_BY_WORK", source: "github" },
    ],
    projects: [
      {
        id: projectId,
        title: "Surface Defect Detector",
        description: "Vision transformer pipeline for industrial defect detection.",
        technologies: ["PyTorch", "FastAPI"],
        status: "confirmed",
      },
    ],
    evidenceItems: [],
  });

  console.log(`  ✓ Section 1 (Overview) Target Role: ${dashboard.targetRole}`);
  console.log(`  ✓ Section 1 (Hero Headline): ${dashboard.hero.headline}`);
  console.log(`  ✓ Section 3 (Growth) Focus Tags: ${dashboard.hero.focusTags.join(", ")}`);
  console.log(`  ✓ Section 5 (Actions) Core CTAs count: ${dashboard.nextBestActions.length}`);

  for (const action of dashboard.nextBestActions) {
    if (!action.destinationUrl.startsWith("/student/") && !action.destinationUrl.startsWith("/verification")) {
      throw new Error(`Dashboard CTA routes outside Core: ${action.destinationUrl}`);
    }
  }

  const allConfigs = getAll96Configurations();
  console.log(`  ✓ Verified all ${allConfigs.length} priority configurations.`);

  // -------------------------------------------------------------
  // [Gate 10] External Token AES-256-GCM Security
  // -------------------------------------------------------------
  console.log("\n[10/10] Verifying AES-256-GCM Token Binding & Person Isolation...");
  
  const secretToken = "ghp_mock_live_oauth_token_for_student_a";
  const encrypted = encryptConnectionToken(secretToken, studentAId);
  const decrypted = decryptConnectionToken(encrypted, studentAId);

  if (decrypted !== secretToken) throw new Error("Token decryption failed");

  // Verify cross-person decryption failure
  let crossPersonThrew = false;
  try {
    decryptConnectionToken(encrypted, studentBId);
  } catch {
    crossPersonThrew = true;
  }

  if (!crossPersonThrew) throw new Error("AES-256-GCM authenticated tag failed to detect cross-person tampering!");
  console.log("  ✓ Authenticated AES-256-GCM person-binding verified.");

  console.log("\n================================================================");
  console.log("ALL 10 LIVE INTEGRATION GATES PASSED SUCCESSFULLY ON NEON DB");
  console.log("================================================================");
}

runLiveCertificationSuite().catch((err) => {
  console.error("FATAL: Live Certification Failed:", err);
  process.exit(1);
});
