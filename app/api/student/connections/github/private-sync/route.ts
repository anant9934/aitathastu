import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { syncGitHubAppInstallation } from "@/lib/services/github-app-sync-service";
import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";

export const maxDuration = 30;

async function POST_handler() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });

  const result = await syncGitHubAppInstallation(auth.person.id);
  return NextResponse.json(result, { status: result.success ? 200 : result.error ? 400 : 207 });
}

export const POST = withStudentCacheInvalidation(POST_handler);
