import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { buildPersonGraph } from "@/lib/domain/person-graph";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const graph = await buildPersonGraph(auth.person.id);
    return NextResponse.json(graph);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error building Person Graph.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
