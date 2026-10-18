/**
 * AI TATHASTU — DATA RIGHTS SERVICE
 *
 * Implements student data rights management in alignment with:
 * - Digital Personal Data Protection Act, 2023 (Sections 11, 12, 13)
 * - DPDP Rules, 2025 (phased implementation)
 * - Information Technology Act, 2000 & SPDI Rules
 *
 * Supported rights:
 * 1. Right to Access & Summary of Personal Data (Data Portability Export)
 * 2. Right to Correction and Updating
 * 3. Right to Erasure / Account Deletion
 * 4. Right of Grievance Redressal
 * 5. Right to Withdraw Consent
 */

import crypto from "crypto";
import { getDb, persons, personProfiles, projects, evidenceItems, externalConnections, resumeDocuments, journeyEvents, roadmapMilestones } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ConsentService } from "./consent-service";
import { getUserPreferences, updateUserPreferences } from "@/lib/repositories/person-repository";

export type DataRequestType =
  | "access"
  | "correction"
  | "erasure"
  | "grievance"
  | "consent_withdrawal"
  | "child_data_inquiry";

export type DataRequestStatus = "submitted" | "in_review" | "resolved" | "rejected";

export interface DataRequestRecord {
  requestId: string;
  personId: string;
  requestType: DataRequestType;
  details: string;
  contactEmail?: string;
  submittedAt: string;
  status: DataRequestStatus;
  resolutionNotes?: string;
  updatedAt: string;
}

export class DataRightsService {
  /**
   * Generates a complete, machine-readable JSON export of all personal data held
   * for the authenticated student. Strictly redacts sensitive internal hashes,
   * tokens, and system secrets.
   */
  static async exportStudentData(personId: string): Promise<Record<string, unknown>> {
    const db = await getDb();

    // 1. Fetch Person and Profile
    const [person] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    const [profile] = await db.select().from(personProfiles).where(eq(personProfiles.personId, personId)).limit(1);

    // 2. Fetch Projects
    const userProjects = await db.select().from(projects).where(eq(projects.personId, personId));

    // 3. Fetch Evidence Items
    const evidence = await db.select().from(evidenceItems).where(eq(evidenceItems.personId, personId));

    // 4. Fetch Connected Accounts (strictly omitting encrypted access tokens / passwords)
    const connections = await db.select().from(externalConnections).where(eq(externalConnections.personId, personId));
    const sanitizedConnections = connections.map((c) => ({
      provider: c.provider,
      status: c.status,
      profileUrl: c.profileUrl,
      lastSyncedAt: c.lastSyncedAt,
      createdAt: c.createdAt,
    }));

    // 5. Fetch Resume Documents Metadata (omitting raw binary blobs)
    const resumes = await db.select().from(resumeDocuments).where(eq(resumeDocuments.personId, personId));
    const sanitizedResumes = resumes.map((r) => ({
      id: r.id,
      filename: r.filename,
      status: r.status,
      uploadedAt: r.createdAt,
      metadata: r.metadata,
    }));

    // 6. Fetch Journey Milestones
    const milestones = await db.select().from(roadmapMilestones).where(eq(roadmapMilestones.personId, personId));
    const journey = await db.select().from(journeyEvents).where(eq(journeyEvents.personId, personId));

    // 7. Fetch Consent Ledger
    const consentLedger = await ConsentService.getLedger(personId);

    return {
      exportMetadata: {
        platform: "AI Tathastu",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        subjectPersonId: personId,
        legalNotice: "Export generated under DPDP Act 2023 / Digital Personal Data Rights provisions.",
      },
      identity: {
        displayName: person?.displayName || null,
        createdAt: person?.createdAt || null,
      },
      profile: profile || null,
      projects: userProjects,
      evidenceLedger: evidence,
      externalConnections: sanitizedConnections,
      resumeHistory: sanitizedResumes,
      learningProgress: {
        milestones,
        journeyEvents: journey,
      },
      consentAuditTrail: consentLedger,
    };
  }

  /**
   * Submits a formal privacy request or grievance.
   */
  static async submitRequest(params: {
    personId: string;
    requestType: DataRequestType;
    details: string;
    contactEmail?: string;
  }): Promise<DataRequestRecord> {
    const { personId, requestType, details, contactEmail } = params;
    const now = new Date().toISOString();
    const requestId = `dpr_${crypto.randomBytes(10).toString("hex")}`;

    const record: DataRequestRecord = {
      requestId,
      personId,
      requestType,
      details: details.trim().slice(0, 4000),
      contactEmail: contactEmail?.trim() || undefined,
      submittedAt: now,
      status: "submitted",
      updatedAt: now,
    };

    const prefs = await getUserPreferences(personId);
    const meta = (prefs?.metadata as Record<string, unknown>) || {};
    const requests = Array.isArray(meta.dataRightsRequests) ? (meta.dataRightsRequests as DataRequestRecord[]) : [];

    requests.unshift(record);

    await updateUserPreferences(personId, {
      metadata: { dataRightsRequests: requests.slice(0, 50) },
    });

    console.info(JSON.stringify({
      event: "data_rights.request_submitted",
      requestId,
      personId,
      requestType,
      submittedAt: now,
    }));

    return record;
  }

  /**
   * Retrieves all data requests for the authenticated person.
   */
  static async listRequests(personId: string): Promise<DataRequestRecord[]> {
    const prefs = await getUserPreferences(personId);
    const meta = (prefs?.metadata as Record<string, unknown>) || {};
    return Array.isArray(meta.dataRightsRequests) ? (meta.dataRightsRequests as DataRequestRecord[]) : [];
  }
}
