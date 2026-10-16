import { after, NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { withStudentCacheInvalidation, invalidateStudentCache } from "@/lib/cache/response-cache";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import {
  assertSyncable, ConnectionManagerError, disconnectManaged, listManagedConnections, runManagedSync, updateHandle,
} from "@/lib/services/connection-manager-service";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

/** The connections page's source list (Task 2.2.5). Polled while a sync runs. */
export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  return NextResponse.json({ connections: await listManagedConnections(auth.person.id) }, { headers: { "cache-control": "no-store" } });
}

/**
 * { action: "sync" | "update_handle" | "disconnect", source, handle? }.
 * Sync returns 202 at once and keeps running on the server; the page polls GET.
 */
async function POST_handler(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const personId = auth.person.id;
  const body = (await req.json().catch(() => null)) as { action?: string; source?: string; handle?: string } | null;
  try {
    switch (body?.action) {
      case "sync": {
        const source = await assertSyncable(personId, body.source);
        const limit = await checkRateLimitDistributed(personId, "sync");
        if (!limit.allowed) return NextResponse.json({ error: "Too many syncs. Wait a minute and try again." }, { status: 429 });
        after(async () => {
          try { await runManagedSync(personId, source); }
          catch (error) { logger.warn(`connections.sync_failed.${source}`, { error: error instanceof Error ? error.message : String(error) }); }
          finally { await invalidateStudentCache(personId); }
        });
        return NextResponse.json({ accepted: true, source }, { status: 202 });
      }
      case "update_handle":
        return NextResponse.json(await updateHandle(personId, body.source, body.handle));
      case "disconnect":
        return NextResponse.json(await disconnectManaged(personId, body.source));
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof ConnectionManagerError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export const POST = withStudentCacheInvalidation(POST_handler);
