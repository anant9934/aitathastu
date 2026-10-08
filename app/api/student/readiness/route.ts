import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getActiveGoal } from "@/lib/repositories/goal-repository";
import { getEvidenceByPersonId } from "@/lib/repositories/evidence-repository";
import { calculateReadiness, type EvidenceItem } from "@/lib/domain";

/**
 * GET /api/student/readiness
 * Computes on-demand defensible readiness for the student's active goal.
 * Never fabricates numbers; enforces publication gate.
 */
export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const activeGoal = await getActiveGoal(auth.person.id);
    const evidenceRecords = await getEvidenceByPersonId(auth.person.id);

    const evidenceItems: EvidenceItem[] = evidenceRecords.map((r) => ({
      id: r.id,
      category: r.category,
      subject: r.subject,
      value: r.value,
      source: r.source,
      verificationStatus: r.verificationStatus,
      observedAt: r.observedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      interpretation: r.interpretation,
      whyItMatters: r.whyItMatters,
      sourceReference: r.sourceReference,
      verifiedByPersonId: r.verifiedByPersonId,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      verificationMethod: r.verificationMethod,
      verificationDecisionId: r.verificationDecisionId,
    }));

    const readiness = calculateReadiness(
      activeGoal || { title: "Custom Goal" },
      evidenceItems
    );

    return NextResponse.json({ readiness });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to compute readiness.";
    console.error("[Readiness Computation Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
