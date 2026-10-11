import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { getDb, resumeDocuments } from "@/lib/db";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";
import { EoraResumeAdvisor } from "@/lib/services/eora-resume-advisor";
import { ObjectStorageService } from "@/lib/storage/object-storage";

export const runtime = "nodejs";

export async function GET(
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

    // Fetch from Extractor Backend first
    let docView: any = null;
    try {
      docView = await ExtractorServiceClient.getDocument(documentId, personId);
    } catch {
      // Check Neon DB snapshot fallback
      const db = await getDb();
      const records = await db
        .select()
        .from(resumeDocuments)
        .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));

      if (records && records.length > 0) {
        const rec = records[0];
        docView = {
          profile: rec.extractedProfile,
          status: {
            document_id: documentId,
            status: rec.status,
            warnings: rec.warnings || [],
          },
        };
      }
    }

    if (!docView) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
    }

    // Generate EORA guidance if profile exists
    const eoraGuidance = docView.profile
      ? EoraResumeAdvisor.analyzeProfile(docView.profile)
      : null;

    return NextResponse.json({
      ok: true,
      documentId,
      ...docView,
      eoraGuidance,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to fetch document." }, { status: 500 });
  }
}

export async function DELETE(
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

    // 1. Delete from object storage & DB
    await ObjectStorageService.deleteDocument(documentId, personId);

    // 2. Delete from Extractor Backend
    try {
      await ExtractorServiceClient.deleteDocument(documentId, personId);
    } catch (backendErr) {
      console.warn("Backend deletion note:", backendErr);
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to delete document." }, { status: 500 });
  }
}
