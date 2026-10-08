import { CompletionRequest, CompletionResponse } from "./types";

export function executeDeterministicFallback(request: CompletionRequest): CompletionResponse {
  const taskNormalized = request.task.toUpperCase();

  switch (taskNormalized) {
    case "PROFILE_EXTRACT":
    case "RESUME_INTERPRETATION": {
      const fallbackExtraction = {
        education: [],
        experience: [],
        projects: [],
        skills: [],
        certifications: [],
      };
      return {
        content: JSON.stringify(fallbackExtraction),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "GOAL_INTERPRETATION": {
      const promptLower = (request.userPrompt || "").toLowerCase();
      let goalCategory = "internship";
      if (promptLower.includes("internship")) goalCategory = "internship";
      else if (promptLower.includes("job") || promptLower.includes("placement")) goalCategory = "placement";
      else if (promptLower.includes("research") || promptLower.includes("paper")) goalCategory = "research";
      else if (promptLower.includes("mastery") || promptLower.includes("master") || promptLower.includes("learn")) goalCategory = "mastery";

      const fallbackGoal = {
        goalCategory,
        normalizedTargetRole: "Machine Learning Engineer",
        aiDomain: "Machine Learning Foundations",
        urgencyTimeline: "6_months",
        clarificationNeeds: [],
        confidenceScore: 0.9,
      };
      return {
        content: JSON.stringify(fallbackGoal),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "PROJECT_SUMMARY":
    case "PROJECT_SUMMARIZATION": {
      return {
        content: "Applied project focused on AI/ML and software engineering techniques.",
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "PROJECT_TECH_DETECTION":
    case "TECHNOLOGY_EXTRACTION": {
      return {
        content: JSON.stringify({
          technologies: [],
          reason: "Deterministic extraction fallback completed.",
        }),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "ROADMAP_EXPLANATION":
    case "ROADMAP_WORDING": {
      const fallbackRoadmap = {
        overview: "Your personalized progression is structured to bridge target-role prerequisites through verified evidence milestones.",
        currentMilestoneFocus: "Foundational AI/ML competency demonstration",
        keyActionTitle: "Build & Deploy Candidate Artifact",
        keyActionReason: "Publishing a working artifact directly satisfies target-role requirements.",
        keyActionUrl: "/student/projects",
      };
      return {
        content: JSON.stringify(fallbackRoadmap),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "LEARNING_RECOMMENDATIONS": {
      const fallbackLearning = {
        recommendations: [
          {
            topicId: "py_ml_foundations",
            topicName: "Python for Machine Learning",
            reason: "Core prerequisite for all subsequent model development workflows.",
            prerequisiteLink: "Data Analysis & Vectorized Operations",
            estimatedHours: 8,
            difficulty: "beginner",
            actionUrl: "/student/roadmap",
          },
        ],
      };
      return {
        content: JSON.stringify(fallbackLearning),
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "EORA_EXPLANATION": {
      return {
        content:
          "Tathastu evaluates your progress based exclusively on confirmed evidence items in your profile. Missing evidence is never considered a weakness — it simply represents areas where we haven't seen your work yet.",
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }

    case "EORA_CHAT":
    default: {
      const promptLower = (request.userPrompt || "").toLowerCase();
      let content =
        "I'm EORA, your AI copilot. I'm tracking your progress toward your AI/ML goals. You can ask me how to improve your projects, what skills to learn next, or how to get your evidence verified.";

      if (promptLower.includes("verify") || promptLower.includes("verification")) {
        content =
          "To get your project or skill verified, navigate to the Evidence Ledger and click 'Request Verification'. Institutional reviewers (faculty or mentors) will evaluate your submitted work and issue a verified badge.";
      } else if (promptLower.includes("project") || promptLower.includes("portfolio")) {
        content =
          "To strengthen your project portfolio, ensure each project has a clear problem statement, clean GitHub repository, and documented metrics (such as model accuracy or inference latency). Submitting your projects for verification in AI Tathastu will officially publish them to your evidence ledger.";
      } else if (promptLower.includes("skill") || promptLower.includes("missing") || promptLower.includes("gap")) {
        content =
          "For an AI / ML Engineer role, the most impactful competencies to demonstrate are production model serving (FastAPI/Docker), vector search architectures (FAISS/RAG), and algorithmic problem solving. Focusing on one gap at a time produces the fastest verified progress.";
      } else if (promptLower.includes("roadmap") || promptLower.includes("milestone") || promptLower.includes("next")) {
        content =
          "Your roadmap is structured into 5 stages: Foundations -> Core ML -> Applied Projects -> Production Deployment & Verification -> Placement. Focus on completing your current stage's primary action before advancing.";
      }

      return {
        content,
        provider: "deterministic_fallback",
        modelUsed: "deterministic_rule_engine",
        fallbackUsed: true,
      };
    }
  }
}
