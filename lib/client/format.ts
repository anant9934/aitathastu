/** One date style across the app, e.g. "16 Oct 2026". */
export function formatDate(iso?: string | null, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", withTime ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
}

/** "github profile" -> "GitHub profile"; leaves already-cased text alone. */
export function sentenceCase(s: string): string {
  const fixed = s.replace(/\bgithub\b/gi, "GitHub").replace(/\blinkedin\b/gi, "LinkedIn").replace(/\bcv\b/g, "CV");
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}
