import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
/**
 * AI TATHASTU — DIGITAL FOOTPRINT INTELLIGENCE V4.6
 * Universal Digital Footprint Acquisition, Normalization & Fusion API
 *
 * Delegates directly to DigitalSourceImportOrchestrator for unified,
 * single-action consent-based import across all supported providers.
 */

import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { DigitalSourceImportOrchestrator } from "@/lib/services/digital-source-import-orchestrator";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";

async function POST_handler(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { provider, identifier, exportFilename, exportContent, consent, jobId } = body;

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

    // Execute via Unified Orchestrator
    const result = await DigitalSourceImportOrchestrator.startImport({
      personId,
      provider,
      identifier: typeof identifier === "string" ? identifier.trim() : "",
      exportFilename,
      exportContent,
      consent: true,
      jobId: typeof jobId === "string" ? jobId : undefined,
    });

    // The import creates review candidates and a source snapshot. Canonical evidence
    // is written only after the student confirms candidates in onboarding.
    await createJourneyEventRecord(personId, {
      type: "footprint_connected",
      title: result.connectionStatus === "detected" ? `Detected ${provider.toUpperCase()} profile (unverified)` : `Connected ${provider.toUpperCase()}`,
      description: result.summary,
      metadata: { provider, acquisitionStatus: result.acquisitionMode, candidateCount: result.candidateCount },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      provider: result.provider,
      acquisitionStatus: result.acquisitionMode,
      recordsCreated: result.recordsCreated,
      candidateCount: result.candidateCount,
      summary: result.summary,
      connectionStatus: result.connectionStatus,
      partial: Boolean(result.partial),
      candidates: result.candidates,
      lastSyncedAt: result.lastSyncedAt,
      projects: result.candidates.projects,
      skills: result.candidates.skills,
      experiences: result.candidates.experiences,
      educations: result.candidates.educations,
      achievements: result.candidates.achievements,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Footprint synchronization failed.";
    console.error("[Footprint Sync Error]", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
