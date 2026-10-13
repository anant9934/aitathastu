/**
 * AI TATHASTU — V4.6 UNIFIED DIGITAL SOURCE IMPORT ORCHESTRATOR
 *
 * Responsibilities:
 * 1. Validate profile references across all 13 supported digital identity platforms.
 * 2. Identify provider capabilities, acquisition modes, and trust boundaries.
 * 3. Present clear source-specific consent disclosures with explicit data collection policies.
 * 4. Authenticate where necessary (OAuth / GitHub App / signed tokens).
 * 5. Execute supported import workflows with durable job lifecycle tracking.
 * 6. Normalize results into canonical candidate projects, skills, education, experience, and achievements.
 * 7. Persist source snapshots with SHA-256 checksums in Neon DB.
 * 8. Deduplicate canonical records across CV and external digital footprints.
 * 9. Generate reviewable evidence items with honest provenance (no fabricated mastery scores).
 * 10. Enable seamless propagation into Step 8 Review and student dashboard.
 *
 * Zero-LLM architecture: 100% deterministic parsing, official REST/GraphQL APIs, and verified archives.
 */

import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb, externalConnections, sourceSnapshots, evidenceItems, projects } from "@/lib/db";
import {
  saveExternalConnection,
  saveSourceSnapshot,
  getLatestSourceSnapshot,
  disconnectConnection,
  getExternalConnectionByProvider,
} from "@/lib/repositories/connection-repository";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { PROVIDER_CAPABILITIES_V4 } from "@/lib/connectors/registry";
import type { ProviderCapabilities, AcquisitionMode } from "@/lib/connectors/types";

// Official Platform Connectors
import { fetchGitHubIntelligence } from "@/lib/connectors/github/client";
import { fetchPortfolioMetadata, isSafePublicUrl } from "@/lib/connectors/portfolio/client";
import {
  validateLinkedInUrl,
  parseLinkedInDataExport,
  parseLinkedInZipArchive,
} from "@/lib/connectors/linkedin/client";
import { fetchLeetCodeProfileStats, normalizeLeetCodeUsername } from "@/lib/connectors/leetcode/client";
import {
  fetchHackerRankProfile,
  fetchCodeChefProfile,
  fetchHackerEarthProfile,
  normalizeCodingHandle,
} from "@/lib/connectors/coding-platforms/client";
import {
  fetchHuggingFaceArtifacts,
  fetchOrcidRecord,
  fetchDevToArticles,
  fetchStackOverflowProfile,
  fetchKaggleApiData,
  validateGoogleScholarProfile,
} from "@/lib/connectors/research-and-dev/client";
import { CodingProfileIntelligenceService } from "@/lib/services/coding-profile-intelligence-service";
import { isValidOrcidChecksum } from "@/lib/services/digital-footprint-registry";

export interface ProfileValidationResult {
  valid: boolean;
  provider: string;
  normalizedIdentifier: string;
  normalizedUrl: string;
  displayName?: string;
  error?: string;
}

export interface ConsentDisclosure {
  provider: string;
  displayName: string;
  actionLabel: "Connect & Import" | "Authorize & Import" | "Import Your Data" | "Add Profile Reference";
  dataCollected: string[];
  strictGuarantees: string[];
  privacyNotice: string;
  requiresFile: boolean;
  requiresOAuth: boolean;
}

export interface ImportCandidateOutput {
  projects: Array<{
    id?: string;
    title: string;
    description?: string;
    technologies: string[];
    url?: string;
    source: string;
    starsOrLikes?: number;
    primaryLanguage?: string | null;
    aiMlCategories?: string[];
  }>;
  skills: Array<{
    name: string;
    sourceReference: string;
    confidence?: string;
  }>;
  experiences?: Array<{
    title: string;
    company: string;
    duration?: string;
    sourceReference: string;
  }>;
  educations?: Array<{
    school: string;
    degree?: string;
    sourceReference: string;
  }>;
  achievements?: Array<{
    title: string;
    category: string;
    sourceReference: string;
    value?: string;
  }>;
}

export interface ImportExecutionResult {
  success: boolean;
  provider: string;
  acquisitionMode: AcquisitionMode;
  externalUsername: string;
  profileUrl: string;
  recordsCreated: number;
  candidateCount: number;
  projectsCount: number;
  skillsCount: number;
  evidenceCount: number;
  summary: string;
  candidates: ImportCandidateOutput;
  lastSyncedAt: string;
  jobId: string;
  error?: string;
  /** GitHub only: "detected" for a typed username, "connected" only after OAuth. */
  connectionStatus?: "connected" | "detected";
  /** True when some data could not be fetched (rate limits, truncated repo list). */
  partial?: boolean;
}

export interface SourceStatusSummary {
  provider: string;
  status:
    | "Not Connected"
    | "Found in your resume"
    | "Profile Linked"
    | "Connected"
    | "Public Data Imported"
    | "Importing"
    | "Import Completed"
    | "Review Required"
    | "Import Failed"
    | "Disconnected";
  actionLabel: string;
  profileUrl?: string;
  lastSyncedAt?: string;
  recordCount: number;
}

export class DigitalSourceImportOrchestrator {
  /**
   * Retrieves provider capabilities from registry.
   */
  static getCapabilities(provider: string): ProviderCapabilities {
    const caps = PROVIDER_CAPABILITIES_V4[provider];
    if (!caps) {
      throw new Error(`Unsupported digital footprint provider: '${provider}'.`);
    }
    return caps;
  }

  /**
   * Validates and normalizes profile URLs and handles.
   */
  static validateProfile(provider: string, input: string): ProfileValidationResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return {
        valid: false,
        provider,
        normalizedIdentifier: "",
        normalizedUrl: "",
        error: "Profile identifier or URL is required.",
      };
    }

    switch (provider) {
      case "github": {
        const clean = trimmed
          .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
          .replace(/\/$/, "")
          .split("/")[0];
        if (!/^[a-zA-Z0-9_\-\.]{1,39}$/.test(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid GitHub username format." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://github.com/${clean}`,
          displayName: clean,
        };
      }

      case "portfolio": {
        const check = isSafePublicUrl(trimmed);
        if (!check.safe || !check.parsed) {
          return { valid: false, provider, normalizedIdentifier: trimmed, normalizedUrl: "", error: check.reason || "Invalid portfolio URL." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: check.parsed.hostname,
          normalizedUrl: check.parsed.toString(),
          displayName: check.parsed.hostname,
        };
      }

      case "linkedin": {
        const check = validateLinkedInUrl(trimmed);
        if (!check.valid) {
          return { valid: false, provider, normalizedIdentifier: "", normalizedUrl: "", error: check.error || "Invalid LinkedIn URL." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: check.username,
          normalizedUrl: check.normalizedUrl,
          displayName: check.username,
        };
      }

      case "huggingface": {
        const clean = trimmed
          .replace(/^(?:https?:\/\/)?(?:www\.)?huggingface\.co\//i, "")
          .replace(/\/$/, "")
          .split("/")[0];
        if (!/^[a-zA-Z0-9_\-\.]{2,50}$/.test(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid Hugging Face username format." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://huggingface.co/${clean}`,
          displayName: clean,
        };
      }

      case "orcid": {
        const clean = trimmed.replace(/^(?:https?:\/\/)?orcid\.org\//i, "").trim();
        if (!isValidOrcidChecksum(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid ORCID checksum (ISO 7064 Mod 11,2)." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://orcid.org/${clean}`,
          displayName: `ORCID: ${clean}`,
        };
      }

      case "devto": {
        const clean = trimmed
          .replace(/^(?:https?:\/\/)?(?:www\.)?dev\.to\//i, "")
          .replace(/\/$/, "")
          .split("/")[0];
        if (!/^[a-zA-Z0-9_\-\.]{2,50}$/.test(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid DEV.to username format." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://dev.to/${clean}`,
          displayName: clean,
        };
      }

      case "stackoverflow": {
        const clean = trimmed
          .replace(/^(?:https?:\/\/)?(?:www\.)?stackoverflow\.com\/users\//i, "")
          .replace(/\/$/, "")
          .split("/")[0];
        if (!/^\d+$/.test(clean) && !/^[a-zA-Z0-9_\-\.]{2,50}$/.test(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid Stack Overflow user ID." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://stackoverflow.com/users/${clean}`,
          displayName: `SO User ${clean}`,
        };
      }

      case "leetcode": {
        const clean = normalizeLeetCodeUsername(trimmed);
        if (!/^[a-zA-Z0-9_\-]{2,50}$/.test(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid LeetCode username." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://leetcode.com/u/${clean}`,
          displayName: clean,
        };
      }

      case "hackerrank": {
        const clean = normalizeCodingHandle(trimmed, "hackerrank");
        if (!/^[a-zA-Z0-9_\-\.]{2,50}$/.test(clean)) {
          return { valid: false, provider, normalizedIdentifier: clean, normalizedUrl: "", error: "Invalid HackerRank username." };
        }
        return {
          valid: true,
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://www.hackerrank.com/${clean}`,
          displayName: clean,
        };
      }

      case "codechef": {
        const clean = normalizeCodingHandle(trimmed, "codechef");
        return {
          valid: Boolean(clean),
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://www.codechef.com/users/${clean}`,
          displayName: clean,
        };
      }

      case "hackerearth": {
        const clean = normalizeCodingHandle(trimmed, "hackerearth");
        return {
          valid: Boolean(clean),
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://www.hackerearth.com/@${clean}`,
          displayName: clean,
        };
      }

      case "kaggle": {
        const clean = trimmed
          .replace(/^(?:https?:\/\/)?(?:www\.)?kaggle\.com\//i, "")
          .replace(/\/$/, "")
          .split("/")[0];
        return {
          valid: Boolean(clean),
          provider,
          normalizedIdentifier: clean,
          normalizedUrl: `https://www.kaggle.com/${clean}`,
          displayName: clean,
        };
      }

      case "google_scholar": {
        const check = validateGoogleScholarProfile(trimmed);
        return {
          valid: check.status !== "UNAVAILABLE",
          provider,
          normalizedIdentifier: check.scholarId,
          normalizedUrl: check.profileUrl,
          displayName: `Scholar: ${check.scholarId}`,
          error: check.notes,
        };
      }

      default:
        return { valid: false, provider, normalizedIdentifier: trimmed, normalizedUrl: trimmed, error: `Unsupported provider: ${provider}` };
    }
  }

  /**
   * Generates clear, source-specific consent disclosures.
   */
  static getConsentDisclosure(provider: string): ConsentDisclosure {
    switch (provider) {
      case "github":
        return {
          provider: "github",
          displayName: "GitHub",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Public repositories and descriptions",
            "Observed languages and byte breakdowns",
            "Declared dependencies from requirements.txt, package.json, Dockerfile",
            "Repository stars, forks, and commit activity indicators",
          ],
          strictGuarantees: [
            "Zero private repository access requested without explicit GitHub App installation.",
            "No full codebase cloning; only permitted file manifests inspected.",
            "All discovered projects initialized as candidate review items in Step 8.",
          ],
          privacyNotice: "Public repository inspection runs over the official GitHub REST API.",
          requiresFile: false,
          requiresOAuth: false,
        };

      case "huggingface":
        return {
          provider: "huggingface",
          displayName: "Hugging Face",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Public model repositories and pipeline task tags (e.g. text-generation, cv)",
            "Public datasets and Space applications",
            "Download counts and community likes",
          ],
          strictGuarantees: [
            "Zero private models or gated datasets accessed.",
            "Demonstrates practical AI/ML deployment, fine-tuning, or open weights.",
          ],
          privacyNotice: "Fetched via official Hugging Face Hub public API.",
          requiresFile: false,
          requiresOAuth: false,
        };

      case "orcid":
        return {
          provider: "orcid",
          displayName: "ORCID Academic Record",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Verified scholarly publications and works",
            "DOIs, journal names, and publication years",
            "Author record identity (ISO 7064 Mod 11,2 validated)",
          ],
          strictGuarantees: [
            "Only official public registry records are queried.",
            "DOI links preserved for verifiable third-party academic audit.",
          ],
          privacyNotice: "Queried directly from the official ORCID Public API v3.0.",
          requiresFile: false,
          requiresOAuth: false,
        };

      case "devto":
        return {
          provider: "devto",
          displayName: "DEV Community",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Published technical articles and tutorial posts",
            "Topic tags and technical categories",
            "Positive reaction counts and publication dates",
          ],
          strictGuarantees: [
            "Only public blog posts published under the author's handle are retrieved.",
            "Demonstrates domain clarity and technical communication.",
          ],
          privacyNotice: "Retrieved via the official Forem API.",
          requiresFile: false,
          requiresOAuth: false,
        };

      case "stackoverflow":
        return {
          provider: "stackoverflow",
          displayName: "Stack Overflow",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Public developer reputation score",
            "Top question & answer tags (e.g. python, pytorch)",
            "Gold, silver, and bronze badge totals",
          ],
          strictGuarantees: [
            "Public Stack Exchange profile statistics only.",
            "No private account data or password required.",
          ],
          privacyNotice: "Fetched via the official Stack Exchange API v2.3.",
          requiresFile: false,
          requiresOAuth: false,
        };

      case "portfolio":
        return {
          provider: "portfolio",
          displayName: "Personal Portfolio",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Website title, meta description, and author attribution",
            "Verified outward project links and demonstrations",
            "Detected client-side frameworks and technologies",
          ],
          strictGuarantees: [
            "Strict Server-Side Request Forgery (SSRF) defense actively blocks internal networks.",
            "No client scripts executed; read-only HTML metadata parsing.",
          ],
          privacyNotice: "Fetched directly from the student's public HTTPS website.",
          requiresFile: false,
          requiresOAuth: false,
        };

      case "linkedin":
        return {
          provider: "linkedin",
          displayName: "LinkedIn",
          actionLabel: "Import Your Data",
          dataCollected: [
            "Work positions and employment history (from Positions.csv)",
            "Academic qualifications and school history (from Education.csv)",
            "Reported skills and certifications (from Skills.csv / Certifications.csv)",
          ],
          strictGuarantees: [
            "LinkedIn Terms of Service prohibit third-party automated scraping.",
            "Requires student-authorized export archive (.zip or .csv) to ensure 100% legal compliance.",
            "Imported records tagged with exact file line numbers for student review.",
          ],
          privacyNotice: "Files are parsed deterministically on-demand; no raw export files are retained permanently.",
          requiresFile: true,
          requiresOAuth: false,
        };

      case "leetcode":
      case "hackerrank":
      case "codechef":
      case "hackerearth":
        return {
          provider,
          displayName: provider === "leetcode" ? "LeetCode" : provider === "hackerrank" ? "HackerRank" : provider === "codechef" ? "CodeChef" : "HackerEarth",
          actionLabel: "Connect & Import",
          dataCollected: [
            "Public problem solving counts and tier badges",
            "Contest ratings and global rankings where publicly exposed",
            "Student-authorized export summaries if provided",
          ],
          strictGuarantees: [
            "Never scrapes behind authentication.",
            "Truthfully distinguishes verified public signals from self-reported practice.",
          ],
          privacyNotice: "Acquired via official/permitted public endpoints or student-uploaded summaries.",
          requiresFile: false,
          requiresOAuth: false,
        };

      default:
        return {
          provider,
          displayName: provider,
          actionLabel: "Connect & Import",
          dataCollected: ["Public profile reference"],
          strictGuarantees: ["No unauthorized scraping."],
          privacyNotice: "Standard public profile linking.",
          requiresFile: false,
          requiresOAuth: false,
        };
    }
  }

  /**
   * Executes the full authorized import flow for any supported provider.
   */
  static async startImport(params: {
    personId: string;
    provider: string;
    identifier?: string;
    exportFilename?: string;
    exportContent?: string;
    consent: boolean;
    token?: string;
    jobId?: string;
  }): Promise<ImportExecutionResult> {
    const { personId, provider, identifier = "", exportFilename, exportContent, consent, token, jobId: requestedJobId } = params;

    if (!consent) {
      throw new Error(`Student consent is mandatory before importing from ${provider}.`);
    }

    // 1. Audit Job Lifecycle
    let jobId: string;
    if (requestedJobId) {
      const existing = await SourceProcessingJobService.getJobForPerson(requestedJobId, personId);
      if (!existing || existing.sourceId !== provider || existing.status !== "running") {
        throw new Error("Invalid or expired processing job.");
      }
      jobId = existing.id;
    } else {
      jobId = await SourceProcessingJobService.startJob({
        personId,
        sourceId: provider,
        stage: "acquire",
      });
    }

    await SourceProcessingJobService.updateStage(jobId, personId, "parse");

    const candidates: ImportCandidateOutput = {
      projects: [],
      skills: [],
      experiences: [],
      educations: [],
      achievements: [],
    };

    let summary = "";
    let acquisitionMode: AcquisitionMode = "PERMITTED_PUBLIC_METADATA";
    let connectionStatus: ImportExecutionResult["connectionStatus"];
    let partial = false;
    let externalUsername = identifier.trim();
    let profileUrl = identifier.trim();
    let rawSnapshotPayload: Record<string, unknown> = {};

    try {
      // 2. Provider Execution Dispatch
      switch (provider) {
        // ====================================================================
        // GITHUB (HIGHEST PRIORITY) — Reuses V4.3 Live Intelligence Engine
        // ====================================================================
        case "github": {
          const val = this.validateProfile("github", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid GitHub username.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          await SourceProcessingJobService.updateStage(jobId, personId, "extract");
          const ghResult = await fetchGitHubIntelligence(externalUsername);
          if (!ghResult.success) {
            throw new Error(ghResult.error || `Could not fetch GitHub account '${externalUsername}'.`);
          }

          acquisitionMode = "OFFICIAL_PUBLIC_API";

          // A typed username is only "detected"; "connected" requires OAuth
          // (/api/auth/github/*). Keep an existing OAuth connection for the same account.
          const priorGithub = await getExternalConnectionByProvider(personId, "github");
          connectionStatus = priorGithub?.status === "connected" &&
            priorGithub.externalUsername.toLowerCase() === ghResult.username.toLowerCase() ? "connected" : "detected";
          partial = ghResult.failedRepos.length > 0 || ghResult.truncated;

          await saveExternalConnection({
            personId,
            provider: "github",
            externalAccountId: ghResult.profile?.id ? String(ghResult.profile.id) : undefined,
            externalUsername: ghResult.username,
            displayName: ghResult.profile?.name || ghResult.username,
            profileUrl: ghResult.profile?.html_url || `https://github.com/${ghResult.username}`,
            status: connectionStatus,
            metadata: {
              ownershipVerified: connectionStatus === "connected",
              failedRepos: ghResult.failedRepos,
              truncated: ghResult.truncated,
              connectionState: "PUBLIC_DATA_IMPORTED",
              totalPublicRepos: ghResult.totalPublicRepos,
              fetchedReposCount: ghResult.fetchedReposCount,
              analyzedReposCount: ghResult.analyzedReposCount,
              avatarUrl: ghResult.profile?.avatar_url,
              bio: ghResult.profile?.bio,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          // Ingest candidate projects & technology findings
          for (const p of ghResult.projects) {
            candidates.projects.push({
              title: p.title,
              description: p.description || "",
              technologies: p.technologies || [],
              url: p.repositoryUrl,
              source: "github",
              starsOrLikes: p.stars,
              primaryLanguage: p.primaryLanguage,
              aiMlCategories: p.aiMlCategories,
            });

            for (const finding of p.technologyFindings) {
              const sourceRef = finding.sourceFile ? `${p.repositoryUrl}#${finding.sourceFile}` : p.repositoryUrl;
              candidates.skills.push({
                name: finding.name,
                sourceReference: sourceRef,
                confidence: finding.confidence ? String(finding.confidence) : undefined,
              });
              }
          }

          rawSnapshotPayload = ghResult as unknown as Record<string, unknown>;
          summary = `Discovered ${ghResult.projects.length} GitHub repository candidates for '${ghResult.username}', pending your review.`;
          if (ghResult.failedRepos.length > 0) {
            summary += ` Partial data: ${ghResult.failedRepos.length} repo(s) couldn't be analyzed${ghResult.rateLimited ? " (GitHub rate limit reached; try again later)" : ""}, so their technologies may be missing.`;
          }
          if (ghResult.truncated) {
            summary += ` Only the ${ghResult.fetchedReposCount} most recently updated of ${ghResult.totalPublicRepos} public repos were listed.`;
          }
          break;
        }

        // ====================================================================
        // HUGGING FACE — Official Hub API for Models, Datasets & Spaces
        // ====================================================================
        case "huggingface": {
          const val = this.validateProfile("huggingface", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid Hugging Face handle.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          await SourceProcessingJobService.updateStage(jobId, personId, "extract");
          const artifacts = await fetchHuggingFaceArtifacts(externalUsername);
          acquisitionMode = "OFFICIAL_PUBLIC_API";

          await saveExternalConnection({
            personId,
            provider: "huggingface",
            externalUsername: artifacts.username,
            profileUrl: artifacts.profileUrl,
            displayName: artifacts.username,
            status: artifacts.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
            metadata: {
              modelsCount: artifacts.models.length,
              datasetsCount: artifacts.datasets.length,
              spacesCount: artifacts.spaces.length,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          for (const m of artifacts.models) {
            const mUrl = `https://huggingface.co/${m.id}`;

            candidates.projects.push({
              title: `HF Model: ${m.id}`,
              description: `Model on Hugging Face (${m.pipelineTag || "AI/ML"})`,
              technologies: m.tags || [],
              url: mUrl,
              source: "huggingface",
              starsOrLikes: m.likes,
            });
          }

          rawSnapshotPayload = artifacts as unknown as Record<string, unknown>;
          summary = `Imported Hugging Face profile '${artifacts.username}' with ${artifacts.models.length} models and ${artifacts.datasets.length} datasets.`;
          break;
        }

        // ====================================================================
        // ORCID — Official Public API for Researcher Publications & DOIs
        // ====================================================================
        case "orcid": {
          const val = this.validateProfile("orcid", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid ORCID checksum.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          await SourceProcessingJobService.updateStage(jobId, personId, "extract");
          const orcidRecord = await fetchOrcidRecord(externalUsername);
          if (orcidRecord.status === "UNAVAILABLE") {
            throw new Error(orcidRecord.notes || "ORCID record lookup failed.");
          }

          acquisitionMode = "OFFICIAL_PUBLIC_API";

          await saveExternalConnection({
            personId,
            provider: "orcid",
            externalUsername: orcidRecord.orcid,
            profileUrl: orcidRecord.profileUrl,
            displayName: `ORCID: ${orcidRecord.orcid}`,
            status: orcidRecord.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
            metadata: {
              worksCount: orcidRecord.works.length,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          for (const w of orcidRecord.works) {
            const ref = w.doi ? `https://doi.org/${w.doi}` : w.sourceLocation;

            candidates.achievements?.push({
              title: w.title,
              category: "publication",
              sourceReference: ref,
              value: w.doi ? `DOI: ${w.doi}` : undefined,
            });
          }

          rawSnapshotPayload = orcidRecord as unknown as Record<string, unknown>;
          summary = `Imported ORCID academic record (${orcidRecord.orcid}) with ${orcidRecord.works.length} scholarly works.`;
          break;
        }

        // ====================================================================
        // DEV COMMUNITY — Technical Writing & Publications via Forem API
        // ====================================================================
        case "devto": {
          const val = this.validateProfile("devto", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid DEV.to handle.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          await SourceProcessingJobService.updateStage(jobId, personId, "extract");
          const devto = await fetchDevToArticles(externalUsername);
          acquisitionMode = "OFFICIAL_PUBLIC_API";

          await saveExternalConnection({
            personId,
            provider: "devto",
            externalUsername: devto.username,
            profileUrl: devto.profileUrl,
            displayName: devto.username,
            status: devto.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
            metadata: {
              articlesCount: devto.articles.length,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          for (const art of devto.articles) {
            candidates.achievements?.push({
              title: art.title,
              category: "writing",
              sourceReference: art.url,
              value: `${art.positiveReactionsCount} reactions`,
            });
          }

          rawSnapshotPayload = devto as unknown as Record<string, unknown>;
          summary = `Imported DEV Community profile '${devto.username}' with ${devto.articles.length} public articles.`;
          break;
        }

        // ====================================================================
        // STACK OVERFLOW — Developer Q&A Reputation & Top Tags via API v2.3
        // ====================================================================
        case "stackoverflow": {
          const val = this.validateProfile("stackoverflow", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid Stack Overflow user ID.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          await SourceProcessingJobService.updateStage(jobId, personId, "extract");
          const so = await fetchStackOverflowProfile(externalUsername);
          acquisitionMode = "OFFICIAL_PUBLIC_API";

          await saveExternalConnection({
            personId,
            provider: "stackoverflow",
            externalUsername: so.userId,
            profileUrl: so.profileUrl,
            displayName: so.displayName || `SO User ${so.userId}`,
            status: so.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
            metadata: {
              reputation: so.reputation,
              badges: so.badgeCounts,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          if (so.topTags && so.topTags.length > 0) {
            for (const t of so.topTags) {
              candidates.skills.push({
                name: t.tagName,
                sourceReference: so.profileUrl,
                confidence: `${t.answerCount} answers`,
              });
            }
          }

          if (so.reputation > 0) {
            candidates.achievements?.push({
              title: `Stack Overflow Reputation: ${so.reputation}`,
              category: "community",
              sourceReference: so.profileUrl,
              value: `${so.reputation} points`,
            });
          }

          rawSnapshotPayload = so as unknown as Record<string, unknown>;
          summary = `Imported Stack Overflow user '${so.userId}' (${so.reputation} reputation points).`;
          break;
        }

        // ====================================================================
        // PORTFOLIO — Strict SSRF Defense & Open Graph / Project Discovery
        // ====================================================================
        case "portfolio": {
          const val = this.validateProfile("portfolio", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid portfolio URL.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          await SourceProcessingJobService.updateStage(jobId, personId, "extract");
          const meta = await fetchPortfolioMetadata(profileUrl);
          acquisitionMode = "PERMITTED_PUBLIC_METADATA";

          await saveExternalConnection({
            personId,
            provider: "portfolio",
            externalUsername: meta.url,
            profileUrl: meta.url,
            displayName: meta.title || "Personal Portfolio",
            status: "connected",
            metadata: {
              title: meta.title,
              description: meta.description,
              outwardLinksCount: meta.detectedLinks.length,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          for (const dp of meta.discoveredProjects) {
            candidates.projects.push({
              title: dp.title,
              description: dp.description,
              technologies: dp.technologies || [],
              url: dp.url || meta.url,
              source: "portfolio",
            });
          }

          rawSnapshotPayload = meta as unknown as Record<string, unknown>;
          summary = `Verified portfolio website (${meta.title || meta.url}) with ${meta.discoveredProjects.length} candidate projects.`;
          break;
        }

        // ====================================================================
        // LINKEDIN — Authorized User Export Archive (Positions, Education, Skills)
        // ====================================================================
        case "linkedin": {
          if (exportContent && exportFilename) {
            // Student-authorized data export file
            await SourceProcessingJobService.updateStage(jobId, personId, "extract");
            let parsed: ReturnType<typeof parseLinkedInZipArchive>;
            if (exportFilename.toLowerCase().endsWith(".zip")) {
              const zipBuf = Buffer.from(exportContent, "base64");
              parsed = parseLinkedInZipArchive(zipBuf);
            } else {
              parsed = parseLinkedInDataExport(exportFilename, exportContent);
            }

            acquisitionMode = "AUTHORIZED_USER_EXPORT";
            externalUsername = exportFilename;
            profileUrl = `export://${exportFilename}`;

            await saveExternalConnection({
              personId,
              provider: "linkedin",
              externalUsername: exportFilename,
              profileUrl: `export://${exportFilename}`,
              displayName: "LinkedIn Authorized Export",
              status: "connected",
              metadata: {
                positionsCount: parsed.positions?.length || 0,
                educationCount: parsed.education?.length || 0,
                skillsCount: parsed.skills?.length || 0,
                projectsCount: parsed.projects?.length || 0,
                lastSyncedAt: new Date().toISOString(),
              },
            });

            for (const pos of parsed.positions || []) {
              candidates.experiences?.push({
                title: pos.title,
                company: pos.companyName,
                duration: `${pos.startedOn || ""} - ${pos.finishedOn || "Present"}`,
                sourceReference: pos.sourceLocation,
              });
            }

            for (const edu of parsed.education || []) {
              candidates.educations?.push({
                school: edu.schoolName,
                degree: edu.degreeName,
                sourceReference: edu.sourceLocation,
              });
            }

            for (const sk of (parsed.skills || []).slice(0, 20)) {
              candidates.skills.push({
                name: sk.name,
                sourceReference: sk.sourceLocation,
              });
            }

            for (const project of parsed.projects || []) {
              candidates.projects.push({
                title: project.title,
                description: project.description,
                technologies: [],
                url: project.url,
                source: "linkedin_export",
              });
            }

            for (const certification of parsed.certifications || []) {
              candidates.achievements?.push({
                title: certification.name,
                category: "certification",
                sourceReference: certification.sourceLocation,
                value: certification.authority,
              });
            }

            rawSnapshotPayload = {
              filename: exportFilename,
              positionsCount: parsed.positions?.length || 0,
              educationCount: parsed.education?.length || 0,
              skillsCount: parsed.skills?.length || 0,
              projectsCount: parsed.projects?.length || 0,
              certificationsCount: parsed.certifications?.length || 0,
            };
            summary = `Parsed LinkedIn export (${exportFilename}) into review candidates: ${parsed.positions?.length || 0} roles, ${parsed.education?.length || 0} schools, ${parsed.skills?.length || 0} skills, ${parsed.projects?.length || 0} projects, and ${parsed.certifications?.length || 0} certifications.`;
          } else {
            // Profile reference only (scraping prohibited)
            const val = this.validateProfile("linkedin", identifier);
            if (!val.valid) throw new Error(val.error || "Invalid LinkedIn link.");
            externalUsername = val.normalizedIdentifier;
            profileUrl = val.normalizedUrl;
            acquisitionMode = "MANUAL_PROFILE_REFERENCE";

            await saveExternalConnection({
              personId,
              provider: "linkedin",
              externalUsername: val.normalizedIdentifier,
              profileUrl: val.normalizedUrl,
              displayName: val.normalizedIdentifier,
              status: "reference_only",
              metadata: {
                lastSyncedAt: new Date().toISOString(),
                notice: "Automated profile scraping prohibited by LinkedIn ToS; export archive supported.",
              },
            });

            summary = `Saved LinkedIn profile reference (${val.normalizedUrl}). To import career history, upload your LinkedIn ZIP/CSV archive.`;
          }
          break;
        }

        // ====================================================================
        // CODING PLATFORMS (LeetCode, HackerRank, CodeChef, HackerEarth)
        // ====================================================================
        case "leetcode":
        case "hackerrank":
        case "codechef":
        case "hackerearth": {
          const val = this.validateProfile(provider, identifier);
          if (!val.valid) throw new Error(val.error || `Invalid ${provider} handle.`);
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          if (provider === "leetcode") {
            const stats = await fetchLeetCodeProfileStats(externalUsername);
            acquisitionMode = "PERMITTED_PUBLIC_METADATA";

            await saveExternalConnection({
              personId,
              provider: "leetcode",
              externalUsername: stats.username,
              profileUrl: stats.profileUrl,
              displayName: stats.realName || stats.username,
              status: stats.acquisitionStatus === "LIVE_VERIFIED" ? "connected" : "reference_only",
              metadata: {
                totalSolved: stats.totalSolved,
                easySolved: stats.easySolved,
                mediumSolved: stats.mediumSolved,
                hardSolved: stats.hardSolved,
                globalRanking: stats.globalRanking,
                lastSyncedAt: new Date().toISOString(),
              },
            });

            if (stats.totalSolved > 0) {
              candidates.achievements?.push({
                title: `LeetCode: ${stats.totalSolved} Solved`,
                category: "competitive",
                sourceReference: stats.profileUrl,
                value: `${stats.totalSolved} problems`,
              });
            }

            rawSnapshotPayload = stats as unknown as Record<string, unknown>;
            summary = `Ingested LeetCode public statistics: ${stats.totalSolved} problems solved.`;
          } else if (provider === "hackerrank") {
            const profile = await fetchHackerRankProfile(externalUsername);
            acquisitionMode = "PERMITTED_PUBLIC_METADATA";

            await saveExternalConnection({
              personId,
              provider: "hackerrank",
              externalUsername: profile.username,
              profileUrl: profile.profileUrl,
              displayName: profile.username,
              status: profile.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
              metadata: {
                badgesCount: profile.badges?.length || 0,
                lastSyncedAt: new Date().toISOString(),
              },
            });

            for (const b of profile.badges || []) {
              candidates.achievements?.push({
                title: `HackerRank Badge: ${b.badge}`,
                category: "competitive",
                sourceReference: profile.profileUrl,
                value: b.stars ? `${b.stars} Stars` : undefined,
              });
            }

            rawSnapshotPayload = profile as unknown as Record<string, unknown>;
            summary = `Ingested HackerRank public profile with ${profile.badges?.length || 0} badges.`;
          } else {
            // CodeChef or HackerEarth
            acquisitionMode = "MANUAL_PROFILE_REFERENCE";
            await saveExternalConnection({
              personId,
              provider,
              externalUsername,
              profileUrl,
              displayName: externalUsername,
              status: "reference_only",
              metadata: { lastSyncedAt: new Date().toISOString() },
            });
            summary = `${provider} profile reference linked (${profileUrl}).`;
          }
          break;
        }

        // ====================================================================
        // KAGGLE — Hub Datasets, Notebooks & Competition Medals
        // ====================================================================
        case "kaggle": {
          const val = this.validateProfile("kaggle", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid Kaggle username.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;

          const kaggleData = await fetchKaggleApiData(externalUsername);
          acquisitionMode = "PERMITTED_PUBLIC_METADATA";

          await saveExternalConnection({
            personId,
            provider: "kaggle",
            externalUsername: kaggleData.username,
            profileUrl: kaggleData.profileUrl,
            displayName: kaggleData.username,
            status: kaggleData.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
            metadata: {
              tier: kaggleData.tier,
              artifactsCount: kaggleData.studentReportedArtifacts?.length || 0,
              lastSyncedAt: new Date().toISOString(),
            },
          });

          for (const item of kaggleData.studentReportedArtifacts || []) {
            candidates.projects.push({
              title: item.title,
              description: item.description,
              technologies: [],
              url: item.url || kaggleData.profileUrl,
              source: "kaggle",
            });
          }

          rawSnapshotPayload = kaggleData as unknown as Record<string, unknown>;
          summary = `Ingested Kaggle profile '${kaggleData.username}' (${kaggleData.tier || "Contributor"} tier).`;
          break;
        }

        // ====================================================================
        // GOOGLE SCHOLAR — Verified Profile Link & Crossref Matching
        // ====================================================================
        case "google_scholar": {
          const val = this.validateProfile("google_scholar", identifier);
          if (!val.valid) throw new Error(val.error || "Invalid Google Scholar link.");
          externalUsername = val.normalizedIdentifier;
          profileUrl = val.normalizedUrl;
          acquisitionMode = "MANUAL_PROFILE_REFERENCE";

          await saveExternalConnection({
            personId,
            provider: "google_scholar",
            externalUsername: val.normalizedIdentifier,
            profileUrl: val.normalizedUrl,
            displayName: `Scholar: ${val.normalizedIdentifier}`,
            status: "reference_only",
            metadata: {
              lastSyncedAt: new Date().toISOString(),
              notice: "Google Scholar profile reference preserved; automated scraping prohibited.",
            },
          });

          summary = `Google Scholar profile reference preserved (${val.normalizedUrl}).`;
          break;
        }

        default:
          throw new Error(`Unsupported provider: '${provider}'.`);
      }

      // 3. Persist the fetched source snapshot; review candidates remain unconfirmed.
      const candidateCount = candidates.projects.length + candidates.skills.length +
        (candidates.experiences?.length || 0) + (candidates.educations?.length || 0) +
        (candidates.achievements?.length || 0);
      await SourceProcessingJobService.updateStage(jobId, personId, "validate");
      const snapshotChecksum = crypto
        .createHash("sha256")
        .update(JSON.stringify(rawSnapshotPayload))
        .digest("hex");

      await saveSourceSnapshot(
        personId,
        provider,
        profileUrl,
        rawSnapshotPayload,
        snapshotChecksum
      );

      // 4. Complete Job
      await SourceProcessingJobService.completeJob({
        jobId,
        personId,
        resultReference: profileUrl,
        metadata: {
          recordsCreated: 0,
          candidateCount,
          projectsCount: candidates.projects.length,
          skillsCount: candidates.skills.length,
          evidenceCount: 0,
        },
      });

      return {
        success: true,
        provider,
        acquisitionMode,
        externalUsername,
        profileUrl,
        recordsCreated: 0,
        candidateCount,
        projectsCount: candidates.projects.length,
        skillsCount: candidates.skills.length,
        evidenceCount: 0,
        summary,
        candidates,
        lastSyncedAt: new Date().toISOString(),
        jobId,
        connectionStatus,
        partial,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Source import failed.";
      await SourceProcessingJobService.failJob({
        jobId,
        personId,
        errorCode: "IMPORT_FAILED",
        errorMessage: errorMsg,
      });

      throw err;
    }
  }

  /**
   * Disconnects an external provider connection and purges transient tokens.
   */
  static async disconnect(personId: string, provider: string): Promise<{ success: boolean; message: string }> {
    await disconnectConnection(personId, provider);
    return {
      success: true,
      message: `Disconnected ${provider} connection.`,
    };
  }

  /**
   * Retrieves connection and sync status for a provider.
   */
  static async getImportStatus(personId: string, provider: string): Promise<SourceStatusSummary> {
    const conn = await getExternalConnectionByProvider(personId, provider);
    if (!conn || conn.status === "disconnected") {
      return {
        provider,
        status: "Not Connected",
        actionLabel: this.getConsentDisclosure(provider).actionLabel,
        recordCount: 0,
      };
    }

    const isConnected = conn.status === "connected";
    const publicDataImported = (conn.metadata as Record<string, unknown> | null)?.connectionState === "PUBLIC_DATA_IMPORTED";
    const lastSynced = conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : undefined;

    return {
      provider,
      status: publicDataImported ? "Public Data Imported" : isConnected ? "Connected" : "Profile Linked",
      actionLabel: isConnected ? "Refresh" : this.getConsentDisclosure(provider).actionLabel,
      profileUrl: conn.profileUrl,
      lastSyncedAt: lastSynced,
      recordCount: (conn.metadata as Record<string, unknown> | null)?.fetchedReposCount
        ? Number((conn.metadata as Record<string, unknown>).fetchedReposCount)
        : 0,
    };
  }
}
