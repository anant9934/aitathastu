/**
 * AI TATHASTU — DASHBOARD SERVICE
 * 
 * Canonical server-side orchestration for the personalized 5-section student dashboard.
 * Unifies Person 360, verified evidence, user preferences, and the 96-configuration
 * domain personalization engine.
 */

import { getPerson360 } from "./person-360-service";
import { eq } from "drizzle-orm";
import { getDb, projects } from "@/lib/db";
import { getSyncStatus } from "@/lib/sync/runners";
import { composeDashboardLayout, type DashboardLayout, type DashboardLayoutInput, type FootprintSource } from "@/lib/domain/dashboard-layout";
import { roleGoalTitle } from "@/lib/domain/role-goal";
import {
  composePersonalizedDashboard,
  normalizeInterest,
  type CanonicalInterest,
  type ComposedDashboardViewModel,
  type StudentPersonalizationContext,
  type ProjectRecord,
} from "../domain/personalization-engine";
import { AIML_ROLE_CATALOG } from "../domain/aiml-role-taxonomy";
import type { EvidenceItem, EvidenceCategory, VerificationStatus, EvidenceSource } from "../domain/evidence";
import { calculateReadiness } from "../domain/readiness";

export interface DashboardCompositionOptions {
  primary?: string | null;
  secondary?: string[];
  role?: string;
  roleId?: string;
  goal?: string;
  name?: string;
}

function resolveRoleId(roleTitleOrId?: string): string {
  if (!roleTitleOrId) return "exploring_aiml";
  const cleaned = roleTitleOrId.toLowerCase().trim();
  const matchedById = AIML_ROLE_CATALOG.find((r) => r.id === cleaned);
  if (matchedById) return matchedById.id;
  const matchedByTitle = AIML_ROLE_CATALOG.find((r) => r.title.toLowerCase() === cleaned);
  if (matchedByTitle) return matchedByTitle.id;
  if (cleaned.includes("genai") || cleaned.includes("generative")) return "genai_engineer";
  if (cleaned.includes("ml") || cleaned.includes("machine learning")) return "ml_engineer";
  if (cleaned.includes("research")) return "ai_researcher";
  if (cleaned.includes("vision")) return "computer_vision_engineer";
  if (cleaned.includes("nlp")) return "nlp_engineer";
  return "exploring_aiml";
}

/**
 * Produces the canonical composed dashboard view model for an authenticated student.
 */
export async function getStudentDashboardComposition(
  personId: string,
  options?: DashboardCompositionOptions
): Promise<ComposedDashboardViewModel> {
  const person360 = await getPerson360(personId, personId);

  const rawMetadata = (person360.preferences?.metadata as Record<string, unknown>) || {};
  const targetRole =
    options?.role ||
    (rawMetadata.targetRole as string) ||
    person360.profile?.specialization ||
    "Still Exploring AI & ML";

  const targetRoleId =
    options?.roleId ||
    (rawMetadata.targetRoleId as string) ||
    resolveRoleId(targetRole);

  // The target role is the goal; onboarding no longer asks a separate goal or timeline (Task 2.1.1).
  const goal =
    options?.goal ||
    person360.activeGoal?.title ||
    (targetRole ? roleGoalTitle(targetRole) : "Choose your AI/ML direction");

  // Priority resolution: explicit query option > saved preference > default "learning"
  const rawPrimary =
    options?.primary !== undefined
      ? options.primary
      : person360.preferences?.primaryPriority;
  const primaryInterest: CanonicalInterest = normalizeInterest(rawPrimary);

  let secondaryInterests: CanonicalInterest[] = [];
  if (options?.secondary !== undefined) {
    secondaryInterests = options.secondary
      .map((s) => normalizeInterest(s))
      .filter((s) => s !== primaryInterest);
  } else if (person360.preferences?.secondaryPriorities) {
    secondaryInterests = person360.preferences.secondaryPriorities
      .map((s) => normalizeInterest(s))
      .filter((s) => s !== primaryInterest);
  }
  // Deduplicate and cap to 2
  secondaryInterests = Array.from(new Set(secondaryInterests)).slice(0, 2);

  // Extract skills from evidence ledger deduplicated by normalized name (representing unique tracked skills)
  const uniqueSkillsMap = new Map<string, { name: string; category?: string; verificationStatus: string; source?: string }>();
  for (const e of (person360.evidence || []).filter((e) => e.category === "skill")) {
    const rawName = (e.subject || e.value || "").trim();
    if (!rawName) continue;
    const norm = rawName.toLowerCase();
    const existing = uniqueSkillsMap.get(norm);
    if (!existing || (e.verificationStatus === "verified" && existing.verificationStatus !== "verified")) {
      uniqueSkillsMap.set(norm, {
        name: rawName,
        category: e.category,
        verificationStatus: e.verificationStatus,
        source: e.source,
      });
    }
  }

  // Also include skills demonstrated in confirmed projects to maintain canonical alignment with PersonGraph
  for (const p of (person360.projects || []).filter((p) => p.status === "confirmed")) {
    for (const tech of (p.technologies || [])) {
      const rawName = (tech || "").trim();
      if (!rawName) continue;
      const norm = rawName.toLowerCase();
      if (!uniqueSkillsMap.has(norm)) {
        uniqueSkillsMap.set(norm, {
          name: rawName,
          category: "project_technology",
          verificationStatus: "unverified",
          source: "project",
        });
      }
    }
  }
  const skills = Array.from(uniqueSkillsMap.values());

  // Map projects
  const projects: ProjectRecord[] = (person360.projects || []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    technologies: p.technologies || [],
    sources: p.sources || ["manual"],
    status: p.status,
  }));

  // Map full evidence items
  const evidenceItems: EvidenceItem[] = (person360.evidence || []).map((e) => ({
    id: e.id,
    category: (e.category as EvidenceCategory) || "skill",
    subject: e.subject,
    value: e.value,
    verificationStatus: (e.verificationStatus as VerificationStatus) || "unverified",
    source: (["self_reported", "resume_extracted", "institutional", "imported", "verified", "ai_inferred"].includes(e.source)
      ? e.source
      : "imported") as EvidenceSource,
    sourceReference: e.sourceReference,
    observedAt: e.observedAt,
    createdAt: e.observedAt,
    interpretation: e.interpretation || e.subject,
    whyItMatters: e.whyItMatters || "Recorded in student evidence ledger.",
  }));

  // Defensible, mathematically grounded readiness calculation using active versioned readiness policy
  const readinessResult = calculateReadiness(
    { id: person360.activeGoal?.id, title: goal },
    evidenceItems
  );

  const verifiedReadinessScore =
    readinessResult.publishable && readinessResult.score !== undefined
      ? readinessResult.score
      : null;
  const isReadinessAvailable = readinessResult.publishable && readinessResult.score !== undefined;

  // Resolve institution with fallback to profile.education string or education evidence
  let resolvedInstitution = person360.profile?.institution?.trim() || "";
  if (!resolvedInstitution && person360.profile?.education) {
    const parts = person360.profile.education.split("·").map((s) => s.trim());
    const instPart = parts.find((p) => /university|college|institute|iit|nit|iiit|bits|lpu/i.test(p));
    if (instPart) resolvedInstitution = instPart;
  }
  if (!resolvedInstitution) {
    const eduEvidence = (person360.evidence || []).find((e) => e.category === "education");
    if (eduEvidence) {
      const parts = (eduEvidence.value || eduEvidence.subject || "").split("·").map((s) => s.trim());
      const instPart = parts.find((p) => /university|college|institute|iit|nit|iiit|bits|lpu/i.test(p));
      resolvedInstitution = instPart || eduEvidence.subject || "";
    }
  }

  const context: StudentPersonalizationContext = {
    personId,
    name: options?.name || person360.person.displayName || "Student",
    targetRole,
    targetRoleId,
    goal,
    primaryInterest,
    secondaryInterests,
    degree: person360.profile?.degree || "",
    institution: resolvedInstitution,
    cohort: person360.profile?.expectedGraduationYear || undefined,
    skills,
    projects,
    evidenceItems,
    journeyEvents: (person360.journeySummary || []).map((event) => ({ title: event.title, description: event.description, timestamp: event.timestamp })),
    verifiedReadinessScore,
    isReadinessAvailable,
    isDemo: false,
  };

  const composed = composePersonalizedDashboard(context);
  composed.layout = await buildDashboardLayout(personId, {
    primary: primaryInterest, secondary: secondaryInterests, targetRole,
    readiness: verifiedReadinessScore,
    skillGaps: composed.skillMap.nodes.filter((n) => n.status === "Gap Target" || n.status === "To Demonstrate").map((n) => n.label),
    learning: (composed.growthSection?.recommendedLearning ?? []).map((l) => ({ title: l.title })),
    publications: (person360.evidence || []).filter((e) => e.category === "publication").length,
  });
  return composed;
}

/** Real per-source state and ledger projects for the priority-shaped layout (Tasks 2.3.1, 2.3.2). */
async function buildDashboardLayout(
  personId: string,
  base: Omit<DashboardLayoutInput, "projects" | "footprints">
): Promise<DashboardLayout> {
  const db = await getDb();
  const [rows, status] = await Promise.all([
    db.select({ id: projects.id, title: projects.title, portfolioIncluded: projects.portfolioIncluded, updatedAt: projects.updatedAt, sources: projects.sources, status: projects.status })
      .from(projects).where(eq(projects.personId, personId)),
    getSyncStatus(personId),
  ]);
  const footprints: DashboardLayoutInput["footprints"] = {};
  for (const s of status.sources) {
    if (s.source === "resume") continue;
    footprints[s.source as FootprintSource] = { connected: s.state !== "not_started" && s.state !== "skipped_optional", state: s.state, found: ("found" in s ? (s.found as string | null) : null) ?? null };
  }
  return composeDashboardLayout({
    ...base,
    projects: rows.filter((p) => p.status !== "archived" && p.status !== "removed").map((p) => ({ id: p.id, title: p.title, portfolioIncluded: p.portfolioIncluded, updatedAt: p.updatedAt.toISOString(), sources: (p.sources as string[]) ?? [] })),
    footprints,
  });
}

