type DraftState = { completed: boolean } | null;
type PreferenceState = {
  primaryPriority?: string | null;
  metadata?: unknown;
} | null;

export function studentEntryPath(
  draft: DraftState,
  preferences: PreferenceState,
  requested?: string
): string {
  if (draft && !draft.completed) return "/onboarding";
  if (!draft && !preferences?.primaryPriority) return "/onboarding";

  const metadata = preferences?.metadata && typeof preferences.metadata === "object"
    ? preferences.metadata as Record<string, unknown>
    : {};
  if (metadata.requestedRole === "faculty") return "/faculty";

  if (requested && /^\/student(?:\/[a-z0-9_-]+)*$/i.test(requested)) return requested;
  return "/student";
}
