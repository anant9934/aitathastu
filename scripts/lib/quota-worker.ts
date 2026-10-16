/**
 * Child process for the cross-instance quota test: makes N concurrent
 * reservations against the shared Redis counters and prints how many were
 * granted. Each process stands in for one serverless instance.
 *   node --import tsx scripts/lib/quota-worker.ts <personId> <count> <isoDate>
 */
import { reserveAiQuota } from "../../lib/intelligence/cost-control";

async function main() {
  const [personId, count, isoDate] = process.argv.slice(2);
  const results = await Promise.all(
    Array.from({ length: Number(count) }, () => reserveAiQuota(personId, 10, new Date(isoDate)))
  );
  const granted = results.filter((r) => r.allowed).length;
  const backends = [...new Set(results.map((r) => r.backend))].join(",");
  console.log(JSON.stringify({ granted, backends }));
}

main().catch((error) => { console.error(error); process.exit(1); });
