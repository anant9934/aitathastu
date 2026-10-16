import { NextResponse } from "next/server";
import { exportPortfolio } from "@/lib/services/project-ledger-service";
import { ledgerFailure, requirePerson, unauthorized } from "@/lib/services/ledger-http";

/** The portfolio pack: included projects and publications, with only the chips the student chose (Task 2.5.4). */
export async function GET() {
  const personId = await requirePerson();
  if (!personId) return unauthorized();
  try {
    return NextResponse.json(await exportPortfolio(personId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return ledgerFailure(error, "GET /api/student/projects/export");
  }
}
