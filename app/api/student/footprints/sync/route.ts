/**
 * AI TATHASTU — V3.2 DIGITAL FOOTPRINT ACQUISITION & SYNCHRONIZATION API
 *
 * Implements real-world acquisition and normalization across:
 * - Portfolio (SSRF guarded)
 * - LinkedIn (Export archive ingestion + strict profile URL reference)
 * - LeetCode (Public GraphQL stats)
 * - HackerRank / CodeChef / HackerEarth (Public badges & verified handle references)
 * - Hugging Face (Public models & spaces)
 * - ORCID (Public publications & DOIs)
 * - DEV Community (Public articles)
 * - Stack Overflow (Public developer reputation)
 *
 * Enforces:
 * - Consent verification
 * - Audited job state tracking (SourceProcessingJobService)
 * - Unverified evidence ledger ingestion (EvidenceRepository)
 * - Person 360 version incrementing & Journey event logging
 * - Never claims automated continuous sync for static exports or manual links
 */

import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { CrossSourceFusionService } from "@/lib/services/cross-source-fusion-service";
import { saveExternalConnection } from "@/lib/repositories/connection-repository";
import { createEvidenceRecord } from "@/lib/repositories/evidence-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";

// Connectors
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
} from "@/lib/connectors/research-and-dev/client";

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { provider, identifier, exportFilename, exportContent, consent } = body;

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
      case "portfolio": {
        if (!cleanId) throw new Error("Portfolio URL is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const meta = await fetchPortfolioMetadata(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        await saveExternalConnection({
          personId,
          provider: "portfolio" as any,
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
          const projects = parsed.projects || [];

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

          acquisitionStatus = "MANUAL_ARCHIVE_VERIFIED";
          summary = `Parsed student-authorized LinkedIn archive (${exportFilename}). Extracted ${positions.length} roles, ${education.length} degrees, and ${skills.length} skills for student review.`;
          extractedDetails = {
            positionsCount: positions.length,
            educationCount: education.length,
            skillsCount: skills.length,
            projectsCount: projects.length,
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

        if (stats.totalSolved > 0) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "LeetCode Problem Solving",
            value: `${stats.totalSolved} solved (${stats.easySolved} Easy, ${stats.mediumSolved} Medium, ${stats.hardSolved} Hard)`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: stats.profileUrl,
            interpretation: `Public LeetCode problem solving record. Global Rank: ${stats.globalRanking ?? "N/A"}.`,
            whyItMatters: "Demonstrates consistent algorithmic practice and data structure implementation.",
          });
          recordsCreated++;
        }

        acquisitionStatus = stats.acquisitionStatus === "LIVE_VERIFIED" ? "API_PUBLIC_UNVERIFIED_OWNERSHIP" : stats.acquisitionStatus;
        summary = stats.totalSolved > 0
          ? `Ingested LeetCode public stats: ${stats.totalSolved} problems solved (unauthenticated public metrics).`
          : `LeetCode profile reference linked (${stats.profileUrl}).`;
        extractedDetails = stats as any;
        break;
      }

      case "hackerrank": {
        if (!cleanId) throw new Error("HackerRank username is required.");
        const profile = await fetchHackerRankProfile(cleanId);
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

        acquisitionStatus = profile.status === "LIVE_VERIFIED" ? "API_PUBLIC_UNVERIFIED_OWNERSHIP" : profile.status;
        summary = profile.notes || "HackerRank profile linked.";
        extractedDetails = profile as any;
        break;
      }

      case "codechef": {
        if (!cleanId) throw new Error("CodeChef handle is required.");
        const profile = await fetchCodeChefProfile(cleanId);
        await saveExternalConnection({
          personId,
          provider: "codechef",
          externalUsername: profile.username,
          profileUrl: profile.profileUrl,
          displayName: profile.username,
          status: "reference_only",
        });
        acquisitionStatus = "PROFILE_LINK_ONLY";
        summary = "CodeChef profile linked.";
        extractedDetails = profile as any;
        break;
      }

      case "hackerearth": {
        if (!cleanId) throw new Error("HackerEarth handle is required.");
        const profile = await fetchHackerEarthProfile(cleanId);
        await saveExternalConnection({
          personId,
          provider: "hackerearth",
          externalUsername: profile.username,
          profileUrl: profile.profileUrl,
          displayName: profile.username,
          status: "reference_only",
        });
        acquisitionStatus = "PROFILE_LINK_ONLY";
        summary = "HackerEarth profile linked.";
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
          provider: "huggingface" as any,
          externalUsername: artifacts.username,
          profileUrl: artifacts.profileUrl,
          displayName: artifacts.username,
          status: artifacts.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        for (const m of artifacts.models) {
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

        acquisitionStatus = artifacts.status;
        summary = artifacts.notes || `Linked Hugging Face account with ${artifacts.models.length} public models.`;
        extractedDetails = artifacts as any;
        break;
      }

      case "orcid": {
        if (!cleanId) throw new Error("ORCID identifier is required.");
        await SourceProcessingJobService.updateStage(jobId, personId, "parse");
        const orcidRecord = await fetchOrcidRecord(cleanId);
        await SourceProcessingJobService.updateStage(jobId, personId, "extract");

        await saveExternalConnection({
          personId,
          provider: "orcid" as any,
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

      case "devto": {
        if (!cleanId) throw new Error("DEV.to username is required.");
        const devto = await fetchDevToArticles(cleanId);
        await saveExternalConnection({
          personId,
          provider: "devto" as any,
          externalUsername: devto.username,
          profileUrl: devto.profileUrl,
          displayName: devto.username,
          status: devto.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        for (const art of devto.articles) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: art.title,
            value: `${art.positiveReactionsCount} reactions. Tags: ${art.tags.join(", ")}`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: art.url,
            interpretation: `Technical writing and developer tutorial publication on DEV.to.`,
            whyItMatters: "Demonstrates technical communication, teaching ability, and domain clarity.",
          });
          recordsCreated++;
        }

        acquisitionStatus = devto.status;
        summary = `DEV.to profile connected with ${devto.articles.length} public articles.`;
        extractedDetails = devto as any;
        break;
      }

      case "stackoverflow": {
        if (!cleanId) throw new Error("Stack Overflow ID is required.");
        const so = await fetchStackOverflowProfile(cleanId);
        await saveExternalConnection({
          personId,
          provider: "stackoverflow" as any,
          externalUsername: so.userId,
          profileUrl: so.profileUrl,
          displayName: so.displayName || `SO User ${so.userId}`,
          status: so.status === "LIVE_VERIFIED" ? "connected" : "reference_only",
        });

        if (so.reputation > 0) {
          await createEvidenceRecord(personId, {
            category: "other",
            subject: "Stack Overflow Reputation",
            value: `${so.reputation} reputation score`,
            source: "imported",
            verificationStatus: "unverified",
            sourceReference: so.profileUrl,
            interpretation: `Public technical Q&A contributions and community reputation.`,
            whyItMatters: "Indicates real-world debugging, problem diagnosis, and peer helpfulness.",
          });
          recordsCreated++;
        }

        acquisitionStatus = so.status;
        summary = `Stack Overflow linked with ${so.reputation} reputation score.`;
        extractedDetails = so as any;
        break;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // 3. Finalize Job
    await SourceProcessingJobService.completeJob({
      jobId,
      personId,
      resultReference: `records_${recordsCreated}`,
      metadata: { acquisitionStatus, recordsCreated },
    });

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
