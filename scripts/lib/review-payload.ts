/**
 * Builds the review payload POST /api/resume/[id]/apply accepts (the review
 * workspace format) for scripts that drive the API: the candidates the script
 * chooses are ticked, and the mandatory profile fields are completed with
 * synthetic test values only where the fixture does not already supply them.
 */
import {
  addRecord, buildWorkspace, mandatoryProblems, serializeWorkspace, setCurrentEducation, setSelected, setValue, validateValue,
  type CandidateLike, type SavePayload, type Workspace,
} from "../../lib/resume/review-workspace";

const TEST_VALUES = { fullName: "Test Student", email: "test.student@example.test", githubUrl: "https://github.com/test-student" };
const TEST_EDUCATION: Record<string, string> = {
  degree: "B.Tech", institution: "Test Institute of Technology", fieldOfStudy: "Computer Science", startDate: "2022", status: "Pursuing", endDate: `May ${new Date().getUTCFullYear() + 1}`,
};

export function reviewPayload(candidates: CandidateLike[], confirm: (c: CandidateLike) => boolean = () => true): SavePayload & Record<string, unknown> {
  let ws: Workspace = buildWorkspace(candidates);
  for (const c of candidates) {
    const item = ws.items.find((i) => (i.linkedCandidateId ?? i.id) === c.candidateId);
    if (item) ws = setSelected(ws, item.id, confirm(c));
  }
  for (const p of mandatoryProblems(ws)) {
    if (p.field in TEST_VALUES && p.itemId) {
      const kind = p.field === "email" ? "email" : p.field === "githubUrl" ? "github" : "text";
      const current = ws.items.find((i) => i.id === p.itemId)?.values.value ?? "";
      // A value read from the CV is only ticked; a missing or invalid one gets the synthetic value.
      if (!current.trim() || validateValue(kind, current)) ws = setValue(ws, p.itemId, "value", TEST_VALUES[p.field as keyof typeof TEST_VALUES]);
      ws = setSelected(ws, p.itemId, true);
    }
  }
  if (!ws.currentEducationId) ws = addRecord(ws, "education").ws;
  const cur = ws.currentEducationId!;
  ws = setCurrentEducation(setSelected(ws, cur, true), cur);
  const item = ws.items.find((i) => i.id === cur)!;
  // An extracted value that does not satisfy the rules (e.g. a past "expected" date) is replaced.
  for (const [k, v] of Object.entries(TEST_EDUCATION)) if (!item.values[k]?.trim() || k === "status" || k === "endDate") ws = setValue(ws, cur, k, v);
  const left = mandatoryProblems(ws);
  if (left.length) throw new Error(`review payload is still incomplete: ${left.map((p) => p.field).join(", ")}`);
  return { ...serializeWorkspace(ws) };
}
