/**
 * AI TATHASTU — SOURCE PROCESSING JOB SERVICE
 *
 * Lifecycle tracking for import jobs (resume, GitHub, coding profiles, ...).
 *
 * Resume jobs use an explicit state machine:
 *   queued -> processing -> review_ready -> completed
 *                 \-> failed | timed_out | cancelled
 * Other sources still use the legacy running -> completed | failed flow.
 *
 * Every status write is guarded with `WHERE status IN (...)`. Several actors
 * can touch the same job (status polls, a client-side timeout PATCH, the
 * cleanup cron), so a late writer must never move a job out of a terminal
 * state. Metadata writes are merged (jsonb `||`), never replaced, so one
 * writer cannot erase what another recorded.
 */

import crypto from "node:crypto";
import { eq, and, desc, lt, inArray, sql } from "drizzle-orm";
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

export type JobStatus =
  | "queued"
  | "running"
  | "processing"
  | "review_ready"
  | "completed"
  | "failed"
  | "retry"
  | "cancelled"
  | "timed_out";

/** Statuses from which no further transition is allowed. */
export const TERMINAL_JOB_STATUSES: JobStatus[] = ["completed", "failed", "retry", "cancelled", "timed_out"];
/** Statuses in which work may still be running. A failure may only land on these. */
export const IN_FLIGHT_JOB_STATUSES: JobStatus[] = ["queued", "running", "processing"];

export interface CreateJobParams {
  personId: string;
  sourceId: string; // 'resume' | 'github' | 'portfolio' | 'manual' | 'linkedin'
  stage: ProcessingStage;
  status?: Extract<JobStatus, "queued" | "running">;
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
  status?: "failed" | "retry" | "timed_out" | "cancelled";
  metadata?: Record<string, unknown>;
}

export type SourceProcessingJob = typeof sourceProcessingJobs.$inferSelect;

function mergeMetadata(patch: Record<string, unknown>) {
  return sql`coalesce(${sourceProcessingJobs.metadata}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`;
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
      status: params.status ?? "running",
      modelVersion: params.modelVersion ?? null,
      metadata: params.metadata ?? {},
      retryCount: 0,
      startedAt: new Date(),
    });

    return jobId;
  }

  /**
   * Updates the processing stage of a non-terminal job. Metadata is merged.
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
        ...(metadata ? { metadata: mergeMetadata(metadata) } : {}),
      })
      .where(
        and(
          eq(sourceProcessingJobs.id, jobId),
          eq(sourceProcessingJobs.personId, personId),
          inArray(sourceProcessingJobs.status, [...IN_FLIGHT_JOB_STATUSES, "review_ready"])
        )
      );
  }

  /**
   * Atomically moves a job from one of `from` to `to`. Returns the updated row,
   * or null when another writer got there first (or the job is not owned by
   * `personId`). The resume pipeline claims work only through this, so two
   * concurrent status polls can never both process the same job.
   */
  static async transition(params: {
    jobId: string;
    personId: string;
    from: JobStatus[];
    to: JobStatus;
    fromStage?: ProcessingStage;
    stage?: ProcessingStage;
    metadata?: Record<string, unknown>;
    errorCode?: string | null;
    errorMessage?: string | null;
    resultReference?: string;
    incrementRetry?: boolean;
  }): Promise<SourceProcessingJob | null> {
    const db = await getDb();
    const terminal = TERMINAL_JOB_STATUSES.includes(params.to);
    const rows = await db
      .update(sourceProcessingJobs)
      .set({
        status: params.to,
        ...(params.stage ? { stage: params.stage } : {}),
        ...(params.metadata ? { metadata: mergeMetadata(params.metadata) } : {}),
        ...(params.errorCode !== undefined ? { errorCode: params.errorCode } : {}),
        ...(params.errorMessage !== undefined
          ? { errorMessage: params.errorMessage ? params.errorMessage.slice(0, 500) : null }
          : {}),
        ...(params.resultReference ? { resultReference: params.resultReference } : {}),
        ...(params.incrementRetry ? { retryCount: sql`${sourceProcessingJobs.retryCount} + 1` } : {}),
        ...(terminal ? { completedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(sourceProcessingJobs.id, params.jobId),
          eq(sourceProcessingJobs.personId, params.personId),
          inArray(sourceProcessingJobs.status, params.from),
          ...(params.fromStage ? [eq(sourceProcessingJobs.stage, params.fromStage)] : [])
        )
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Marks a job completed. Ignored if the job already reached a terminal state.
   */
  static async completeJob(params: CompleteJobParams): Promise<boolean> {
    const row = await this.transition({
      jobId: params.jobId,
      personId: params.personId,
      from: [...IN_FLIGHT_JOB_STATUSES, "review_ready"],
      to: "completed",
      resultReference: params.resultReference,
      metadata: params.metadata ?? {},
    });
    return Boolean(row);
  }

  /**
   * Marks an in-flight job as failed. Ignored if the job is already terminal or
   * has reached review_ready (a finished extraction must not be flipped to
   * failed by a late client-side timeout).
   */
  static async failJob(params: FailJobParams): Promise<boolean> {
    const finalStatus = params.status ?? (params.canRetry ? "retry" : "failed");
    const row = await this.transition({
      jobId: params.jobId,
      personId: params.personId,
      from: IN_FLIGHT_JOB_STATUSES,
      to: finalStatus,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      metadata: { ...(params.metadata ?? {}), retryable: Boolean(params.canRetry) },
    });
    return Boolean(row);
  }

  /**
   * Explicitly marks a job as timed out.
   */
  static async timeoutJob(params: { jobId: string; personId: string; errorMessage?: string }): Promise<boolean> {
    return this.failJob({
      jobId: params.jobId,
      personId: params.personId,
      errorCode: "TIMED_OUT",
      errorMessage: params.errorMessage ?? "Processing job exceeded client timeout threshold.",
      status: "timed_out",
      canRetry: true,
    });
  }

  /**
   * Explicitly marks a job as cancelled by the user.
   */
  static async cancelJob(params: { jobId: string; personId: string; errorMessage?: string }): Promise<boolean> {
    return this.failJob({
      jobId: params.jobId,
      personId: params.personId,
      errorCode: "CANCELLED",
      errorMessage: params.errorMessage ?? "Processing job cancelled by student.",
      status: "cancelled",
      canRetry: false,
    });
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

  static async getJobForPerson(jobId: string, personId: string): Promise<SourceProcessingJob | null> {
    const db = await getDb();
    const [job] = await db.select().from(sourceProcessingJobs).where(and(
      eq(sourceProcessingJobs.id, jobId), eq(sourceProcessingJobs.personId, personId)
    )).limit(1);
    return job || null;
  }

  /**
   * Recovers jobs stuck in an in-flight state past the threshold runtime.
   */
  static async recoverStuckJobs(thresholdMinutes = 15): Promise<number> {
    const db = await getDb();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const recovered = await db
      .update(sourceProcessingJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode: "TIMEOUT",
        errorMessage: `Processing job timed out after ${thresholdMinutes} minutes and was recovered.`,
      })
      .where(
        and(
          inArray(sourceProcessingJobs.status, IN_FLIGHT_JOB_STATUSES),
          lt(sourceProcessingJobs.startedAt, cutoff)
        )
      )
      .returning();
    return recovered.length;
  }
}
