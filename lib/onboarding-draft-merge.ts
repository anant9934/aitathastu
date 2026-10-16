/**
 * Merge rules for concurrent writers of one onboarding draft (Task 1.2.4).
 *
 * Two kinds of writer touch a draft:
 *  - "user":   the onboarding form's autosave. It is authoritative: scalars it
 *              sends overwrite, arrays it sends replace (that is how the user
 *              removes an entry). The one exception: entries a system writer
 *              added after the revision the client last saw (`baseRevision`)
 *              are kept, because the client cannot have meant to remove
 *              something it never displayed.
 *  - "system": scrapers and extraction jobs (resume, GitHub, LinkedIn, ...).
 *              They never overwrite what is already there: scalars are only
 *              filled when empty, arrays are unioned by entry key with the
 *              existing entry winning over the incoming one.
 *
 * `systemEntries` records, per array field, which entry keys a system writer
 * added and at which revision. It lives in its own column so it never leaks
 * into the draft shape the client sees.
 */

export type DraftWriteOrigin = "user" | "system";
export type SystemEntryLedger = Record<string, Record<string, number>>;

type Entry = Record<string, unknown>;
const lc = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

/**
 * An entry the student edited keeps the key it was imported under
 * (`originKey`, Task 2.1.4), so a scraper re-sending the original is
 * recognised as the same entry instead of re-added beside the edit.
 */
const byOrigin = (keyOf: (e: unknown) => string) => (e: unknown) => lc((e as Entry)?.originKey) || keyOf(e);

/** Array fields of the draft, and how one entry of each is identified. */
export const DRAFT_ARRAY_KEYS: Record<string, (entry: unknown) => string> = {
  projects: byOrigin((e) => lc((e as Entry)?.id) || lc((e as Entry)?.title)),
  education: byOrigin((e) => `${lc((e as Entry)?.institution)}|${lc((e as Entry)?.degree)}`),
  experiences: byOrigin((e) => `${lc((e as Entry)?.company)}|${lc((e as Entry)?.role)}`),
  achievements: byOrigin((e) => lc((e as Entry)?.candidateId) || lc((e as Entry)?.title)),
  techCandidates: byOrigin((e) => lc((e as Entry)?.name)),
  certificationSuggestions: (e) => lc((e as Entry)?.title),
  resumeReviewed: (e) => lc((e as Entry)?.candidateId) || `${lc((e as Entry)?.category)}|${lc((e as Entry)?.value)}`,
  skills: lc,
  certifications: lc,
  acceptedResumeSkills: lc,
  priorities: lc,
  resumeCoveredScreens: (e) => String(e),
};

/**
 * Extra identities: an entry also matches another that shares any of these
 * keys. Projects: the CV import and the student's acceptance of the same
 * project carry different ids but the same title (Task 2.1.2), the way the
 * projects table already matches by normalized title.
 */
export const DRAFT_ARRAY_ALT_KEYS: Record<string, (entry: unknown) => string[]> = {
  projects: (e) => [lc((e as Entry)?.title).replace(/\s+/g, " ")].filter(Boolean),
};

/** Object fields merged one level deep (keys inside are scalars). */
const DRAFT_OBJECT_KEYS = new Set(["profiles", "discoveredResumeProfiles", "resumeSuggestions"]);

function isEmptyScalar(value: unknown) {
  return value === undefined || value === null || value === "" || value === false;
}

function unionByKey(existing: unknown[], incoming: unknown[], keyOf: (e: unknown) => string, altKeysOf: (e: unknown) => string[] = () => []) {
  const out = [...existing];
  const identities = (e: unknown) => [keyOf(e), ...altKeysOf(e)].filter(Boolean);
  const seen = new Set(existing.flatMap(identities));
  const added: string[] = [];
  for (const entry of incoming) {
    const key = keyOf(entry);
    const ids = identities(entry);
    if (!key || ids.some((id) => seen.has(id))) continue;
    ids.forEach((id) => seen.add(id));
    out.push(entry);
    added.push(key);
  }
  return { out, added };
}

export type MergeResult = {
  draft: Record<string, unknown>;
  systemEntries: SystemEntryLedger;
  changed: boolean;
};

/**
 * Applies `patch` to `current`. `nextRevision` is the revision the merged
 * draft will be stored under; it stamps entries a system writer adds.
 */
export function mergeDraftPatch(params: {
  current: Record<string, unknown>;
  patch: Record<string, unknown>;
  origin: DraftWriteOrigin;
  systemEntries: SystemEntryLedger;
  nextRevision: number;
  baseRevision?: number;
}): MergeResult {
  const { current, patch, origin, nextRevision, baseRevision } = params;
  const draft: Record<string, unknown> = { ...current };
  const ledger: SystemEntryLedger = JSON.parse(JSON.stringify(params.systemEntries || {}));
  let changed = false;

  for (const [field, value] of Object.entries(patch)) {
    if (field === "version") continue;
    const keyOf = DRAFT_ARRAY_KEYS[field];

    if (keyOf && Array.isArray(value)) {
      const existing = Array.isArray(current[field]) ? (current[field] as unknown[]) : [];
      if (origin === "system") {
        const { out, added } = unionByKey(existing, value, keyOf, DRAFT_ARRAY_ALT_KEYS[field]);
        if (added.length) {
          draft[field] = out;
          ledger[field] = { ...(ledger[field] || {}) };
          for (const key of added) ledger[field][key] = nextRevision;
          changed = true;
        }
        continue;
      }
      // User replace, keeping system entries the client never saw.
      const fieldLedger = ledger[field] || {};
      const unseen = baseRevision === undefined
        ? []
        : existing.filter((entry) => {
            const addedAt = fieldLedger[keyOf(entry)];
            return addedAt !== undefined && addedAt > baseRevision;
          });
      const { out } = unionByKey(value, unseen, keyOf, DRAFT_ARRAY_ALT_KEYS[field]);
      // Entries the user dropped are no longer system-owned.
      const kept = new Set(out.map(keyOf));
      ledger[field] = Object.fromEntries(Object.entries(fieldLedger).filter(([key]) => kept.has(key)));
      draft[field] = out;
      changed = true;
      continue;
    }

    if (DRAFT_OBJECT_KEYS.has(field) && value && typeof value === "object" && !Array.isArray(value)) {
      const existing = (current[field] && typeof current[field] === "object" ? current[field] : {}) as Entry;
      const next: Entry = { ...existing };
      for (const [k, v] of Object.entries(value as Entry)) {
        if (origin === "system" && !isEmptyScalar(existing[k])) continue;
        if (next[k] !== v) changed = true;
        next[k] = v;
      }
      draft[field] = next;
      continue;
    }

    if (origin === "system" && !isEmptyScalar(current[field])) continue;
    if (draft[field] !== value) changed = true;
    draft[field] = value;
  }

  return { draft, systemEntries: ledger, changed };
}
