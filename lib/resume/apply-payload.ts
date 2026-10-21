/**
 * Parses the body of POST /api/resume/[id]/apply: the legacy list of decisions,
 * or the review workspace's canonical payload (workspaceVersion 1) with field
 * edits, additions and the current-education marker. Sizes are capped and
 * anything malformed is rejected as a whole (null).
 */

import type { AdditionInput, DecisionInput } from "@/lib/services/resume-extraction-persistence";
import { RECORD_TYPES, SINGLE_SECTION, summarize, type SavePayload } from "./review-workspace";

const MAX_ITEMS = 1000;
const MAX_ADDITIONS = 200;
const USER_ID = /^user_[a-z0-9_]{1,80}$/i;
const ADDABLE_CATEGORIES = new Set([...Object.values(RECORD_TYPES).map((t) => t.category), "profile", "summary"]);

/** String-to-string map with known-size limits; null when malformed. */
function parseFields(raw: unknown): Record<string, string> | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 20) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!/^[a-zA-Z]{1,40}$/.test(k) || typeof v !== "string") return null;
    out[k] = v.slice(0, 4000);
  }
  return out;
}

export type ParsedApply = { decisions: DecisionInput[]; additions: AdditionInput[]; workspace: SavePayload | null };

export function parseApplyBody(body: unknown): ParsedApply | null {
  const b = body as { decisions?: unknown; additions?: unknown; workspaceVersion?: unknown; currentEducationId?: unknown } | null;
  const raw = b?.decisions;
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS) return null;
  const decisions: DecisionInput[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") return null;
    const { candidateId, state, correctedValue, fields, currentEducation } = d as Record<string, unknown>;
    if (typeof candidateId !== "string" || candidateId.length > 120 || (state !== "confirmed" && state !== "rejected")) return null;
    const f = parseFields(fields);
    if (f === null) return null;
    decisions.push({
      candidateId, state, correctedValue: typeof correctedValue === "string" ? correctedValue.slice(0, 500) : undefined,
      ...(f ? { fields: f } : {}), ...(currentEducation === true ? { currentEducation: true } : {}),
    });
  }
  const isWorkspace = b?.workspaceVersion === 1;
  const additions: AdditionInput[] = [];
  if (b?.additions !== undefined) {
    if (!isWorkspace || !Array.isArray(b.additions) || b.additions.length > MAX_ADDITIONS) return null;
    for (const a of b.additions) {
      if (!a || typeof a !== "object") return null;
      const { id, category, kind, field, fields, currentEducation } = a as Record<string, unknown>;
      const f = parseFields(fields);
      if (typeof id !== "string" || !USER_ID.test(id) || typeof category !== "string" || !ADDABLE_CATEGORIES.has(category) || typeof kind !== "string" || !f) return null;
      if (kind === "single" ? typeof field !== "string" || !SINGLE_SECTION[field] : !(kind in RECORD_TYPES) || RECORD_TYPES[kind as keyof typeof RECORD_TYPES].category !== category) return null;
      additions.push({
        id, category, kind, ...(kind === "single" ? { field: field as string } : {}), fields: f,
        value: summarize(kind as never, f), ...(currentEducation === true ? { currentEducation: true } : {}),
      });
    }
  }
  const currentEducationId = typeof b?.currentEducationId === "string" ? b.currentEducationId : null;
  const workspace: SavePayload | null = isWorkspace
    ? { workspaceVersion: 1, decisions: decisions.map((d) => ({ ...d, correctedValue: d.correctedValue })), additions: additions.map((a) => ({ id: a.id, category: a.category, kind: a.kind as never, field: a.field, fields: a.fields, currentEducation: a.currentEducation })), currentEducationId }
    : null;
  return { decisions, additions, workspace };
}

/**
 * Reads a JSON body of at most maxBytes. A declared length over the limit is
 * refused before the body is read; invalid JSON or an unreadable body is null.
 */
export async function readJsonBodyLimited(request: Request, maxBytes: number): Promise<{ tooLarge: boolean; body: unknown }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { tooLarge: true, body: null };
  const text = await request.text().catch(() => null);
  if (text === null) return { tooLarge: false, body: null };
  if (Buffer.byteLength(text) > maxBytes) return { tooLarge: true, body: null };
  try { return { tooLarge: false, body: JSON.parse(text) }; } catch { return { tooLarge: false, body: null }; }
}
