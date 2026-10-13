import { getServerAuthContext } from "@/lib/auth/server-session";
import type { ExtractorProfileV2 } from "@/lib/services/extractor-service-client";
import { jsonNoStore, loadOwnedResumeDocument, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";

function summarize(documentId: string, profile: ExtractorProfileV2): string {
  const parts = [`AI Tathastu Resume Extraction — ${documentId}`, `Schema: ${profile.schema_version}`, `Status: ${profile.metadata?.status ?? "unknown"}`, ""];
  for (const [group, records] of Object.entries(profile.groups)) {
    if (group === "extraction_metadata") continue;
    parts.push(group.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    const kept = records.filter((r) => r.record_state !== "rejected");
    if (kept.length === 0) parts.push("  Not present in extracted document");
    for (const rec of kept) {
      for (const [key, f] of Object.entries(rec.fields)) {
        if (f.value) parts.push(`  ${key.replace(/_/g, " ")}: ${f.value} [${f.review_state}; heuristic ${f.confidence.toFixed(2)}]`);
      }
    }
    parts.push("");
  }
  return parts.join("\n");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const format = new URL(request.url).searchParams.get("format") === "summary" ? "summary" : "json";
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();

  const doc = await loadOwnedResumeDocument(documentId, auth.person.id);
  const profile = doc?.extractedProfile as ExtractorProfileV2 | null | undefined;
  if (!doc || !profile) return jsonNoStore({ ok: false, error: "No extraction available for this document." }, 404);

  const body = format === "json" ? JSON.stringify(profile, null, 2) : summarize(documentId, profile);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": format === "json" ? "application/json" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="resume-${documentId}.${format === "json" ? "json" : "txt"}"`,
      "Cache-Control": "no-store",
    },
  });
}
