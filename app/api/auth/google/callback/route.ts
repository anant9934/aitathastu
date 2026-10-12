import { NextResponse } from "next/server";
import crypto from "crypto";
import { findUserByEmail, createUser } from "@/lib/repositories/user-repository";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { saveExternalConnection } from "@/lib/repositories/connection-repository";
import { getDb, journeyEvents } from "@/lib/db";
import { getCanonicalOrigin } from "@/lib/auth/origin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const encodedState = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const baseUrl = getCanonicalOrigin(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(`Google authentication was cancelled: ${errorParam}`)}`, baseUrl)
    );
  }

  if (!code || !encodedState) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_oauth_response", baseUrl));
  }

  let parsedState: { state: string; from: string } | null = null;
  try {
    const decoded = Buffer.from(encodedState, "base64url").toString("utf-8");
    parsedState = JSON.parse(decoded);
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_oauth_state", baseUrl));
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/tathastu_google_oauth_state=([^;]+)/);
  const expectedState = match ? match[1] : null;

  if (!expectedState || expectedState !== parsedState?.state) {
    return NextResponse.redirect(new URL("/sign-in?error=state_verification_failed", baseUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/sign-in?error=google_credentials_missing", baseUrl));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Google OAuth] Token exchange error:", errText);
      return NextResponse.redirect(new URL("/sign-in?error=token_exchange_failed", baseUrl));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(new URL("/sign-in?error=failed_to_retrieve_profile", baseUrl));
    }

    const profile = await userInfoRes.json();
    const email = profile.email?.trim().toLowerCase();
    const emailVerified = Boolean(profile.email_verified);
    const googleSub = profile.sub;
    if (!email || !emailVerified) {
      return NextResponse.redirect(new URL("/sign-in?error=unverified_email", baseUrl));
    }
    const displayName = profile.name?.trim() || profile.given_name?.trim() || email.split("@")[0];

    const existingUser = await findUserByEmail(email);
    let userId: string;
    let personId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
      personId = existingUser.personId || "";
      if (personId) {
        const db = await getDb();
        await db.insert(journeyEvents).values({
          id: `je_gauth_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
          personId,
          type: "sign_in",
          title: "Signed in with Google",
          description: `Verified Google identity authenticated (${email}).`,
          timestamp: new Date(),
        });
      }
    } else {
      isNewUser = true;
      const created = await createUser({
        email,
        passwordHash: `google_oauth_${crypto.randomBytes(16).toString("hex")}`,
        displayName,
      });
      userId = created.userId;
      personId = created.personId;
    }

    if (personId) {
      try {
        await saveExternalConnection({
          personId,
          provider: "google",
          externalUsername: email,
          externalAccountId: googleSub,
          profileUrl: `https://profiles.google.com/${googleSub}`,
          displayName,
          status: "connected",
          metadata: {
            googleSub,
            emailVerified: true,
            linkedAt: new Date().toISOString(),
          },
        });
      } catch {
        // Safe if link already established
      }
    }

    const { token, expiresAt } = await createSession(userId);

    const requested = parsedState?.from;
    const destination = isNewUser ? "/onboarding" : (
      requested?.startsWith("/student/") && !requested.startsWith("//")
        ? `/start?from=${encodeURIComponent(requested)}`
        : "/start"
    );
    const response = NextResponse.redirect(new URL(destination, baseUrl));

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    response.cookies.delete("tathastu_google_oauth_state");
    response.cookies.delete("tathastu_google_oauth_nonce");

    return response;
  } catch (err: unknown) {
    console.error("[Google OAuth] Unexpected callback error:", err);
    return NextResponse.redirect(new URL("/sign-in?error=authentication_exception", baseUrl));
  }
}
