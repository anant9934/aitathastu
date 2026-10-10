import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getPersonProfile, getUserPreferences } from "@/lib/repositories/person-repository";
import { getActiveGoal } from "@/lib/repositories/goal-repository";
import { getEvidenceByPersonId } from "@/lib/repositories/evidence-repository";
import { getProjectsByPersonId } from "@/lib/repositories/project-repository";
import { generatePersonalizedRoadmap, persistRoadmapMilestones } from "@/lib/domain/roadmap";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const personId = auth.person.id;
    const [profile, activeGoal, evidenceList, preferences, projects] = await Promise.all([
      getPersonProfile(personId),
      getActiveGoal(personId),
      getEvidenceByPersonId(personId),
      getUserPreferences(personId),
      getProjectsByPersonId(personId),
    ]);

    const goalTitle = activeGoal?.title || "";
    if (!goalTitle) {
      return NextResponse.json({
        roadmap: {
          goal: "AI/ML Engineer",
          totalStages: 1,
          currentStageIndex: 0,
          stages: [
            {
              stageNumber: 1,
              title: "Foundations & Environment",
              description: "Set up Python, Git, and Core ML Tooling",
              requiredSkills: ["Python", "Git"],
              status: "in_progress",
              recommendedActions: [],
            },
          ],
          primaryActions: [
            {
              actionType: "Build",
              title: "Add your first AI project",
              description: "Showcase applied skills in projects workspace",
              whyItMatters: "Verified evidence establishes role readiness",
              sourcePlatform: "Projects",
            },
          ],
        },
        studentName: auth.person.displayName,
        goal: null,
        cohort: profile?.expectedGraduationYear || null,
        message: "Choose an AI/ML goal to create your roadmap.",
      });
    }

    const evidencedSkills = evidenceList
      .filter((e) => e.category === "skill" && e.verificationStatus === "verified")
      .map((e) => e.subject);

    const cohort = profile?.expectedGraduationYear || undefined;
    const placementStatus = profile?.placementStatus || undefined;

    const metadata = (preferences?.metadata || {}) as Record<string, unknown>;
    const targetRole = typeof metadata.targetRole === "string" ? metadata.targetRole : "";
    const generated = generatePersonalizedRoadmap(goalTitle, evidencedSkills, cohort, placementStatus, {
      targetRole,
      specificGoal: goalTitle,
      primaryPriority: preferences?.primaryPriority || undefined,
      confirmedProjectCount: projects.filter((project) => project.status === "confirmed").length,
    });
    const CORE_PLATFORMS = new Set(["Projects", "Skills", "Verification", "Roadmap", "Profile"]);
    const roadmap = {
      ...generated,
      stages: generated.stages.map((stage) => ({
        ...stage,
        recommendedActions: stage.recommendedActions.filter((action) => CORE_PLATFORMS.has(action.sourcePlatform)),
      })),
      primaryActions: generated.primaryActions.filter((action) => CORE_PLATFORMS.has(action.sourcePlatform)),
    };

    // Persist adaptive milestones in background if activeGoal exists
    if (activeGoal?.id) {
      persistRoadmapMilestones(personId, activeGoal.id, roadmap).catch(() => {});
    }

    return NextResponse.json({
      roadmap,
      studentName: auth.person.displayName,
      goal: goalTitle,
      cohort,
    });
  } catch (error) {
    console.error("Roadmap fetch error:", error);
    return NextResponse.json({
      roadmap: {
        goal: "AI/ML Engineer",
        totalStages: 1,
        currentStageIndex: 0,
        stages: [
          {
            stageNumber: 1,
            title: "Foundations & Environment",
            description: "Set up Python, Git, and Core ML Tooling",
            requiredSkills: ["Python", "Git"],
            status: "in_progress",
            recommendedActions: [],
          },
        ],
        primaryActions: [
          {
            actionType: "Build",
            title: "Add your first AI project",
            description: "Showcase applied skills in projects workspace",
            whyItMatters: "Verified evidence establishes role readiness",
            sourcePlatform: "Projects",
          },
        ],
      },
      studentName: "Student",
      goal: "AI/ML Engineer",
      cohort: null,
    });
  }
}
