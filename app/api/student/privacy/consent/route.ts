import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { ConsentService, ConsentPurpose, ConsentStatus } from "@/lib/services/consent-service";

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  const status = await ConsentService.getStudentPrivacyStatus(auth.person.id);
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { purpose, scope, status, sourceUI, reason } = body;

    if (!purpose || typeof purpose !== "string") {
      return NextResponse.json({ error: "Purpose is required." }, { status: 400 });
    }

    if (status !== "granted" && status !== "withdrawn") {
      return NextResponse.json({ error: "Status must be 'granted' or 'withdrawn'." }, { status: 400 });
    }

    let record;
    if (status === "withdrawn") {
      record = await ConsentService.withdrawConsent({
        personId: auth.person.id,
        purpose: purpose as ConsentPurpose,
        scope: typeof scope === "string" ? scope : "*",
        sourceUI: typeof sourceUI === "string" ? sourceUI : "privacy_settings",
        reason: typeof reason === "string" ? reason : undefined,
      });
    } else {
      record = await ConsentService.recordConsent({
        personId: auth.person.id,
        purpose: purpose as ConsentPurpose,
        scope: typeof scope === "string" ? scope : "*",
        status: "granted",
        sourceUI: typeof sourceUI === "string" ? sourceUI : "privacy_settings",
      });
    }

    return NextResponse.json({ success: true, record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update consent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
