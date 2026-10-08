import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session";
import { createUser, findUserByEmail } from "@/lib/repositories/user-repository";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getFeatureFlags, isValidPilotInviteCode } from "@/lib/config/feature-flags";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, displayName, name, inviteCode } = body;

    // Rate Limiting (auth tier: 10 req/min)
    const ip = req.headers.get("x-forwarded-for") || "client";
    const rl = checkRateLimit(email || ip, "auth");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
      );
    }

    // Pilot Mode Invite Code Gate
    const flags = getFeatureFlags();
    if (flags.inviteCodeRequired && !isValidPilotInviteCode(inviteCode)) {
      return NextResponse.json(
        { error: "A valid pilot invitation code is required to register during the pilot phase." },
        { status: 403 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const trimmedName =
      (typeof displayName === "string" && displayName.trim()) ||
      (typeof name === "string" && name.trim()) ||
      "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const created = await createUser({
      email,
      passwordHash,
      displayName: trimmedName,
    });

    const { token, expiresAt } = await createSession(created.userId);

    const response = NextResponse.json({
      success: true,
      user: {
        id: created.userId,
        email: created.email,
      },
      person: {
        id: created.personId,
        displayName: created.displayName,
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
    const message = err instanceof Error ? err.message : "An error occurred while creating your account.";
    console.error("[Sign-up Error]", message);
    return NextResponse.json(
      { error: "An error occurred while creating your account. Please try again." },
      { status: 500 }
    );
  }
}
