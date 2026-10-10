import crypto from "crypto";
import { cookies } from "next/headers";
import {
  validateSession,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  type AuthContext,
} from "./session";
import { createUser } from "../repositories/user-repository";
import { hashPassword } from "./password";

export async function getServerAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  return validateSession(sessionCookie.value);
}

export type OnboardingSessionResult = {
  auth: AuthContext;
  sessionCookieToSet?: {
    name: string;
    value: string;
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      expires: Date;
      maxAge: number;
    };
  };
};

export async function getOrCreateOnboardingAuthContext(): Promise<OnboardingSessionResult> {
  const existing = await getServerAuthContext();
  if (existing) {
    return { auth: existing };
  }

  const guestId = crypto.randomBytes(6).toString("hex");
  const guestEmail = `guest_${Date.now()}_${guestId}@onboarding.aitathastu.internal`;
  const randomPass = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(randomPass);

  const created = await createUser({
    email: guestEmail,
    passwordHash,
    displayName: "Student",
  });

  const { token, expiresAt, sessionId } = await createSession(created.userId);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  };

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions);
  } catch {
    // If running in a read-only cookies context, the caller will attach sessionCookieToSet to NextResponse
  }

  return {
    auth: {
      user: { id: created.userId, email: created.email },
      person: { id: created.personId, displayName: created.displayName },
      session: { id: sessionId, token, expiresAt },
    },
    sessionCookieToSet: {
      name: SESSION_COOKIE_NAME,
      value: token,
      options: cookieOptions,
    },
  };
}

