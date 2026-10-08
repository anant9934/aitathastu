import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { completeOnboarding, readOnboardingDraft, writeOnboardingDraft } from "@/lib/services/onboarding-v2-service";
import { createUser, findUserByEmail } from "@/lib/repositories/user-repository";
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

  // Seamless auto-auth if credentials are provided in draft
  if (!auth && body.email && typeof body.email === "string" && body.password && typeof body.password === "string") {
    const existing = await findUserByEmail(body.email);
    if (existing) {
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
    } else if (body.password.length >= 6) {
      const passwordHash = await hashPassword(body.password);
      const created = await createUser({
        email: body.email,
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

  if (!auth) {
    return NextResponse.json({ error: "Sign in to save your journey across devices." }, { status: 401 });
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

  // Auto-login / Auto-signup during final onboarding launch if email & password are provided
  if (!auth && body.email && typeof body.email === "string" && body.password && typeof body.password === "string") {
    const existing = await findUserByEmail(body.email);
    if (existing) {
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
    } else if (body.password.length >= 6) {
      const passwordHash = await hashPassword(body.password);
      const created = await createUser({
        email: body.email,
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

  if (!auth) {
    const fallbackEmail =
      body.email && typeof body.email === "string" && body.email.includes("@")
        ? body.email.trim()
        : `student_${Date.now()}_${Math.floor(Math.random() * 1000)}@aitathastu.internal`;
    const fallbackPassword =
      body.password && typeof body.password === "string" && body.password.length >= 6
        ? body.password
        : `Tathastu@${Math.floor(100000 + Math.random() * 900000)}`;

    const existingUser = await findUserByEmail(fallbackEmail);
    let userId: string;
    let personId: string;
    let displayName: string;

    if (existingUser) {
      userId = existingUser.id;
      personId = existingUser.personId || existingUser.id;
      displayName = existingUser.displayName || (body.name as string) || "Student";
    } else {
      const passwordHash = await hashPassword(fallbackPassword);
      const created = await createUser({
        email: fallbackEmail,
        passwordHash,
        displayName: (body.name as string) || "Student",
      });
      userId = created.userId;
      personId = created.personId;
      displayName = created.displayName;
    }

    const sess = await createSession(userId);
    sessionToken = sess.token;
    sessionExpires = sess.expiresAt;
    auth = {
      user: { id: userId, email: fallbackEmail },
      person: { id: personId, displayName },
      session: { id: sess.sessionId, token: sess.token, expiresAt: sess.expiresAt },
    };
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
