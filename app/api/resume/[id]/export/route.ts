import { NextResponse } from "next/server";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "summary" ? "summary" : "json";

  try {
    const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
    if (!authRes || !authRes.auth) {
      return NextResponse.json({ ok: false, error: "Unauthorized session." }, { status: 401 });
    }
    const personId = authRes.auth.person.id;

    const exportText = await ExtractorServiceClient.exportDocument(documentId, personId, format);

    if (format === "json") {
      return new Response(exportText, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="resume-${documentId}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(exportText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="resume-${documentId}.txt"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Export failed." }, { status: 500 });
  }
}
