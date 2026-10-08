import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getProjectCandidatesForPerson } from "@/lib/acquisition/acquisition-service";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const candidates = await getProjectCandidatesForPerson(auth.person.id);
    return NextResponse.json({
      candidatesCount: candidates.length,
      candidates,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading project candidates.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
