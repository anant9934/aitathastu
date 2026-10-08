import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import {
  reviewVerificationRequest,
  VerificationError,
} from "@/lib/services/verification-service";

/**
 * POST /api/verification/decisions
 * Authorized verifier records a decision on a verification request.
 * Verifier identity is strictly extracted from the active session.
 */
export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, decision, reason, method } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    if (!decision || !["verified", "rejected", "changes_requested"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be one of 'verified', 'rejected', or 'changes_requested'." },
        { status: 400 }
      );
    }

    // Call service with verifierPersonId strictly derived from session
    const result = await reviewVerificationRequest({
      verifierPersonId: auth.person.id,
      requestId,
      decision,
      reason,
      method,
    });

    return NextResponse.json({
      success: true,
      decision: result.decision,
      updatedRequest: result.updatedRequest,
      message: `Verification decision recorded: ${decision}.`,
    });
  } catch (err: unknown) {
    if (err instanceof VerificationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Failed to record verification decision.";
    console.error("[Verification Decision Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
