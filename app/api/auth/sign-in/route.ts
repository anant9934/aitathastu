import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/repositories/user-repository";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Rate Limiting (auth tier: 10 req/min)
    const ip = req.headers.get("x-forwarded-for") || "client";
    const rl = checkRateLimit(email || ip, "auth");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
      );
    }

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Please enter both email and password." }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password. Please check your credentials." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password. Please check your credentials." },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      person: {
        id: user.personId || "",
        displayName: user.displayName || "Student",
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An error occurred while signing in.";
    console.error("[Sign-in Error]", message);
    return NextResponse.json(
      { error: "An error occurred while signing in. Please try again." },
      { status: 500 }
    );
  }
}
