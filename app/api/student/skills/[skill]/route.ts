import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SkillIntelligenceService } from "@/lib/services/skill-intelligence-service";

export async function GET(
  _req: Request,
  props: { params: Promise<{ skill: string }> }
) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { skill } = await props.params;
    const decodedSkill = decodeURIComponent(skill);

    const intel = await SkillIntelligenceService.getSkillsIntelligence(auth.person.id);
    const skillNode = intel.skills.find(
      (s) =>
        s.canonicalName.toLowerCase() === decodedSkill.toLowerCase() ||
        s.name.toLowerCase() === decodedSkill.toLowerCase()
    );

    if (!skillNode) {
      const missingGoalSkill = intel.missingGoalSkills.find(
        (m) => m.name.toLowerCase() === decodedSkill.toLowerCase()
      );

      return NextResponse.json({
        name: decodedSkill,
        canonicalName: decodedSkill,
        category: missingGoalSkill?.category || "Other",
        state: "Unknown",
        level: "Not assessed",
        goalRelevance: missingGoalSkill?.relevance || "elective",
        isGoalPrerequisite: missingGoalSkill?.relevance === "required_core",
        evidenceCount: 0,
        evidenceItems: [],
        relatedProjects: [],
        dimensions: {
          selfAssessedKnowledge: "None",
          observedTechnicalEvidence: { count: 0, files: [], repositories: [], platforms: [] },
          demonstratedApplication: { projectCount: 0, projects: [] },
          assessedCompetency: { assessed: false },
          independentVerification: { verified: false },
        },
        conciseExplanation: `${decodedSkill} has not yet been observed in your profile or connected sources. Missing skill evidence is not proof that you lack this skill.`,
        whyTathastuThinksThis: `${decodedSkill} has not yet been observed in your profile or connected sources. Missing skill evidence is not proof that you lack this skill.`,
        lastObservedAt: new Date().toISOString(),
        sevenQuestions: {
          whatIsThisSkill: {
            name: decodedSkill,
            category: missingGoalSkill?.category || "Other",
            definition: `${decodedSkill} is a skill relevant to your technical growth and target role profile.`,
          },
          whereWasItObserved: {
            sources: [],
            observations: [],
          },
          howWasItUsed: {
            usageSummary: `No verified repositories or projects demonstrate ${decodedSkill} yet.`,
            projects: [],
            manifestsOrFiles: [],
          },
          whatDidStudentPersonallyContribute: {
            hasContribution: false,
            statement: "No personal contribution recorded yet.",
            roles: [],
          },
          howMuchKnowledgeDemonstrated: {
            level: "Not assessed",
            explanation: `No evidence for ${decodedSkill} is recorded yet. This does not mean you lack competency.`,
            isVerified: false,
          },
          whatEvidenceIsMissing: {
            missingPoints: [
              "No project or repository code currently demonstrates this skill.",
              "No independent assessment or faculty verification on record.",
            ],
          },
          whatShouldStudentLearnOrProveNext: {
            action: `Implement a project or complete a practice challenge using ${decodedSkill}.`,
            suggestedTask: missingGoalSkill?.suggestedTask || `Build a focused prototype demonstrating ${decodedSkill}.`,
            assessmentAvailable: true,
          },
        },
        whatToImprove: missingGoalSkill?.suggestedTask || `Build a focused prototype demonstrating ${decodedSkill} or complete a practice module.`,
        learningPath: [
          { title: `Foundations of ${decodedSkill}`, source: "Study LPU", type: "Learn" },
          { title: `${decodedSkill} Practice Challenges`, source: "Padho Code", type: "Practice" },
          { title: `Applied ${decodedSkill} Project`, source: "Projects", type: "Build" },
          { title: `${decodedSkill} Knowledge Assessment`, source: "ERIS Assessment", type: "Verify" },
        ],
      });
    }

    let mappedState: "Verified" | "Demonstrated" | "Evidence available" | "Claimed" | "Unknown" = "Claimed";
    if (skillNode.level === "Verified" || skillNode.level === "Assessed") {
      mappedState = "Verified";
    } else if (skillNode.level === "Demonstrated") {
      mappedState = "Demonstrated";
    } else if (skillNode.level === "Applied evidence available" || skillNode.level === "Exposure recorded") {
      mappedState = "Evidence available";
    } else if (skillNode.level === "Claimed") {
      mappedState = "Claimed";
    } else {
      mappedState = "Unknown";
    }

    return NextResponse.json({
      name: skillNode.canonicalName,
      canonicalName: skillNode.canonicalName,
      category: skillNode.category,
      state: mappedState,
      level: skillNode.level,
      goalRelevance: skillNode.goalRelevance,
      isGoalPrerequisite: skillNode.isGoalPrerequisite,
      evidenceCount: skillNode.observations.length,
      evidenceItems: skillNode.observations.map((o) => ({
        id: o.id,
        source: o.source,
        verificationStatus: o.sourceType === "faculty_verification" ? "verified" : (o.sourceType === "personal_contribution" ? "self_reported" : "unverified"),
        sourceReference: o.sourceReference,
        observedAt: o.observedAt,
        interpretation: o.summary,
      })),
      relatedProjects: skillNode.dimensions.demonstratedApplication.projects.map((p) => ({
        id: p.id,
        title: p.title,
        repositoryUrl: p.repositoryUrl || null,
        personalContributionRoles: p.roles,
        description: p.description,
      })),
      personalContribution: skillNode.personalContribution,
      dimensions: skillNode.dimensions,
      conciseExplanation: skillNode.conciseExplanation,
      whyTathastuThinksThis: skillNode.conciseExplanation,
      sevenQuestions: skillNode.sevenQuestions,
      graph: skillNode.graph,
      observations: skillNode.observations,
      whatToImprove: skillNode.sevenQuestions.whatShouldStudentLearnOrProveNext.suggestedTask,
      learningPath: [
        { title: `Advanced ${skillNode.canonicalName} Implementation`, source: "Projects", type: "Build" },
        { title: `${skillNode.canonicalName} Skill Verification Assessment`, source: "ERIS Assessment", type: "Verify" },
        { title: `Technical Interview Simulation on ${skillNode.canonicalName}`, source: "MentorMaze", type: "Interview" },
      ],
      lastObservedAt: skillNode.lastObservedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error loading skill details.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
