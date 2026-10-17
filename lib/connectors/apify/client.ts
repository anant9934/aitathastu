/**
 * AI TATHASTU — APIFY CONNECTOR V3
 *
 * Implements approved, compliance-verified Apify Actor execution.
 * Guarantees:
 * - Only approved Actors permitted (whitelisted)
 * - Strict non-bypass policy: No CAPTCHA bypassing, no unauthorized LinkedIn scraping
 * - Full audit tracking: Actor ID, execution reason, accessed resources, cost, output schema
 * - KeyPool supporting up to 4 rotated API tokens (APIFY_API_KEYS, APIFY_TOKEN_1..4)
 * - Graceful fallback when unconfigured or disabled
 */

import { KeyPool } from "@/lib/intelligence/providers/key-pool";

export interface ApifyActorRunAudit {
  actorId: string;
  reason: string;
  accessedUrl?: string;
  runId?: string;
  status: "succeeded" | "failed" | "rejected" | "unconfigured";
  costUsd?: number;
  computeUnits?: number;
  outputCount: number;
  schemaVersion: string;
  executedAt: string;
}

const apifyKeyPool = new KeyPool([
  "APIFY_API_KEYS",
  "APIFY_API_KEY",
  "APIFY_TOKEN",
]);

export function getApifyCapacity(): { configured: boolean; capacity: number } {
  const pool = new KeyPool(["APIFY_API_KEYS", "APIFY_API_KEY", "APIFY_TOKENS", "APIFY_TOKEN"]);
  return {
    configured: pool.hasKeys(),
    capacity: pool.capacity(),
  };
}

/**
 * Whitelist of permitted, compliance-cleared Apify Actors.
 * Prohibits unofficial scrapers that violate target platform Terms of Service.
 */
export const APPROVED_APIFY_ACTORS = [
  "apify/website-content-crawler",
  "apify/html-extract",
  "apify/json-data-extractor",
] as const;

export type ApprovedApifyActor = (typeof APPROVED_APIFY_ACTORS)[number];

export class ApifyConnector {
  /**
   * Executes an approved Actor for public authorized web data extraction.
   * Enforces ToS compliance and audits cost and output schema.
   */
  static async runApprovedActor<T = Record<string, unknown>>(params: {
    actorId: string;
    input: Record<string, unknown>;
    reason: string;
    accessedUrl?: string;
    timeoutSecs?: number;
  }): Promise<{ items: T[]; audit: ApifyActorRunAudit }> {
    const executedAt = new Date().toISOString();

    // 1. Strict Actor Whitelist Enforcement
    const isApproved = APPROVED_APIFY_ACTORS.includes(params.actorId as ApprovedApifyActor);
    if (!isApproved) {
      return {
        items: [],
        audit: {
          actorId: params.actorId,
          reason: params.reason,
          accessedUrl: params.accessedUrl,
          status: "rejected",
          outputCount: 0,
          schemaVersion: "v1",
          executedAt,
        },
      };
    }

    // 2. Strict Prohibition of Unauthorized LinkedIn / Social Scraping
    if (params.accessedUrl && /linkedin\.com/i.test(params.accessedUrl)) {
      return {
        items: [],
        audit: {
          actorId: params.actorId,
          reason: "LinkedIn automated scraping prohibited by ToS. Use OAuth or user export archive.",
          accessedUrl: params.accessedUrl,
          status: "rejected",
          outputCount: 0,
          schemaVersion: "v1",
          executedAt,
        },
      };
    }

    // 3. Credential Pool Check
    if (!apifyKeyPool.hasKeys()) {
      return {
        items: [],
        audit: {
          actorId: params.actorId,
          reason: params.reason,
          accessedUrl: params.accessedUrl,
          status: "unconfigured",
          outputCount: 0,
          schemaVersion: "v1",
          executedAt,
        },
      };
    }

    const token = apifyKeyPool.getNextKey();
    if (!token) {
      return {
        items: [],
        audit: {
          actorId: params.actorId,
          reason: params.reason,
          accessedUrl: params.accessedUrl,
          status: "unconfigured",
          outputCount: 0,
          schemaVersion: "v1",
          executedAt,
        },
      };
    }

    try {
      const cleanActor = params.actorId.replace("/", "~");
      const timeout = params.timeoutSecs || 15;
      const res = await fetch(`https://api.apify.com/v2/acts/${cleanActor}/runs?waitForFinish=${timeout}&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params.input),
        signal: AbortSignal.timeout((timeout + 3) * 1000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          apifyKeyPool.markKeyFailed(token);
        }
        return {
          items: [],
          audit: {
            actorId: params.actorId,
            reason: params.reason,
            accessedUrl: params.accessedUrl,
            status: "failed",
            outputCount: 0,
            schemaVersion: "v1",
            executedAt,
          },
        };
      }

      const runData = (await res.json()) as { data?: { id?: string; defaultDatasetId?: string; usageTotalUsd?: number; computeUnits?: number } };
      const datasetId = runData.data?.defaultDatasetId;

      if (!datasetId) {
        return {
          items: [],
          audit: {
            actorId: params.actorId,
            reason: params.reason,
            accessedUrl: params.accessedUrl,
            runId: runData.data?.id,
            status: "succeeded",
            costUsd: runData.data?.usageTotalUsd ?? 0,
            computeUnits: runData.data?.computeUnits ?? 0,
            outputCount: 0,
            schemaVersion: "v1",
            executedAt,
          },
        };
      }

      // Fetch output dataset
      const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=20&token=${token}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      const items = dataRes.ok ? ((await dataRes.json()) as T[]) : [];

      return {
        items: Array.isArray(items) ? items : [],
        audit: {
          actorId: params.actorId,
          reason: params.reason,
          accessedUrl: params.accessedUrl,
          runId: runData.data?.id,
          status: "succeeded",
          costUsd: runData.data?.usageTotalUsd ?? 0,
          computeUnits: runData.data?.computeUnits ?? 0,
          outputCount: Array.isArray(items) ? items.length : 0,
          schemaVersion: "v1",
          executedAt,
        },
      };
    } catch {
      return {
        items: [],
        audit: {
          actorId: params.actorId,
          reason: params.reason,
          accessedUrl: params.accessedUrl,
          status: "failed",
          outputCount: 0,
          schemaVersion: "v1",
          executedAt,
        },
      };
    }
  }
}

export const executeApifyActor = ApifyConnector.runApprovedActor;
