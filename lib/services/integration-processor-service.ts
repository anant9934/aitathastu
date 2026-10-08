import {
  getIntegrationCredentialByKey,
  getIdentityLink,
  getIntegrationEventByProducerAndExternalId,
  recordIntegrationEvent,
  updateIntegrationEventStatus,
  recordAssessmentAttempt,
  recordInterviewSession,
  recordLearningActivity,
  recordCodingPracticeActivity,
} from "../repositories/integration-repository";
import { createEvidenceRecord } from "../repositories/evidence-repository";
import { createJourneyEventRecord } from "../repositories/journey-repository";
import {
  validateErisPayload,
  validateAiInterviewPayload,
  validateStudyLpuPayload,
  validatePadhoCodePayload,
  validateMentorMazePayload,
  mapErisTopicToEvidence,
  mapInterviewDimensionToEvidence,
  mapMentorMazeDimensionToEvidence,
  mapPadhoCodeTopicToSkills,
} from "../domain/integrations";

export type IngestionResponse = {
  status: number;
  data: {
    status: "processed" | "already_processed" | "identity_unresolved" | "rejected" | "failed";
    eventId?: string;
    attemptId?: string;
    sessionId?: string;
    learningActivityId?: string;
    codingActivityId?: string;
    evidenceCreated?: number;
    message?: string;
    error?: string;
  };
};

/**
 * Ingest and process an ERIS assessment completed event.
 */
export async function processErisEvent(params: {
  rawKey: string | null;
  payload: unknown;
}): Promise<IngestionResponse> {
  // 1. Authenticate producer
  if (!params.rawKey) {
    return {
      status: 401,
      data: { status: "failed", error: "Missing X-Integration-Key header." },
    };
  }

  const authRecord = await getIntegrationCredentialByKey(params.rawKey);
  if (!authRecord) {
    return {
      status: 401,
      data: { status: "failed", error: "Invalid integration credentials." },
    };
  }

  const { credential, organization } = authRecord;

  // 2. Validate producer type
  if (credential.producer !== "eris") {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: `Credential producer '${credential.producer}' cannot submit ERIS events.`,
      },
    };
  }

  // 3. Validate payload schema & version
  const valResult = validateErisPayload(params.payload);
  if (!valResult.valid || !valResult.data) {
    return {
      status: 400,
      data: { status: "rejected", error: valResult.error || "Invalid payload." },
    };
  }

  const payload = valResult.data;

  // 4. Verify organization boundary
  if (payload.organizationId && payload.organizationId !== organization.id) {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: "Organization boundary violation: payload organization does not match credential.",
      },
    };
  }

  // 5. Check Idempotency
  const existingEvent = await getIntegrationEventByProducerAndExternalId("eris", payload.externalEventId);
  if (existingEvent) {
    if (existingEvent.processingStatus === "processed") {
      return {
        status: 200,
        data: {
          status: "already_processed",
          eventId: existingEvent.id,
          message: "Event already processed previously.",
        },
      };
    }
  }

  // 6. Resolve Identity Link
  const personId = await getIdentityLink(organization.id, "eris", payload.student.externalStudentId);

  const occurredAt = new Date(payload.occurredAt || payload.assessment.completedAt || Date.now());
  const completedAt = new Date(payload.assessment.completedAt || Date.now());
  const startedAt = payload.assessment.startedAt ? new Date(payload.assessment.startedAt) : undefined;

  if (!personId) {
    // Record event as identity_unresolved — DO NOT guess, DO NOT create evidence
    const event = await recordIntegrationEvent({
      producer: "eris",
      producerInstanceId: payload.producerInstanceId,
      eventType: "eris.assessment.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId: null,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "identity_unresolved",
      errorMessage: `No trusted identity link found for external student ID: '${payload.student.externalStudentId}'.`,
    });

    return {
      status: 200,
      data: {
        status: "identity_unresolved",
        eventId: event.id,
        message: `Identity unresolved for '${payload.student.externalStudentId}'. No evidence created.`,
      },
    };
  }

  // 7. Atomic Process & Record
  try {
    const event = await recordIntegrationEvent({
      producer: "eris",
      producerInstanceId: payload.producerInstanceId,
      eventType: "eris.assessment.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "processing",
    });

    const attempt = await recordAssessmentAttempt({
      personId,
      organizationId: organization.id,
      producerEventId: event.id,
      externalAssessmentId: payload.assessment.externalAssessmentId,
      assessmentTitle: payload.assessment.title,
      assessmentType: payload.assessment.type || "standardized",
      rubricVersion: payload.assessment.rubricVersion || "v1",
      startedAt,
      completedAt,
      overallResult: payload.assessment.overallScore,
      maxResult: payload.assessment.maxScore,
      resultType: payload.assessment.resultType || "score",
      topics: payload.topics.map((t) => ({
        topicKey: t.topicKey,
        topicLabel: t.topicLabel,
        value: t.value,
        maxValue: t.maxValue,
        measurementType: t.measurementType || "score",
      })),
    });

    // 8. Create verified institutional evidence items for each assessed topic
    let evidenceCount = 0;
    for (const topic of payload.topics) {
      const evidenceData = mapErisTopicToEvidence(
        {
          id: attempt.id,
          assessmentTitle: payload.assessment.title,
          completedAt: completedAt.toISOString(),
        },
        { ...topic, measurementType: topic.measurementType || "score" }
      );

      await createEvidenceRecord(personId, evidenceData);
      evidenceCount++;
    }

    // 9. Append Journey Event
    await createJourneyEventRecord(personId, {
      type: "eris_assessment_completed",
      title: `ERIS Assessment: ${payload.assessment.title}`,
      description: `Completed standardized assessment with ${payload.topics.length} verified topics.`,
      relatedEntityId: attempt.id,
      metadata: {
        externalAssessmentId: payload.assessment.externalAssessmentId,
        rubricVersion: payload.assessment.rubricVersion,
        topicsCount: payload.topics.length,
      },
    });

    // 10. Mark Event as processed
    await updateIntegrationEventStatus(event.id, "processed");

    return {
      status: 200,
      data: {
        status: "processed",
        eventId: event.id,
        attemptId: attempt.id,
        evidenceCreated: evidenceCount,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error during assessment processing.";
    console.error("[processErisEvent] Error processing event:", errorMsg);
    return {
      status: 500,
      data: {
        status: "failed",
        error: errorMsg,
      },
    };
  }
}

/**
 * Ingest and process an AI Interview completed event.
 */
export async function processAiInterviewEvent(params: {
  rawKey: string | null;
  payload: unknown;
}): Promise<IngestionResponse> {
  // 1. Authenticate producer
  if (!params.rawKey) {
    return {
      status: 401,
      data: { status: "failed", error: "Missing X-Integration-Key header." },
    };
  }

  const authRecord = await getIntegrationCredentialByKey(params.rawKey);
  if (!authRecord) {
    return {
      status: 401,
      data: { status: "failed", error: "Invalid integration credentials." },
    };
  }

  const { credential, organization } = authRecord;

  // 2. Validate producer type
  if (credential.producer !== "ai_interview") {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: `Credential producer '${credential.producer}' cannot submit AI Interview events.`,
      },
    };
  }

  // 3. Validate payload schema & version (including ethics/safety check)
  const valResult = validateAiInterviewPayload(params.payload);
  if (!valResult.valid || !valResult.data) {
    return {
      status: 400,
      data: { status: "rejected", error: valResult.error || "Invalid payload." },
    };
  }

  const payload = valResult.data;

  // 4. Verify organization boundary
  if (payload.organizationId && payload.organizationId !== organization.id) {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: "Organization boundary violation: payload organization does not match credential.",
      },
    };
  }

  // 5. Check Idempotency
  const existingEvent = await getIntegrationEventByProducerAndExternalId(
    "ai_interview",
    payload.externalEventId
  );
  if (existingEvent) {
    if (existingEvent.processingStatus === "processed") {
      return {
        status: 200,
        data: {
          status: "already_processed",
          eventId: existingEvent.id,
          message: "Event already processed previously.",
        },
      };
    }
  }

  // 6. Resolve Identity Link
  const personId = await getIdentityLink(
    organization.id,
    "ai_interview",
    payload.student.externalStudentId
  );

  const occurredAt = new Date(payload.occurredAt || payload.session.completedAt || Date.now());
  const completedAt = new Date(payload.session.completedAt || Date.now());

  if (!personId) {
    // Record event as identity_unresolved
    const event = await recordIntegrationEvent({
      producer: "ai_interview",
      producerInstanceId: payload.producerInstanceId,
      eventType: "ai_interview.session.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId: null,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "identity_unresolved",
      errorMessage: `No trusted identity link found for external student ID: '${payload.student.externalStudentId}'.`,
    });

    return {
      status: 200,
      data: {
        status: "identity_unresolved",
        eventId: event.id,
        message: `Identity unresolved for '${payload.student.externalStudentId}'. No evidence created.`,
      },
    };
  }

  // 7. Atomic Process & Record
  try {
    const event = await recordIntegrationEvent({
      producer: "ai_interview",
      producerInstanceId: payload.producerInstanceId,
      eventType: "ai_interview.session.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "processing",
    });

    const session = await recordInterviewSession({
      personId,
      organizationId: organization.id,
      producerEventId: event.id,
      externalInterviewId: payload.session.externalInterviewId,
      targetRole: payload.session.targetRole,
      rubricVersion: payload.session.rubricVersion || "v1",
      completedAt,
      dimensions: payload.dimensions.map((d) => ({
        dimensionKey: d.dimensionKey,
        dimensionLabel: d.dimensionLabel,
        value: d.value,
        scaleMin: d.scaleMin || "1",
        scaleMax: d.scaleMax || "5",
        explanation: d.explanation,
      })),
    });

    // 8. Create verified institutional performance evidence items for each dimension
    let evidenceCount = 0;
    for (const dim of payload.dimensions) {
      const evidenceData = mapInterviewDimensionToEvidence(
        {
          id: session.id,
          targetRole: payload.session.targetRole,
          completedAt: completedAt.toISOString(),
        },
        dim
      );

      await createEvidenceRecord(personId, evidenceData);
      evidenceCount++;
    }

    // 9. Append Journey Event
    await createJourneyEventRecord(personId, {
      type: "ai_interview_completed",
      title: `AI Interview: ${payload.session.targetRole}`,
      description: `Completed structured interview across ${payload.dimensions.length} rubric dimensions.`,
      relatedEntityId: session.id,
      metadata: {
        externalInterviewId: payload.session.externalInterviewId,
        rubricVersion: payload.session.rubricVersion,
        dimensionsCount: payload.dimensions.length,
      },
    });

    // 10. Mark Event as processed
    await updateIntegrationEventStatus(event.id, "processed");

    return {
      status: 200,
      data: {
        status: "processed",
        eventId: event.id,
        sessionId: session.id,
        evidenceCreated: evidenceCount,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error during interview processing.";
    console.error("[processAiInterviewEvent] Error processing event:", errorMsg);
    return {
      status: 500,
      data: {
        status: "failed",
        error: errorMsg,
      },
    };
  }
}

/**
 * Ingest and process a Study LPU academic learning event.
 * CRITICAL TRUST SEMANTIC: Learning completion != verified competence.
 * Normalizes into LearningActivity, creates NO verified evidence.
 */
export async function processStudyLpuEvent(params: {
  rawKey: string | null;
  payload: unknown;
}): Promise<IngestionResponse> {
  // 1. Authenticate producer
  if (!params.rawKey) {
    return {
      status: 401,
      data: { status: "failed", error: "Missing X-Integration-Key header." },
    };
  }

  const authRecord = await getIntegrationCredentialByKey(params.rawKey);
  if (!authRecord) {
    return {
      status: 401,
      data: { status: "failed", error: "Invalid integration credentials." },
    };
  }

  const { credential, organization } = authRecord;

  // 2. Validate producer type
  if (credential.producer !== "study_lpu") {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: `Credential producer '${credential.producer}' cannot submit Study LPU events.`,
      },
    };
  }

  // 3. Validate payload schema & version
  const valResult = validateStudyLpuPayload(params.payload);
  if (!valResult.valid || !valResult.data) {
    return {
      status: 400,
      data: { status: "rejected", error: valResult.error || "Invalid payload." },
    };
  }

  const payload = valResult.data;

  // 4. Verify organization boundary
  if (payload.organizationId && payload.organizationId !== organization.id) {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: "Organization boundary violation: payload organization does not match credential.",
      },
    };
  }

  // 5. Check Idempotency
  const existingEvent = await getIntegrationEventByProducerAndExternalId("study_lpu", payload.externalEventId);
  if (existingEvent) {
    if (existingEvent.processingStatus === "processed") {
      return {
        status: 200,
        data: {
          status: "already_processed",
          eventId: existingEvent.id,
          message: "Event already processed previously.",
        },
      };
    }
  }

  // 6. Resolve Identity Link
  const personId = await getIdentityLink(
    organization.id,
    "study_lpu",
    payload.student.externalStudentId
  );

  const occurredAt = new Date(payload.occurredAt || payload.event.completedAt || payload.event.startedAt || Date.now());

  if (!personId) {
    // Record event as identity_unresolved
    const event = await recordIntegrationEvent({
      producer: "study_lpu",
      producerInstanceId: undefined,
      eventType: `study_lpu.${payload.event.eventType}`,
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId: null,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "identity_unresolved",
      errorMessage: `No trusted identity link found for external student ID: '${payload.student.externalStudentId}'.`,
    });

    return {
      status: 200,
      data: {
        status: "identity_unresolved",
        eventId: event.id,
        message: `Identity unresolved for '${payload.student.externalStudentId}'. No learning activity recorded.`,
      },
    };
  }

  // 7. Atomic Process & Record
  try {
    const event = await recordIntegrationEvent({
      producer: "study_lpu",
      producerInstanceId: undefined,
      eventType: `study_lpu.${payload.event.eventType}`,
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "processing",
    });

    const isStarted = payload.event.eventType === "module.started";
    const learningRecord = await recordLearningActivity({
      personId,
      organizationId: organization.id,
      producerEventId: event.id,
      source: "study_lpu",
      courseId: payload.event.courseId,
      courseTitle: payload.event.courseTitle,
      moduleId: payload.event.moduleId,
      moduleTitle: payload.event.moduleTitle,
      topicKey: payload.event.topicKey,
      topicTitle: payload.event.topicTitle,
      status: isStarted ? "started" : "completed",
      durationMinutes: payload.event.durationMinutes,
      startedAt: payload.event.startedAt ? new Date(payload.event.startedAt) : null,
      completedAt: payload.event.completedAt ? new Date(payload.event.completedAt) : null,
      sourceReference: payload.externalEventId,
    });

    // 8. Append Human-Readable Journey Event
    const activityName = payload.event.moduleTitle || payload.event.topicTitle || payload.event.courseTitle || "Module";
    await createJourneyEventRecord(personId, {
      type: isStarted ? "study_lpu_module_started" : "study_lpu_module_completed",
      title: `Study LPU: ${activityName}`,
      description: isStarted
        ? `Started academic module '${activityName}' in Study LPU.`
        : `Completed academic module '${activityName}' in Study LPU. Academic learning recorded.`,
      relatedEntityId: learningRecord.id,
      metadata: {
        courseId: payload.event.courseId,
        moduleId: payload.event.moduleId,
        topicKey: payload.event.topicKey,
        status: learningRecord.status,
      },
    });

    // 9. Mark Event as processed
    await updateIntegrationEventStatus(event.id, "processed");

    return {
      status: 200,
      data: {
        status: "processed",
        eventId: event.id,
        learningActivityId: learningRecord.id,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error during Study LPU processing.";
    console.error("[processStudyLpuEvent] Error:", errorMsg);
    return {
      status: 500,
      data: {
        status: "failed",
        error: errorMsg,
      },
    };
  }
}

/**
 * Ingest and process a Padho Code practice event.
 * CRITICAL TRUST SEMANTIC: Practice demonstrates effort, NOT verified mastery.
 * Maps deterministic skills, stores unverified practice evidence.
 */
export async function processPadhoCodeEvent(params: {
  rawKey: string | null;
  payload: unknown;
}): Promise<IngestionResponse> {
  // 1. Authenticate producer
  if (!params.rawKey) {
    return {
      status: 401,
      data: { status: "failed", error: "Missing X-Integration-Key header." },
    };
  }

  const authRecord = await getIntegrationCredentialByKey(params.rawKey);
  if (!authRecord) {
    return {
      status: 401,
      data: { status: "failed", error: "Invalid integration credentials." },
    };
  }

  const { credential, organization } = authRecord;

  // 2. Validate producer type
  if (credential.producer !== "padho_code") {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: `Credential producer '${credential.producer}' cannot submit Padho Code events.`,
      },
    };
  }

  // 3. Validate payload schema & version
  const valResult = validatePadhoCodePayload(params.payload);
  if (!valResult.valid || !valResult.data) {
    return {
      status: 400,
      data: { status: "rejected", error: valResult.error || "Invalid payload." },
    };
  }

  const payload = valResult.data;

  // 4. Verify organization boundary
  if (payload.organizationId && payload.organizationId !== organization.id) {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: "Organization boundary violation: payload organization does not match credential.",
      },
    };
  }

  // 5. Check Idempotency
  const existingEvent = await getIntegrationEventByProducerAndExternalId("padho_code", payload.externalEventId);
  if (existingEvent) {
    if (existingEvent.processingStatus === "processed") {
      return {
        status: 200,
        data: {
          status: "already_processed",
          eventId: existingEvent.id,
          message: "Event already processed previously.",
        },
      };
    }
  }

  // 6. Resolve Identity Link
  const personId = await getIdentityLink(
    organization.id,
    "padho_code",
    payload.student.externalStudentId
  );

  const occurredAt = new Date(payload.occurredAt || payload.activity.completedAt || Date.now());

  if (!personId) {
    const event = await recordIntegrationEvent({
      producer: "padho_code",
      producerInstanceId: undefined,
      eventType: "padho_code.practice.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId: null,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "identity_unresolved",
      errorMessage: `No trusted identity link found for external student ID: '${payload.student.externalStudentId}'.`,
    });

    return {
      status: 200,
      data: {
        status: "identity_unresolved",
        eventId: event.id,
        message: `Identity unresolved for '${payload.student.externalStudentId}'. No practice evidence created.`,
      },
    };
  }

  // 7. Atomic Process & Record
  try {
    const event = await recordIntegrationEvent({
      producer: "padho_code",
      producerInstanceId: undefined,
      eventType: "padho_code.practice.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "processing",
    });

    const mappedSkills = mapPadhoCodeTopicToSkills(payload.activity.topicKey);

    const codingRecord = await recordCodingPracticeActivity({
      personId,
      organizationId: organization.id,
      producerEventId: event.id,
      source: "padho_code",
      language: payload.activity.language,
      topic: payload.activity.topic,
      topicKey: payload.activity.topicKey,
      challengeId: payload.activity.challengeId,
      difficulty: payload.activity.difficulty,
      status: payload.activity.status,
      attempts: payload.activity.attempts,
      mappedSkills,
      completedAt: payload.activity.completedAt ? new Date(payload.activity.completedAt) : null,
      sourceReference: payload.externalEventId,
    });

    // 8. Create unverified practice evidence item
    await createEvidenceRecord(personId, {
      category: "skill",
      subject: payload.activity.topic,
      value: `Padho Code: ${payload.activity.topic} (${payload.activity.status})`,
      source: "self_reported",
      verificationStatus: "unverified",
      sourceReference: codingRecord.id,
      observedAt: occurredAt.toISOString(),
      interpretation: `Practice exercise completed in Padho Code for ${payload.activity.topic}. Demonstrated practice effort; verification requires ERIS assessment.`,
      whyItMatters: `Practical coding practice strengthens skill demonstration.`,
    });

    // 9. Append Journey Event
    await createJourneyEventRecord(personId, {
      type: "padho_code_practice_completed",
      title: `Padho Code: ${payload.activity.topic}`,
      description: `Practiced ${payload.activity.topic} (${payload.activity.difficulty || "standard"} difficulty). Practice evidence recorded.`,
      relatedEntityId: codingRecord.id,
      metadata: {
        topicKey: payload.activity.topicKey,
        mappedSkills,
        status: payload.activity.status,
      },
    });

    // 10. Mark Event as processed
    await updateIntegrationEventStatus(event.id, "processed");

    return {
      status: 200,
      data: {
        status: "processed",
        eventId: event.id,
        codingActivityId: codingRecord.id,
        evidenceCreated: 1,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error during Padho Code processing.";
    console.error("[processPadhoCodeEvent] Error:", errorMsg);
    return {
      status: 500,
      data: {
        status: "failed",
        error: errorMsg,
      },
    };
  }
}

/**
 * Ingest and process a MentorMaze interview session event.
 * Prohibits emotion/facial/personality traits.
 * Stores session-specific performance evidence (never permanent trait claims).
 */
export async function processMentorMazeEvent(params: {
  rawKey: string | null;
  payload: unknown;
}): Promise<IngestionResponse> {
  // 1. Authenticate producer
  if (!params.rawKey) {
    return {
      status: 401,
      data: { status: "failed", error: "Missing X-Integration-Key header." },
    };
  }

  const authRecord = await getIntegrationCredentialByKey(params.rawKey);
  if (!authRecord) {
    return {
      status: 401,
      data: { status: "failed", error: "Invalid integration credentials." },
    };
  }

  const { credential, organization } = authRecord;

  // 2. Validate producer type
  if (credential.producer !== "mentormaze" && credential.producer !== "ai_interview") {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: `Credential producer '${credential.producer}' cannot submit MentorMaze events.`,
      },
    };
  }

  // 3. Validate payload schema & prohibited dimensions
  const valResult = validateMentorMazePayload(params.payload);
  if (!valResult.valid || !valResult.data) {
    return {
      status: 400,
      data: { status: "rejected", error: valResult.error || "Invalid payload." },
    };
  }

  const payload = valResult.data;

  // 4. Verify organization boundary
  if (payload.organizationId && payload.organizationId !== organization.id) {
    return {
      status: 403,
      data: {
        status: "rejected",
        error: "Organization boundary violation: payload organization does not match credential.",
      },
    };
  }

  // 5. Check Idempotency
  const existingEvent = await getIntegrationEventByProducerAndExternalId("mentormaze", payload.externalEventId);
  if (existingEvent) {
    if (existingEvent.processingStatus === "processed") {
      return {
        status: 200,
        data: {
          status: "already_processed",
          eventId: existingEvent.id,
          message: "Event already processed previously.",
        },
      };
    }
  }

  // 6. Resolve Identity Link
  const personId =
    (await getIdentityLink(organization.id, "mentormaze", payload.student.externalStudentId)) ||
    (await getIdentityLink(organization.id, "ai_interview", payload.student.externalStudentId));

  const occurredAt = new Date(payload.occurredAt || payload.session.completedAt || Date.now());
  const completedAt = new Date(payload.session.completedAt || Date.now());

  if (!personId) {
    const event = await recordIntegrationEvent({
      producer: "mentormaze",
      producerInstanceId: undefined,
      eventType: "mentormaze.interview.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId: null,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "identity_unresolved",
      errorMessage: `No trusted identity link found for external student ID: '${payload.student.externalStudentId}'.`,
    });

    return {
      status: 200,
      data: {
        status: "identity_unresolved",
        eventId: event.id,
        message: `Identity unresolved for '${payload.student.externalStudentId}'. No evidence created.`,
      },
    };
  }

  // 7. Atomic Process & Record
  try {
    const event = await recordIntegrationEvent({
      producer: "mentormaze",
      producerInstanceId: undefined,
      eventType: "mentormaze.interview.completed",
      externalEventId: payload.externalEventId,
      organizationId: organization.id,
      personId,
      occurredAt,
      payloadVersion: Number(payload.payloadVersion) || 1,
      payload,
      processingStatus: "processing",
    });

    const session = await recordInterviewSession({
      personId,
      organizationId: organization.id,
      producerEventId: event.id,
      externalInterviewId: payload.session.externalInterviewId,
      targetRole: payload.session.targetRole,
      rubricVersion: payload.session.rubricVersion || "v1",
      completedAt,
      dimensions: payload.dimensions.map((d) => ({
        dimensionKey: d.dimensionKey,
        dimensionLabel: d.dimensionLabel,
        value: d.value,
        scaleMin: d.scaleMin || "1",
        scaleMax: d.scaleMax || "5",
        explanation: d.explanation,
      })),
    });

    // 8. Create session-specific performance evidence items
    let evidenceCount = 0;
    for (const dim of payload.dimensions) {
      const evidenceData = mapMentorMazeDimensionToEvidence(
        {
          id: session.id,
          targetRole: payload.session.targetRole,
          completedAt: completedAt.toISOString(),
        },
        dim
      );

      await createEvidenceRecord(personId, evidenceData);
      evidenceCount++;
    }

    // 9. Append Journey Event
    await createJourneyEventRecord(personId, {
      type: "mentormaze_interview_completed",
      title: `MentorMaze Interview: ${payload.session.targetRole}`,
      description: `Completed structured interview across ${payload.dimensions.length} rubric dimensions in MentorMaze.`,
      relatedEntityId: session.id,
      metadata: {
        externalInterviewId: payload.session.externalInterviewId,
        rubricVersion: payload.session.rubricVersion,
        dimensionsCount: payload.dimensions.length,
      },
    });

    // 10. Mark Event as processed
    await updateIntegrationEventStatus(event.id, "processed");

    return {
      status: 200,
      data: {
        status: "processed",
        eventId: event.id,
        sessionId: session.id,
        evidenceCreated: evidenceCount,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error during MentorMaze processing.";
    console.error("[processMentorMazeEvent] Error:", errorMsg);
    return {
      status: 500,
      data: {
        status: "failed",
        error: errorMsg,
      },
    };
  }
}

