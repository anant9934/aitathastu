import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { parseOrcid, parseSemanticScholarAuthorId } from "@/lib/connectors/research-and-dev/scholar-client";
import { disconnectConnection, saveExternalConnection } from "@/lib/repositories/connection-repository";
import { syncAllFootprints } from "@/lib/sync/footprint-sync";

export const maxDuration = 30;

/**
 * Optional research identifier (Task 1.6.2). Papers are imported ONLY for an
 * ORCID iD or Semantic Scholar author ID the student enters here; there is no
 * name-based lookup. Omitting it means publication import never runs.
 */
export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kind?: string; value?: string } | null;
  const raw = String(body?.value || "");
  const kind = body?.kind === "semantic_scholar" ? "semantic_scholar" : body?.kind === "orcid" ? "orcid" : null;
  const id = kind === "orcid" ? parseOrcid(raw) : kind === "semantic_scholar" ? parseSemanticScholarAuthorId(raw) : null;
  if (!kind || !id) {
    return NextResponse.json({
      error: kind === "semantic_scholar"
        ? "That doesn't look like a Semantic Scholar author ID. It's the number at the end of your author page URL."
        : /^\s*(https?:\/\/(www\.)?orcid\.org\/)?\d{4}-?\d{4}-?\d{4}-?\d{3}[\dXx]\s*$/.test(raw)
          ? "That ORCID iD has a typo: its last character doesn't match the rest. Copy it exactly from your orcid.org profile."
          : "That isn't an ORCID iD. Copy the 16-character iD from your orcid.org profile.",
    }, { status: 400 });
  }
  await saveExternalConnection({
    personId: auth.person.id, provider: "scholar", externalUsername: id,
    profileUrl: kind === "orcid" ? `https://orcid.org/${id}` : `https://www.semanticscholar.org/author/${id}`,
    status: "detected", metadata: { idKind: kind },
  });
  const [result] = await syncAllFootprints(auth.person.id, "user", { sources: ["scholar"] });
  return NextResponse.json({ kind, id, sync: result });
}

export async function DELETE() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  await disconnectConnection(auth.person.id, "scholar");
  return NextResponse.json({ ok: true });
}
