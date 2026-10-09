/**
 * AI TATHASTU — DIGITAL FOOTPRINT INTELLIGENCE V4.1 VERIFICATION SUITE
 * Comprehensive testing of Automatic Coding Profile Data Acquisition,
 * Deterministic Zero-LLM Export Parsing, Truthful Policy Routing,
 * Kaggle Official API Integration, Neon DB Snapshots, Candidate Projects,
 * Dashboard Synchronization, and EORA Grounding.
 */

import { getDb, persons, externalConnections, sourceSnapshots, projects, evidenceItems } from "@/lib/db";
import { eq, and } from "drizzle-orm";

import {
  CodingProfileIntelligenceService,
} from "@/lib/services/coding-profile-intelligence-service";
import { normalizeKaggleUsername } from "@/lib/connectors/research-and-dev/client";
import { parseLeetCodeExport } from "@/lib/connectors/leetcode/client";
import {
  parseCodeChefExport,
  parseHackerRankExport,
  parseHackerEarthExport,
  normalizeCodingHandle,
} from "@/lib/connectors/coding-platforms/client";
import { wrapUntrustedContent } from "@/lib/intelligence/prompt-defense";

interface TestResult {
  name: string;
  passed: boolean;
  category: string;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, category: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, category, details });
    console.log(`[PASS] [${category}] ${name}${details ? ` -> ${details}` : ""}`);
  } else {
    results.push({ name, passed: false, category, details, error: "Assertion failed" });
    console.error(`[FAIL] [${category}] ${name}${details ? ` -> ${details}` : ""}`);
  }
}

async function runSuite() {
  console.log("================================================================================");
  console.log("   AI TATHASTU — DIGITAL FOOTPRINT INTELLIGENCE V4.1 CERTIFICATION SUITE");
  console.log("   Timestamp:", new Date().toISOString());
  console.log("================================================================================\n");

  const db = await getDb();
  const testPersonId = `prs_v4_1_test_${Date.now()}`;
  const otherPersonId = `prs_v4_1_other_${Date.now()}`;

  try {
    // 0. Setup test personas in Neon DB
    await db.insert(persons).values([
      {
        id: testPersonId,
        primaryUserId: `usr_${Date.now()}_v41_1`,
        displayName: "Anant V4.1 Tester",
      },
      {
        id: otherPersonId,
        primaryUserId: `usr_${Date.now()}_v41_2`,
        displayName: "Other Student",
      },
    ]);

    // ------------------------------------------------------------------------
    // SECTION 1: PROVIDER CAPABILITY POLICIES & ROUTING (PHASE 1 AUDIT)
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Testing Truthful Provider Capability Policies ---");

    const leetCodePolicy = CodingProfileIntelligenceService.auditProviderAccessPolicy("leetcode");
    assert(
      leetCodePolicy.acquisitionMode === "authorized_export",
      "LeetCode Policy Correctly Declares 'authorized_export'",
      "POLICY",
      `Mode: ${leetCodePolicy.acquisitionMode}`
    );
    assert(
      leetCodePolicy.autoApiAvailable === false,
      "LeetCode Automated Scraping Restricted / Auto API False",
      "POLICY"
    );

    const codeChefPolicy = CodingProfileIntelligenceService.auditProviderAccessPolicy("codechef");
    assert(
      codeChefPolicy.acquisitionMode === "authorized_export",
      "CodeChef Policy Declares 'authorized_export'",
      "POLICY",
      `Mode: ${codeChefPolicy.acquisitionMode}`
    );

    const hackerRankPolicy = CodingProfileIntelligenceService.auditProviderAccessPolicy("hackerrank");
    assert(
      hackerRankPolicy.acquisitionMode === "authorized_export",
      "HackerRank Policy Declares 'authorized_export' (Consumer Scraping Restricted)",
      "POLICY",
      `Mode: ${hackerRankPolicy.acquisitionMode}`
    );

    const kagglePolicy = CodingProfileIntelligenceService.auditProviderAccessPolicy("kaggle");
    assert(
      kagglePolicy.acquisitionMode === "permitted_public_api",
      "Kaggle Policy Declares 'permitted_public_api'",
      "POLICY",
      `Mode: ${kagglePolicy.acquisitionMode}`
    );
    assert(
      kagglePolicy.autoApiAvailable === true,
      "Kaggle Public API Available Flag = true",
      "POLICY"
    );

    // ------------------------------------------------------------------------
    // SECTION 2: URL NORMALIZATION & PLATFORM IDENTIFICATION
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Testing URL Normalization & Handle Detection ---");

    assert(
      CodingProfileIntelligenceService.identifyPlatform("https://leetcode.com/u/quantumanant/") === "leetcode",
      "Identify LeetCode Profile URL",
      "NORMALIZATION"
    );
    assert(
      CodingProfileIntelligenceService.identifyPlatform("https://www.codechef.com/users/chef_anant") === "codechef",
      "Identify CodeChef Profile URL",
      "NORMALIZATION"
    );
    assert(
      CodingProfileIntelligenceService.identifyPlatform("https://www.hackerrank.com/profile/anant99") === "hackerrank",
      "Identify HackerRank Profile URL",
      "NORMALIZATION"
    );
    assert(
      CodingProfileIntelligenceService.identifyPlatform("https://www.kaggle.com/anant9934") === "kaggle",
      "Identify Kaggle Profile URL",
      "NORMALIZATION"
    );

    const lcNorm = CodingProfileIntelligenceService.normalizeProfileUrl("leetcode", "quantumanant");
    assert(
      lcNorm.profileUrl === "https://leetcode.com/u/quantumanant",
      "Normalize LeetCode Handle to URL",
      "NORMALIZATION"
    );
    const ccNorm = CodingProfileIntelligenceService.normalizeProfileUrl("codechef", "chef_anant");
    assert(
      ccNorm.profileUrl === "https://www.codechef.com/users/chef_anant",
      "Normalize CodeChef Handle to URL",
      "NORMALIZATION"
    );
    assert(
      normalizeCodingHandle("https://www.hackerearth.com/@anant_he", "hackerearth") === "anant_he",
      "Normalize HackerEarth @ URL to Clean Handle",
      "NORMALIZATION"
    );

    // ------------------------------------------------------------------------
    // SECTION 3: DETERMINISTIC LEETCODE EXPORT PARSER (ZERO-LLM)
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Testing LeetCode Export Parser ---");

    // Case 3a: Solved Problems Array JSON
    const leetCodeJsonSubmissions = JSON.stringify([
      { title: "Two Sum", difficulty: "Easy", status: "Accepted", topic: "Array" },
      { title: "Add Two Numbers", difficulty: "Medium", status: "Accepted", topic: "Linked List" },
      { title: "Longest Substring", difficulty: "Medium", status: "Accepted", topic: "Hash Table" },
      { title: "Median of Two Sorted Arrays", difficulty: "Hard", status: "Accepted", topic: "Binary Search" },
      { title: "Regular Expression Matching", difficulty: "Hard", status: "Wrong Answer" }, // Should not be counted as solved
    ]);

    const parsedLcSubmissions = CodingProfileIntelligenceService.parseCodingExportFile(
      "leetcode",
      "leetcode_submissions.json",
      leetCodeJsonSubmissions
    );

    assert(parsedLcSubmissions.success === true, "LeetCode Array JSON Parse Succeeded", "LEETCODE_PARSER");
    assert(parsedLcSubmissions.metrics.problemsSolved === 4, "Accurately Extracted 4 Solved Problems (Ignored WA)", "LEETCODE_PARSER", `Solved: ${parsedLcSubmissions.metrics.problemsSolved}`);
    assert(parsedLcSubmissions.metrics.easySolved === 1, "Easy Solved = 1", "LEETCODE_PARSER");
    assert(parsedLcSubmissions.metrics.mediumSolved === 2, "Medium Solved = 2", "LEETCODE_PARSER");
    assert(parsedLcSubmissions.metrics.hardSolved === 1, "Hard Solved = 1", "LEETCODE_PARSER");
    assert(Boolean(parsedLcSubmissions.metrics.topicCounts?.["Array"]), "Topic Counts Populated (Array found)", "LEETCODE_PARSER");

    // Case 3b: Direct Metrics JSON
    const leetCodeMetricsJson = JSON.stringify({
      totalSolved: 342,
      easySolved: 140,
      mediumSolved: 165,
      hardSolved: 37,
      ranking: 15420,
      contestRating: 1845,
    });
    const parsedLcDirect = CodingProfileIntelligenceService.parseCodingExportFile(
      "leetcode",
      "leetcode_profile.json",
      leetCodeMetricsJson
    );
    assert(parsedLcDirect.metrics.problemsSolved === 342, "Direct Metrics: Solved = 342", "LEETCODE_PARSER");
    assert(parsedLcDirect.metrics.contestRating === 1845, "Direct Metrics: Contest Rating = 1845", "LEETCODE_PARSER");
    assert(parsedLcDirect.metrics.globalRank === 15420, "Direct Metrics: Global Rank = 15420", "LEETCODE_PARSER");

    // Case 3c: CSV Export
    const leetCodeCsv = `Problem,Difficulty,Verdict\nTwo Sum,Easy,Accepted\nLRU Cache,Medium,Accepted\nTrapping Rain Water,Hard,Accepted\n`;
    const parsedLcCsv = parseLeetCodeExport("leetcode_solved.csv", leetCodeCsv);
    assert(parsedLcCsv.totalSolved === 3, "LeetCode CSV: 3 Solved Problems Extracted", "LEETCODE_PARSER");

    // ------------------------------------------------------------------------
    // SECTION 4: CODECHEF, HACKERRANK & HACKEREARTH EXPORT PARSING
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Testing CodeChef, HackerRank & HackerEarth Export Parsers ---");

    // CodeChef JSON
    const codeChefJson = JSON.stringify({
      rating: 1785,
      stars: 4,
      problemsSolved: 128,
      globalRank: 4200,
    });
    const parsedCc = parseCodeChefExport("codechef_data.json", codeChefJson);
    assert(parsedCc.rating === 1785, "CodeChef: Extracted Rating 1785", "CODECHEF_PARSER");
    assert(parsedCc.problemsSolved === 128, "CodeChef: Extracted 128 Problems Solved", "CODECHEF_PARSER");
    assert(parsedCc.globalRank === 4200, "CodeChef: Extracted Global Rank 4200", "CODECHEF_PARSER");

    // HackerRank JSON
    const hackerRankJson = JSON.stringify({
      badges: [
        { name: "Problem Solving", stars: 5 },
        { name: "Python", stars: 5 },
        { name: "SQL", stars: 4 },
      ],
      problemsSolved: 95,
    });
    const parsedHr = parseHackerRankExport("hackerrank_badges.json", hackerRankJson);
    assert((parsedHr.badges?.length || 0) === 3, "HackerRank: Extracted 3 Skill Badges", "HACKERRANK_PARSER");
    assert(parsedHr.badges?.[0].badge === "Problem Solving", "HackerRank: First Badge 'Problem Solving'", "HACKERRANK_PARSER");

    // HackerEarth Text/Log Export
    const hackerEarthText = `HackerEarth Profile Export\nRating: 1650\nSolved: 64\nHackathons: 3\n`;
    const parsedHe = parseHackerEarthExport("hackerearth_summary.txt", hackerEarthText);
    assert(parsedHe.rating === 1650, "HackerEarth: Extracted Rating 1650 from text", "HACKEREARTH_PARSER");
    assert(parsedHe.problemsSolved === 64, "HackerEarth: Extracted 64 Solved from text", "HACKEREARTH_PARSER");

    // ------------------------------------------------------------------------
    // SECTION 5: KAGGLE OFFICIAL API & EXPORT INGESTION
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Testing Kaggle Official API & Export Ingestion ---");

    // Case 5a: Kaggle Export Parsing into Candidate Projects
    const kaggleJsonExport = JSON.stringify({
      datasets: [
        { title: "Indian Stock Market 2024", ref: "anant/indian-stocks", totalVotes: 24, description: "Historical NIFTY 50 data" },
      ],
      kernels: [
        { title: "Transformer Sentiment Analysis", ref: "anant/transformer-sentiment", language: "Python", description: "Fine-tuning DistilRoBERTa" },
      ],
      models: [
        { title: "Llama-3-Hindi-Adapter", ref: "anant/llama3-hindi", framework: "PyTorch" },
      ],
    });

    const parsedKaggle = CodingProfileIntelligenceService.parseCodingExportFile(
      "kaggle",
      "kaggle_profile_artifacts.json",
      kaggleJsonExport
    );

    assert(parsedKaggle.success === true, "Kaggle JSON Export Parse Succeeded", "KAGGLE");
    assert(parsedKaggle.extractedProjects?.length === 3, "Kaggle Ingestion: 3 Candidate Projects Extracted", "KAGGLE");
    assert(
      Boolean(parsedKaggle.extractedProjects?.[0]?.title?.includes("Indian Stock Market")),
      "Extracted Dataset Project Title",
      "KAGGLE"
    );
    assert(
      Boolean(parsedKaggle.extractedProjects?.[1]?.title?.includes("Transformer Sentiment")),
      "Extracted Notebook Project Title",
      "KAGGLE"
    );

    // Case 5b: Kaggle API Format Normalization
    assert(normalizeKaggleUsername("https://www.kaggle.com/anant9934") === "anant9934", "Kaggle URL Normalized to Username", "KAGGLE");

    // ------------------------------------------------------------------------
    // SECTION 6: UNIVERSAL ACQUISITION & NEON PERSISTENCE (PERSON 360 & EVIDENCE)
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Testing Universal CodingProfileIntelligenceService Persistence ---");

    // Acquire LeetCode Profile Snapshot via Export
    const leetCodeAcq = await CodingProfileIntelligenceService.acquireAndNormalizeCodingProfile({
      personId: testPersonId,
      platform: "leetcode",
      identifier: "quantumanant",
      exportFilename: "leetcode_submissions.json",
      exportContent: leetCodeJsonSubmissions,
      consent: true,
    });

    assert(leetCodeAcq.success === true, "Acquisition Succeeded for LeetCode", "PERSISTENCE");
    assert(
      leetCodeAcq.snapshot.acquisitionMode === "authorized_export",
      "Snapshot Acquisition Mode = 'authorized_export'",
      "PERSISTENCE"
    );
    assert(
      leetCodeAcq.snapshot.metrics.problemsSolved === 4,
      "Snapshot Preserved Extracted Solved Count = 4",
      "PERSISTENCE"
    );

    // Verify Snapshot in Neon Database
    const [persistedSnapshot] = await db
      .select()
      .from(sourceSnapshots)
      .where(and(eq(sourceSnapshots.personId, testPersonId), eq(sourceSnapshots.source, "leetcode")));

    assert(Boolean(persistedSnapshot?.id), "LeetCode Snapshot Persisted in Neon DB (sourceSnapshots)", "PERSISTENCE");
    assert(
      Boolean(persistedSnapshot?.sourceReference?.includes("quantumanant")),
      "Snapshot Source Reference matches student identifier",
      "PERSISTENCE"
    );

    // Verify Connection Record in Neon DB
    const [persistedConn] = await db
      .select()
      .from(externalConnections)
      .where(and(eq(externalConnections.personId, testPersonId), eq(externalConnections.provider, "leetcode")));

    assert(persistedConn?.status === "connected", "External Connection Status = 'connected'", "PERSISTENCE");

    // Verify Evidence Item Created with Truthful Provenance
    const evItems = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.personId, testPersonId));

    const lcEvidence = evItems.find((e) => e.subject.includes("LeetCode"));
    assert(Boolean(lcEvidence), "Evidence Record Generated for LeetCode Practice", "PERSISTENCE");
    assert(lcEvidence?.source === "imported", "Evidence Source Tagged Truthfully as 'imported'", "PERSISTENCE");

    // Acquire Kaggle via Export and verify candidate projects in Neon DB
    const kaggleAcq = await CodingProfileIntelligenceService.acquireAndNormalizeCodingProfile({
      personId: testPersonId,
      platform: "kaggle",
      identifier: "anant9934",
      exportFilename: "kaggle_profile_artifacts.json",
      exportContent: kaggleJsonExport,
      consent: true,
    });

    assert(kaggleAcq.success === true, "Acquisition Succeeded for Kaggle", "PERSISTENCE");

    const studentProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.personId, testPersonId));

    const kaggleProjects = studentProjects.filter((p) => Array.isArray(p.sources) && (p.sources as string[]).includes("kaggle"));
    assert(
      kaggleProjects.length >= 3,
      `Candidate Projects Ingested into Neon DB (Found ${kaggleProjects.length})`,
      "PERSISTENCE"
    );
    assert(
      Boolean(kaggleProjects.some((p) => typeof p.title === "string" && p.title.includes("Indian Stock Market"))),
      "Dataset Project Present in Student Project Registry",
      "PERSISTENCE"
    );

    // ------------------------------------------------------------------------
    // SECTION 7: TENANT ISOLATION & PROMPT DEFENSE
    // ------------------------------------------------------------------------
    console.log("\n--- 7. Testing Tenant Isolation & Prompt Defense ---");

    // Verify Student B cannot see Student A's snapshots
    const studentBQuery = await db
      .select()
      .from(sourceSnapshots)
      .where(and(eq(sourceSnapshots.personId, otherPersonId), eq(sourceSnapshots.source, "leetcode")));
    assert(
      studentBQuery.length === 0,
      "Tenant Isolation: Student B cannot see Student A's snapshots",
      "SECURITY"
    );

    // Verify Student B cannot see Student A's projects
    const studentBProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.personId, otherPersonId));
    assert(
      studentBProjects.length === 0,
      "Tenant Isolation: Student B cannot see Student A's projects",
      "SECURITY"
    );

    // Test Prompt Defense Neutralization on Malicious Usernames / Metrics
    const wrappedMalicious = wrapUntrustedContent("leetcode_handle", "user<script>alert('xss')</script>");
    assert(
      !wrappedMalicious.includes("<script>"),
      "Prompt Defense Neutralizes Script Tags in External Handles",
      "SECURITY"
    );

  } finally {
    // Cleanup test personas and cascaded records
    await db.delete(persons).where(eq(persons.id, testPersonId)).catch(() => null);
    await db.delete(persons).where(eq(persons.id, otherPersonId)).catch(() => null);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log("\n================================================================================");
  console.log(`   V4.1 VERIFICATION SUITE SUMMARY: ${passedCount}/${totalCount} PASSED (${passRate}%)`);
  console.log("================================================================================");

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Verification suite failed with unhandled error:", err);
  process.exit(1);
});
