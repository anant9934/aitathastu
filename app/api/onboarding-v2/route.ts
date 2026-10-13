import { NextResponse } from "next/server";
import {
  applySessionCookie,
  getOrCreateGuestSession,
  getServerAuthContext,
  isGuestEmail,
} from "@/lib/auth/server-session";
import type { AuthContext } from "@/lib/auth/session";
import { completeOnboarding, readOnboardingDraft, writeOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { findUserByEmail, updateUserCredentials } from "@/lib/repositories/user-repository";
import { updatePersonProfileData } from "@/lib/repositories/person-repository";
import { hashPassword } from "@/lib/auth/password";

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ authenticated: false, draft: null });
  return NextResponse.json({ authenticated: true, draft: await readOnboardingDraft(auth.person.id) });
}

/**
 * If the body carries an email + password and the session is a guest, upgrade
 * the guest in place, so the CV snapshots, jobs and draft it already owns keep
 * the same owner. Returns an error response when the email belongs to someone
 * else, otherwise null.
 */
async function upgradeGuestCredentials(auth: AuthContext, body: Record<string, unknown>): Promise<NextResponse | null> {
  const { email, password, name } = body;
  if (typeof email !== "string" || !email || typeof password !== "string" || password.length < 6) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing && existing.id !== auth.user.id) {
    return NextResponse.json({ error: "This email already has an account. Please sign in first." }, { status: 409 });
  }
  if (!existing && isGuestEmail(auth.user.email)) {
    const displayName = typeof name === "string" ? name.trim() : "";
    await updateUserCredentials(auth.user.id, { email: normalizedEmail, passwordHash: await hashPassword(password), displayName });
    if (displayName) await updatePersonProfileData(auth.person.id, { displayName });
    auth.user.email = normalizedEmail;
  } else if (!existing && auth.user.email !== normalizedEmail) {
    return NextResponse.json({ error: "Sign out before creating a different account." }, { status: 409 });
  }
  return null;
}

/**
 * Draft write. This is the ONLY route that may create a guest session (see
 * lib/auth/server-session.ts), so a first-time visitor's progress has an owner.
 */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const session = await getOrCreateGuestSession(request);
  if (!session.ok) {
    return NextResponse.json(
      { error: "Too many new sessions from this network. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(session.retryAfterSeconds) } }
    );
  }

  const conflict = await upgradeGuestCredentials(session.auth, body);
  if (conflict) return applySessionCookie(conflict, session.sessionCookieToSet);

  try {
    const draft = await writeOnboardingDraft(session.auth.person.id, body);
    return applySessionCookie(NextResponse.json({ draft }), session.sessionCookieToSet);
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't save your progress. Please try again.";
    return applySessionCookie(
      NextResponse.json({ error: message }, { status: /role|purpose|choose/i.test(message) ? 400 : 500 }),
      session.sessionCookieToSet
    );
  }
}

/** Final onboarding save. Requires the session established by earlier draft writes. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Your onboarding session has expired. Refresh the page to continue." }, { status: 401 });
  }

  const conflict = await upgradeGuestCredentials(auth, body);
  if (conflict) return conflict;

  try {
    const result = await completeOnboarding(auth.person.id, body);
    return NextResponse.json({ success: true, draft: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We couldn't finish setup. Please try again." },
      { status: 400 }
    );
  }
}
