import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getPerson360 } from "@/lib/services/person-360-service";
import { cachedStudentJson } from "@/lib/cache/response-cache";
import { editProfileDetails, ProfileEditError } from "@/lib/services/profile-edit-service";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { value, hit } = await cachedStudentJson(auth.person.id, "person360", () => getPerson360(auth.person.id, auth.person.id));
    return NextResponse.json(value, { headers: { "x-cache": hit ? "hit" : "miss" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load Person 360.";
    console.error("[Person 360 Fetch Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/** In-place profile edits (Task 2.2.2): headline, bio, academics, placement status. */
async function PATCH_handler(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  try {
    const result = await editProfileDetails(auth.person.id, body);
    return NextResponse.json({ changed: result.changed, version: result.version });
  } catch (err) {
    if (err instanceof ProfileEditError) return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
    console.error("[Person 360 Edit Error]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Your profile could not be saved. Please try again." }, { status: 500 });
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const PATCH = withStudentCacheInvalidation(PATCH_handler);
