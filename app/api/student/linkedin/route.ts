import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { advanceLinkedIn, connectLinkedIn, disconnectLinkedIn, LinkedInPolicyError } from "@/lib/services/linkedin-import-service";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

export const maxDuration = 30;

/** Optional LinkedIn connection (Task 1.6.1). Nothing depends on it; see /skip. */
async function POST_handler(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const limit = await checkRateLimitDistributed(auth.person.id, "sync");
  if (!limit.allowed) return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string; consent?: boolean; profileUrl?: string } | null;
  if (body?.password) {
    return NextResponse.json({
      error: "Automated password sign-in is disabled in compliance with LinkedIn terms and security policy. Please link your profile URL or upload your student-authorized data export archive.",
      compliantOptions: ["profile_url", "data_export_archive", "oauth"],
    }, { status: 400 });
  }
  if (body?.consent !== true) return NextResponse.json({ error: "Please confirm your consent to link your LinkedIn profile." }, { status: 400 });
  if (!body.email && !body.profileUrl) return NextResponse.json({ error: "Enter your LinkedIn profile URL or email." }, { status: 400 });
  try {
    const requestId = req.headers.get("idempotency-key")?.trim().slice(0, 120) || undefined;
    return NextResponse.json(await connectLinkedIn(auth.person.id, body.email || body.profileUrl || "", undefined, requestId));
  } catch (error) {
    if (error instanceof LinkedInPolicyError) return NextResponse.json({ error: error.message, retryAt: error.retryAt?.toISOString() }, { status: 409 });
    throw error;
  }
}

/** Poll while the import runs; returns challengeSecondsLeft when a code is needed. */
export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  return NextResponse.json(await advanceLinkedIn(auth.person.id), { headers: { "Cache-Control": "no-store" } });
}

/** Disconnect: erases the stored password and session data (Task 1.6.7). */
async function DELETE_handler() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  await disconnectLinkedIn(auth.person.id);
  return NextResponse.json({ ok: true });
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
export const DELETE = withStudentCacheInvalidation(DELETE_handler);
