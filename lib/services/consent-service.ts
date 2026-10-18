/**
 * AI TATHASTU — CONSENT SERVICE & LEDGER
 *
 * Implements server-side consent tracking, validation, audit trails, and data rights
 * in compliance with Indian Technology Law (DPDP Act 2023, DPDP Rules 2025 phased timetable,
 * IT SPDI Rules, and Consumer Protection Dark Patterns Guidelines).
 *
 * Note: AI Tathastu is an operational data fiduciary; this ledger is an internal compliance
 * record and must not be described as a statutory registered Consent Manager without
 * statutory registration.
 */

import crypto from "crypto";
import { getUserPreferences, updateUserPreferences } from "@/lib/repositories/person-repository";

export type ConsentPurpose =
  | "cv_processing"
  | "cv_external_ai_enrichment"
  | "footprint_reference"
  | "external_profile_fetch"
  | "connected_oauth"
  | "cookie_preferences"
  | "account_registration_terms"
  | "institutional_sharing";

export type ConsentStatus = "granted" | "withdrawn";

export interface ConsentRecord {
  consentId: string;
  personId: string;
  purpose: ConsentPurpose | string;
  scope: string;
  status: ConsentStatus;
  policyVersion: string;
  noticeVersion: string;
  timestamp: string; // ISO 8601
  sourceUI: string;
  lawfulAuthorityReference?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConsentLedgerState {
  activeConsents: Record<string, ConsentRecord>;
  auditTrail: ConsentRecord[];
  lastUpdated: string;
}

const DEFAULT_POLICY_VERSION = "0.9.2026";
const DEFAULT_NOTICE_VERSION = "2026.10";

function consentKey(purpose: string, scope?: string): string {
  return scope && scope !== "*" ? `${purpose}:${scope}` : purpose;
}

export class ConsentService {
  /**
   * Loads the current consent ledger for a given student.
   */
  static async getLedger(personId: string): Promise<ConsentLedgerState> {
    if (!personId) {
      return { activeConsents: {}, auditTrail: [], lastUpdated: new Date().toISOString() };
    }

    try {
      const prefs = await getUserPreferences(personId);
      const meta = (prefs?.metadata as Record<string, unknown>) || {};
      const ledger = meta.consentLedger as ConsentLedgerState | undefined;

      if (ledger && typeof ledger === "object" && ledger.activeConsents) {
        return {
          activeConsents: ledger.activeConsents || {},
          auditTrail: Array.isArray(ledger.auditTrail) ? ledger.auditTrail : [],
          lastUpdated: ledger.lastUpdated || new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error("[ConsentService.getLedger] Error reading consent ledger", err);
    }

    return { activeConsents: {}, auditTrail: [], lastUpdated: new Date().toISOString() };
  }

  /**
   * Records a consent decision (grant or withdrawal) with immutable audit history.
   */
  static async recordConsent(params: {
    personId: string;
    purpose: ConsentPurpose | string;
    scope?: string;
    status: ConsentStatus;
    policyVersion?: string;
    noticeVersion?: string;
    sourceUI?: string;
    lawfulAuthorityReference?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ConsentRecord> {
    const {
      personId,
      purpose,
      scope = "*",
      status,
      policyVersion = DEFAULT_POLICY_VERSION,
      noticeVersion = DEFAULT_NOTICE_VERSION,
      sourceUI = "application",
      lawfulAuthorityReference = null,
      metadata = {},
    } = params;

    const key = consentKey(purpose, scope);
    const now = new Date().toISOString();
    const consentId = `cst_${crypto.randomBytes(12).toString("hex")}`;

    const record: ConsentRecord = {
      consentId,
      personId,
      purpose,
      scope,
      status,
      policyVersion,
      noticeVersion,
      timestamp: now,
      sourceUI,
      lawfulAuthorityReference,
      metadata,
    };

    const ledger = await this.getLedger(personId);
    ledger.activeConsents[key] = record;
    ledger.auditTrail.unshift(record);

    // Retain up to 200 chronological audit events per person
    if (ledger.auditTrail.length > 200) {
      ledger.auditTrail = ledger.auditTrail.slice(0, 200);
    }
    ledger.lastUpdated = now;

    await updateUserPreferences(personId, {
      metadata: { consentLedger: ledger },
    });

    console.info(JSON.stringify({
      event: "consent.recorded",
      consentId,
      personId,
      purpose,
      scope,
      status,
      sourceUI,
      timestamp: now,
    }));

    return record;
  }

  /**
   * Checks whether the user has active, unwithdrawn consent for a specific purpose and scope.
   */
  static async hasConsent(personId: string, purpose: ConsentPurpose | string, scope = "*"): Promise<boolean> {
    if (!personId) return false;
    const ledger = await this.getLedger(personId);
    const key = consentKey(purpose, scope);
    const record = ledger.activeConsents[key];

    if (!record) {
      // Check wildcard purpose if specific scope wasn't found
      if (scope !== "*") {
        const wildcard = ledger.activeConsents[purpose];
        return Boolean(wildcard && wildcard.status === "granted");
      }
      return false;
    }

    return record.status === "granted";
  }

  /**
   * Retrieves the specific consent record for inspection.
   */
  static async getConsent(personId: string, purpose: ConsentPurpose | string, scope = "*"): Promise<ConsentRecord | null> {
    if (!personId) return null;
    const ledger = await this.getLedger(personId);
    const key = consentKey(purpose, scope);
    return ledger.activeConsents[key] || (scope !== "*" ? ledger.activeConsents[purpose] || null : null);
  }

  /**
   * Explicitly withdraws an existing consent. Future processing under this scope is immediately halted.
   */
  static async withdrawConsent(params: {
    personId: string;
    purpose: ConsentPurpose | string;
    scope?: string;
    sourceUI?: string;
    reason?: string;
  }): Promise<ConsentRecord> {
    return this.recordConsent({
      personId: params.personId,
      purpose: params.purpose,
      scope: params.scope,
      status: "withdrawn",
      sourceUI: params.sourceUI || "privacy_settings",
      metadata: params.reason ? { withdrawalReason: params.reason } : undefined,
    });
  }

  /**
   * Returns all active consents and full chronological history for the student privacy dashboard.
   */
  static async getStudentPrivacyStatus(personId: string): Promise<{
    activeConsents: Record<string, ConsentRecord>;
    auditTrail: ConsentRecord[];
    lastUpdated: string;
  }> {
    return this.getLedger(personId);
  }
}
