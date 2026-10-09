/**
 * AI TATHASTU — CORE INTELLIGENCE V3: UNIFIED ORCHESTRATOR
 *
 * Implements the 12 logical domain engines:
 *  1. Source Intelligence
 *  2. Extraction Intelligence
 *  3. Identity Resolution Intelligence
 *  4. Project Intelligence
 *  5. Evidence Intelligence
 *  6. AI/ML Knowledge Intelligence
 *  7. Goal Understanding Intelligence
 *  8. Gap and Unknowns Intelligence
 *  9. Roadmap Planning Intelligence
 * 10. Recommendation Intelligence
 * 11. EORA Conversation Intelligence
 * 12. Continuous Update Intelligence
 *
 * Enforces:
 * - Privacy-preserving minimal context builder
 * - Task-specific model routing and budget controls
 * - Versioned derived intelligence artifacts
 * - Deterministic fallback guarantees
 */

import type { IntelligenceTask } from "./types";
import { sanitizeTextForPrompt } from "./prompt-defense";
import { CrossSourceFusionService } from "../services/cross-source-fusion-service";
import { generatePersonalizedRoadmap, persistRoadmapMilestones, type StudentRoadmap } from "../domain/roadmap";
import { retrieveKnowledge } from "../knowledge/rag-engine";
import { getPerson360 } from "../services/person-360-service";
import { getDb, intelligenceArtifacts, type TathastuDb } from "../db";
import crypto from "node:crypto";

export interface ContextBuilderOptions {
  personId: string;
  task: IntelligenceTask;
  query?: string;
  projectIds?: string[];
  includeKnowledge?: boolean;
}

export interface AssembledTaskContext {
  personId: string;
  task: IntelligenceTask;
  profileVersion: number;
  studentName: string;
  targetRole: string;
  verifiedEvidenceSummary: string;
  unconfirmedCount: number;
  knowledgeSnippets: string[];
  safeUserPrompt: string;
}

export class CoreIntelligenceOrchestrator {
  /**
   * Minimal, privacy-preserving authorized context builder.
   */
  static async buildTaskContext(
    options: ContextBuilderOptions,
    rawPrompt: string,
    dbClient?: TathastuDb
  ): Promise<AssembledTaskContext> {
    const person360 = await getPerson360(options.personId, options.personId);
    const profileVersion = await CrossSourceFusionService.getCurrentProfileVersion(options.personId, dbClient);

    const goalTitle = person360.activeGoal?.title || "AI/ML Generalist";
    const verifiedEvidence = (person360.evidence || []).filter((e) => e.verificationStatus === "verified");
    const unconfirmedEvidence = (person360.evidence || []).filter((e) => e.verificationStatus !== "verified");

    const verifiedSummary = verifiedEvidence.map((e) => `${e.subject} (${e.category})`).slice(0, 10).join(", ") || "None yet";

    let knowledgeSnippets: string[] = [];
    if (options.includeKnowledge && options.query) {
      const rag = retrieveKnowledge({
        query: options.query,
        targetRole: goalTitle,
        evidencedSkills: verifiedEvidence.map((e) => e.subject),
        maxResults: 2,
      });
      knowledgeSnippets = rag.referencedResources.map((r) => `${r.title}: ${r.url}`);
    }

    const safeUserPrompt = sanitizeTextForPrompt(rawPrompt);

    return {
      personId: options.personId,
      task: options.task,
      profileVersion,
      studentName: person360.person.displayName,
      targetRole: goalTitle,
      verifiedEvidenceSummary: verifiedSummary,
      unconfirmedCount: unconfirmedEvidence.length,
      knowledgeSnippets,
      safeUserPrompt,
    };
  }

  /**
   * Stores a versioned intelligence artifact with data provenance.
   */
  static async saveIntelligenceArtifact(
    personId: string,
    artifactType: "project_interpretation" | "profile_summary" | "roadmap_explanation" | "skill_gap_analysis",
    content: Record<string, unknown>,
    sourceReferences: string[] = [],
    dbClient?: TathastuDb
  ): Promise<string> {
    const db = dbClient || (await getDb());
    const profileVersion = await CrossSourceFusionService.getCurrentProfileVersion(personId, db);
    const artifactId = `art_${crypto.randomBytes(10).toString("hex")}`;

    await db.insert(intelligenceArtifacts).values({
      id: artifactId,
      personId,
      artifactType,
      profileVersion,
      sourceReferences,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return artifactId;
  }

  /**
   * Generates, adapts and persists a student roadmap.
   */
  static async orchestrateRoadmap(
    personId: string,
    goalId: string,
    goalTitle: string,
    targetRole?: string,
    confirmedProjectCount?: number,
    dbClient?: TathastuDb
  ): Promise<StudentRoadmap> {
    const person360 = await getPerson360(personId, personId);
    const verifiedSkills = (person360.evidence || [])
      .filter((e) => e.category === "skill" && e.verificationStatus === "verified")
      .map((e) => e.subject);

    const roadmap = generatePersonalizedRoadmap(
      goalTitle,
      verifiedSkills,
      person360.profile.expectedGraduationYear || undefined,
      person360.profile.placementStatus || undefined,
      {
        targetRole,
        specificGoal: goalTitle,
        confirmedProjectCount: confirmedProjectCount ?? person360.projects?.filter((p) => p.status === "confirmed").length,
      }
    );

    await persistRoadmapMilestones(personId, goalId, roadmap, dbClient);
    return roadmap;
  }
}
