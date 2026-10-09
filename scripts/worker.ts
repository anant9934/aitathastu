/**
 * AI TATHASTU — BACKGROUND WORKER SERVICE (Render / Daemon)
 * 
 * Handles long-running asynchronous jobs outside the request/response lifecycle:
 * - Repository synchronization sweeps
 * - Stale sync cleanup & stuck job remediation
 * - Integration event reconciliation
 * - Background readiness recomputation
 */

import fs from "fs";
import path from "path";

// Ensure environment is loaded from .env if running standalone
if (!process.env.DATABASE_URL && fs.existsSync(path.join(process.cwd(), ".env.local"))) {
  const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "").trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import { getDb, syncRuns } from "../lib/db";
import { and, eq, lt } from "drizzle-orm";

let isShuttingDown = false;

async function performWorkerCycle() {
  if (isShuttingDown) return;

  const now = new Date();
  const uptimeHours = (process.uptime() / 3600).toFixed(2);
  const memUsageMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

  console.log(
    `[Tathastu Worker] Heartbeat at ${now.toISOString()} | Uptime: ${uptimeHours}h | Mem: ${memUsageMb} MB`
  );

  try {
    const db = await getDb();

    // 1. Stuck sync remediation: sweep sync runs started > 15 minutes ago still marked "syncing"
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stuckRuns = await db
      .select({ id: syncRuns.id, startedAt: syncRuns.startedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.status, "syncing"), lt(syncRuns.startedAt, fifteenMinutesAgo)))
      .limit(10);

    if (stuckRuns.length > 0) {
      console.log(`[Tathastu Worker] Found ${stuckRuns.length} stuck sync runs. Marking as timed out...`);
      for (const run of stuckRuns) {
        await db
          .update(syncRuns)
          .set({
            status: "error",
            completedAt: new Date(),
            errorCode: "TIMEOUT",
            errorSummary: "Sync run exceeded 15 minute timeout and was marked timed out by worker.",
          })
          .where(eq(syncRuns.id, run.id));
      }
    }
  } catch (cycleErr) {
    console.error("[Tathastu Worker] Cycle exception:", cycleErr);
  }
}

async function startWorker() {
  console.log("==================================================");
  console.log("AI TATHASTU: BACKGROUND WORKER SERVICE STARTING");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Process PID: ${process.pid}`);
  console.log("==================================================");

  try {
    await getDb();
    console.log("✓ Connected to persistent database successfully.");
  } catch (connErr) {
    console.error("Failed to connect to database at startup:", connErr);
    process.exit(1);
  }

  // Run immediate first cycle
  await performWorkerCycle();

  // Schedule regular heartbeat every 30 seconds
  const interval = setInterval(async () => {
    if (!isShuttingDown) {
      await performWorkerCycle();
    }
  }, 30_000);

  const shutdown = async (signal: string) => {
    console.log(`\n[Tathastu Worker] Received ${signal}. Initiating graceful shutdown...`);
    isShuttingDown = true;
    clearInterval(interval);

    setTimeout(() => {
      console.log("[Tathastu Worker] Worker terminated gracefully.");
      process.exit(0);
    }, 1000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startWorker().catch((err) => {
  console.error("[Tathastu Worker] Fatal worker startup error:", err);
  process.exit(1);
});
