/**
 * Phase D: Automated Baseline Load Test Script
 * Tests concurrency levels 20, 50, and 100 against core application endpoints.
 * Measures p50, p95, p99 latencies and error rates without hammering external APIs.
 */

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

interface LoadTestResult {
  concurrency: number;
  totalRequests: number;
  successful: number;
  failed: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
}

async function sendRequest(url: string): Promise<{ success: boolean; latencyMs: number; status: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Tathastu-LoadTester/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - start;
    return { success: res.status >= 200 && res.status < 400, latencyMs, status: res.status };
  } catch {
    const latencyMs = Date.now() - start;
    return { success: false, latencyMs, status: 0 };
  }
}

async function runConcurrencyTier(
  name: string,
  targetUrl: string,
  concurrency: number,
  requestsPerWorker: number
): Promise<LoadTestResult> {
  const totalRequests = concurrency * requestsPerWorker;
  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;

  const tasks: Promise<void>[] = [];

  for (let c = 0; c < concurrency; c++) {
    tasks.push(
      (async () => {
        for (let r = 0; r < requestsPerWorker; r++) {
          const res = await sendRequest(targetUrl);
          latencies.push(res.latencyMs);
          if (res.success) successful++;
          else failed++;
        }
      })()
    );
  }

  await Promise.all(tasks);

  latencies.sort((a, b) => a - b);
  const p50Ms = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95Ms = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99Ms = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avgMs = Math.round(latencies.reduce((sum, l) => sum + l, 0) / (latencies.length || 1));
  const errorRate = Number(((failed / totalRequests) * 100).toFixed(2));

  console.log(`[Tier: ${name}] Concurrency: ${concurrency} | Total: ${totalRequests} | p50: ${p50Ms}ms | p95: ${p95Ms}ms | p99: ${p99Ms}ms | Errors: ${errorRate}%`);

  return {
    concurrency,
    totalRequests,
    successful,
    failed,
    errorRate,
    p50Ms,
    p95Ms,
    p99Ms,
    avgMs,
  };
}

async function main() {
  console.log("==================================================");
  console.log("PHASE D: AUTOMATED CONCURRENCY LOAD TEST");
  console.log(`Target Host: ${BASE_URL}`);
  console.log("==================================================");

  // Check server reachability first
  try {
    const check = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!check.ok) {
      console.error(`Server at ${BASE_URL} returned status ${check.status}. Start the dev server first.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Could not reach ${BASE_URL}. Ensure server is running. Error:`, err);
    process.exit(1);
  }

  const results: Record<string, LoadTestResult[]> = {};

  // Scenario 1: Health & Liveness (20, 50, 100 concurrent)
  console.log("\n--- Scenario 1: Health & Liveness API (/api/health) ---");
  results["health"] = [
    await runConcurrencyTier("20 Users", `${BASE_URL}/api/health`, 20, 5),
    await runConcurrencyTier("50 Users", `${BASE_URL}/api/health`, 50, 4),
    await runConcurrencyTier("100 Users", `${BASE_URL}/api/health`, 100, 2),
  ];

  // Scenario 2: Readiness & DB Probe (/api/ready)
  console.log("\n--- Scenario 2: Deep Readiness API (/api/ready) ---");
  results["ready"] = [
    await runConcurrencyTier("20 Users", `${BASE_URL}/api/ready`, 20, 5),
    await runConcurrencyTier("50 Users", `${BASE_URL}/api/ready`, 50, 4),
    await runConcurrencyTier("100 Users", `${BASE_URL}/api/ready`, 100, 2),
  ];

  // Scenario 3: Landing Page HTML (/)
  console.log("\n--- Scenario 3: Landing Page Static/SSR (/) ---");
  results["landing"] = [
    await runConcurrencyTier("20 Users", `${BASE_URL}/`, 20, 5),
    await runConcurrencyTier("50 Users", `${BASE_URL}/`, 50, 3),
    await runConcurrencyTier("100 Users", `${BASE_URL}/`, 100, 2),
  ];

  console.log("\n==================================================");
  console.log("LOAD TEST SUMMARY");
  console.log("==================================================");
  for (const [scenario, tiers] of Object.entries(results)) {
    console.log(`Endpoint: ${scenario}`);
    for (const t of tiers) {
      console.log(`  - Concurrency ${t.concurrency}: p50=${t.p50Ms}ms, p95=${t.p95Ms}ms, errorRate=${t.errorRate}%`);
    }
  }
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Load test error:", err);
  process.exit(1);
});
