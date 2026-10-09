import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, sourceSnapshots } from "@/lib/db";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import type { ReviewedResumeClaim } from "@/lib/onboarding-v2";

type Candidate = Pick<ReviewedResumeClaim, "category" | "value" | "sourceSpan"> & { candidateId: string };
type ResumeSnapshot = { version: 1; candidates: Candidate[] };

export function resumeCandidates(extracted: ResumeInterpretationOutput): Candidate[] {
  const candidates: Candidate[] = [];
  const add = (category: Candidate["category"], rows: Array<{ value: string; sourceSpan: string }>) => {
    rows.forEach((row, index) => {
      if (row.value.trim() && row.sourceSpan.trim()) {
        candidates.push({ candidateId: `${category}_${index}`, category, value: row.value.trim(), sourceSpan: row.sourceSpan.trim() });
      }
    });
  };
  add("education", extracted.education.map((x) => ({ value: [x.degree, x.fieldOfStudy, x.institution].filter(Boolean).join(" · "), sourceSpan: x.sourceSpan })));
  add("experience", extracted.experience.map((x) => ({ value: [x.role, x.company].filter(Boolean).join(" · "), sourceSpan: x.sourceSpan })));
  add("project", extracted.projects.map((x) => ({ value: x.title, sourceSpan: x.sourceSpan })));
  add("skill", extracted.skills.map((x) => ({ value: x.name, sourceSpan: x.sourceSpan })));
  add("certification", extracted.certifications.map((x) => ({ value: x.name, sourceSpan: x.sourceSpan })));
  return candidates;
}

export async function saveResumeCandidates(personId: string, documentId: string, extracted: ResumeInterpretationOutput): Promise<void> {
  const db = await getDb();
  const snapshotData: ResumeSnapshot = { version: 1, candidates: resumeCandidates(extracted) };
  const id = `resume_${crypto.createHash("sha256").update(`${personId}:${documentId}:${JSON.stringify(snapshotData)}`).digest("hex")}`;
  await db.insert(sourceSnapshots).values({
    id, personId, source: "resume", sourceReference: `resume:sha256:${documentId}`,
    snapshotData, checksum: documentId,
  }).onConflictDoNothing({ target: sourceSnapshots.id });
}

export function claimMatchesSnapshot(claim: ReviewedResumeClaim, candidates: Candidate[]): boolean {
  const matching = candidates.filter((candidate) =>
    candidate.category === claim.category &&
    candidate.sourceSpan === claim.sourceSpan &&
    (!claim.candidateId || candidate.candidateId === claim.candidateId)
  );
  if (matching.length !== 1) return false;
  return claim.corrected || matching[0].value === claim.value;
}

export async function validateReviewedResumeClaims(personId: string, claims: ReviewedResumeClaim[]): Promise<void> {
  if (claims.length === 0) return;
  const db = await getDb();
  const byDocument = new Map<string, ReviewedResumeClaim[]>();
  for (const claim of claims) byDocument.set(claim.documentId, [...(byDocument.get(claim.documentId) || []), claim]);
  for (const [documentId, group] of byDocument) {
    const rows = await db.select({ snapshotData: sourceSnapshots.snapshotData }).from(sourceSnapshots).where(and(
      eq(sourceSnapshots.personId, personId),
      eq(sourceSnapshots.source, "resume"),
      eq(sourceSnapshots.sourceReference, `resume:sha256:${documentId}`)
    ));
    if (rows.length === 0) {
      throw new Error("Resume review has no matching uploaded document. Upload the resume again or remove these claims.");
    }
    for (const claim of group) {
      if (!rows.some((row) => {
        const snapshot = row.snapshotData as Partial<ResumeSnapshot>;
        return snapshot.version === 1 && Array.isArray(snapshot.candidates) && claimMatchesSnapshot(claim, snapshot.candidates);
      })) {
        throw new Error("A resume claim does not match its extraction record. Review the document again.");
      }
    }
  }
}
