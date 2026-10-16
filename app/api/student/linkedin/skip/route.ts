import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { skipLinkedIn } from "@/lib/services/linkedin-import-service";

/** "Skip / I'll do this later" or Cancel in the code modal. Free: no score or step depends on LinkedIn. */
async function POST_handler() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  return NextResponse.json(await skipLinkedIn(auth.person.id));
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
