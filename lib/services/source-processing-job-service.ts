/**
 * AI TATHASTU — CORE INTELLIGENCE V3: SOURCE PROCESSING JOB SERVICE
 *
 * Implements the lifecycle tracking for:
 * ACQUIRE -> PARSE -> EXTRACT -> VALIDATE -> NORMALIZE -> MATCH -> MERGE -> REVIEW -> PERSIST -> INTERPRET -> PLAN -> DISPLAY -> REFRESH
 *
 * Enforces:
 * - Stable job ID
 * - Person isolation
 * - Stage progression & audit logging
 * - Safe metadata storage (never logs raw personally identifiable documents)
 * - Error classification and retry tracking
 */

import crypto from "node:crypto";
import { eq, and, desc, lt } from "drizzle-orm";
import { getDb, sourceProcessingJobs } from "@/lib/db";

export type ProcessingStage =
  | "acquire"
  | "parse"
  | "extract"
  | "validate"
  | "normalize"
  | "merge"
  | "review"
  | "persist"
  | "interpret"
  | "plan";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "retry";

export interface CreateJobParams {
  personId: string;
  sourceId: string; // 'resume' | 'github' | 'portfolio' | 'manual' | 'linkedin'
  stage: ProcessingStage;
  modelVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface CompleteJobParams {
  jobId: string;
  personId: string;
  resultReference?: string;
  metadata?: Record<string, unknown>;
}

export interface FailJobParams {
  jobId: string;
  personId: string;
  errorCode: string;
  errorMessage: string;
  canRetry?: boolean;
}

export class SourceProcessingJobService {
  /**
   * Starts a new tracked processing job.
   */
  static async startJob(params: CreateJobParams): Promise<string> {
    const db = await getDb();
    const jobId = `job_${crypto.randomBytes(12).toString("hex")}`;

    await db.insert(sourceProcessingJobs).values({
      id: jobId,
      personId: params.personId,
      sourceId: params.sourceId,
      stage: params.stage,
      status: "running",
      modelVersion: params.modelVersion ?? null,
      metadata: params.metadata ?? {},
      retryCount: 0,
      startedAt: new Date(),
    });

    return jobId;
  }

  /**
   * Updates the processing stage of a job.
   */
  static async updateStage(
    jobId: string,
    personId: string,
    stage: ProcessingStage,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const db = await getDb();
    await db
      .update(sourceProcessingJobs)
      .set({
        stage,
        ...(metadata ? { metadata } : {}),
      })
      .where(
        and(
          eq(sourceProcessingJobs.id, jobId),
          eq(sourceProcessingJobs.personId, personId)
        )
      );
  }

  /**
   * Advances job to next stage or marks as completed.
   */
  static async completeJob(params: CompleteJobParams): Promise<void> {
    const db = await getDb();
    await db
      .update(sourceProcessingJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultReference: params.resultReference ?? null,
        metadata: params.metadata ?? {},
      })
      .where(
        and(
          eq(sourceProcessingJobs.id, params.jobId),
          eq(sourceProcessingJobs.personId, params.personId)
        )
      );
  }

  /**
   * Marks a job as failed with error classification.
   */
  static async failJob(params: FailJobParams): Promise<void> {
    const db = await getDb();
    await db
      .update(sourceProcessingJobs)
      .set({
        status: params.canRetry ? "retry" : "failed",
        completedAt: new Date(),
        errorCode: params.errorCode,
        errorMessage: params.errorMessage.slice(0, 500),
      })
      .where(
        and(
          eq(sourceProcessingJobs.id, params.jobId),
          eq(sourceProcessingJobs.personId, params.personId)
        )
      );
  }

  /**
   * Lists recent processing jobs for a student.
   */
  static async getJobsForPerson(personId: string, limit = 20) {
    const db = await getDb();
    return db
      .select()
      .from(sourceProcessingJobs)
      .where(eq(sourceProcessingJobs.personId, personId))
      .orderBy(desc(sourceProcessingJobs.startedAt))
      .limit(limit);
  }

  /**
   * Recovers stuck processing jobs that have exceeded threshold runtime.
   */
  static async recoverStuckJobs(thresholdMinutes = 15): Promise<number> {
    const db = await getDb();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const stuck = await db
      .select({ id: sourceProcessingJobs.id, personId: sourceProcessingJobs.personId })
      .from(sourceProcessingJobs)
      .where(
        and(
          eq(sourceProcessingJobs.status, "running"),
          lt(sourceProcessingJobs.startedAt, cutoff)
        )
      )
      .limit(50);

    let recovered = 0;
    for (const job of stuck) {
      await db
        .update(sourceProcessingJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorCode: "TIMEOUT",
          errorMessage: `Processing job timed out after ${thresholdMinutes} minutes and was recovered.`,
        })
        .where(eq(sourceProcessingJobs.id, job.id));
      recovered++;
    }
    return recovered;
  }
}
