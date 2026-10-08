import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { syncGitHubConnection } from "@/lib/services/github-sync-service";

export async function POST() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const result = await syncGitHubConnection(auth.person.id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "GitHub synchronization failed.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      syncRunId: result.syncRunId,
      recordsFetched: result.recordsFetched,
      recordsChanged: result.recordsChanged,
      projectsCount: result.projects.length,
      projects: result.projects,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
