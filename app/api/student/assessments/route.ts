import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getStudentAssessments } from "@/lib/repositories/integration-repository";

/**
 * GET /api/student/assessments
 * Returns all connected ERIS assessments for the authenticated student.
 */
export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assessments = await getStudentAssessments(auth.person.id);
    return NextResponse.json({ assessments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load assessments.";
    console.error("[Student Assessments Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
