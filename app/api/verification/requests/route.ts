import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { can } from "@/lib/auth/rbac";
import {
  submitEvidenceForVerification,
  getVerifierQueue,
  VerificationError,
} from "@/lib/services/verification-service";

/**
 * GET /api/verification/requests
 * Returns verification queue for authorized verifiers.
 * Strictly checks `student.verify_skill` capability.
 */
export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const hasVerifyCap = await can(auth.person.id, "student.verify_skill");
    if (!hasVerifyCap) {
      return NextResponse.json(
        { error: "Forbidden: You lack the 'student.verify_skill' capability." },
        { status: 403 }
      );
    }

    const queue = await getVerifierQueue(auth.person.id);
    return NextResponse.json({ queue });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load verification queue.";
    console.error("[Verification Queue Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/verification/requests
 * Student submits evidence for verification.
 */
export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const { evidenceId, supportingReference, studentNotes } = body;

    if (!evidenceId || typeof evidenceId !== "string") {
      return NextResponse.json({ error: "evidenceId is required." }, { status: 400 });
    }

    const requestRecord = await submitEvidenceForVerification(auth.person.id, evidenceId, {
      supportingReference,
      studentNotes,
    });

    return NextResponse.json({
      success: true,
      request: requestRecord,
      message: "Evidence successfully submitted for verification.",
    });
  } catch (err: unknown) {
    if (err instanceof VerificationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Failed to submit verification request.";
    console.error("[Verification Submit Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
