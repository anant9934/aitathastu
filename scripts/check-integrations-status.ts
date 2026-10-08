/**
 * Phase E: Integration Operational Status & Certification CLI
 * Run via: npm run integrations:status
 */

import { getEcosystemIntegrationStatus } from "../lib/monitoring/integration-status";

async function main() {
  console.log("==================================================");
  console.log("AI TATHASTU: ECOSYSTEM INTEGRATION STATUS");
  console.log("==================================================");

  const report = await getEcosystemIntegrationStatus();

  console.log(`Environment: ${report.environment.toUpperCase()}`);
  console.log(`Report Timestamp: ${report.timestamp}`);
  console.log(`Overall Health: ${report.overallHealth.toUpperCase()}\n`);

  console.log("--------------------------------------------------");
  console.log("SYSTEM             | CERTIFICATION STATE | EVENTS | FAILURES");
  console.log("--------------------------------------------------");

  for (const item of Object.values(report.integrations)) {
    const sys = item.name.slice(0, 18).padEnd(18);
    const state = item.certificationState.padEnd(19);
    const events = String(item.totalEventsIngested).padEnd(6);
    const fails = String(item.failureCount).padEnd(8);
    console.log(`${sys} | ${state} | ${events} | ${fails}`);
    if (item.lastSuccessfulEventAt) {
      console.log(`  └─ Last Success: ${item.lastSuccessfulEventAt}`);
    }
  }

  console.log("==================================================");
  console.log("Zero credentials or secret keys were printed.");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Status check failed:", err);
  process.exit(1);
});
