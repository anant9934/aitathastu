import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { can } from "@/lib/auth/rbac";
import { createEvidenceRecord } from "@/lib/repositories/evidence-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";
import type { EvidenceCategory } from "@/lib/domain";

async function POST_handler(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const isAuthorized = await can(auth.person.id, "evidence.create.self", {
      targetPersonId: auth.person.id,
    });
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized to add evidence." }, { status: 403 });
    }

    const body = await req.json();
    const { category, subject, value, whyItMatters } = body;

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json({ error: "Evidence subject cannot be empty." }, { status: 400 });
    }

    const validCategories: EvidenceCategory[] = [
      "skill",
      "education",
      "experience",
      "goal",
      "project",
      "other",
    ];
    const cat: EvidenceCategory = validCategories.includes(category) ? category : "skill";
    const val = typeof value === "string" && value.trim() ? value.trim() : subject.trim();

    // STRICT PROVENANCE ENFORCEMENT: Self-reported evidence is ALWAYS self_reported & unverified
    // It can NEVER be arbitrarily submitted as verified by a student!
    const record = await createEvidenceRecord(auth.person.id, {
      category: cat,
      subject: subject.trim(),
      value: val,
      source: "self_reported",
      verificationStatus: "self_reported",
      observedAt: new Date(),
      interpretation: `Self-reported ${cat} entry. Helps map direction and gaps, but has not been verified by an institution or evaluator.`,
      whyItMatters:
        typeof whyItMatters === "string" && whyItMatters.trim()
          ? whyItMatters.trim()
          : "Provides context on practical exposure and helps prioritize relevant next actions.",
    });

    // Log journey event
    await createJourneyEventRecord(auth.person.id, {
      type: "evidence_added",
      title: `Added evidence: ${record.subject}`,
      description: `Recorded self-reported ${cat} item "${record.subject}".`,
      relatedEntityId: record.id,
    });

    return NextResponse.json({ success: true, evidence: record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add evidence.";
    console.error("[Evidence Add Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
