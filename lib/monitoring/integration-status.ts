/**
 * Phase E: Integration Operational Status & Certification Service
 * Provides authorized monitoring and truth-telling status inspection across:
 * - GitHub
 * - Study LPU
 * - Padho Code
 * - ERIS Assessment Engine
 * - MentorMaze Mock Interview Platform
 *
 * Enforces strict non-leakage of raw secrets.
 */

import { getDb, integrationEvents, externalConnections } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import type { ProducerType } from "../domain/integrations";

export type IntegrationCertificationState =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "CONTRACT_VERIFIED"
  | "STAGING_LIVE"
  | "PRODUCTION_LIVE"
  | "DEGRADED"
  | "FAILED";

export interface PartnerIntegrationStatus {
  system: "github" | "study_lpu" | "padho_code" | "eris" | "mentormaze";
  name: string;
  certificationState: IntegrationCertificationState;
  isConfigured: boolean;
  activeWebhook: boolean;
  totalEventsIngested: number;
  lastSuccessfulEventAt: string | null;
  lastFailedEventAt: string | null;
  failureCount: number;
  message: string;
}

export interface EcosystemStatusReport {
  timestamp: string;
  environment: "development" | "staging" | "production";
  integrations: Record<string, PartnerIntegrationStatus>;
  overallHealth: "healthy" | "degraded" | "unconfigured";
}

export async function getEcosystemIntegrationStatus(): Promise<EcosystemStatusReport> {
  const env = process.env.NODE_ENV || "development";
  const appEnv = (process.env.APP_ENV || (env === "production" ? "production" : "staging")) as
    | "development"
    | "staging"
    | "production";

  const db = await getDb();

  // Helper to query partner event statistics from integration_events
  async function getPartnerStats(producer: ProducerType) {
    try {
      const [totalCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(integrationEvents)
        .where(eq(integrationEvents.producer, producer));

      const [failureCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(integrationEvents)
        .where(
          and(
            eq(integrationEvents.producer, producer),
            eq(integrationEvents.processingStatus, "failed")
          )
        );

      const lastSuccess = await db
        .select({ receivedAt: integrationEvents.receivedAt })
        .from(integrationEvents)
        .where(
          and(
            eq(integrationEvents.producer, producer),
            eq(integrationEvents.processingStatus, "processed")
          )
        )
        .orderBy(desc(integrationEvents.receivedAt))
        .limit(1);

      const lastFailure = await db
        .select({ receivedAt: integrationEvents.receivedAt })
        .from(integrationEvents)
        .where(
          and(
            eq(integrationEvents.producer, producer),
            eq(integrationEvents.processingStatus, "failed")
          )
        )
        .orderBy(desc(integrationEvents.receivedAt))
        .limit(1);

      return {
        total: Number(totalCount?.count || 0),
        failures: Number(failureCount?.count || 0),
        lastSuccessAt: lastSuccess[0]?.receivedAt
          ? new Date(lastSuccess[0].receivedAt).toISOString()
          : null,
        lastFailureAt: lastFailure[0]?.receivedAt
          ? new Date(lastFailure[0].receivedAt).toISOString()
          : null,
      };
    } catch {
      return { total: 0, failures: 0, lastSuccessAt: null, lastFailureAt: null };
    }
  }

  // 1. GitHub Integration Status
  const ghConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID || process.env.GITHUB_TOKEN || process.env.GITHUB_WEBHOOK_SECRET
  );
  let ghTotalConnected = 0;
  try {
    const [ghConns] = await db
      .select({ count: sql<number>`count(*)` })
      .from(externalConnections)
      .where(
        and(
          eq(externalConnections.provider, "github"),
          eq(externalConnections.status, "connected")
        )
      );
    ghTotalConnected = Number(ghConns?.count || 0);
  } catch {
    // fallback
  }

  const ghLiveEnabled = process.env.ENABLE_GITHUB_LIVE === "true";
  let ghState: IntegrationCertificationState = "CONTRACT_VERIFIED";
  if (!ghConfigured) ghState = "NOT_CONFIGURED";
  else if (ghLiveEnabled && ghTotalConnected > 0) {
    ghState = appEnv === "production" ? "PRODUCTION_LIVE" : "STAGING_LIVE";
  } else if (ghConfigured) {
    ghState = "CONFIGURED";
  }

  // 2. Study LPU Status
  const studyLpuStats = await getPartnerStats("study_lpu");
  const studyLpuConfigured = Boolean(process.env.STUDY_LPU_INTEGRATION_SECRET);
  const studyLpuLive = process.env.ENABLE_STUDY_LPU_LIVE === "true";
  let studyLpuState: IntegrationCertificationState = "CONTRACT_VERIFIED";
  if (!studyLpuConfigured) studyLpuState = "NOT_CONFIGURED";
  else if (studyLpuStats.failures > 5 && studyLpuStats.failures > studyLpuStats.total * 0.5) {
    studyLpuState = "DEGRADED";
  } else if (studyLpuLive && studyLpuStats.lastSuccessAt) {
    studyLpuState = appEnv === "production" ? "PRODUCTION_LIVE" : "STAGING_LIVE";
  } else if (studyLpuConfigured) {
    studyLpuState = "CONFIGURED";
  }

  // 3. Padho Code Status
  const padhoStats = await getPartnerStats("padho_code");
  const padhoConfigured = Boolean(process.env.PADHO_CODE_INTEGRATION_SECRET);
  const padhoLive = process.env.ENABLE_PADHO_CODE_LIVE === "true";
  let padhoState: IntegrationCertificationState = "CONTRACT_VERIFIED";
  if (!padhoConfigured) padhoState = "NOT_CONFIGURED";
  else if (padhoStats.failures > 5 && padhoStats.failures > padhoStats.total * 0.5) {
    padhoState = "DEGRADED";
  } else if (padhoLive && padhoStats.lastSuccessAt) {
    padhoState = appEnv === "production" ? "PRODUCTION_LIVE" : "STAGING_LIVE";
  } else if (padhoConfigured) {
    padhoState = "CONFIGURED";
  }

  // 4. ERIS Status
  const erisStats = await getPartnerStats("eris");
  const erisConfigured = Boolean(process.env.ERIS_INTEGRATION_SECRET);
  const erisLive = process.env.ENABLE_ERIS_LIVE === "true";
  let erisState: IntegrationCertificationState = "CONTRACT_VERIFIED";
  if (!erisConfigured) erisState = "NOT_CONFIGURED";
  else if (erisStats.failures > 5 && erisStats.failures > erisStats.total * 0.5) {
    erisState = "DEGRADED";
  } else if (erisLive && erisStats.lastSuccessAt) {
    erisState = appEnv === "production" ? "PRODUCTION_LIVE" : "STAGING_LIVE";
  } else if (erisConfigured) {
    erisState = "CONFIGURED";
  }

  // 5. MentorMaze Status
  const mentorStats = await getPartnerStats("mentormaze");
  const mentorConfigured = Boolean(process.env.MENTORMAZE_INTEGRATION_SECRET);
  const mentorLive = process.env.ENABLE_MENTORMAZE_LIVE === "true";
  let mentorState: IntegrationCertificationState = "CONTRACT_VERIFIED";
  if (!mentorConfigured) mentorState = "NOT_CONFIGURED";
  else if (mentorStats.failures > 5 && mentorStats.failures > mentorStats.total * 0.5) {
    mentorState = "DEGRADED";
  } else if (mentorLive && mentorStats.lastSuccessAt) {
    mentorState = appEnv === "production" ? "PRODUCTION_LIVE" : "STAGING_LIVE";
  } else if (mentorConfigured) {
    mentorState = "CONFIGURED";
  }

  const integrations: Record<string, PartnerIntegrationStatus> = {
    github: {
      system: "github",
      name: "GitHub Developer Ecosystem",
      certificationState: ghState,
      isConfigured: ghConfigured,
      activeWebhook: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
      totalEventsIngested: ghTotalConnected,
      lastSuccessfulEventAt: null,
      lastFailedEventAt: null,
      failureCount: 0,
      message: `GitHub connector active with ${ghTotalConnected} connected accounts.`,
    },
    study_lpu: {
      system: "study_lpu",
      name: "Study LPU Academic Platform",
      certificationState: studyLpuState,
      isConfigured: studyLpuConfigured,
      activeWebhook: studyLpuConfigured,
      totalEventsIngested: studyLpuStats.total,
      lastSuccessfulEventAt: studyLpuStats.lastSuccessAt,
      lastFailedEventAt: studyLpuStats.lastFailureAt,
      failureCount: studyLpuStats.failures,
      message: `${studyLpuStats.total} academic learning events ingested.`,
    },
    padho_code: {
      system: "padho_code",
      name: "Padho Code Practice Engine",
      certificationState: padhoState,
      isConfigured: padhoConfigured,
      activeWebhook: padhoConfigured,
      totalEventsIngested: padhoStats.total,
      lastSuccessfulEventAt: padhoStats.lastSuccessAt,
      lastFailedEventAt: padhoStats.lastFailureAt,
      failureCount: padhoStats.failures,
      message: `${padhoStats.total} coding practice challenge events ingested.`,
    },
    eris: {
      system: "eris",
      name: "ERIS Standardized Assessment Engine",
      certificationState: erisState,
      isConfigured: erisConfigured,
      activeWebhook: erisConfigured,
      totalEventsIngested: erisStats.total,
      lastSuccessfulEventAt: erisStats.lastSuccessAt,
      lastFailedEventAt: erisStats.lastFailureAt,
      failureCount: erisStats.failures,
      message: `${erisStats.total} standardized assessment attempts ingested.`,
    },
    mentormaze: {
      system: "mentormaze",
      name: "MentorMaze AI Mock Interview Engine",
      certificationState: mentorState,
      isConfigured: mentorConfigured,
      activeWebhook: mentorConfigured,
      totalEventsIngested: mentorStats.total,
      lastSuccessfulEventAt: mentorStats.lastSuccessAt,
      lastFailedEventAt: mentorStats.lastFailureAt,
      failureCount: mentorStats.failures,
      message: `${mentorStats.total} mock interview evaluation sessions ingested.`,
    },
  };

  const hasDegraded = Object.values(integrations).some(
    (i) => i.certificationState === "DEGRADED" || i.certificationState === "FAILED"
  );
  const overallHealth = hasDegraded ? "degraded" : "healthy";

  return {
    timestamp: new Date().toISOString(),
    environment: appEnv,
    integrations,
    overallHealth,
  };
}
