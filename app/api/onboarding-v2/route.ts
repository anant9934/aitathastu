import { NextResponse } from "next/server";
import { getServerAuthContext, getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { completeOnboarding, readOnboardingDraft, writeOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { findUserByEmail, updateUserCredentials } from "@/lib/repositories/user-repository";
import { updatePersonProfileData } from "@/lib/repositories/person-repository";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session";

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ authenticated: false, draft: null });
  return NextResponse.json({ authenticated: true, draft: await readOnboardingDraft(auth.person.id) });
}

export async function PUT(request: Request) {
  const body = await request.json();
  let auth = await getServerAuthContext();
  let sessionToken: string | null = null;
  let sessionExpires: Date | null = null;

  // Ensure an auth context exists for the onboarding visitor
  if (!auth) {
    const guestCtx = await getOrCreateOnboardingAuthContext();
    auth = guestCtx.auth;
    if (guestCtx.sessionCookieToSet) {
      sessionToken = guestCtx.sessionCookieToSet.value;
      sessionExpires = guestCtx.sessionCookieToSet.options.expires as Date;
    }
  }

  // Upgrade the current guest in place so resume snapshots and review claims keep the same owner.
  if (body.email && typeof body.email === "string" && body.password && typeof body.password === "string" && body.password.length >= 6) {
    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json({ error: "This email already has an account. Please sign in first." }, { status: 409 });
    }
    if (!existing && auth.user.email.endsWith("@onboarding.aitathastu.internal")) {
      const passwordHash = await hashPassword(body.password);
      await updateUserCredentials(auth.user.id, {
        email: normalizedEmail,
        passwordHash,
        displayName: typeof body.name === "string" ? body.name.trim() : "",
      });
      if (typeof body.name === "string" && body.name.trim()) {
        await updatePersonProfileData(auth.person.id, { displayName: body.name.trim() });
      }
      auth.user.email = normalizedEmail;
    } else if (!existing && auth.user.email !== normalizedEmail) {
      return NextResponse.json({ error: "Sign out before creating a different account." }, { status: 409 });
    }
  }

  try {
    const draft = await writeOnboardingDraft(auth.person.id, body);
    const response = NextResponse.json({ draft });
    if (sessionToken && sessionExpires) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: sessionExpires,
        maxAge: Math.floor(SESSION_DURATION_MS / 1000),
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "We couldn't save your progress. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  let auth = await getServerAuthContext();
  let sessionToken: string | null = null;
  let sessionExpires: Date | null = null;

  // Ensure an auth context exists
  if (!auth) {
    const guestCtx = await getOrCreateOnboardingAuthContext();
    auth = guestCtx.auth;
    if (guestCtx.sessionCookieToSet) {
      sessionToken = guestCtx.sessionCookieToSet.value;
      sessionExpires = guestCtx.sessionCookieToSet.options.expires as Date;
    }
  }

  // Final save must never silently switch owners or create a second person.
  if (body.email && typeof body.email === "string" && body.password && typeof body.password === "string" && body.password.length >= 6) {
    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json({ error: "This email already has an account. Please sign in first." }, { status: 409 });
    }
    if (!existing && auth.user.email.endsWith("@onboarding.aitathastu.internal")) {
      const passwordHash = await hashPassword(body.password);
      await updateUserCredentials(auth.user.id, {
        email: normalizedEmail,
        passwordHash,
        displayName: typeof body.name === "string" ? body.name.trim() : "",
      });
      auth.user.email = normalizedEmail;
    } else if (!existing && auth.user.email !== normalizedEmail) {
      return NextResponse.json({ error: "Sign out before creating a different account." }, { status: 409 });
    }
  }

  try {
    const result = await completeOnboarding(auth.person.id, body);
    const response = NextResponse.json({ success: true, draft: result });
    if (sessionToken && sessionExpires) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: sessionExpires,
        maxAge: Math.floor(SESSION_DURATION_MS / 1000),
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We couldn't finish setup. Please try again." },
      { status: 400 }
    );
  }
}
