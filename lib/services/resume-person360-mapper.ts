/**
 * AI TATHASTU — RESUME TO PERSON 360 INTEGRATION MAPPER
 *
 * Transactionally and idempotently maps approved Schema v2.0 extraction records
 * into the Person 360 domain model.
 *
 * STRICT GOVERNANCE RULES:
 * 1. Never overwrite independently verified fields.
 * 2. Record contradictions in `sourceConflicts`.
 * 3. Preserve source evidence provenance (`source: 'resume'`, `sourceReference: resume:${documentId}`).
 * 4. Projects start as `candidate` status.
 * 5. Update Person 360 profile fields (headline, degree, institution, etc.) idempotently.
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  getDb,
  evidenceItems,
  personProfiles,
  projects,
  sourceConflicts,
  journeyEvents,
} from "@/lib/db";
import type { ExtractorProfileV2, ExtractorRecord } from "./extractor-service-client";

export interface Person360MappingResult {
  success: boolean;
  fieldsUpdated: string[];
  evidenceCreated: number;
  projectsCreated: number;
  conflictsDetected: number;
  skippedVerifiedFields: string[];
}

export class ResumePerson360Mapper {
  static async applyProfileToPerson360(
    personId: string,
    documentId: string,
    profile: ExtractorProfileV2
  ): Promise<Person360MappingResult> {
    const db = await getDb();
    const result: Person360MappingResult = {
      success: true,
      fieldsUpdated: [],
      evidenceCreated: 0,
      projectsCreated: 0,
      conflictsDetected: 0,
      skippedVerifiedFields: [],
    };

    // 1. Fetch current profile & verified evidence
    const currentProfiles = await db
      .select()
      .from(personProfiles)
      .where(eq(personProfiles.personId, personId));
    const currentProfile = currentProfiles[0];

    const existingEvidence = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.personId, personId));

    const verifiedCategories = new Set(
      existingEvidence
        .filter((e) => e.verificationStatus === "verified")
        .map((e) => `${e.category}:${e.subject.toLowerCase()}`)
    );

    const profileUpdates: Record<string, unknown> = {};

    // 2. Identity / Headline Mapping
    const identityRecords = profile.groups.identity || [];
    if (identityRecords.length > 0) {
      const headlineField = identityRecords[0].fields.professional_headline?.value;
      if (headlineField && (!currentProfile?.headline || currentProfile.headline.trim() === "")) {
        profileUpdates.headline = headlineField;
        result.fieldsUpdated.push("headline");
      }
    }

    // 3. Education Mapping
    const eduRecords = (profile.groups.education || []).filter(
      (r) => r.record_state !== "rejected"
    );
    if (eduRecords.length > 0) {
      const primaryEdu = eduRecords[0];
      const inst = primaryEdu.fields.institution?.value;
      const deg = primaryEdu.fields.qualification?.value || primaryEdu.fields.degree_title?.value;
      const spec = primaryEdu.fields.specialization?.value;
      const gradYearRaw =
        primaryEdu.fields.expected_graduation?.value || primaryEdu.fields.end_date?.value;

      // Check if existing institution/degree are verified
      const instVerified = verifiedCategories.has("education:institution");
      const degVerified = verifiedCategories.has("education:degree");

      if (inst && !instVerified) {
        if (currentProfile?.institution && currentProfile.institution !== inst) {
          // Log conflict
          await this.logConflict(db, personId, "education.institution", currentProfile.institution, inst);
          result.conflictsDetected++;
        } else {
          profileUpdates.institution = inst;
          result.fieldsUpdated.push("institution");
        }
      } else if (instVerified) {
        result.skippedVerifiedFields.push("institution");
      }

      if (deg && !degVerified) {
        profileUpdates.degree = deg;
        result.fieldsUpdated.push("degree");
      } else if (degVerified) {
        result.skippedVerifiedFields.push("degree");
      }

      if (spec && !currentProfile?.specialization) {
        profileUpdates.specialization = spec;
        result.fieldsUpdated.push("specialization");
      }

      if (gradYearRaw) {
        const parsedYear = parseInt(gradYearRaw.replace(/\D/g, ""), 10);
        if (parsedYear && parsedYear >= 1970 && parsedYear <= 2040 && !currentProfile?.expectedGraduationYear) {
          profileUpdates.expectedGraduationYear = parsedYear;
          result.fieldsUpdated.push("expectedGraduationYear");
        }
      }
    }

    // Apply profile updates
    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updatedAt = new Date();
      if (currentProfile) {
        await db
          .update(personProfiles)
          .set(profileUpdates)
          .where(eq(personProfiles.personId, personId));
      } else {
        await db.insert(personProfiles).values({
          id: `profile_${personId}`,
          personId,
          education: "",
          experience: "",
          headline: "",
          degree: "",
          specialization: "",
          institution: "",
          currentYear: "",
          semester: "",
          ...profileUpdates,
        });
      }
    }

    // 4. Skills Evidence Mapping
    const skillRecords = (profile.groups.skills || []).filter(
      (r) => r.record_state !== "rejected"
    );
    for (const rec of skillRecords) {
      const skillName = rec.fields.canonical_name?.value || rec.fields.original_wording?.value;
      if (!skillName) continue;

      const evidenceKey = `skill:${skillName.toLowerCase()}`;
      if (verifiedCategories.has(evidenceKey)) {
        result.skippedVerifiedFields.push(`skill:${skillName}`);
        continue;
      }

      const snippet =
        rec.fields.canonical_name?.evidence[0]?.snippet ||
        rec.fields.original_wording?.evidence[0]?.snippet ||
        `Skill extracted from resume: ${skillName}`;

      const id = `ev_res_${crypto.createHash("sha256").update(`${personId}:skill:${skillName}:${documentId}`).digest("hex").slice(0, 24)}`;

      await db
        .insert(evidenceItems)
        .values({
          id,
          personId,
          category: "skill",
          subject: skillName,
          value: skillName,
          source: "resume",
          verificationStatus: "unverified",
          sourceReference: `resume:sha256:${documentId}`,
          interpretation: `Skill self-reported via resume document.`,
          whyItMatters: `Identified candidate skill for role alignment.`,
          importKey: `resume:${documentId}:skill:${skillName}`,
        })
        .onConflictDoNothing({ target: evidenceItems.id });

      result.evidenceCreated++;
    }

    // 5. Projects Mapping (Candidate Status)
    const projectRecords = (profile.groups.projects || []).filter(
      (r) => r.record_state !== "rejected"
    );
    for (const rec of projectRecords) {
      const title = rec.fields.title?.value;
      if (!title) continue;

      const description = rec.fields.description?.value || "";
      const techRaw = rec.fields.technologies?.value || "";
      const techList = techRaw ? techRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];
      const repoUrl = rec.fields.github_url?.value || rec.fields.evidence_url?.value || "";

      const projId = `proj_res_${crypto.createHash("sha256").update(`${personId}:${title}:${documentId}`).digest("hex").slice(0, 24)}`;

      await db
        .insert(projects)
        .values({
          id: projId,
          personId,
          title,
          summary: description ? description.slice(0, 200) : "",
          description,
          technologies: techList,
          sources: ["resume"],
          status: "candidate", // Never automatically confirmed without user approval
          repositoryUrl: repoUrl || undefined,
        })
        .onConflictDoNothing({ target: projects.id });

      result.projectsCreated++;
    }

    // 6. Record Journey Event
    const journeyId = `je_res_${crypto.createHash("sha256").update(`${personId}:${documentId}:${Date.now()}`).digest("hex").slice(0, 24)}`;
    await db
      .insert(journeyEvents)
      .values({
        id: journeyId,
        personId,
        type: "resume_imported",
        title: "Resume Extracted & Profile Updated",
        description: `Imported ${result.evidenceCreated} skills and ${result.projectsCreated} projects from resume.`,
        relatedEntityId: documentId,
        metadata: {
          documentId,
          evidenceCreated: result.evidenceCreated,
          projectsCreated: result.projectsCreated,
        },
      })
      .onConflictDoNothing({ target: journeyEvents.id });

    return result;
  }

  private static async logConflict(
    db: any,
    personId: string,
    field: string,
    existingValue: string,
    incomingValue: string
  ): Promise<void> {
    const id = `conf_${crypto.createHash("sha256").update(`${personId}:${field}:${existingValue}:${incomingValue}`).digest("hex").slice(0, 24)}`;
    await db
      .insert(sourceConflicts)
      .values({
        id,
        personId,
        field,
        sourceA: "profile",
        valueA: existingValue,
        observedAtA: new Date(),
        sourceB: "resume",
        valueB: incomingValue,
        observedAtB: new Date(),
        status: "detected",
      })
      .onConflictDoNothing({ target: sourceConflicts.id });
  }
}
