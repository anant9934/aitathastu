import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { importLocalProgress } from "@/lib/services/import-service";

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const result = await importLocalProgress(auth.person.id, auth.person.id, body);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import local progress.";
    console.error("[Local Progress Import Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
