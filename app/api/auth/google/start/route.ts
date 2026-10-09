import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCanonicalOrigin } from "@/lib/auth/origin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "/student";
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

  const baseUrl = getCanonicalOrigin(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent("Google Sign-In is awaiting GOOGLE_CLIENT_ID configuration.")}&from=${encodeURIComponent(from)}`,
        baseUrl
      )
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");

  const statePayload = JSON.stringify({ state, from });
  const encodedState = Buffer.from(statePayload).toString("base64url");

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid profile email");
  googleAuthUrl.searchParams.set("state", encodedState);
  googleAuthUrl.searchParams.set("nonce", nonce);
  googleAuthUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleAuthUrl.toString());

  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set("tathastu_google_oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  response.cookies.set("tathastu_google_oauth_nonce", nonce, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
