import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { ConsentService } from "@/lib/services/consent-service";

export interface CookiePreferences {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({
      essential: true,
      functional: true,
      analytics: false,
      marketing: false,
      isDefault: true,
    });
  }

  const consent = await ConsentService.getConsent(auth.person.id, "cookie_preferences");
  if (consent?.metadata?.preferences) {
    return NextResponse.json({
      ...(consent.metadata.preferences as Record<string, unknown>),
      isDefault: false,
    });
  }

  return NextResponse.json({
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
    isDefault: true,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { functional = true, analytics = false, marketing = false } = body;

    const prefs: CookiePreferences = {
      essential: true,
      functional: Boolean(functional),
      analytics: Boolean(analytics),
      marketing: Boolean(marketing),
      updatedAt: new Date().toISOString(),
    };

    const auth = await getServerAuthContext();
    if (auth) {
      await ConsentService.recordConsent({
        personId: auth.person.id,
        purpose: "cookie_preferences",
        scope: "browser_storage",
        status: "granted",
        sourceUI: "cookie_settings_modal",
        metadata: { preferences: prefs },
      });
    }

    const response = NextResponse.json({ success: true, preferences: prefs });
    // Also set a non-httpOnly lightweight cookie for immediate client-side JS read
    response.cookies.set("tathastu_cookie_choice", JSON.stringify(prefs), {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save cookie preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
