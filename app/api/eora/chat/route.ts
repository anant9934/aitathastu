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
import { getExternalConnections } from "@/lib/repositories/connection-repository";
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
    const connections = await getExternalConnections(personId);

    const goalTitle = person360.activeGoal?.title || "No goal selected";
    const skillsList = (person360.evidence || []).filter((e) => e.category === "skill" && e.verificationStatus !== "rejected").map((e) => e.subject);
    const projectsList = (person360.projects || []).filter((p) => p.status === "confirmed").map((p) => p.title).slice(0, 5).join(", ") || "No confirmed projects";
    const verifiedCount = (person360.evidence || []).filter((e) => e.verificationStatus === "verified").length;
    const readinessText = `${verifiedCount} independently verified evidence items`;
    const githubProjects = (person360.projects || [])
      .filter((p) => (p.sources || []).includes("github"))
      .map((p) => p.title);
    const resumeEvidence = (person360.evidence || []).filter(
      (e) => e.source === "resume" || (e.sourceReference && e.sourceReference.startsWith("resume:"))
    );
    const resumeSkills = resumeEvidence.filter((e) => e.category === "skill").map((e) => e.subject);
    const resumeProjects = resumeEvidence.filter((e) => e.category === "project").map((e) => e.subject);
    const unconfirmedSkills = (person360.evidence || [])
      .filter((e) => e.category === "skill" && e.verificationStatus !== "verified")
      .map((e) => e.subject);

    // V4.0 Footprint Intelligence Context
    const connectedAccounts = connections.filter((c: any) => c.status === "connected").map((c: any) => c.provider);
    const linkedProfiles = connections.filter((c: any) => c.status === "reference_only").map((c: any) => c.provider);
    const hfModels = (person360.evidence || [])
      .filter((e) => e.sourceReference && e.sourceReference.includes("huggingface.co"))
      .map((e) => e.subject);
    const orcidPapers = (person360.evidence || [])
      .filter((e) => e.sourceReference && (e.sourceReference.includes("doi.org") || e.sourceReference.includes("orcid.org")))
      .map((e) => e.subject);
    const technicalArticles = (person360.evidence || [])
      .filter((e) => e.sourceReference && e.sourceReference.includes("dev.to"))
      .map((e) => e.subject);
    const staleSources = connections
      .filter((c: any) => c.status === "connected" && (!c.lastSyncedAt || Date.now() - new Date(c.lastSyncedAt).getTime() > 7 * 86400000))
      .map((c: any) => c.provider);

    const leetcodeEvidence = (person360.evidence || []).find((e) => e.subject.toLowerCase().includes("leetcode"));
    const codechefEvidence = (person360.evidence || []).find((e) => e.subject.toLowerCase().includes("codechef"));
    const hackerrankBadges = (person360.evidence || []).filter((e) => e.subject.toLowerCase().includes("hackerrank"));
    const hackerearthEvidence = (person360.evidence || []).find((e) => e.subject.toLowerCase().includes("hackerearth"));
    const kaggleArtifacts = (person360.projects || []).filter((p) => (p.sources || []).includes("kaggle"));

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
   - Connected Accounts: ${wrapUntrustedContent("connected_accounts", connectedAccounts.join(", ") || "None")}
   - Linked Profiles: ${wrapUntrustedContent("linked_profiles", linkedProfiles.join(", ") || "None")}
   - Recorded Skills: ${wrapUntrustedContent("skills", skillsList.slice(0, 10).join(", ") || "None")}
   - Unconfirmed Skills: ${wrapUntrustedContent("unconfirmed_skills", unconfirmedSkills.slice(0, 8).join(", ") || "None")}
   - Confirmed Projects: ${wrapUntrustedContent("projects", projectsList)}
   - GitHub Projects: ${wrapUntrustedContent("github_projects", githubProjects.join(", ") || "None")}
   - Hugging Face Models: ${wrapUntrustedContent("hf_models", hfModels.join(", ") || "None")}
   - Kaggle Artifacts: ${wrapUntrustedContent("kaggle_artifacts", kaggleArtifacts.map((k) => k.title).join(", ") || "None")}
   - LeetCode Evidence: ${wrapUntrustedContent("leetcode_evidence", leetcodeEvidence ? `${leetcodeEvidence.subject}: ${leetcodeEvidence.value}` : "None")}
   - CodeChef Evidence: ${wrapUntrustedContent("codechef_evidence", codechefEvidence ? `${codechefEvidence.subject}: ${codechefEvidence.value}` : "None")}
   - HackerRank Badges: ${wrapUntrustedContent("hackerrank_badges", hackerrankBadges.map((b) => b.subject).join(", ") || "None")}
   - Research Papers (ORCID): ${wrapUntrustedContent("orcid_papers", orcidPapers.join("; ") || "None")}
   - Published Technical Articles: ${wrapUntrustedContent("technical_articles", technicalArticles.join("; ") || "None")}
   - Resume Items: ${wrapUntrustedContent("resume_skills", resumeSkills.join(", ") || "None")}
   - Verification: ${readinessText}
${knowledgeContext}
2. Suggest concrete, actionable next steps in the student workspace (e.g. building project evidence, practicing code, or requesting faculty verification).
3. Keep responses conversational, concise (2-4 sentences), and motivating.
4. Always cite source provenance when answering which projects or skills came from where.
5. Never invent fake accomplishments, scores, or external data.`;

    const response = await defaultIntelligenceRouter.complete({
      task: "EORA_CHAT",
      systemPrompt,
      userPrompt: message,
      personId,
    });

    const replyContent = response.content.trim();

    // 3. Grounded Deterministic Reply Fallback for common student questions
    let finalReply = replyContent;
    let proposedAction: EoraActionProposal | undefined = undefined;
    const lowerMsg = message.toLowerCase();
    const lowerReply = replyContent.toLowerCase();

    // Check specific digital footprint questions first (even if LLM or fallback)
    if (
      lowerMsg.includes("which digital accounts") ||
      (lowerMsg.includes("connected") && lowerMsg.includes("account")) ||
      lowerMsg.includes("accounts have i connected")
    ) {
      finalReply = connectedAccounts.length > 0
        ? `You have connected ${connectedAccounts.length} account(s): ${connectedAccounts.map((a: string) => a.toUpperCase()).join(", ")}. These accounts have authorized data access or verified imports.`
        : `You haven't authorized full data access for any external accounts yet. You can connect your GitHub, Hugging Face, or LinkedIn export in Step 6.`;
      proposedAction = {
        actionId: "act_view_footprints",
        actionType: "Verify",
        label: "Manage Digital Footprints",
        destinationUrl: "/student/profile",
        contextReason: "Inspect connected developer profiles",
        requiresConfirmation: false,
      };
    } else if (
      lowerMsg.includes("which profiles") &&
      (lowerMsg.includes("only linked") || lowerMsg.includes("linked-only") || lowerMsg.includes("just linked"))
    ) {
      finalReply = linkedProfiles.length > 0
        ? `The following profiles are currently reference-only links without automated synchronization: ${linkedProfiles.map((p: string) => p.toUpperCase()).join(", ")}. In accordance with platform terms, stats on these profiles remain self-reported or reference links.`
        : `You currently have no linked-only profile references. All your current footprints are either fully connected or pending addition.`;
      proposedAction = {
        actionId: "act_view_footprints",
        actionType: "Verify",
        label: "Manage Digital Footprints",
        destinationUrl: "/student/profile",
        contextReason: "Inspect reference-only links",
        requiresConfirmation: false,
      };
    } else if ((lowerMsg.includes("github") && lowerMsg.includes("project")) || lowerMsg.includes("from github")) {
      if (githubProjects.length > 0) {
        finalReply = `The following ${githubProjects.length} project(s) were imported from your GitHub account: ${githubProjects.join(", ")}. Each includes detected repository technologies and contribution metadata.`;
      } else {
        finalReply = `You currently have no projects imported from GitHub. You can link your GitHub account or import a repository in Digital Footprints.`;
      }
      proposedAction = {
        actionId: "act_workspace_projects",
        actionType: "Build",
        label: "View GitHub Projects",
        destinationUrl: "/student/projects",
        contextReason: "Inspect repository evidence and contribution notes",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("hugging face") && (lowerMsg.includes("model") || lowerMsg.includes("artifact"))) {
      finalReply = hfModels.length > 0
        ? `Your profile records ${hfModels.length} Hugging Face model artifact(s): ${hfModels.join(", ")}. These are public model repositories discovered from your Hub account.`
        : `No Hugging Face models are currently linked to your profile. You can link your Hugging Face username in Step 6 to discover public models, datasets, and Spaces.`;
      proposedAction = {
        actionId: "act_workspace_projects",
        actionType: "Build",
        label: "View ML Models",
        destinationUrl: "/student/projects",
        contextReason: "Inspect Hugging Face model artifacts",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("orcid") || (lowerMsg.includes("paper") && lowerMsg.includes("research"))) {
      finalReply = orcidPapers.length > 0
        ? `Your public ORCID record contained ${orcidPapers.length} research publication(s): ${orcidPapers.slice(0, 3).join("; ")}. Peer-reviewed works are verified via persistent DOIs.`
        : `No research publications are currently imported from ORCID. You can connect your 16-character ORCID identifier in Step 6 to import scholarly works.`;
      proposedAction = {
        actionId: "act_workspace_verify",
        actionType: "Verify",
        label: "View Research Evidence",
        destinationUrl: "/verification",
        contextReason: "Review academic publications and DOIs",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("technical article") || (lowerMsg.includes("article") && lowerMsg.includes("published"))) {
      finalReply = technicalArticles.length > 0
        ? `You have ${technicalArticles.length} published technical article(s) recorded: ${technicalArticles.slice(0, 3).join("; ")}. Topics have been categorized to support your software engineering evidence.`
        : `No published technical articles are currently recorded. You can connect your DEV.to username to import public technical tutorials.`;
      proposedAction = {
        actionId: "act_workspace_evidence",
        actionType: "Verify",
        label: "View Technical Writing",
        destinationUrl: "/verification",
        contextReason: "Inspect published technical articles",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("leetcode") || lowerMsg.includes("problems solved")) {
      finalReply = leetcodeEvidence
        ? `Your LeetCode record indicates ${leetcodeEvidence.value}. Provenance: ${leetcodeEvidence.interpretation || "Student verified coding profile"}.`
        : `No LeetCode practice evidence is recorded yet. You can upload an authorized export or confirm your statistics in Step 6.`;
      proposedAction = {
        actionId: "act_view_footprints",
        actionType: "Practice",
        label: "View Coding Profiles",
        destinationUrl: "/student/profile",
        contextReason: "Inspect LeetCode problem solving metrics",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("codechef") || (lowerMsg.includes("contest") && lowerMsg.includes("rating"))) {
      finalReply = codechefEvidence
        ? `Your CodeChef competitive programming evidence shows: ${codechefEvidence.value}.`
        : `No CodeChef contest records are currently stored. You can import your CodeChef account or export file in Step 6.`;
      proposedAction = {
        actionId: "act_view_footprints",
        actionType: "Practice",
        label: "View Competitive Programming",
        destinationUrl: "/student/profile",
        contextReason: "Inspect CodeChef contest performance",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("hackerrank") || (lowerMsg.includes("badge") && !lowerMsg.includes("stack overflow"))) {
      finalReply = hackerrankBadges.length > 0
        ? `You have earned ${hackerrankBadges.length} HackerRank skill badge(s): ${hackerrankBadges.map((b) => b.subject.replace("HackerRank Badge: ", "")).slice(0, 4).join(", ")}.`
        : `No HackerRank badges are currently recorded. You can connect your profile or import your badge export in Step 6.`;
      proposedAction = {
        actionId: "act_view_footprints",
        actionType: "Practice",
        label: "View HackerRank Badges",
        destinationUrl: "/student/profile",
        contextReason: "Inspect earned skill badges",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("kaggle")) {
      finalReply = kaggleArtifacts.length > 0
        ? `You have ${kaggleArtifacts.length} Kaggle project(s) recorded: ${kaggleArtifacts.map((k) => k.title).slice(0, 3).join(", ")}. These datasets and notebooks corroborate your practical data science fluency.`
        : `No Kaggle artifacts are currently recorded. You can connect your Kaggle username or upload an export file in Step 6.`;
      proposedAction = {
        actionId: "act_workspace_projects",
        actionType: "Build",
        label: "View Kaggle Projects",
        destinationUrl: "/student/projects",
        contextReason: "Inspect data science notebooks and datasets",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("evidence supports") || (lowerMsg.includes("evidence") && lowerMsg.includes("goal"))) {
      finalReply = `To support your goal of ${goalTitle}, you currently have ${readinessText}, ${person360.projects?.length || 0} candidate projects, and ${skillsList.length} recorded skills across your verified resume and digital footprint sources.`;
      proposedAction = {
        actionId: "act_workspace_roadmap",
        actionType: "Navigate",
        label: "View Goal Evidence",
        destinationUrl: "/student/roadmap",
        contextReason: "Inspect ordered milestones and skill evidence",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("haven't synchronized") || lowerMsg.includes("not synchronized") || lowerMsg.includes("stale")) {
      finalReply = staleSources.length > 0
        ? `The following sources have not been synchronized recently: ${staleSources.map((s: string) => s.toUpperCase()).join(", ")}. You can trigger a refresh from your Digital Footprints settings.`
        : `All your connected data sources are current or represent static confirmed imports.`;
      proposedAction = {
        actionId: "act_view_footprints",
        actionType: "Verify",
        label: "Check Sync Status",
        destinationUrl: "/student/profile",
        contextReason: "Review digital profile synchronization dates",
        requiresConfirmation: false,
      };
    } else if (lowerMsg.includes("needs my confirmation") || lowerMsg.includes("unconfirmed")) {
      if (unconfirmedSkills.length > 0) {
        finalReply = `You have ${unconfirmedSkills.length} unconfirmed skill candidate(s) awaiting your review: ${unconfirmedSkills.slice(0, 6).join(", ")}. Please review them so they become canonical evidence.`;
      } else {
        finalReply = `All your currently recorded skills and projects have been confirmed or verified.`;
      }
      proposedAction = {
        actionId: "act_verify_evidence",
        actionType: "Verify",
        label: "Review Unconfirmed Items",
        destinationUrl: "/student/skills",
        contextReason: "Review candidate skills and contributions",
        requiresConfirmation: false,
      };
    } else if (response.fallbackUsed) {
      if ((lowerMsg.includes("github") && lowerMsg.includes("project")) || lowerMsg.includes("from github")) {
        if (githubProjects.length > 0) {
          finalReply = `The following ${githubProjects.length} project(s) came from your GitHub account: ${githubProjects.join(", ")}. Each has your documented personal contributions and repository link.`;
        } else {
          finalReply = `You currently have no projects imported from GitHub. You can link your GitHub account or import a repository in Digital Footprints.`;
        }
        proposedAction = {
          actionId: "act_workspace_projects",
          actionType: "Build",
          label: "View GitHub Projects",
          destinationUrl: "/student/projects",
          contextReason: "Inspect repository evidence and contribution notes",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("resume") || lowerMsg.includes("cv")) {
        const detailParts: string[] = [];
        if (resumeSkills.length > 0) detailParts.push(`${resumeSkills.length} skill(s) (${resumeSkills.slice(0, 5).join(", ")})`);
        if (resumeProjects.length > 0) detailParts.push(`${resumeProjects.length} project(s)`);
        finalReply = detailParts.length > 0
          ? `From your resume, I extracted ${detailParts.join(" and ")}. All items require your student review before canonical inclusion.`
          : `I reviewed your resume records. We extracted ${skillsList.length} skills and ${person360.projects?.length || 0} projects. You can review and confirm unverified claims directly in your profile.`;
        proposedAction = {
          actionId: "act_review_skills",
          actionType: "Verify",
          label: "Review Extracted Skills",
          destinationUrl: "/student/skills",
          contextReason: "Inspect unconfirmed resume extractions",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("unconfirmed") || (lowerMsg.includes("skill") && (lowerMsg.includes("still") || lowerMsg.includes("not verified")))) {
        if (unconfirmedSkills.length > 0) {
          finalReply = `Your unconfirmed skills are: ${unconfirmedSkills.slice(0, 6).join(", ")}. These are currently self-reported or source-detected and await your confirmation or faculty review.`;
        } else {
          finalReply = `All your currently recorded skills have been confirmed or verified.`;
        }
        proposedAction = {
          actionId: "act_verify_evidence",
          actionType: "Verify",
          label: "Evidence & Verification",
          destinationUrl: "/verification",
          contextReason: "Submit evidence for institutional verification",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("why") && (lowerMsg.includes("recommend") || lowerMsg.includes("roadmap") || lowerMsg.includes("milestone"))) {
        finalReply = `I recommended this milestone because your target role is ${goalTitle}, and our gap analysis identified that you need practical project evidence and verified skill mastery to meet industry expectations for this track.`;
        proposedAction = {
          actionId: "act_workspace_roadmap",
          actionType: "Navigate",
          label: "View Personalized Roadmap",
          destinationUrl: "/student/roadmap",
          contextReason: "Inspect ordered milestones for target role",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("project")) {
        finalReply = `Your profile currently records ${person360.projects?.length || 0} projects (${projectsList}). You can document personal contributions and add evaluation metrics in your project workspace.`;
        proposedAction = {
          actionId: "act_workspace_projects",
          actionType: "Build",
          label: "Open Project Workspace",
          destinationUrl: "/student/projects",
          contextReason: "View and edit recorded projects",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("roadmap") || lowerMsg.includes("next") || lowerMsg.includes("work on")) {
        finalReply = `For your goal of ${goalTitle}, your recommended next focus is advancing your project evidence and completing your foundational competency milestones.`;
        proposedAction = {
          actionId: "act_workspace_roadmap",
          actionType: "Navigate",
          label: "View Personalized Roadmap",
          destinationUrl: "/student/roadmap",
          contextReason: "Inspect ordered milestones for target role",
          requiresConfirmation: false,
        };
      } else {
        finalReply = `Hello ${studentName}! I am here to help you advance towards your goal of ${goalTitle}. Currently, you have ${skillsList.length} recorded skills and ${verifiedCount} verified evidence items.`;
      }
    } else {
      // LLM was live, match contextual proposed action
      if (lowerMsg.includes("project") || lowerReply.includes("project")) {
        proposedAction = {
          actionId: "act_workspace_projects",
          actionType: "Build",
          label: "Open Project Workspace",
          destinationUrl: "/student/projects",
          contextReason: "Document and build candidate artifact for evidence ledger",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("roadmap") || lowerMsg.includes("milestone") || lowerReply.includes("roadmap")) {
        proposedAction = {
          actionId: "act_workspace_roadmap",
          actionType: "Navigate",
          label: "View Personalized Roadmap",
          destinationUrl: "/student/roadmap",
          contextReason: "Inspect competency prerequisites for target role",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("verify") || lowerMsg.includes("verification") || lowerReply.includes("verification")) {
        proposedAction = {
          actionId: "act_workspace_verify",
          actionType: "Verify",
          label: "Evidence & Verification",
          destinationUrl: "/verification",
          contextReason: "Submit evidence item for institutional review",
          requiresConfirmation: false,
        };
      } else if (lowerMsg.includes("profile") || lowerMsg.includes("goal")) {
        proposedAction = {
          actionId: "act_workspace_profile",
          actionType: "Navigate",
          label: "View Profile & Goals",
          destinationUrl: "/student/profile",
          contextReason: "Update career target and academic settings",
          requiresConfirmation: false,
        };
      }
    }

    // 4. Handle Streaming Response if Requested
    if (isStreamRequested) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const words = finalReply.split(" ");
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
      reply: finalReply,
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
