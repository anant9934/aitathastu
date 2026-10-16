import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getSyncStatus } from "@/lib/sync/runners";

/** Per-source sync state + aggregate (Tasks 1.9.3, 1.9.4). Reads the DB only; never syncs. */
export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  return NextResponse.json(await getSyncStatus(auth.person.id), { headers: { "Cache-Control": "no-store" } });
}
