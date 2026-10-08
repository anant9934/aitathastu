import type { EvidenceItem } from "./evidence";
import type { MeaningfulChange, InterviewSession, LearningActivity, CodingPracticeActivity } from "./integrations";

/**
 * Detects whether state changes across the ecosystem represent a "meaningful change"
 * that justifies student notification or an EORA insight update.
 * Prevents noisy micro-notifications for minor routine actions.
 */
export function detectMeaningfulChanges(params: {
  priorVerifiedCount: number;
  currentVerifiedCount: number;
  priorGapsCount: number;
  currentGapsCount: number;
  priorCompletedStageCount?: number;
  currentCompletedStageCount?: number;
  newEvidence?: EvidenceItem[];
  recentInterviews?: InterviewSession[];
  recentLearning?: LearningActivity[];
  recentPractice?: CodingPracticeActivity[];
  graduationYearChanged?: boolean;
}): MeaningfulChange[] {
  const changes: MeaningfulChange[] = [];
  const now = new Date().toISOString();

  // 1. New verified evidence added (from ERIS or verification review)
  if (params.currentVerifiedCount > params.priorVerifiedCount) {
    const delta = params.currentVerifiedCount - params.priorVerifiedCount;
    changes.push({
      type: "new_verified_evidence",
      description: `${delta} new skill${delta > 1 ? "s" : ""} verified by institutional assessment.`,
      occurredAt: now,
    });
  }

  // 2. Goal gap closed
  if (params.currentGapsCount < params.priorGapsCount) {
    const closed = params.priorGapsCount - params.currentGapsCount;
    changes.push({
      type: "goal_gap_closed",
      description: `${closed} requirement gap${closed > 1 ? "s" : ""} resolved toward your target goal.`,
      occurredAt: now,
    });
  }

  // 3. Roadmap stage completed
  if (
    params.currentCompletedStageCount !== undefined &&
    params.priorCompletedStageCount !== undefined &&
    params.currentCompletedStageCount > params.priorCompletedStageCount
  ) {
    changes.push({
      type: "roadmap_stage_completed",
      description: "A major milestone on your personalized roadmap has been completed.",
      occurredAt: now,
    });
  }

  // 4. Interview feedback available (MentorMaze)
  if (params.recentInterviews && params.recentInterviews.length > 0) {
    const latest = params.recentInterviews[0];
    const isRecent = Date.now() - new Date(latest.completedAt).getTime() < 3600000 * 24; // within 24h
    if (isRecent) {
      changes.push({
        type: "interview_feedback_available",
        description: `Feedback and dimension evaluations are available for your ${latest.targetRole} interview in MentorMaze.`,
        occurredAt: latest.completedAt,
        relatedEntityId: latest.id,
      });
    }
  }

  // 5. Graduation context changed
  if (params.graduationYearChanged) {
    changes.push({
      type: "graduation_context_changed",
      description: "Academic timeline updated. Recommendations adjusted for your graduation target.",
      occurredAt: now,
    });
  }

  return changes;
}
