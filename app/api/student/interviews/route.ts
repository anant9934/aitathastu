import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getStudentInterviews } from "@/lib/repositories/integration-repository";

/**
 * GET /api/student/interviews
 * Returns all connected AI Interview sessions for the authenticated student.
 */
export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const interviews = await getStudentInterviews(auth.person.id);
    return NextResponse.json({ interviews });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load interviews.";
    console.error("[Student Interviews Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
