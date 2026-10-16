import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getStudentDashboardComposition } from "@/lib/services/dashboard-service";
import { cachedStudentJson } from "@/lib/cache/response-cache";

/**
 * The signed-in student's dashboard. No guest or demo mode (Task 2.6.3):
 * sample dashboards live only as static content on the marketing page.
 */
export async function GET() {
  try {
    const t0 = performance.now();
    const auth = await getServerAuthContext();
    const t1 = performance.now();
    if (!auth) return NextResponse.json({ error: "Sign in to view your dashboard." }, { status: 401 });
    // Cached 120 s per student, dropped on any write (Task 2.6.1).
    const { value, hit } = await cachedStudentJson(auth.person.id, "dashboard", () => getStudentDashboardComposition(auth.person.id));
    const t2 = performance.now();
    return NextResponse.json(value, { headers: { "x-cache": hit ? "hit" : "miss", "server-timing": `auth;dur=${(t1 - t0).toFixed(1)}, data;dur=${(t2 - t1).toFixed(1)};desc="${hit ? "cache hit" : "computed"}"` } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard composition.";
    console.error("[Dashboard API Error]", message);
    return NextResponse.json({ error: "We couldn't load your dashboard. Try again in a moment." }, { status: 500 });
  }
}
