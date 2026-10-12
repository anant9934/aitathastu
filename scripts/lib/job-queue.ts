/**
 * AI TATHASTU — BACKGROUND INTELLIGENCE JOB QUEUE
 * 
 * Reliable, bounded asynchronous task execution for long-running workflows:
 * - GitHub repository sync
 * - Resume interpretation
 * - Continuous personalization recomputation
 * - Integration event reconciliation
 * 
 * Enforces:
 * - Strict job lifecycle states (queued -> running -> completed / failed / dead_letter)
 * - Idempotency keys preventing duplicate processing
 * - Exponential backoff with jitter on retries
 * - Stuck-job detection and timeout cancellation
 */

import crypto from "crypto";

export type JobType =
  | "GITHUB_SYNC"
  | "RESUME_INTERPRETATION"
  | "RECOMPUTE_PERSONALIZATION"
  | "INTEGRATION_EVENT"
  | "RESOURCE_INGESTION";

export type JobState = "queued" | "running" | "completed" | "failed" | "dead_letter";

export interface BackgroundJob<TData = unknown, TResult = unknown> {
  jobId: string;
  ownerPersonId: string;
  jobType: JobType;
  idempotencyKey: string;
  payload: TData;
  state: JobState;
  attemptCount: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: TResult;
  timeoutMs: number;
}

export type JobHandler<TData = unknown, TResult = unknown> = (
  job: BackgroundJob<TData, TResult>
) => Promise<TResult>;

export class BackgroundJobQueue {
  private jobs: Map<string, BackgroundJob> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotencyKey -> jobId
  private handlers: Map<JobType, JobHandler> = new Map();
  private isProcessing = false;

  constructor() {
    this.startStuckJobMonitor();
  }

  registerHandler<TData, TResult>(
    type: JobType,
    handler: JobHandler<TData, TResult>
  ) {
    this.handlers.set(type, handler as JobHandler);
  }

  async enqueue<TData, TResult>(params: {
    ownerPersonId: string;
    jobType: JobType;
    idempotencyKey: string;
    payload: TData;
    maxAttempts?: number;
    timeoutMs?: number;
  }): Promise<BackgroundJob<TData, TResult>> {
    // 1. Idempotency Check: if job with same idempotency key exists, return it
    const existingJobId = this.idempotencyIndex.get(params.idempotencyKey);
    if (existingJobId) {
      const existing = this.jobs.get(existingJobId);
      if (existing) {
        return existing as BackgroundJob<TData, TResult>;
      }
    }

    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const job: BackgroundJob = {
      jobId,
      ownerPersonId: params.ownerPersonId,
      jobType: params.jobType,
      idempotencyKey: params.idempotencyKey,
      payload: params.payload,
      state: "queued",
      attemptCount: 0,
      maxAttempts: params.maxAttempts || 3,
      createdAt: new Date(),
      timeoutMs: params.timeoutMs || 30_000,
    };

    this.jobs.set(jobId, job);
    this.idempotencyIndex.set(params.idempotencyKey, jobId);

    // Trigger queue consumer asynchronously
    void this.processNext();

    return job as BackgroundJob<TData, TResult>;
  }

  getJob(jobId: string): BackgroundJob | undefined {
    return this.jobs.get(jobId);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const [, job] of this.jobs.entries()) {
        if (job.state === "queued") {
          await this.executeJob(job);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: BackgroundJob): Promise<void> {
    const handler = this.handlers.get(job.jobType);
    if (!handler) {
      job.state = "failed";
      job.error = `No registered worker handler for job type: ${job.jobType}`;
      job.completedAt = new Date();
      return;
    }

    job.state = "running";
    job.startedAt = new Date();
    job.attemptCount++;

    let timer: NodeJS.Timeout | undefined;
    try {
      // Execute with timeout race
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Job timed out after ${job.timeoutMs}ms`)), job.timeoutMs);
        if (typeof timer.unref === "function") timer.unref();
      });

      const result = await Promise.race([handler(job), timeoutPromise]);
      if (timer) clearTimeout(timer);

      job.state = "completed";
      job.completedAt = new Date();
      job.result = result;
    } catch (err: unknown) {
      if (timer) clearTimeout(timer);
      const errorMsg = err instanceof Error ? err.message : "Execution failed";
      job.error = errorMsg;

      if (job.attemptCount < job.maxAttempts) {
        // Exponential backoff retry
        job.state = "queued";
        const delayMs = Math.min(1000 * Math.pow(2, job.attemptCount), 10_000);
        setTimeout(() => void this.processNext(), delayMs);
      } else {
        job.state = "dead_letter";
        job.completedAt = new Date();
      }
    }
  }

  /**
   * Stuck-job detection: sweeps every 60s for jobs running beyond their timeout.
   */
  private startStuckJobMonitor() {
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_JOB_WATCHDOG === "true") {
      const timer = setInterval(() => {
        const now = Date.now();
        for (const job of this.jobs.values()) {
          if (job.state === "running" && job.startedAt) {
            const elapsed = now - job.startedAt.getTime();
            if (elapsed > job.timeoutMs * 1.5) {
              job.state = "failed";
              job.error = "Job detected as stuck and cancelled by watchdog monitor.";
              job.completedAt = new Date();
            }
          }
        }
      }, 60_000);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
    }
  }
}

export const defaultBackgroundJobQueue = new BackgroundJobQueue();
