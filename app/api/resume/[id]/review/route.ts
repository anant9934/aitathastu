import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { getDb, resumeReviewHistory } from "@/lib/db";
import { ExtractorServiceClient, type ExtractorReviewParams } from "@/lib/services/extractor-service-client";

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

    const body = (await request.json()) as ExtractorReviewParams;
    if (!body || !body.group || !body.record_id || !body.action) {
      return NextResponse.json(
        { ok: false, error: "Missing required review parameters (group, record_id, action)." },
        { status: 400 }
      );
    }

    // Role check: Only verifier can trigger 'verify'
    const role: "student" | "verifier" = body.reviewer_role === "verifier" ? "verifier" : "student";
    if (body.action === "verify" && role !== "verifier") {
      return NextResponse.json(
        { ok: false, error: "Independent verification requires verifier role authorization." },
        { status: 403 }
      );
    }

    // Send review update to extractor backend
    const reviewRes = await ExtractorServiceClient.reviewField(documentId, personId, body, role);

    // Save auditable event in Neon DB
    const db = await getDb();
    const eventId = `rev_${crypto.randomUUID()}`;
    await db
      .insert(resumeReviewHistory)
      .values({
        id: eventId,
        documentId,
        personId,
        groupKey: body.group,
        recordId: body.record_id,
        fieldKey: body.field || null,
        action: body.action,
        actor: role,
        actorPersonId: personId,
        newValue: body.corrected_value || null,
        newState: body.action === "reject" ? "rejected" : body.action === "verify" ? "independently_verified" : "reviewed",
      })
      .catch((e) => console.warn("Review history log note:", e));

    return NextResponse.json({ ok: true, record: reviewRes.record });
  } catch (err: any) {
    const status = err?.message?.includes("403") ? 403 : err?.message?.includes("404") ? 404 : 500;
    return NextResponse.json({ ok: false, error: err?.message || "Review action failed." }, { status });
  }
}
