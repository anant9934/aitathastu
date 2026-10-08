import { NextResponse } from "next/server";
import { getDb, users } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const startTime = Date.now();
  let dbHealthy = false;
  let schemaHealthy = false;

  try {
    const probePromise = (async () => {
      const db = await getDb();
      await db.execute(sql`SELECT 1`);
      const count = await db.select({ count: sql<number>`count(*)` }).from(users);
      return count !== undefined;
    })();

    const timeoutPromise = new Promise<boolean>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("DB probe timeout")), 5000);
      probePromise.finally(() => clearTimeout(timer));
    });

    const isHealthy = await Promise.race([probePromise, timeoutPromise]);
    if (isHealthy) {
      dbHealthy = true;
      schemaHealthy = true;
    }
  } catch {
    dbHealthy = false;
    schemaHealthy = false;
  }

  const durationMs = Date.now() - startTime;
  const isReady = dbHealthy && schemaHealthy;

  return NextResponse.json(
    {
      status: isReady ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? "connected" : "unreachable",
        schema: schemaHealthy ? "verified" : "error",
      },
      durationMs,
    },
    {
      status: isReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
