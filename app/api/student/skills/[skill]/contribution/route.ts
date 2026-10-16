import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SkillIntelligenceService } from "@/lib/services/skill-intelligence-service";

async function POST_handler(
  req: Request,
  props: { params: Promise<{ skill: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { skill } = await props.params;
    const decodedSkill = decodeURIComponent(skill);

    const body = await req.json().catch(() => ({}));
    const {
      projectId,
      didYouPersonallyUse = true,
      roleInProject,
      codebaseParts,
      challengesSolved,
      projectType,
      liveComfortLevel,
      featureImplemented,
      componentDescription,
      fileReference,
      wantsAssessment,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: projectId." },
        { status: 400 }
      );
    }

    const result = await SkillIntelligenceService.recordSkillContribution({
      personId: auth.person.id,
      skill: decodedSkill,
      projectId,
      didYouPersonallyUse,
      roleInProject,
      codebaseParts,
      challengesSolved,
      projectType,
      liveComfortLevel,
      featureImplemented,
      componentDescription,
      fileReference,
      wantsAssessment,
    });

    return NextResponse.json({
      success: true,
      message:
        "Personal contribution recorded successfully. Stored as student-confirmed evidence (not third-party proof).",
      skillIntelligence: result.skillIntelligence,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error saving personal contribution.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
