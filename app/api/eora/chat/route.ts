/**
 * AI TATHASTU — EORA CONVERSATIONAL INTELLIGENCE API
 * 
 * Grounded conversational assistant incorporating RAG retrieval over
 * Canonical AI/ML knowledge, verified student evidence graph,
 * safe action proposals, and optional streaming responses.
 */

import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/auth/server-session";
import { getPerson360 } from "@/lib/services/person-360-service";
import { defaultIntelligenceRouter } from "@/lib/intelligence/router";
import { retrieveKnowledge } from "@/lib/knowledge/rag-engine";
import type { EoraActionProposal } from "@/lib/intelligence/schemas";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { wrapUntrustedContent } from "@/lib/intelligence/prompt-defense";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const isStreamRequested = body.stream === true;

    if (!message || message.length > 2000) {
      return NextResponse.json({ error: "Enter a message under 2,000 characters." }, { status: 400 });
    }

    const auth = await getServerAuthContext();
    if (!auth) return NextResponse.json({ error: "Sign in to ask EORA about your profile." }, { status: 401 });
    if (!checkRateLimit(auth.person.id, "ai").allowed) return NextResponse.json({ error: "Please wait before sending another question." }, { status: 429 });
    const personId = auth.person.id;
    const studentName = auth.person.displayName;
    const person360 = await getPerson360(personId, personId);
    const goalTitle = person360.activeGoal?.title || "No goal selected";
    const skillsList = (person360.evidence || []).filter((e) => e.category === "skill" && e.verificationStatus !== "rejected").map((e) => e.subject);
    const projectsList = (person360.projects || []).filter((p) => p.status === "confirmed").map((p) => p.title).slice(0, 5).join(", ") || "No confirmed projects";
    const verifiedCount = (person360.evidence || []).filter((e) => e.verificationStatus === "verified").length;
    const readinessText = `${verifiedCount} independently verified evidence items`;

    // 1. RAG Knowledge Retrieval over Canonical AI/ML Knowledge Base
    const ragBundle = retrieveKnowledge({
      query: message,
      targetRole: goalTitle,
      evidencedSkills: skillsList,
      maxResults: 2,
    });

    const knowledgeContext = ragBundle.formattedContextText
      ? `\nRETRIEVED DOMAIN KNOWLEDGE:\n${ragBundle.formattedContextText}\n`
      : "";

    // 2. Formulate Grounded System Prompt
    const systemPrompt = `You are EORA, the personal AI copilot for AI Tathastu.
You are a warm, supportive, and intelligent mentor with dark hair tied back, round black glasses, and a light-blue hoodie with the AI Tathastu logo.
Speak in encouraging, precise, professional English.

GROUNDING RULES:
1. Ground your advice exclusively in the student's actual profile context:
   - Student Name: ${wrapUntrustedContent("name", studentName)}
   - Target Goal: ${wrapUntrustedContent("goal", goalTitle)}
   - Recorded Skills (not necessarily verified): ${wrapUntrustedContent("skills", skillsList.slice(0, 8).join(", ") || "None")}
   - Confirmed Projects: ${wrapUntrustedContent("projects", projectsList)}
   - Verification: ${readinessText}
${knowledgeContext}
2. Suggest concrete, actionable next steps in the student workspace (e.g. building project evidence, practicing code, or requesting faculty verification).
3. Keep responses conversational, concise (2-4 sentences), and motivating.
4. Never invent fake accomplishments, scores, or external data.`;

    const response = await defaultIntelligenceRouter.complete({
      task: "EORA_CHAT",
      systemPrompt,
      userPrompt: message,
      personId,
    });

    const replyContent = response.content.trim();

    // 3. Propose Validated Contextual Action
    let proposedAction: EoraActionProposal | undefined = undefined;
    const lowerMsg = message.toLowerCase();
    const lowerReply = replyContent.toLowerCase();

    if (!response.fallbackUsed && (lowerMsg.includes("project") || lowerMsg.includes("portfolio") || lowerReply.includes("project"))) {
      proposedAction = {
        actionId: "act_workspace_projects",
        actionType: "Build",
        label: "Open Project Workspace",
        destinationUrl: "/student/projects",
        contextReason: "Document and build candidate artifact for evidence ledger",
        requiresConfirmation: false,
      };
    } else if (!response.fallbackUsed && (lowerMsg.includes("roadmap") || lowerMsg.includes("milestone") || lowerReply.includes("roadmap"))) {
      proposedAction = {
        actionId: "act_workspace_roadmap",
        actionType: "Navigate",
        label: "View Personalized Roadmap",
        destinationUrl: "/student/roadmap",
        contextReason: "Inspect competency prerequisites for target role",
        requiresConfirmation: false,
      };
    } else if (!response.fallbackUsed && (lowerMsg.includes("verify") || lowerMsg.includes("verification") || lowerReply.includes("verification"))) {
      proposedAction = {
        actionId: "act_workspace_verify",
        actionType: "Verify",
        label: "Evidence & Verification",
        destinationUrl: "/verification",
        contextReason: "Submit evidence item for institutional review",
        requiresConfirmation: false,
      };
    }

    // 4. Handle Streaming Response if Requested
    if (isStreamRequested) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const words = replyContent.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i < words.length) {
              const chunk = words[i] + (i === words.length - 1 ? "" : " ");
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
              );
              i++;
            } else {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    proposedAction,
                    referencedSources: ragBundle.referencedResources.map((r) => ({
                      title: r.title,
                      url: r.url,
                    })),
                    provider: response.provider,
                    model: response.modelUsed,
                  })}\n\n`
                )
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              clearInterval(interval);
              controller.close();
            }
          }, 25);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // 5. Standard JSON Response
    return NextResponse.json({
      reply: replyContent,
      proposedAction,
      referencedSources: ragBundle.referencedResources.map((r) => ({
        title: r.title,
        url: r.url,
        provider: r.provider,
      })),
      provider: response.provider,
      model: response.modelUsed,
      fallbackUsed: response.fallbackUsed,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal chat error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
