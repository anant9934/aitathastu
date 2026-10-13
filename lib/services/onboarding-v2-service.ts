import { eq, sql } from "drizzle-orm";
import { getDb, onboardingDrafts, userPreferences } from "@/lib/db";
import { safeDraft, type OnboardingDraft } from "@/lib/onboarding-v2";
import { updatePersonProfileData, getPersonProfile } from "@/lib/repositories/person-repository";
import { setActiveGoal } from "@/lib/repositories/goal-repository";
import { writeEvidenceBatch, type EvidenceInsertParams } from "@/lib/repositories/evidence-repository";
import { slugify } from "@/lib/text/normalize";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";
import { validateReviewedResumeClaims } from "@/lib/services/resume-review-service";
import { validatePurposes } from "@/lib/domain/adaptive-workspace";

export async function readOnboardingDraft(personId: string) {
  const db = await getDb();
  const [row] = await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.personId, personId)).limit(1);
  return row ? safeDraft(row.draft) : null;
}

export async function writeOnboardingDraft(personId: string, input: unknown) {
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  if ("role" in raw && raw.role !== "student" && raw.role !== "faculty") throw new Error("Choose Student or Faculty.");
  if ("priorities" in raw) {
    const previous = await readOnboardingDraft(personId);
    const role = raw.role || previous?.role;
    if (role !== "student" && role !== "faculty") throw new Error("Choose a role before choosing purposes.");
    if (!Array.isArray(raw.priorities) || raw.priorities.length > 3) throw new Error("Choose up to three purposes.");
    if (raw.priorities.length) validatePurposes(role, raw.priorities);
  }
  const normalized = safeDraft(raw);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      const value = normalized[key as keyof OnboardingDraft];
      patch[key] = value === undefined && raw[key] === null ? null : value;
    }
  }
  const draft = safeDraft(patch);
  const db = await getDb();
  await db
    .insert(onboardingDrafts)
    .values({ personId, draft, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: onboardingDrafts.personId,
      set: {
        draft: sql`${onboardingDrafts.draft} || ${JSON.stringify(patch)}::jsonb`,
        updatedAt: new Date(),
      },
    });
  return await readOnboardingDraft(personId);
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
  if (draft.role !== "student" && draft.role !== "faculty") throw new Error("Choose Student or Faculty to continue.");
  const rankedPurposes = validatePurposes(draft.role, draft.priorities);
  if (draft.primaryPriority && draft.primaryPriority !== rankedPurposes[0]) throw new Error("Primary purpose must be first in your ranking.");
  draft.priorities = rankedPurposes;
  draft.primaryPriority = rankedPurposes[0];
  if (draft.role === "faculty") {
    if (!draft.name.trim() || !draft.institution?.trim()) throw new Error("Add your name and institution to request faculty access.");
    await updatePersonProfileData(personId, { displayName: draft.name, institution: draft.institution, specialization: draft.specialization || undefined, headline: "Faculty access requested" });
    const db = await getDb();
    await db.insert(userPreferences).values({ id: crypto.randomUUID(), personId, primaryPriority: rankedPurposes[0], secondaryPriorities: rankedPurposes.slice(1), preferenceSource: "user_selected", metadata: { requestedRole: "faculty", facultyAccessStatus: "pending", purposeVersion: 4 }, updatedAt: new Date() }).onConflictDoUpdate({ target: userPreferences.personId, set: { primaryPriority: rankedPurposes[0], secondaryPriorities: rankedPurposes.slice(1), preferenceSource: "user_selected", metadata: sql`coalesce(${userPreferences.metadata}, '{}'::jsonb) || ${JSON.stringify({ requestedRole: "faculty", facultyAccessStatus: "pending", purposeVersion: 4 })}::jsonb`, updatedAt: new Date() } });
    draft.completed = true;
    await writeOnboardingDraft(personId, draft);
    return draft;
  }
  await validateReviewedResumeClaims(personId, draft.resumeReviewed);
  const existingProfile = await getPersonProfile(personId);

  const studentName = draft.name?.trim() || "";
  const degree = draft.degree?.trim() || existingProfile?.degree || "";
  const specialization = draft.specialization?.trim() || existingProfile?.specialization || "";
  const year = draft.year?.trim() || existingProfile?.currentYear || "";
  const goal = draft.goal?.trim() || "";

  let institution = draft.institution?.trim() || "";
  const confirmedEducation = (draft.education || []).filter((entry) => entry.status === "confirmed");
  if (!institution && confirmedEducation.length > 0) {
    const firstEdu = confirmedEducation[0] as Record<string, unknown>;
    if (typeof firstEdu?.institution === "string") {
      institution = firstEdu.institution.trim();
    }
  }
  if (!institution && existingProfile?.institution) {
    institution = existingProfile.institution.trim();
  }

  // Conflict detection: if existing profile has a different institution and incoming is non-empty
  if (
    existingProfile?.institution &&
    institution &&
    existingProfile.institution.trim().toLowerCase() !== institution.toLowerCase()
  ) {
    const { CrossSourceFusionService } = await import("@/lib/services/cross-source-fusion-service");
    await CrossSourceFusionService.recordConflictIfDifferent(
      personId,
      "institution",
      "existing_profile",
      existingProfile.institution,
      "onboarding_update",
      institution
    ).catch(() => null);
  }

  const education = [degree, institution, specialization, year, draft.semester].filter(Boolean).join(" · ");

  const headline = draft.targetRole ? `Aspiring ${draft.targetRole}` : undefined;

  await updatePersonProfileData(personId, {
    displayName: studentName || undefined,
    headline,
    education: education || undefined,
    degree: degree || undefined,
    specialization: specialization || undefined,
    institution: institution || undefined,
    currentYear: year || undefined,
    semester: draft.semester || undefined,
    expectedGraduationYear: draft.expectedGraduationYear || existingProfile?.expectedGraduationYear || undefined,
  });

  const goalDescription = `Target Role: ${draft.targetRole || "Not selected"}${
    draft.targetTimeline ? ` · Timeline: ${draft.targetTimeline}` : ""
  }${draft.customGoalText ? ` · Note: ${draft.customGoalText}` : ""}`;

  if (goal) await setActiveGoal(personId, goal, goalDescription, "custom");

  // Evidence writes are independent of each other, so they are collected here
  // and written concurrently at the end (writeEvidenceBatch) instead of one
  // round trip at a time. Keys are deterministic, so a retried completion
  // updates the same rows instead of duplicating them.
  const pendingEvidence: EvidenceInsertParams[] = [];
  const add = async (
    category: "education" | "skill" | "project" | "goal" | "experience" | "other",
    subject: string,
    value: string,
    source: "self_reported" | "resume_extracted",
    key: string,
    interpretation: string,
    sourceReference?: string
  ) => {
    pendingEvidence.push({
      category,
      subject,
      value,
      source,
      verificationStatus: source === "resume_extracted" ? "unverified" : "self_reported",
      interpretation,
      whyItMatters:
        "Provides context for your evolving profile and next actions. It is not independently verified.",
      importKey: `ob2_${personId}_${key}`,
      sourceReference: sourceReference ?? null,
    });
  };

  if (education) await add("education", education, education, "self_reported", "education", "Academic context confirmed during onboarding.");
  if (draft.targetRole) await add(
    "goal",
    `Target Role: ${draft.targetRole}`,
    draft.targetRole,
    "self_reported",
    "target_role",
    "Your chosen career direction in AI/ML; it can be edited anytime."
  );
  if (goal) await add(
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

  const reviewedResumeSkills = new Set(draft.resumeReviewed.filter((claim) => claim.category === "skill").map((claim) => claim.value.toLowerCase()));
  for (const skill of [...new Set(draft.skills)]) {
    if (reviewedResumeSkills.has(skill.toLowerCase())) continue;
    await add(
      "skill",
      skill,
      skill,
      "self_reported",
      `skill_${slugify(skill)}`,
      "Confirmed by you during onboarding; this does not establish proficiency."
    );
  }

  for (const claim of draft.resumeReviewed) {
    const category: "education" | "skill" | "project" | "goal" | "experience" | "other" =
      claim.category === "certification" || claim.category === "achievement"
        ? "other"
        : claim.category;
    await add(
      category,
      claim.value,
      claim.value,
      claim.corrected ? "self_reported" : "resume_extracted",
      `resume_${claim.documentId}_${claim.category}_${slugify(claim.value)}`,
      claim.corrected ? `Student corrected an extraction candidate. Original source excerpt: ${claim.sourceSpan}` : `Student accepted an extraction candidate. Source excerpt: ${claim.sourceSpan}`,
      `resume:sha256:${claim.documentId}`
    );
  }

  // Record all confirmed education qualifications
  const inputEducation = confirmedEducation;
  for (const edu of inputEducation) {
    if (edu && typeof edu === "object") {
      const inst = String((edu as any).institution || "").trim();
      const deg = String((edu as any).degree || "").trim();
      const field = String((edu as any).fieldOfStudy || (edu as any).specialization || "").trim();
      const grad = (edu as any).graduationYear ? String((edu as any).graduationYear).trim() : "";
      const dates = [(edu as any).startDate, (edu as any).endDate].filter(Boolean).join(" - ");
      const score = (edu as any).gpa ? `GPA: ${(edu as any).gpa}` : (edu as any).percentage ? `${(edu as any).percentage}%` : "";
      const level = (edu as any).academicLevel ? `[${(edu as any).academicLevel}]` : "";
      const details = [deg, inst, field, dates || grad, score, level].filter(Boolean).join(" · ");
      if (details) {
        await add(
          "education",
          inst || deg || "Academic Record",
          details,
          "self_reported",
          `edu_${slugify((inst || deg))}`,
          "Academic qualification confirmed during onboarding."
        );
      }
    }
  }

  // Record confirmed student experiences
  const inputExperiences = (draft.experiences || []).filter((entry) => entry.status === "confirmed");
  for (const exp of inputExperiences) {
    if (exp && typeof exp === "object") {
      const company = String((exp as any).company || (exp as any).organization || "").trim();
      const role = String((exp as any).role || "").trim();
      const type = (exp as any).type ? ` [${(exp as any).type}]` : "";
      const dates = [(exp as any).startDate, (exp as any).endDate].filter(Boolean).join(" - ") || (exp as any).duration || "";
      const techs = Array.isArray((exp as any).technologies) && (exp as any).technologies.length > 0
        ? ` · Tech: ${(exp as any).technologies.join(", ")}`
        : "";
      if (company || role) {
        const title = `${role ? role + " at " : ""}${company}${type}`;
        await add(
          "experience",
          title,
          `${title}${dates ? " (" + dates + ")" : ""}${techs}`,
          "self_reported",
          `exp_${slugify(company)}_${slugify(role)}`,
          Array.isArray((exp as any).highlights) && (exp as any).highlights.length > 0
            ? (exp as any).highlights.join("; ")
            : "Experience entry confirmed by student during onboarding."
        );
      }
    }
  }

  // Record confirmed student achievements (patents, publications, awards, books)
  const inputAchievements = (draft.achievements || []).filter((entry) => entry.status === "confirmed");
  for (const ach of inputAchievements) {
    if (ach && typeof ach === "object") {
      const title = String((ach as any).title || "").trim();
      const subType = (ach as any).subType ? ` [${(ach as any).subType}]` : "";
      const status = (ach as any).status ? ` (${(ach as any).status})` : "";
      if (title) {
        await add(
          "other",
          title,
          `${title}${subType}${status}${(ach as any).issuer ? " · " + (ach as any).issuer : ""}${(ach as any).date ? " (" + (ach as any).date + ")" : ""}`,
          "self_reported",
          `ach_${slugify(title)}`,
          (ach as any).description || "Achievement or academic output confirmed by student during onboarding."
        );
      }
    }
  }

  for (const certification of [...new Set(draft.certifications)]) {
    await add(
      "other",
      certification,
      certification,
      "self_reported",
      `cert_${slugify(certification)}`,
      "Certification reported by you; it has not been verified."
    );
  }

  const { saveProject, saveProjectContribution } = await import("@/lib/repositories/project-repository");
  for (const project of draft.projects.filter((p) => p.status === "confirmed")) {
    const savedProj = await saveProject(personId, {
      title: project.title,
      description: project.description,
      technologies: project.technologies,
      sources: project.sources,
      repositoryUrl: project.url || null,
      aiDetails: project.aiPurpose ? { proposedSolution: project.aiPurpose, limitations: project.uncertaintyNotes?.join("; ") } : undefined,
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
        status: "reference_only",
      }).catch(() => null);
    }
  }

  await writeEvidenceBatch(personId, pendingEvidence);

  await createJourneyEventRecord(personId, {
    type: "onboarding_started",
    title: "Starting picture created",
    description: `EORA onboarding completed with target role ${draft.targetRole}, goal ${draft.goal}, and academic context.`,
    importKey: `ob2_completed_${personId}`,
  });

  const db = await getDb();
  const primary = draft.primaryPriority || (draft.priorities && draft.priorities.length > 0 ? draft.priorities[0] : "");
  const secondary = draft.priorities ? draft.priorities.filter((p) => p !== primary) : [];
  const directionMetadata = Object.fromEntries(
    Object.entries({
      targetRole: draft.targetRole,
      targetRoleId: draft.targetRoleId,
      targetTimeline: draft.targetTimeline,
      customGoalText: draft.customGoalText,
    }).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
  );
  directionMetadata.requestedRole = "student";
  directionMetadata.purposeVersion = "4";

  if (primary || Object.keys(directionMetadata).length > 0) await db
    .insert(userPreferences)
    .values({
      id: crypto.randomUUID(),
      personId,
      primaryPriority: primary || null,
      secondaryPriorities: secondary,
      preferenceSource: primary ? "user_selected" : "not_selected",
      metadata: directionMetadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.personId,
      set: {
        ...(primary ? {
          primaryPriority: primary,
          secondaryPriorities: secondary,
          preferenceSource: "user_selected",
        } : {}),
        metadata: sql`coalesce(${userPreferences.metadata}, '{}'::jsonb) || ${JSON.stringify(directionMetadata)}::jsonb`,
        updatedAt: new Date(),
      },
    });

  const { CrossSourceFusionService } = await import("@/lib/services/cross-source-fusion-service");
  await CrossSourceFusionService.recordProfileVersion(
    personId,
    "onboarding",
    "Onboarding canonical data reconciled",
    {
      displayName: studentName,
      headline,
      institution,
      degree,
      specialization,
      year,
      projectsCount: draft.projects.filter((p) => p.status === "confirmed").length,
    }
  ).catch(() => null);

  draft.completed = true;
  draft.stage = "reveal";
  await writeOnboardingDraft(personId, draft);
  return draft;
}
