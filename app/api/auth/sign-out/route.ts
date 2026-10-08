import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { invalidateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await invalidateSession(token);
    }

    const response = NextResponse.json({ success: true, message: "Signed out successfully." });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sign out.";
    console.error("[Sign-out Error]", message);
    return NextResponse.json({ error: "Failed to sign out." }, { status: 500 });
  }
}
