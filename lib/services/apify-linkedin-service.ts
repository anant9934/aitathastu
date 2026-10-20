/**
 * Apify-powered LinkedIn public profile extraction.
 *
 * Architecture:
 * - Uses the existing APIFY_TOKEN_1..4 key pool.
 * - Requires APIFY_LINKEDIN_ACTOR_ID — the operator's chosen, ToS-verified actor.
 * - Requires APIFY_LINKEDIN_TERMS_ACKNOWLEDGED=true — explicit operator sign-off.
 * - Reports not_configured if either is absent.
 * - Does NOT use ApifyConnector.runApprovedActor: that class blocks linkedin.com URLs
 *   for generic web crawlers. This service runs a purpose-configured LinkedIn actor only.
 *
 * Async run flow:
 *   1. Start actor run with waitForFinish=25 (safe for Vercel Edge/Node limits).
 *   2. If SUCCEEDED → fetch dataset → normalize → persist.
 *   3. If RUNNING  → save run ID in connection metadata → return extraction_queued.
 *   4. Caller polls /api/student/linkedin/extract (GET) which calls pollLinkedInRun().
 *
 * Output schema:
 *   The mapper handles both flat and nested actor schemas since actor format varies.
 *   Only fields that are actually present in the actor's response are used.
 *
 * Security:
 *   - Token never logged or returned to the client.
 *   - Actor output is treated as untrusted input; every field is validated.
 *   - Tenant isolation enforced: personId is always passed to persistence functions.
 *   - SSRF prevention: only apify.com endpoints are called.
 */

import { KeyPool } from "@/lib/intelligence/providers/key-pool";
import { validateLinkedInUrl } from "@/lib/connectors/linkedin/client";
import { writeEvidenceBatch, type EvidenceInsertParams } from "@/lib/repositories/evidence-repository";
import { saveExternalConnection, getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import { writeOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { logger } from "@/lib/logger";

// ─── Configuration ────────────────────────────────────────────────────────────

const APIFY_TOKEN_ENV_VARS = ["APIFY_TOKEN", "APIFY_TOKENS", "APIFY_API_KEYS", "APIFY_API_KEY"] as const;
const WAIT_FOR_FINISH_SECS = 25;
const DATASET_ITEM_LIMIT = 1;

export type ExtractionStatus =
  | "not_configured"
  | "extraction_queued"
  | "extracting"
  | "synced"
  | "partially_extracted"
  | "no_results"
  | "failed";

export type ExtractionConfig = {
  configured: boolean;
  actorId: string | null;
  reason: string;
};

export type ExtractionResult = {
  status: ExtractionStatus;
  runId?: string;
  datasetId?: string;
  recordsDiscovered: number;
  recordsPersisted: number;
  message: string;
};

/** Reports whether the Apify LinkedIn extraction is ready to run without touching any token values. */
export function getLinkedInExtractionConfig(): ExtractionConfig {
  const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID?.trim() || null;
  const termsAck = process.env.APIFY_LINKEDIN_TERMS_ACKNOWLEDGED?.trim().toLowerCase() === "true";
  const pool = new KeyPool([...APIFY_TOKEN_ENV_VARS]);

  if (!actorId) {
    return { configured: false, actorId: null, reason: "APIFY_LINKEDIN_ACTOR_ID is not set. Configure a compliant LinkedIn profile actor to enable extraction." };
  }
  if (!termsAck) {
    return { configured: false, actorId, reason: "APIFY_LINKEDIN_TERMS_ACKNOWLEDGED must be set to true after verifying the actor's compliance with LinkedIn terms." };
  }
  if (!pool.hasKeys()) {
    return { configured: false, actorId, reason: "No Apify API token is configured (APIFY_TOKEN_1..4)." };
  }
  return { configured: true, actorId, reason: "ready" };
}

// ─── Apify HTTP helpers ────────────────────────────────────────────────────────

type ApifyRunResponse = {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
    usageTotalUsd?: number;
    computeUnits?: number;
  };
};

async function startActorRun(actorId: string, input: Record<string, unknown>, token: string): Promise<ApifyRunResponse> {
  const encodedActor = actorId.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${encodedActor}/runs?waitForFinish=${WAIT_FOR_FINISH_SECS}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((WAIT_FOR_FINISH_SECS + 5) * 1000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Apify run start failed: HTTP ${res.status}`), { status: res.status, body: text.slice(0, 200) });
  }
  return res.json() as Promise<ApifyRunResponse>;
}

async function getRunStatus(runId: string, token: string): Promise<ApifyRunResponse> {
  const url = `https://api.apify.com/v2/actor-runs/${runId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Apify run status check failed: HTTP ${res.status}`);
  return res.json() as Promise<ApifyRunResponse>;
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${DATASET_ITEM_LIMIT}&clean=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── Output normalisation ──────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOr(a: unknown, b: unknown): string {
  return str(a) || str(b);
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50);
}

/**
 * Normalizes Apify actor output items into EvidenceInsertParams[].
 * Handles both flat style { name, experience: [] } and nested { profile: { name }, experience: [] }.
 * Every field access is optional — missing fields are skipped, not fabricated.
 */
export function mapActorOutputToEvidence(
  items: unknown[],
  profileUrl: string,
  actorId: string,
  extractedAt: string,
): EvidenceInsertParams[] {
  const results: EvidenceInsertParams[] = [];
  if (!Array.isArray(items) || items.length === 0) return results;

  // Actor output is untrusted; only use plain objects
  const item = typeof items[0] === "object" && items[0] !== null ? (items[0] as Record<string, unknown>) : {};
  const profile = typeof item.profile === "object" && item.profile !== null ? (item.profile as Record<string, unknown>) : item;

  const resolvedUrl = str(item.url) || str(item.profileUrl) || str(profile.url) || str(profile.profileUrl) || profileUrl;

  // Experience entries — actor uses "experiences" (plural); fallbacks for other actor schemas
  const experiences = asArray(item.experiences ?? item.experience ?? item.positions ?? item.workHistory ?? profile.experiences ?? profile.experience ?? profile.positions);
  for (const exp of experiences) {
    if (typeof exp !== "object" || exp === null) continue;
    const e = exp as Record<string, unknown>;
    const title = strOr(e.title, e.role);
    const company = strOr(e.company, e.companyName);
    if (!title || !company) continue;
    const startDate = strOr(e.startDate, e.from);
    const endDate = strOr(e.endDate, e.to);
    results.push({
      category: "experience",
      subject: `${title} at ${company}`,
      value: [startDate, endDate].filter(Boolean).join(" – ") || title,
      source: "imported",
      verificationStatus: "imported",
      originSource: "linkedin",
      sourceReference: resolvedUrl,
      importKey: `linkedin_apify_exp_${slug(company)}_${slug(title)}`,
      interpretation: str(e.description) || `${title} at ${company}, extracted from public LinkedIn profile via Apify.`,
      whyItMatters: "Work history extracted from public LinkedIn profile.",
    });
  }

  // Education entries — actor uses "educations" (plural) with subkeys: school, degree, startYear, endYear
  const educations = asArray(item.educations ?? item.education ?? item.schools ?? profile.educations ?? profile.education ?? profile.schools);
  for (const edu of educations) {
    if (typeof edu !== "object" || edu === null) continue;
    const e = edu as Record<string, unknown>;
    const school = strOr(e.school, e.schoolName);
    if (!school) continue;
    const degree = strOr(e.degree, e.degreeName);
    const endDate = strOr(e.endYear, e.endDate) || strOr(e.graduationDate, "");
    results.push({
      category: "education",
      subject: school,
      value: degree || "Education",
      source: "imported",
      verificationStatus: "imported",
      originSource: "linkedin",
      sourceReference: resolvedUrl,
      importKey: `linkedin_apify_edu_${slug(school)}`,
      interpretation: `${degree || "Studied"} at ${school}${endDate ? ` (${endDate})` : ""}, extracted from public LinkedIn profile via Apify.`,
      whyItMatters: "Education extracted from public LinkedIn profile.",
    });
  }

  // Certifications
  const certs = asArray(item.certifications ?? item.licenses ?? profile.certifications ?? profile.licenses);
  for (const cert of certs) {
    if (typeof cert !== "object" || cert === null) continue;
    const c = cert as Record<string, unknown>;
    const name = str(c.name);
    if (!name) continue;
    const authority = strOr(c.authority, c.issuingOrganization);
    results.push({
      category: "other",
      subject: name,
      value: authority ? `Issued by ${authority}` : "Certification",
      source: "imported",
      verificationStatus: "imported",
      originSource: "linkedin",
      sourceReference: resolvedUrl,
      importKey: `linkedin_apify_cert_${slug(name)}`,
      interpretation: `${name}${authority ? ` from ${authority}` : ""}, from public LinkedIn profile.`,
      whyItMatters: "Certification from public LinkedIn profile.",
    });
  }

  return results;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistExtractionResults(
  personId: string,
  items: unknown[],
  profileUrl: string,
  actorId: string,
  runId: string,
  datasetId: string,
  extractedAt: string,
): Promise<{ persisted: number; discovered: number }> {
  const evidenceItems = mapActorOutputToEvidence(items, profileUrl, actorId, extractedAt);
  const discovered = evidenceItems.length;
  if (discovered === 0) return { persisted: 0, discovered: 0 };

  const written = await writeEvidenceBatch(personId, evidenceItems);
  const persisted = written.length;

  // Write candidate experience/education to onboarding draft
  const item = typeof items[0] === "object" && items[0] !== null ? (items[0] as Record<string, unknown>) : {};
  const rawExp = item.experiences ?? item.experience ?? item.positions;
  const rawEdu = item.educations ?? item.education ?? item.schools;
  const experiences: unknown[] = Array.isArray(rawExp) ? rawExp : [];
  const educations: unknown[] = Array.isArray(rawEdu) ? rawEdu : [];
  const skills: unknown[] = Array.isArray(item.skills) ? item.skills : [];

  const patch: Record<string, unknown> = {};
  if (experiences.length > 0) {
    patch.experiences = experiences
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        company: strOr(e.company, e.companyName),
        role: strOr(e.title, e.role),
        startDate: strOr(e.startDate, e.from) || undefined,
        endDate: strOr(e.endDate, e.to) || undefined,
        status: "candidate",
        source: "linkedin",
      }))
      .filter((e) => e.company && e.role);
  }
  if (educations.length > 0) {
    patch.education = educations
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        institution: strOr(e.school, e.schoolName),
        degree: strOr(e.degree, e.degreeName) || undefined,
        endDate: strOr(e.endYear, e.endDate) || strOr(e.graduationDate, "") || undefined,
        status: "candidate",
        source: "linkedin",
      }))
      .filter((e) => e.institution);
  }
  if (skills.length > 0) {
    patch.skills = skills
      .map((s) => (typeof s === "string" ? s : str((s as Record<string, unknown>)?.name)))
      .filter(Boolean);
  }
  if (Object.keys(patch).length > 0) {
    await writeOnboardingDraft(personId, patch, { origin: "system" });
  }

  return { persisted, discovered };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Start a LinkedIn profile extraction run. */
export async function extractLinkedInProfile(params: {
  profileUrl: string;
  personId: string;
  requestId?: string;
}): Promise<ExtractionResult> {
  const cfg = getLinkedInExtractionConfig();
  if (!cfg.configured || !cfg.actorId) {
    return { status: "not_configured", recordsDiscovered: 0, recordsPersisted: 0, message: cfg.reason };
  }

  const ref = validateLinkedInUrl(params.profileUrl);
  if (!ref.valid) {
    return { status: "failed", recordsDiscovered: 0, recordsPersisted: 0, message: ref.error || "Invalid LinkedIn URL." };
  }

  const pool = new KeyPool([...APIFY_TOKEN_ENV_VARS]);
  const token = pool.getNextKey();
  if (!token) {
    return { status: "not_configured", recordsDiscovered: 0, recordsPersisted: 0, message: "No Apify API token available." };
  }

  const actorId = cfg.actorId;
  const extractedAt = new Date().toISOString();

  // Mark as syncing before we start
  await saveExternalConnection({
    personId: params.personId,
    provider: "linkedin",
    externalUsername: ref.username,
    profileUrl: ref.normalizedUrl,
    status: "syncing",
    metadata: {
      extractionStatus: "extracting",
      extractionActorId: actorId,
      extractionStartedAt: extractedAt,
    },
  }).catch(() => null);

  let runData: ApifyRunResponse;
  try {
    runData = await startActorRun(actorId, { profileUrls: [ref.normalizedUrl] }, token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("apify_linkedin.start_failed", { status: "failed", error: msg });
    await updateConnectionStatus(params.personId, ref, "needs_attention", { extractionStatus: "failed", extractionError: "Actor run failed to start." });
    return { status: "failed", recordsDiscovered: 0, recordsPersisted: 0, message: "Could not start extraction. Check Apify token and actor configuration." };
  }

  const runId = runData.data?.id;
  const runStatus = runData.data?.status ?? "";
  const datasetId = runData.data?.defaultDatasetId;

  if (runStatus === "RUNNING" || runStatus === "READY" || runStatus === "ABORTING") {
    // Actor is still running — save run ID for polling
    await updateConnectionStatus(params.personId, ref, "syncing", {
      extractionStatus: "extraction_queued",
      extractionRunId: runId,
      extractionActorId: actorId,
    });
    return { status: "extraction_queued", runId: runId ?? undefined, recordsDiscovered: 0, recordsPersisted: 0, message: "Extraction started. Check back shortly for results." };
  }

  if (runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") {
    await updateConnectionStatus(params.personId, ref, "needs_attention", { extractionStatus: "failed" });
    return { status: "failed", runId: runId ?? undefined, recordsDiscovered: 0, recordsPersisted: 0, message: `Actor run ended with status: ${runStatus}.` };
  }

  // SUCCEEDED — fetch and persist dataset
  if (!datasetId) {
    await updateConnectionStatus(params.personId, ref, "reference_only", { extractionStatus: "no_results" });
    return { status: "no_results", runId: runId ?? undefined, recordsDiscovered: 0, recordsPersisted: 0, message: "Actor succeeded but returned no dataset." };
  }

  const items = await fetchDatasetItems(datasetId, token);
  if (items.length === 0) {
    await updateConnectionStatus(params.personId, ref, "reference_only", { extractionStatus: "no_results" });
    return { status: "no_results", runId: runId ?? undefined, datasetId, recordsDiscovered: 0, recordsPersisted: 0, message: "Actor returned an empty dataset. Check that the profile URL is public and correct." };
  }

  const { persisted, discovered } = await persistExtractionResults(
    params.personId, items, ref.normalizedUrl, actorId, runId ?? "", datasetId, extractedAt
  );

  const finalStatus: ExtractionStatus = persisted === 0 ? "no_results" : discovered > persisted ? "partially_extracted" : "synced";
  // Use "connected" (not reference_only) after actual data import so the UI shows "Imported".
  // Include lastSyncedAt so the repository sets the lastSyncedAt DB column (checked by the UI).
  const connStatus = (finalStatus === "synced" || finalStatus === "partially_extracted") ? "connected" : "reference_only";
  const syncedAt = new Date().toISOString();
  await updateConnectionStatus(params.personId, ref, connStatus, {
    extractionStatus: finalStatus,
    lastExtractedAt: syncedAt,
    ...(connStatus === "connected" ? { lastSyncedAt: syncedAt } : {}),
    extractionRecordCount: persisted,
    extractionActorId: actorId,
    extractionRunId: runId,
  });

  logger.info("apify_linkedin.extracted", {
    status: finalStatus,
    metadata: { discovered, persisted },
  });

  return {
    status: finalStatus,
    runId: runId ?? undefined,
    datasetId,
    recordsDiscovered: discovered,
    recordsPersisted: persisted,
    message: persisted > 0 ? `Extracted ${persisted} records from public LinkedIn profile.` : "No recognisable profile data found in actor output.",
  };
}

/** Poll a queued run for completion. Call this from the GET /extract endpoint. */
export async function pollLinkedInRun(params: {
  personId: string;
  runId: string;
  profileUrl: string;
  actorId: string;
}): Promise<ExtractionResult> {
  const pool = new KeyPool([...APIFY_TOKEN_ENV_VARS]);
  const token = pool.getNextKey();
  if (!token) {
    return { status: "not_configured", recordsDiscovered: 0, recordsPersisted: 0, message: "No Apify token available for status check." };
  }

  const ref = validateLinkedInUrl(params.profileUrl);
  const profileUrl = ref.valid ? ref.normalizedUrl : params.profileUrl;
  const username = ref.valid ? ref.username : "linkedin_user";

  let runData: ApifyRunResponse;
  try {
    runData = await getRunStatus(params.runId, token);
  } catch {
    return { status: "failed", runId: params.runId, recordsDiscovered: 0, recordsPersisted: 0, message: "Could not reach Apify to check run status." };
  }

  const runStatus = runData.data?.status ?? "";
  const datasetId = runData.data?.defaultDatasetId;

  if (runStatus === "RUNNING" || runStatus === "READY") {
    return { status: "extracting", runId: params.runId, recordsDiscovered: 0, recordsPersisted: 0, message: "Extraction still running." };
  }
  if (runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") {
    await updateConnectionStatus(params.personId, { username, normalizedUrl: profileUrl, valid: true }, "needs_attention", { extractionStatus: "failed" });
    return { status: "failed", runId: params.runId, recordsDiscovered: 0, recordsPersisted: 0, message: `Actor run ended with status: ${runStatus}.` };
  }
  if (runStatus !== "SUCCEEDED" || !datasetId) {
    return { status: "no_results", runId: params.runId, recordsDiscovered: 0, recordsPersisted: 0, message: "Actor succeeded but returned no dataset." };
  }

  const items = await fetchDatasetItems(datasetId, token);
  if (items.length === 0) {
    await updateConnectionStatus(params.personId, { username, normalizedUrl: profileUrl, valid: true }, "reference_only", { extractionStatus: "no_results" });
    return { status: "no_results", runId: params.runId, datasetId, recordsDiscovered: 0, recordsPersisted: 0, message: "Extraction returned no data." };
  }

  const extractedAt = new Date().toISOString();
  const { persisted, discovered } = await persistExtractionResults(
    params.personId, items, profileUrl, params.actorId, params.runId, datasetId, extractedAt
  );

  const finalStatus: ExtractionStatus = persisted === 0 ? "no_results" : discovered > persisted ? "partially_extracted" : "synced";
  const connStatus = (finalStatus === "synced" || finalStatus === "partially_extracted") ? "connected" : "reference_only";
  await updateConnectionStatus(params.personId, { username, normalizedUrl: profileUrl, valid: true }, connStatus, {
    extractionStatus: finalStatus,
    lastExtractedAt: extractedAt,
    ...(connStatus === "connected" ? { lastSyncedAt: extractedAt } : {}),
    extractionRecordCount: persisted,
    extractionActorId: params.actorId,
    extractionRunId: params.runId,
  });

  return {
    status: finalStatus,
    runId: params.runId,
    datasetId,
    recordsDiscovered: discovered,
    recordsPersisted: persisted,
    message: persisted > 0 ? `Extracted ${persisted} records.` : "No recognisable profile data found.",
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function updateConnectionStatus(
  personId: string,
  ref: { valid: boolean; username: string; normalizedUrl: string },
  status: "syncing" | "reference_only" | "needs_attention" | "connected",
  metadataAdditions: Record<string, unknown>,
) {
  const existing = await getExternalConnectionByProvider(personId, "linkedin").catch(() => null);
  await saveExternalConnection({
    personId,
    provider: "linkedin",
    externalUsername: existing?.externalUsername || ref.username,
    profileUrl: existing?.profileUrl || ref.normalizedUrl,
    status,
    metadata: metadataAdditions,
  }).catch(() => null);
}
