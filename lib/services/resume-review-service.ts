import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, sourceSnapshots } from "@/lib/db";
import type { ResumeInterpretationOutput } from "@/lib/intelligence/schemas";
import type { ReviewedResumeClaim } from "@/lib/onboarding-v2";

type Candidate = Pick<ReviewedResumeClaim, "category" | "value" | "sourceSpan"> & { candidateId: string };
type ResumeSnapshot = { version: 1; candidates: Candidate[] };

import { ExtractionValidator } from "./extraction-validator";

export function resumeCandidates(extracted: ResumeInterpretationOutput, sourceText?: string): Candidate[] {
  const candidates: Candidate[] = [];
  const normalizedSource = sourceText?.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const add = (category: Candidate["category"], rows: Array<{ value: string; sourceSpan: string }>) => {
    rows.forEach((row, index) => {
      const trimmedVal = row.value.trim();
      const trimmedSpan = row.sourceSpan.trim();
      if (!trimmedVal || !trimmedSpan) return;
      if (normalizedSource) {
        const normSpan = trimmedSpan.replace(/[\s\r\n]+/g, " ").trim().toLocaleLowerCase();
        const words = normSpan.split(" ").filter((w) => w.length > 3);
        const matchesExact = normalizedSource.includes(normSpan);
        const matchesKeyWords = words.length >= 2 && words.slice(0, 3).every((w) => normalizedSource.includes(w));
        if (!matchesExact && !matchesKeyWords) return;
      }

      if (category === "skill") {
        const valRes = ExtractionValidator.validateSkillClaim(trimmedVal, trimmedSpan);
        if (!valRes.valid) return; // Discard negated, aspirational, or unsupported claims
        candidates.push({ candidateId: `${category}_${index}`, category, value: valRes.normalizedValue, sourceSpan: trimmedSpan });
        return;
      }

      candidates.push({ candidateId: `${category}_${index}`, category, value: trimmedVal, sourceSpan: trimmedSpan });
    });
  };
  add(
    "education",
    extracted.education.map((x) => {
      const parts = [
        x.degree || x.fieldOfStudy,
        x.fieldOfStudy && x.degree ? x.fieldOfStudy : undefined,
        x.institution,
        x.gpa ? `CGPA: ${x.gpa}` : x.percentage ? `${x.percentage}` : undefined,
        x.startDate && x.endDate ? `${x.startDate}–${x.endDate}` : x.graduationYear ? `Class of ${x.graduationYear}` : undefined,
      ].filter(Boolean);
      return {
        value: parts.join(" · ") || x.institution || "Education Entry",
        sourceSpan: x.sourceSpan,
      };
    })
  );
  add(
    "experience",
    extracted.experience.map((x) => {
      const parts = [
        x.role,
        x.company,
        x.startDate && x.endDate ? `${x.startDate}–${x.endDate}` : x.duration,
      ].filter(Boolean);
      return {
        value: parts.join(" · ") || x.company || "Experience Entry",
        sourceSpan: x.sourceSpan,
      };
    })
  );
  add(
    "project",
    extracted.projects.map((x) => {
      const techSnippet = x.technologies && x.technologies.length > 0 ? ` (${x.technologies.slice(0, 3).join(", ")})` : "";
      const descSnippet = x.description ? ` — ${x.description.length > 70 ? x.description.slice(0, 67) + "…" : x.description}` : "";
      return {
        value: `${x.title}${techSnippet}${descSnippet}`,
        sourceSpan: x.sourceSpan,
      };
    })
  );
  add("skill", extracted.skills.map((x) => ({ value: x.name, sourceSpan: x.sourceSpan })));
  add(
    "certification",
    extracted.certifications.map((x) => {
      const parts = [x.name, x.issuer, x.year].filter(Boolean);
      return {
        value: parts.join(" · "),
        sourceSpan: x.sourceSpan,
      };
    })
  );
  if (Array.isArray(extracted.achievements)) {
    const pubs = extracted.achievements.filter((x) => x.category === "publication" || x.category === "patent" || x.category === "book");
    const achs = extracted.achievements.filter((x) => x.category !== "publication" && x.category !== "patent" && x.category !== "book");
    if (pubs.length > 0) {
      add(
        "publication",
        pubs.map((x) => {
          const cat = x.category ? ` (${x.category})` : "";
          const desc = x.description ? ` — ${x.description.length > 60 ? x.description.slice(0, 57) + "…" : x.description}` : "";
          return {
            value: `${x.title}${cat}${desc}`,
            sourceSpan: x.sourceSpan,
          };
        })
      );
    }
    if (achs.length > 0) {
      add(
        "achievement",
        achs.map((x) => {
          const cat = x.category ? ` (${x.category})` : "";
          const desc = x.description ? ` — ${x.description.length > 60 ? x.description.slice(0, 57) + "…" : x.description}` : "";
          return {
            value: `${x.title}${cat}${desc}`,
            sourceSpan: x.sourceSpan,
          };
        })
      );
    }
  }
  return candidates;
}

export async function saveResumeCandidates(personId: string, documentId: string, extracted: ResumeInterpretationOutput, sourceText?: string): Promise<void> {
  const db = await getDb();
  const snapshotData: ResumeSnapshot = { version: 1, candidates: resumeCandidates(extracted, sourceText) };
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
