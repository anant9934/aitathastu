import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { skipLinkedIn } from "@/lib/services/linkedin-import-service";

/** "Skip / I'll do this later" or Cancel in the code modal. Free: no score or step depends on LinkedIn. */
export async function POST() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  return NextResponse.json(await skipLinkedIn(auth.person.id));
}
