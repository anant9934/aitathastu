import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { DataRightsService, DataRequestType } from "@/lib/services/data-rights-service";

export async function GET() {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  const requests = await DataRightsService.listRequests(auth.person.id);
  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { requestType, details, contactEmail } = body;

    const validTypes: DataRequestType[] = [
      "access",
      "correction",
      "erasure",
      "grievance",
      "consent_withdrawal",
      "child_data_inquiry",
    ];

    if (!validTypes.includes(requestType)) {
      return NextResponse.json(
        { error: `Invalid requestType. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (!details || typeof details !== "string" || details.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide a description of your request (at least 5 characters)." },
        { status: 400 }
      );
    }

    const request = await DataRightsService.submitRequest({
      personId: auth.person.id,
      requestType,
      details,
      contactEmail: typeof contactEmail === "string" ? contactEmail : auth.user.email,
    });

    return NextResponse.json({ success: true, request });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit data request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
