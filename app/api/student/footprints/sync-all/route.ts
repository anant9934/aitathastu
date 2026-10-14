import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { syncAllFootprints } from "@/lib/sync/footprint-sync";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

export const maxDuration = 60;

/** "Sync Now" for every connected footprint source; each runs independently (Task 1.6.6). */
export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const limit = await checkRateLimitDistributed(auth.person.id, "sync");
  if (!limit.allowed) return NextResponse.json({ error: "Too many syncs. Wait a minute and try again." }, { status: 429 });
  const requestId = req.headers.get("idempotency-key")?.trim().slice(0, 120) || undefined;
  return NextResponse.json({ sources: await syncAllFootprints(auth.person.id, "user", { requestId }) });
}
