/**
 * Global source precedence (Task 1.2.1). When sources disagree on a profile
 * field (graduation year, institution, ...), the highest-precedence source
 * supplies the default and every disagreeing value is kept in
 * source_conflicts for the student to resolve.
 *
 *   resume > github > other_external (linkedin, leetcode, hackerrank, kaggle, scholar) > manual
 *
 * Ties (same tier) go to the most recently observed value. A value the
 * student explicitly typed or corrected is not an observation and is not
 * ranked here: it overrides the resolved default (see completeOnboarding).
 */

export const SOURCE_TIERS = {
  resume: 4,
  github: 3,
  linkedin: 2, leetcode: 2, hackerrank: 2, kaggle: 2, scholar: 2,
  manual: 1,
} as const;

export type RankedSource = keyof typeof SOURCE_TIERS;

export function sourceTier(source: string): number {
  return (SOURCE_TIERS as Record<string, number>)[source] ?? 0;
}

export type FieldObservation = { source: string; value: string | number | null | undefined; observedAt?: Date | string };

export type ResolvedField = {
  value: string | null;
  source: string | null;
  /** Observations whose value differs from the chosen one (normalised comparison). */
  conflicts: { source: string; value: string; observedAt?: Date }[];
};

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const time = (d?: Date | string) => (d ? new Date(d).getTime() : 0);

export function resolveField(observations: FieldObservation[]): ResolvedField {
  const present = observations
    .map((o) => ({ ...o, value: o.value === null || o.value === undefined ? "" : String(o.value).trim() }))
    .filter((o) => o.value !== "");
  if (!present.length) return { value: null, source: null, conflicts: [] };
  const [primary] = [...present].sort((a, b) => sourceTier(b.source) - sourceTier(a.source) || time(b.observedAt) - time(a.observedAt));
  const seen = new Set<string>([norm(primary.value)]);
  const conflicts: ResolvedField["conflicts"] = [];
  for (const o of present) {
    const key = norm(o.value);
    if (seen.has(key)) continue;
    seen.add(key);
    conflicts.push({ source: o.source, value: o.value, observedAt: o.observedAt ? new Date(o.observedAt) : undefined });
  }
  return { value: primary.value, source: primary.source, conflicts };
}
