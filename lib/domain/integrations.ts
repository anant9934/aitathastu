import type { EvidenceItem } from "./evidence";

export type ProducerType = "eris" | "ai_interview" | "study_lpu" | "padho_code" | "mentormaze";

export type EventType =
  | "eris.assessment.completed"
  | "eris.assessment.reviewed"
  | "ai_interview.session.completed"
  | "ai_interview.session.reviewed"
  | "study_lpu.module.started"
  | "study_lpu.module.completed"
  | "study_lpu.topic.completed"
  | "study_lpu.course.completed"
  | "padho_code.topic.started"
  | "padho_code.topic.progressed"
  | "padho_code.challenge.completed"
  | "padho_code.practice.completed"
  | "padho_code.session.completed"
  | "mentormaze.interview.started"
  | "mentormaze.interview.completed"
  | "mentormaze.interview.reviewed";

export type ProcessingStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "identity_unresolved"
  | "rejected";

export type MeasurementType = "score" | "band" | "pass_fail" | "rubric_level";

export type IntegrationIdentityLink = {
  id: string;
  organizationId: string;
  producer: ProducerType;
  externalSubjectId: string;
  personId: string;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentAttempt = {
  id: string;
  personId: string;
  organizationId: string;
  producerEventId: string;
  externalAssessmentId: string;
  assessmentTitle: string;
  assessmentType: string;
  rubricVersion: string;
  startedAt?: string | null;
  completedAt: string;
  reviewStatus: string;
  createdAt: string;
  topics?: AssessmentTopicResult[];
  results?: AssessmentResult[];
};

export type AssessmentResult = {
  id: string;
  attemptId: string;
  overallResult?: string | null;
  maxResult?: string | null;
  resultType: MeasurementType;
  reviewedAt?: string | null;
  createdAt: string;
};

export type AssessmentTopicResult = {
  id: string;
  attemptId: string;
  topicKey: string;
  topicLabel: string;
  value: string;
  maxValue?: string | null;
  measurementType: MeasurementType;
  createdAt: string;
};

export type InterviewSession = {
  id: string;
  personId: string;
  organizationId: string;
  producerEventId: string;
  externalInterviewId: string;
  targetRole: string;
  rubricVersion: string;
  completedAt: string;
  reviewStatus: string;
  createdAt: string;
  dimensions?: InterviewDimensionResult[];
};

export type InterviewDimensionResult = {
  id: string;
  sessionId: string;
  dimensionKey: string;
  dimensionLabel: string;
  value: string;
  scaleMin: string;
  scaleMax: string;
  explanation: string;
  createdAt: string;
};

// Phase C: Study LPU normalized learning activity
export type LearningActivity = {
  id: string;
  personId: string;
  organizationId: string;
  producerEventId: string;
  source: "study_lpu";
  courseId?: string | null;
  courseTitle?: string | null;
  moduleId?: string | null;
  moduleTitle?: string | null;
  topicKey?: string | null;
  topicTitle?: string | null;
  status: "started" | "progressed" | "completed";
  durationMinutes?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  sourceReference?: string | null;
  createdAt: string;
};

// Phase C: Padho Code normalized coding practice activity
export type CodingPracticeActivity = {
  id: string;
  personId: string;
  organizationId: string;
  producerEventId: string;
  source: "padho_code";
  language?: string | null;
  topic: string;
  topicKey: string;
  challengeId?: string | null;
  difficulty?: string | null;
  status: "started" | "progressed" | "completed";
  attempts?: number | null;
  mappedSkills: string[];
  completedAt?: string | null;
  sourceReference?: string | null;
  createdAt: string;
};

// Phase C: Unified student activity (read model for dashboard)
export type StudentActivity = {
  id: string;
  personId: string;
  source: "study_lpu" | "padho_code" | "eris" | "mentormaze" | "github" | "project" | "event";
  activityType: string;
  title: string;
  status: string;
  occurredAt: string;
  sourceReference?: string | null;
  linkedSkills: string[];
  linkedGoal?: string | null;
  metadata?: Record<string, unknown>;
};

// Phase C: Continue Where You Left Off action
export type ContinuationAction = {
  source: "study_lpu" | "padho_code" | "eris" | "mentormaze" | "project";
  title: string;
  description: string;
  actionUrl?: string;
  priority: number;
};

// Phase C: Learning Monitor result
export type LearningMonitorResult = {
  completedLearning: number;
  completedPractice: number;
  completedBuild: number;
  completedVerify: number;
  completedInterview: number;
  topicsLearnedButNotPracticed: string[];
  topicsLearnedButNotBuilt: string[];
  topicsLearnedButNotVerified: string[];
  insight?: string;
};

// Phase C: Handoff token (NO PII, short-lived)
export type AppHandoffToken = {
  tokenId: string;
  personRef: string; // opaque reference, not raw personId
  targetApp: "study_lpu" | "padho_code" | "eris" | "mentormaze";
  targetActivity?: string;
  goalContext?: string;
  returnUrl: string;
  expiresAt: string;
  issuedAt: string;
};

// Phase C: Meaningful change types
export type MeaningfulChangeType =
  | "new_verified_evidence"
  | "goal_gap_closed"
  | "roadmap_stage_completed"
  | "new_priority_gap"
  | "interview_feedback_available"
  | "project_evidence_improved"
  | "graduation_context_changed"
  | "learning_activity_added"
  | "practice_activity_added";

export type MeaningfulChange = {
  type: MeaningfulChangeType;
  description: string;
  occurredAt: string;
  relatedEntityId?: string;
};

// Prohibited unscientific, invasive, or non-content-based dimension keywords
export const DISALLOWED_INTERVIEW_DIMENSION_KEYWORDS = [
  "emotion",
  "facial",
  "face",
  "attractiveness",
  "honesty",
  "lie",
  "personality",
  "mental",
  "mood",
  "temperament",
  "race",
  "gender",
  "accent",
  "phrenology",
  "sentiment_microexpression",
];

export function isDisallowedInterviewDimension(dimensionKey: string, dimensionLabel: string): boolean {
  const normalized = `${dimensionKey} ${dimensionLabel}`.toLowerCase();
  return DISALLOWED_INTERVIEW_DIMENSION_KEYWORDS.some((kw) => normalized.includes(kw));
}

// =========================================================================
// Phase C: Deterministic Padho Code Topic → Skill Mapping
// =========================================================================
export const PADHO_CODE_SKILL_MAP: Record<string, string[]> = {
  python_basics: ["Python"],
  python_advanced: ["Python"],
  python_oop: ["Python", "Object-oriented programming"],
  python_data_structures: ["Python", "DSA"],
  python_functional: ["Python"],
  arrays: ["DSA", "Arrays"],
  linked_lists: ["DSA", "Linked Lists"],
  stacks_queues: ["DSA", "Stacks and Queues"],
  trees: ["DSA", "Trees"],
  graphs: ["DSA", "Graphs"],
  sorting_algorithms: ["DSA", "Sorting Algorithms"],
  searching_algorithms: ["DSA", "Searching Algorithms"],
  dynamic_programming: ["DSA", "Dynamic Programming"],
  recursion: ["DSA", "Recursion"],
  greedy: ["DSA", "Greedy Algorithms"],
  backtracking: ["DSA", "Backtracking"],
  hash_tables: ["DSA", "Hash Tables"],
  binary_search: ["DSA", "Binary Search"],
  oop: ["Object-oriented programming"],
  design_patterns: ["Object-oriented programming", "Design Patterns"],
  solid_principles: ["Object-oriented programming", "SOLID"],
  numpy: ["NumPy", "Python"],
  pandas: ["Pandas", "Python"],
  sklearn: ["Scikit-Learn", "Machine Learning"],
  pytorch_basics: ["PyTorch", "Deep Learning"],
  tensorflow_basics: ["TensorFlow", "Deep Learning"],
  ml_math: ["Mathematics", "Machine Learning"],
  linear_regression: ["Machine Learning", "Statistics"],
  classification: ["Machine Learning"],
  neural_networks: ["Deep Learning", "Neural Networks"],
  sql_basics: ["SQL"],
  sql_advanced: ["SQL"],
  complexity_analysis: ["DSA", "Algorithms"],
  string_manipulation: ["DSA", "Strings"],
};

/**
 * Deterministically maps a Padho Code topic key to skill labels.
 * Falls back to empty array if no mapping exists — never uses LLM.
 */
export function mapPadhoCodeTopicToSkills(topicKey: string): string[] {
  const normalized = topicKey.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return PADHO_CODE_SKILL_MAP[normalized] || [];
}

// =========================================================================
// Payload Types
// =========================================================================

export type ErisPayload = {
  producer: string;
  externalEventId: string;
  payloadVersion: number | string;
  occurredAt?: string;
  organizationId?: string;
  producerInstanceId?: string;
  student: { externalStudentId: string; email?: string };
  assessment: {
    externalAssessmentId: string;
    title: string;
    type?: string;
    rubricVersion?: string;
    startedAt?: string;
    completedAt?: string;
    overallScore?: number | string;
    maxScore?: number | string;
    resultType?: MeasurementType;
  };
  topics: Array<{
    topicKey: string;
    topicLabel: string;
    value: number | string;
    maxValue?: number | string;
    measurementType?: MeasurementType;
  }>;
};

export type AiInterviewPayload = {
  producer: string;
  externalEventId: string;
  payloadVersion: number | string;
  occurredAt?: string;
  organizationId?: string;
  producerInstanceId?: string;
  student: { externalStudentId: string; email?: string };
  session: {
    externalInterviewId: string;
    targetRole: string;
    rubricVersion?: string;
    completedAt?: string;
  };
  dimensions: Array<{
    dimensionKey: string;
    dimensionLabel: string;
    value: number | string;
    scaleMin?: number | string;
    scaleMax?: number | string;
    explanation: string;
  }>;
};

export type StudyLpuPayload = {
  producer: "study_lpu";
  externalEventId: string;
  payloadVersion: number | string;
  occurredAt?: string;
  organizationId?: string;
  student: { externalStudentId: string };
  event: {
    eventType: "module.started" | "module.completed" | "topic.completed" | "course.completed";
    courseId?: string;
    courseTitle?: string;
    moduleId?: string;
    moduleTitle?: string;
    topicKey?: string;
    topicTitle?: string;
    startedAt?: string;
    completedAt?: string;
    durationMinutes?: number;
  };
};

export type PadhoCodePayload = {
  producer: "padho_code";
  externalEventId: string;
  payloadVersion: number | string;
  occurredAt?: string;
  organizationId?: string;
  student: { externalStudentId: string };
  activity: {
    eventType: "topic.started" | "topic.progressed" | "challenge.completed" | "practice.completed" | "session.completed";
    topic: string;
    topicKey: string;
    language?: string;
    challengeId?: string;
    difficulty?: "easy" | "medium" | "hard";
    attempts?: number;
    status: "started" | "progressed" | "completed";
    completedAt?: string;
  };
};

export type MentorMazePayload = {
  producer: "mentormaze";
  externalEventId: string;
  payloadVersion: number | string;
  occurredAt?: string;
  organizationId?: string;
  student: { externalStudentId: string };
  session: {
    externalInterviewId: string;
    targetRole: string;
    rubricVersion?: string;
    completedAt?: string;
  };
  dimensions: Array<{
    dimensionKey: string;
    dimensionLabel: string;
    value: number | string;
    scaleMin?: number | string;
    scaleMax?: number | string;
    explanation: string;
  }>;
};

// =========================================================================
// Payload Validators
// =========================================================================

export function validateErisPayload(rawPayload: unknown): { valid: boolean; error?: string; data?: ErisPayload } {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { valid: false, error: "Missing or invalid JSON payload." };
  }
  const p = rawPayload as Record<string, unknown>;
  if (!p.producer || p.producer !== "eris") {
    return { valid: false, error: "Producer must be 'eris'." };
  }
  if (!p.externalEventId || typeof p.externalEventId !== "string") {
    return { valid: false, error: "Missing or invalid externalEventId." };
  }
  if (p.payloadVersion !== 1 && p.payloadVersion !== "1") {
    return { valid: false, error: `Unsupported payloadVersion: ${p.payloadVersion}. Expected version 1.` };
  }
  const student = p.student as { externalStudentId?: string } | undefined;
  if (!student || !student.externalStudentId) {
    return { valid: false, error: "Missing student.externalStudentId." };
  }
  const assessment = p.assessment as { externalAssessmentId?: string; title?: string } | undefined;
  if (!assessment || !assessment.externalAssessmentId || !assessment.title) {
    return { valid: false, error: "Missing assessment.externalAssessmentId or assessment.title." };
  }
  if (!Array.isArray(p.topics) || p.topics.length === 0) {
    return { valid: false, error: "Assessment must include at least one topic in topics array." };
  }
  return { valid: true, data: rawPayload as ErisPayload };
}

export function validateAiInterviewPayload(rawPayload: unknown): { valid: boolean; error?: string; data?: AiInterviewPayload } {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { valid: false, error: "Missing or invalid JSON payload." };
  }
  const p = rawPayload as Record<string, unknown>;
  if (!p.producer || p.producer !== "ai_interview") {
    return { valid: false, error: "Producer must be 'ai_interview'." };
  }
  if (!p.externalEventId || typeof p.externalEventId !== "string") {
    return { valid: false, error: "Missing or invalid externalEventId." };
  }
  if (p.payloadVersion !== 1 && p.payloadVersion !== "1") {
    return { valid: false, error: `Unsupported payloadVersion: ${p.payloadVersion}. Expected version 1.` };
  }
  const student = p.student as { externalStudentId?: string } | undefined;
  if (!student || !student.externalStudentId) {
    return { valid: false, error: "Missing student.externalStudentId." };
  }
  const session = p.session as { externalInterviewId?: string; targetRole?: string } | undefined;
  if (!session || !session.externalInterviewId || !session.targetRole) {
    return { valid: false, error: "Missing session.externalInterviewId or session.targetRole." };
  }
  if (!Array.isArray(p.dimensions) || p.dimensions.length === 0) {
    return { valid: false, error: "Interview must include at least one dimension in dimensions array." };
  }
  for (const dim of p.dimensions as Array<{ dimensionKey?: string; dimensionLabel?: string }>) {
    if (isDisallowedInterviewDimension(dim.dimensionKey || "", dim.dimensionLabel || "")) {
      return {
        valid: false,
        error: `Prohibited dimension detected: '${dim.dimensionKey || dim.dimensionLabel}'. AI Tathastu prohibits emotion, personality, facial, and non-content traits.`,
      };
    }
  }
  return { valid: true, data: rawPayload as AiInterviewPayload };
}

export function validateStudyLpuPayload(rawPayload: unknown): { valid: boolean; error?: string; data?: StudyLpuPayload } {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { valid: false, error: "Missing or invalid JSON payload." };
  }
  const p = rawPayload as Record<string, unknown>;
  if (!p.producer || p.producer !== "study_lpu") {
    return { valid: false, error: "Producer must be 'study_lpu'." };
  }
  if (!p.externalEventId || typeof p.externalEventId !== "string") {
    return { valid: false, error: "Missing or invalid externalEventId." };
  }
  if (p.payloadVersion !== 1 && p.payloadVersion !== "1") {
    return { valid: false, error: `Unsupported payloadVersion: ${p.payloadVersion}. Expected version 1.` };
  }
  const student = p.student as { externalStudentId?: string } | undefined;
  if (!student || !student.externalStudentId) {
    return { valid: false, error: "Missing student.externalStudentId." };
  }
  const event = p.event as { eventType?: string } | undefined;
  if (!event || !event.eventType) {
    return { valid: false, error: "Missing event.eventType." };
  }
  const validEventTypes = ["module.started", "module.completed", "topic.completed", "course.completed"];
  if (!validEventTypes.includes(event.eventType)) {
    return { valid: false, error: `Invalid event.eventType: '${event.eventType}'. Must be one of: ${validEventTypes.join(", ")}.` };
  }
  return { valid: true, data: rawPayload as StudyLpuPayload };
}

export function validatePadhoCodePayload(rawPayload: unknown): { valid: boolean; error?: string; data?: PadhoCodePayload } {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { valid: false, error: "Missing or invalid JSON payload." };
  }
  const p = rawPayload as Record<string, unknown>;
  if (!p.producer || p.producer !== "padho_code") {
    return { valid: false, error: "Producer must be 'padho_code'." };
  }
  if (!p.externalEventId || typeof p.externalEventId !== "string") {
    return { valid: false, error: "Missing or invalid externalEventId." };
  }
  if (p.payloadVersion !== 1 && p.payloadVersion !== "1") {
    return { valid: false, error: `Unsupported payloadVersion: ${p.payloadVersion}. Expected version 1.` };
  }
  const student = p.student as { externalStudentId?: string } | undefined;
  if (!student || !student.externalStudentId) {
    return { valid: false, error: "Missing student.externalStudentId." };
  }
  const activity = p.activity as { topic?: string; topicKey?: string; status?: string } | undefined;
  if (!activity || !activity.topic || !activity.topicKey || !activity.status) {
    return { valid: false, error: "Missing activity.topic, activity.topicKey, or activity.status." };
  }
  return { valid: true, data: rawPayload as PadhoCodePayload };
}

export function validateMentorMazePayload(rawPayload: unknown): { valid: boolean; error?: string; data?: MentorMazePayload } {
  if (!rawPayload || typeof rawPayload !== "object") {
    return { valid: false, error: "Missing or invalid JSON payload." };
  }
  const p = rawPayload as Record<string, unknown>;
  if (!p.producer || p.producer !== "mentormaze") {
    return { valid: false, error: "Producer must be 'mentormaze'." };
  }
  if (!p.externalEventId || typeof p.externalEventId !== "string") {
    return { valid: false, error: "Missing or invalid externalEventId." };
  }
  if (p.payloadVersion !== 1 && p.payloadVersion !== "1") {
    return { valid: false, error: `Unsupported payloadVersion: ${p.payloadVersion}. Expected version 1.` };
  }
  const student = p.student as { externalStudentId?: string } | undefined;
  if (!student || !student.externalStudentId) {
    return { valid: false, error: "Missing student.externalStudentId." };
  }
  const session = p.session as { externalInterviewId?: string; targetRole?: string } | undefined;
  if (!session || !session.externalInterviewId || !session.targetRole) {
    return { valid: false, error: "Missing session.externalInterviewId or session.targetRole." };
  }
  if (!Array.isArray(p.dimensions) || p.dimensions.length === 0) {
    return { valid: false, error: "Interview must include at least one dimension in dimensions array." };
  }
  for (const dim of p.dimensions as Array<{ dimensionKey?: string; dimensionLabel?: string }>) {
    if (isDisallowedInterviewDimension(dim.dimensionKey || "", dim.dimensionLabel || "")) {
      return {
        valid: false,
        error: `Prohibited dimension detected: '${dim.dimensionKey || dim.dimensionLabel}'. MentorMaze prohibits emotion, personality, facial, and non-content traits.`,
      };
    }
  }
  return { valid: true, data: rawPayload as MentorMazePayload };
}

// =========================================================================
// Evidence Mappers
// =========================================================================

/**
 * Maps an ERIS assessment topic into a Tathastu verified institutional EvidenceItem.
 */
export function mapErisTopicToEvidence(
  attempt: { id: string; assessmentTitle: string; completedAt: string },
  topic: {
    topicKey: string;
    topicLabel: string;
    value: number | string;
    maxValue?: number | string;
    measurementType: string;
  }
): Omit<EvidenceItem, "id" | "createdAt"> {
  const maxDisplay = topic.maxValue ? `/${topic.maxValue}` : "";
  return {
    category: "assessment",
    subject: topic.topicLabel,
    value: `ERIS Assessment: ${attempt.assessmentTitle} — ${topic.topicLabel} (${topic.value}${maxDisplay} ${topic.measurementType})`,
    source: "institutional",
    verificationStatus: "verified",
    sourceReference: attempt.id,
    observedAt: attempt.completedAt,
    interpretation: `Verified assessment evidence from ERIS (${attempt.assessmentTitle}). Demonstrates assessed proficiency in ${topic.topicLabel}.`,
    whyItMatters: `Standardized assessment evidence supporting ${topic.topicLabel}.`,
    verificationMethod: "assessment",
    verifiedAt: attempt.completedAt,
  };
}

/**
 * Maps an AI Interview dimension result into a Tathastu verified performance EvidenceItem.
 */
export function mapInterviewDimensionToEvidence(
  session: { id: string; targetRole: string; completedAt: string },
  dim: {
    dimensionKey: string;
    dimensionLabel: string;
    value: number | string;
    scaleMin?: number | string;
    scaleMax?: number | string;
    explanation: string;
  }
): Omit<EvidenceItem, "id" | "createdAt"> {
  const scaleMax = dim.scaleMax || 5;
  return {
    category: "interview",
    subject: dim.dimensionLabel,
    value: `${dim.dimensionLabel}: ${dim.value}/${scaleMax} — ${dim.explanation}`,
    source: "institutional",
    verificationStatus: "verified",
    sourceReference: session.id,
    observedAt: session.completedAt,
    interpretation: `Observed performance in ${session.targetRole} AI Interview session.`,
    whyItMatters: `Demonstrated technical communication, reasoning, and problem solving for ${session.targetRole}.`,
    verificationMethod: "interview_rubric",
    verifiedAt: session.completedAt,
  };
}

/**
 * Phase C: Maps a MentorMaze interview dimension.
 * Evidence remains session-specific — NOT a permanent trait label.
 */
export function mapMentorMazeDimensionToEvidence(
  session: { id: string; targetRole: string; completedAt: string },
  dim: {
    dimensionKey: string;
    dimensionLabel: string;
    value: number | string;
    scaleMin?: number | string;
    scaleMax?: number | string;
    explanation: string;
  }
): Omit<EvidenceItem, "id" | "createdAt"> {
  const scaleMax = dim.scaleMax || 5;
  return {
    category: "interview",
    subject: dim.dimensionLabel,
    value: `${dim.dimensionLabel}: ${dim.value}/${scaleMax} — ${dim.explanation}`,
    source: "institutional",
    verificationStatus: "verified",
    sourceReference: session.id,
    observedAt: session.completedAt,
    interpretation: `Observed performance in ${session.targetRole} MentorMaze interview session. This is session-specific performance evidence, not a permanent trait.`,
    whyItMatters: `Demonstrated ${dim.dimensionLabel} for the ${session.targetRole} target role in MentorMaze.`,
    verificationMethod: "interview_rubric",
    verifiedAt: session.completedAt,
  };
}
