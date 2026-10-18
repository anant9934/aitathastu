import { resolveField, type FieldObservation, type ResolvedField } from "@/lib/domain/source-precedence";
/**
 * AI TATHASTU — CORE INTELLIGENCE V3: CROSS-SOURCE FUSION & CONFLICT SERVICE
 *
 * Implements:
 * 1. Entity resolution & semantic matching across Resume, GitHub, Portfolio & Onboarding
 * 2. Cross-source conflict detection (e.g. CV graduation year vs declared year)
 * 3. Canonical project deduplication with multi-source preservation
 * 4. Profile versioning ledger (increments version and stores snapshot)
 * 5. Trust state lifecycle management
 */

import crypto from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import {
  getDb,
  sourceConflicts,
  personProfileVersions,
  type TathastuDb,
} from "@/lib/db";

export interface CandidateProjectMatch {
  title: string;
  source: string; // 'resume' | 'github' | 'portfolio'
  repositoryUrl?: string;
  technologies: string[];
  description?: string;
}

export interface FusionMatchResult {
  isMatch: boolean;
  confidence: number;
  matchReason: string;
  suggestedTitle: string;
  combinedSources: string[];
  combinedTechnologies: string[];
}

export class CrossSourceFusionService {
  /**
   * Evaluates if two project references from different sources represent the same project.
   */
  static matchProjects(a: CandidateProjectMatch, b: CandidateProjectMatch): FusionMatchResult {
    // 1. Direct match on repository URL
    if (a.repositoryUrl && b.repositoryUrl) {
      const cleanA = a.repositoryUrl.toLowerCase().replace(/\.git$/, "").replace(/\/$/, "");
      const cleanB = b.repositoryUrl.toLowerCase().replace(/\.git$/, "").replace(/\/$/, "");
      if (cleanA === cleanB) {
        return {
          isMatch: true,
          confidence: 0.99,
          matchReason: "Matching canonical repository URL",
          suggestedTitle: a.title.length >= b.title.length ? a.title : b.title,
          combinedSources: Array.from(new Set([a.source, b.source])),
          combinedTechnologies: Array.from(new Set([...a.technologies, ...b.technologies])),
        };
      }
    }

    // 2. Normalized slug matching (e.g., 'smart-attendance-ai' and 'Smart Attendance AI')
    const slugA = a.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const slugB = b.title.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (slugA && slugB && (slugA === slugB || slugA.includes(slugB) || slugB.includes(slugA))) {
      // Check shared technologies to prevent false positives for generic names
      const techA = new Set(a.technologies.map((t) => t.toLowerCase()));
      const techB = new Set(b.technologies.map((t) => t.toLowerCase()));
      const intersection = [...techA].filter((t) => techB.has(t));

      const sharedRatio = intersection.length / Math.max(1, Math.min(techA.size, techB.size));
      if (intersection.length >= 1 || sharedRatio > 0.3) {
        return {
          isMatch: true,
          confidence: 0.85,
          matchReason: `Title similarity with shared technologies (${intersection.join(", ")})`,
          suggestedTitle: a.title.length >= b.title.length ? a.title : b.title,
          combinedSources: Array.from(new Set([a.source, b.source])),
          combinedTechnologies: Array.from(new Set([...a.technologies, ...b.technologies])),
        };
      }
    }

    return {
      isMatch: false,
      confidence: 0,
      matchReason: "Insufficient similarity between project records",
      suggestedTitle: a.title,
      combinedSources: [a.source],
      combinedTechnologies: a.technologies,
    };
  }

  /**
   * Detects and records conflicts between newly extracted data and existing profile data.
   */
  static async recordConflictIfDifferent(
    personId: string,
    field: string,
    sourceA: string,
    valueA: string,
    sourceB: string,
    valueB: string,
    dbClient?: TathastuDb
  ): Promise<boolean> {
    if (!valueA || !valueB) return false;
    if (valueA.trim().toLowerCase() === valueB.trim().toLowerCase()) return false;

    const db = dbClient || (await getDb());
    const existing = await db
      .select()
      .from(sourceConflicts)
      .where(
        and(
          eq(sourceConflicts.personId, personId),
          eq(sourceConflicts.field, field),
          eq(sourceConflicts.status, "detected"),
          // One row per disagreeing (source, value), so several conflicts on
          // one field are all kept and a replayed sync does not duplicate them.
          eq(sourceConflicts.sourceB, sourceB),
          eq(sourceConflicts.valueB, valueB)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(sourceConflicts).values({
        id: `conf_${crypto.randomBytes(8).toString("hex")}`,
        personId,
        field,
        sourceA,
        valueA,
        observedAtA: new Date(),
        sourceB,
        valueB,
        observedAtB: new Date(),
        status: "detected",
      });
      return true;
    }
    return false;
  }

  /**
   * Resolves one profile field across sources by global precedence
   * (lib/domain/source-precedence.ts) and records every disagreeing value
   * against the chosen one in source_conflicts (Task 1.2.1).
   */
  static async resolveProfileField(personId: string, field: string, observations: FieldObservation[], dbClient?: TathastuDb): Promise<ResolvedField> {
    const resolved = resolveField(observations);
    if (resolved.value && resolved.source) {
      for (const c of resolved.conflicts) {
        await CrossSourceFusionService.recordConflictIfDifferent(personId, field, resolved.source, resolved.value, c.source, c.value, dbClient);
      }
    }
    return resolved;
  }

  /**
   * Records a new immutable version in the Person 360 profile version ledger.
   */
  static async recordProfileVersion(
    personId: string,
    changeType: "onboarding" | "resume_review" | "project_confirmed" | "goal_updated" | "evidence_added" | "profile_edited",
    changeSummary: string,
    snapshot: Record<string, unknown>,
    dbClient?: TathastuDb
  ): Promise<number> {
    const db = dbClient || (await getDb());
    const latest = await db
      .select({ versionNumber: personProfileVersions.versionNumber })
      .from(personProfileVersions)
      .where(eq(personProfileVersions.personId, personId))
      .orderBy(desc(personProfileVersions.versionNumber))
      .limit(1);

    const nextVersion = (latest[0]?.versionNumber ?? 0) + 1;

    await db.insert(personProfileVersions).values({
      id: `ver_${crypto.randomBytes(10).toString("hex")}`,
      personId,
      versionNumber: nextVersion,
      changeType,
      changeSummary,
      snapshot,
    });

    return nextVersion;
  }

  /**
   * Retrieves the current profile version number for a person.
   */
  static async getCurrentProfileVersion(personId: string, dbClient?: TathastuDb): Promise<number> {
    const db = dbClient || (await getDb());
    const latest = await db
      .select({ versionNumber: personProfileVersions.versionNumber })
      .from(personProfileVersions)
      .where(eq(personProfileVersions.personId, personId))
      .orderBy(desc(personProfileVersions.versionNumber))
      .limit(1);

    return latest[0]?.versionNumber ?? 1;
  }

  /**
   * Cross-source deduplication and fusion for Project candidates.
   * Matches Resume projects with GitHub projects while preserving both sources and claims.
   */
  static fuseProjectCandidates(
    resumeProjects: CandidateProjectMatch[],
    githubProjects: CandidateProjectMatch[]
  ): Array<{
    project: CandidateProjectMatch;
    isFused: boolean;
    matchResult?: FusionMatchResult;
  }> {
    const fusedList: Array<{
      project: CandidateProjectMatch;
      isFused: boolean;
      matchResult?: FusionMatchResult;
    }> = [];

    const matchedGithubIndices = new Set<number>();

    for (const resProj of resumeProjects) {
      let matched = false;
      for (let gIdx = 0; gIdx < githubProjects.length; gIdx++) {
        if (matchedGithubIndices.has(gIdx)) continue;
        const ghProj = githubProjects[gIdx];
        const matchRes = this.matchProjects(resProj, ghProj);
        if (matchRes.isMatch) {
          matchedGithubIndices.add(gIdx);
          matched = true;
          fusedList.push({
            project: {
              title: matchRes.suggestedTitle,
              source: "resume+github",
              repositoryUrl: ghProj.repositoryUrl || resProj.repositoryUrl,
              technologies: matchRes.combinedTechnologies,
              description: resProj.description || ghProj.description,
            },
            isFused: true,
            matchResult: matchRes,
          });
          break;
        }
      }

      if (!matched) {
        fusedList.push({
          project: resProj,
          isFused: false,
        });
      }
    }

    // Add remaining distinct GitHub projects
    for (let gIdx = 0; gIdx < githubProjects.length; gIdx++) {
      if (!matchedGithubIndices.has(gIdx)) {
        fusedList.push({
          project: githubProjects[gIdx],
          isFused: false,
        });
      }
    }

    return fusedList;
  }

  /**
   * Universal multi-source project fusion across CV, GitHub, GitLab, Kaggle, Hugging Face, Portfolio.
   * Matches projects by canonical repository URL, demo link, or normalized title + technology similarity.
   * Never overwrites confirmed resume details with weaker scraped claims; combines consistent fields.
   */
  static fuseMultiSourceProjects(
    allProjects: CandidateProjectMatch[]
  ): Array<{
    project: CandidateProjectMatch;
    isFused: boolean;
    allSources: string[];
    matchResults: FusionMatchResult[];
  }> {
    const results: Array<{
      project: CandidateProjectMatch;
      isFused: boolean;
      allSources: string[];
      matchResults: FusionMatchResult[];
    }> = [];

    for (const incoming of allProjects) {
      let matchedIndex = -1;
      let matchedResult: FusionMatchResult | null = null;

      for (let i = 0; i < results.length; i++) {
        const existing = results[i].project;
        const res = this.matchProjects(existing, incoming);
        if (res.isMatch) {
          matchedIndex = i;
          matchedResult = res;
          break;
        }
      }

      if (matchedIndex >= 0 && matchedResult) {
        const target = results[matchedIndex];
        target.isFused = true;
        target.allSources = Array.from(new Set([...target.allSources, incoming.source]));
        target.matchResults.push(matchedResult);
        target.project.title = matchedResult.suggestedTitle;
        target.project.source = target.allSources.join("+");
        target.project.repositoryUrl = target.project.repositoryUrl || incoming.repositoryUrl;
        target.project.technologies = matchedResult.combinedTechnologies;
        // Never overwrite accepted CV details with weaker scraped claims
        if (!target.project.description || (incoming.source === "resume" && incoming.description)) {
          target.project.description = incoming.description;
        }
      } else {
        results.push({
          project: { ...incoming },
          isFused: false,
          allSources: [incoming.source],
          matchResults: [],
        });
      }
    }

    return results;
  }
}

export function fuseMultiSourceProjects(
  allProjects: CandidateProjectMatch[]
) {
  return CrossSourceFusionService.fuseMultiSourceProjects(allProjects);
}


