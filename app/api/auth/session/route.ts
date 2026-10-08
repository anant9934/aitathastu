import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: auth.user,
      person: auth.person,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database unavailable.";
    console.error("[Session Check Error]", message);
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}
