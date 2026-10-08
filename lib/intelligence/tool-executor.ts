/**
 * AI TATHASTU — SAFE INTELLIGENCE TOOL EXECUTOR
 * 
 * Enforces strict authorization, schema validation, audit logging,
 * and user confirmation gates before any application state mutation.
 * 
 * STRICT PROHIBITIONS:
 * - NO arbitrary SQL execution
 * - NO unrestricted HTTP network calls
 * - NO server file access
 * - NO untrusted code execution
 */

import { z } from "zod";
import crypto from "crypto";
import { getDb, aiAuditLogs } from "../db";
import { saveProject } from "../repositories/project-repository";
import { setActiveGoal } from "../repositories/goal-repository";
import { createVerificationRequest } from "../repositories/verification-repository";

export interface ToolExecutionContext {
  personId: string;
  authenticatedUserId: string;
  clientIp?: string;
  isConfirmedByUser: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  actionSummary: string;
  requiresUserConfirmation?: boolean;
  confirmationPayload?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

// ------------------------------------------------------------------------------
// Permitted Tool Schemas
// ------------------------------------------------------------------------------

export const ProposeAddProjectParams = z.object({
  title: z.string().min(2).max(150),
  description: z.string().min(10).max(1000),
  technologies: z.array(z.string().max(50)).default([]),
  repositoryUrl: z.string().url().max(300).optional(),
  contributionNote: z.string().max(300).optional(),
});

export const ProposeUpdateGoalParams = z.object({
  targetRole: z.string().min(2).max(100),
  goalTitle: z.string().min(3).max(200),
  targetTimeline: z.string().max(50).optional(),
});

export const ProposeRequestVerificationParams = z.object({
  evidenceId: z.string().min(1).max(100),
  submissionNotes: z.string().max(500).optional(),
});

// ------------------------------------------------------------------------------
// Safe Tool Executor
// ------------------------------------------------------------------------------

export class SafeToolExecutor {
  /**
   * Executes or prepares a permitted tool action through domain services.
   */
  async execute(
    toolName: string,
    rawParams: unknown,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let status: "success" | "error" = "success";
    let errorMsg: string | undefined;

    try {
      // 1. Authenticate & Authorize Context
      if (!context.personId || !context.authenticatedUserId) {
        throw new Error("Unauthorized tool execution: valid authenticated person context required.");
      }

      // 2. Dispatch to strictly bounded domain handlers
      switch (toolName) {
        case "propose_add_project": {
          const parsed = ProposeAddProjectParams.parse(rawParams);
          
          // Require user confirmation before persisting a project created via conversational assistant
          if (!context.isConfirmedByUser) {
            return {
              success: true,
              toolName,
              actionSummary: `Prepared draft project: "${parsed.title}". Confirmation required.`,
              requiresUserConfirmation: true,
              confirmationPayload: parsed,
            };
          }

          const saved = await saveProject(context.personId, {
            title: parsed.title,
            description: parsed.description,
            technologies: parsed.technologies,
            repositoryUrl: parsed.repositoryUrl,
            status: "in_progress",
          });

          return {
            success: true,
            toolName,
            actionSummary: `Successfully saved project "${parsed.title}" to evidence draft.`,
            output: { projectId: saved.id },
          };
        }

        case "propose_update_goal": {
          const parsed = ProposeUpdateGoalParams.parse(rawParams);

          if (!context.isConfirmedByUser) {
            return {
              success: true,
              toolName,
              actionSummary: `Propose updating target goal to: "${parsed.goalTitle}" (${parsed.targetRole}). Confirmation required.`,
              requiresUserConfirmation: true,
              confirmationPayload: parsed,
            };
          }

          const saved = await setActiveGoal(
            context.personId,
            parsed.goalTitle,
            parsed.targetRole,
            "custom"
          );

          return {
            success: true,
            toolName,
            actionSummary: `Updated active career goal to "${parsed.goalTitle}".`,
            output: { goalId: saved.id },
          };
        }

        case "propose_request_verification": {
          const parsed = ProposeRequestVerificationParams.parse(rawParams);

          if (!context.isConfirmedByUser) {
            return {
              success: true,
              toolName,
              actionSummary: `Request faculty verification for evidence record: ${parsed.evidenceId}. Confirmation required.`,
              requiresUserConfirmation: true,
              confirmationPayload: parsed,
            };
          }

          const req = await createVerificationRequest({
            evidenceId: parsed.evidenceId,
            requesterPersonId: context.personId,
            organizationId: "org-default",
            studentNotes: parsed.submissionNotes,
          });

          return {
            success: true,
            toolName,
            actionSummary: `Verification request submitted for review.`,
            output: { requestId: req.id },
          };
        }

        default:
          throw new Error(`Tool "${toolName}" is not permitted or does not exist.`);
      }
    } catch (err: unknown) {
      status = "error";
      errorMsg = err instanceof Error ? err.message : "Unknown execution failure";
      return {
        success: false,
        toolName,
        actionSummary: "Failed to execute tool.",
        error: errorMsg,
      };
    } finally {
      // Audit execution record in aiAuditLogs
      if (process.env.NODE_ENV !== "test") {
        try {
          const db = await getDb();
          const auditId = `audit_tool_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
          await db.insert(aiAuditLogs).values({
            id: auditId,
            personId: context.personId,
            task: "EORA_CHAT",
            provider: "tool_executor",
            model: toolName,
            promptVersion: "tool_v1",
            latencyMs: Date.now() - startTime,
            status,
            fallbackUsed: false,
          });
        } catch {
          // Non-fatal logging
        }
      }
    }
  }
}

export const defaultSafeToolExecutor = new SafeToolExecutor();
