import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { parseLinkedInDataExport, parseLinkedInZipArchive } from "@/lib/connectors/linkedin/client";
import { writeEvidenceBatch } from "@/lib/repositories/evidence-repository";
import { saveExternalConnection, getExternalConnectionByProvider } from "@/lib/repositories/connection-repository";
import { writeOnboardingDraft } from "@/lib/services/onboarding-v2-service";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50);
}

async function POST_handler(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a file field." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded. Send a LinkedIn Positions.csv, Education.csv, Skills.csv, or the full ZIP archive." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10 MB limit." }, { status: 413 });
  }

  const name = file.name.toLowerCase().trim();
  const isZip = name.endsWith(".zip");
  const isCsv = name.endsWith(".csv");
  const isJson = name.endsWith(".json");
  if (!isZip && !isCsv && !isJson) {
    return NextResponse.json({ error: "Only CSV, JSON, or ZIP LinkedIn export files are accepted." }, { status: 415 });
  }

  let parsed;
  if (isZip) {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseLinkedInZipArchive(buffer);
  } else {
    const content = await file.text();
    parsed = parseLinkedInDataExport(file.name, content);
  }

  if (!parsed.totalRecords) {
    return NextResponse.json({
      ok: true,
      totalRecords: 0,
      message: parsed.complianceNotice ?? "No records found in the file. Ensure it is a LinkedIn data export file.",
    });
  }

  const personId = auth.person.id;
  const evidenceItems = [
    ...(parsed.positions ?? [])
      .filter((p) => p.companyName && p.title)
      .map((p) => ({
        category: "experience" as const,
        subject: `${p.title} at ${p.companyName}`,
        value: [p.startedOn, p.finishedOn].filter(Boolean).join(" – ") || p.title,
        source: "imported" as const,
        verificationStatus: "imported" as const,
        originSource: "linkedin",
        importKey: `linkedin_exp_${slug(p.companyName)}_${slug(p.title)}`,
        interpretation: p.description || `${p.title} at ${p.companyName}, from LinkedIn export.`,
        whyItMatters: "Work history from your LinkedIn data export.",
      })),
    ...(parsed.education ?? [])
      .filter((e) => e.schoolName)
      .map((e) => ({
        category: "education" as const,
        subject: e.schoolName,
        value: e.degreeName || "Education",
        source: "imported" as const,
        verificationStatus: "imported" as const,
        originSource: "linkedin",
        importKey: `linkedin_edu_${slug(e.schoolName)}`,
        interpretation: `${e.degreeName || "Studied"} at ${e.schoolName}${e.endDate ? ` (${e.endDate})` : ""}, from LinkedIn export.`,
        whyItMatters: "Education from your LinkedIn data export.",
      })),
    ...(parsed.certifications ?? [])
      .filter((c) => c.name)
      .map((c) => ({
        category: "other" as const,
        subject: c.name,
        value: c.authority ? `Issued by ${c.authority}` : "Certification",
        source: "imported" as const,
        verificationStatus: "imported" as const,
        originSource: "linkedin",
        importKey: `linkedin_cert_${slug(c.name)}`,
        interpretation: `${c.name}${c.authority ? ` from ${c.authority}` : ""}, from LinkedIn export.`,
        whyItMatters: "Certification from your LinkedIn data export.",
      })),
  ];

  if (evidenceItems.length > 0) {
    await writeEvidenceBatch(personId, evidenceItems);
  }

  // Write candidates to onboarding draft
  const draftPatch: Record<string, unknown> = {};
  if ((parsed.positions ?? []).length > 0) {
    draftPatch.experiences = (parsed.positions ?? [])
      .filter((p) => p.companyName && p.title)
      .map((p) => ({
        company: p.companyName,
        role: p.title,
        startDate: p.startedOn,
        endDate: p.finishedOn,
        status: "candidate",
        source: "linkedin",
      }));
  }
  if ((parsed.education ?? []).length > 0) {
    draftPatch.education = (parsed.education ?? [])
      .filter((e) => e.schoolName)
      .map((e) => ({
        institution: e.schoolName,
        degree: e.degreeName,
        startDate: e.startDate,
        endDate: e.endDate,
        status: "candidate",
        source: "linkedin",
      }));
  }
  if ((parsed.skills ?? []).length > 0) {
    draftPatch.skills = (parsed.skills ?? []).map((s) => s.name).filter(Boolean);
  }
  if (Object.keys(draftPatch).length > 0) {
    await writeOnboardingDraft(personId, draftPatch, { origin: "system" });
  }

  // Mark as synced so FootprintOverview reflects the import.
  // Preserve any existing profileUrl so a prior URL link is not overwritten.
  const existing = await getExternalConnectionByProvider(personId, "linkedin").catch(() => null);
  await saveExternalConnection({
    personId,
    provider: "linkedin",
    externalUsername: existing?.externalUsername ?? "export",
    profileUrl: existing?.profileUrl ?? "",
    status: "reference_only",
    metadata: { lastSyncedAt: new Date().toISOString(), importedVia: "csv_export" },
  });

  return NextResponse.json({
    ok: true,
    totalRecords: parsed.totalRecords,
    positions: (parsed.positions ?? []).length,
    education: (parsed.education ?? []).length,
    skills: (parsed.skills ?? []).length,
    projects: (parsed.projects ?? []).length,
    certifications: (parsed.certifications ?? []).length,
  });
}

export const POST = withStudentCacheInvalidation(POST_handler);
