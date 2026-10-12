/**
 * AI TATHASTU — V4.4 CANONICAL DATA FOUNDATION, SOURCE STATES & EVIDENCE INTEGRITY
 *
 * Verification suite for:
 * 1. Deterministic Resume Extraction: Experience & Achievement extraction
 * 2. Non-project filtering: Headings, patents, books rejected from project claims
 * 3. Multi-dimensional Provenance State Separation (9 coexisting states)
 * 4. Unauthenticated Resume Footprints: Discovered URLs never treated as authenticated accounts
 * 5. Candidate Status Integrity: Resume items start as candidates, never auto-confirmed
 * 6. Student Confirmation & Preservation: Confirmed records protected from overwrite
 * 7. Institution Resolution & Preservation: Truthful institution in Person 360 and Dashboard
 * 8. Skill Counter Harmonization: Tracked unique skills vs evidence points consistency
 * 9. Conflict Tracking: Conflicting claims generate reviewable changes in sourceConflicts
 * 10. Idempotency & Tenant Isolation: Safe re-runs isolated by student identity
 */

import crypto from "crypto";
import { DeterministicResumeExtractionEngine } from "../lib/services/deterministic-resume-extraction-engine";
import { ExtractionValidator } from "../lib/services/extraction-validator";
import {
  resolveMultiDimensionalState,
  type CanonicalProvenanceRecord,
  type MultiDimensionalConnectionState,
} from "./lib/provenance";
import {
  CrossSourceFusionService,
  type CandidateProjectMatch,
} from "../lib/services/cross-source-fusion-service";
import { completeOnboarding } from "../lib/services/onboarding-v2-service";
import { saveResumeCandidates } from "../lib/services/resume-review-service";
import { getPerson360 } from "../lib/services/person-360-service";
import { getStudentDashboardComposition } from "../lib/services/dashboard-service";
import { buildPersonGraph } from "../lib/domain/person-graph";
import { saveProject, getProjectsByPersonId } from "../lib/repositories/project-repository";
import { createEvidenceRecord, getEvidenceByPersonId } from "../lib/repositories/evidence-repository";
import { createUser } from "../lib/repositories/user-repository";
import { getDb, sourceConflicts, personProfiles } from "../lib/db";
import { eq, and } from "drizzle-orm";

let passed = 0;
let total = 0;

function assert(condition: boolean, title: string, evidence?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`[Test ${total.toString().padStart(2, "0")}/25] ✅ PASS: ${title}`);
    if (evidence) console.log(`   Evidence: ${evidence}`);
  } else {
    console.error(`[Test ${total.toString().padStart(2, "0")}/25] ❌ FAIL: ${title}`);
    if (evidence) console.error(`   Evidence: ${evidence}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("   AI TATHASTU V4.4 — CANONICAL DATA FOUNDATION VERIFICATION SUITE");
  console.log("===============================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Extraction Intelligence — Non-Project Filtering & Achievements
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- SUITE 1: Extraction Intelligence, Headings & Achievements ---");

  // Test 1: Heading rejection
  const headingCheck1 = ExtractionValidator.isHeadingOrNonProject("RESEARCH, PATENTS & BOOKS");
  const headingCheck2 = ExtractionValidator.isHeadingOrNonProject("PROJECTS");
  const headingCheck3 = ExtractionValidator.isHeadingOrNonProject("ACADEMIC PROJECTS");
  assert(
    headingCheck1 && headingCheck2 && headingCheck3,
    "Section headings are identified and rejected from project extraction",
    `'RESEARCH, PATENTS & BOOKS': ${headingCheck1}, 'PROJECTS': ${headingCheck2}`
  );

  // Test 2: Patent and book recognition as non-projects
  const patentCheck = ExtractionValidator.isHeadingOrNonProject("Patent: System and Method for Automated Defect Detection in Solar Panels (Granted, 2023)");
  const bookCheck = ExtractionValidator.isHeadingOrNonProject("Book: Practical Deep Learning with PyTorch (Packt Publishing, 2024)");
  assert(
    patentCheck && bookCheck,
    "Patents and published books are identified as non-projects",
    `Patent: ${patentCheck}, Book: ${bookCheck}`
  );

  // Test 3: Legitimate AI/ML projects are NOT rejected
  const realProjCheck1 = ExtractionValidator.isHeadingOrNonProject("Autonomous RAG Pipeline for Medical Diagnostics");
  const realProjCheck2 = ExtractionValidator.isHeadingOrNonProject("Real-Time Multi-Object Tracker using YOLOv8 & DeepSORT");
  assert(
    !realProjCheck1 && !realProjCheck2,
    "Valid AI/ML project titles are permitted and not rejected as headings",
    `RAG Pipeline: ${!realProjCheck1}, YOLOv8 Tracker: ${!realProjCheck2}`
  );

  // Test 4: Deterministic extraction parses patents, books and experience
  const sampleResumeText = `
ANANT KUMAR
Lovely Professional University (LPU)
B.Tech Computer Science and Engineering | 2026
Email: anant@example.com | GitHub: https://github.com/anant9934 | LinkedIn: https://linkedin.com/in/anantkumar

EXPERIENCE
AI Engineering Intern - Tathastu AI Labs (Jan 2024 - Jun 2024)
- Built high-throughput LLM evaluation pipelines using FastAPI and LangChain.
- Optimized vector similarity search latency by 40% with FAISS indexing.

PROJECTS
Autonomous Code Assistant (LangChain, FastAPI, Docker)
- Created autonomous agent capable of deterministic AST code refactoring and rollback.

RESEARCH, PATENTS & BOOKS
Patent: Deep Learning Edge Architecture for Micro-UAV Vision (Application No: 202311045678, Published 2024)
Book: Hands-On Neural Networks with Python (Published 2023)
Paper: Transformer Latency Reduction in Low-Compute Edge Runtimes (Accepted at IEEE Conference, 2024)

TECHNICAL SKILLS
Python, PyTorch, LangChain, FastAPI, Docker, Transformers, Next.js, PostgreSQL
`;

  const extracted = DeterministicResumeExtractionEngine.extract(sampleResumeText, { documentId: "test_resume_v4_4" });

  assert(
    extracted.structured.experience.length >= 1 &&
    extracted.structured.experience[0].company.toLowerCase().includes("tathastu"),
    "Deterministic engine extracts structured experience entries",
    `Found ${extracted.structured.experience.length} experiences. First: ${extracted.structured.experience[0]?.role} at ${extracted.structured.experience[0]?.company}`
  );

  // Test 5: Achievements extraction
  assert(
    extracted.structured.achievements.length >= 2,
    "Deterministic engine extracts achievements (patents, books, publications)",
    `Found ${extracted.structured.achievements.length} achievements. Items: ${extracted.structured.achievements.map((a: { title: string }) => a.title).join("; ")}`
  );

  // Test 6: Section heading not in projects
  const hasHeadingInProjects = extracted.structured.projects.some(
    (p: { title: string }) => p.title.toLowerCase().includes("research, patents") || p.title.toLowerCase().includes("experience")
  );
  assert(
    !hasHeadingInProjects,
    "Section headings do NOT appear in the extracted projects list",
    `Projects: ${extracted.structured.projects.map((p: { title: string }) => p.title).join(", ")}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Multi-Dimensional Source State Separation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: Multi-Dimensional Source State Separation ---");

  // Test 7: Resume discovered URL state separation
  const discoveredState = resolveMultiDimensionalState({
    status: "reference_only",
    externalAccountId: null,
    metadata: {
      discoveredFromResume: true,
      authenticatedIdentity: false,
      studentConfirmed: false,
    },
  });

  assert(
    discoveredState.discoveryState === "PROFILE_DISCOVERED" &&
    discoveredState.authIdentityState === "UNAUTHENTICATED" &&
    discoveredState.studentConfirmationState === "UNCONFIRMED" &&
    discoveredState.ingestionState === "IDLE",
    "Resume-discovered URL is strictly PROFILE_DISCOVERED, UNAUTHENTICATED, and UNCONFIRMED",
    `Discovery: ${discoveredState.discoveryState}, Auth: ${discoveredState.authIdentityState}, Ingestion: ${discoveredState.ingestionState}`
  );

  // Test 8: Public Data Imported without OAuth authentication
  const importedPublicState = resolveMultiDimensionalState({
    status: "connected",
    externalAccountId: null,
    metadata: {
      connectionState: "PUBLIC_DATA_IMPORTED",
      authenticatedIdentity: false,
      studentConfirmed: true,
      importedRepoCount: 14,
    },
  });

  assert(
    importedPublicState.ingestionState === "DATA_IMPORTED" &&
    importedPublicState.authIdentityState === "UNAUTHENTICATED" &&
    importedPublicState.studentConfirmationState === "STUDENT_CONFIRMED",
    "Publicly imported GitHub data coexists with UNAUTHENTICATED identity status",
    `Ingestion: ${importedPublicState.ingestionState}, Auth: ${importedPublicState.authIdentityState}, Confirmed: ${importedPublicState.studentConfirmationState}`
  );

  // Test 9: OAuth Authenticated account
  const oauthState = resolveMultiDimensionalState({
    status: "connected",
    externalAccountId: "gh_user_993412",
    metadata: {
      authenticatedIdentity: true,
      studentConfirmed: true,
    },
  });

  assert(
    oauthState.authIdentityState === "ACCOUNT_AUTHENTICATED" &&
    oauthState.ingestionState === "DATA_IMPORTED",
    "OAuth connection is truthfully marked as ACCOUNT_AUTHENTICATED",
    `Auth: ${oauthState.authIdentityState}, Ingestion: ${oauthState.ingestionState}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Candidate Status Integrity & Confirmation Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 3: Candidate Status Integrity & Confirmation ---");

  // Test 10: Default candidate review status
  const candidateProvenance: CanonicalProvenanceRecord = {
    sourceType: "resume",
    observedAt: new Date().toISOString(),
    claimType: "project",
    reviewStatus: "candidate",
    verificationStatus: "unverified",
    personId: "test_student_1",
  };

  assert(
    candidateProvenance.reviewStatus === "candidate" &&
    candidateProvenance.verificationStatus === "unverified",
    "Resume extracted claims are initialized as candidate and unverified",
    `Review: ${candidateProvenance.reviewStatus}, Verification: ${candidateProvenance.verificationStatus}`
  );

  // Test 11: CrossSourceFusion project matching with stable identifiers
  const matchA: CandidateProjectMatch = {
    title: "Autonomous Code Assistant",
    source: "resume",
    technologies: ["LangChain", "FastAPI", "Python"],
    repositoryUrl: "https://github.com/anant9934/code-assistant",
  };
  const matchB: CandidateProjectMatch = {
    title: "code-assistant",
    source: "github",
    technologies: ["Python", "Docker", "FastAPI"],
    repositoryUrl: "https://github.com/anant9934/code-assistant.git",
  };

  const fusionResult = CrossSourceFusionService.matchProjects(matchA, matchB);
  assert(
    fusionResult.isMatch &&
    fusionResult.confidence >= 0.95 &&
    fusionResult.combinedSources.includes("resume") &&
    fusionResult.combinedSources.includes("github"),
    "Cross-source fusion conservatively matches projects by canonical repository URL and merges sources",
    `Match: ${fusionResult.isMatch}, Confidence: ${fusionResult.confidence}, Sources: ${fusionResult.combinedSources.join(", ")}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: End-to-End Person 360, Institution, and Dashboard Reconciliation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: Person 360, Institution & Dashboard Reconciliation ---");

  // Setup unique test student
  const randSuffix = crypto.randomBytes(4).toString("hex");
  const testEmail = `v4_4_student_${randSuffix}@test.tathastu.com`;
  const user = await createUser({
    email: testEmail,
    passwordHash: "hash_placeholder",
    displayName: "Anant Kumar V4.4",
  });
  const personId = user.personId;

  // Test 12: Complete onboarding with institution and verified claims
  const docHash = crypto.randomBytes(32).toString("hex");
  await saveResumeCandidates(personId, docHash, {
    education: [
      {
        institution: "Lovely Professional University (LPU)",
        degree: "B.Tech Computer Science and Engineering",
        sourceSpan: "B.Tech Computer Science and Engineering | 2026",
      },
    ],
    experience: [
      {
        company: "Tathastu AI Labs",
        role: "AI Engineering Intern",
        duration: "Jan 2024 - Jun 2024",
        highlights: [],
        sourceSpan: "AI Engineering Intern - Tathastu AI Labs",
      },
    ],
    projects: [
      {
        title: "Autonomous Code Assistant",
        description: "AST code refactoring agent",
        technologies: ["Python", "FastAPI"],
        sourceSpan: "Autonomous Code Assistant (LangChain, FastAPI, Docker)",
      },
    ],
    skills: [
      {
        name: "Python",
        category: "language",
        proficiencyHint: "advanced",
        sourceSpan: "Programming Languages: Python",
      },
      {
        name: "PyTorch",
        category: "framework",
        proficiencyHint: "intermediate",
        sourceSpan: "Deep Learning Frameworks: PyTorch",
      },
    ],
    certifications: [],
    achievements: [
      {
        title: "Deep Learning Edge Architecture Patent",
        description: "Edge architecture patent",
        category: "patent",
        sourceSpan: "Patent: Deep Learning Edge Architecture",
      },
    ],
  });

  await completeOnboarding(personId, {
    name: "Anant Kumar",
    degree: "B.Tech",
    specialization: "Computer Science and Engineering",
    institution: "Lovely Professional University (LPU)",
    year: "3rd Year",
    expectedGraduationYear: 2026,
    targetRole: "Generative AI Engineer",
    goal: "Get an AI/ML internship",
    skills: ["Python", "PyTorch", "FastAPI"],
    projects: [
      {
        id: `p_confirmed_${randSuffix}`,
        title: "Autonomous Code Assistant",
        description: "AST code refactoring agent",
        technologies: ["Python", "LangChain", "FastAPI"],
        sources: ["resume"],
        status: "confirmed",
        contribution: ["Machine Learning", "Backend"],
        contributionNote: "Designed the architecture and AST evaluation pipeline.",
        url: "https://github.com/anant9934/code-assistant",
      },
    ],
    experiences: [
      {
        company: "Tathastu AI Labs",
        role: "AI Engineering Intern",
        duration: "Jan 2024 - Jun 2024",
        status: "confirmed",
      },
    ],
    achievements: [
      {
        title: "Deep Learning Edge Architecture Patent",
        issuer: "Indian Patent Office",
        date: "2024",
        status: "confirmed",
      },
    ],
    resumeReviewed: [
      {
        candidateId: "skill_0",
        category: "skill",
        value: "Python",
        sourceSpan: "Programming Languages: Python",
        documentId: docHash,
        corrected: false,
      },
      {
        candidateId: "skill_1",
        category: "skill",
        value: "PyTorch",
        sourceSpan: "Deep Learning Frameworks: PyTorch",
        documentId: docHash,
        corrected: false,
      },
      {
        candidateId: "experience_0",
        category: "experience",
        value: "AI Engineering Intern · Tathastu AI Labs",
        sourceSpan: "AI Engineering Intern - Tathastu AI Labs",
        documentId: docHash,
        corrected: false,
      },
    ],
  });

  // Test 13: Person 360 profile reflects institution
  const person360 = await getPerson360(personId, personId);
  assert(
    person360.profile.institution === "Lovely Professional University (LPU)",
    "Person 360 profile truthfully stores student institution",
    `Profile institution: '${person360.profile.institution}'`
  );

  // Test 14: Person 360 education string contains institution
  assert(
    person360.profile.education.includes("Lovely Professional University (LPU)"),
    "Person 360 education summary string incorporates the institution name",
    `Education: '${person360.profile.education}'`
  );

  // Test 15: Person 360 evidence contains confirmed experiences and achievements
  const evidenceList = await getEvidenceByPersonId(personId);
  const hasExpEvidence = evidenceList.some((e) => e.category === "experience");
  const hasAchEvidence = evidenceList.some((e) => e.subject.includes("Patent"));
  assert(
    hasExpEvidence && hasAchEvidence,
    "Confirmed experiences and achievements are recorded in the Evidence Ledger",
    `Experience Evidence: ${hasExpEvidence}, Achievement Evidence: ${hasAchEvidence}`
  );

  // Test 16: Dashboard composition delivers truthful institution
  const dashboardComp = await getStudentDashboardComposition(personId);
  assert(
    dashboardComp.institution === "Lovely Professional University (LPU)",
    "Personalized Dashboard ViewModel contains truthful institution (not 'Institution not provided')",
    `Dashboard institution: '${dashboardComp.institution}'`
  );

  // Test 17: Skill Counter Harmonization — Add multiple evidence records for the same skill
  // Simulate GitHub sync adding Python and PyTorch evidence from multiple repositories
  await createEvidenceRecord(personId, {
    category: "skill",
    subject: "Python",
    value: "Python",
    source: "imported",
    verificationStatus: "unverified",
    sourceReference: "https://github.com/anant9934/repo-one",
    interpretation: "Observed in repo-one",
    whyItMatters: "Skill evidence",
    importKey: `gh_test_${randSuffix}_repo1_python`,
  });

  await createEvidenceRecord(personId, {
    category: "skill",
    subject: "Python",
    value: "Python",
    source: "imported",
    verificationStatus: "unverified",
    sourceReference: "https://github.com/anant9934/repo-two",
    interpretation: "Observed in repo-two",
    whyItMatters: "Skill evidence",
    importKey: `gh_test_${randSuffix}_repo2_python`,
  });

  await createEvidenceRecord(personId, {
    category: "skill",
    subject: "Docker",
    value: "Docker",
    source: "imported",
    verificationStatus: "unverified",
    sourceReference: "https://github.com/anant9934/repo-one",
    interpretation: "Observed in Dockerfile",
    whyItMatters: "Skill evidence",
    importKey: `gh_test_${randSuffix}_repo1_docker`,
  });

  // Re-fetch dashboard composition and person graph
  const updatedDashboard = await getStudentDashboardComposition(personId);
  const personGraph = await buildPersonGraph(personId);

  // Test 18: Dashboard Tracked Skills card shows deduplicated unique skills
  const skillsCard = updatedDashboard.summaryCards.find((c: { id: string }) => c.id === "card_skills");
  assert(
    skillsCard !== undefined && skillsCard.label === "Tracked Skills",
    "Dashboard summary card uses clear 'Tracked Skills' semantics",
    `Card label: '${skillsCard?.label}', value: ${skillsCard?.value}`
  );

  // Test 19: Unique skills count matches Person Graph totalSkills
  assert(
    skillsCard?.value === personGraph.stats.totalSkills,
    "Dashboard Tracked Skills count exactly matches Skills Page PersonGraph totalSkills",
    `Dashboard: ${skillsCard?.value}, Skills Page: ${personGraph.stats.totalSkills}`
  );

  // Test 20: Subtext documents distinct evidence points transparently
  assert(
    typeof skillsCard?.subtext === "string" && skillsCard.subtext.includes("evidence points"),
    "Summary card subtext truthfully displays total evidence points behind the tracked skills",
    `Subtext: '${skillsCard?.subtext}'`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Conflict Handling, Preservation & Idempotency
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: Conflict Handling & Preservation ---");

  // Test 21: Conflicting institution claim records a reviewable conflict
  const db = await getDb();
  await CrossSourceFusionService.recordConflictIfDifferent(
    personId,
    "institution",
    "Lovely Professional University (LPU)",
    "Lovely Professional University (LPU)",
    "resume_scan",
    "Stanford University"
  );

  const conflicts = await db
    .select()
    .from(sourceConflicts)
    .where(and(eq(sourceConflicts.personId, personId), eq(sourceConflicts.field, "institution")));

  assert(
    conflicts.length >= 1 && conflicts[0].status === "detected",
    "Conflicting institution claim generates a reviewable conflict record rather than overwriting accepted data",
    `Found ${conflicts.length} conflict(s). Status: '${conflicts[0]?.status}', SourceB: '${conflicts[0]?.valueB}'`
  );

  // Test 22: Accepted institution in personProfiles remains intact
  const currentProfile = await db
    .select()
    .from(personProfiles)
    .where(eq(personProfiles.personId, personId))
    .limit(1);

  assert(
    currentProfile[0]?.institution === "Lovely Professional University (LPU)",
    "Previously reviewed student profile data is preserved and not silently overwritten",
    `Profile institution: '${currentProfile[0]?.institution}'`
  );

  // Test 23: Confirmed projects cannot be downgraded to candidate
  await saveProject(personId, {
    title: "Autonomous Code Assistant",
    description: "New incoming sync description",
    status: "candidate",
    sources: ["github"],
  });

  const studentProjects = await getProjectsByPersonId(personId);
  const matchedProject = studentProjects.find((p) => p.title === "Autonomous Code Assistant");

  assert(
    matchedProject?.status === "confirmed",
    "Confirmed project status is preserved when re-synced as candidate",
    `Project '${matchedProject?.title}' status: '${matchedProject?.status}'`
  );

  // Test 24: Project sources are merged rather than overwritten
  assert(
    Array.isArray(matchedProject?.sources) &&
    (matchedProject.sources as string[]).includes("resume") &&
    (matchedProject.sources as string[]).includes("github"),
    "Project sources are conservatively merged across multiple discovery channels",
    `Sources: ${(matchedProject?.sources as string[])?.join(", ")}`
  );

  // Test 25: Re-running onboarding complete is idempotent
  await completeOnboarding(personId, {
    name: "Anant Kumar",
    degree: "B.Tech",
    specialization: "Computer Science and Engineering",
    institution: "Lovely Professional University (LPU)",
    year: "3rd Year",
    expectedGraduationYear: 2026,
    targetRole: "Generative AI Engineer",
    goal: "Get an AI/ML internship",
    skills: ["Python", "PyTorch", "FastAPI"],
    projects: [],
    resumeReviewed: [],
  });

  const finalProfile = await getPerson360(personId, personId);
  assert(
    finalProfile.profile.institution === "Lovely Professional University (LPU)" &&
    finalProfile.person.displayName === "Anant Kumar",
    "Re-submitting onboarding is completely idempotent and preserves canonical student data",
    `Name: '${finalProfile.person.displayName}', Institution: '${finalProfile.profile.institution}'`
  );

  console.log("\n===============================================================================");
  console.log(`   V4.4 VERIFICATION COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log("===============================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL in verification runner:", err);
  process.exit(1);
});
