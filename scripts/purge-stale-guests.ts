/**
 * Deletes guest accounts older than a TTL that never completed onboarding.
 * Also runs daily from /api/cron/cleanup-stuck-syncs.
 *
 *   node --env-file=.env --import tsx scripts/purge-stale-guests.ts [--ttl-days 7] [--apply]
 *
 * Dry run by default: prints how many accounts would be deleted.
 */
import { DEFAULT_GUEST_TTL_DAYS, findStaleGuestUserIds, purgeStaleGuests } from "../lib/services/guest-cleanup-service";

async function main() {
  const args = process.argv.slice(2);
  const ttlIndex = args.indexOf("--ttl-days");
  const ttlDays = ttlIndex >= 0 ? Number(args[ttlIndex + 1]) : DEFAULT_GUEST_TTL_DAYS;
  if (!Number.isFinite(ttlDays) || ttlDays < 0) throw new Error("--ttl-days must be a non-negative number");

  if (!args.includes("--apply")) {
    const ids = await findStaleGuestUserIds(ttlDays, 10_000);
    console.log(`[dry run] ${ids.length} stale guest account(s) older than ${ttlDays} day(s). Re-run with --apply to delete.`);
    process.exit(0);
  }
  const deleted = await purgeStaleGuests(ttlDays);
  console.log(`Deleted ${deleted} stale guest account(s) older than ${ttlDays} day(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
