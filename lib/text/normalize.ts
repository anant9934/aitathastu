/**
 * Lowercase identifier slug: "Machine Learning / AI" -> "machine_learning_ai".
 * Edge separators are deliberately kept ("C++" -> "c_"): evidence import keys
 * built with this must stay byte-identical to keys already stored.
 */
export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

// Words that describe *what kind of thing* a project is rather than which
// project it is. Dropping them lets "Face Recognition System" (from a CV)
// match the "face-recognition" GitHub repo.
const GENERIC_PROJECT_WORDS = new Set([
  "a", "an", "the", "and", "of", "for", "using", "with", "based", "via", "in", "on",
  "project", "system", "app", "application", "tool", "website", "web", "platform", "repo", "repository",
]);

/**
 * Key used to detect the same project arriving from different sources.
 * Splits camelCase and any punctuation/separators, lowercases, drops generic
 * words, and joins what remains. Falls back to the plain slug if every word
 * was generic (e.g. a project literally titled "Web App").
 */
export function normalizeProjectTitle(title: string): string {
  const words = title
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !GENERIC_PROJECT_WORDS.has(w));
  return (meaningful.length ? meaningful : words).join("");
}

/**
 * The project's name without a trailing subtitle: "Pathified (AI Career App)",
 * "Pathified - AI career app", "Pathified: career paths" all -> "pathified".
 * Used only to match a title against another title's full key (Task 1.2.3).
 */
export function baseProjectTitle(title: string): string {
  const head = title.replace(/\s*[([{].*$/, "").split(/\s+[-–—|:]\s+|:\s/)[0] || title;
  return normalizeProjectTitle(head);
}
