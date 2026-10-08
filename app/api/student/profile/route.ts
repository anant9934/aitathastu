import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { updatePersonProfileService } from "@/lib/services/person-360-service";

export async function PATCH(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json();
    const updated = await updatePersonProfileService(auth.person.id, auth.person.id, {
      displayName: body.displayName,
      education: body.education,
      experience: body.experience,
      headline: body.headline,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update profile.";
    console.error("[Profile Update Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
