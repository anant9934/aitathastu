/**
 * Field-level review edits for onboarding draft entries (Task 2.1.4). Pure, so
 * the review screens and the backend tests share one definition.
 *
 * - Edit: change any field; the entry keeps its import key (`originKey`) and
 *   records which fields the student changed (`editedFields`).
 * - Accept / unaccept: status confirmed <-> candidate.
 * - Reject: status "rejected" (projects: "removed"). The entry stays in the
 *   draft, hidden, so a late scraper write does not bring it back.
 * - Add: a new entry the student typed; confirmed, source "manual".
 */
import { DRAFT_ARRAY_KEYS } from "@/lib/onboarding-draft-merge";

export type ReviewField = "education" | "experiences" | "achievements" | "projects" | "techCandidates";
export type ReviewableEntry = { originKey?: string; editedFields?: string[]; status?: string };
type Entry = ReviewableEntry;
const get = (e: Entry, k: string) => (e as Record<string, unknown>)[k];

const REJECTED: Record<ReviewField, string> = {
  education: "rejected", experiences: "rejected", achievements: "rejected", techCandidates: "rejected", projects: "removed",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function editEntry<T extends Entry>(field: ReviewField, prev: T, changes: Partial<T>): T {
  const changed = Object.keys(changes).filter((k) => !same(get(prev, k), get(changes as Entry, k)));
  if (!changed.length) return prev;
  return {
    ...prev,
    ...changes,
    originKey: prev.originKey || DRAFT_ARRAY_KEYS[field](prev),
    editedFields: [...new Set([...(prev.editedFields ?? []), ...changed])],
  };
}

export function rejectEntry<T extends Entry>(field: ReviewField, prev: T): T {
  return { ...prev, status: REJECTED[field], originKey: prev.originKey || DRAFT_ARRAY_KEYS[field](prev) };
}

export function setAccepted<T extends Entry>(prev: T, accepted: boolean): T {
  return { ...prev, status: accepted ? "confirmed" : "candidate" };
}

export function isRejected(field: ReviewField, entry: object) {
  return (entry as Entry).status === REJECTED[field];
}

/** Entries the student should see: everything except their own rejections. */
export function visibleEntries<T extends Entry>(field: ReviewField, list: T[]): T[] {
  return list.filter((e) => !isRejected(field, e));
}

/** Same entry? Compared by merge key, so it survives edits. */
export function sameEntry(field: ReviewField, a: object, b: object) {
  return DRAFT_ARRAY_KEYS[field](a) === DRAFT_ARRAY_KEYS[field](b);
}

/** Replaces `target` (matched by merge key) with `next` in `list`. */
export function replaceEntry<T extends Entry>(field: ReviewField, list: T[], target: T, next: T): T[] {
  return list.map((e) => (sameEntry(field, e, target) ? next : e));
}

/** Is `incoming` already in `list`? By merge key, so edited and rejected entries count. */
export function hasEntry(field: ReviewField, list: object[], incoming: object) {
  return list.some((e) => sameEntry(field, e, incoming));
}

/**
 * Entries the student accepted from a newly uploaded CV, merged into the
 * current list: confirmed entries and rejection tombstones are kept, stale
 * suggestions are dropped, an explicit acceptance replaces a tombstone of the
 * same entry, and nothing already present (edits included) is added twice.
 */
export function mergeAccepted<T extends Entry>(field: ReviewField, current: T[], incoming: T[]): T[] {
  const out = current.filter((e) =>
    e.status === "confirmed" || (isRejected(field, e) && !incoming.some((i) => sameEntry(field, e, i))));
  for (const entry of incoming) if (!hasEntry(field, out, entry)) out.push(entry);
  return out;
}

/** Did the student reject or rename this entry? Then a re-import must not add it again. */
export function isSuppressed(field: ReviewField, list: object[], incoming: object) {
  return (list as Entry[]).some((e) => (isRejected(field, e) || Boolean(e.editedFields?.length)) && sameEntry(field, e, incoming));
}

/** Stable identity for rendering and undo: the merge key, unchanged by edits and rejections. */
export function entryKey(field: ReviewField, entry: object) {
  return DRAFT_ARRAY_KEYS[field](entry);
}
