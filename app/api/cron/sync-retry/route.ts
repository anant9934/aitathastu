/**
 * CRON: re-run failed / timed-out sync attempts whose backoff has elapsed
 * (Task 1.9.4), then TTL refreshes of footprint sources (1.6.6). Dead letters are never retried here; only the user can.
 * "Authorization: Bearer $CRON_SECRET", like cleanup-stuck-syncs.
 */
import { NextRequest, NextResponse } from "next/server";
import { runDueRetries, runScheduledFootprintRefresh } from "@/lib/sync/runners";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const retries = await runDueRetries({ limit: 10 });
  // TTL-based refresh of footprint sources (Task 1.6.6), after retries.
  const refresh = await runScheduledFootprintRefresh({ limit: 20 });
  return NextResponse.json({ retries, refresh });
}

