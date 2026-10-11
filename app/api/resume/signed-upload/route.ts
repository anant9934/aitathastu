import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { ExtractorServiceClient } from "@/lib/services/extractor-service-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authRes = await getOrCreateOnboardingAuthContext().catch(() => null);
    if (!authRes || !authRes.auth) {
      return NextResponse.json({ ok: false, error: "Unauthorized session." }, { status: 401 });
    }
    const personId = authRes.auth.person.id;
    const documentId = crypto.randomUUID();

    // Generate short-lived (15 minutes) signed user token
    const token = ExtractorServiceClient.generateSignedUserToken({
      personId,
      role: "student",
      action: "upload",
      documentId,
      expiresInSeconds: 900,
    });

    const extractorUrl = process.env.NEXT_PUBLIC_RENDER_EXTRACTOR_URL || "http://127.0.0.1:8000";

    const response = NextResponse.json({
      ok: true,
      documentId,
      uploadUrl: `${extractorUrl}/api/resumes/upload`,
      token,
      maxUploadMb: 12,
    });

    if (authRes.sessionCookieToSet) {
      response.cookies.set(
        authRes.sessionCookieToSet.name,
        authRes.sessionCookieToSet.value,
        authRes.sessionCookieToSet.options as Parameters<typeof response.cookies.set>[2]
      );
    }

    return response;
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Could not create signed upload session." }, { status: 500 });
  }
}
