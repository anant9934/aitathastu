/**
 * Evidence-based skill confidence (Task 1.3.1). Deterministic: the same
 * evidence always gives the same score, and every point is traceable to
 * evidence ids in `breakdown`. No placeholder or default numbers: a skill with
 * no evidence has no score.
 *
 *   Tier 1  1.00        Verified     faculty review, or a graded ERIS / AI-interview result
 *   Tier 2  0.80-0.90   Corroborated 2+ independent sources, or a verified platform badge
 *   Tier 3  0.60-0.75   Evidenced    one verifiable artifact (repo/manifest, or a CV line with project context)
 *   Tier 4  0.30-0.50   Declared     self-reported only (onboarding, CV skills list, LinkedIn skills)
 */

export type ConfidenceTier = 1 | 2 | 3 | 4;
export type ConfidenceLabel = "Verified" | "Corroborated" | "Evidenced" | "Declared";

export type ScoringObservation = {
  id: string;
  source: string;      // platform: resume | github | leetcode | hackerrank | kaggle | scholar | linkedin | project | assessment | faculty_verified | certification | self_reported ...
  sourceType: string;  // manifest_declared | source_code | resume_mention | project_applied | personal_contribution | platform_badge | graded_assessment | faculty_verification | self_claim | readme_documented
};

export type ScoringContext = {
  /** Projects (with ids) that apply this skill; repo URLs count as artifacts. */
  projects: { id: string; repositoryUrl?: string | null }[];
  personalContributionConfirmed: boolean;
};

export type ConfidenceBreakdownItem = { factor: string; points: number; evidenceIds: string[] };

export type SkillConfidence = {
  score: number;
  tier: ConfidenceTier;
  label: ConfidenceLabel;
  breakdown: ConfidenceBreakdownItem[];
  /** Distinct independent platforms that observed the skill. */
  independentSources: string[];
};

/** Sources that are the student's own statement, not independent observation. */
const DECLARATIVE_TYPES = new Set(["self_claim"]);
/** Platforms counted as independent of each other for corroboration. */
const INDEPENDENT = new Set(["resume", "github", "leetcode", "hackerrank", "kaggle", "scholar", "project", "certification"]);
// LinkedIn is deliberately absent: its skills are self-declared (Tier 4 at most).

const round2 = (n: number) => Math.round(n * 100) / 100;
const ids = (obs: ScoringObservation[]) => obs.map((o) => o.id);

export function scoreSkillConfidence(observations: ScoringObservation[], ctx: ScoringContext): SkillConfidence | null {
  if (!observations.length && !ctx.projects.length) return null;
  const breakdown: ConfidenceBreakdownItem[] = [];

  // ── Tier 1 ──
  const verified = observations.filter((o) => o.sourceType === "faculty_verification");
  const graded = observations.filter((o) => o.sourceType === "graded_assessment");
  if (verified.length || graded.length) {
    if (verified.length) breakdown.push({ factor: "Verified by faculty review", points: 1, evidenceIds: ids(verified) });
    if (graded.length) breakdown.push({ factor: "Graded assessment result", points: 1, evidenceIds: ids(graded) });
    return { score: 1, tier: 1, label: "Verified", breakdown, independentSources: independentSources(observations, ctx) };
  }

  const substantive = observations.filter((o) => !DECLARATIVE_TYPES.has(o.sourceType));
  const sources = independentSources(observations, ctx);
  const badges = observations.filter((o) => o.sourceType === "platform_badge");

  // ── Tier 2 ──
  if (sources.length >= 2 || badges.length) {
    let score = 0.8;
    breakdown.push(sources.length >= 2
      ? { factor: `Corroborated by ${sources.length} independent sources (${sources.join(", ")})`, points: 0.8, evidenceIds: ids(substantive) }
      : { factor: "Verified platform badge", points: 0.8, evidenceIds: ids(badges) });
    const extra = Math.min(2, Math.max(0, sources.length - 2));
    if (extra) { score += 0.05 * extra; breakdown.push({ factor: `${extra} further independent source${extra > 1 ? "s" : ""}`, points: round2(0.05 * extra), evidenceIds: [] }); }
    if (badges.length && sources.length >= 2 && score < 0.9) { score += 0.05; breakdown.push({ factor: "Also backed by a platform badge", points: 0.05, evidenceIds: ids(badges) }); }
    return { score: round2(Math.min(0.9, score)), tier: 2, label: "Corroborated", breakdown, independentSources: sources };
  }

  // ── Tier 3 ──
  const artifacts = substantive.filter((o) => ["manifest_declared", "source_code", "project_applied", "readme_documented", "personal_contribution"].includes(o.sourceType));
  const cvWithProject = substantive.some((o) => o.sourceType === "resume_mention") && ctx.projects.length > 0;
  if (artifacts.length || cvWithProject || ctx.projects.length) {
    let score = 0.6;
    breakdown.push({ factor: cvWithProject && !artifacts.length ? "CV mention with concrete project context" : "Observed in a verifiable artifact", points: 0.6, evidenceIds: ids(artifacts.length ? artifacts : substantive) });
    const repos = new Set(ctx.projects.map((p) => p.repositoryUrl).filter(Boolean));
    const moreArtifacts = Math.min(2, Math.max(0, Math.max(artifacts.length, repos.size) - 1));
    if (moreArtifacts) { score += 0.05 * moreArtifacts; breakdown.push({ factor: `${moreArtifacts} more artifact${moreArtifacts > 1 ? "s" : ""} from the same source`, points: round2(0.05 * moreArtifacts), evidenceIds: [] }); }
    if (ctx.personalContributionConfirmed) { score += 0.05; breakdown.push({ factor: "Personal contribution confirmed by the student", points: 0.05, evidenceIds: ids(observations.filter((o) => o.sourceType === "personal_contribution")) }); }
    return { score: round2(Math.min(0.75, score)), tier: 3, label: "Evidenced", breakdown, independentSources: sources };
  }

  // ── Tier 4 ──
  const cv = observations.filter((o) => o.sourceType === "resume_mention");
  const claims = observations.filter((o) => o.sourceType === "self_claim");
  let score = cv.length ? 0.45 : 0.35;
  breakdown.push(cv.length
    ? { factor: "Listed on the CV without project context", points: 0.45, evidenceIds: ids(cv) }
    : { factor: "Self-reported", points: 0.35, evidenceIds: ids(claims) });
  if (cv.length && claims.length) { score += 0.05; breakdown.push({ factor: "Also self-reported elsewhere", points: 0.05, evidenceIds: ids(claims) }); }
  return { score: round2(Math.min(0.5, score)), tier: 4, label: "Declared", breakdown, independentSources: sources };
}

function independentSources(observations: ScoringObservation[], ctx: ScoringContext): string[] {
  const set = new Set<string>();
  for (const o of observations) {
    if (DECLARATIVE_TYPES.has(o.sourceType)) continue;
    if (!INDEPENDENT.has(o.source)) continue;
    // A project is only independent evidence when it has a repository; a CV's
    // own project section must not corroborate the same CV's skills list.
    if (o.source === "project") set.add(ctx.projects.some((p) => p.repositoryUrl) ? "github" : "resume");
    else set.add(o.source);
  }
  return [...set].sort();
}
