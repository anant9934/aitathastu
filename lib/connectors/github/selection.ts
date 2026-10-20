/** The student's saved repository selection (GitHub repository IDs), or null when they never chose. */
export function savedGitHubSelection(metadata: Record<string, unknown> | null | undefined): Set<number> | null {
  const ids = metadata?.githubSelectedRepoIds;
  return Array.isArray(ids) ? new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)) : null;
}
