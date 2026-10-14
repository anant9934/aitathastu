import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { describeOperation, retryLatestForUser, RetryNotAllowedError } from "@/lib/sync/runners";
import { SYNC_SOURCES, type SyncSource } from "@/lib/sync/state-machine";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

export const maxDuration = 30;

/** Manual retry of a failed or dead-lettered sync (Task 1.9.4). */
export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { source?: string } | null;
  const source = body?.source;
  if (!source || !(SYNC_SOURCES as readonly string[]).includes(source)) {
    return NextResponse.json({ error: "Unknown source." }, { status: 400 });
  }
  const limit = await checkRateLimitDistributed(auth.person.id, "sync");
  if (!limit.allowed) return NextResponse.json({ error: "Too many retries. Wait a minute and try again." }, { status: 429 });
  try {
    const { operation } = await retryLatestForUser(auth.person.id, source as SyncSource);
    return NextResponse.json(describeOperation(operation));
  } catch (error) {
    if (error instanceof RetryNotAllowedError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
