/**
 * AI TATHASTU — DIGITAL FOOTPRINT INTELLIGENCE V4.0
 * Universal Digital Footprint Acquisition, Normalization & Fusion API
 *
 * Implements real-world acquisition and normalization across all 13 platforms:
 * - P1: GitHub (Public repositories, AI/ML tech detection, candidate projects)
 * - P2: Portfolio (SSRF guarded, Open Graph, JSON-LD project candidates)
 * - P3: LinkedIn (Export archive ingestion + strict profile URL reference)
 * - P4: LeetCode (Public GraphQL stats + student-reported problem records)
 * - P5: Hugging Face (Public models, datasets, spaces via Hub API)
 * - P6: ORCID (Public publications, ISO 7064 Mod 11,2 checksum, DOI deduplication)
 * - P7: HackerRank (Public skill badges + student-reported practice)
 * - P8: CodeChef (Verified handle + student-reported contest metrics)
 * - P9: HackerEarth (Verified handle + student-reported hackathons/practice)
 * - P10: Kaggle (Public handle reference + student-confirmed datasets/notebooks)
 * - P11: DEV Community (Public articles with AI/ML topic classification)
 * - P12: Stack Overflow (Public developer reputation & top tags)
 * - P13: Google Scholar (Validated profile reference + Crossref/DOI publication fallback)
 *
 * Enforces:
 * - Consent verification
 * - Audited job state tracking (SourceProcessingJobService)
 * - Evidence ledger ingestion (EvidenceRepository)
 * - Source snapshot persistence (sourceSnapshots table)
 * - Project candidate deduplication (saveProject)
 * - Person 360 version incrementing & Journey event logging
 * - Honest provenance and trust boundaries
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { CrossSourceFusionService } from "@/lib/services/cross-source-fusion-service";
import { saveExternalConnection, saveSourceSnapshot } from "@/lib/repositories/connection-repository";
import { createEvidenceRecord } from "@/lib/repositories/evidence-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";
import { saveProject } from "@/lib/repositories/project-repository";

// Connectors
import { fetchGitHubProjects } from "@/lib/connectors/github/client";
import { fetchPortfolioMetadata } from "@/lib/connectors/portfolio/client";
import { validateLinkedInUrl, parseLinkedInDataExport, parseLinkedInZipArchive } from "@/lib/connectors/linkedin/client";
import { fetchLeetCodeProfileStats } from "@/lib/connectors/leetcode/client";
import {
  fetchHackerRankProfile,
  fetchCodeChefProfile,
  fetchHackerEarthProfile,
} from "@/lib/connectors/coding-platforms/client";
import {
  fetchHuggingFaceArtifacts,
  fetchOrcidRecord,
  fetchDevToArticles,
  fetchStackOverflowProfile,
  fetchKaggleProfile,
  validateGoogleScholarProfile,
} from "@/lib/connectors/research-and-dev/client";

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { provider, identifier, exportFilename, exportContent, consent, manualMetrics } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json({ error: "Provider is required." }, { status: 400 });
    }

    if (!consent) {
      return NextResponse.json(
        { error: "Student authorization consent is required before linking digital footprints." },
        { status: 400 }
      );
    }

    const personId = auth.person.id;
    const cleanId = typeof identifier === "string" ? identifier.trim() : "";

    // 1. Audit Job Start
    const jobId = await SourceProcessingJobService.startJob({
      personId,
      sourceId: provider,
      stage: "acquire",
      metadata: { inputIdentifier: cleanId ? cleanId.slice(0, 100) : "export_upload" },
    });

    let recordsCreated = 0;
    let acquisitionStatus = "PROFILE_LINK_ONLY";
    let summary = "";
    let extractedDetails: Record<string, unknown> = {};

    // 2. Dispatch to dedicated provider client
    switch (provider) {
      case "github": {
        if (!cleanId) throw new Error("GitHub username or repository URL is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const ghResult = await fetchGitHubProjects(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        if (!ghResult.success) {
          throw new Error(ghResult.error || "Failed to fetch GitHub profile.");
        }

        await saveExternalConnection({
          personId,
          provider: "github",
          externalUsername: ghResult.username,
          profileUrl: `https://github.com/${ghResult.username}`,
          displayName: ghResult.username,
          status: "connected",
        });

        // Save each repository as a candidate project and create evidence record
        for (const proj of ghResult.projects) {
          await saveProject(personId, {
            title: proj.title,
            summary: proj.description || `Repository by ${ghResult.username}`,
            description: proj.description || "",
            repositoryUrl: proj.repositoryUrl,
            technologies: proj.technologies || [],
            sources: ["github"],
            status: "candidate",
            projectType: "software",
          });

          await createEvidenceRecord(personId, {
            category: "project",
            subject: `GitHub: ${proj.title}`,
            value: `${proj.stars} stars. Stack: ${(proj.technologies || []).join(", ") || "General"}`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: proj.repositoryUrl,
            interpretation: `Public GitHub repository observed from ${ghResult.username}.`,
            whyItMatters: "Direct source code demonstration of technical implementation and software engineering.",
          });
          recordsCreated++;
        }

        acquisitionStatus = "LIVE_VERIFIED";
        summary = `Connected GitHub account (${ghResult.username}). Discovered ${ghResult.projects.length} repository project candidates.`;
        extractedDetails = ghResult as any;
        break;
      }

      case "portfolio": {
        if (!cleanId) throw new Error("Portfolio URL is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const meta = await fetchPortfolioMetadata(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        await saveExternalConnection({
          personId,
          provider: "portfolio",
          externalUsername: meta.url,
          profileUrl: meta.url,
          displayName: meta.title || "Personal Portfolio",
          status: "connected",
        });

        // Insert evidence item for portfolio site
        await createEvidenceRecord(personId, {
          category: "project",
          subject: meta.title || "Personal Portfolio Website",
          value: meta.description || `Portfolio site at ${meta.url}`,
          source: "imported",
          verificationStatus: "unverified",
          sourceReference: meta.url,
          interpretation: `Public portfolio site with ${meta.detectedLinks.length} outbound verified developer links.`,
          whyItMatters: "Provides authentic direct demonstration of web presentation and project catalog.",
        });
        recordsCreated++;

        // Save any candidate projects discovered on the portfolio site
        if (meta.discoveredProjects && meta.discoveredProjects.length > 0) {
          for (const dp of meta.discoveredProjects) {
            await saveProject(personId, {
              title: dp.title,
              summary: dp.description || "Project discovered on portfolio site",
              demoUrl: dp.url || meta.url,
              sources: ["portfolio"],
              status: "candidate",
              projectType: "software",
            });
            recordsCreated++;
          }
        }

        acquisitionStatus = "LIVE_VERIFIED";
        summary = `Verified portfolio metadata (${meta.title || meta.url}). Found ${meta.detectedLinks.length} verified links.`;
        extractedDetails = meta as any;
        break;
      }

      case "linkedin": {
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");
        if (exportContent && exportFilename) {
          // Student-authorized export archive (.zip or .csv/.json)
          let parsed: ReturnType<typeof parseLinkedInZipArchive>;
          if (exportFilename.toLowerCase().endsWith(".zip")) {
            const zipBuf = Buffer.from(exportContent, "base64");
            parsed = parseLinkedInZipArchive(zipBuf);
          } else {
            parsed = parseLinkedInDataExport(exportFilename, exportContent);
          }

          const positions = parsed.positions || [];
          const education = parsed.education || [];
          const skills = parsed.skills || [];
          const projectsList = parsed.projects || [];

          for (const pos of positions) {
            await createEvidenceRecord(personId, {
              category: "experience",
              subject: `${pos.title} at ${pos.companyName}`,
              value: pos.description || `${pos.startedOn || ""} - ${pos.finishedOn || "Present"}`,
              source: "self_reported",
              verificationStatus: "unverified",
              sourceReference: pos.sourceLocation,
              interpretation: `Candidate work experience claim imported from student's LinkedIn export archive.`,
              whyItMatters: "Forms foundation for career timeline, pending student confirmation.",
            });
            recordsCreated++;
          }

          for (const edu of education) {
            await createEvidenceRecord(personId, {
              category: "education",
              subject: edu.degreeName ? `${edu.degreeName} - ${edu.schoolName}` : edu.schoolName,
              value: edu.notes || `${edu.startDate || ""} - ${edu.endDate || ""}`,
              source: "self_reported",
              verificationStatus: "unverified",
              sourceReference: edu.sourceLocation,
              interpretation: `Candidate degree claim imported from student's LinkedIn export archive.`,
              whyItMatters: "Identifies formal education and expected graduation year.",
            });
            recordsCreated++;
          }

          for (const sk of skills.slice(0, 15)) {
            await createEvidenceRecord(personId, {
              category: "skill",
              subject: sk.name,
              value: "Self-reported on LinkedIn",
              source: "self_reported",
              verificationStatus: "unverified",
              sourceReference: sk.sourceLocation,
              interpretation: `Candidate skill reported on LinkedIn profile export.`,
              whyItMatters: "Indicates claimed familiarity; requires project or quiz evidence.",
            });
            recordsCreated++;
          }

          for (const proj of projectsList) {
            await saveProject(personId, {
              title: proj.title,
              summary: proj.description || "LinkedIn Project Entry",
              sources: ["linkedin"],
              status: "candidate",
              projectType: "software",
            });
            recordsCreated++;
          }

          await saveExternalConnection({
            personId,
            provider: "linkedin",
            externalUsername: exportFilename,
            profileUrl: `export://${exportFilename}`,
            displayName: "LinkedIn Authorized Export",
            status: "connected",
          });

          acquisitionStatus = "MANUAL_ARCHIVE_VERIFIED";
          summary = `Parsed student-authorized LinkedIn archive (${exportFilename}). Extracted ${positions.length} roles, ${education.length} degrees, and ${skills.length} skills for student review.`;
          extractedDetails = {
            positionsCount: positions.length,
            educationCount: education.length,
            skillsCount: skills.length,
            projectsCount: projectsList.length,
          };
        } else {
          // Profile reference URL
          const check = validateLinkedInUrl(cleanId);
          if (!check.valid) throw new Error(check.error || "Invalid LinkedIn profile link.");

          await saveExternalConnection({
            personId,
            provider: "linkedin",
            externalUsername: check.username,
            profileUrl: check.normalizedUrl,
            displayName: check.username,
            status: "reference_only",
          });

          acquisitionStatus = "PROFILE_LINK_ONLY";
          summary = `LinkedIn profile reference added (${check.normalizedUrl}). Continuous scraping disabled per LinkedIn terms.`;
          extractedDetails = { profileUrl: check.normalizedUrl, username: check.username };
        }
        break;
      }

      case "leetcode": {
        if (!cleanId) throw new Error("LeetCode username is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const stats = await fetchLeetCodeProfileStats(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        await saveExternalConnection({
          personId,
          provider: "leetcode",
          externalUsername: stats.username,
          profileUrl: stats.profileUrl,
          displayName: stats.realName || stats.username,
          status: stats.acquisitionStatus === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        const solvedCount = stats.totalSolved > 0 ? stats.totalSolved : (manualMetrics?.solvedCount ?? manualMetrics?.totalSolved ?? 0);
        if (solvedCount > 0) {
          const isManual = stats.totalSolved === 0;
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "LeetCode Problem Solving",
            value: `${solvedCount} solved (${stats.easySolved} Easy, ${stats.mediumSolved} Medium, ${stats.hardSolved} Hard)`,
            source: isManual ? "self_reported" : "imported",
            verificationStatus: "unverified",
            sourceReference: stats.profileUrl,
            interpretation: isManual
              ? `Student-reported LeetCode problem solving count (${solvedCount} problems).`
              : `Public LeetCode problem solving record. Global Rank: ${stats.globalRanking ?? "N/A"}.`,
            whyItMatters: "Demonstrates consistent algorithmic practice and data structure implementation.",
          });
          recordsCreated++;
        }

        acquisitionStatus = stats.acquisitionStatus === "LIVE_VERIFIED" ? "API_PUBLIC_UNVERIFIED_OWNERSHIP" : stats.acquisitionStatus;
        summary = solvedCount > 0
          ? `Ingested LeetCode stats: ${solvedCount} problems solved.`
          : `LeetCode profile reference linked (${stats.profileUrl}).`;
        extractedDetails = { ...stats, manualMetrics } as any;
        break;
      }

      case "hackerrank": {
        if (!cleanId) throw new Error("HackerRank username is required.");
        const profile = await fetchHackerRankProfile(cleanId, manualMetrics);
        await saveExternalConnection({
          personId,
          provider: "hackerrank",
          externalUsername: profile.username,
          profileUrl: profile.profileUrl,
          displayName: profile.username,
          status: profile.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        if (profile.badges && profile.badges.length > 0) {
          for (const b of profile.badges) {
            await createEvidenceRecord(personId, {
              category: "other",
              subject: `HackerRank ${b.badge} Badge`,
              value: b.stars ? `${b.stars} Stars` : "Earned Badge",
              source: "imported",
              verificationStatus: "unverified",
              sourceReference: profile.profileUrl,
              interpretation: `Public skill badge from HackerRank profile.`,
              whyItMatters: "Corroborates topic practice and domain fluency.",
            });
            recordsCreated++;
          }
        }

        if (profile.studentReported && (profile.problemsSolved || profile.rating)) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "HackerRank Practice",
            value: `${profile.problemsSolved ?? 0} problems solved, Rating: ${profile.rating ?? "N/A"}`,
            source: "self_reported",
            verificationStatus: "unverified",
            sourceReference: profile.profileUrl,
            interpretation: "Student-reported HackerRank practice metrics.",
            whyItMatters: "Demonstrates problem solving fluency.",
          });
          recordsCreated++;
        }

        acquisitionStatus = profile.status === "LIVE_VERIFIED" ? "API_PUBLIC_UNVERIFIED_OWNERSHIP" : profile.status;
        summary = profile.notes || "HackerRank profile linked.";
        extractedDetails = profile as any;
        break;
      }

      case "codechef": {
        if (!cleanId) throw new Error("CodeChef handle is required.");
        const profile = await fetchCodeChefProfile(cleanId, manualMetrics);
        await saveExternalConnection({
          personId,
          provider: "codechef",
          externalUsername: profile.username,
          profileUrl: profile.profileUrl,
          displayName: profile.username,
          status: "reference_only",
        });

        if (profile.studentReported && (profile.rating || profile.problemsSolved)) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "CodeChef Competitive Programming",
            value: `Rating: ${profile.rating ?? "N/A"}, Solved: ${profile.problemsSolved ?? 0}`,
            source: "self_reported",
            verificationStatus: "unverified",
            sourceReference: profile.profileUrl,
            interpretation: "Student-reported CodeChef contest rating and problem count.",
            whyItMatters: "Competitive programming and algorithmic contest performance.",
          });
          recordsCreated++;
        }

        acquisitionStatus = "PROFILE_LINK_ONLY";
        summary = profile.notes || "CodeChef profile linked.";
        extractedDetails = profile as any;
        break;
      }

      case "hackerearth": {
        if (!cleanId) throw new Error("HackerEarth handle is required.");
        const profile = await fetchHackerEarthProfile(cleanId, manualMetrics);
        await saveExternalConnection({
          personId,
          provider: "hackerearth",
          externalUsername: profile.username,
          profileUrl: profile.profileUrl,
          displayName: profile.username,
          status: "reference_only",
        });

        if (profile.studentReported && (profile.rating || profile.problemsSolved)) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "HackerEarth Practice & Hackathons",
            value: `Rating: ${profile.rating ?? "N/A"}, Problems: ${profile.problemsSolved ?? 0}`,
            source: "self_reported",
            verificationStatus: "unverified",
            sourceReference: profile.profileUrl,
            interpretation: "Student-reported HackerEarth participation and practice records.",
            whyItMatters: "Hackathon participation and algorithmic fluency.",
          });
          recordsCreated++;
        }

        acquisitionStatus = "PROFILE_LINK_ONLY";
        summary = profile.notes || "HackerEarth profile linked.";
        extractedDetails = profile as any;
        break;
      }

      case "huggingface": {
        if (!cleanId) throw new Error("Hugging Face username is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const artifacts = await fetchHuggingFaceArtifacts(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        await saveExternalConnection({
          personId,
          provider: "huggingface",
          externalUsername: artifacts.username,
          profileUrl: artifacts.profileUrl,
          displayName: artifacts.username,
          status: artifacts.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        for (const m of artifacts.models) {
          await saveProject(personId, {
            title: `HF Model: ${m.id}`,
            summary: `Model on Hugging Face Hub (${m.pipelineTag || "AI/ML"}). ${m.downloads} downloads, ${m.likes} likes.`,
            demoUrl: `https://huggingface.co/${m.id}`,
            technologies: m.tags || [],
            sources: ["huggingface"],
            status: "candidate",
            projectType: "software",
          });

          await createEvidenceRecord(personId, {
            category: "project",
            subject: `HF Model: ${m.id}`,
            value: `${m.downloads} downloads, ${m.likes} likes. Task: ${m.pipelineTag || "AI/ML"}`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: `https://huggingface.co/${m.id}`,
            interpretation: `Public AI/ML model published to Hugging Face registry.`,
            whyItMatters: "Demonstrates practical model deployment, fine-tuning, or open weight sharing.",
          });
          recordsCreated++;
        }

        for (const d of artifacts.datasets) {
          await saveProject(personId, {
            title: `HF Dataset: ${d.id}`,
            summary: `Dataset on Hugging Face Hub. ${d.downloads} downloads, ${d.likes} likes.`,
            demoUrl: `https://huggingface.co/datasets/${d.id}`,
            technologies: d.tags || [],
            sources: ["huggingface"],
            status: "candidate",
            projectType: "software",
          });

          await createEvidenceRecord(personId, {
            category: "project",
            subject: `HF Dataset: ${d.id}`,
            value: `${d.downloads} downloads, ${d.likes} likes`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: `https://huggingface.co/datasets/${d.id}`,
            interpretation: `Public dataset published on Hugging Face.`,
            whyItMatters: "Data engineering, curation, and open-source contribution.",
          });
          recordsCreated++;
        }

        acquisitionStatus = artifacts.status;
        summary = artifacts.notes || `Linked Hugging Face account with ${artifacts.models.length} models and ${artifacts.datasets.length} datasets.`;
        extractedDetails = artifacts as any;
        break;
      }

      case "orcid": {
        if (!cleanId) throw new Error("ORCID identifier is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const orcidRecord = await fetchOrcidRecord(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        if (orcidRecord.status === "UNAVAILABLE") {
          throw new Error(orcidRecord.notes || "Invalid ORCID identifier or checksum failure.");
        }

        await saveExternalConnection({
          personId,
          provider: "orcid",
          externalUsername: orcidRecord.orcid,
          profileUrl: orcidRecord.profileUrl,
          displayName: `ORCID: ${orcidRecord.orcid}`,
          status: orcidRecord.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        for (const w of orcidRecord.works) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: w.title,
            value: w.doi ? `DOI: ${w.doi} (${w.publicationYear || "Year N/A"})` : `${w.journalTitle || "Published work"} (${w.publicationYear || ""})`,
            source: "imported",
            verificationStatus: w.doi ? "verified" : "unverified",
            sourceReference: w.doi ? `https://doi.org/${w.doi}` : w.sourceLocation,
            interpretation: `Scholarly work listed in public ORCID registry.`,
            whyItMatters: "Peer-reviewed research and scholarly dissemination.",
          });
          recordsCreated++;
        }

        acquisitionStatus = orcidRecord.status;
        summary = orcidRecord.notes || `Linked ORCID record with ${orcidRecord.works.length} works.`;
        extractedDetails = orcidRecord as any;
        break;
      }

      case "kaggle": {
        if (!cleanId) throw new Error("Kaggle username is required.");
        const kaggle = fetchKaggleProfile(cleanId, manualMetrics?.artifacts);

        if (kaggle.status === "UNAVAILABLE") {
          throw new Error(kaggle.notes || "Invalid Kaggle username format.");
        }

        await saveExternalConnection({
          personId,
          provider: "kaggle",
          externalUsername: kaggle.username,
          profileUrl: kaggle.profileUrl,
          displayName: kaggle.username,
          status: "reference_only",
        });

        if (kaggle.studentReportedArtifacts && kaggle.studentReportedArtifacts.length > 0) {
          for (const item of kaggle.studentReportedArtifacts) {
            await saveProject(personId, {
              title: `Kaggle ${item.type}: ${item.title}`,
              summary: item.description || `Kaggle ${item.type} artifact by ${kaggle.username}`,
              demoUrl: item.url || kaggle.profileUrl,
              sources: ["kaggle"],
              status: "candidate",
              projectType: "software",
            });

            await createEvidenceRecord(personId, {
              category: "project",
              subject: `Kaggle ${item.type}: ${item.title}`,
              value: item.description || "Student-confirmed Kaggle artifact",
              source: "self_reported",
              verificationStatus: "unverified",
              sourceReference: item.url || kaggle.profileUrl,
              interpretation: `Kaggle ${item.type} artifact associated with ${kaggle.username}.`,
              whyItMatters: "Demonstrates practical data science, notebook analysis, or competition modeling.",
            });
            recordsCreated++;
          }
        }

        acquisitionStatus = "PROFILE_LINK_ONLY";
        summary = kaggle.notes || `Kaggle profile linked (${kaggle.profileUrl}).`;
        extractedDetails = kaggle as any;
        break;
      }

      case "devto": {
        if (!cleanId) throw new Error("DEV.to username is required.");
        const devto = await fetchDevToArticles(cleanId);
        await saveExternalConnection({
          personId,
          provider: "devto",
          externalUsername: devto.username,
          profileUrl: devto.profileUrl,
          displayName: devto.username,
          status: devto.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        for (const art of devto.articles) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: art.title,
            value: `${art.positiveReactionsCount} reactions. Topics: ${art.detectedTopics.join(", ")}`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: art.url,
            interpretation: `Technical writing and developer tutorial publication on DEV.to (${art.detectedTopics.join(", ")}).`,
            whyItMatters: "Demonstrates technical communication, teaching ability, and domain clarity.",
          });
          recordsCreated++;
        }

        acquisitionStatus = devto.status;
        summary = devto.notes || `DEV.to profile connected with ${devto.articles.length} public articles.`;
        extractedDetails = devto as any;
        break;
      }

      case "stackoverflow": {
        if (!cleanId) throw new Error("Stack Overflow ID is required.");
        const so = await fetchStackOverflowProfile(cleanId);
        await saveExternalConnection({
          personId,
          provider: "stackoverflow",
          externalUsername: so.userId,
          profileUrl: so.profileUrl,
          displayName: so.displayName || `SO User ${so.userId}`,
          status: so.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        if (so.reputation > 0) {
          const topTagStr = so.topTags ? `. Top tags: ${so.topTags.map((t) => t.tagName).join(", ")}` : "";
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "Stack Overflow Reputation",
            value: `${so.reputation} reputation score${topTagStr}`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: so.profileUrl,
            interpretation: `Public technical Q&A contributions and community reputation on Stack Overflow.`,
            whyItMatters: "Indicates real-world debugging, problem diagnosis, and peer helpfulness.",
          });
          recordsCreated++;
        }

        acquisitionStatus = so.status;
        summary = so.notes || `Stack Overflow linked with ${so.reputation} reputation score.`;
        extractedDetails = so as any;
        break;
      }

      case "google_scholar": {
        if (!cleanId) throw new Error("Google Scholar profile URL or user ID is required.");
        const scholar = validateGoogleScholarProfile(cleanId);

        if (scholar.status === "UNAVAILABLE") {
          throw new Error(scholar.notes || "Invalid Google Scholar link format.");
        }

        await saveExternalConnection({
          personId,
          provider: "google_scholar",
          externalUsername: scholar.scholarId,
          profileUrl: scholar.profileUrl,
          displayName: `Google Scholar: ${scholar.scholarId}`,
          status: "reference_only",
        });

        acquisitionStatus = "PROFILE_LINK_ONLY";
        summary = scholar.notes || "Google Scholar profile reference preserved.";
        extractedDetails = scholar as any;
        break;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // 3. Persist Source Snapshot in Neon Database
    const snapshotChecksum = crypto
      .createHash("sha256")
      .update(JSON.stringify(extractedDetails))
      .digest("hex");

    await saveSourceSnapshot(
      personId,
      provider,
      cleanId || exportFilename || "sync",
      extractedDetails,
      snapshotChecksum
    );

    // 4. Finalize Job
    await SourceProcessingJobService.completeJob({
      jobId,
      personId,
      resultReference: `records_${recordsCreated}`,
      metadata: { acquisitionStatus, recordsCreated },
    });

    // 5. Record Profile Version & Journey Event for Downstream Dashboard & EORA Refresh
    await CrossSourceFusionService.recordProfileVersion(
      personId,
      "evidence_added",
      `Connected ${provider} footprint with ${recordsCreated} evidence items.`,
      { provider, acquisitionStatus, recordsCreated, summary }
    );

    await createJourneyEventRecord(personId, {
      type: "footprint_connected",
      title: `Connected ${provider.toUpperCase()}`,
      description: summary,
      metadata: { provider, acquisitionStatus, recordsCreated },
    });

    return NextResponse.json({
      success: true,
      provider,
      acquisitionStatus,
      recordsCreated,
      summary,
      details: extractedDetails,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Footprint synchronization failed.";
    console.error("[Footprint Sync Error]", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

