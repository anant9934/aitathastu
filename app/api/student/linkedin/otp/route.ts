import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { LinkedInPolicyError, relayLinkedInOtp } from "@/lib/services/linkedin-import-service";

/** Relays the SMS/email code LinkedIn asked for to the waiting session (Task 1.6.8). */
export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  try {
    return NextResponse.json(await relayLinkedInOtp(auth.person.id, String(body?.code || "").trim()));
  } catch (error) {
    if (error instanceof LinkedInPolicyError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
