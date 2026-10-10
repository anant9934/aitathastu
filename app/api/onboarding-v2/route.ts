import { NextResponse } from "next/server";
import { getServerAuthContext, getOrCreateOnboardingAuthContext } from "@/lib/auth/server-session";
import { completeOnboarding, readOnboardingDraft, writeOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { createUser, findUserByEmail, updateUserCredentials } from "@/lib/repositories/user-repository";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session";

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

  // Seamless account linking / upgrade if credentials are provided in draft
  if (body.email && typeof body.email === "string" && body.password && typeof body.password === "string" && body.password.length >= 6) {
    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      if (existing.id !== auth.user.id) {
        const valid = await verifyPassword(body.password, existing.passwordHash);
        if (valid) {
          const sess = await createSession(existing.id);
          sessionToken = sess.token;
          sessionExpires = sess.expiresAt;
          auth = {
            user: { id: existing.id, email: existing.email },
            person: { id: existing.personId || existing.id, displayName: existing.displayName || "Student" },
            session: { id: sess.sessionId, token: sess.token, expiresAt: sess.expiresAt },
          };
        }
      }
    } else {
      if (auth.user.email.endsWith("@onboarding.aitathastu.internal")) {
        const passwordHash = await hashPassword(body.password);
        await updateUserCredentials(auth.user.id, {
          email: normalizedEmail,
          passwordHash,
          displayName: body.name || "Student",
        });
        auth.user.email = normalizedEmail;
      } else {
        const passwordHash = await hashPassword(body.password);
        const created = await createUser({
          email: normalizedEmail,
          passwordHash,
          displayName: body.name || "Student",
        });
        const sess = await createSession(created.userId);
        sessionToken = sess.token;
        sessionExpires = sess.expiresAt;
        auth = {
          user: { id: created.userId, email: created.email },
          person: { id: created.personId, displayName: created.displayName },
          session: { id: sess.sessionId, token: sess.token, expiresAt: sess.expiresAt },
        };
      }
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

  // Auto-login / Auto-upgrade during final onboarding launch if email & password are provided
  if (body.email && typeof body.email === "string" && body.password && typeof body.password === "string" && body.password.length >= 6) {
    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      if (existing.id !== auth.user.id) {
        const valid = await verifyPassword(body.password, existing.passwordHash);
        if (valid) {
          const sess = await createSession(existing.id);
          sessionToken = sess.token;
          sessionExpires = sess.expiresAt;
          auth = {
            user: { id: existing.id, email: existing.email },
            person: { id: existing.personId || existing.id, displayName: existing.displayName || "Student" },
            session: { id: sess.sessionId, token: sess.token, expiresAt: sess.expiresAt },
          };
        }
      }
    } else {
      if (auth.user.email.endsWith("@onboarding.aitathastu.internal")) {
        const passwordHash = await hashPassword(body.password);
        await updateUserCredentials(auth.user.id, {
          email: normalizedEmail,
          passwordHash,
          displayName: body.name || "Student",
        });
        auth.user.email = normalizedEmail;
      } else {
        const passwordHash = await hashPassword(body.password);
        const created = await createUser({
          email: normalizedEmail,
          passwordHash,
          displayName: body.name || "Student",
        });
        const sess = await createSession(created.userId);
        sessionToken = sess.token;
        sessionExpires = sess.expiresAt;
        auth = {
          user: { id: created.userId, email: created.email },
          person: { id: created.personId, displayName: created.displayName },
          session: { id: sess.sessionId, token: sess.token, expiresAt: sess.expiresAt },
        };
      }
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
