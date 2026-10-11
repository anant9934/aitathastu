import { NextResponse } from "next/server";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

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

    const retryRes = await ExtractorServiceClient.retryExtraction(documentId, personId);

    return NextResponse.json({ ok: true, ...retryRes });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Retry failed." }, { status: 500 });
  }
}
