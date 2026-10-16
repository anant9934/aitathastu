/**
 * AI TATHASTU — DIGITAL FOOTPRINT INTELLIGENCE V4.1
 * CODING PROFILE INTELLIGENCE SERVICE
 *
 * Responsibilities:
 * 1. Platform identification & profile URL normalization
 * 2. Provider access policy enforcement (distinguishing authorized APIs from restricted scrapers)
 * 3. Automatic data acquisition from permitted endpoints (e.g. Kaggle Hub / official APIs)
 * 4. Automatic export parsing for restricted providers (LeetCode, CodeChef, HackerRank, HackerEarth)
 *    so students NEVER have to re-type statistics problem-by-problem
 * 5. Canonical metrics normalization (problemsSolved, easy/medium/hard, rank, ratings, badges, topics)
 * 6. Historical source snapshot persistence in Neon DB with SHA-256 provenance
 * 7. Person 360 evidence item generation with honest trust boundaries
 * 8. Candidate project creation & cross-source deduplication
 * 9. Journey event logging and profile version bumps
 */

import crypto from "node:crypto";
import type { CodingProfileSnapshot, CodingProfileMetrics } from "@/lib/connectors/types";
import { normalizeLeetCodeUsername } from "@/lib/connectors/leetcode/client";
import { normalizeCodingHandle } from "@/lib/connectors/coding-platforms/client";
import { normalizeKaggleUsername, fetchKaggleProfile } from "@/lib/connectors/research-and-dev/client";
import { saveExternalConnection, saveSourceSnapshot } from "@/lib/repositories/connection-repository";
import { createEvidenceRecord } from "@/lib/repositories/evidence-repository";
import { saveProject } from "@/lib/repositories/project-repository";
import { CrossSourceFusionService } from "@/lib/services/cross-source-fusion-service";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";

export type CodingPlatformId = "leetcode" | "codechef" | "hackerrank" | "hackerearth" | "kaggle";

export interface ProviderPolicyAudit {
  providerId: CodingPlatformId;
  displayName: string;
  acquisitionMode:
    | "authorized_api"
    | "permitted_public_api"
    | "authorized_export"
    | "student_uploaded_evidence"
    | "student_reported";
  autoApiAvailable: boolean;
  exportSupported: boolean;
  restrictionsNote: string;
  trustLevel: "self_reported" | "unverified" | "institution_verified";
}

export interface ParseExportResult {
  success: boolean;
  metrics: CodingProfileMetrics;
  extractedProjects?: Array<{
    title: string;
    description: string;
    type: "software" | "research";
    url?: string;
    technologies?: string[];
  }>;
  summary: string;
  rawRecordCount: number;
}

export class CodingProfileIntelligenceService {
  /**
   * Identifies the platform from a profile URL or raw identifier string.
   */
  static identifyPlatform(input: string): CodingPlatformId | null {
    const lower = input.toLowerCase().trim();
    if (lower.includes("leetcode.com")) return "leetcode";
    if (lower.includes("codechef.com")) return "codechef";
    if (lower.includes("hackerrank.com")) return "hackerrank";
    if (lower.includes("hackerearth.com")) return "hackerearth";
    if (lower.includes("kaggle.com")) return "kaggle";
    return null;
  }

  /**
   * Normalizes the handle and canonical profile URL for any supported coding platform.
   */
  static normalizeProfileUrl(
    platform: CodingPlatformId,
    input: string
  ): { username: string; profileUrl: string; valid: boolean } {
    let username = "";
    let profileUrl = "";

    switch (platform) {
      case "leetcode":
        username = normalizeLeetCodeUsername(input);
        profileUrl = `https://leetcode.com/u/${username}`;
        break;
      case "codechef":
        username = normalizeCodingHandle(input, "codechef");
        profileUrl = `https://www.codechef.com/users/${username}`;
        break;
      case "hackerrank":
        username = normalizeCodingHandle(input, "hackerrank");
        profileUrl = `https://www.hackerrank.com/${username}`;
        break;
      case "hackerearth":
        username = normalizeCodingHandle(input, "hackerearth");
        profileUrl = `https://www.hackerearth.com/@${username}`;
        break;
      case "kaggle":
        username = normalizeKaggleUsername(input);
        profileUrl = `https://www.kaggle.com/${username}`;
        break;
    }

    const valid = Boolean(username && username.length >= 2 && !username.includes("/"));
    return { username, profileUrl, valid };
  }

  /**
   * Audits the platform's current authorized access policy.
   * Truthfully distinguishes between live public APIs, user-authorized export parsing,
   * and restricted automated scrapers per provider terms.
   */
  static auditProviderAccessPolicy(platform: CodingPlatformId): ProviderPolicyAudit {
    switch (platform) {
      case "kaggle":
        return {
          providerId: "kaggle",
          displayName: "Kaggle",
          acquisitionMode: "permitted_public_api",
          autoApiAvailable: true,
          exportSupported: true,
          restrictionsNote: "Official public Kaggle API endpoint supported for public datasets, notebooks, and models.",
          trustLevel: "unverified",
        };
      case "leetcode":
        return {
          providerId: "leetcode",
          displayName: "LeetCode",
          acquisitionMode: "authorized_export",
          autoApiAvailable: false,
          exportSupported: true,
          restrictionsNote: "Automated scraping restricted by LeetCode terms. Authorized student export archives and submission logs parsed automatically without manual re-typing.",
          trustLevel: "self_reported",
        };
      case "hackerrank":
        return {
          providerId: "hackerrank",
          displayName: "HackerRank",
          acquisitionMode: "authorized_export",
          autoApiAvailable: false,
          exportSupported: true,
          restrictionsNote: "HackerRank for Work enterprise APIs not licensed for arbitrary consumer scraping. Student-provided skill badge exports and certificates parsed automatically.",
          trustLevel: "self_reported",
        };
      case "codechef":
        return {
          providerId: "codechef",
          displayName: "CodeChef",
          acquisitionMode: "authorized_export",
          autoApiAvailable: false,
          exportSupported: true,
          restrictionsNote: "Unofficial rating scraping prohibited by CodeChef terms. Contest ranking summaries and export files parsed automatically.",
          trustLevel: "self_reported",
        };
      case "hackerearth":
        return {
          providerId: "hackerearth",
          displayName: "HackerEarth",
          acquisitionMode: "authorized_export",
          autoApiAvailable: false,
          exportSupported: true,
          restrictionsNote: "Consumer profile scraping restricted. Hackathon participation exports and practice summaries parsed automatically.",
          trustLevel: "self_reported",
        };
    }
  }

  /**
   * Deterministically parses student-authorized export files (JSON, CSV, or text logs)
   * across all coding platforms so the student does not have to retype numbers manually.
   */
  static parseCodingExportFile(
    platform: CodingPlatformId,
    filename: string,
    rawContent: string
  ): ParseExportResult {
    const cleanName = filename.toLowerCase();
    const content = rawContent.trim();
    const metrics: CodingProfileMetrics = {};
    const extractedProjects: NonNullable<ParseExportResult["extractedProjects"]> = [];
    let recordCount = 0;

    // Helper: Attempt JSON parse
    let jsonData: any = null;
    if (content.startsWith("{") || content.startsWith("[")) {
      try {
        jsonData = JSON.parse(content);
      } catch {
        jsonData = null;
      }
    }

    if (platform === "leetcode") {
      if (jsonData) {
        if (Array.isArray(jsonData)) {
          // Array of solved problems e.g. [{ title, difficulty, status, topic }]
          recordCount = jsonData.length;
          let easy = 0;
          let medium = 0;
          let hard = 0;
          const topics: Record<string, number> = {};

          for (const item of jsonData) {
            const diff = String(item.difficulty || "").toLowerCase();
            const status = String(item.status || item.verdict || "accepted").toLowerCase();
            if (status.includes("accept") || status.includes("solv") || !item.status) {
              if (diff === "easy") easy++;
              else if (diff === "medium") medium++;
              else if (diff === "hard") hard++;

              if (item.topic) {
                const t = String(item.topic);
                topics[t] = (topics[t] || 0) + 1;
              }
            }
          }

          metrics.easySolved = easy;
          metrics.mediumSolved = medium;
          metrics.hardSolved = hard;
          metrics.problemsSolved = easy + medium + hard;
          metrics.topicCounts = topics;
        } else if (typeof jsonData === "object") {
          // Direct metrics object e.g. { totalSolved, easySolved, mediumSolved, hardSolved, ranking, reputation }
          metrics.problemsSolved = Number(jsonData.totalSolved || jsonData.problemsSolved || jsonData.solved) || 0;
          metrics.easySolved = Number(jsonData.easySolved || jsonData.easy) || 0;
          metrics.mediumSolved = Number(jsonData.mediumSolved || jsonData.medium) || 0;
          metrics.hardSolved = Number(jsonData.hardSolved || jsonData.hard) || 0;
          if (jsonData.ranking || jsonData.globalRanking) {
            metrics.globalRank = Number(jsonData.ranking || jsonData.globalRanking);
          }
          if (jsonData.contestRating) {
            metrics.contestRating = Number(jsonData.contestRating);
          }
          if (jsonData.topics && typeof jsonData.topics === "object") {
            metrics.topicCounts = jsonData.topics;
          }
          recordCount = metrics.problemsSolved || 1;
        }
      } else {
        // CSV or text parsing
        const lines = content.split(/\r?\n/).filter(Boolean);
        recordCount = lines.length;

        // Check for CSV headers
        if (cleanName.endsWith(".csv") || content.includes(",")) {
          let easy = 0;
          let medium = 0;
          let hard = 0;
          for (const line of lines) {
            const lower = line.toLowerCase();
            if (lower.includes("easy")) easy++;
            else if (lower.includes("medium")) medium++;
            else if (lower.includes("hard")) hard++;
          }
          if (easy > 0 || medium > 0 || hard > 0) {
            metrics.easySolved = easy;
            metrics.mediumSolved = medium;
            metrics.hardSolved = hard;
            metrics.problemsSolved = easy + medium + hard;
          }
        }

        // Regex heuristic fallback for text summary
        const solvedMatch = content.match(/(?:solved|total|problems)[\s:]+(\d+)/i);
        const easyMatch = content.match(/easy[\s:]+(\d+)/i);
        const medMatch = content.match(/(?:medium|med)[\s:]+(\d+)/i);
        const hardMatch = content.match(/hard[\s:]+(\d+)/i);
        const rankMatch = content.match(/(?:rank|ranking)[\s:]+(\d+)/i);

        if (solvedMatch && !metrics.problemsSolved) metrics.problemsSolved = parseInt(solvedMatch[1], 10);
        if (easyMatch && !metrics.easySolved) metrics.easySolved = parseInt(easyMatch[1], 10);
        if (medMatch && !metrics.mediumSolved) metrics.mediumSolved = parseInt(medMatch[1], 10);
        if (hardMatch && !metrics.hardSolved) metrics.hardSolved = parseInt(hardMatch[1], 10);
        if (rankMatch && !metrics.globalRank) metrics.globalRank = parseInt(rankMatch[1], 10);
      }

      return {
        success: Boolean(metrics.problemsSolved || metrics.easySolved || metrics.globalRank),
        metrics,
        summary: `Parsed LeetCode export (${filename}): ${metrics.problemsSolved ?? 0} problems solved (${metrics.easySolved ?? 0} Easy, ${metrics.mediumSolved ?? 0} Medium, ${metrics.hardSolved ?? 0} Hard).`,
        rawRecordCount: recordCount,
      };
    }

    if (platform === "codechef") {
      if (jsonData) {
        metrics.contestRating = Number(jsonData.rating || jsonData.contestRating) || undefined;
        metrics.problemsSolved = Number(jsonData.problemsSolved || jsonData.solved) || undefined;
        metrics.globalRank = Number(jsonData.globalRank || jsonData.rank) || undefined;
        metrics.contestCount = Number(jsonData.contests || jsonData.contestCount) || undefined;
        recordCount = metrics.problemsSolved || 1;
      } else {
        const ratingMatch = content.match(/rating[\s:]+(\d+)/i);
        const solvedMatch = content.match(/(?:solved|problems)[\s:]+(\d+)/i);
        const rankMatch = content.match(/(?:rank|global)[\s:]+(\d+)/i);
        if (ratingMatch) metrics.contestRating = parseInt(ratingMatch[1], 10);
        if (solvedMatch) metrics.problemsSolved = parseInt(solvedMatch[1], 10);
        if (rankMatch) metrics.globalRank = parseInt(rankMatch[1], 10);
        recordCount = content.split(/\r?\n/).length;
      }

      return {
        success: Boolean(metrics.contestRating || metrics.problemsSolved),
        metrics,
        summary: `Parsed CodeChef export (${filename}): Rating ${metrics.contestRating ?? "N/A"}, Solved: ${metrics.problemsSolved ?? "N/A"}.`,
        rawRecordCount: recordCount,
      };
    }

    if (platform === "hackerrank") {
      const badges: Array<{ name: string; sourceUrl?: string }> = [];
      if (jsonData) {
        if (Array.isArray(jsonData.badges)) {
          for (const b of jsonData.badges) {
            badges.push({ name: String(b.name || b.badge || b), sourceUrl: b.url });
          }
        }
        metrics.problemsSolved = Number(jsonData.problemsSolved || jsonData.solved) || undefined;
        metrics.contestRating = Number(jsonData.rating) || undefined;
        recordCount = badges.length || 1;
      } else {
        const lines = content.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          if (line.toLowerCase().includes("badge") || line.toLowerCase().includes("star")) {
            badges.push({ name: line.trim() });
          }
        }
        recordCount = lines.length;
      }

      if (badges.length > 0) metrics.badges = badges;

      return {
        success: Boolean(badges.length > 0 || metrics.problemsSolved),
        metrics,
        summary: `Parsed HackerRank export (${filename}): Found ${badges.length} skill badges.`,
        rawRecordCount: recordCount,
      };
    }

    if (platform === "hackerearth") {
      if (jsonData) {
        metrics.contestRating = Number(jsonData.rating) || undefined;
        metrics.problemsSolved = Number(jsonData.problemsSolved || jsonData.solved) || undefined;
        metrics.contestCount = Number(jsonData.hackathons || jsonData.contests) || undefined;
        recordCount = metrics.problemsSolved || 1;
      } else {
        const ratingMatch = content.match(/rating[\s:]+(\d+)/i);
        const solvedMatch = content.match(/(?:solved|problems)[\s:]+(\d+)/i);
        if (ratingMatch) metrics.contestRating = parseInt(ratingMatch[1], 10);
        if (solvedMatch) metrics.problemsSolved = parseInt(solvedMatch[1], 10);
        recordCount = content.split(/\r?\n/).length;
      }

      return {
        success: Boolean(metrics.contestRating || metrics.problemsSolved),
        metrics,
        summary: `Parsed HackerEarth export (${filename}): Rating ${metrics.contestRating ?? "N/A"}, Problems ${metrics.problemsSolved ?? "N/A"}.`,
        rawRecordCount: recordCount,
      };
    }

    if (platform === "kaggle") {
      if (jsonData) {
        const rawDatasets = Array.isArray(jsonData.datasets) ? jsonData.datasets : [];
        const rawKernels = Array.isArray(jsonData.kernels || jsonData.notebooks) ? (jsonData.kernels || jsonData.notebooks) : [];
        const rawModels = Array.isArray(jsonData.models) ? jsonData.models : [];

        for (const d of rawDatasets) {
          extractedProjects.push({
            title: `Kaggle Dataset: ${d.title || d.ref || "Untitled"}`,
            description: d.description || `Dataset published on Kaggle. Votes: ${d.totalVotes || 0}`,
            type: "research",
            url: d.url || (d.ref ? `https://www.kaggle.com/datasets/${d.ref}` : undefined),
            technologies: ["Kaggle", "Data Engineering", "Dataset"],
          });
        }

        for (const k of rawKernels) {
          extractedProjects.push({
            title: `Kaggle Notebook: ${k.title || k.ref || "Untitled"}`,
            description: k.description || `Notebook on Kaggle. Language: ${k.language || "Python"}`,
            type: "software",
            url: k.url || (k.ref ? `https://www.kaggle.com/code/${k.ref}` : undefined),
            technologies: [k.language || "Python", "Jupyter", "Kaggle", "Machine Learning"],
          });
        }

        for (const m of rawModels) {
          extractedProjects.push({
            title: `Kaggle Model: ${m.title || m.ref || "Untitled"}`,
            description: m.description || `Model on Kaggle. Framework: ${m.framework || "PyTorch"}`,
            type: "software",
            url: m.url,
            technologies: [m.framework || "PyTorch", "Kaggle", "AI/ML"],
          });
        }

        recordCount = extractedProjects.length;
      }

      return {
        success: extractedProjects.length > 0,
        metrics: {
          contestCount: extractedProjects.length,
        },
        extractedProjects,
        summary: `Parsed Kaggle export (${filename}): Extracted ${extractedProjects.length} candidate projects.`,
        rawRecordCount: recordCount,
      };
    }

    return {
      success: false,
      metrics: {},
      summary: "Unsupported platform export format.",
      rawRecordCount: 0,
    };
  }

  /**
   * Universal acquisition & normalization engine for coding platforms.
   * Dispatches to live API or export parser, stores snapshot in Neon DB,
   * updates Person 360, creates candidate projects, and logs journey events.
   */
  static async acquireAndNormalizeCodingProfile(params: {
    personId: string;
    platform: CodingPlatformId;
    identifier: string;
    exportFilename?: string;
    exportContent?: string;
    consent: boolean;
    manualMetrics?: CodingProfileMetrics;
    jobId?: string;
  }): Promise<{
    success: boolean;
    snapshot: CodingProfileSnapshot;
    recordsCreated: number;
    summary: string;
    details: Record<string, unknown>;
  }> {
    const { personId, platform, identifier, exportFilename, exportContent, consent, manualMetrics } = params;

    if (!consent) {
      throw new Error("Student consent is required before synchronizing coding profile data.");
    }

    const { username, profileUrl, valid } = this.normalizeProfileUrl(platform, identifier);
    if (!valid && !exportContent) {
      throw new Error(`Invalid username or profile link for ${platform}.`);
    }

    const policy = this.auditProviderAccessPolicy(platform);
    const now = new Date().toISOString();

    // 1. Start or reuse Audited Job
    const jobId = params.jobId || await SourceProcessingJobService.startJob({
      personId,
      sourceId: platform,
      stage: "acquire",
      metadata: { username, profileUrl, hasExport: Boolean(exportContent) },
    });

    let metrics: CodingProfileMetrics = {};
    let candidateProjects: NonNullable<ParseExportResult["extractedProjects"]> = [];
    let acquisitionMode: CodingProfileSnapshot["acquisitionMode"] = "student_reported";
    let summary = "";
    let recordsCreated = 0;

    // 2. Acquisition Phase
    if (exportContent && exportFilename) {
      // Automatic Export Parsing Branch
      await SourceProcessingJobService.updateStage(jobId, personId, "parse");
      const parsed = this.parseCodingExportFile(platform, exportFilename, exportContent);
      await SourceProcessingJobService.updateStage(jobId, personId, "extract");

      metrics = parsed.metrics;
      candidateProjects = parsed.extractedProjects || [];
      acquisitionMode = "authorized_export";
      summary = parsed.summary;
    } else if (platform === "kaggle") {
      // Kaggle Live API Branch (Section 9)
      await SourceProcessingJobService.updateStage(jobId, personId, "parse");
      const kaggleData = fetchKaggleProfile(username);
      await SourceProcessingJobService.updateStage(jobId, personId, "extract");

      if (kaggleData.studentReportedArtifacts && kaggleData.studentReportedArtifacts.length > 0) {
        for (const art of kaggleData.studentReportedArtifacts) {
          candidateProjects.push({
            title: `Kaggle ${art.type}: ${art.title}`,
            description: art.description || `Kaggle ${art.type} by ${username}`,
            type: art.type === "dataset" ? "research" : "software",
            url: art.url || profileUrl,
            technologies: ["Kaggle", "Data Science", "Python"],
          });
        }
      }

      acquisitionMode = "permitted_public_api";
      summary = `Retrieved public Kaggle profile (${profileUrl}). Discovered ${candidateProjects.length} candidate artifacts.`;
    } else {
      // Restricted Provider Link Branch (Sections 5, 6, 7, 8)
      // Automated scraping is restricted per provider terms; preserve reference + student-reported metrics
      await SourceProcessingJobService.updateStage(jobId, personId, "extract");
      metrics = manualMetrics || {};
      acquisitionMode = manualMetrics ? "student_reported" : "student_uploaded_evidence";
      summary = `${policy.displayName} profile linked (${profileUrl}). Automated scraping disabled per provider terms.`;
    }

    // 3. Persist Candidate Projects (e.g. for Kaggle)
    for (const proj of candidateProjects) {
      await saveProject(personId, {
        title: proj.title,
        summary: proj.description,
        description: proj.description,
        demoUrl: proj.url,
        technologies: proj.technologies || ["Python", "Kaggle"],
        sources: [platform],
        status: "candidate",
        projectType: proj.type,
      });
      recordsCreated++;
    }

    // 4. Create Evidence Record in Person 360
    if (metrics.problemsSolved && metrics.problemsSolved > 0) {
      const breakdown = [
        metrics.easySolved ? `${metrics.easySolved} Easy` : null,
        metrics.mediumSolved ? `${metrics.mediumSolved} Medium` : null,
        metrics.hardSolved ? `${metrics.hardSolved} Hard` : null,
      ]
        .filter(Boolean)
        .join(", ");

      const valueStr = breakdown
        ? `${metrics.problemsSolved} problems solved (${breakdown})`
        : `${metrics.problemsSolved} problems solved`;

      await createEvidenceRecord(personId, {
        category: "other",
        subject: `${policy.displayName} Problem Solving`,
        value: valueStr,
        source: acquisitionMode === "authorized_export" ? "imported" : "self_reported",
        verificationStatus: "unverified",
        sourceReference: profileUrl,
        interpretation: `Coding statistics parsed from student's ${policy.displayName} ${acquisitionMode === "authorized_export" ? "authorized export archive" : "profile"}.`,
        whyItMatters: "Demonstrates consistent algorithmic problem solving and data structure practice.",
      });
      recordsCreated++;
    }

    if (metrics.contestRating && metrics.contestRating > 0) {
      await createEvidenceRecord(personId, {
        category: "other",
        subject: `${policy.displayName} Contest Rating`,
        value: `Rating: ${metrics.contestRating}${metrics.globalRank ? `, Global Rank: ${metrics.globalRank}` : ""}`,
        source: acquisitionMode === "authorized_export" ? "imported" : "self_reported",
        verificationStatus: "unverified",
        sourceReference: profileUrl,
        interpretation: `Competitive programming performance recorded from ${policy.displayName}.`,
        whyItMatters: "Contest performance under time constraints demonstrates algorithmic efficiency.",
      });
      recordsCreated++;
    }

    if (metrics.badges && metrics.badges.length > 0) {
      for (const b of metrics.badges) {
        await createEvidenceRecord(personId, {
          category: "other",
          subject: `${policy.displayName} Badge: ${b.name}`,
          value: b.sourceUrl || "Earned Badge",
          source: acquisitionMode === "authorized_export" ? "imported" : "self_reported",
          verificationStatus: "unverified",
          sourceReference: profileUrl,
          interpretation: `Skill badge extracted from student's ${policy.displayName} account.`,
          whyItMatters: "Corroborates topic practice and domain fluency.",
        });
        recordsCreated++;
      }
    }

    // 5. Build Canonical Snapshot
    const snapshotPayload = {
      platform,
      username,
      profileUrl,
      metrics,
      candidateProjects,
      policy,
      observedAt: now,
    };

    const checksum = crypto
      .createHash("sha256")
      .update(JSON.stringify(snapshotPayload))
      .digest("hex");

    const savedSnapshot = await saveSourceSnapshot(
      personId,
      platform,
      profileUrl,
      snapshotPayload,
      checksum
    );

    // 6. Update External Connection
    await saveExternalConnection({
      personId,
      provider: platform,
      externalUsername: username,
      profileUrl,
      displayName: username,
      status: acquisitionMode === "authorized_export" || acquisitionMode === "permitted_public_api"
        ? "connected"
        : "reference_only",
      metadata: {
        lastMetrics: metrics,
        acquisitionMode,
        restrictionsNote: policy.restrictionsNote,
      },
    });

    // 7. Complete Job Audit
    await SourceProcessingJobService.completeJob({
      jobId,
      personId,
      resultReference: savedSnapshot.id,
      metadata: { recordsCreated, acquisitionMode },
    });

    // 8. Record Profile Version Bump & Journey Event
    await CrossSourceFusionService.recordProfileVersion(
      personId,
      "evidence_added",
      `Synchronized ${policy.displayName} coding profile (${acquisitionMode}).`,
      { platform, metrics, recordsCreated }
    );

    await createJourneyEventRecord(personId, {
      type: "coding_profile_synced",
      title: `Synchronized ${policy.displayName}`,
      description: summary,
      metadata: { platform, acquisitionMode, metrics, recordsCreated },
    });

    const canonicalSnapshot: CodingProfileSnapshot = {
      personId,
      providerId: platform,
      username,
      profileUrl,
      acquisitionMode,
      ownershipState: "student_confirmed",
      metrics,
      observedAt: now,
      sourceSnapshotId: savedSnapshot.id,
      lastSyncStatus: "success",
    };

    return {
      success: true,
      snapshot: canonicalSnapshot,
      recordsCreated,
      summary,
      details: snapshotPayload,
    };
  }
}
