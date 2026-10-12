import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { connectGitHubAccount, syncGitHubConnection } from "@/lib/services/github-sync-service";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getCanonicalOrigin } from "@/lib/auth/origin";

export async function GET(req: Request) {
  if (!coreIngestionReady()) return NextResponse.json({ error: "GitHub connection is unavailable until credential rotation is complete." }, { status: 503 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const encodedState = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const baseUrl = getCanonicalOrigin(req);
  const redirectUri = `${baseUrl}/api/auth/github/callback`;

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/student/connections?error=${encodeURIComponent(`GitHub authorization was cancelled or failed: ${errorParam}`)}`, baseUrl)
    );
  }

  if (!code || !encodedState) {
    return NextResponse.redirect(new URL("/student/connections?error=invalid_github_response", baseUrl));
  }

  let parsedState: { state: string; personId: string; returnTo?: string } | null = null;
  try {
    const decoded = Buffer.from(encodedState, "base64url").toString("utf-8");
    parsedState = JSON.parse(decoded);
  } catch {
    return NextResponse.redirect(new URL("/student/connections?error=invalid_state", baseUrl));
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/tathastu_gh_oauth_state=([^;]+)/);
  const expectedState = match ? match[1] : null;

  if (!expectedState || expectedState !== parsedState?.state) {
    return NextResponse.redirect(new URL("/student/connections?error=state_mismatch", baseUrl));
  }

  // Allow-listed in /api/auth/github/start; re-checked here because state is client-visible.
  const returnPath = parsedState?.returnTo === "/onboarding" ? "/onboarding" : "/student/connections";

  const auth = await getServerAuthContext();
  if (!auth || auth.person.id !== parsedState?.personId) {
    return NextResponse.redirect(new URL("/sign-in?from=/student/connections", baseUrl));
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`${returnPath}?error=missing_github_secrets`, baseUrl));
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL(`${returnPath}?error=token_exchange_failed`, baseUrl));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(
        new URL(`${returnPath}?error=${encodeURIComponent(tokenData.error_description || "no_access_token")}`, baseUrl)
      );
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "AI-Tathastu-App",
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL(`${returnPath}?error=failed_fetching_github_user`, baseUrl));
    }

    const ghUser = await userRes.json();
    const username = ghUser.login;
    const accountId = String(ghUser.id);

    await connectGitHubAccount({
      personId: auth.person.id,
      username,
      externalAccountId: accountId,
      token: accessToken,
      scopes: typeof tokenData.scope === "string"
        ? tokenData.scope.split(/[\s,]+/).filter(Boolean)
        : (userRes.headers.get("x-oauth-scopes") || "").split(/[\s,]+/).filter(Boolean),
    });

    void syncGitHubConnection(auth.person.id, accessToken).catch((syncErr) => {
      console.error("[GitHub Sync Background Error]", syncErr);
    });

    const response = NextResponse.redirect(new URL(`${returnPath}?success=github_connected`, baseUrl));
    response.cookies.delete("tathastu_gh_oauth_state");
    return response;
  } catch (err: unknown) {
    console.error("[GitHub OAuth Callback Exception]", err);
    return NextResponse.redirect(new URL(`${returnPath}?error=oauth_internal_error`, baseUrl));
  }
}
