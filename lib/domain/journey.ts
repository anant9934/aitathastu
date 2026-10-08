export type JourneyEventType =
  | "onboarding_started"
  | "resume_processed"
  | "profile_reviewed"
  | "goal_selected"
  | "goal_changed"
  | "evidence_added"
  | "recommendation_created"
  | "recommendation_started"
  | "recommendation_dismissed"
  | "recommendation_restored"
  | "profile_updated"
  | "account_created"
  | "verification_requested"
  | "verification_review_started"
  | "verification_changes_requested"
  | "verification_completed"
  | "verification_rejected"
  | "verification_resubmitted"
  | "eris_assessment_completed"
  | "eris_evidence_added"
  | "ai_interview_completed"
  | "interview_evidence_added"
  // Phase C
  | "study_lpu_module_started"
  | "study_lpu_module_completed"
  | "study_lpu_topic_completed"
  | "study_lpu_course_completed"
  | "padho_code_practice_started"
  | "padho_code_practice_completed"
  | "padho_code_challenge_completed"
  | "mentormaze_interview_completed"
  | "mentormaze_feedback_available";


export type JourneyEvent = {
  id: string;
  type: JourneyEventType;
  title: string;
  description: string;
  timestamp: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
};

export function createJourneyEvent(
  type: JourneyEventType,
  title: string,
  description: string,
  options?: {
    id?: string;
    timestamp?: string;
    relatedEntityId?: string;
    metadata?: Record<string, unknown>;
  }
): JourneyEvent {
  return {
    id: options?.id || `je_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: title.trim(),
    description: description.trim(),
    timestamp: options?.timestamp || new Date().toISOString(),
    relatedEntityId: options?.relatedEntityId,
    metadata: options?.metadata,
  };
}

export function sortJourneyEventsChronologically(events: JourneyEvent[], ascending = false): JourneyEvent[] {
  return [...events].sort((a, b) => {
    const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return ascending ? -diff : diff;
  });
}
