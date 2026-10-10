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
  fetchKaggleApiData,
  validateGoogleScholarProfile,
} from "@/lib/connectors/research-and-dev/client";
import { CodingProfileIntelligenceService } from "@/lib/services/coding-profile-intelligence-service";

export async function POST(req: Request) {
  let activeJob: { jobId: string; personId: string } | null = null;
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { provider, identifier, exportFilename, exportContent, consent, manualMetrics, jobId: requestedJobId } = body;

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
    let jobId: string;
    if (typeof requestedJobId === "string") {
      const existing = await SourceProcessingJobService.getJobForPerson(requestedJobId, personId);
      if (!existing || existing.sourceId !== provider || existing.status !== "running") {
        return NextResponse.json({ error: "Invalid processing job." }, { status: 400 });
      }
      jobId = existing.id;
    } else {
      jobId = await SourceProcessingJobService.startJob({ personId, sourceId: provider, stage: "acquire" });
    }
    activeJob = { jobId, personId };
    await SourceProcessingJobService.updateStage(jobId, personId, "parse");

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
        if (exportContent && exportFilename) {
          await SourceProcessingJobService.updateStage(jobId, personId, "parse");
          const parsed = CodingProfileIntelligenceService.parseCodingExportFile("leetcode", exportFilename, exportContent);
          await SourceProcessingJobService.updateStage(jobId, personId, "extract");

          await saveExternalConnection({
            personId,
            provider: "leetcode",
            externalUsername: cleanId || exportFilename,
            profileUrl: cleanId ? `https://leetcode.com/u/${cleanId}` : `export://${exportFilename}`,
            displayName: cleanId || "LeetCode Export",
            status: "connected",
            metadata: { metrics: parsed.metrics, exportFilename },
          });

          if (parsed.metrics.problemsSolved && parsed.metrics.problemsSolved > 0) {
            const breakdown = [
              parsed.metrics.easySolved ? `${parsed.metrics.easySolved} Easy` : null,
              parsed.metrics.mediumSolved ? `${parsed.metrics.mediumSolved} Medium` : null,
              parsed.metrics.hardSolved ? `${parsed.metrics.hardSolved} Hard` : null,
            ].filter(Boolean).join(", ");

            await createEvidenceRecord(personId, {
              category: "other",
              subject: "LeetCode Problem Solving",
              value: breakdown
                ? `${parsed.metrics.problemsSolved} solved (${breakdown})`
                : `${parsed.metrics.problemsSolved} solved`,
              source: "imported",
              verificationStatus: "unverified",
              sourceReference: cleanId ? `https://leetcode.com/u/${cleanId}` : `export://${exportFilename}`,
              interpretation: `Parsed from student-authorized LeetCode export file (${exportFilename}).`,
              whyItMatters: "Demonstrates consistent algorithmic practice and data structure implementation.",
            });
            recordsCreated++;
          }

          acquisitionStatus = "AUTHORIZED_EXPORT_SUPPORTED";
          summary = parsed.summary;
          extractedDetails = { ...parsed.metrics, filename: exportFilename };
        } else {
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
        }
        break;
      }

      case "hackerrank": {
        if (exportContent && exportFilename) {
          await SourceProcessingJobService.updateStage(jobId, personId, "parse");
          const parsed = CodingProfileIntelligenceService.parseCodingExportFile("hackerrank", exportFilename, exportContent);
          await SourceProcessingJobService.updateStage(jobId, personId, "extract");

          await saveExternalConnection({
            personId,
            provider: "hackerrank",
            externalUsername: cleanId || exportFilename,
            profileUrl: cleanId ? `https://www.hackerrank.com/${cleanId}` : `export://${exportFilename}`,
            displayName: cleanId || "HackerRank Export",
            status: "connected",
            metadata: { metrics: parsed.metrics, exportFilename },
          });

          if (parsed.metrics.badges && parsed.metrics.badges.length > 0) {
            for (const b of parsed.metrics.badges) {
              await createEvidenceRecord(personId, {
                category: "other",
                subject: `HackerRank Badge: ${b.name}`,
                value: "Earned Skill Badge",
                source: "imported",
                verificationStatus: "unverified",
                sourceReference: cleanId ? `https://www.hackerrank.com/${cleanId}` : `export://${exportFilename}`,
                interpretation: `Parsed from student-authorized HackerRank export (${exportFilename}).`,
                whyItMatters: "Corroborates topic practice and domain fluency.",
              });
              recordsCreated++;
            }
          }

          acquisitionStatus = "AUTHORIZED_EXPORT_SUPPORTED";
          summary = parsed.summary;
          extractedDetails = { ...parsed.metrics, filename: exportFilename };
        } else {
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
        }
        break;
      }

      case "codechef": {
        if (exportContent && exportFilename) {
          await SourceProcessingJobService.updateStage(jobId, personId, "parse");
          const parsed = CodingProfileIntelligenceService.parseCodingExportFile("codechef", exportFilename, exportContent);
          await SourceProcessingJobService.updateStage(jobId, personId, "extract");

          await saveExternalConnection({
            personId,
            provider: "codechef",
            externalUsername: cleanId || exportFilename,
            profileUrl: cleanId ? `https://www.codechef.com/users/${cleanId}` : `export://${exportFilename}`,
            displayName: cleanId || "CodeChef Export",
            status: "connected",
            metadata: { metrics: parsed.metrics, exportFilename },
          });

          if (parsed.metrics.contestRating || parsed.metrics.problemsSolved) {
            await createEvidenceRecord(personId, {
              category: "other",
              subject: "CodeChef Competitive Programming",
              value: `Rating: ${parsed.metrics.contestRating ?? "N/A"}, Solved: ${parsed.metrics.problemsSolved ?? "N/A"}`,
              source: "imported",
              verificationStatus: "unverified",
              sourceReference: cleanId ? `https://www.codechef.com/users/${cleanId}` : `export://${exportFilename}`,
              interpretation: `Parsed from student-authorized CodeChef export (${exportFilename}).`,
              whyItMatters: "Competitive programming and algorithmic contest performance.",
            });
            recordsCreated++;
          }

          acquisitionStatus = "AUTHORIZED_EXPORT_SUPPORTED";
          summary = parsed.summary;
          extractedDetails = { ...parsed.metrics, filename: exportFilename };
        } else {
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
        }
        break;
      }

      case "hackerearth": {
        if (exportContent && exportFilename) {
          await SourceProcessingJobService.updateStage(jobId, personId, "parse");
          const parsed = CodingProfileIntelligenceService.parseCodingExportFile("hackerearth", exportFilename, exportContent);
          await SourceProcessingJobService.updateStage(jobId, personId, "extract");

          await saveExternalConnection({
            personId,
            provider: "hackerearth",
            externalUsername: cleanId || exportFilename,
            profileUrl: cleanId ? `https://www.hackerearth.com/@${cleanId}` : `export://${exportFilename}`,
            displayName: cleanId || "HackerEarth Export",
            status: "connected",
            metadata: { metrics: parsed.metrics, exportFilename },
          });

          if (parsed.metrics.contestRating || parsed.metrics.problemsSolved) {
            await createEvidenceRecord(personId, {
              category: "other",
              subject: "HackerEarth Practice & Hackathons",
              value: `Rating: ${parsed.metrics.contestRating ?? "N/A"}, Problems: ${parsed.metrics.problemsSolved ?? "N/A"}`,
              source: "imported",
              verificationStatus: "unverified",
              sourceReference: cleanId ? `https://www.hackerearth.com/@${cleanId}` : `export://${exportFilename}`,
              interpretation: `Parsed from student-authorized HackerEarth export (${exportFilename}).`,
              whyItMatters: "Hackathon participation and algorithmic fluency.",
            });
            recordsCreated++;
          }

          acquisitionStatus = "AUTHORIZED_EXPORT_SUPPORTED";
          summary = parsed.summary;
          extractedDetails = { ...parsed.metrics, filename: exportFilename };
        } else {
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
        }
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
        if (exportContent && exportFilename) {
          await SourceProcessingJobService.updateStage(jobId, personId, "parse");
          const parsed = CodingProfileIntelligenceService.parseCodingExportFile("kaggle", exportFilename, exportContent);
          await SourceProcessingJobService.updateStage(jobId, personId, "extract");

          await saveExternalConnection({
            personId,
            provider: "kaggle",
            externalUsername: cleanId || exportFilename,
            profileUrl: cleanId ? `https://www.kaggle.com/${cleanId}` : `export://${exportFilename}`,
            displayName: cleanId || "Kaggle Export",
            status: "connected",
            metadata: { metrics: parsed.metrics, exportFilename },
          });

          if (parsed.extractedProjects && parsed.extractedProjects.length > 0) {
            for (const proj of parsed.extractedProjects) {
              await saveProject(personId, {
                title: proj.title,
                summary: proj.description,
                demoUrl: proj.url,
                technologies: proj.technologies || ["Kaggle", "Python", "Data Science"],
                sources: ["kaggle"],
                status: "candidate",
                projectType: proj.type === "research" ? "research" : "software",
              });

              await createEvidenceRecord(personId, {
                category: "project",
                subject: proj.title,
                value: proj.description,
                source: "imported",
                verificationStatus: "unverified",
                sourceReference: proj.url || `export://${exportFilename}`,
                interpretation: `Parsed from student-authorized Kaggle export (${exportFilename}).`,
                whyItMatters: "Demonstrates practical data science, notebook analysis, or competition modeling.",
              });
              recordsCreated++;
            }
          }

          acquisitionStatus = "AUTHORIZED_EXPORT_SUPPORTED";
          summary = parsed.summary;
          extractedDetails = { ...parsed.metrics, projects: parsed.extractedProjects, filename: exportFilename };
        } else {
          if (!cleanId) throw new Error("Kaggle username is required.");
          await SourceProcessingJobService.updateStage(jobId, personId, "parse");
          // Attempt official Kaggle API retrieval
          const kaggleApi = await fetchKaggleApiData(cleanId);
          await SourceProcessingJobService.updateStage(jobId, personId, "extract");

          if (kaggleApi.status === "UNAVAILABLE") {
            throw new Error(kaggleApi.notes || "Invalid Kaggle username format.");
          }

          const isLive = kaggleApi.status === "LIVE_VERIFIED" && kaggleApi.studentReportedArtifacts && kaggleApi.studentReportedArtifacts.length > 0;

          await saveExternalConnection({
            personId,
            provider: "kaggle",
            externalUsername: kaggleApi.username,
            profileUrl: kaggleApi.profileUrl,
            displayName: kaggleApi.username,
            status: isLive ? "connected" : "reference_only",
          });

          if (kaggleApi.studentReportedArtifacts && kaggleApi.studentReportedArtifacts.length > 0) {
            for (const item of kaggleApi.studentReportedArtifacts) {
              await saveProject(personId, {
                title: item.title,
                summary: item.description || `Kaggle ${item.type} artifact by ${kaggleApi.username}`,
                demoUrl: item.url || kaggleApi.profileUrl,
                sources: ["kaggle"],
                status: "candidate",
                projectType: item.type === "dataset" ? "research" : "software",
                technologies: ["Kaggle", "Data Science", "Python"],
              });

              await createEvidenceRecord(personId, {
                category: "project",
                subject: item.title,
                value: item.description || "Discovered public Kaggle artifact",
                source: isLive ? "imported" : "self_reported",
                verificationStatus: "unverified",
                sourceReference: item.url || kaggleApi.profileUrl,
                interpretation: `Discovered from public Kaggle API for user ${kaggleApi.username}.`,
                whyItMatters: "Demonstrates practical data science, notebook analysis, or competition modeling.",
              });
              recordsCreated++;
            }
          }

          // If student passed manual metrics artifacts, merge them too
          if (manualMetrics?.artifacts && Array.isArray(manualMetrics.artifacts)) {
            for (const item of manualMetrics.artifacts) {
              await saveProject(personId, {
                title: `Kaggle ${item.type}: ${item.title}`,
                summary: item.description || `Kaggle ${item.type} artifact by ${cleanId}`,
                demoUrl: item.url || `https://www.kaggle.com/${cleanId}`,
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
                sourceReference: item.url || `https://www.kaggle.com/${cleanId}`,
                interpretation: `Student-confirmed Kaggle ${item.type} artifact.`,
                whyItMatters: "Demonstrates practical data science, notebook analysis, or competition modeling.",
              });
              recordsCreated++;
            }
          }

          acquisitionStatus = isLive ? "LIVE_VERIFIED" : "PROFILE_LINK_ONLY";
          summary = kaggleApi.notes || `Kaggle profile linked (${kaggleApi.profileUrl}).`;
          extractedDetails = kaggleApi as any;
        }
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
    await SourceProcessingJobService.updateStage(jobId, personId, "validate");
    const snapshotChecksum = crypto
      .createHash("sha256")
      .update(JSON.stringify(extractedDetails))
      .digest("hex");

    await SourceProcessingJobService.updateStage(jobId, personId, "persist");
    await saveSourceSnapshot(
      personId,
      provider,
      cleanId || exportFilename || "sync",
      extractedDetails,
      snapshotChecksum
    );

    // 4. Record Profile Version & Journey Event for Downstream Dashboard & EORA Refresh
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

    await SourceProcessingJobService.completeJob({
      jobId,
      personId,
      resultReference: `records_${recordsCreated}`,
      metadata: { acquisitionStatus, recordsCreated },
    });

    return NextResponse.json({
      success: true,
      jobId,
      provider,
      acquisitionStatus,
      recordsCreated,
      summary,
      details: extractedDetails,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Footprint synchronization failed.";
    if (activeJob) await SourceProcessingJobService.failJob({ ...activeJob, errorCode: "SYNC_FAILED", errorMessage: errorMsg }).catch(() => null);
    console.error("[Footprint Sync Error]", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

