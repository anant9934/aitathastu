/**
 * AI TATHASTU — STUDENT RECOMMENDATION & ROADMAP FEEDBACK API
 * 
 * Supports student actions on personalized recommendations:
 * - "not_relevant" -> dismisses recommendation
 * - "already_done" -> marks action as completed in state ledger
 * - "save_for_later" -> pins action state
 * - "change_goal" -> directs to goal selection
 * - "change_priorities" -> directs to priorities update
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { setActionState } from "@/lib/repositories/action-repository";
import { createJourneyEventRecord } from "@/lib/repositories/journey-repository";

export const runtime = "nodejs";

const FeedbackPayloadSchema = z.object({
  actionId: z.string().min(1).max(100),
  feedbackType: z.enum([
    "not_relevant",
    "save_for_later",
    "already_done",
    "change_goal",
    "change_priorities",
  ]),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await getServerAuthContext();
    if (!auth || !auth.person) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = FeedbackPayloadSchema.parse(body);
    const personId = auth.person.id;

    switch (parsed.feedbackType) {
      case "not_relevant": {
        await setActionState(personId, parsed.actionId, "dismissed");
        await createJourneyEventRecord(personId, {
          type: "action_dismissed",
          title: "Dismissed Recommendation",
          description: `Marked "${parsed.actionId}" as not relevant.`,
          metadata: { actionId: parsed.actionId, notes: parsed.notes },
        });
        break;
      }

      case "already_done": {
        await setActionState(personId, parsed.actionId, "completed");
        await createJourneyEventRecord(personId, {
          type: "action_completed",
          title: "Action Marked Complete",
          description: `Confirmed completion of "${parsed.actionId}".`,
          metadata: { actionId: parsed.actionId, notes: parsed.notes },
        });
        break;
      }

      case "save_for_later": {
        await setActionState(personId, parsed.actionId, "active");
        break;
      }

      case "change_goal":
      case "change_priorities": {
        // Log telemetry for adaptive ranking
        await createJourneyEventRecord(personId, {
          type: "preference_updated",
          title: "Feedback on Goal/Priority Alignment",
          description: `Student indicated need to re-align ${parsed.feedbackType}.`,
          metadata: { actionId: parsed.actionId },
        });
        break;
      }
    }

    return NextResponse.json({
      success: true,
      actionId: parsed.actionId,
      feedbackType: parsed.feedbackType,
      status: "recorded",
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid feedback payload", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to record feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
