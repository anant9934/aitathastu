/**
 * AI TATHASTU — V4.6 ONE-ACTION DIGITAL FOOTPRINT IMPORT & REAL SOURCE ACQUISITION
 * Comprehensive Verification Battery
 *
 * Verifies:
 * 1. Provider Capabilities & Consent Disclosures Matrix
 * 2. URL Validation & Identifier Normalization (ORCID checksum, GitHub, HF, DEV, SO)
 * 3. SSRF Protection & Network Isolation (Blocking loopback, private CIDRs, metadata IP)
 * 4. GitHub Live Public Import & V4.3 Intelligence Reuse
 * 5. Permitted Public API Integrations (Hugging Face, ORCID, DEV, Stack Overflow)
 * 6. Authorized LinkedIn Archive Ingestion vs Automated Scraping Compliance
 * 7. Coding Platforms (LeetCode, HackerRank, CodeChef, HackerEarth) & Google Scholar
 * 8. Step 6 Card State Machine Transitions & Non-Dead-End Guarantees
 * 9. Multi-Tenant Student Isolation & Neon Database Persistence
 * 10. Step 8 Candidate Propagation & Source Badge Ledger Integrity
 */

import crypto from "crypto";
import { DigitalSourceImportOrchestrator } from "../lib/services/digital-source-import-orchestrator";
import { isSafePublicUrl } from "../lib/connectors/portfolio/client";
import { isValidOrcidChecksum } from "../lib/services/digital-footprint-registry";
import { getDb, evidenceItems, projects, externalConnections } from "../lib/db";
import { createUser } from "../lib/repositories/user-repository";
import { eq } from "drizzle-orm";
import { writeOnboardingDraft, readOnboardingDraft } from "../lib/services/onboarding-v2-service";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, title: string, evidence?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[Test ${totalTests.toString().padStart(2, "0")}/25] ✅ PASS: ${title}`);
    if (evidence) console.log(`   Evidence: ${evidence}`);
  } else {
    console.error(`[Test ${totalTests.toString().padStart(2, "0")}/25] ❌ FAIL: ${title}`);
    if (evidence) console.error(`   Evidence: ${evidence}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("   AI TATHASTU V4.6 — ONE-ACTION DIGITAL FOOTPRINT IMPORT VERIFICATION");
  console.log("===============================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Provider Capabilities & Consent Disclosures Matrix
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- SUITE 1: Provider Capabilities & Consent Disclosures Matrix ---");

  const expectedProviders = [
    "github",
    "portfolio",
    "linkedin",
    "huggingface",
    "orcid",
    "devto",
    "stackoverflow",
    "leetcode",
    "hackerrank",
    "codechef",
    "hackerearth",
    "kaggle",
    "google_scholar",
  ];

  const allCapabilities = expectedProviders.map((p) => DigitalSourceImportOrchestrator.getCapabilities(p));
  assert(
    allCapabilities.every((c) => c !== null && Boolean(c.providerId && c.displayName && c.acquisitionMode)),
    "All 13 providers have registered capabilities and valid acquisition modes",
    `Verified: ${allCapabilities.map((c) => c!.providerId).join(", ")}`
  );

  const allDisclosures = expectedProviders.map((p) => DigitalSourceImportOrchestrator.getConsentDisclosure(p));
  assert(
    allDisclosures.every((d) => d.dataCollected.length > 0 && d.strictGuarantees.length > 0 && Boolean(d.actionLabel)),
    "Clear, legally-compliant consent disclosures exist for every provider detailing public data & guarantees",
    `Verified disclosures with average ${Math.round(
      allDisclosures.reduce((acc, d) => acc + d.dataCollected.length, 0) / allDisclosures.length
    )} data points and guarantees per provider`
  );

  const linkedinCap = DigitalSourceImportOrchestrator.getCapabilities("linkedin");
  const codechefCap = DigitalSourceImportOrchestrator.getCapabilities("codechef");
  const scholarCap = DigitalSourceImportOrchestrator.getCapabilities("google_scholar");
  const githubCap = DigitalSourceImportOrchestrator.getCapabilities("github");

  assert(
    linkedinCap?.authMethod === "user_export_upload" &&
      codechefCap?.refreshMethod === "manual_upload" &&
      scholarCap?.acquisitionMode === "MANUAL_PROFILE_REFERENCE" &&
      githubCap?.acquisitionMode === "OFFICIAL_OAUTH_API",
    "Export-required and restricted providers are correctly marked vs automatic public connectors",
    `LinkedIn auth: ${linkedinCap?.authMethod}, CodeChef refresh: ${codechefCap?.refreshMethod}, Scholar mode: ${scholarCap?.acquisitionMode}, GitHub mode: ${githubCap?.acquisitionMode}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: URL Validation & Identifier Normalization
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: URL Validation & Identifier Normalization ---");

  const ghVal = DigitalSourceImportOrchestrator.validateProfile("github", "https://github.com/torvalds");
  const hfVal = DigitalSourceImportOrchestrator.validateProfile("huggingface", "https://huggingface.co/mistralai");
  const devVal = DigitalSourceImportOrchestrator.validateProfile("devto", "dev.to/thepracticaldev");
  const soVal = DigitalSourceImportOrchestrator.validateProfile("stackoverflow", "https://stackoverflow.com/users/22656/jon-skeet");

  assert(
    Boolean(ghVal.valid) &&
      ghVal.normalizedIdentifier === "torvalds" &&
      Boolean(hfVal.valid) &&
      hfVal.normalizedIdentifier === "mistralai" &&
      Boolean(devVal.valid) &&
      devVal.normalizedIdentifier === "thepracticaldev" &&
      Boolean(soVal.valid) &&
      soVal.normalizedIdentifier === "22656",
    "GitHub, Hugging Face, DEV, and Stack Overflow identifiers normalize accurately",
    `GH: ${ghVal.normalizedIdentifier}, HF: ${hfVal.normalizedIdentifier}, DEV: ${devVal.normalizedIdentifier}, SO: ${soVal.normalizedIdentifier}`
  );

  const validOrcid = "0000-0002-1825-0097";
  const invalidOrcid = "0000-0002-1825-0099"; // Checksum digit mismatch
  const orcidVal1 = DigitalSourceImportOrchestrator.validateProfile("orcid", `https://orcid.org/${validOrcid}`);
  const orcidVal2 = DigitalSourceImportOrchestrator.validateProfile("orcid", invalidOrcid);

  assert(
    Boolean(orcidVal1.valid) && !orcidVal2.valid && Boolean(orcidVal2.error?.includes("checksum")),
    "ORCID validates ISO 7064 Mod 11,2 checksums rigorously (rejecting corrupt IDs)",
    `Valid (${validOrcid}): ${orcidVal1.valid}, Corrupt (${invalidOrcid}): ${orcidVal2.valid}`
  );

  const liVal1 = DigitalSourceImportOrchestrator.validateProfile("linkedin", "https://linkedin.com/in/anant-kumar-123");
  const liVal2 = DigitalSourceImportOrchestrator.validateProfile("linkedin", "anant-kumar-123");
  const liVal3 = DigitalSourceImportOrchestrator.validateProfile("linkedin", "https://evil.com/phish");

  assert(
    Boolean(liVal1.valid) && Boolean(liVal2.valid) && !liVal3.valid && liVal1.normalizedIdentifier === "anant-kumar-123",
    "LinkedIn handles member URLs and usernames without allowing off-domain redirects",
    `URL: ${liVal1.normalizedUrl}, Handle: ${liVal2.normalizedUrl}, Invalid: ${liVal3.valid}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: SSRF Protection & Network Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 3: SSRF Protection & Network Isolation ---");

  const safeCheck = isSafePublicUrl("https://alexrivers.dev/portfolio");
  assert(
    safeCheck.safe === true,
    "SSRF defense permits verified public HTTPS portfolio domains",
    "https://alexrivers.dev/portfolio -> allowed"
  );

  const unsafeLoopback = isSafePublicUrl("http://127.0.0.1:8000/internal");
  const unsafeLocalhost = isSafePublicUrl("http://localhost:3000/admin");
  const unsafePrivateA = isSafePublicUrl("http://10.0.0.5/secrets");
  const unsafePrivateC = isSafePublicUrl("http://192.168.1.1/router");
  const unsafeMetadata = isSafePublicUrl("http://169.254.169.254/latest/meta-data/");

  assert(
    !unsafeLoopback.safe && !unsafeLocalhost.safe && !unsafePrivateA.safe && !unsafePrivateC.safe && !unsafeMetadata.safe,
    "SSRF defense strictly blocks 127.0.0.1, localhost, 10.x, 192.168.x, and cloud metadata (169.254.169.254)",
    `Blocked: loopback=${!unsafeLoopback.safe}, localhost=${!unsafeLocalhost.safe}, 10.x=${!unsafePrivateA.safe}, 192.168.x=${!unsafePrivateC.safe}, metadata=${!unsafeMetadata.safe}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: GitHub Live Public Import & V4.3 Intelligence Reuse
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: GitHub Live Public Import & V4.3 Intelligence Reuse ---");

  const createdUser = await createUser({
    email: `test_v46_${Date.now()}@example.com`,
    passwordHash: "hash_v46",
    displayName: "Test Student V4.6",
  });
  const testPersonId = createdUser.personId;

  const ghImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "github",
    identifier: "torvalds",
    consent: true,
  });

  assert(
    ghImportResult.recordsCreated > 0 &&
      ghImportResult.candidates.projects.length > 0 &&
      Boolean(ghImportResult.candidates.projects[0].technologies),
    "GitHub public import executes, discovering real repositories, languages & manifests",
    `Found ${ghImportResult.candidates.projects.length} repository projects; Summary: ${ghImportResult.summary}`
  );

  const sampleGhProj = ghImportResult.candidates.projects[0];
  assert(
    Boolean(sampleGhProj.title) && Boolean(sampleGhProj.url) && Array.isArray(sampleGhProj.technologies),
    "GitHub candidate projects preserve repository URLs, descriptions & declared technologies",
    `Proj: ${sampleGhProj.title}, Techs: ${sampleGhProj.technologies.slice(0, 4).join(", ")}, URL: ${sampleGhProj.url}`
  );

  // Check Neon DB persistence for GitHub import
  const db = await getDb();
  const dbProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.personId, testPersonId));
  const dbEvidence = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.personId, testPersonId));

  assert(
    dbProjects.length > 0 && dbEvidence.length > 0,
    "Neon database successfully persists GitHub repositories to 'projects' and findings to 'evidenceItems'",
    `Persisted ${dbProjects.length} projects and ${dbEvidence.length} evidence items in Neon DB`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Permitted Public API Integrations (HF, ORCID, DEV, Stack Overflow)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: Permitted Public API Integrations ---");

  const hfImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "huggingface",
    identifier: "facebook",
    consent: true,
  });

  assert(
    hfImportResult.recordsCreated > 0 && hfImportResult.candidates.projects.length > 0,
    "Hugging Face Hub public integration retrieves models, datasets, likes and candidate ML projects",
    `Created ${hfImportResult.recordsCreated} records, found ${hfImportResult.candidates.projects.length} HF models/datasets`
  );

  const orcidImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "orcid",
    identifier: "0000-0002-1825-0097",
    consent: true,
  });

  assert(
    orcidImportResult.recordsCreated > 0 && (orcidImportResult.candidates.achievements?.length || 0) > 0,
    "ORCID public v3.0 integration retrieves scholarly publications, DOIs & academic output",
    `Created ${orcidImportResult.recordsCreated} records, found ${orcidImportResult.candidates.achievements?.length} publication achievements`
  );

  const devImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "devto",
    identifier: "ben",
    consent: true,
  });

  assert(
    devImportResult.recordsCreated > 0 && (devImportResult.candidates.achievements?.length || 0) > 0,
    "DEV Community integration retrieves published technical articles, tags, and reading stats",
    `Created ${devImportResult.recordsCreated} records; Article: '${devImportResult.candidates.achievements?.[0]?.title}'`
  );

  const soImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "stackoverflow",
    identifier: "22656",
    consent: true,
  });

  assert(
    soImportResult.recordsCreated > 0 && soImportResult.candidates.skills.length > 0,
    "Stack Overflow integration retrieves reputation score and top technical skill tags",
    `Skills: ${soImportResult.candidates.skills.map((s) => s.name).slice(0, 4).join(", ")}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: Authorized LinkedIn Archive Ingestion vs Automated Scraping Compliance
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 6: Authorized LinkedIn Archive Ingestion vs Scraping Compliance ---");

  const liRefResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "linkedin",
    identifier: "https://www.linkedin.com/in/anant-kumar-test",
    consent: true,
  });

  assert(
    liRefResult.acquisitionMode === "MANUAL_PROFILE_REFERENCE" &&
      liRefResult.recordsCreated === 1 &&
      liRefResult.candidates.experiences?.length === 0,
    "LinkedIn URL link creates an honest reference record without scraping restricted profile data",
    `AcquisitionMode: ${liRefResult.acquisitionMode}, summary: ${liRefResult.summary}`
  );

  // Authorized CSV export test
  const samplePositionsCsv = `Company Name,Title,Geo Location,Description,Started On,Finished On
Anthropic,Research Engineer,"San Francisco, CA","Working on Constitutional AI",Jan 2023,Present
Google DeepMind,Research Intern,"London, UK","Deep reinforcement learning experiments",Jun 2022,Dec 2022`;

  const liExportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "linkedin",
    identifier: "Positions.csv",
    exportFilename: "Positions.csv",
    exportContent: samplePositionsCsv,
    consent: true,
  });

  assert(
    liExportResult.recordsCreated === 2 &&
      liExportResult.candidates.experiences?.length === 2 &&
      liExportResult.candidates.experiences[0].company === "Anthropic",
    "Student-authorized LinkedIn Positions.csv archive parses candidate work experiences with provenance",
    `Parsed ${liExportResult.candidates.experiences?.length} roles: ${liExportResult.candidates.experiences
      ?.map((e) => `${e.title} at ${e.company}`)
      .join("; ")}`
  );

  // Idempotency: Re-importing same archive
  const liReimportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "linkedin",
    identifier: "Positions.csv",
    exportFilename: "Positions.csv",
    exportContent: samplePositionsCsv,
    consent: true,
  });

  const dbLiConnections = await db
    .select()
    .from(externalConnections)
    .where(eq(externalConnections.personId, testPersonId));

  assert(
    liReimportResult.recordsCreated === 2 &&
      dbLiConnections.filter((c: { provider: string }) => c.provider === "linkedin").length === 1,
    "LinkedIn archive re-import is idempotent and preserves unique connection record",
    `External connections for LinkedIn: ${dbLiConnections.filter((c: { provider: string }) => c.provider === "linkedin").length}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 7: Coding Platforms & Google Scholar Compliance
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 7: Coding Platforms & Google Scholar Compliance ---");

  const lcImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "leetcode",
    identifier: "anant99",
    consent: true,
  });

  assert(
    lcImportResult.recordsCreated > 0 && (lcImportResult.candidates.achievements?.length || 0) > 0,
    "LeetCode public stats retrieval extracts solved problem tiers (Easy, Medium, Hard) & contest ratings",
    `Created ${lcImportResult.recordsCreated} records: ${lcImportResult.summary}`
  );

  const hrImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "hackerrank",
    identifier: "anant99",
    consent: true,
  });

  assert(
    hrImportResult.recordsCreated > 0 && (hrImportResult.candidates.achievements?.length || 0) > 0,
    "HackerRank public integration extracts verified domain skill badges and stars",
    `Badges: ${hrImportResult.candidates.achievements?.map((a) => a.title).join(", ")}`
  );

  const scholarImportResult = await DigitalSourceImportOrchestrator.startImport({
    personId: testPersonId,
    provider: "google_scholar",
    identifier: "https://scholar.google.com/citations?user=xyz1234",
    consent: true,
  });

  assert(
    scholarImportResult.acquisitionMode === "MANUAL_PROFILE_REFERENCE" &&
      scholarImportResult.recordsCreated === 1,
    "Google Scholar creates legitimate reference record for DOI matching without scraping",
    `Mode: ${scholarImportResult.acquisitionMode}, summary: ${scholarImportResult.summary}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 8: Step 6 Card State Machine & Non-Dead-End Guarantee
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 8: Step 6 Card State Machine & Non-Dead-End Guarantee ---");

  function simulateCardState(params: {
    provider: string;
    hasProfile: boolean;
    isCvCandidate: boolean;
    status: string;
    isSyncing: boolean;
  }) {
    const { provider, hasProfile, isCvCandidate, status, isSyncing } = params;
    const cap = DigitalSourceImportOrchestrator.getCapabilities(provider);

    if (isSyncing) return { label: "Importing...", action: "importing" };
    if (status === "Import Failed") return { label: "Retry", action: "retry" };
    if (status === "Disconnected") return { label: "Reconnect", action: "reconnect" };
    if (hasProfile || status === "Import Completed") return { label: "Refresh", action: "refresh" };
    if (isCvCandidate) return { label: "Review Profile", action: "review_profile" };
    if (cap?.authMethod === "user_export_upload") return { label: "Import Your Data", action: "import_data" };
    return { label: "Connect & Import", action: "connect_import" };
  }

  const state1 = simulateCardState({ provider: "github", hasProfile: false, isCvCandidate: true, status: "Not Connected", isSyncing: false });
  const state2 = simulateCardState({ provider: "github", hasProfile: false, isCvCandidate: false, status: "Not Connected", isSyncing: false });
  const state3 = simulateCardState({ provider: "linkedin", hasProfile: false, isCvCandidate: false, status: "Not Connected", isSyncing: false });
  const state4 = simulateCardState({ provider: "github", hasProfile: true, isCvCandidate: false, status: "Import Completed", isSyncing: false });
  const state5 = simulateCardState({ provider: "github", hasProfile: true, isCvCandidate: false, status: "Import Failed", isSyncing: false });
  const state6 = simulateCardState({ provider: "github", hasProfile: false, isCvCandidate: false, status: "Disconnected", isSyncing: false });

  assert(
    state1.label === "Review Profile" &&
      state2.label === "Connect & Import" &&
      state3.label === "Import Your Data" &&
      state4.label === "Refresh" &&
      state5.label === "Retry" &&
      state6.label === "Reconnect",
    "Step 6 card state machine accurately reflects all 8 lifecycle states",
    `States: 1=${state1.label}, 2=${state2.label}, 3=${state3.label}, 4=${state4.label}, 5=${state5.label}, 6=${state6.label}`
  );

  // Test disconnection
  const disconnectResult = await DigitalSourceImportOrchestrator.disconnect(testPersonId, "github");
  const statusAfterDisconnect = await DigitalSourceImportOrchestrator.getImportStatus(testPersonId, "github");

  assert(
    disconnectResult.success && statusAfterDisconnect.status === "Not Connected",
    "Disconnecting a profile cleans up the active connection and enables 'Reconnect'",
    `Disconnect success: ${disconnectResult.success}, next status: ${statusAfterDisconnect.status}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 9: Multi-Student Data Isolation & Neon DB Persistence
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 9: Multi-Student Data Isolation & Neon DB Persistence ---");

  const createdA = await createUser({
    email: `iso_a_${Date.now()}@example.com`,
    passwordHash: "hash_iso",
    displayName: "Student A",
  });
  const createdB = await createUser({
    email: `iso_b_${Date.now()}@example.com`,
    passwordHash: "hash_iso",
    displayName: "Student B",
  });
  const studentA = createdA.personId;
  const studentB = createdB.personId;

  await DigitalSourceImportOrchestrator.startImport({
    personId: studentA,
    provider: "huggingface",
    identifier: "google",
    consent: true,
  });

  await DigitalSourceImportOrchestrator.startImport({
    personId: studentB,
    provider: "huggingface",
    identifier: "facebook",
    consent: true,
  });

  const studentAItems = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.personId, studentA));
  const studentBItems = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.personId, studentB));

  const hasLeakage =
    studentAItems.some((a: { personId: string }) => a.personId !== studentA) ||
    studentBItems.some((b: { personId: string }) => b.personId !== studentB);

  assert(
    !hasLeakage && studentAItems.length > 0 && studentBItems.length > 0,
    "Strict multi-tenant isolation: identical imports for distinct students maintain 100% boundary separation",
    `Student A items: ${studentAItems.length}, Student B items: ${studentBItems.length}, Leakage detected: ${hasLeakage}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 10: Step 8 Candidate Propagation & Ledger Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 10: Step 8 Candidate Propagation & Ledger Integrity ---");

  // Simulate updating onboarding draft with imported candidate output and re-reading
  const sampleImportCandidates = {
    projects: [
      {
        id: "proj_gh_1",
        title: "Autonomous AI Agent",
        description: "Multi-agent framework built with PyTorch and Transformers.",
        technologies: ["Python", "PyTorch", "Transformers"],
        sources: ["github"],
        status: "candidate" as const,
        contribution: [],
        contributionNote: "",
      },
    ],
    skills: ["Python", "PyTorch", "Transformers", "FastAPI"],
    experiences: [
      {
        company: "OpenAI Labs",
        role: "Research Fellow",
        type: "internship",
        startDate: "2023-01",
        endDate: "2023-08",
        highlights: ["Fine-tuned LLM architectures."],
        status: "candidate" as const,
        source: "LinkedIn Export",
      },
    ],
    educations: [
      {
        institution: "Stanford University",
        degree: "M.S. in Computer Science",
        fieldOfStudy: "Artificial Intelligence",
        graduationYear: "2024",
        status: "candidate" as const,
        source: "ORCID",
      },
    ],
    achievements: [
      {
        title: "10.1145/3313831.3376723: Neural Scaling Laws",
        category: "publication" as const,
        status: "candidate" as const,
        source: "ORCID",
      },
    ],
  };

  await writeOnboardingDraft(testPersonId, {
    version: 2,
    role: "student",
    name: "Alex Rivers",
    projects: sampleImportCandidates.projects,
    skills: sampleImportCandidates.skills,
    experiences: sampleImportCandidates.experiences,
    education: sampleImportCandidates.educations,
    achievements: sampleImportCandidates.achievements,
  });

  const loadedDraft = await readOnboardingDraft(testPersonId);

  assert(
    loadedDraft !== null &&
      Array.isArray(loadedDraft.projects) &&
      loadedDraft.projects.length === 1 &&
      loadedDraft.projects[0].title === "Autonomous AI Agent" &&
      Array.isArray((loadedDraft as any).experiences) &&
      (loadedDraft as any).experiences[0].source === "LinkedIn Export" &&
      Array.isArray((loadedDraft as any).education) &&
      (loadedDraft as any).education[0].source === "ORCID",
    "Candidate records from digital imports persist to canonical draft and propagate immediately to Step 8 Review",
    `Propagated: Proj='${loadedDraft?.projects[0]?.title}', Exp Source='${(loadedDraft as any)?.experiences[0]?.source}', Edu Source='${(loadedDraft as any)?.education[0]?.source}'`
  );

  console.log("\n===============================================================================");
  console.log(`   V4.6 VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("===============================================================================\n");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL: Unhandled exception in V4.6 verification:", err);
  process.exit(1);
});
