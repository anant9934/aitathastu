import { getDb, integrationEvents } from "../db";
import { defaultIntelligenceRouter } from "../intelligence/router";
import { sql } from "drizzle-orm";

export interface SystemOperationalStatus {
  timestamp: string;
  database: {
    status: "healthy" | "degraded" | "unhealthy";
    latencyMs?: number;
  };
  aiProviders: {
    totalConfigured: number;
    active: string[];
    coolingDown: string[];
  };
  integrations: {
    unresolvedCount: number;
    failedCount: number;
  };
  mode: "pilot" | "production" | "development";
}

/**
 * Collects high-level health and operational status across system components.
 * Excludes sensitive secrets, database URLs, and customer PII.
 */
export async function getSystemOperationalStatus(): Promise<SystemOperationalStatus> {
  const start = Date.now();
  let dbStatus: "healthy" | "degraded" | "unhealthy" = "unhealthy";
  let latencyMs = 0;
  let unresolvedCount = 0;
  let failedCount = 0;

  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    latencyMs = Date.now() - start;
    dbStatus = latencyMs < 500 ? "healthy" : "degraded";

    // Count unresolved identity events
    const unresolvedRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationEvents)
      .where(sql`processing_status = 'identity_unresolved'`);
    unresolvedCount = Number(unresolvedRes[0]?.count || 0);

    // Count failed integration events
    const failedRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationEvents)
      .where(sql`processing_status = 'failed'`);
    failedCount = Number(failedRes[0]?.count || 0);
  } catch {
    dbStatus = "unhealthy";
  }

  // Check AI providers
  const allProviders = ["gemini", "groq", "openrouter", "cerebras", "mistral", "sambanova"] as const;
  const coolingDown: string[] = [];
  const active: string[] = [];

  for (const p of allProviders) {
    if (defaultIntelligenceRouter.isProviderCoolingDown(p)) {
      coolingDown.push(p);
    } else {
      active.push(p);
    }
  }

  const mode = process.env.PILOT_MODE === "true"
    ? "pilot"
    : process.env.NODE_ENV === "production"
    ? "production"
    : "development";

  return {
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs,
    },
    aiProviders: {
      totalConfigured: allProviders.length,
      active,
      coolingDown,
    },
    integrations: {
      unresolvedCount,
      failedCount,
    },
    mode,
  };
}
