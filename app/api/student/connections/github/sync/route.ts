import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { syncGitHubConnection } from "@/lib/services/github-sync-service";

export const maxDuration = 30;

/**
 * "Sync Now". An `Idempotency-Key` header (any client-generated id) makes a
 * retried or double-clicked request return the same sync operation instead
 * of starting another one; without it, identical requests within 60 s collapse.
 */
async function POST_handler(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const requestId = req.headers.get("idempotency-key")?.trim().slice(0, 120) || undefined;
    const result = await syncGitHubConnection(auth.person.id, undefined, { trigger: "user", requestId });
    const body = {
      success: result.success,
      operationId: result.operationId,
      state: result.state,
      deduplicated: result.deduplicated,
      correlationId: result.correlationId,
      syncRunId: result.syncRunId,
      recordsFetched: result.recordsFetched,
      recordsChanged: result.recordsChanged,
      failedRepos: result.failedRepos,
      error: result.error,
    };
    // dead_letter / failed are reported, not thrown: the UI shows why and offers a retry.
    return NextResponse.json(body, { status: result.success ? 200 : result.operationId ? 200 : 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
