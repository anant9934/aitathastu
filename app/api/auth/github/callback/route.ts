import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { connectGitHubAccount, syncGitHubConnection } from "@/lib/services/github-sync-service";
import { coreIngestionReady } from "@/lib/security/core-ingestion-gate";
import { getCanonicalOrigin } from "@/lib/auth/origin";
import { readCookie, safeGitHubReturnPath } from "@/lib/auth/github-return";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!coreIngestionReady()) return NextResponse.json({ error: "GitHub connection is unavailable until credential rotation is complete." }, { status: 503 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const encodedState = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const baseUrl = getCanonicalOrigin(req);
  const redirectUri = `${baseUrl}/api/auth/github/callback`;

  let parsedState: { state: string; personId: string; returnTo?: string } | null = null;
  try {
    parsedState = encodedState ? JSON.parse(Buffer.from(encodedState, "base64url").toString("utf-8")) : null;
  } catch {
    parsedState = null;
  }
  // Allow-listed, so a client-visible state can only choose between two in-app pages. Every outcome,
  // including a cancel, returns to where the student started instead of dropping them out of onboarding.
  const returnPath = safeGitHubReturnPath(parsedState?.returnTo);
  const back = (query: string) => {
    const res = NextResponse.redirect(new URL(`${returnPath}?${query}`, baseUrl));
    res.cookies.delete("tathastu_gh_oauth_state");
    return res;
  };

  if (errorParam) {
    return back(`error=${errorParam === "access_denied" ? "github_cancelled" : "github_authorization_failed"}`);
  }

  if (!code || !encodedState) return back("error=invalid_github_response");
  if (!parsedState) return back("error=invalid_state");

  const expectedState = readCookie(req.headers.get("cookie"), "tathastu_gh_oauth_state");
  if (!expectedState || expectedState !== parsedState.state) return back("error=state_mismatch");

  const auth = await getServerAuthContext();
  if (!auth || auth.person.id !== parsedState?.personId) {
    return NextResponse.redirect(new URL(`/sign-in?from=${encodeURIComponent(returnPath)}`, baseUrl));
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

    // Awaited, never fire-and-forget: on serverless platforms (e.g. Vercel) a detached
    // promise is frozen or killed once the response is sent, silently dropping the sync.
    // The sync records its own sync_runs row; a failure here still leaves the account
    // connected, and the student can retry from the Sync button.
    let syncFailed = false;
    try {
      const sync = await syncGitHubConnection(auth.person.id, accessToken);
      syncFailed = !sync.success;
      if (!sync.success) console.error("[GitHub OAuth Sync Failed]", sync.error);
    } catch (syncErr) {
      syncFailed = true;
      console.error("[GitHub OAuth Sync Error]", syncErr);
    }

    const response = NextResponse.redirect(
      new URL(`${returnPath}?success=github_connected${syncFailed ? "&sync=failed" : ""}`, baseUrl)
    );
    response.cookies.delete("tathastu_gh_oauth_state");
    return response;
  } catch (err: unknown) {
    console.error("[GitHub OAuth Callback Exception]", err);
    return NextResponse.redirect(new URL(`${returnPath}?error=oauth_internal_error`, baseUrl));
  }
}
