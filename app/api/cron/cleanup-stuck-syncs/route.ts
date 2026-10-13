/**
 * AI TATHASTU — CRON JOB: daily cleanup
 *
 * Called once a day by Vercel Cron (vercel.json) or an external cron with
 * "Authorization: Bearer $CRON_SECRET". It:
 *   - marks sync runs stuck > 15 minutes as timed out,
 *   - fails processing jobs stuck in an in-flight state > 15 minutes,
 *   - purges guest accounts older than 7 days that never finished onboarding.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb, syncRuns } from "@/lib/db";
import { and, eq, lt } from "drizzle-orm";
import { SourceProcessingJobService } from "@/lib/services/source-processing-job-service";
import { purgeStaleGuests } from "@/lib/services/guest-cleanup-service";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  console.log(`[Cron] cleanup-stuck-syncs started at ${new Date().toISOString()}`);

  try {
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
          errorSummary: "Sync run exceeded 15 minute timeout and was marked timed out by cron job.",
        })
        .where(eq(syncRuns.id, run.id));
      fixed++;
    }

    const recoveredJobs = await SourceProcessingJobService.recoverStuckJobs(15);
    const purgedGuests = await purgeStaleGuests();

    const duration = Date.now() - startTime;
    console.log(`[Cron] cleanup-stuck-syncs done in ${duration}ms. Fixed syncRuns: ${fixed}, recoveredJobs: ${recoveredJobs}, purgedGuests: ${purgedGuests}.`);

    return NextResponse.json({
      ok: true,
      fixedSyncRuns: fixed,
      recoveredJobs,
      purgedGuests,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron] cleanup-stuck-syncs error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
