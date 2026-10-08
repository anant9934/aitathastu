import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import {
  resubmitEvidenceVerification,
  VerificationError,
} from "@/lib/services/verification-service";

/**
 * POST /api/verification/resubmit
 * Student resubmits a verification request after changes were requested.
 */
export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, supportingReference, studentNotes } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    const updatedRequest = await resubmitEvidenceVerification({
      requesterPersonId: auth.person.id,
      requestId,
      supportingReference,
      studentNotes,
    });

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      message: "Verification request successfully resubmitted with updated details.",
    });
  } catch (err: unknown) {
    if (err instanceof VerificationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Failed to resubmit verification request.";
    console.error("[Verification Resubmit Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
