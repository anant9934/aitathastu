import { getServerAuthContext } from "@/lib/auth/server-session";
import { resolveExtractorIdentity } from "@/lib/auth/extractor-identity";
import { ExtractorServiceClient, type ExtractorProfileV2 } from "@/lib/services/extractor-service-client";
import { EoraResumeAdvisor } from "@/lib/services/eora-resume-advisor";
import { ObjectStorageService } from "@/lib/storage/object-storage";
import { docMeta, jsonNoStore, loadOwnedResumeDocument, unauthorized } from "@/lib/api/resume-route-helpers";

export const runtime = "nodejs";

// resume_documents is the source of truth for every document. The Python
// extractor only ever sees scanned PDFs, as a worker, so it is not consulted here.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();

  try {
    const doc = await loadOwnedResumeDocument(documentId, auth.person.id);
    if (!doc) return jsonNoStore({ ok: false, error: "Document not found." }, 404);
    const profile = doc.extractedProfile as ExtractorProfileV2 | null;
    return jsonNoStore({
      ok: true,
      documentId,
      profile,
      status: { document_id: documentId, status: doc.status, warnings: doc.warnings || [] },
      eoraGuidance: profile ? EoraResumeAdvisor.analyzeProfile(profile) : null,
    });
  } catch (err) {
    console.error("[resume-get] failed", { documentId, error: err instanceof Error ? err.message : err });
    return jsonNoStore({ ok: false, error: "Failed to fetch document." }, 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const auth = await getServerAuthContext();
  if (!auth) return unauthorized();
  const personId = auth.person.id;

  try {
    const doc = await loadOwnedResumeDocument(documentId, personId);
    if (!doc) return jsonNoStore({ ok: false, error: "Document not found." }, 404);
    await ObjectStorageService.deleteDocument(documentId, personId);

    const extractorDocumentId = docMeta(doc).extractorDocumentId;
    if (typeof extractorDocumentId === "string" && ExtractorServiceClient.isConfigured()) {
      try {
        await ExtractorServiceClient.deleteDocument(extractorDocumentId, await resolveExtractorIdentity(personId));
      } catch (err) {
        // The extractor also expires files after its retention window.
        console.warn("[resume-delete] extractor copy not deleted", { documentId, error: err instanceof Error ? err.message : err });
      }
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[resume-delete] failed", { documentId, error: err instanceof Error ? err.message : err });
    return jsonNoStore({ ok: false, error: "Failed to delete document." }, 500);
  }
}
