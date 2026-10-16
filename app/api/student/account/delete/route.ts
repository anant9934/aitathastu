import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { deleteAccountCompletely } from "@/lib/services/guest-cleanup-service";
import { logger } from "@/lib/logger";

/** The phrase the student types to confirm; a stray or forged request cannot delete an account. */
const DELETE_CONFIRMATION = "delete my account";

/**
 * Right to be forgotten (Task 2.6.5): permanently deletes the signed-in
 * account and every row that belongs to it, then signs the browser out.
 * Requires { confirm: "delete my account" } in the body. Same-origin only
 * (middleware CSRF check).
 */
export async function POST(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth) return NextResponse.json({ error: "Sign in to delete your account." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (typeof body?.confirm !== "string" || body.confirm.trim().toLowerCase() !== DELETE_CONFIRMATION) {
    return NextResponse.json({ error: `Type "${DELETE_CONFIRMATION}" to confirm. This cannot be undone.` }, { status: 400 });
  }
  try {
    const result = await deleteAccountCompletely(auth.user.id);
    logger.info("account.deleted", { route: "/api/student/account/delete", metadata: { tablesTouched: result.tablesTouched } });
    const response = NextResponse.json({ deleted: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    logger.error("account.delete_failed", { error: error instanceof Error ? error.message : String(error) });
    // Deletion is idempotent, so asking the student to retry is safe.
    return NextResponse.json({ error: "We couldn't finish deleting your account. Please try again." }, { status: 500 });
  }
}
