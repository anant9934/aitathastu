import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
/**
 * AI TATHASTU — DIGITAL FOOTPRINT INTELLIGENCE V4.6
 * Universal Digital Footprint Acquisition, Normalization & Fusion API
 *
 * Implements strict Indian legal compliance (DPDP Act 2023 / Digital Footprint Transparency):
 * - CV-discovered URLs are stored as "reference_only" references and NEVER trigger external network calls.
 * - External retrieval requires explicit per-provider student consent.
 * - All permissions are recorded server-side before execution.
 */

import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { DigitalSourceImportOrchestrator } from "@/lib/services/digital-source-import-orchestrator";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";
import { saveExternalConnection } from "@/lib/repositories/connection-repository";
import { ConsentService } from "@/lib/services/consent-service";

async function POST_handler(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { provider, identifier, exportFilename, exportContent, consent, jobId, referenceOnly } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json({ error: "Provider is required." }, { status: 400 });
    }

    const personId = auth.person.id;
    const cleanIdentifier = typeof identifier === "string" ? identifier.trim() : "";

    // 1. Handling Reference-Only Mode (e.g. CV URL Discovery)
    // CRITICAL: A referenceOnly operation MUST NEVER execute external network requests, scraping, or API fetching.
    if (referenceOnly === true) {
      const validated = DigitalSourceImportOrchestrator.validateProfile(provider, cleanIdentifier);
      const profileUrl = validated.valid ? validated.normalizedUrl : cleanIdentifier;

      await saveExternalConnection({
        personId,
        provider,
        externalUsername: validated.valid ? validated.normalizedIdentifier : cleanIdentifier,
        profileUrl,
        status: "reference_only",
        metadata: {
          discoverySource: "cv_extraction",
          recordedAt: new Date().toISOString(),
          referenceOnly: true,
        },
      });

      await ConsentService.recordConsent({
        personId,
        purpose: "footprint_reference",
        scope: `${provider}:${cleanIdentifier}`,
        status: "granted",
        sourceUI: "onboarding_cv_discovery",
        metadata: { referenceOnly: true },
      }).catch((e) => console.warn("[footprints-sync] reference consent warning", e));

      return NextResponse.json({
        success: true,
        provider,
        acquisitionStatus: "MANUAL_PROFILE_REFERENCE",
        connectionStatus: "reference_only",
        candidateCount: 0,
        recordsCreated: 0,
        summary: `Discovered ${provider.toUpperCase()} profile reference saved for student review without external retrieval.`,
        partial: false,
        lastSyncedAt: null,
        candidates: {
          projects: [],
          skills: [],
          experiences: [],
          educations: [],
          achievements: [],
        },
      });
    }

    // 2. Active External Data Import Mode: Requires explicit student authorization
    if (!consent) {
      return NextResponse.json(
        { error: `Explicit authorization consent is required before retrieving data from ${provider}.` },
        { status: 400 }
      );
    }

    // Record immutable provider-specific consent decision in the ledger
    await ConsentService.recordConsent({
      personId,
      purpose: "external_profile_fetch",
      scope: `${provider}:${cleanIdentifier}`,
      status: "granted",
      sourceUI: "onboarding_footprint_step",
      metadata: { provider, identifier: cleanIdentifier },
    }).catch((e) => console.warn("[footprints-sync] fetch consent warning", e));

    // Execute via Unified Orchestrator
    const result = await DigitalSourceImportOrchestrator.startImport({
      personId,
      provider,
      identifier: cleanIdentifier,
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
