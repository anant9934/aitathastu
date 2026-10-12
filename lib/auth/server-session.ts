/**
 * Server-side session helpers.
 *
 * Auth model: opaque session tokens in the `sessions` table, carried in the
 * httpOnly `tathastu_session` cookie (see ./session.ts). Visitors who start
 * onboarding without an account get a *guest* user + person so their draft,
 * CV and imports have an owner. Guests are ordinary users whose email is on
 * the internal GUEST_EMAIL_DOMAIN; they are upgraded in place when the visitor
 * sets an email/password, merged into an existing account on sign-in
 * (lib/auth/guest-merge.ts), and purged by scripts/purge-stale-guests.ts if
 * abandoned.
 *
 * Guest creation is deliberately restricted to ONE entry point, the first
 * onboarding draft write (PUT /api/onboarding-v2), and is rate limited per
 * client IP. Every other route, especially read-only GET/status/export
 * routes, requires an existing session and answers 401 otherwise. Minting a
 * guest from any route let a cookieless client create unlimited accounts,
 * and since rate limits were keyed on the freshly minted person, they never
 * applied.
 */

import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  validateSession,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  type AuthContext,
} from "./session";
import { createUser } from "../repositories/user-repository";
import { hashPassword } from "./password";
import { checkRateLimitDistributed } from "../security/rate-limit";
import { getClientIp } from "../security/client-ip";

export const GUEST_EMAIL_DOMAIN = "onboarding.aitathastu.internal";

export function isGuestEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

export async function getServerAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  return validateSession(sessionCookie.value);
}

export type SessionCookie = {
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

export function sessionCookieFor(token: string, expiresAt: Date): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    },
  };
}

/** Attaches a newly issued session cookie to a response, if there is one. */
export function applySessionCookie<T extends NextResponse>(response: T, cookie: SessionCookie | null | undefined): T {
  if (cookie) response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

export type GuestSessionResult =
  | { ok: true; auth: AuthContext; sessionCookieToSet?: SessionCookie }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

/**
 * Returns the current session, or creates a guest account for a first-time
 * onboarding visitor. ONLY call this from the onboarding draft write.
 */
export async function getOrCreateGuestSession(request: Request): Promise<GuestSessionResult> {
  const existing = await getServerAuthContext();
  if (existing) return { ok: true, auth: existing };

  const rl = await checkRateLimitDistributed(getClientIp(request), "guest");
  if (!rl.allowed) {
    return { ok: false, reason: "rate_limited", retryAfterSeconds: Math.ceil(rl.resetMs / 1000) };
  }

  const guestId = crypto.randomBytes(6).toString("hex");
  const guestEmail = `guest_${Date.now()}_${guestId}@${GUEST_EMAIL_DOMAIN}`;
  const passwordHash = await hashPassword(crypto.randomBytes(16).toString("hex"));

  const created = await createUser({
    email: guestEmail,
    passwordHash,
    displayName: "Student",
  });

  const { token, expiresAt, sessionId } = await createSession(created.userId);
  return {
    ok: true,
    auth: {
      user: { id: created.userId, email: created.email },
      person: { id: created.personId, displayName: created.displayName },
      session: { id: sessionId, token, expiresAt },
    },
    sessionCookieToSet: sessionCookieFor(token, expiresAt),
  };
}
