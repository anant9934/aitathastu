import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import {
  getDb,
  integrationCredentials,
  integrationIdentityLinks,
  integrationEvents,
  assessmentAttempts,
  assessmentResults,
  assessmentTopicResults,
  interviewSessions,
  interviewDimensionResults,
  learningActivities,
  codingPracticeActivities,
  organizations,
} from "../db";
import type {
  ProducerType,
  ProcessingStatus,
  MeasurementType,
  AssessmentAttempt,
  InterviewSession,
  LearningActivity,
  CodingPracticeActivity,
} from "../domain/integrations";

export function hashIntegrationKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function getIntegrationCredentialByKey(rawKey: string) {
  const db = await getDb();
  const keyHash = hashIntegrationKey(rawKey);

  const rows = await db
    .select({
      credential: integrationCredentials,
      organization: organizations,
    })
    .from(integrationCredentials)
    .innerJoin(organizations, eq(organizations.id, integrationCredentials.organizationId))
    .where(
      and(
        eq(integrationCredentials.keyHash, keyHash),
        eq(integrationCredentials.status, "active"),
        eq(organizations.status, "active")
      )
    )
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0];
}

export async function getIdentityLink(
  organizationId: string,
  producer: ProducerType,
  externalSubjectId: string
): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ personId: integrationIdentityLinks.personId })
    .from(integrationIdentityLinks)
    .where(
      and(
        eq(integrationIdentityLinks.organizationId, organizationId),
        eq(integrationIdentityLinks.producer, producer),
        eq(integrationIdentityLinks.externalSubjectId, externalSubjectId)
      )
    )
    .limit(1);

  return rows.length > 0 ? rows[0].personId : null;
}

export async function getIntegrationEventByProducerAndExternalId(
  producer: ProducerType,
  externalEventId: string
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(integrationEvents)
    .where(
      and(
        eq(integrationEvents.producer, producer),
        eq(integrationEvents.externalEventId, externalEventId)
      )
    )
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function recordIntegrationEvent(params: {
  producer: ProducerType;
  producerInstanceId?: string;
  eventType: string;
  externalEventId: string;
  organizationId: string;
  personId?: string | null;
  occurredAt: Date;
  payloadVersion: number;
  payload: unknown;
  processingStatus: ProcessingStatus;
  errorMessage?: string;
}) {
  const db = await getDb();
  const id = `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [created] = await db
    .insert(integrationEvents)
    .values({
      id,
      producer: params.producer,
      producerInstanceId: params.producerInstanceId || null,
      eventType: params.eventType,
      externalEventId: params.externalEventId,
      organizationId: params.organizationId,
      personId: params.personId || null,
      occurredAt: params.occurredAt,
      payloadVersion: params.payloadVersion,
      payload: params.payload,
      processingStatus: params.processingStatus,
      errorMessage: params.errorMessage || null,
    })
    .returning();

  return created;
}

export async function updateIntegrationEventStatus(
  eventId: string,
  status: ProcessingStatus,
  errorMessage?: string,
  personId?: string
) {
  const db = await getDb();
  const updateData: {
    processingStatus: string;
    errorMessage?: string;
    personId?: string;
  } = { processingStatus: status };
  if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
  if (personId !== undefined) updateData.personId = personId;

  const [updated] = await db
    .update(integrationEvents)
    .set(updateData)
    .where(eq(integrationEvents.id, eventId))
    .returning();

  return updated;
}

export async function recordAssessmentAttempt(params: {
  personId: string;
  organizationId: string;
  producerEventId: string;
  externalAssessmentId: string;
  assessmentTitle: string;
  assessmentType: string;
  rubricVersion: string;
  startedAt?: Date;
  completedAt: Date;
  overallResult?: number | string;
  maxResult?: number | string;
  resultType?: MeasurementType;
  topics: Array<{
    topicKey: string;
    topicLabel: string;
    value: number | string;
    maxValue?: number | string;
    measurementType: MeasurementType;
  }>;
}) {
  const db = await getDb();
  const attemptId = `atm_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [attempt] = await db
    .insert(assessmentAttempts)
    .values({
      id: attemptId,
      personId: params.personId,
      organizationId: params.organizationId,
      producerEventId: params.producerEventId,
      externalAssessmentId: params.externalAssessmentId,
      assessmentTitle: params.assessmentTitle,
      assessmentType: params.assessmentType,
      rubricVersion: params.rubricVersion,
      startedAt: params.startedAt || null,
      completedAt: params.completedAt,
      reviewStatus: "completed",
    })
    .returning();

  if (params.overallResult !== undefined) {
    await db.insert(assessmentResults).values({
      id: `asr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      attemptId,
      overallResult: String(params.overallResult),
      maxResult: params.maxResult !== undefined ? String(params.maxResult) : null,
      resultType: params.resultType || "score",
    });
  }

  for (const topic of params.topics) {
    await db.insert(assessmentTopicResults).values({
      id: `top_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      attemptId,
      topicKey: topic.topicKey,
      topicLabel: topic.topicLabel,
      value: String(topic.value),
      maxValue: topic.maxValue !== undefined ? String(topic.maxValue) : null,
      measurementType: topic.measurementType,
    });
  }

  return attempt;
}

export async function recordInterviewSession(params: {
  personId: string;
  organizationId: string;
  producerEventId: string;
  externalInterviewId: string;
  targetRole: string;
  rubricVersion: string;
  completedAt: Date;
  dimensions: Array<{
    dimensionKey: string;
    dimensionLabel: string;
    value: number | string;
    scaleMin?: number | string;
    scaleMax?: number | string;
    explanation: string;
  }>;
}) {
  const db = await getDb();
  const sessionId = `int_ses_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [session] = await db
    .insert(interviewSessions)
    .values({
      id: sessionId,
      personId: params.personId,
      organizationId: params.organizationId,
      producerEventId: params.producerEventId,
      externalInterviewId: params.externalInterviewId,
      targetRole: params.targetRole,
      rubricVersion: params.rubricVersion,
      completedAt: params.completedAt,
      reviewStatus: "completed",
    })
    .returning();

  for (const dim of params.dimensions) {
    await db.insert(interviewDimensionResults).values({
      id: `int_dim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      sessionId,
      dimensionKey: dim.dimensionKey,
      dimensionLabel: dim.dimensionLabel,
      value: String(dim.value),
      scaleMin: dim.scaleMin !== undefined ? String(dim.scaleMin) : "1",
      scaleMax: dim.scaleMax !== undefined ? String(dim.scaleMax) : "5",
      explanation: dim.explanation,
    });
  }

  return session;
}

export async function getStudentAssessments(personId: string): Promise<AssessmentAttempt[]> {
  const db = await getDb();
  const attempts = await db
    .select()
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.personId, personId))
    .orderBy(desc(assessmentAttempts.completedAt));

  const enriched: AssessmentAttempt[] = [];
  for (const att of attempts) {
    const topics = await db
      .select()
      .from(assessmentTopicResults)
      .where(eq(assessmentTopicResults.attemptId, att.id));

    const results = await db
      .select()
      .from(assessmentResults)
      .where(eq(assessmentResults.attemptId, att.id));

    enriched.push({
      id: att.id,
      personId: att.personId,
      organizationId: att.organizationId,
      producerEventId: att.producerEventId,
      externalAssessmentId: att.externalAssessmentId,
      assessmentTitle: att.assessmentTitle,
      assessmentType: att.assessmentType,
      rubricVersion: att.rubricVersion,
      startedAt: att.startedAt ? att.startedAt.toISOString() : undefined,
      completedAt: att.completedAt.toISOString(),
      reviewStatus: att.reviewStatus,
      createdAt: att.createdAt.toISOString(),
      topics: topics.map((t) => ({
        id: t.id,
        attemptId: t.attemptId,
        topicKey: t.topicKey,
        topicLabel: t.topicLabel,
        value: t.value,
        maxValue: t.maxValue,
        measurementType: t.measurementType as MeasurementType,
        createdAt: t.createdAt.toISOString(),
      })),
      results: results.map((r) => ({
        id: r.id,
        attemptId: r.attemptId,
        overallResult: r.overallResult,
        maxResult: r.maxResult,
        resultType: r.resultType as MeasurementType,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : undefined,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }

  return enriched;
}

export async function getStudentInterviews(personId: string): Promise<InterviewSession[]> {
  const db = await getDb();
  const sessions = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.personId, personId))
    .orderBy(desc(interviewSessions.completedAt));

  const enriched: InterviewSession[] = [];
  for (const ses of sessions) {
    const dimensions = await db
      .select()
      .from(interviewDimensionResults)
      .where(eq(interviewDimensionResults.sessionId, ses.id));

    enriched.push({
      id: ses.id,
      personId: ses.personId,
      organizationId: ses.organizationId,
      producerEventId: ses.producerEventId,
      externalInterviewId: ses.externalInterviewId,
      targetRole: ses.targetRole,
      rubricVersion: ses.rubricVersion,
      completedAt: ses.completedAt.toISOString(),
      reviewStatus: ses.reviewStatus,
      createdAt: ses.createdAt.toISOString(),
      dimensions: dimensions.map((d) => ({
        id: d.id,
        sessionId: d.sessionId,
        dimensionKey: d.dimensionKey,
        dimensionLabel: d.dimensionLabel,
        value: d.value,
        scaleMin: d.scaleMin,
        scaleMax: d.scaleMax,
        explanation: d.explanation,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  }

  return enriched;
}

export async function recordLearningActivity(params: {
  id?: string;
  personId: string;
  organizationId: string;
  producerEventId: string;
  source?: "study_lpu";
  courseId?: string | null;
  courseTitle?: string | null;
  moduleId?: string | null;
  moduleTitle?: string | null;
  topicKey?: string | null;
  topicTitle?: string | null;
  status: "started" | "progressed" | "completed";
  durationMinutes?: number | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  sourceReference?: string | null;
}): Promise<LearningActivity> {
  const db = await getDb();
  const id = params.id || `la_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [created] = await db
    .insert(learningActivities)
    .values({
      id,
      personId: params.personId,
      organizationId: params.organizationId,
      producerEventId: params.producerEventId,
      source: params.source || "study_lpu",
      courseId: params.courseId ?? null,
      courseTitle: params.courseTitle ?? null,
      moduleId: params.moduleId ?? null,
      moduleTitle: params.moduleTitle ?? null,
      topicKey: params.topicKey ?? null,
      topicTitle: params.topicTitle ?? null,
      status: params.status,
      durationMinutes: params.durationMinutes ?? null,
      startedAt: params.startedAt ?? null,
      completedAt: params.completedAt ?? null,
      sourceReference: params.sourceReference ?? null,
    })
    .returning();

  return {
    id: created.id,
    personId: created.personId,
    organizationId: created.organizationId,
    producerEventId: created.producerEventId,
    source: "study_lpu",
    courseId: created.courseId,
    courseTitle: created.courseTitle,
    moduleId: created.moduleId,
    moduleTitle: created.moduleTitle,
    topicKey: created.topicKey,
    topicTitle: created.topicTitle,
    status: created.status as "started" | "progressed" | "completed",
    durationMinutes: created.durationMinutes,
    startedAt: created.startedAt ? created.startedAt.toISOString() : null,
    completedAt: created.completedAt ? created.completedAt.toISOString() : null,
    sourceReference: created.sourceReference,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function getLearningActivitiesByPersonId(personId: string): Promise<LearningActivity[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(learningActivities)
    .where(eq(learningActivities.personId, personId))
    .orderBy(desc(learningActivities.createdAt));

  return rows.map((r) => ({
    id: r.id,
    personId: r.personId,
    organizationId: r.organizationId,
    producerEventId: r.producerEventId,
    source: "study_lpu",
    courseId: r.courseId,
    courseTitle: r.courseTitle,
    moduleId: r.moduleId,
    moduleTitle: r.moduleTitle,
    topicKey: r.topicKey,
    topicTitle: r.topicTitle,
    status: r.status as "started" | "progressed" | "completed",
    durationMinutes: r.durationMinutes,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    sourceReference: r.sourceReference,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function recordCodingPracticeActivity(params: {
  id?: string;
  personId: string;
  organizationId: string;
  producerEventId: string;
  source?: "padho_code";
  language?: string | null;
  topic: string;
  topicKey: string;
  challengeId?: string | null;
  difficulty?: string | null;
  status: "started" | "progressed" | "completed";
  attempts?: number | null;
  mappedSkills?: string[];
  completedAt?: Date | null;
  sourceReference?: string | null;
}): Promise<CodingPracticeActivity> {
  const db = await getDb();
  const id = params.id || `cpa_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const [created] = await db
    .insert(codingPracticeActivities)
    .values({
      id,
      personId: params.personId,
      organizationId: params.organizationId,
      producerEventId: params.producerEventId,
      source: params.source || "padho_code",
      language: params.language ?? null,
      topic: params.topic,
      topicKey: params.topicKey,
      challengeId: params.challengeId ?? null,
      difficulty: params.difficulty ?? null,
      status: params.status,
      attempts: params.attempts ?? null,
      mappedSkills: params.mappedSkills || [],
      completedAt: params.completedAt ?? null,
      sourceReference: params.sourceReference ?? null,
    })
    .returning();

  return {
    id: created.id,
    personId: created.personId,
    organizationId: created.organizationId,
    producerEventId: created.producerEventId,
    source: "padho_code",
    language: created.language,
    topic: created.topic,
    topicKey: created.topicKey,
    challengeId: created.challengeId,
    difficulty: created.difficulty,
    status: created.status as "started" | "progressed" | "completed",
    attempts: created.attempts,
    mappedSkills: Array.isArray(created.mappedSkills) ? (created.mappedSkills as string[]) : [],
    completedAt: created.completedAt ? created.completedAt.toISOString() : null,
    sourceReference: created.sourceReference,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function getCodingActivitiesByPersonId(personId: string): Promise<CodingPracticeActivity[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(codingPracticeActivities)
    .where(eq(codingPracticeActivities.personId, personId))
    .orderBy(desc(codingPracticeActivities.createdAt));

  return rows.map((r) => ({
    id: r.id,
    personId: r.personId,
    organizationId: r.organizationId,
    producerEventId: r.producerEventId,
    source: "padho_code",
    language: r.language,
    topic: r.topic,
    topicKey: r.topicKey,
    challengeId: r.challengeId,
    difficulty: r.difficulty,
    status: r.status as "started" | "progressed" | "completed",
    attempts: r.attempts,
    mappedSkills: Array.isArray(r.mappedSkills) ? (r.mappedSkills as string[]) : [],
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    sourceReference: r.sourceReference,
    createdAt: r.createdAt.toISOString(),
  }));
}

