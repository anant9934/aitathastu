/**
 * AI TATHASTU — NETLIFY SCHEDULED FUNCTION: Cleanup Stuck Sync Runs
 *
 * Replaces the Vercel Cron job from vercel.json.
 * Schedule: "0 4 * * *" (04:00 UTC daily) — configured in netlify.toml
 *
 * Marks sync runs stuck > 15 minutes as timed out.
 * Recovers stuck OCR processing jobs.
 *
 * This is a Netlify Scheduled Function — invoked automatically by Netlify,
 * not via an HTTP endpoint. No Authorization header check needed.
 */

import type { Config } from "@netlify/functions";

// Use dynamic imports for compatibility with Netlify function bundling
export default async function handler() {
  const startTime = Date.now();
  console.log(`[Netlify Cron] cleanup-stuck-syncs started at ${new Date().toISOString()}`);

  try {
    // Dynamically import to avoid bundling issues
    const { getDb, syncRuns } = await import("../../lib/db/index.js");
    const { and, eq, lt } = await import("drizzle-orm");
    const { SourceProcessingJobService } = await import("../../lib/services/source-processing-job-service.js");

    const db = await getDb();

    // Sweep sync runs started > 15 minutes ago still marked "syncing"
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stuckRuns = await db
      .select({ id: syncRuns.id, startedAt: syncRuns.startedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.status, "syncing"), lt(syncRuns.startedAt, fifteenMinutesAgo)))
      .limit(20);

    let fixed = 0;
    for (const run of stuckRuns) {
      await db
        .update(syncRuns)
        .set({
          status: "error",
          completedAt: new Date(),
          errorCode: "TIMEOUT",
          errorSummary: "Sync run exceeded 15 minute timeout and was marked timed out by scheduled cleanup.",
        })
        .where(eq(syncRuns.id, run.id));
      fixed++;
    }

    const recoveredJobs = await SourceProcessingJobService.recoverStuckJobs(15);

    const duration = Date.now() - startTime;
    console.log(`[Netlify Cron] cleanup-stuck-syncs done in ${duration}ms. Fixed syncRuns: ${fixed}, recoveredJobs: ${recoveredJobs}.`);

    return { statusCode: 200, body: JSON.stringify({ ok: true, fixedSyncRuns: fixed, recoveredJobs, duration_ms: duration }) };
  } catch (err) {
    console.error("[Netlify Cron] cleanup-stuck-syncs error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
}

export const config: Config = {
  schedule: "0 4 * * *",
};
