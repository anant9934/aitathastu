import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getPerson360 } from "@/lib/services/person-360-service";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const data = await getPerson360(auth.person.id, auth.person.id);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load Person 360.";
    console.error("[Person 360 Fetch Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
