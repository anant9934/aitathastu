import { withStudentCacheInvalidation } from "@/lib/cache/response-cache";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { can } from "@/lib/auth/rbac";
import { setActionState } from "@/lib/repositories/action-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";
import type { ActionStatus } from "@/lib/domain";

async function POST_handler(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const isAuthorized = await can(auth.person.id, "action.update.self", {
      targetPersonId: auth.person.id,
    });
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized to update action state." }, { status: 403 });
    }

    const body = await req.json();
    const { actionId, status, actionTitle } = body;

    if (!actionId || !status) {
      return NextResponse.json({ error: "Action identifier and status required." }, { status: 400 });
    }

    const validStatuses: ActionStatus[] = ["pending", "active", "dismissed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid action status." }, { status: 400 });
    }

    await setActionState(auth.person.id, actionId, status);

    // Record journey event
    const title = actionTitle || actionId;
    if (status === "active") {
      await createJourneyEventRecord(auth.person.id, {
        type: "recommendation_started",
        title: `Started action: ${title}`,
        description: `Began working on suggested action "${title}".`,
        relatedEntityId: actionId,
      });
    } else if (status === "dismissed") {
      await createJourneyEventRecord(auth.person.id, {
        type: "recommendation_dismissed",
        title: `Dismissed action: ${title}`,
        description: `Dismissed suggestion "${title}". Next action recomputed.`,
        relatedEntityId: actionId,
      });
    } else if (status === "pending") {
      await createJourneyEventRecord(auth.person.id, {
        type: "recommendation_restored",
        title: `Restored action: ${title}`,
        description: `Restored suggestion "${title}" back to active recommendations.`,
        relatedEntityId: actionId,
      });
    }

    return NextResponse.json({ success: true, actionId, status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update action status.";
    console.error("[Action Status Update Error]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// Drop the student's cached reads after a successful write (Task 2.6.1).
export const POST = withStudentCacheInvalidation(POST_handler);
