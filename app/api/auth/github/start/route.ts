import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getCanonicalOrigin } from "@/lib/auth/origin";

export async function GET(req: Request) {
  if (!coreIngestionReady()) return NextResponse.json({ error: "GitHub connection is unavailable until credential rotation is complete." }, { status: 503 });
  const url = new URL(req.url);
  const baseUrl = getCanonicalOrigin(req);

  // Where to land after OAuth. Only these in-app paths are allowed (no open redirect).
  const requested = url.searchParams.get("returnTo");
  const returnTo = requested === "/onboarding" ? "/onboarding" : "/student/connections";

  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.redirect(
      new URL(`/sign-in?from=${encodeURIComponent("/student/connections")}`, baseUrl)
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        `/student/connections?error=${encodeURIComponent("GitHub App client ID is not configured. Please set GITHUB_CLIENT_ID.")}`,
        baseUrl
      )
    );
  }

  const redirectUri = `${baseUrl}/api/auth/github/callback`;
  const state = crypto.randomBytes(24).toString("hex");

  const statePayload = JSON.stringify({ state, personId: auth.person.id, returnTo });
  const encodedState = Buffer.from(statePayload).toString("base64url");

  const ghAuthUrl = new URL("https://github.com/login/oauth/authorize");
  ghAuthUrl.searchParams.set("client_id", clientId);
  ghAuthUrl.searchParams.set("redirect_uri", redirectUri);
  // Least-privilege: request strictly read-only user identity without broad repo write permissions
  ghAuthUrl.searchParams.set("scope", "read:user");
  ghAuthUrl.searchParams.set("state", encodedState);

  const response = NextResponse.redirect(ghAuthUrl.toString());
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set("tathastu_gh_oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
