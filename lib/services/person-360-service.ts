import { eq } from "drizzle-orm";
import {
  getDb,
  organizationMemberships,
  organizations,
  membershipRoles,
  roles,
} from "../db";
import { can } from "../auth/rbac";
import { getPersonById, getPersonProfile, getUserPreferences, updatePersonProfileData } from "../repositories/person-repository";
import { getActiveGoal, getGoalsByPersonId } from "../repositories/goal-repository";
import { getEvidenceByPersonId } from "../repositories/evidence-repository";
import { getJourneyEventsByPersonId, createJourneyEventRecord } from "../repositories/journey-repository";
import { getActionStatesByPersonId } from "../repositories/action-repository";
import { getStudentVerificationRequests } from "./verification-service";
import { getStudentAssessments, getStudentInterviews } from "../repositories/integration-repository";
import { getProjectsByPersonId } from "../repositories/project-repository";
import type { AssessmentAttempt, InterviewSession } from "../domain/integrations";


export type Person360Result = {
  person: {
    id: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
  };
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    status: string;
    roles: Array<{ key: string; name: string }>;
  }>;
  profile: {
    education: string;
    experience: string;
    headline: string;
    degree?: string;
    specialization?: string;
    institution?: string;
    currentYear?: string;
    semester?: string;
    expectedGraduationYear?: number | null;
    placementStatus?: string;
    internshipStatus?: string;
    updatedAt: string;
  };
  activeGoal: {
    id: string;
    title: string;
    description?: string;
    source: string;
    status: string;
    updatedAt: string;
  } | null;
  allGoals: Array<{
    id: string;
    title: string;
    description?: string;
    source: string;
    status: string;
  }>;
  evidence: Array<{
    id: string;
    category: string;
    subject: string;
    value: string;
    source: string;
    verificationStatus: string;
    sourceReference?: string | null;
    verifiedByPersonId?: string | null;
    verifiedAt?: string | null;
    verificationMethod?: string | null;
    verificationDecisionId?: string | null;
    observedAt: string;
    interpretation: string;
    whyItMatters: string;
    /** Platform (Task 1.2.2) and the dedupe key; skill scoring needs both. */
    originSource?: string | null;
    importKey?: string | null;
  }>;
  verificationRequests?: Array<{
    id: string;
    evidenceId: string;
    requesterPersonId: string;
    organizationId: string;
    status: string;
    supportingReference?: string | null;
    studentNotes?: string | null;
    requestedAt: string;
    resolvedAt?: string | null;
    decisions: Array<{
      id: string;
      decision: string;
      reason?: string | null;
      method: string;
      createdAt: string;
    }>;
  }>;
  journeySummary: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown> | null;
  }>;
  actionStates: Record<string, string>;
  preferences: {
    reducedGuidance: boolean;
    eoraDismissed: boolean;
    primaryPriority?: string;
    secondaryPriorities?: string[];
    metadata?: Record<string, unknown> | null;
  };
  projects?: Array<{
    id: string;
    title: string;
    description: string | null;
    technologies: string[];
    sources: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  assessments?: AssessmentAttempt[];
  interviews?: InterviewSession[];
};


export async function getPerson360(
  personId: string,
  requesterPersonId: string
): Promise<Person360Result> {
  // Check authorization
  const isAuthorized = await can(requesterPersonId, "profile.read.self", {
    targetPersonId: personId,
  });

  if (!isAuthorized) {
    throw new Error("Unauthorized: Access to Person 360 denied.");
  }

  // These reads are independent; this function backs most dashboard, chat and
  // context requests, so they run in parallel rather than one after another.
  const db = await getDb();
  const [person, profile, activeGoal, allGoals, evidenceList, journeyList, actionStates, prefs, rawMemberships] = await Promise.all([
    getPersonById(personId),
    getPersonProfile(personId),
    getActiveGoal(personId),
    getGoalsByPersonId(personId),
    getEvidenceByPersonId(personId),
    getJourneyEventsByPersonId(personId),
    getActionStatesByPersonId(personId),
    getUserPreferences(personId),
    db
    .select({
      membershipId: organizationMemberships.id,
      orgId: organizations.id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      membershipStatus: organizationMemberships.status,
      roleKey: roles.key,
      roleName: roles.name,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .leftJoin(membershipRoles, eq(membershipRoles.membershipId, organizationMemberships.id))
    .leftJoin(roles, eq(roles.id, membershipRoles.roleId))
    .where(eq(organizationMemberships.personId, personId)),
  ]);
  if (!person) {
    throw new Error("Person not found.");
  }

  type OrgMembershipItem = {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    status: string;
    roles: Array<{ key: string; name: string }>;
  };

  const membershipMap: Record<string, OrgMembershipItem> = {};
  for (const m of rawMemberships) {
    if (!membershipMap[m.orgId]) {
      membershipMap[m.orgId] = {
        organizationId: m.orgId,
        organizationName: m.orgName,
        organizationSlug: m.orgSlug,
        status: m.membershipStatus,
        roles: [],
      };
    }
    if (m.roleKey && m.roleName) {
      membershipMap[m.orgId].roles.push({ key: m.roleKey, name: m.roleName });
    }
  }

  return {
    person: {
      id: person.id,
      displayName: person.displayName,
      createdAt: person.createdAt.toISOString(),
      updatedAt: person.updatedAt.toISOString(),
    },
    memberships: Object.values(membershipMap),
    profile: {
      education: profile?.education || "",
      experience: profile?.experience || "",
      headline: profile?.headline || "",
      degree: profile?.degree || "",
      specialization: profile?.specialization || "",
      institution: profile?.institution || "",
      currentYear: profile?.currentYear || "",
      semester: profile?.semester || "",
      expectedGraduationYear: profile?.expectedGraduationYear ?? null,
      placementStatus: profile?.placementStatus || "preparing",
      internshipStatus: profile?.internshipStatus || "seeking",
      updatedAt: profile?.updatedAt ? profile.updatedAt.toISOString() : new Date().toISOString(),
    },
    activeGoal: activeGoal
      ? {
          id: activeGoal.id,
          title: activeGoal.title,
          description: activeGoal.description || undefined,
          source: activeGoal.source,
          status: activeGoal.status,
          updatedAt: activeGoal.updatedAt.toISOString(),
        }
      : null,
    allGoals: allGoals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description || undefined,
      source: g.source,
      status: g.status,
    })),
    evidence: evidenceList.map((e) => ({
      id: e.id,
      category: e.category,
      subject: e.subject,
      value: e.value,
      source: e.source,
      verificationStatus: e.verificationStatus,
      sourceReference: e.sourceReference,
      verifiedByPersonId: e.verifiedByPersonId || null,
      verifiedAt: e.verifiedAt ? e.verifiedAt.toISOString() : null,
      verificationMethod: e.verificationMethod || null,
      verificationDecisionId: e.verificationDecisionId || null,
      observedAt: e.observedAt.toISOString(),
      interpretation: e.interpretation,
      whyItMatters: e.whyItMatters,
      originSource: e.originSource ?? null,
      importKey: e.importKey ?? null,
    })),
    verificationRequests: (await getStudentVerificationRequests(personId)).map((vr) => ({
      id: vr.id,
      evidenceId: vr.evidenceId,
      requesterPersonId: vr.requesterPersonId,
      organizationId: vr.organizationId,
      status: vr.status,
      supportingReference: vr.supportingReference,
      studentNotes: vr.studentNotes,
      requestedAt: vr.requestedAt.toISOString(),
      resolvedAt: vr.resolvedAt ? vr.resolvedAt.toISOString() : null,
      decisions: vr.decisions.map((d) => ({
        id: d.id,
        decision: d.decision,
        reason: d.reason,
        method: d.method,
        createdAt: d.createdAt.toISOString(),
      })),
    })),
    journeySummary: journeyList.map((j) => ({
      id: j.id,
      type: j.type,
      title: j.title,
      description: j.description,
      timestamp: j.timestamp.toISOString(),
      metadata: j.metadata,
    })),
    actionStates,
    preferences: {
      reducedGuidance: prefs?.reducedGuidance ?? false,
      eoraDismissed: prefs?.eoraDismissed ?? false,
      primaryPriority: prefs?.primaryPriority || "learning",
      secondaryPriorities: (prefs?.secondaryPriorities as string[]) || [],
      metadata: (prefs?.metadata as Record<string, unknown>) || null,
    },
    projects: (await getProjectsByPersonId(personId)).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      technologies: (p.technologies as string[]) || [],
      sources: (p.sources as string[]) || [],
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    assessments: await getStudentAssessments(personId),
    interviews: await getStudentInterviews(personId),
  };
}


export async function updatePersonProfileService(
  personId: string,
  requesterPersonId: string,
  updates: {
    displayName?: string;
    education?: string;
    experience?: string;
    headline?: string;
  }
) {
  const isAuthorized = await can(requesterPersonId, "profile.update.self", {
    targetPersonId: personId,
  });

  if (!isAuthorized) {
    throw new Error("Unauthorized: Cannot update profile.");
  }

  await updatePersonProfileData(personId, updates);

  // Log journey event
  await createJourneyEventRecord(personId, {
    type: "profile_updated",
    title: "Profile updated",
    description: "Updated personal profile information in Tathastu Core.",
  });

  return getPerson360(personId, requesterPersonId);
}
