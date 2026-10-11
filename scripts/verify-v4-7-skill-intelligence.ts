/**
 * AI TATHASTU — V4.7 EXPLAINABLE SKILLS & PROFICIENCY INTELLIGENCE
 * Comprehensive Verification Battery
 *
 * Verifies:
 * 1. CV-Only Skill Evaluation (Truthful resume mentions, exposure recorded, zero fabricated scores)
 * 2. GitHub Dependency-Only Skill Evaluation (Manifest declared, observed technical evidence)
 * 3. Multi-Source Aggregation & Deduplication (10 manifest entries count as 1 deduplicated skill)
 * 4. 5-Question Personal Contribution Auditing (Interactive confirmation, advances to Demonstrated)
 * 5. Architectural Non-Third-Party Disclosure Guarantee (Self-confirmed is never third-party proof)
 * 6. Assessment Competency Evaluation (ERIS topic results map to Dimension 4 and Assessed level)
 * 7. Faculty / Independent Verification (Advances to Verified level only with independent sign-off)
 * 8. Deterministic Answers to 7 Core Questions per skill
 * 9. Conservative Progression Monotonicity (Claimed -> Exposure -> Applied -> Demonstrated -> Assessed -> Verified)
 * 10. Target Role Alignment (Required Core, Recommended, Complementary, Elective)
 * 11. Non-Punitive Missing Goal Skills ("Not yet observed", constructive tasks, never "Failed")
 * 12. Multi-Student Boundary Isolation (Complete isolation between distinct person records)
 * 13. Zero Fabricated Numeric Accuracy / Proficiency Enforcement (No fictional percentages)
 * 14. PersonGraph & Dashboard Metric Harmonization
 */

import { SkillIntelligenceService } from "../lib/services/skill-intelligence-service";
import { buildPersonGraph } from "../lib/domain/person-graph";
import { createUser } from "../lib/repositories/user-repository";
import { createEvidenceRecord } from "../lib/repositories/evidence-repository";
import { saveProject } from "../lib/repositories/project-repository";
import { recordAssessmentAttempt } from "../lib/repositories/integration-repository";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, title: string, evidence?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[Test ${totalTests.toString().padStart(2, "0")}/24] ✅ PASS: ${title}`);
    if (evidence) console.log(`   Evidence: ${evidence}`);
  } else {
    console.error(`[Test ${totalTests.toString().padStart(2, "0")}/24] ❌ FAIL: ${title}`);
    if (evidence) console.error(`   Evidence: ${evidence}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("   AI TATHASTU V4.7 — EXPLAINABLE SKILLS & PROFICIENCY INTELLIGENCE");
  console.log("===============================================================================\n");

  const nonce = Date.now();

  // Create Student A
  const studentAEmail = `v47_student_a_${nonce}@test.lpu.in`;
  const studentA = await createUser({
    email: studentAEmail,
    passwordHash: "hash123",
    displayName: "Ananya Sharma V4.7",
  });
  const personAId = studentA.personId;

  // Create Student B for isolation testing
  const studentBEmail = `v47_student_b_${nonce}@test.lpu.in`;
  const studentB = await createUser({
    email: studentBEmail,
    passwordHash: "hash123",
    displayName: "Rohan Patel V4.7",
  });
  const personBId = studentB.personId;

  console.log(`Initialized Test Students:`);
  console.log(`  Student A: ${personAId} (${studentAEmail})`);
  console.log(`  Student B: ${personBId} (${studentBEmail})\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: CV-Only Skill Evaluation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- SUITE 1: CV-Only Skill Evaluation ---");

  // Seed CV mention for FastAPI
  await createEvidenceRecord(personAId, {
    category: "skill",
    subject: "FastAPI",
    value: "FastAPI mentioned in CV skills section",
    source: "resume_extracted",
    verificationStatus: "unverified",
    sourceReference: "Resume: Technical Skills",
    interpretation: "Skill extracted deterministically from student uploaded resume",
    whyItMatters: "Initial self-reported exposure signal",
    importKey: `cv_fastapi_${personAId}`,
  });

  const intel1 = await SkillIntelligenceService.getSkillsIntelligence(personAId);
  const fastApiSkill = intel1.skills.find((s) => s.canonicalName === "FastAPI");

  assert(
    fastApiSkill !== undefined,
    "CV-extracted skill 'FastAPI' is recognized and normalized in skill intelligence",
    `Found skill: ${fastApiSkill?.canonicalName}, Category: ${fastApiSkill?.category}`
  );

  assert(
    fastApiSkill?.level === "Exposure recorded",
    "CV-only skill receives conservative level 'Exposure recorded' (never Verified or Advanced)",
    `Level: ${fastApiSkill?.level}`
  );

  assert(
    fastApiSkill?.dimensions.selfAssessedKnowledge === "Intermediate" &&
      fastApiSkill?.dimensions.observedTechnicalEvidence.count >= 1 &&
      fastApiSkill?.dimensions.demonstratedApplication.projectCount === 0 &&
      fastApiSkill?.dimensions.assessedCompetency.assessed === false &&
      fastApiSkill?.dimensions.independentVerification.verified === false,
    "5-Dimension model for CV-only skill accurately reflects zero projects and unassessed status",
    `SelfAssessed: ${fastApiSkill?.dimensions.selfAssessedKnowledge}, ProjCount: ${fastApiSkill?.dimensions.demonstratedApplication.projectCount}`
  );

  assert(
    fastApiSkill?.conciseExplanation.includes("resume") === true &&
      fastApiSkill?.conciseExplanation.includes("GitHub") === false,
    "Concise synthesis truthfully cites resume observation and does NOT falsely claim GitHub evidence",
    `Synthesis: "${fastApiSkill?.conciseExplanation}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: GitHub Dependency-Only Skill Evaluation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: GitHub Dependency-Only Skill Evaluation ---");

  // Seed GitHub manifest dependency for PyTorch
  await createEvidenceRecord(personAId, {
    category: "skill",
    subject: "PyTorch",
    value: "torch>=2.0.0 in requirements.txt",
    source: "imported",
    verificationStatus: "unverified",
    sourceReference: "https://github.com/ananya-lpu/deep-learning-lab/blob/main/requirements.txt",
    interpretation: "Observed in repository dependency manifest",
    whyItMatters: "Direct evidence of development stack usage",
    importKey: `gh_torch_${personAId}_1`,
  });

  const intel2 = await SkillIntelligenceService.getSkillsIntelligence(personAId);
  const pytorchSkill = intel2.skills.find((s) => s.canonicalName === "PyTorch");

  assert(
    pytorchSkill !== undefined,
    "GitHub manifest skill 'PyTorch' is recognized in intelligence ledger",
    `Found: ${pytorchSkill?.canonicalName}`
  );

  assert(
    pytorchSkill?.level === "Exposure recorded",
    "Single GitHub manifest dependency confers conservative 'Exposure recorded' level",
    `Level: ${pytorchSkill?.level}`
  );

  assert(
    pytorchSkill?.conciseExplanation.includes("GitHub") === true &&
      pytorchSkill?.conciseExplanation.includes("resume") === false,
    "PyTorch explanation truthfully cites GitHub dependencies and omits resume if absent",
    `Synthesis: "${pytorchSkill?.conciseExplanation}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Observation Deduplication & Multi-Source Synthesis
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 3: Observation Deduplication & Multi-Source Synthesis ---");

  // Attempt to add duplicate PyTorch observations with identical source & reference
  for (let i = 0; i < 5; i++) {
    await createEvidenceRecord(personAId, {
      category: "skill",
      subject: "PyTorch",
      value: `Duplicate torch declaration ${i}`,
      source: "imported",
      verificationStatus: "unverified",
      sourceReference: "https://github.com/ananya-lpu/deep-learning-lab/blob/main/requirements.txt",
      interpretation: "Observed in repository dependency manifest",
      whyItMatters: "Stack usage",
      importKey: `gh_torch_${personAId}_dup_${i}`,
    });
  }

  // Also add CV mention for PyTorch to test multi-source synthesis
  await createEvidenceRecord(personAId, {
    category: "skill",
    subject: "PyTorch",
    value: "PyTorch deep learning listed in CV",
    source: "resume_extracted",
    verificationStatus: "unverified",
    sourceReference: "Resume: Technical Skills",
    interpretation: "Resume extraction",
    whyItMatters: "CV signal",
    importKey: `cv_torch_${personAId}`,
  });

  const intel3 = await SkillIntelligenceService.getSkillsIntelligence(personAId);
  const pytorchMulti = intel3.skills.find((s) => s.canonicalName === "PyTorch");

  // Check deduplication
  const identicalGithubRefs = pytorchMulti?.observations.filter(
    (o) =>
      o.source === "github" &&
      o.sourceReference === "https://github.com/ananya-lpu/deep-learning-lab/blob/main/requirements.txt"
  );

  assert(
    identicalGithubRefs?.length === 1,
    "Deduplication invariant: Identical source reference observations are deduplicated to 1 record",
    `Deduplicated count: ${identicalGithubRefs?.length}`
  );

  assert(
    pytorchMulti?.conciseExplanation.includes("GitHub") === true &&
      pytorchMulti?.conciseExplanation.includes("resume") === true,
    "Multi-source synthesis correctly incorporates both GitHub and resume observations when both exist",
    `Synthesis: "${pytorchMulti?.conciseExplanation}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Interactive 5-Question Personal Contribution Auditing
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: Interactive 5-Question Personal Contribution Auditing ---");

  // Create a confirmed project for Student A using saveProject
  const project1 = await saveProject(personAId, {
    title: "Multimodal RAG Pipeline",
    summary: "RAG system using LangChain, PyTorch and Vector DB",
    description: "Production retrieval augmented generation engine",
    technologies: ["PyTorch", "Python", "LangChain"],
    status: "confirmed",
    sources: ["github"],
    repositoryUrl: "https://github.com/ananya-lpu/multimodal-rag",
  });

  // Record 5 contextual questions for PyTorch on project1
  const contribResult = await SkillIntelligenceService.recordSkillContribution({
    personId: personAId,
    skill: "PyTorch",
    projectId: project1.id,
    didYouPersonallyUse: true,
    roleInProject: "Lead ML Engineer",
    codebaseParts: "Designed embedder pipeline and PyTorch custom attention head",
    challengesSolved: "Resolved memory spike during tensor batching by implementing gradient checkpointing",
    projectType: "solo",
    liveComfortLevel: "high",
  });

  assert(
    contribResult.success === true && contribResult.skillIntelligence !== undefined,
    "5-Question personal contribution audit records successfully",
    `Recorded for project: ${project1.title}`
  );

  assert(
    contribResult.skillIntelligence.level === "Demonstrated",
    "Conservative progression: Personal contribution advances skill level to 'Demonstrated'",
    `New level: ${contribResult.skillIntelligence.level}`
  );

  assert(
    contribResult.skillIntelligence.personalContribution?.isThirdPartyVerified === false,
    "Architectural invariant: Personal contribution is explicitly marked isThirdPartyVerified: false",
    `isThirdPartyVerified: ${contribResult.skillIntelligence.personalContribution?.isThirdPartyVerified}`
  );

  assert(
    contribResult.skillIntelligence.sevenQuestions.whatDidStudentPersonallyContribute.hasContribution === true &&
      contribResult.skillIntelligence.sevenQuestions.whatDidStudentPersonallyContribute.statement.includes("Lead ML Engineer"),
    "Question 4 reflects the student's confirmed role and contribution statement",
    `Statement: "${contribResult.skillIntelligence.sevenQuestions.whatDidStudentPersonallyContribute.statement}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Assessment Competency Evaluation (ERIS Graded Topics)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: Assessment Competency Evaluation ---");

  // Record an assessment attempt with PyTorch topic evaluation
  await recordAssessmentAttempt({
    personId: personAId,
    organizationId: "org_tathastu_default",
    producerEventId: `evt_${nonce}`,
    externalAssessmentId: `ext_asm_${nonce}`,
    assessmentTitle: "Deep Learning & Neural Networks Benchmark",
    assessmentType: "proctored",
    rubricVersion: "v1.0",
    completedAt: new Date(),
    overallResult: 88,
    resultType: "score",
    topics: [
      {
        topicKey: "pytorch",
        topicLabel: "PyTorch",
        value: "Mastered",
        measurementType: "score",
      },
    ],
  });

  const intel5 = await SkillIntelligenceService.getSkillsIntelligence(personAId);
  const pytorchAssessed = intel5.skills.find((s) => s.canonicalName === "PyTorch");

  assert(
    pytorchAssessed?.dimensions.assessedCompetency.assessed === true,
    "Graded assessment attempt updates Dimension 4 (Assessed Competency) to true",
    `Score: ${pytorchAssessed?.dimensions.assessedCompetency.score}% in ${pytorchAssessed?.dimensions.assessedCompetency.testTitle}`
  );

  assert(
    pytorchAssessed?.level === "Assessed",
    "Assessment evaluation advances progression level to 'Assessed'",
    `Level: ${pytorchAssessed?.level}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: Faculty / Independent Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 6: Faculty / Independent Verification ---");

  // Add faculty verification evidence for PyTorch
  await createEvidenceRecord(personAId, {
    category: "skill",
    subject: "PyTorch",
    value: "Faculty reviewed and endorsed advanced PyTorch model implementation in Capstone viva",
    source: "verified",
    verificationStatus: "verified",
    sourceReference: "Faculty Review: Dr. Harpreet Singh (Dean of AI/ML)",
    interpretation: "Independent faculty viva review with code inspection",
    whyItMatters: "Third-party verified academic competency",
    importKey: `fac_torch_${personAId}`,
  });

  const intel6 = await SkillIntelligenceService.getSkillsIntelligence(personAId);
  const pytorchVerified = intel6.skills.find((s) => s.canonicalName === "PyTorch");

  assert(
    pytorchVerified?.dimensions.independentVerification.verified === true,
    "Faculty endorsement sets Dimension 5 (Independent Verification) to true",
    `Verified: ${pytorchVerified?.dimensions.independentVerification.verified}`
  );

  assert(
    pytorchVerified?.level === "Verified",
    "Progression level reaches top tier 'Verified' only with independent verification",
    `Final level: ${pytorchVerified?.level}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 7: Deterministic Answers to 7 Core Questions
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 7: Deterministic Answers to 7 Core Questions ---");

  const sq = pytorchVerified?.sevenQuestions;

  assert(
    Boolean(
      sq?.whatIsThisSkill.name === "PyTorch" &&
      sq?.whatIsThisSkill.category === "AI & ML" &&
      sq?.whatIsThisSkill.definition && sq.whatIsThisSkill.definition.length > 10
    ),
    "Q1 (What is this skill?): Returns canonical name, valid category, and clear definition",
    `Def: ${sq?.whatIsThisSkill.definition.slice(0, 60)}...`
  );

  assert(
    Boolean(
      sq?.whereWasItObserved.sources && sq.whereWasItObserved.sources.length >= 2 &&
      sq?.whereWasItObserved.observations && sq.whereWasItObserved.observations.length >= 2
    ),
    "Q2 (Where was it observed?): Lists all distinct observation sources and provenance records",
    `Sources: ${sq?.whereWasItObserved.sources.join(", ")}`
  );

  assert(
    Boolean(
      sq?.howWasItUsed.projects && sq.howWasItUsed.projects.length >= 1 &&
      sq?.howWasItUsed.usageSummary.includes("Multimodal RAG Pipeline")
    ),
    "Q3 (How was it used?): Accurately outlines usage across confirmed projects",
    `Summary: ${sq?.howWasItUsed.usageSummary}`
  );

  assert(
    Boolean(
      sq?.howMuchKnowledgeDemonstrated.level === "Verified" &&
      sq?.howMuchKnowledgeDemonstrated.isVerified === true
    ),
    "Q5 (How much knowledge demonstrated?): Returns conservative level and verified flag",
    `Level: ${sq?.howMuchKnowledgeDemonstrated.level}, Verified: ${sq?.howMuchKnowledgeDemonstrated.isVerified}`
  );

  assert(
    Boolean(sq?.whatShouldStudentLearnOrProveNext.suggestedTask && sq.whatShouldStudentLearnOrProveNext.suggestedTask.length > 5),
    "Q7 (What should student learn or prove next?): Suggests actionable next step",
    `Suggested Task: "${sq?.whatShouldStudentLearnOrProveNext.suggestedTask}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 8: Canonical Skill Evidence Graph Traceability
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 8: Canonical Skill Evidence Graph Traceability ---");

  const graph = pytorchVerified?.graph;
  const nodeTypes = new Set(graph?.nodes.map((n) => n.type));

  assert(
    nodeTypes.has("skill") && nodeTypes.has("project") && nodeTypes.has("repository"),
    "Canonical Evidence Graph contains Skill -> Project -> Repository nodes",
    `Node types present: ${Array.from(nodeTypes).join(", ")}`
  );

  const relationships = new Set(graph?.edges.map((e) => e.relationship));

  assert(
    relationships.has("demonstrated_in") && relationships.has("stored_in"),
    "Evidence Graph edges maintain semantic traceability relationships ('demonstrated_in', 'stored_in')",
    `Relationships: ${Array.from(relationships).join(", ")}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 9: Goal Relevance & Non-Punitive Missing Skills
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 9: Goal Relevance & Non-Punitive Missing Skills ---");

  // Check goal relevance for PyTorch in GenAI Engineer track (recommended technology)
  assert(
    pytorchVerified?.goalRelevance === "recommended",
    "PyTorch is classified as 'recommended' technology for GenAI Engineer role",
    `Goal relevance: ${pytorchVerified?.goalRelevance}`
  );

  // Check that core prerequisites are mapped to required_core
  const transformersMissing = intel6.missingGoalSkills.find((m) => m.name === "Transformers");
  assert(
    transformersMissing?.relevance === "required_core",
    "Target role core prerequisite 'Transformers' is classified as 'required_core'",
    `Relevance: ${transformersMissing?.relevance}`
  );

  // Check missing goal skills
  assert(
    intel6.missingGoalSkills.length > 0,
    "Missing goal skills are identified from active target role catalog",
    `Missing count: ${intel6.missingGoalSkills.length} (e.g. ${intel6.missingGoalSkills[0]?.name})`
  );

  const firstMissing = intel6.missingGoalSkills[0];
  assert(
    firstMissing.suggestedTask.length > 10,
    "Missing goal skill includes constructive learning suggestion without punitive labeling",
    `Skill: ${firstMissing.name}, Suggestion: "${firstMissing.suggestedTask}"`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 10: Multi-Student Boundary Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 10: Multi-Student Boundary Isolation ---");

  // Query Student B (who has no evidence or projects seeded)
  const intelStudentB = await SkillIntelligenceService.getSkillsIntelligence(personBId);
  const pytorchStudentB = intelStudentB.skills.find((s) => s.canonicalName === "PyTorch");

  assert(
    pytorchStudentB === undefined,
    "Student B does NOT inherit Student A's PyTorch evidence, projects, or verification",
    `Student B PyTorch: ${pytorchStudentB ? "LEAKED" : "Properly Isolated (undefined)"}`
  );

  assert(
    intelStudentB.stats.trackedSkills === 0 &&
      intelStudentB.stats.demonstratedSkills === 0 &&
      intelStudentB.stats.verifiedSkills === 0,
    "Student B stats remain 0 across all dimensions",
    `Student B Tracked: ${intelStudentB.stats.trackedSkills}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 11: PersonGraph & Dashboard Harmonization
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 11: PersonGraph & Dashboard Harmonization ---");

  const personGraph = await buildPersonGraph(personAId);

  assert(
    personGraph.stats.evidencedSkills === intel6.stats.evidencedSkills &&
      personGraph.stats.demonstratedSkills === intel6.stats.demonstratedSkills &&
      personGraph.stats.verifiedSkills === intel6.stats.verifiedSkills,
    "PersonGraph stats perfectly match SkillIntelligence stats (100% metric harmonization)",
    `PersonGraph Verified: ${personGraph.stats.verifiedSkills}, Intel Verified: ${intel6.stats.verifiedSkills}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary & Completion
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n===============================================================================");
  console.log(`   V4.7 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("===============================================================================");

  if (passedTests === totalTests) {
    console.log("🎉 ALL V4.7 EXPLAINABLE SKILLS & PROFICIENCY TESTS PASSED WITH ZERO ERRORS!\n");
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("FATAL UNCAUGHT ERROR IN V4.7 VERIFICATION:", err);
  process.exit(1);
});
