import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { getDb, resumeDocuments } from "@/lib/db";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";
import { ResumePerson360Mapper } from "@/lib/services/resume-person360-mapper";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  try {
    const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
    if (!authRes || !authRes.auth) {
      return NextResponse.json({ ok: false, error: "Unauthorized session." }, { status: 401 });
    }
    const personId = authRes.auth.person.id;

    // Fetch latest profile
    let profile: any = null;
    try {
      const docView = await ExtractorServiceClient.getDocument(documentId, personId);
      profile = docView.profile;
    } catch {
      const db = await getDb();
      const docs = await db
        .select()
        .from(resumeDocuments)
        .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
      if (docs.length > 0) {
        profile = docs[0].extractedProfile;
      }
    }

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Extraction profile not ready or document not found." },
        { status: 404 }
      );
    }

    // Apply into Person 360
    const mappingResult = await ResumePerson360Mapper.applyProfileToPerson360(
      personId,
      documentId,
      profile
    );

    return NextResponse.json({
      ok: true,
      documentId,
      message: "Successfully synchronized approved resume details into Person 360 profile.",
      mappingResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to synchronize profile." },
      { status: 500 }
    );
  }
}
