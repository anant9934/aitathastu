/**
 * POST /api/resume/[id]/review   — student review of one field or record
 *
 * Role is never taken from the request. This route only loads documents the
 * caller owns, so `verify` here would always be self-verification and is
 * refused for everyone. Independent verification goes through the faculty
 * verification queue, where verifier rights are checked against the DB.
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getDb, resumeDocuments, resumeReviewHistory } from "@/lib/db";
import type { ExtractorProfileV2, ExtractorReviewParams } from "@/lib/services/extractor-service-client";
import { jsonNoStore, loadOwnedResumeDocument, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";

const NEW_STATE = {
  accept: "reviewed",
  correct: "reviewed",
  reject: "rejected",
  uncertain: "uncertain",
  confirm: "student_confirmed",
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  const body = (await request.json().catch(() => null)) as ExtractorReviewParams | null;
  if (!body || !body.group || !body.record_id || !body.action) {
    return jsonNoStore({ ok: false, error: "Missing required review parameters (group, record_id, action)." }, 400);
  }
  if (body.action === "verify") {
    return jsonNoStore({ ok: false, error: "You cannot verify your own resume. Request independent verification from your faculty instead." }, 403);
  }
  if (!(body.action in NEW_STATE)) return jsonNoStore({ ok: false, error: "Unsupported review action." }, 400);

  const doc = await loadOwnedResumeDocument(documentId, personId);
  const profile = doc?.extractedProfile as ExtractorProfileV2 | null | undefined;
  if (!doc || !profile) return jsonNoStore({ ok: false, error: "Document not found." }, 404);

  const record = profile.groups[body.group]?.find((r) => r.record_id === body.record_id);
  if (!record) return jsonNoStore({ ok: false, error: "Record not found." }, 404);

  let previousValue: string | null = null;
  let previousState: string | null = record.record_state;
  const newState = NEW_STATE[body.action as keyof typeof NEW_STATE];

  if (!body.field) {
    if (body.action !== "reject") return jsonNoStore({ ok: false, error: "Record-level review supports reject only." }, 400);
    record.record_state = "rejected";
  } else {
    const item = record.fields[body.field];
    if (!item) return jsonNoStore({ ok: false, error: "Field not found." }, 404);
    if (item.review_state === "independently_verified") {
      return jsonNoStore({ ok: false, error: "Verified fields can only be changed by a verifier." }, 403);
    }
    if (body.action === "correct" && !body.corrected_value?.trim()) {
      return jsonNoStore({ ok: false, error: "A corrected value is required." }, 400);
    }
    previousValue = item.value;
    previousState = item.review_state;
    item.history.push({
      action: body.action,
      actor: "student",
      timestamp: new Date().toISOString(),
      previous_value: item.value,
      new_value: body.action === "correct" ? body.corrected_value!.trim() : null,
      previous_state: item.review_state,
    });
    if (body.action === "correct") item.value = body.corrected_value!.trim();
    item.review_state = newState;
  }

  const db = await getDb();
  await db
    .update(resumeDocuments)
    .set({ extractedProfile: profile, updatedAt: new Date() })
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
  await db.insert(resumeReviewHistory).values({
    id: `rev_${crypto.randomUUID()}`,
    documentId,
    personId,
    groupKey: body.group,
    recordId: body.record_id,
    fieldKey: body.field || null,
    action: body.action,
    actor: "student",
    actorPersonId: personId,
    previousValue,
    newValue: body.corrected_value || null,
    previousState,
    newState,
  });

  return jsonNoStore({ ok: true, record });
}
