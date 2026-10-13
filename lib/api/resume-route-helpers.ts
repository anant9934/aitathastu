import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, resumeDocuments } from "@/lib/db";

export function jsonNoStore(body: Record<string, unknown>, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers },
  });
}

export function unauthorized() {
  return jsonNoStore({ ok: false, code: "UNAUTHORIZED", error: "Sign in or start onboarding first." }, 401);
}

export type ResumeDocumentRow = typeof resumeDocuments.$inferSelect;

/** Loads a resume document only if `personId` owns it. Every read is (id, personId)-scoped. */
export async function loadOwnedResumeDocument(documentId: string, personId: string): Promise<ResumeDocumentRow | null> {
  const db = await getDb();
  const [doc] = await db
    .select()
    .from(resumeDocuments)
    .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)))
    .limit(1);
  return doc && doc.status !== "deleted" ? doc : null;
}

export function docMeta(doc: ResumeDocumentRow): Record<string, unknown> {
  return (doc.metadata ?? {}) as Record<string, unknown>;
}
