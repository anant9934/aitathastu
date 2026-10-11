import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { getDb, resumeDocuments } from "@/lib/db";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

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

    let statusRes: any = null;
    try {
      statusRes = await ExtractorServiceClient.getStatus(documentId, personId);
    } catch {
      const db = await getDb();
      const records = await db
        .select()
        .from(resumeDocuments)
        .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));

      if (records && records.length > 0) {
        statusRes = {
          document_id: documentId,
          status: records[0].status,
          warnings: records[0].warnings || [],
        };
      }
    }

    if (!statusRes) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...statusRes });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to fetch document status." }, { status: 500 });
  }
}
