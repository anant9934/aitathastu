/** Shared HTTP helpers for the ledger routes (Task 2.5). */
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { validateProjectUrl } from "@/lib/domain/project-taxonomy";
import { LedgerError } from "@/lib/services/project-ledger-service";
import { logger } from "@/lib/logger";

export async function requirePerson() {
  const auth = await getServerAuthContext();
  return auth ? auth.person.id : null;
}

export const unauthorized = () => NextResponse.json({ error: "Sign in to see your projects." }, { status: 401 });

/** null when every URL present is acceptable, otherwise the 400 response to send. */
export function badUrl(body: Record<string, unknown>) {
  for (const [key, label] of [["repositoryUrl", "Repository link"], ["demoUrl", "Demo link"], ["url", "Link"]] as const) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) {
      const check = validateProjectUrl(v.trim());
      if (!check.valid) return NextResponse.json({ error: `${label}: ${check.error}` }, { status: 400 });
    }
  }
  return null;
}

export function ledgerFailure(error: unknown, route: string) {
  if (error instanceof LedgerError) return NextResponse.json({ error: error.message }, { status: error.status });
  logger.error("ledger.failed", { route, error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json({ error: "Something went wrong saving that. Try again in a moment." }, { status: 500 });
}
