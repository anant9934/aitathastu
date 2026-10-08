import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { createAppHandoffToken, verifyAppHandoffToken } from "@/lib/domain/handoff";

/**
 * POST /api/student/handoff
 * Generates a signed, short-lived AppHandoffToken for transferring session context
 * to Study LPU, Padho Code, ERIS, or MentorMaze.
 * Strictly strips PII (no email, phone, name) and exposes only opaque reference.
 */
export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { targetApp, targetActivity, goalContext, returnUrl } = body;

    const allowedApps = ["study_lpu", "padho_code", "eris", "mentormaze"];
    if (!targetApp || !allowedApps.includes(targetApp)) {
      return NextResponse.json(
        { error: `Invalid targetApp. Must be one of: ${allowedApps.join(", ")}` },
        { status: 400 }
      );
    }

    const { token, payload, handoffUrl } = createAppHandoffToken({
      personId: auth.person.id,
      targetApp,
      targetActivity,
      goalContext,
      returnUrl,
    });

    return NextResponse.json({
      success: true,
      token,
      handoffUrl,
      targetApp: payload.targetApp,
      expiresAt: payload.expiresAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error generating handoff token.";
    console.error("[Handoff API Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/student/handoff?token=...
 * Verifies an incoming handoff token (for returning to Tathastu or partner validation).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token parameter." }, { status: 400 });
    }

    const verification = verifyAppHandoffToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json({ valid: false, error: verification.error || "Invalid token." }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      payload: verification.payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error verifying handoff token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
