import { and, eq } from "drizzle-orm";
import { getDb, organizationMemberships } from "@/lib/db";
import { can } from "@/lib/auth/rbac";
import type { ExtractorIdentity } from "@/lib/services/extractor-service-client";

/**
 * Builds the identity used for calls to the extraction service, entirely from
 * the database. Request bodies and headers are never consulted: a client that
 * could choose its own role could grant itself verifier rights.
 */
export async function resolveExtractorIdentity(personId: string): Promise<ExtractorIdentity> {
  const db = await getDb();
  const [membership] = await db
    .select({ organizationId: organizationMemberships.organizationId })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.personId, personId), eq(organizationMemberships.status, "active")))
    .limit(1);
  const organizationId = membership?.organizationId ?? null;
  const isVerifier = organizationId
    ? await can(personId, "student.verify_skill", { organizationId })
    : false;
  return { personId, organizationId, isVerifier };
}
