/**
 * Per-source review controls (Task 2.1.5): show one source's contributions,
 * accept them all, remove them, or (GitHub) exclude forks. Pure, so the
 * review screen and the backend tests share one definition.
 *
 * Removing a source never loses data another source still backs: a project
 * also found in the CV keeps its CV source and stays; only entries that came
 * from the removed source alone are rejected (hidden tombstones, so a later
 * sync does not re-add them). Entries the student edited are kept: the edit
 * makes them the student's own.
 */
import { isRejected, rejectEntry, type ReviewField } from "./entry-edits";

type Entry = { source?: string; sources?: string[]; status?: string; editedFields?: string[]; isFork?: boolean };

const ALIASES: Record<string, string> = {
  resume_extracted: "resume", cv: "resume", "digital import": "imported", "source: resume": "resume",
};

export function normalizeSource(source?: string | null): string {
  const s = (source ?? "").trim().toLowerCase();
  if (!s) return "imported";
  return ALIASES[s] ?? s.replace(/^source:\s*/, "");
}

/** Every source that contributed this entry, normalised and de-duplicated. */
export function entrySources(entry: object): string[] {
  const e = entry as Entry;
  const raw = e.sources?.length ? e.sources : [e.source];
  return [...new Set(raw.map(normalizeSource))];
}

export const fromSource = (entry: object, source: string) => entrySources(entry).includes(source);

/** Visible (not rejected) entries per source across every review list. */
export function countBySource(lists: Partial<Record<ReviewField, object[]>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [field, list] of Object.entries(lists) as [ReviewField, object[]][]) {
    for (const entry of list ?? []) {
      if (isRejected(field, entry)) continue;
      for (const s of entrySources(entry)) counts[s] = (counts[s] ?? 0) + 1;
    }
  }
  return counts;
}

export type SourceActionResult<T> = { next: T[]; changed: number; keptEdited: number; keptShared: number };

/** Accept every still-suggested entry this source contributed. */
export function acceptAllFrom<T extends object>(field: ReviewField, list: T[], source: string): SourceActionResult<T> {
  let changed = 0;
  const next = list.map((e) => {
    const entry = e as Entry;
    if (isRejected(field, e) || entry.status === "confirmed" || !fromSource(e, source)) return e;
    changed++;
    return { ...e, status: "confirmed" };
  });
  return { next, changed, keptEdited: 0, keptShared: 0 };
}

/** Remove one source's contribution; see the module note for what is kept. */
export function removeSource<T extends object>(field: ReviewField, list: T[], source: string): SourceActionResult<T> {
  let changed = 0, keptEdited = 0, keptShared = 0;
  const next = list.map((e) => {
    const entry = e as Entry;
    if (isRejected(field, e) || !fromSource(e, source)) return e;
    if (entry.editedFields?.length) { keptEdited++; return e; }
    const others = entrySources(e).filter((s) => s !== source);
    if (others.length && entry.sources?.length) {
      // Still backed by another source: drop only this source's claim.
      keptShared++;
      return { ...e, sources: entry.sources.filter((s) => normalizeSource(s) !== source) };
    }
    changed++;
    return rejectEntry(field, e as T & { status?: string });
  });
  return { next, changed, keptEdited, keptShared };
}

/** GitHub only: reject forks of other people's repositories that the student has not edited. */
export function excludeForks<T extends object>(list: T[]): SourceActionResult<T> {
  let changed = 0, keptEdited = 0;
  const next = list.map((e) => {
    const entry = e as Entry;
    if (!entry.isFork || isRejected("projects", e)) return e;
    if (entry.editedFields?.length) { keptEdited++; return e; }
    changed++;
    return rejectEntry("projects", e as T & { status?: string });
  });
  return { next, changed, keptEdited, keptShared: 0 };
}

export const countForks = (list: object[]) => list.filter((e) => (e as Entry).isFork && !isRejected("projects", e)).length;
