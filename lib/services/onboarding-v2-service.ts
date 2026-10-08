import { eq } from "drizzle-orm";
import { getDb, onboardingDrafts, userPreferences } from "@/lib/db";
import { safeDraft, type OnboardingDraft } from "@/lib/onboarding-v2";
import { updatePersonProfileData } from "@/lib/repositories/person-repository";
import { setActiveGoal } from "@/lib/repositories/goal-repository";
import { createEvidenceRecord } from "@/lib/repositories/evidence-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";

export async function readOnboardingDraft(personId: string) {
  const db = await getDb();
  const [row] = await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.personId, personId)).limit(1);
  return row ? safeDraft(row.draft) : null;
}

export async function writeOnboardingDraft(personId: string, input: unknown) {
  const draft = safeDraft(input);
  const db = await getDb();
  await db
    .insert(onboardingDrafts)
    .values({ personId, draft, updatedAt: new Date() })
    .onConflictDoUpdate({ target: onboardingDrafts.personId, set: { draft, updatedAt: new Date() } });
  return draft;
}

function allowedProfileUrl(source: string, value: string) {
  const hosts: Record<string, string> = {
    github: "github.com",
    linkedin: "linkedin.com",
    leetcode: "leetcode.com",
    hackerrank: "hackerrank.com",
    hackerearth: "hackerearth.com",
    codechef: "codechef.com",
  };
  try {
    const url = new URL(value);
    return (
      Boolean(hosts[source]) &&
      url.protocol === "https:" &&
      (url.hostname === hosts[source] || url.hostname === `www.${hosts[source]}`) &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

export async function completeOnboarding(personId: string, input: unknown) {
  const draft: OnboardingDraft = safeDraft(input);
  if (draft.role !== "student") {
    throw new Error("This role's onboarding journey is coming soon. Please choose Student to continue.");
  }
  const studentName = draft.name?.trim() || "Student";
  const degree = draft.degree?.trim() || "B.Tech";
  const specialization = draft.specialization?.trim() || "Computer Science and Engineering";
  const year = draft.year?.trim() || "3rd Year";
  const goal = draft.goal?.trim() || "Get an AI/ML internship";
  const institution = draft.institution?.trim() || "Lovely Professional University (LPU)";

  const education = `${degree} · ${specialization} · ${year}${
    draft.semester ? ` · ${draft.semester}` : ""
  }`;

  const headline = draft.targetRole ? `Aspiring ${draft.targetRole}` : "AI/ML Student";

  await updatePersonProfileData(personId, {
    displayName: studentName,
    headline,
    education,
    experience: draft.projects
      .filter((p) => p.status === "confirmed")
      .map((p) => p.title)
      .join("; "),
    degree,
    specialization,
    institution,
    currentYear: year,
    semester: draft.semester,
    expectedGraduationYear: draft.expectedGraduationYear,
  });

  const goalDescription = `Target Role: ${draft.targetRole || "Generative AI Engineer"}${
    draft.targetTimeline ? ` · Timeline: ${draft.targetTimeline}` : ""
  }${draft.customGoalText ? ` · Note: ${draft.customGoalText}` : ""}`;

  await setActiveGoal(personId, goal, goalDescription, "custom");

  const add = async (
    category: "education" | "skill" | "project" | "goal" | "other",
    subject: string,
    value: string,
    source: "self_reported" | "resume_extracted",
    key: string,
    interpretation: string,
    sourceReference?: string
  ) =>
    createEvidenceRecord(personId, {
      category,
      subject,
      value,
      source,
      verificationStatus: source === "resume_extracted" ? "unverified" : "self_reported",
      interpretation,
      whyItMatters:
        "Provides context for your evolving profile and next actions. It is not independently verified.",
      importKey: `ob2_${personId}_${key}`,
      sourceReference,
    });

  await add("education", education, education, "self_reported", "education", "Academic context confirmed during onboarding.");
  await add(
    "goal",
    `Target Role: ${draft.targetRole || "AI/ML Engineer"}`,
    draft.targetRole || "AI/ML Engineer",
    "self_reported",
    "target_role",
    "Your chosen career direction in AI/ML; it can be edited anytime."
  );
  await add(
    "goal",
    `First Goal: ${draft.goal}`,
    draft.goal,
    "self_reported",
    "goal",
    "Your chosen first outcome in AI/ML; it can be edited anytime."
  );

  if (draft.targetTimeline) {
    await add(
      "goal",
      `Target Timeline: ${draft.targetTimeline}`,
      draft.targetTimeline,
      "self_reported",
      "target_timeline",
      "Your self-selected target timeline preference; it is not a binding guarantee."
    );
  }

  for (const skill of [...new Set(draft.skills)]) {
    await add(
      "skill",
      skill,
      skill,
      "self_reported",
      `skill_${skill.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      "Confirmed by you during onboarding; this does not establish proficiency."
    );
  }

  for (const certification of [...new Set(draft.certifications)]) {
    await add(
      "other",
      certification,
      certification,
      "self_reported",
      `cert_${certification.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      "Certification reported by you; it has not been verified."
    );
  }

  const { saveProject, saveProjectContribution } = await import("@/lib/repositories/project-repository");
  for (const project of draft.projects.filter((p) => p.status === "confirmed")) {
    const savedProj = await saveProject(personId, {
      title: project.title,
      technologies: project.technologies,
      sources: project.sources,
      status: "confirmed",
    });
    if (project.contribution.length > 0 || project.contributionNote) {
      await saveProjectContribution(
        savedProj.id,
        personId,
        project.contribution,
        project.contributionNote
      );
    }
    await add(
      "project",
      project.title,
      project.title,
      "self_reported",
      `project_${project.id}`,
      `Confirmed by you. Sources: ${project.sources.join(", ") || "manual"}. A repository does not establish authorship of every part.`
    );
    const contribution = [...project.contribution, project.contributionNote].filter(Boolean).join(", ");
    if (contribution) {
      await add(
        "other",
        `Personal contribution to ${project.title}`,
        contribution,
        "self_reported",
        `contribution_${project.id}`,
        "Your description of your own work on this project. It is separate from the project claim and has not been independently verified."
      );
    }
  }

  const { saveExternalConnection } = await import("@/lib/repositories/connection-repository");
  for (const [source, url] of Object.entries(draft.profiles)) {
    if (url && allowedProfileUrl(source, url)) {
      await add(
        "other",
        `${source} profile`,
        url,
        "self_reported",
        `profile_${source}`,
        "User-provided external profile reference. No profile activity or skill has been verified.",
        url
      );
      const username = url.split("/").filter(Boolean).pop() || "user";
      await saveExternalConnection({
        personId,
        provider: source as "github" | "linkedin" | "leetcode" | "codechef" | "hackerrank" | "hackerearth",
        externalUsername: username,
        profileUrl: url,
        status: "connected",
      }).catch(() => null);
    }
  }

  await createJourneyEventRecord(personId, {
    type: "onboarding_started",
    title: "Starting picture created",
    description: `EORA onboarding completed with target role ${draft.targetRole}, goal ${draft.goal}, and academic context.`,
    importKey: `ob2_completed_${personId}`,
  });

  const db = await getDb();
  const primary = draft.primaryPriority || (draft.priorities && draft.priorities.length > 0 ? draft.priorities[0] : "learning");
  const secondary = draft.priorities ? draft.priorities.filter((p) => p !== primary) : [];

  await db
    .insert(userPreferences)
    .values({
      id: crypto.randomUUID(),
      personId,
      primaryPriority: primary,
      secondaryPriorities: secondary,
      preferenceSource: "user_selected",
      metadata: {
        targetRole: draft.targetRole,
        targetRoleId: draft.targetRoleId,
        targetTimeline: draft.targetTimeline,
        customGoalText: draft.customGoalText,
      },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.personId,
      set: {
        primaryPriority: primary,
        secondaryPriorities: secondary,
        preferenceSource: "user_selected",
        metadata: {
          targetRole: draft.targetRole,
          targetRoleId: draft.targetRoleId,
          targetTimeline: draft.targetTimeline,
          customGoalText: draft.customGoalText,
        },
        updatedAt: new Date(),
      },
    });

  draft.completed = true;
  draft.stage = "reveal";
  await writeOnboardingDraft(personId, draft);
  return draft;
}
